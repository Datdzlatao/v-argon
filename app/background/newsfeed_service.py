import logging
from datetime import date, datetime, timezone
from typing import Any, Optional

from app.db.repositories.alerts import AlertsRepository
from app.db.repositories.animals import AnimalsRepository
from app.db.repositories.crops import CropsRepository
from app.db.repositories.devices import DevicesRepository
from app.db.repositories.inventory import InventoryRepository
from app.db.repositories.newsfeed import NewsfeedRepository
from app.db.repositories.pens import PensRepository
from app.db.repositories.schedules import SchedulesRepository

logger = logging.getLogger("smart_manager.newsfeed")


def build_live_newsfeed(
    pen_id: Optional[str] = None,
    limit: int = 12,
    user_id: Optional[str] = None,
) -> list[dict[str, Any]]:
    """
    Build a unified, prioritized live News Feed from all farm observers:
    - Recent alerts (environment anomalies, smell, temp, health)
    - Low-stock inventory items
    - Animals needing medical attention
    - Crops approaching harvest
    - Today's pending schedules
    Strictly scoped to pens & inventory owned by `user_id` when provided.
    """
    items: list[dict[str, Any]] = []
    now_iso = datetime.now(timezone.utc).isoformat()
    clean_pen = pen_id.strip() if pen_id and pen_id.strip() and pen_id != "all" else None
    clean_uid = user_id.strip() if user_id and user_id.strip() else None

    pen_name_map: dict[str, str] = {}
    allowed_pen_ids: Optional[set[str]] = None
    try:
        user_pens = PensRepository().list_all(user_id=clean_uid)
        if clean_uid is not None:
            allowed_pen_ids = set()
        for p in user_pens:
            pid = str(p.get("id") or "").strip()
            if pid:
                pen_name_map[pid] = str(p.get("name") or pid).strip()
                if allowed_pen_ids is not None:
                    allowed_pen_ids.add(pid)
    except Exception:
        if clean_uid is not None:
            allowed_pen_ids = set()

    def _zone_name(pid: str) -> str:
        return pen_name_map.get(pid, pid)

    def _pen_allowed(pid: str) -> bool:
        if clean_pen and pid != clean_pen:
            return False
        if allowed_pen_ids is not None and pid not in allowed_pen_ids:
            return False
        return True

    # 1. Recent Alerts
    try:
        all_devices = DevicesRepository().list_all()
        active_dev_by_pen: dict[str, list[str]] = {}
        for d in all_devices:
            if d.get("is_active"):
                p_id = str(d.get("pen_id") or "123")
                active_dev_by_pen.setdefault(p_id, []).append(str(d.get("name") or "").lower())

        alerts = AlertsRepository().get_recent_alerts(limit=12)
        seen_alert_keys: set[tuple[str, str]] = set()
        for idx, a in enumerate(alerts):
            a_pen = str(a.get("pen_id") or "123")
            if not _pen_allowed(a_pen):
                continue
            a_type = str(a.get("alert_type") or "ALERT").upper()
            dedup_key = (a_type, a_pen)
            if dedup_key in seen_alert_keys:
                continue
            seen_alert_keys.add(dedup_key)

            raw_msg = str(a.get("message") or "Cảnh báo hệ thống")
            msg = raw_msg.strip()
            low_msg = msg.lower()
            pen_active_devs = active_dev_by_pen.get(a_pen, [])

            quick_api = None
            action_label = "Hỏi Trợ lý AI"
            action_route = "chat"
            is_resolved = False

            if "quạt" in low_msg or "nóng" in low_msg or "mùi" in low_msg or "amoniac" in low_msg:
                if any("quạt" in dn or "fan" in dn for dn in pen_active_devs):
                    is_resolved = True
                    action_label = "Quạt đang bật"
                    action_route = "devices"
                else:
                    action_label = "Bật quạt ngay"
                    action_route = "devices"
                    quick_api = {
                        "method": "POST",
                        "endpoint": "/api/devices/control",
                        "body": {"device_type": "quạt", "state": True, "pen_id": a_pen},
                    }
            elif "lạnh" in low_msg or "đèn sưởi" in low_msg:
                if any("sưởi" in dn or "đèn" in dn for dn in pen_active_devs):
                    is_resolved = True
                    action_label = "Đèn sưởi đang bật"
                    action_route = "devices"
                else:
                    action_label = "Bật đèn sưởi"
                    action_route = "devices"
                    quick_api = {
                        "method": "POST",
                        "endpoint": "/api/devices/control",
                        "body": {"device_type": "đèn sưởi", "state": True, "pen_id": a_pen},
                    }
            elif "khô" in low_msg or "phun sương" in low_msg:
                if any("sương" in dn or "mist" in dn for dn in pen_active_devs):
                    is_resolved = True
                    action_label = "Phun sương đang bật"
                    action_route = "devices"
                else:
                    action_label = "Bật phun sương"
                    action_route = "devices"
                    quick_api = {
                        "method": "POST",
                        "endpoint": "/api/devices/control",
                        "body": {"device_type": "phun sương", "state": True, "pen_id": a_pen},
                    }
            elif "LOW_STOCK" in a_type:
                action_label = "Mở Kho vật tư"
                action_route = "inventory"
            elif "HEALTH" in a_type:
                action_label = "Kiểm tra vật nuôi"
                action_route = "livestock"
            elif "HARVEST" in a_type:
                action_label = "Xem cây trồng"
                action_route = "crops"

            severity = (
                "info"
                if "SYSTEM" in a_type
                else ("critical" if "ENV" in a_type or "HEALTH" in a_type else "warning")
            )
            items.append({
                "id": f"alert-{a.get('id', idx)}",
                "title": _zone_name(a_pen),
                "summary": msg,
                "category": "env_anomaly" if "ENV" in a_type else a_type.lower(),
                "severity": severity,
                "pen_id": a_pen,
                "target_type": "pen",
                "target_id": a_pen,
                "timestamp": a.get("created_at") or now_iso,
                "action_label": action_label,
                "action_route": action_route,
                "is_resolved": is_resolved,
                "quick_api": quick_api,
            })
    except Exception as e:
        logger.debug(f"Newsfeed alerts error: {e}")

    # 2. Low-stock inventory
    try:
        low_stocks = InventoryRepository().get_low_stock(user_id=clean_uid)
        default_user_pen = next(iter(allowed_pen_ids), "123") if allowed_pen_ids else "123"
        stock_pen = clean_pen or default_user_pen
        for item in low_stocks:
            items.append({
                "id": f"stock-{item.get('id', item.get('name'))}",
                "title": _zone_name(stock_pen),
                "summary": f"**{item.get('name')}** sắp hết: còn {item.get('quantity')} {item.get('unit')} (ngưỡng an toàn: {item.get('min_threshold')} {item.get('unit')}).",
                "category": "low_stock",
                "severity": "warning",
                "pen_id": stock_pen,
                "target_type": "inventory",
                "target_id": str(item.get("name") or ""),
                "timestamp": now_iso,
                "action_label": "Nhập kho ngay",
                "action_route": "inventory",
                "quick_api": None,
            })
    except Exception as e:
        logger.debug(f"Newsfeed inventory error: {e}")

    # 3. Sick animals
    try:
        sick = AnimalsRepository().get_sick_or_attention_animals()
        for a in sick:
            a_pen = str(a.get("pen_id") or "123")
            if not _pen_allowed(a_pen):
                continue
            items.append({
                "id": f"animal-{a.get('id')}",
                "title": _zone_name(a_pen),
                "summary": f"Vật nuôi **{a.get('id')} ({a.get('species')})**: trạng thái {a.get('status')}, ăn uống: {a.get('feeding_status', 'Chưa rõ')}.",
                "category": "health_alert",
                "severity": "critical",
                "pen_id": a_pen,
                "target_type": "animal",
                "target_id": str(a.get("id") or ""),
                "timestamp": now_iso,
                "action_label": "Mở hồ sơ thú y",
                "action_route": "livestock",
                "quick_api": None,
            })
    except Exception as e:
        logger.debug(f"Newsfeed animals error: {e}")

    # 4. Upcoming harvests
    try:
        harvests = CropsRepository().get_upcoming_harvests(within_days=5)
        for c in harvests:
            c_pen = str(c.get("pen_id") or "Vườn01")
            if not _pen_allowed(c_pen):
                continue
            items.append({
                "id": f"crop-{c.get('id')}",
                "title": _zone_name(c_pen),
                "summary": f"Cây trồng **{c.get('name')}** dự kiến thu hoạch sau {c.get('days_remaining')} ngày.",
                "category": "harvest",
                "severity": "info",
                "pen_id": c_pen,
                "target_type": "crop",
                "target_id": str(c.get("id") or ""),
                "timestamp": now_iso,
                "action_label": "Xem vụ mùa",
                "action_route": "crops",
                "quick_api": None,
            })
    except Exception as e:
        logger.debug(f"Newsfeed crops error: {e}")

    # 5. Today's pending schedules
    try:
        today_str = date.today().isoformat()
        tasks = SchedulesRepository().get_pending_schedules(target_date=today_str)
        for t in tasks[:3]:
            t_pen = str(t.get("pen_id") or "123")
            if not _pen_allowed(t_pen):
                continue
            note_part = f" — {t.get('note')}" if t.get("note") else ""
            items.append({
                "id": f"task-{t.get('id', t.get('task_name'))}",
                "title": _zone_name(t_pen),
                "summary": f"**{t.get('task_name')}**{note_part}",
                "category": "schedule",
                "severity": "info",
                "pen_id": t_pen,
                "target_type": "pen",
                "target_id": t_pen,
                "timestamp": now_iso,
                "action_label": "Hỏi AI chi tiết",
                "action_route": "chat",
                "quick_api": None,
            })
    except Exception as e:
        logger.debug(f"Newsfeed schedules error: {e}")

    severity_rank = {"critical": 0, "warning": 1, "info": 2}
    items.sort(key=lambda x: severity_rank.get(x.get("severity", "info"), 2))
    return items[:limit]


