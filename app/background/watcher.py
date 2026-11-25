import asyncio
import logging
from typing import Any, Optional

from app.db.repositories.env_logs import EnvLogsRepository
from app.db.repositories.pens import PensRepository
from app.db.repositories.inventory import InventoryRepository
from app.db.repositories.animals import AnimalsRepository
from app.db.repositories.crops import CropsRepository
from app.mcp.mcp_server import create_system_alert, control_device
from app.api.websocket_manager import ws_manager
from app.background.newsfeed_service import sync_newsfeed_to_store
from app.config import get_settings

logger = logging.getLogger("smart_manager.watcher")

_watcher_task: Optional[asyncio.Task] = None
_is_running = False
_last_processed_log_by_pen: dict[str, Any] = {}
_seen_proactive_keys: set[str] = set()

# Ngưỡng phát hiện bất thường môi trường chuồng trại
DELTA_TEMP_THRESHOLD = 3.0       # Biến thiên nhiệt độ >= 3.0°C giữa 2 lần đo liên tiếp
DELTA_HUM_THRESHOLD = 15.0       # Biến thiên độ ẩm >= 15.0%
MAX_TEMPERATURE = 35.0           # Nhiệt độ quá nóng gây sốc nhiệt gia súc
MIN_TEMPERATURE = 15.0           # Nhiệt độ quá lạnh
MIN_HUMIDITY = 40.0              # Quá khô
MAX_HUMIDITY = 90.0              # Quá ẩm ướt
MAX_SMELL_LEVEL = 10.0           # Ngưỡng nồng độ mùi hôi / khí chuồng nguy hiểm


async def _evaluate_anomaly_with_gemini(log_curr: dict, log_prev: dict, reasons: list[str]) -> str:
    """Send sensor anomaly data to Gemini to produce an expert evaluation and recommendation."""
    settings = get_settings()
    summary_reason = "; ".join(reasons)
    pen_id = log_curr.get("pen_id") or "123"

    if settings.is_gemini_configured:
        try:
            from google import genai
            client = genai.Client(api_key=settings.GEMINI_API_KEY)
            prompt = (
                f"Phát hiện bất thường môi trường chuồng trại (Chuồng: {pen_id}): {summary_reason}.\n"
                f"- Hiện tại: Nhiệt độ {log_curr.get('temperature')}°C, Độ ẩm {log_curr.get('humidity')}%, Nồng độ mùi: {log_curr.get('smell_level')}\n"
                f"- Liền trước: Nhiệt độ {log_prev.get('temperature')}°C, Độ ẩm {log_prev.get('humidity')}%, Nồng độ mùi: {log_prev.get('smell_level')}\n"
                "Hãy đưa ra 1 thông báo cảnh báo súc tích (1-2 câu) và hành động khẩn cấp cần thực hiện."
            )
            response = client.models.generate_content(
                model=settings.GEMINI_MODEL,
                contents=prompt,
            )
            if response.text:
                return response.text.strip()
        except Exception as e:
            logger.warning(f"Gemini evaluation failed in watcher: {e}")

    # Fallback message
    return (
        f"CẢNH BÁO CHUỒNG {pen_id}: {summary_reason}. "
        f"Hiện tại: {log_curr.get('temperature')}°C, {log_curr.get('humidity')}%, Mùi: {log_curr.get('smell_level')}. "
        "Hệ thống đã tự động kích hoạt quạt thông gió làm mát!"
    )


async def _run_proactive_farm_sweep():
    """
    Proactive multi-domain observation:
    Checks low-stock inventory, sick animals, and urgent crops every few cycles,
    emitting deduplicated alerts so the agent doesn't wait until 07:00 AM.
    """
    try:
        low_stocks = InventoryRepository().get_low_stock()
        for item in low_stocks:
            key = f"low_stock:{item.get('name')}"
            if key not in _seen_proactive_keys:
                _seen_proactive_keys.add(key)
                create_system_alert(
                    alert_type="LOW_STOCK",
                    message=(
                        f"Kho vật tư '{item.get('name')}' sắp hết "
                        f"(còn {item.get('quantity')} {item.get('unit')}, ngưỡng tối thiểu {item.get('min_threshold')})."
                    ),
                    pen_id="123",
                )
    except Exception as e:
        logger.debug(f"Proactive inventory sweep skipped: {e}")

    try:
        sick_animals = AnimalsRepository().get_sick_or_attention_animals()
        for animal in sick_animals:
            key = f"sick_animal:{animal.get('id')}:{animal.get('status')}"
            if key not in _seen_proactive_keys:
                _seen_proactive_keys.add(key)
                create_system_alert(
                    alert_type="HEALTH_ALERT",
                    message=(
                        f"Phát hiện vật nuôi {animal.get('id')} ({animal.get('species')}) "
                        f"có trạng thái '{animal.get('status')}' cần kiểm tra y tế ngay."
                    ),
                    pen_id=str(animal.get("pen_id") or "123"),
                )
    except Exception as e:
        logger.debug(f"Proactive animal sweep skipped: {e}")

    try:
        urgent_crops = CropsRepository().get_upcoming_harvests(within_days=3)
        for crop in urgent_crops:
            key = f"harvest:{crop.get('id')}"
            if key not in _seen_proactive_keys:
                _seen_proactive_keys.add(key)
                create_system_alert(
                    alert_type="HARVEST_READY",
                    message=(
                        f"Cây trồng '{crop.get('name')}' sắp đến kỳ thu hoạch "
                        f"(còn {crop.get('days_remaining')} ngày)."
                    ),
                    pen_id=str(crop.get("pen_id") or "Vườn01"),
                )
    except Exception as e:
        logger.debug(f"Proactive crop sweep skipped: {e}")