def build_text_summary(
    items: list[dict[str, Any]],
    pending_tasks_count: int,
    low_stock_count: int,
    sick_animals_count: int,
) -> str:
    """Generate a concise, human-readable Vietnamese text summary for the Smart Farm Assistant."""
    critical_items = [i for i in items if i.get("severity") == "critical"]
    warning_items = [i for i in items if i.get("severity") == "warning"]

    parts = [
        f"Tổng quan trang trại: {pending_tasks_count} việc cần làm hôm nay, {low_stock_count} vật tư sắp hết, {sick_animals_count} cá thể cần theo dõi."
    ]
    if critical_items:
        top = critical_items[0]
        parts.append(f"Ưu tiên khẩn cấp: {top.get('title')} — {top.get('summary')}")
    elif warning_items:
        top = warning_items[0]
        parts.append(f"Lưu ý cần xử lý: {top.get('title')} — {top.get('summary')}")
    else:
        parts.append("Môi trường và các phân khu đang vận hành ổn định.")

    return "\n".join(parts)


def sync_newsfeed_to_store(
    briefing_text: Optional[str] = None,
    limit: int = 12,
    user_id: Optional[str] = None,
) -> dict[str, Any]:
    """
    Compute the live farm newsfeed + text summary and persist it to `farm_newsfeed_state`
    (Supabase table with SQLite fallback) scoped per user_id when provided.
    """
    clean_uid = user_id.strip() if user_id and user_id.strip() else None
    state_id = f"user:{clean_uid}" if clean_uid else "global"
    repo = NewsfeedRepository()
    existing = repo.get_state(state_id) or {}

    items = build_live_newsfeed(pen_id=None, limit=limit, user_id=clean_uid)

    allowed_pen_ids: Optional[set[str]] = None
    if clean_uid:
        try:
            allowed_pen_ids = {
                str(p.get("id") or "").strip()
                for p in PensRepository().list_all(user_id=clean_uid)
                if p.get("id")
            }
        except Exception:
            allowed_pen_ids = set()

    pending_tasks_count = 0
    low_stock_count = 0
    sick_animals_count = 0
    try:
        tasks = SchedulesRepository().get_pending_schedules(target_date=date.today().isoformat())
        if allowed_pen_ids is not None:
            tasks = [t for t in tasks if str(t.get("pen_id") or "").strip() in allowed_pen_ids]
        pending_tasks_count = len(tasks)
    except Exception:
        pass
    try:
        low_stock_count = len(InventoryRepository().get_low_stock(user_id=clean_uid))
    except Exception:
        pass
    try:
        sick = AnimalsRepository().get_sick_or_attention_animals()
        if allowed_pen_ids is not None:
            sick = [a for a in sick if str(a.get("pen_id") or "").strip() in allowed_pen_ids]
        sick_animals_count = len(sick)
    except Exception:
        pass

    final_briefing = briefing_text if briefing_text is not None else existing.get("briefing_text")
    summary_text = build_text_summary(items, pending_tasks_count, low_stock_count, sick_animals_count)
    if final_briefing:
        clean_briefing = str(final_briefing).strip()
        summary_text = f"{clean_briefing}\n\n{summary_text}"

    return repo.upsert_state(
        {
            "summary_text": summary_text,
            "briefing_text": final_briefing,
            "items": items,
            "pending_tasks_count": pending_tasks_count,
            "low_stock_count": low_stock_count,
            "sick_animals_count": sick_animals_count,
        },
        state_id=state_id,
    )