async def env_watcher_loop(interval_seconds: int = 15):
    """
    Background Task loop (The Watcher):
    Continuously monitors env_logs PER PEN (avoiding cross-pen false deltas)
    and runs periodic proactive sweeps across inventory, animals, and crops.
    """
    global _is_running
    env_repo = EnvLogsRepository()
    pens_repo = PensRepository()
    cycle_count = 0
    logger.info("The Watcher started (interval: %d seconds)...", interval_seconds)

    while _is_running:
        try:
            pens = pens_repo.list_all()
            pen_ids = [str(p.get("id")) for p in pens if p.get("id")] or ["123"]
            has_new_update = False

            for pen_id in pen_ids:
                logs = env_repo.get_latest_logs(limit=2, pen_id=pen_id)
                if not logs:
                    continue

                curr = logs[0]
                curr_id = curr.get("id")
                if curr_id == _last_processed_log_by_pen.get(pen_id):
                    continue
                _last_processed_log_by_pen[pen_id] = curr_id
                has_new_update = True

                prev = logs[1] if len(logs) >= 2 else curr
                t_curr = float(curr.get("temperature", 0))
                t_prev = float(prev.get("temperature", t_curr))
                h_curr = float(curr.get("humidity", 0))
                h_prev = float(prev.get("humidity", h_curr))
                s_curr = float(curr.get("smell_level", 0))

                delta_temp = abs(t_curr - t_prev)
                delta_hum = abs(h_curr - h_prev)

                reasons = []
                auto_actions = []

                if delta_temp >= DELTA_TEMP_THRESHOLD:
                    reasons.append(f"Nhiệt độ đột biến thay đổi {delta_temp:.1f}°C (từ {t_prev}°C lên {t_curr}°C)")
                if delta_hum >= DELTA_HUM_THRESHOLD:
                    reasons.append(f"Độ ẩm đột biến thay đổi {delta_hum:.1f}%")
                if t_curr > MAX_TEMPERATURE:
                    reasons.append(f"Nhiệt độ vượt ngưỡng nóng nguy hiểm ({t_curr}°C > {MAX_TEMPERATURE}°C)")
                    auto_actions.append(("turn_on", "quạt"))
                elif t_curr < MIN_TEMPERATURE:
                    reasons.append(f"Nhiệt độ hạ quá thấp ({t_curr}°C < {MIN_TEMPERATURE}°C)")
                    auto_actions.append(("turn_on", "đèn sưởi"))
                if h_curr < MIN_HUMIDITY:
                    reasons.append(f"Độ ẩm quá thấp ({h_curr}% < {MIN_HUMIDITY}%)")
                    auto_actions.append(("turn_on", "phun sương"))
                if s_curr >= MAX_SMELL_LEVEL:
                    reasons.append(f"Nồng độ mùi / khí amoniac cao nguy hiểm ({s_curr} >= {MAX_SMELL_LEVEL})")
                    auto_actions.append(("turn_on", "quạt"))

                if reasons:
                    logger.warning("Bất thường môi trường phát hiện tại %s: %s", pen_id, reasons)
                    eval_msg = await _evaluate_anomaly_with_gemini(curr, prev, reasons)

                    for action, dev_name in dict.fromkeys(auto_actions):
                        try:
                            dev_res = control_device(action=action, device_name=dev_name, pen_id=pen_id)
                            logger.info(f"The Watcher auto-triggered {dev_name} at {pen_id}: {dev_res}")
                        except Exception as dev_err:
                            logger.warning(f"Watcher could not activate {dev_name} at {pen_id}: {dev_err}")

                    create_system_alert(alert_type="ENV_ANOMALY", message=eval_msg, pen_id=pen_id)

            # Run farm-wide proactive sweep every 8 cycles (~2 minutes)
            if cycle_count % 8 == 0:
                await _run_proactive_farm_sweep()
                has_new_update = True
            cycle_count += 1

            # Write to `farm_newsfeed_state` & push updated live newsfeed to all clients
            if has_new_update:
                try:
                    state = sync_newsfeed_to_store(limit=12)
                    await ws_manager.broadcast(
                        event="newsfeed_update",
                        data=state,
                    )
                except Exception as nf_err:
                    logger.debug(f"Could not sync/broadcast newsfeed_update: {nf_err}")

        except Exception as e:
            logger.error("Error in Watcher loop: %s", str(e))

        await asyncio.sleep(interval_seconds)


def start_env_watcher(interval_seconds: int = 15):
    """Start the Watcher background task."""
    global _watcher_task, _is_running
    if not _is_running:
        _is_running = True
        loop = asyncio.get_event_loop()
        _watcher_task = loop.create_task(env_watcher_loop(interval_seconds))
        logger.info("Env Watcher background service initiated.")


def stop_env_watcher():
    """Stop the Watcher background task."""
    global _watcher_task, _is_running
    if _is_running:
        _is_running = False
        if _watcher_task and not _watcher_task.done():
            _watcher_task.cancel()
        logger.info("Env Watcher background service stopped.")
