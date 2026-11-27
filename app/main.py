import asyncio
import base64
import hmac
import json
import logging
import time
import httpx
from contextlib import asynccontextmanager
from datetime import date
from typing import Any, Optional, Dict

from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect, HTTPException, Query, File, UploadFile, Form
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse, StreamingResponse

from app.config import get_settings
from app.db.supabase_client import test_supabase_connection
from app.db.repositories.env_logs import EnvLogsRepository
from app.db.repositories.inventory import InventoryRepository
from app.db.repositories.schedules import SchedulesRepository
from app.db.repositories.alerts import AlertsRepository
from app.db.repositories.pens import PensRepository
from app.db.repositories.devices import DevicesRepository
from app.db.repositories.animals import AnimalsRepository
from app.db.repositories.crops import CropsRepository
from app.db.repositories.feed_logs import FeedLogsRepository
from app.db.repositories.chat_history import ChatHistoryRepository
from app.db.repositories.staff import StaffRepository
from app.db.repositories.office import OfficeRepository
from app.services.face_service import face_service
from app.models.schemas import (
    AgentChatRequest,
    AgentChatResponse,
    EnvLogCreate,
    DeviceControlRequest,
    AnimalBase,
    AnimalCreate,
    AnimalHealthUpdate,
    AnimalTransferRequest,
    CropBase,
    CropCreate,
    CropQuantityUpdate,
    CropGrowthCreate,
    CropCareCreate,
    FeedLogCreate,
    PenCreate,
    PenUpdate,
    DiagnosisBase64Request,
    DiagnosisResponse,
    KnowledgeSearchRequest,
    KnowledgeSearchResponse,
    StaffCreate,
    StaffCheckInRequest,
    UniformInspectRequest,
    StaffLiveScanRequest,
)
from app.services.agent_service import agent_service
from app.api.websocket_manager import ws_manager
from app.background.watcher import start_env_watcher, stop_env_watcher
from app.background.scheduler import (
    start_scheduler,
    stop_scheduler,
    trigger_daily_briefing,
    trigger_end_of_day_office_summary,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("smart_manager.main")

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application Lifespan:
    - Starts Watcher background task (monitoring env logs & smell across pens)
    - Starts APScheduler (morning farm briefing 07:00)
    - Gracefully stops background processes on shutdown
    """
    logger.info("Initializing Smart Farm Multi-Pen System...")

    start_env_watcher(interval_seconds=15)
    start_scheduler()

    yield

    logger.info("Shutting down background services...")
    stop_env_watcher()
    stop_scheduler()


app = FastAPI(
    title="Smart Farm Multi-Pen Management AI Agent",
    description="Hệ Thống Quản Lý Đa Chuồng Trại Nông Nghiệp Thông Minh Tích Hợp AI Agent Qua MCP (Model Context Protocol)",
    version="2.1.0",
    lifespan=lifespan,
)

# CORS Middleware (restricted origins, never '*' with allow_credentials=True)
_cors_origins = [o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials="*" not in _cors_origins,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

MAX_IMAGE_BYTES = settings.MAX_UPLOAD_MB * 1024 * 1024


@app.middleware("http")
async def security_and_auth_middleware(request: Request, call_next):
    # Optional Bearer / X-API-Key enforcement when API_AUTH_TOKEN is configured
    expected_token = settings.API_AUTH_TOKEN.strip()
    if expected_token and request.url.path.startswith("/api/"):
        auth_header = request.headers.get("Authorization", "")
        bearer_token = auth_header[7:].strip() if auth_header.startswith("Bearer ") else ""
        api_key_header = request.headers.get("X-API-Key", "").strip()
        provided = bearer_token or api_key_header
        if not provided or not hmac.compare_digest(provided, expected_token):
            return JSONResponse(status_code=401, content={"detail": "Thiếu hoặc sai mã xác thực API."})

    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=()"
    return response

# Repositories
env_repo = EnvLogsRepository()
inventory_repo = InventoryRepository()
schedules_repo = SchedulesRepository()
alerts_repo = AlertsRepository()
pens_repo = PensRepository()
devices_repo = DevicesRepository()
animals_repo = AnimalsRepository()
crops_repo = CropsRepository()
feed_repo = FeedLogsRepository()
chat_history_repo = ChatHistoryRepository()
staff_repo = StaffRepository()
office_repo = OfficeRepository()


# ====================================================================
# REST API ENDPOINTS
# ====================================================================

@app.get("/health", tags=["System"])
async def health_check():
    """System Health Check endpoint."""
    db_status = test_supabase_connection()
    return {
        "status": "online",
        "app_name": settings.APP_NAME,
        "environment": settings.APP_ENV,
        "database": db_status,
        "ai_model": {
            "configured": settings.is_gemini_configured,
            "model": settings.GEMINI_MODEL,
        },
        "active_websocket_clients": ws_manager.total_connections,
    }


@app.get("/api/farm/overview", tags=["Farm"])
async def farm_overview(user_id: Optional[str] = Query(None, description="Lọc tổng quan theo ID người dùng")):
    """Get high-level farm overview (pens, devices, animals, crops), scoped to user_id when provided."""
    try:
        pens = pens_repo.list_all(user_id=user_id)
        allowed_pen_ids = {str(p.get("id") or "").strip() for p in pens}
        devs = devices_repo.list_all()
        animals = animals_repo.list_all()
        crops = crops_repo.list_all()
        sick = animals_repo.get_sick_or_attention_animals()
        if user_id:
            devs = [d for d in devs if str(d.get("pen_id") or "").strip() in allowed_pen_ids]
            animals = [a for a in animals if str(a.get("pen_id") or "").strip() in allowed_pen_ids]
            crops = [c for c in crops if str(c.get("pen_id") or "").strip() in allowed_pen_ids]
            sick = [s for s in sick if str(s.get("pen_id") or "").strip() in allowed_pen_ids]
        return {
            "pens_count": len(pens),
            "devices_count": len(devs),
            "devices_active": len([d for d in devs if d.get("is_active")]),
            "animals_count": len(animals),
            "sick_animals_count": len(sick),
            "crops_count": len(crops),
            "pens": pens,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/pens", tags=["Pens"])
async def get_pens(user_id: Optional[str] = Query(None, description="Lọc danh sách chuồng theo ID người dùng")):
    """List all pens/zones, optionally isolated by user_id."""
    return pens_repo.list_all(user_id=user_id)


@app.post("/api/pens", tags=["Pens"])
async def create_pen(payload: PenCreate):
    """Create a new pen/zone assigned to a user."""
    try:
        created = pens_repo.create_pen(
            pen_id=payload.id,
            name=payload.name or f"Chuồng {payload.id}",
            pen_type=payload.type or "livestock",
            user_id=payload.user_id,
            camera_url=payload.camera_url,
            webcam_url=payload.webcam_url,
        )
        await ws_manager.broadcast("pen_update", {"action": "create", "pen": created})
        return {"status": "success", "pen": created}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.patch("/api/pens/{pen_id}", tags=["Pens"])
async def update_pen_metadata(pen_id: str, payload: PenUpdate):
    """Cập nhật thông tin chuồng/vườn (bao gồm địa chỉ IP Camera tùy chỉnh)."""
    try:
        updates = {k: v for k, v in payload.model_dump().items() if v is not None}
        if not updates:
            raise HTTPException(status_code=400, detail="Không có thông tin cần cập nhật")
        updated = pens_repo.update_pen(pen_id, updates)
        if not updated:
            raise HTTPException(status_code=404, detail=f"Không tìm thấy chuồng {pen_id}")
        await ws_manager.broadcast("pen_update", {"action": "update", "pen": updated})
        return {"status": "success", "pen": updated}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@app.get("/api/pens/{pen_id}/details", tags=["Pens"])
async def get_pen_details(pen_id: str, user_id: Optional[str] = Query(None)):
    """
    Get all information for a specific pen:
    - Pen metadata
    - Current animals inside
    - Devices configured
    - Latest sensor telemetry
    """
    pen = pens_repo.get_by_id(pen_id, user_id=user_id)
    if not pen:
        raise HTTPException(status_code=404, detail=f"Không tìm thấy chuồng {pen_id}")

    animals = animals_repo.list_by_pen(pen_id)
    devices = devices_repo.list_by_pen(pen_id)
    telemetry = env_repo.get_latest_logs(limit=1, pen_id=pen_id)

    return {
        "pen": pen,
        "animals": animals,
        "animals_count": len(animals),
        "devices": devices,
        "devices_count": len(devices),
        "latest_telemetry": telemetry[0] if telemetry else None,
    }


@app.get("/api/devices", tags=["IoT Devices"])
async def get_devices(pen_id: Optional[str] = None):
    """List IoT devices, optionally filtered by pen_id."""
    if pen_id:
        return devices_repo.list_by_pen(pen_id)
    return devices_repo.list_all()


@app.post("/api/devices/control", tags=["IoT Devices"])
async def control_device_api(payload: DeviceControlRequest):
    """Turn a device on/off or toggle."""
    try:
        is_active = True if payload.action in ["turn_on", "toggle"] else False
        updated = devices_repo.set_device_state(
            device_id=payload.device_id,
            pen_id=payload.pen_id,
            device_name=payload.device_name,
            is_active=is_active,
        )
        await ws_manager.broadcast("device_update", updated)
        await _broadcast_newsfeed_update()
        return {"status": "success", "device": updated}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/animals", tags=["Animals"])
async def get_animals(pen_id: Optional[str] = None):
    """List animals in farm, optionally filtered by pen_id."""
    if pen_id:
        return animals_repo.list_by_pen(pen_id)
    return animals_repo.list_all()


@app.post("/api/animals/health", tags=["Animals"])
async def update_health_api(payload: AnimalHealthUpdate):
    """Update health status for an animal."""
    try:
        result = animals_repo.update_health_status(
            animal_id=payload.animal_id,
            status=payload.status,
            note=payload.note,
            health_type=payload.type or "Disease",
        )
        await ws_manager.broadcast("animal_update", result)
        await _broadcast_newsfeed_update()
        return {"status": "success", "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/animals/transfer", tags=["Animals"])
async def transfer_animal_api(payload: AnimalTransferRequest):
    """
    Chuyển đổi cá thể vật nuôi từ chuồng này sang chuồng khác.
    """
    try:
        # Auto register target pen if missing
        pen = pens_repo.get_by_id(payload.target_pen_id)
        if not pen:
            pens_repo.create_pen(pen_id=payload.target_pen_id, name=f"Chuồng {payload.target_pen_id}")

        result = animals_repo.transfer_pen(
            animal_id=payload.animal_id,
            target_pen_id=payload.target_pen_id,
            reason=payload.reason or "",
        )
        await ws_manager.broadcast("animal_transfer", result)
        return {"status": "success", "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/animals", tags=["Animals"])
async def add_animal_api(payload: AnimalCreate):
    """Add a new animal to the farm."""
    try:
        created = animals_repo.add_animal(
            animal_id=payload.id,
            species=payload.species or "Heo",
            pen_id=payload.pen_id or "123",
            weight=payload.weight or 0.0,
            target_weight=payload.target_weight or 100.0,
            feeding_status=payload.feeding_status or "Normal",
            status=payload.status or "Khoe",
        )
        await ws_manager.broadcast("animal_update", {"action": "create", "animal": created})
        return {"status": "success", "data": created}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/crops", tags=["Crops"])
async def get_crops():
    """List all crops."""
    return crops_repo.list_all()


@app.post("/api/crops", tags=["Crops"])
async def create_crop_api(payload: CropCreate):
    """Plant a new crop."""
    try:
        created = crops_repo.create_crop(
            name=payload.name,
            quantity=payload.quantity or 1,
            pen_id=payload.pen_id or "PEN-B01",
            plant_date=payload.plant_date.isoformat() if payload.plant_date else None,
            harvest_date=payload.harvest_date.isoformat() if payload.harvest_date else None,
            status=payload.status or "Growing",
        )
        await ws_manager.broadcast("crop_update", {"action": "create", "crop": created})
        return {"status": "success", "data": created}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.patch("/api/crops/{crop_id}/quantity", tags=["Crops"])
async def update_crop_quantity_api(crop_id: int, payload: CropQuantityUpdate):
    """Update or adjust crop quantity."""
    try:
        mode = "adjust" if (payload.action or "").lower() in ["add", "increase", "reduce", "decrease"] else "set"
        delta_qty = -abs(payload.quantity) if (payload.action or "").lower() in ["reduce", "decrease"] else payload.quantity
        updated = crops_repo.update_quantity(crop_id=crop_id, quantity=delta_qty, mode=mode)
        await ws_manager.broadcast("crop_update", {"action": "update_quantity", "crop": updated})
        return {"status": "success", "data": updated}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/crops/{crop_id}/growth", tags=["Crops"])
async def log_crop_growth_api(crop_id: int, payload: CropGrowthCreate):
    """Log crop growth size/height."""
    try:
        log_entry = crops_repo.log_growth(crop_id=crop_id, size=payload.size, note=payload.note or "")
        await ws_manager.broadcast("crop_growth_logs", log_entry)
        return {"status": "success", "data": log_entry}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/crops/{crop_id}/care", tags=["Crops"])
async def log_crop_care_api(crop_id: int, payload: CropCareCreate):
    """Log crop care activity."""
    try:
        care_entry = crops_repo.log_care(crop_id=crop_id, care_type=payload.type, note=payload.note or "")
        await ws_manager.broadcast("crop_care_logs", care_entry)
        return {"status": "success", "data": care_entry}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/feed/log", tags=["Feed"])
async def log_feed_api(payload: FeedLogCreate):
    """Record feeding in pen and deduct from inventory."""
    try:
        updated_stock = inventory_repo.adjust_quantity(
            item_name=payload.food_name,
            delta_quantity=-abs(payload.amount),
            pen_id=payload.pen_id,
            note=f"Xuất cho chuồng {payload.pen_id} ăn",
        )
        feed_log = feed_repo.log_feeding(
            pen_id=payload.pen_id,
            food_name=payload.food_name,
            amount=payload.amount,
        )
        await ws_manager.broadcast("feed_update", {"feed_log": feed_log, "inventory": updated_stock})
        return {"status": "success", "feed_log": feed_log, "stock_remaining": updated_stock.get("quantity")}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/env/latest", tags=["Environment"])
async def get_latest_env(limit: int = Query(default=10, ge=1, le=50), pen_id: Optional[str] = None):
    """Fetch the latest environmental sensor records."""
    try:
        return env_repo.get_latest_logs(limit=limit, pen_id=pen_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/env/log", tags=["Environment"])
async def record_env_log(payload: EnvLogCreate):
    """
    Simulate IoT sensor pushing temperature, humidity, and smell level.
    Broadcasts to WebSocket and triggers The Watcher.
    """
    try:
        saved = env_repo.insert_log(
            temperature=payload.temperature,
            humidity=payload.humidity,
            smell_level=payload.smell_level,
            pen_id=payload.pen_id or "123",
        )
        await ws_manager.broadcast("env_update", saved)
        return {"status": "success", "data": saved}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/inventory", tags=["Inventory"])
async def get_inventory(user_id: Optional[str] = Query(None)):
    """List inventory items, scoped by user_id when provided."""
    try:
        return inventory_repo.list_all(user_id=user_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/inventory/low-stock", tags=["Inventory"])
async def get_low_stock(user_id: Optional[str] = Query(None)):
    """Get inventory items at or below minimum threshold, scoped by user_id."""
    try:
        return inventory_repo.get_low_stock(user_id=user_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/inventory/logs", tags=["Inventory"])
async def get_inventory_logs(
    limit: int = 100,
    action_type: Optional[str] = None,
    user_id: Optional[str] = Query(None),
):
    """List warehouse import/export and barn export logs, scoped by user_id."""
    try:
        return inventory_repo.list_logs(limit=limit, action_type=action_type, user_id=user_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/schedules", tags=["Schedules"])
async def get_schedules():
    """List pending and upcoming schedules."""
    try:
        return schedules_repo.list_all()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/alerts", tags=["Alerts"])
async def get_alerts(limit: int = Query(default=20, ge=1, le=100)):
    """Fetch recent system alerts."""
    try:
        return alerts_repo.get_recent_alerts(limit=limit)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/newsfeed", tags=["Newsfeed & Observer"])
async def get_live_newsfeed(
    pen_id: Optional[str] = Query(default=None, description="Lọc theo mã chuồng"),
    limit: int = Query(default=12, ge=1, le=30),
    user_id: Optional[str] = Query(default=None, description="Lọc bản tin theo ID người dùng"),
):
    """
    Live Observer News Feed Endpoint:
    Reads the synchronized `farm_newsfeed_state` (summary_text, briefing_text, counts, items)
    scoped per user_id when provided.
    """
    try:
        from app.db.repositories.newsfeed import NewsfeedRepository
        from app.background.newsfeed_service import sync_newsfeed_to_store

        clean_uid = user_id.strip() if user_id and user_id.strip() else None
        state_id = f"user:{clean_uid}" if clean_uid else "global"
        if clean_uid:
            state = sync_newsfeed_to_store(limit=limit, user_id=clean_uid)
        else:
            state = NewsfeedRepository().get_state(state_id)
            if not state:
                state = sync_newsfeed_to_store(limit=limit)

        items = state.get("items") or []
        if pen_id and pen_id != "all":
            items = [i for i in items if str(i.get("pen_id") or "") == str(pen_id)]
        items = items[:limit]

        return {
            "status": "success",
            "id": state.get("id", "global"),
            "summary_text": state.get("summary_text", ""),
            "briefing_text": state.get("briefing_text"),
            "pending_tasks_count": state.get("pending_tasks_count", 0),
            "low_stock_count": state.get("low_stock_count", 0),
            "sick_animals_count": state.get("sick_animals_count", 0),
            "updated_at": state.get("updated_at"),
            "count": len(items),
            "items": items,
        }
    except Exception as e:
        logger.error(f"Newsfeed API error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/newsfeed/refresh", tags=["Newsfeed & Observer"])
async def refresh_live_newsfeed():
    """Force recompute and persist `farm_newsfeed_state`."""
    try:
        from app.background.newsfeed_service import sync_newsfeed_to_store
        state = sync_newsfeed_to_store(limit=12)
        await ws_manager.broadcast("newsfeed_update", state)
        return {"status": "success", **state, "count": len(state.get("items") or [])}
    except Exception as e:
        logger.error(f"Newsfeed refresh error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


async def _broadcast_newsfeed_update():
    try:
        from app.background.newsfeed_service import sync_newsfeed_to_store
        state = sync_newsfeed_to_store(limit=12)
        await ws_manager.broadcast("newsfeed_update", state)
    except Exception as nf_err:
        logger.debug(f"Could not sync/broadcast newsfeed_update: {nf_err}")


async def _save_and_broadcast_chat(
    user_id: str,
    pen_id: Optional[str],
    sender: str,
    content: str,
    tool_calls: Optional[list[dict[str, Any]]] = None,
) -> dict[str, Any]:
    saved = chat_history_repo.save_message(
        user_id=user_id,
        sender=sender,
        content=content,
        pen_id=pen_id,
        tool_calls=tool_calls,
    )
    try:
        await ws_manager.broadcast(event="chat_message", data=saved)
    except Exception as ws_err:
        logger.warning(f"Failed to broadcast chat_message: {ws_err}")
    return saved


@app.post("/api/chat", response_model=AgentChatResponse, tags=["AI Agent"])
async def chat_with_agent(payload: AgentChatRequest):
    """
    Send instruction or question to the Smart Farm AI Agent (MCP Host).
    Saves message and agent response to persistent chat history per user and pen.
    """
    try:
        user_id = payload.user_id or "guest"
        pen_id = payload.pen_id

        # 1. Fetch recent history for conversational context
        history = chat_history_repo.get_history(user_id=user_id, pen_id=pen_id, limit=10)

        # 2. Save user message & broadcast
        await _save_and_broadcast_chat(
            user_id=user_id,
            pen_id=pen_id,
            sender="user",
            content=payload.message,
        )

        # 3. Call AI Agent with strict user_id + pen_id scope
        result = await agent_service.chat(
            payload.message,
            history=history,
            user_id=user_id,
            pen_id=pen_id,
        )

        # 4. Save agent reply & broadcast
        await _save_and_broadcast_chat(
            user_id=user_id,
            pen_id=pen_id,
            sender="agent",
            content=result["reply"],
            tool_calls=result.get("tool_calls", []),
        )

        return AgentChatResponse(
            reply=result["reply"],
            tool_calls=result.get("tool_calls", []),
        )
    except Exception as e:
        logger.error(f"Chat API error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/chat/stream", tags=["AI Agent"])
async def chat_with_agent_stream(payload: AgentChatRequest):
    """
    Streaming SSE Chat endpoint with AI Agent (Gemini Streaming + Live MCP Context).
    Emits JSON SSE lines: {"type": "status"|"chunk"|"done", ...}
    """
    user_id = payload.user_id or "guest"
    pen_id = payload.pen_id
    history = chat_history_repo.get_history(user_id=user_id, pen_id=pen_id, limit=10)

    await _save_and_broadcast_chat(
        user_id=user_id,
        pen_id=pen_id,
        sender="user",
        content=payload.message,
    )

    async def event_generator():
        final_reply = ""
        final_tools = []
        try:
            async for event in agent_service.chat_stream(
                payload.message,
                history=history,
                user_id=user_id,
                pen_id=pen_id,
            ):
                if event.get("type") == "done":
                    final_reply = event.get("reply", "")
                    final_tools = event.get("tool_calls", [])
                yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"
        except Exception as e:
            logger.error(f"Chat stream error: {e}")
            yield f"data: {json.dumps({'type': 'error', 'detail': str(e)}, ensure_ascii=False)}\n\n"
        finally:
            if final_reply:
                try:
                    await _save_and_broadcast_chat(
                        user_id=user_id,
                        pen_id=pen_id,
                        sender="agent",
                        content=final_reply,
                        tool_calls=final_tools,
                    )
                except Exception as save_err:
                    logger.warning(f"Could not save streamed agent reply: {save_err}")

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/api/chat/history", tags=["AI Agent"])
async def get_chat_history_api(
    user_id: str = Query(..., description="ID người dùng"),
    pen_id: Optional[str] = Query(None, description="Mã chuồng"),
    limit: int = Query(50, ge=1, le=200),
):
    """Retrieve chat history for a specific user and optional pen."""
    try:
        messages = chat_history_repo.get_history(user_id=user_id, pen_id=pen_id, limit=limit)
        return {"status": "success", "messages": messages}
    except Exception as e:
        logger.error(f"Error fetching chat history: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/scheduler/trigger-briefing", tags=["Scheduler"])
async def trigger_briefing():
    """Manually trigger the farm morning briefing job."""
    try:
        result = await trigger_daily_briefing()
        return {"status": "success", "briefing": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ====================================================================
# V-ARGON OFFICE — END-OF-DAY SUMMARY AGENT & TABLE MANAGEMENT
# ====================================================================

class OfficeSummarizeRequest(BaseModel):
    target_date: Optional[str] = None
    user_id: Optional[str] = None


class OfficeRecordCreate(BaseModel):
    user_id: Optional[str] = None
    report_date: Optional[str] = None
    hour_slot: Optional[str] = None
    category: str = "thu_chi"
    code: str = ""
    item: str
    quantity_or_amount: float = 0.0
    unit: str = ""
    status: str = "Ghi nhận thủ công"
    note: str = ""
    timestampt: Optional[str] = None


class OfficeRecordUpdate(BaseModel):
    code: Optional[str] = None
    item: Optional[str] = None
    category: Optional[str] = None
    quantity_or_amount: Optional[float] = None
    unit: Optional[str] = None
    status: Optional[str] = None
    note: Optional[str] = None
    hour_slot: Optional[str] = None


@app.get("/api/office/records", tags=["V-Argon Office"])
async def get_office_records(
    report_date: Optional[str] = Query(default=None, description="Lọc theo ngày YYYY-MM-DD"),
    category: Optional[str] = Query(default=None, description="Lọc theo phân loại (thu_chi, xuat_nhap_kho, xuat_chuong, thu_hoach, tong_ket)"),
    user_id: Optional[str] = Query(default=None),
    limit: int = Query(default=200, ge=1, le=500),
):
    """Lấy danh sách bản ghi bảng `office` (tổng hợp cuối ngày theo giờ trong cột `timestampt`)."""
    try:
        rows = office_repo.list_records(
            report_date=report_date,
            category=category,
            user_id=user_id,
            limit=limit,
        )
        return {
            "status": "success",
            "storage_mode": office_repo.storage_mode,
            "count": len(rows),
            "records": rows,
        }
    except Exception as e:
        logger.error(f"Office list error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/office/summarize", tags=["V-Argon Office"])
async def trigger_office_summary(payload: Optional[OfficeSummarizeRequest] = None):
    """Kích hoạt Agent tổng hợp cuối ngày (Thu chi, Xuất nhập kho, Xuất chuồng, Thu hoạch) và ghi vào bảng `office`."""
    try:
        target_date = payload.target_date if payload else None
        user_id = payload.user_id if payload else None
        result = await trigger_end_of_day_office_summary(target_date=target_date, user_id=user_id)
        return result
    except Exception as e:
        logger.error(f"Office summarize error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/office/records", tags=["V-Argon Office"])
async def create_office_record(payload: OfficeRecordCreate):
    """Thêm bản ghi thủ công vào bảng `office`."""
    try:
        data = payload.model_dump()
        data["source_table"] = "manual"
        created = office_repo.create_record(data)
        return {"status": "success", "storage_mode": office_repo.storage_mode, "record": created}
    except Exception as e:
        logger.error(f"Office create error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.patch("/api/office/records/{record_id}", tags=["V-Argon Office"])
async def update_office_record(record_id: int, payload: OfficeRecordUpdate):
    """Cập nhật bản ghi trong bảng `office`."""
    try:
        updated = office_repo.update_record(record_id, payload.model_dump(exclude_none=True))
        if not updated:
            raise HTTPException(status_code=404, detail="Không tìm thấy bản ghi office.")
        return {"status": "success", "storage_mode": office_repo.storage_mode, "record": updated}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Office update error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/office/records/{record_id}", tags=["V-Argon Office"])
async def delete_office_record(record_id: int):
    """Xóa bản ghi trong bảng `office`."""
    try:
        office_repo.delete_record(record_id)
        return {"status": "success", "storage_mode": office_repo.storage_mode}
    except Exception as e:
        logger.error(f"Office delete error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ====================================================================
# RAG AGRICULTURAL KNOWLEDGE & DISEASE DIAGNOSIS ENDPOINTS (STEM INTEGRATION)
# ====================================================================

@app.post("/api/diagnose", response_model=DiagnosisResponse, tags=["RAG & Diagnosis"])
async def diagnose_disease_api(
    user_query: Optional[str] = Form(None),
    image: Optional[UploadFile] = File(None),
):
    """
    RAG Agricultural Disease Diagnosis Endpoint (Migrated & Enhanced from stem/app/api/endpoints.py):
    - Accepts text symptoms and optional uploaded image (multimodal).
    - Queries Pinecone Vector Store & Agricultural Knowledge Base for verified veterinary/crop protocols.
    - Truncates & structures into clean JSON: category, species, disease_name, text, answer.
    """
    try:
        image_bytes = None
        content_type = "image/jpeg"
        if image:
            image_bytes = await image.read()
            if len(image_bytes) > MAX_IMAGE_BYTES:
                raise HTTPException(status_code=413, detail=f"Ảnh tải lên vượt quá giới hạn {settings.MAX_UPLOAD_MB}MB.")
            content_type = image.content_type if image.content_type else "image/jpeg"

        result = await agent_service.diagnose_multimodal(
            user_query=user_query,
            image_bytes=image_bytes,
            content_type=content_type,
        )

        return DiagnosisResponse(
            category=result.get("category"),
            species=result.get("species"),
            disease_name=result.get("disease_name"),
            text=result.get("text", user_query or "Chẩn đoán bệnh hình ảnh"),
            answer=result.get("answer", "Chưa có thông tin phác đồ điều trị."),
            sources=result.get("sources", []),
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Diagnosis API error: {e}")
        raise HTTPException(status_code=500, detail="Lỗi hệ thống khi chẩn đoán hình ảnh.")


def _decode_base64_image(image_base64: Optional[str], default_mime: str = "image/jpeg") -> tuple[Optional[bytes], str]:
    """Decode raw base64 or data URL into image bytes and MIME type with size limit."""
    if not image_base64 or not image_base64.strip():
        return None, default_mime

    raw = image_base64.strip()
    mime_type = default_mime or "image/jpeg"
    if raw.startswith("data:") and ";base64," in raw:
        header, b64_payload = raw.split(";base64,", 1)
        extracted_mime = header[5:].strip()
        if extracted_mime:
            mime_type = extracted_mime
        raw = b64_payload

    if len(raw) > int(MAX_IMAGE_BYTES * 1.4):
        raise HTTPException(status_code=413, detail=f"Ảnh Base64 vượt quá giới hạn {settings.MAX_UPLOAD_MB}MB.")

    try:
        decoded = base64.b64decode(raw, validate=True)
    except Exception:
        try:
            decoded = base64.b64decode(raw)
        except Exception:
            raise HTTPException(status_code=400, detail="Ảnh Base64 không hợp lệ.")

    if len(decoded) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail=f"Ảnh Base64 vượt quá giới hạn {settings.MAX_UPLOAD_MB}MB.")
    return decoded, mime_type


@app.post("/api/diagnose/base64", response_model=DiagnosisResponse, tags=["RAG & Diagnosis"])
async def diagnose_disease_base64_api(payload: DiagnosisBase64Request):
    """
    RAG Agricultural Disease Diagnosis Endpoint (JSON + Base64 Image):
    - Accepts user_query and base64-encoded image from Web, iOS PWA, and Android clients.
    - Passes decoded image bytes to Multimodal Gemini + Pinecone RAG Pipeline.
    - Persists both user image diagnosis request and RAG response into chat_history & broadcasts over WebSocket.
    """
    try:
        image_bytes, content_type = _decode_base64_image(
            payload.image_base64,
            payload.content_type or "image/jpeg",
        )
        result = await agent_service.diagnose_multimodal(
            user_query=payload.user_query,
            image_bytes=image_bytes,
            content_type=content_type,
        )
        diag_resp = DiagnosisResponse(
            category=result.get("category"),
            species=result.get("species"),
            disease_name=result.get("disease_name"),
            text=result.get("text", payload.user_query or "Chẩn đoán bệnh hình ảnh"),
            answer=result.get("answer", "Chưa có thông tin phác đồ điều trị."),
            sources=result.get("sources", []),
        )

        # Save into chat history & broadcast to sync across Web/iOS/Android
        user_id = payload.user_id or "guest"
        pen_id = payload.pen_id
        user_msg_text = f"📷 [Ảnh kiểm chứng RAG] {payload.user_query.strip()}" if payload.user_query and payload.user_query.strip() else "📷 [Ảnh kiểm chứng & phân tích RAG]"
        await _save_and_broadcast_chat(
            user_id=user_id,
            pen_id=pen_id,
            sender="user",
            content=user_msg_text,
        )
        formatted_reply = "\n".join(
            part for part in [
                f"🩺 Chẩn đoán: {diag_resp.disease_name}" if diag_resp.disease_name else None,
                f"🌿/🐖 Đối tượng: {diag_resp.species} ({'Cây trồng' if diag_resp.category == 'crop' else 'Vật nuôi'})" if diag_resp.species else None,
                f"🔍 Mô tả: {diag_resp.text}" if diag_resp.text else None,
                f"\n📋 Phác đồ RAG:\n{diag_resp.answer}",
                f"\n📚 Nguồn: {', '.join(diag_resp.sources)}" if diag_resp.sources else None,
            ] if part
        )
        await _save_and_broadcast_chat(
            user_id=user_id,
            pen_id=pen_id,
            sender="agent",
            content=formatted_reply,
            tool_calls=[{
                "tool": "diagnose_agricultural_disease",
                "args": {"content_type": content_type},
                "result": diag_resp.disease_name or "Đã phân tích ảnh qua RAG",
            }],
        )

        return diag_resp
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Diagnosis Base64 API error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/knowledge/search", response_model=KnowledgeSearchResponse, tags=["RAG & Diagnosis"])
async def search_knowledge_api(
    query: str = Query(..., description="Từ khóa hoặc triệu chứng tra cứu"),
    limit: int = Query(default=3, ge=1, le=10),
):
    """
    Search agricultural knowledge base (Pinecone Vector Store + Built-in Fallback).
    """
    try:
        from app.services.rag_service import rag_service
        context_str, docs = rag_service.retrieve_context(query, k=limit)
        return KnowledgeSearchResponse(
            query=query,
            count=len(docs),
            results=docs,
            formatted_context=context_str,
        )
    except Exception as e:
        logger.error(f"Knowledge search API error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ====================================================================
# STAFF MANAGEMENT & FACE ATTENDANCE ENDPOINTS (STANDALONE AI ENGINE)
# ====================================================================

@app.get("/api/staff", tags=["Staff & Face Attendance"])
async def list_staff_api(pen_id: Optional[str] = Query(None, description="Lọc theo mã chuồng")):
    """Danh sách toàn bộ nhân sự trang trại."""
    try:
        return staff_repo.list_all(pen_id=pen_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/staff", tags=["Staff & Face Attendance"])
async def create_staff_api(payload: StaffCreate):
    """Tạo mới hồ sơ nhân sự trang trại."""
    try:
        created = staff_repo.create_staff(
            staff_id=payload.id,
            name=payload.name,
            role=payload.role or "Kỹ thuật viên",
            pen_id=payload.pen_id or "123",
            phone=payload.phone,
        )
        await ws_manager.broadcast("staff_update", {"action": "create", "staff": created})
        return {"status": "success", "staff": created}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class StaffWageUpdate(BaseModel):
    daily_wage: float


@app.patch("/api/staff/{staff_id}/wage", tags=["Staff & Face Attendance"])
async def update_staff_wage_api(staff_id: str, payload: StaffWageUpdate):
    """Cập nhật mức tiền công ngày (`daily_wage`) cho nhân sự."""
    try:
        updated = staff_repo.update_staff_wage(staff_id=staff_id, daily_wage=payload.daily_wage)
        if not updated:
            raise HTTPException(status_code=404, detail="Không tìm thấy nhân sự.")
        return {"status": "success", "staff": updated}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/staff/attendance", tags=["Staff & Face Attendance"])
async def get_staff_attendance_api(pen_id: Optional[str] = Query(None, description="Lọc theo chuồng")):
    """Lấy danh sách điểm danh vào ca của nhân sự hôm nay."""
    try:
        return staff_repo.get_today_attendance(pen_id=pen_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/staff/vision-status", tags=["Staff & Face Attendance"])
async def get_vision_status_api():
    """Kiểm tra trạng thái kết nối tới Standalone AI Vision Engine."""
    return face_service.check_health()


@app.post("/api/staff/checkin", tags=["Staff & Face Attendance"])
async def checkin_staff_api(payload: StaffCheckInRequest):
    """
    Chấm công nhân sự linh hoạt 24/7 mọi lúc bằng khuôn mặt (FaceID qua Base64 hoặc staff_id).
    Hỗ trợ Vào ca (check_in), Tan ca (check_out), hoặc Chấm công tức thì (instant).
    Tự động kết nối Standalone AI Engine để trích xuất danh tính và chống giả mạo (liveness).
    """
    try:
        staff_id = payload.staff_id
        staff_name = "Nhân sự"
        confidence = 1.0
        is_real = True
        check_type = payload.check_type or "check_in"

        # Nếu có ảnh Base64, gửi tới AI Vision Engine để quét mặt
        if payload.image_base64:
            vision_result = face_service.analyze_face_base64(payload.image_base64)
            faces = vision_result.get("faces", [])
            if faces:
                best_face = faces[0]
                matched_id = best_face.get("student_id")
                if matched_id and matched_id != "UNKNOWN":
                    staff_id = matched_id
                    staff_name = best_face.get("student_name", staff_name)
                    confidence = float(best_face.get("confidence", 0.95))
                    liveness = best_face.get("liveness", {})
                    is_real = liveness.get("is_real", True)

        if not staff_id:
            raise HTTPException(status_code=400, detail="Không nhận diện được khuôn mặt nhân sự hoặc thiếu staff_id.")

        # Lấy thông tin nhân sự từ DB
        staff_info = staff_repo.get_by_id(staff_id)
        if staff_info:
            staff_name = staff_info.get("name", staff_name)

        action_label = "Vào ca" if check_type == "check_in" else ("Tan ca" if check_type == "check_out" else "Chấm công")
        note_text = payload.note or (f"Quét FaceID ({action_label})" if payload.image_base64 else f"Chấm công {action_label} mọi lúc")

        # Lưu bản ghi chấm công (24/7 không giới hạn khung giờ)
        record = staff_repo.log_attendance(
            staff_id=staff_id,
            staff_name=staff_name,
            pen_id=payload.pen_id or (staff_info.get("pen_id") if staff_info else "123"),
            status="present" if check_type != "check_out" else "completed",
            check_type=check_type,
            confidence=confidence,
            is_real=is_real,
            note=note_text,
        )

        await ws_manager.broadcast("staff_checkin", record)
        return {
            "status": "success",
            "message": f"Chấm công [{action_label}] thành công cho {staff_name} ({staff_id})",
            "check_type": check_type,
            "attendance": record,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error checking in staff: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/staff/checkin-upload", tags=["Staff & Face Attendance"])
async def checkin_upload_api(
    pen_id: str = Form("123"),
    check_type: str = Form("check_in"),
    file: UploadFile = File(...),
):
    """
    Chấm công nhân sự bằng ảnh chụp trực tiếp từ webcam/camera tải lên dạng file.
    Có thể thực hiện mọi lúc 24/7.
    """
    try:
        import base64
        contents = await file.read()
        b64_str = base64.b64encode(contents).decode("utf-8")
        action_label = "Vào ca" if check_type == "check_in" else ("Tan ca" if check_type == "check_out" else "Chấm công")
        req = StaffCheckInRequest(
            image_base64=b64_str, 
            pen_id=pen_id, 
            check_type=check_type,
            note=f"Chấm công qua ảnh tải lên ({action_label})"
        )
        return await checkin_staff_api(req)
    except Exception as e:
        logger.error(f"Checkin upload error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/staff/attendance/history", tags=["Staff & Face Attendance"])
async def get_staff_attendance_history_api(
    staff_id: Optional[str] = Query(None, description="Lọc theo mã nhân viên"),
    limit: int = Query(30, description="Số lượng bản ghi gần nhất")
):
    """Lấy toàn bộ lịch sử chấm công gần nhất (24/7 mọi lúc)."""
    try:
        return staff_repo.get_attendance_history(staff_id=staff_id, limit=limit)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/staff/enroll", tags=["Staff & Face Attendance"])
async def enroll_staff_face_api(
    staff_id: str = Form(...),
    staff_name: str = Form(...),
    pen_id: str = Form("123"),
    role: str = Form("Kỹ thuật viên"),
    file: Optional[UploadFile] = File(None),
    file_thang: Optional[UploadFile] = File(None),
    file_nghieng_trai: Optional[UploadFile] = File(None),
    file_nghieng_phai: Optional[UploadFile] = File(None),
):
    """
    Đăng ký FaceID mới cho nhân viên: Cập nhật cơ sở dữ liệu và tải khuôn mặt vào AI Vision Engine.
    Hỗ trợ cả chế độ chuẩn eKYC 3 góc (thẳng, nghiêng trái, nghiêng phải) và chế độ đơn ảnh.
    """
    try:
        sid = staff_id.strip()
        sname = staff_name.strip()

        # 1. Đăng ký vào cơ sở dữ liệu nhân sự
        created = staff_repo.create_staff(
            staff_id=sid,
            name=sname,
            role=role.strip(),
            pen_id=pen_id.strip(),
        )

        # 2. Xử lý ảnh khuôn mặt
        if file_thang and file_nghieng_trai and file_nghieng_phai:
            c_thang = await file_thang.read()
            c_trai = await file_nghieng_trai.read()
            c_phai = await file_nghieng_phai.read()

            vision_resp = face_service.enroll_face_3_angles(
                staff_id=sid,
                staff_name=sname,
                thang_bytes=c_thang,
                trai_bytes=c_trai,
                phai_bytes=c_phai
            )
        else:
            target = file or file_thang
            if not target:
                raise HTTPException(status_code=400, detail="Vui lòng cung cấp ít nhất 1 ảnh khuôn mặt hoặc đủ 3 góc eKYC.")
            contents = await target.read()
            vision_resp = face_service.enroll_face(
                staff_id=sid,
                staff_name=sname,
                image_bytes=contents,
                filename=target.filename or f"{sid}_thang.jpg",
            )

        await ws_manager.broadcast("staff_update", {"action": "enroll", "staff": created})
        return {
            "status": "success",
            "message": f"Đã đăng ký FaceID thành công cho nhân sự {sname} ({sid})",
            "staff": created,
            "vision_engine": vision_resp,
        }
    except Exception as e:
        logger.error(f"Enroll staff face error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/staff/reload-faces", tags=["Staff & Face Attendance"])
async def reload_staff_faces_api():
    """Làm mới danh sách FaceID từ thư mục standalone_ai_engine/known_faces."""
    try:
        vision_base = settings.VISION_ENGINE_URL.rstrip('/')
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(f"{vision_base}/api/v1/faces/reload")
            if resp.status_code == 200:
                return resp.json()
            raise HTTPException(resp.status_code, resp.text)
    except Exception as e:
        logger.error(f"Reload faces error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ====================================================================
# DEDICATED FULL-BODY & UNIFORM INSPECTION ENDPOINTS
# ====================================================================

@app.post("/api/uniform/scan", tags=["Full-Body Uniform Inspection"])
async def scan_uniform_api(payload: UniformInspectRequest):
    """
    API Riêng: Quét toàn thân & phân tích trang phục đồng phục chi tiết (Base64).
    Truyền dữ liệu trực tiếp vào Standalone AI Engine (Port 8001).
    """
    try:
        return face_service.inspect_uniform_base64(
            image_base64=payload.image_base64,
            weekday=payload.weekday or -1,
            return_annotated=payload.return_annotated if payload.return_annotated is not None else True
        )
    except Exception as e:
        logger.error(f"Uniform scan error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/uniform/scan-upload", tags=["Full-Body Uniform Inspection"])
async def scan_uniform_upload_api(
    weekday: int = Form(-1),
    file: UploadFile = File(...),
):
    """
    API Riêng: Quét toàn thân & phân tích trang phục bằng file ảnh tải lên.
    """
    try:
        import base64
        contents = await file.read()
        b64_str = base64.b64encode(contents).decode("utf-8")
        return face_service.inspect_uniform_base64(
            image_base64=b64_str,
            weekday=weekday,
            return_annotated=True
        )
    except Exception as e:
        logger.error(f"Uniform upload scan error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ====================================================================
# LIVE CAMERA REAL-TIME STREAMING & SCANNING
# ====================================================================

_live_checkin_cooldown: Dict[str, float] = {}


@app.post("/api/staff/live-scan", tags=["Live Camera AI Scan"])
async def staff_live_scan_api(payload: StaffLiveScanRequest):
    """
    API Quét Live Thời Gian Thực:
    - Nhận diện khuôn mặt FaceID + Chống giả mạo Anti-Spoofing
    - Nhận diện vóc dáng người, vùng áo, vùng quần và kiểm tra quy định đồng phục
    - Nếu bật auto_checkin và nhận diện nhân viên hợp lệ (confidence >= 0.55):
      Tự động ghi nhận chấm công (kèm cooldown 12s tránh spam liên tục) và phát WebSocket
    """
    try:
        # Gọi phân tích AI toàn diện
        inspect_res = face_service.inspect_uniform_base64(
            image_base64=payload.image_base64,
            weekday=payload.weekday if payload.weekday is not None else -1,
            return_annotated=payload.return_annotated if payload.return_annotated is not None else False,
        )

        checked_in = False
        attendance_record = None
        cooldown_active = False

        faces = inspect_res.get("faces", [])
        if payload.auto_checkin and faces:
            # Tìm khuôn mặt hợp lệ nhất (đã đăng ký, độ tin cậy >= 0.55 và là người thật)
            valid_face = None
            for f in faces:
                stu_id = f.get("student_id")
                if stu_id and stu_id != "UNKNOWN":
                    liveness = f.get("liveness", {})
                    is_real = liveness.get("is_real", True)
                    conf = f.get("confidence", 0.0)
                    if conf >= 0.55 and is_real:
                        valid_face = f
                        break

            if valid_face:
                sid = valid_face["student_id"]
                sname = valid_face.get("name", "Nhân sự")
                now = time.time()
                last_time = _live_checkin_cooldown.get(sid, 0)

                # Cooldown 12 giây cho cùng 1 nhân sự
                if now - last_time >= 12.0:
                    _live_checkin_cooldown[sid] = now
                    attendance_record = staff_repo.log_attendance(
                        staff_id=sid,
                        staff_name=sname,
                        pen_id=payload.pen_id or "123",
                        status="present",
                        check_type=payload.check_type or "check_in",
                        confidence=valid_face.get("confidence", 1.0),
                        is_real=True,
                        note=f"Quét FaceID Live Camera 24/7 ({payload.check_type or 'Vào ca'})",
                    )
                    checked_in = True
                    await ws_manager.broadcast("staff_checkin", {
                        "attendance": attendance_record,
                        "staff_id": sid,
                        "staff_name": sname,
                        "check_type": payload.check_type or "check_in",
                        "mode": "live_stream",
                    })
                else:
                    cooldown_active = True

        return {
            "status": "success",
            "checked_in": checked_in,
            "cooldown_active": cooldown_active,
            "attendance": attendance_record,
            "person_detected": inspect_res.get("person_detected", False),
            "faces_detected": inspect_res.get("faces_detected", 0),
            "faces": faces,
            "uniform": inspect_res.get("uniform"),
            "process_time_ms": inspect_res.get("process_time_ms", 0),
            "annotated_image_base64": inspect_res.get("annotated_image_base64"),
        }
    except Exception as e:
        logger.error(f"Live scan error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/camera/status", tags=["Camera Stream"])
async def get_camera_status():
    """Lấy trạng thái luồng camera phần cứng."""
    try:
        vision_base = settings.VISION_ENGINE_URL.rstrip('/')
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.get(f"{vision_base}/api/v1/camera/status")
            return resp.json()
    except Exception as e:
        return {"is_running": False, "error": str(e)}


@app.get("/api/camera/latest", tags=["Camera Stream"])
async def get_camera_latest():
    """Lấy telemetries nhận diện khuôn mặt & đồng phục mới nhất từ camera phần cứng."""
    try:
        vision_base = settings.VISION_ENGINE_URL.rstrip('/')
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.get(f"{vision_base}/api/v1/camera/latest")
            return resp.json()
    except Exception as e:
        return {"status": "offline", "error": str(e)}


@app.post("/api/camera/start", tags=["Camera Stream"])
async def start_camera_device(source: str = "0", weekday: Optional[int] = None):
    """Bật camera phần cứng."""
    try:
        vision_base = settings.VISION_ENGINE_URL.rstrip('/')
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.post(
                f"{vision_base}/api/v1/camera/start",
                json={"source": source, "weekday_override": weekday}
            )
            return resp.json()
    except Exception as e:
        raise HTTPException(500, detail=str(e))


@app.post("/api/camera/stop", tags=["Camera Stream"])
async def stop_camera_device():
    """Dừng camera phần cứng."""
    try:
        vision_base = settings.VISION_ENGINE_URL.rstrip('/')
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.post(f"{vision_base}/api/v1/camera/stop")
            return resp.json()
    except Exception as e:
        raise HTTPException(500, detail=str(e))


# ====================================================================
# WEBSOCKET REAL-TIME ENDPOINT
# ====================================================================

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """
    Real-time WebSocket endpoint:
    - Live chat with AI Agent
    - Live IoT alerts & device updates
    - Animal transfer notifications across pens
    - Real-time sensor metrics
    """
    await ws_manager.connect(websocket)

    await ws_manager.send_personal_message(
        {
            "event": "connected",
            "message": "Kết nối WebSocket thành công tới Smart Farm Đa Chuồng Trại!",
            "server_time": date.today().isoformat(),
        },
        websocket,
    )

    try:
        while True:
            raw_data = await websocket.receive_text()
            if len(raw_data) > 65536:
                await ws_manager.send_personal_message(
                    {"event": "error", "message": "Thông điệp WebSocket vượt quá giới hạn 64KB."},
                    websocket,
                )
                continue
            try:
                payload = json.loads(raw_data)
                event_type = payload.get("action") or payload.get("event")

                if event_type == "chat":
                    user_msg = payload.get("message", "")
                    ws_user = payload.get("user_id") or "guest"
                    ws_pen = payload.get("pen_id")
                    if user_msg:
                        # 1. Fetch recent history
                        history = chat_history_repo.get_history(user_id=ws_user, pen_id=ws_pen, limit=10)

                        # 2. Save user message
                        chat_history_repo.save_message(
                            user_id=ws_user,
                            sender="user",
                            content=user_msg,
                            pen_id=ws_pen,
                        )

                        # 3. Call AI agent with strict user_id + pen_id scope
                        result = await agent_service.chat(
                            user_msg,
                            history=history,
                            user_id=ws_user,
                            pen_id=ws_pen,
                        )

                        # 4. Save agent message
                        chat_history_repo.save_message(
                            user_id=ws_user,
                            sender="agent",
                            content=result["reply"],
                            pen_id=ws_pen,
                            tool_calls=result.get("tool_calls", []),
                        )

                        await ws_manager.send_personal_message(
                            {
                                "event": "chat_response",
                                "user_message": user_msg,
                                "reply": result["reply"],
                                "tool_calls": result.get("tool_calls", []),
                            },
                            websocket,
                        )

                elif event_type == "ping":
                    await ws_manager.send_personal_message({"event": "pong"}, websocket)

                else:
                    await ws_manager.send_personal_message(
                        {"event": "echo", "data": payload},
                        websocket,
                    )

            except json.JSONDecodeError:
                await ws_manager.send_personal_message(
                    {"event": "error", "message": "Payload JSON không hợp lệ"},
                    websocket,
                )

    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        ws_manager.disconnect(websocket)


# ====================================================================
# WEB DASHBOARD (INTERACTIVE MULTI-PEN UI)
# ====================================================================

@app.get("/", response_class=HTMLResponse, tags=["Dashboard"])
async def dashboard():
    """Interactive Web UI for Smart Farm Multi-Pen Management & AI Agent Control."""
    html_content = """<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Smart Farm Multi-Pen Dashboard (MCP + Gemini)</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    .chat-bubble { max-width: 85%; }
    @keyframes pulse-fast { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
    .pulse-alert { animation: pulse-fast 1s infinite; }
  </style>
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen font-sans">
  <div class="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
    
    <!-- Header with Pen Switcher -->
    <header class="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-slate-800 pb-4 gap-4">
      <div>
        <div class="flex items-center gap-2">
          <span class="text-3xl">🌾</span>
          <h1 class="text-2xl md:text-3xl font-bold bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
            Smart Farm Đa Chuồng Trại
          </h1>
        </div>
        <p class="text-xs md:text-sm text-slate-400 mt-1">
          Hệ Thống Quản Lý & Chuyển Chuồng Linh Hoạt • FastMCP Agent • Supabase • Google Gemini
        </p>
      </div>

      <!-- Controls: Active Pen Selector & WS Status -->
      <div class="flex flex-wrap items-center gap-3">
        <div class="flex items-center gap-2 bg-slate-900 border border-slate-700 px-3 py-1.5 rounded-xl shadow">
          <span class="text-xs font-semibold text-emerald-400">🏠 Đang chọn chuồng:</span>
          <select id="penSelect" onchange="onPenChanged()" class="bg-slate-950 text-slate-100 text-xs font-medium border border-slate-700 rounded-lg px-2 py-1 focus:outline-none focus:border-emerald-500">
            <option value="123">Chuồng Heo Thịt Khu A1 (123)</option>
            <option value="PEN-A02">Chuồng Heo Thịt Khu A2 (PEN-A02)</option>
            <option value="PEN-ISO-01">Khu Cách Ly Y Tế (PEN-ISO-01)</option>
            <option value="PEN-B01">Khu Nhà Màng Dưa Lưới B1 (PEN-B01)</option>
          </select>
        </div>

        <span id="wsStatus" class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-red-950 text-red-400 border border-red-800">
          <span class="w-2 h-2 rounded-full bg-red-400"></span> WebSocket Offline
        </span>
        <button onclick="triggerBriefing()" class="px-3 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 rounded-lg font-medium transition shadow flex items-center gap-1">
          <span>🌅</span> Briefing
        </button>
      </div>
    </header>

    <!-- Metrics Bar for the Selected Pen -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div class="bg-slate-900 border border-slate-800 rounded-xl p-3.5 shadow">
        <div class="text-xs text-slate-400">Chuồng Đang Chọn</div>
        <div id="metricPenName" class="text-base md:text-lg font-bold text-emerald-400 mt-1">Chuồng Heo A1</div>
        <div id="metricPenType" class="text-[11px] text-slate-500">livestock</div>
      </div>
      <div class="bg-slate-900 border border-slate-800 rounded-xl p-3.5 shadow">
        <div class="text-xs text-slate-400">Cảm Biến Môi Trường</div>
        <div id="metricTelemetry" class="text-base md:text-lg font-bold text-amber-400 mt-1">28.5°C • 75%</div>
        <div id="metricSmell" class="text-[11px] text-slate-400">Mùi: 2.5 ppm (Bình thường)</div>
      </div>
      <div class="bg-slate-900 border border-slate-800 rounded-xl p-3.5 shadow">
        <div class="text-xs text-slate-400">Số Lượng Vật Nuôi / Cây</div>
        <div id="metricAnimalCount" class="text-base md:text-lg font-bold text-cyan-400 mt-1">2 cá thể</div>
        <div id="metricAnimalList" class="text-[11px] text-slate-400 truncate">HEO-101, HEO-102</div>
      </div>
      <div class="bg-slate-900 border border-slate-800 rounded-xl p-3.5 shadow">
        <div class="text-xs text-slate-400">Thiết Bị IoT Tại Chuồng</div>
        <div id="metricDeviceStatus" class="text-base md:text-lg font-bold text-rose-400 mt-1">3 thiết bị</div>
        <div id="metricDeviceList" class="text-[11px] text-slate-400 truncate">Quạt hút, phun sương, đèn</div>
      </div>
    </div>

    <!-- Main Grid -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      <!-- Col 1 & 2: Chat with AI Agent -->
      <div class="lg:col-span-2 flex flex-col bg-slate-900 rounded-2xl border border-slate-800 h-[640px] shadow-xl overflow-hidden">
        <div class="px-5 py-3 border-b border-slate-800 bg-slate-900/90 flex justify-between items-center">
          <div class="flex items-center gap-2">
            <span class="text-xl">🤖</span>
            <div>
              <h2 class="font-semibold text-sm">Smart Farm AI Agent (MCP Multi-Pen Host)</h2>
              <p class="text-xs text-slate-400">Chuyển chuồng, điều khiển IoT, cho ăn & quản lý bệnh dịch qua MCP Tools</p>
            </div>
          </div>
          <button onclick="clearChat()" class="text-xs text-slate-400 hover:text-slate-200">Xóa chat</button>
        </div>

        <!-- Chat messages container -->
        <div id="chatBox" class="flex-1 p-4 overflow-y-auto space-y-4 text-sm">
          <div class="flex items-start gap-3">
            <div class="w-8 h-8 rounded-full bg-emerald-600/30 text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0">AI</div>
            <div class="bg-slate-800/80 p-3.5 rounded-2xl rounded-tl-none border border-slate-700/60 chat-bubble">
              Xin chào! Tôi có thể quản lý và điều phối <b>tất cả các chuồng</b> trong trang trại của bạn.<br/>
              Bạn có thể ra lệnh chuyển đổi chuồng linh hoạt:<br/>
              • <i>"Chuyển con HEO-102 sang chuồng cách ly PEN-ISO-01"</i><br/>
              • <i>"Đổi chuồng cho HEO-101 sang chuồng A2"</i><br/>
              • <i>"Xem tình hình chuồng PEN-A02"</i><br/>
              • <i>"Bật quạt chuồng A2"</i> hoặc <i>"Cho chuồng PEN-ISO-01 ăn 5 kg cám"</i>
            </div>
          </div>
        </div>

        <!-- Quick Prompts Bar for Multi-Pen & RAG -->
        <div class="px-4 py-2 border-t border-slate-800 bg-slate-950/60 flex gap-2 overflow-x-auto text-xs">
          <button onclick="sendQuickPrompt('Chẩn đoán bệnh heo bị sốt cao 41 độ, tai tím tái, khó thở và đề xuất phác đồ điều trị')" class="px-3 py-1 bg-rose-900/40 border border-rose-700/60 hover:bg-rose-800/60 rounded-full shrink-0 text-rose-200 font-medium">🩺 RAG Chẩn Đoán Tai Xanh</button>
          <button onclick="sendQuickPrompt('Lá lúa xuất hiện đốm hình thoi nâu xám, cháy lá, xin phác đồ điều trị đạo ôn')" class="px-3 py-1 bg-emerald-900/40 border border-emerald-700/60 hover:bg-emerald-800/60 rounded-full shrink-0 text-emerald-200 font-medium">🌾 RAG Bệnh Đạo Ôn</button>
          <button onclick="sendQuickPrompt('Chuyển cá thể HEO-102 sang chuồng cách ly PEN-ISO-01 để điều trị')" class="px-3 py-1 bg-amber-900/40 border border-amber-700/60 hover:bg-amber-800/60 rounded-full shrink-0 text-amber-200 font-medium">🚚 Chuyển HEO-102 sang Cách Ly</button>
          <button onclick="sendQuickPrompt('Chuyển cá thể HEO-101 sang chuồng PEN-A02')" class="px-3 py-1 bg-slate-800 hover:bg-slate-700 rounded-full shrink-0 text-slate-300">🚚 Đổi HEO-101 sang Chuồng A2</button>
          <button onclick="sendQuickPrompt('Xem thông tin chi tiết chuồng PEN-A02')" class="px-3 py-1 bg-slate-800 hover:bg-slate-700 rounded-full shrink-0 text-slate-300">🔍 Tra cứu chuồng A2</button>
          <button onclick="sendQuickPrompt('Bật quạt thông gió chuồng PEN-A02')" class="px-3 py-1 bg-slate-800 hover:bg-slate-700 rounded-full shrink-0 text-slate-300">🌬️ Bật quạt chuồng A2</button>
          <button onclick="sendQuickPrompt('Cho chuồng PEN-A02 ăn 10 kg cám')" class="px-3 py-1 bg-slate-800 hover:bg-slate-700 rounded-full shrink-0 text-slate-300">🥣 Cho ăn chuồng A2</button>
        </div>

        <!-- Input box -->
        <div class="p-3 bg-slate-900 border-t border-slate-800 flex gap-2">
          <input id="chatInput" type="text" placeholder="Nhập lệnh: ví dụ 'Chuyển con HEO-102 sang chuồng cách ly PEN-ISO-01'..." onkeydown="if(event.key==='Enter') sendChat()"
            class="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500 text-slate-100 placeholder-slate-500">
          <button onclick="sendChat()" class="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 font-medium text-sm rounded-xl transition shadow">Gửi</button>
        </div>
      </div>

      <!-- Col 3: Side Panels (Quick Animal Transfer & Pen IoT Simulator) -->
      <div class="space-y-6">
        
        <!-- Form Chuyển Chuồng Trực Quan (Quick Animal Transfer) -->
        <div class="bg-slate-900 rounded-2xl border border-slate-800 p-4 shadow-xl">
          <h3 class="font-semibold text-sm flex items-center gap-2 mb-3 text-amber-400">
            <span>🚚</span> Thao Tác Chuyển Chuồng Nhanh
          </h3>
          <div class="space-y-2.5 text-xs">
            <div>
              <label class="text-slate-400">Chọn vật nuôi:</label>
              <select id="transferAnimalId" class="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 mt-1">
                <option value="HEO-102">HEO-102 (Đang ở chuồng 123 - Sốt nhẹ)</option>
                <option value="HEO-101">HEO-101 (Đang ở chuồng 123 - Khỏe)</option>
                <option value="HEO-201">HEO-201 (Đang ở chuồng PEN-A02)</option>
                <option value="HEO-ISO-01">HEO-ISO-01 (Đang ở chuồng PEN-ISO-01)</option>
              </select>
            </div>
            <div>
              <label class="text-slate-400">Chuyển sang chuồng:</label>
              <select id="transferTargetPen" class="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 mt-1">
                <option value="PEN-ISO-01">PEN-ISO-01 (Khu Cách Ly Y Tế)</option>
                <option value="PEN-A02">PEN-A02 (Chuồng Heo Thịt Khu A2)</option>
                <option value="123">123 (Chuồng Heo Thịt Khu A1)</option>
              </select>
            </div>
            <div>
              <label class="text-slate-400">Lý do chuyển:</label>
              <input id="transferReason" type="text" placeholder="Cách ly điều trị / Tách đàn..." value="Cách ly điều trị y tế" class="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 mt-1">
            </div>
            <button onclick="submitAnimalTransfer()" class="w-full py-2 bg-amber-600 hover:bg-amber-500 font-medium text-white rounded-lg transition shadow">
              Xác Nhận Đổi Chuồng
            </button>
          </div>
        </div>

        <!-- IoT Sensor Simulator for Selected Pen -->
        <div class="bg-slate-900 rounded-2xl border border-slate-800 p-4 shadow-xl">
          <h3 class="font-semibold text-sm flex items-center gap-2 mb-2 text-cyan-400">
            <span>📡</span> Mô Phỏng Cảm Biến Chuồng Này
          </h3>
          <p class="text-[11px] text-slate-400 mb-3">Đẩy thông số nhiệt độ/mùi cho chuồng đang chọn để kích hoạt <b>The Watcher</b>:</p>
          <div class="grid grid-cols-3 gap-2 mb-3">
            <div>
              <label class="text-[10px] text-slate-400">Nhiệt độ (°C)</label>
              <input id="simTemp" type="number" step="0.1" value="28.5" class="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-200">
            </div>
            <div>
              <label class="text-[10px] text-slate-400">Độ ẩm (%)</label>
              <input id="simHum" type="number" step="0.1" value="75.0" class="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-200">
            </div>
            <div>
              <label class="text-[10px] text-slate-400">Mùi (ppm)</label>
              <input id="simSmell" type="number" step="0.1" value="2.5" class="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-200">
            </div>
          </div>
          <div class="flex gap-2">
            <button onclick="pushSensorData(false, false)" class="flex-1 py-1.5 bg-cyan-800 hover:bg-cyan-700 text-xs rounded-lg font-medium transition">
              Đo Thường
            </button>
            <button onclick="pushSensorData(true, false)" class="flex-1 py-1.5 bg-rose-800 hover:bg-rose-700 text-xs rounded-lg font-medium transition">
              🔥 Quá Nóng
            </button>
            <button onclick="pushSensorData(false, true)" class="flex-1 py-1.5 bg-amber-800 hover:bg-amber-700 text-xs rounded-lg font-medium transition">
              💨 Mùi Cao
            </button>
          </div>
        </div>

        <!-- RAG Agricultural Knowledge & Disease Diagnosis Card -->
        <div class="bg-slate-900 rounded-2xl border border-slate-800 p-4 shadow-xl">
          <h3 class="font-semibold text-sm flex items-center gap-2 mb-2 text-rose-400">
            <span>🩺</span> Chẩn Đoán Bệnh & RAG Tri Thức
          </h3>
          <p class="text-[11px] text-slate-400 mb-2">Tra cứu phác đồ điều trị từ <b>Pinecone Knowledge Base</b>:</p>
          <div class="space-y-2 text-xs">
            <textarea id="diagQuery" rows="2" placeholder="Nhập triệu chứng (VD: heo sốt cao tai tím, đốm lá đạo ôn...)"
              class="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-rose-500"></textarea>
            <div class="flex items-center gap-2">
              <input id="diagImage" type="file" accept="image/*" class="text-[11px] text-slate-400 file:mr-2 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-[11px] file:bg-slate-800 file:text-slate-300 hover:file:bg-slate-700">
            </div>
            <button onclick="submitRAGDiagnosis()" class="w-full py-2 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 font-medium text-white rounded-lg transition shadow">
              🩺 Chẩn Đoán & Trích Xuất Phác Đồ RAG
            </button>
          </div>
        </div>

        <!-- Quản Lý Nhân Sự & Điểm Danh FaceID Card (Standalone AI Engine) -->
        <div class="bg-slate-900 rounded-2xl border border-slate-800 p-4 shadow-xl">
          <div class="flex justify-between items-center mb-2">
            <h3 class="font-semibold text-sm flex items-center gap-2 text-cyan-400">
              <span>👤</span> Chấm Công & Quét Mặt 24/7
            </h3>
            <span id="visionBadge" class="text-[10px] bg-cyan-950 text-cyan-400 border border-cyan-800 px-2 py-0.5 rounded-full">AI Face Engine</span>
          </div>
          <p class="text-[11px] text-slate-400 mb-2">Chấm công tức thì và quét mặt mọi lúc không giới hạn ca:</p>
          <div class="space-y-2 text-xs">
            <div class="flex gap-2">
              <button id="btnCheckInType" onclick="setDashboardCheckType('check_in')" class="flex-1 py-1 rounded bg-emerald-600 text-white font-bold transition">Vào Ca</button>
              <button id="btnCheckOutType" onclick="setDashboardCheckType('check_out')" class="flex-1 py-1 rounded bg-slate-800 text-slate-300 font-bold transition">Tan Ca</button>
            </div>
            <div class="flex gap-2">
              <select id="staffCheckinId" class="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200">
                <option value="NV01">NV01 - Nguyễn Văn An (Quản lý)</option>
                <option value="NV02">NV02 - Trần Thị Bình (Thú y)</option>
                <option value="NV03">NV03 - Lê Hoàng Long (Kỹ thuật viên)</option>
                <option value="NV04">NV04 - Phạm Văn Cường (Nông học)</option>
              </select>
              <button onclick="quickStaffCheckIn()" class="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 font-medium text-white rounded-lg transition shadow">
                Chấm Công
              </button>
            </div>
            <div>
              <button id="btnToggleDashboardCam" onclick="toggleDashboardServerCam()" class="w-full py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-400 rounded-lg font-medium transition flex items-center justify-center gap-1">
                📸 Bật Camera Quét Mặt Server
              </button>
            </div>
            <div id="dashboardWebcamBox" class="hidden space-y-2">
              <img id="dashboardServerCam" src="" alt="Camera Server" class="w-full rounded-lg bg-black border border-cyan-800 aspect-video object-contain" />
              <button onclick="captureDashboardFace()" class="w-full py-1.5 bg-gradient-to-r from-cyan-500 to-emerald-500 text-slate-950 font-bold rounded-lg shadow">
                🎯 Nhận Diện Chấm Công Tức Thì
              </button>
            </div>
            <div class="mt-2 border-t border-slate-800 pt-2">
              <div class="text-[11px] text-slate-400 flex justify-between mb-1">
                <span>Lượt chấm công hôm nay:</span>
                <span id="staffPresentCount" class="text-cyan-400 font-bold">0 người</span>
              </div>
              <div id="staffAttendanceList" class="max-h-24 overflow-y-auto space-y-1 text-[11px]">
                <p class="text-slate-500 text-center py-2">Đang tải điểm danh...</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Real-time Alerts Panel -->
        <div class="bg-slate-900 rounded-2xl border border-slate-800 p-4 shadow-xl flex flex-col h-[260px]">
          <div class="flex justify-between items-center mb-2">
            <h3 class="font-semibold text-xs flex items-center gap-1.5 text-amber-400">
              <span class="pulse-alert">⚠️</span> Cảnh Báo Trang Trại Realtime
            </h3>
            <span id="alertCountBadge" class="text-[10px] bg-amber-950 text-amber-400 border border-amber-800 px-2 py-0.5 rounded-full">0 mới</span>
          </div>
          <div id="alertsContainer" class="flex-1 overflow-y-auto space-y-2 text-xs pr-1">
            <p class="text-slate-500 text-center py-6 text-xs">Chưa có cảnh báo realtime nào.</p>
          </div>
        </div>

      </div>
    </div>
  </div>

  <script>
    let ws = null;
    let alertCount = 0;
    let currentPenId = "123";

    async function loadPensList() {
      try {
        const res = await fetch('/api/pens');
        const pens = await res.json();
        const sel = document.getElementById('penSelect');
        const transferPenSel = document.getElementById('transferTargetPen');
        
        sel.innerHTML = '';
        transferPenSel.innerHTML = '';

        pens.forEach(p => {
          const opt = document.createElement('option');
          opt.value = p.id;
          opt.textContent = `${p.name || 'Chuồng'} (${p.id})`;
          sel.appendChild(opt);

          const opt2 = document.createElement('option');
          opt2.value = p.id;
          opt2.textContent = `${p.name || 'Chuồng'} (${p.id})`;
          transferPenSel.appendChild(opt2);
        });

        sel.value = currentPenId;
        await refreshPenDetails(currentPenId);
      } catch (e) {
        console.error("Could not load pens:", e);
      }
    }

    async function onPenChanged() {
      currentPenId = document.getElementById('penSelect').value;
      await refreshPenDetails(currentPenId);
    }

    async function refreshPenDetails(penId) {
      try {
        const res = await fetch(`/api/pens/${penId}/details`);
        const data = await res.json();

        // Update Header Metrics
        document.getElementById('metricPenName').textContent = data.pen.name || `Chuồng ${penId}`;
        document.getElementById('metricPenType').textContent = `Mã: ${penId} • Loại: ${data.pen.type}`;

        const tel = data.latest_telemetry;
        if (tel) {
          document.getElementById('metricTelemetry').textContent = `${tel.temperature}°C • ${tel.humidity}%`;
          document.getElementById('metricSmell').textContent = `Mùi: ${tel.smell_level || 0} ppm`;
        } else {
          document.getElementById('metricTelemetry').textContent = `28.0°C • 70%`;
          document.getElementById('metricSmell').textContent = `Mùi: 2.0 ppm`;
        }

        document.getElementById('metricAnimalCount').textContent = `${data.animals_count} cá thể`;
        document.getElementById('metricAnimalList').textContent = data.animals.length ? 
          data.animals.map(a => `${a.id} (${a.status})`).join(', ') : 'Chưa có vật nuôi';

        document.getElementById('metricDeviceStatus').textContent = `${data.devices_count} thiết bị`;
        document.getElementById('metricDeviceList').textContent = data.devices.length ? 
          data.devices.map(d => `${d.name}: ${d.is_active ? 'Bật 🟢' : 'Tắt 🔴'}`).join(', ') : 'Chưa gắn thiết bị';

        // Refresh Animal dropdown in transfer form
        const animSel = document.getElementById('transferAnimalId');
        const allAnimalsRes = await fetch('/api/animals');
        const allAnimals = await allAnimalsRes.json();
        animSel.innerHTML = '';
        allAnimals.forEach(a => {
          const opt = document.createElement('option');
          opt.value = a.id;
          opt.textContent = `${a.id} (Ở chuồng ${a.pen_id} - ${a.status})`;
          animSel.appendChild(opt);
        });

      } catch (e) {
        console.error("Error refreshing pen details:", e);
      }
    }

    async function submitAnimalTransfer() {
      const animalId = document.getElementById('transferAnimalId').value;
      const targetPen = document.getElementById('transferTargetPen').value;
      const reason = document.getElementById('transferReason').value;

      try {
        const res = await fetch('/api/animals/transfer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ animal_id: animalId, target_pen_id: targetPen, reason: reason })
        });
        const data = await res.json();
        if (data.status === 'success') {
          showAlertPopup({
            alert_type: "🚚 ĐỔI CHUỒNG THÀNH CÔNG",
            message: `Cá thể ${animalId} đã được chuyển sang chuồng [${targetPen}]. Lý do: ${reason}`
          });
          await refreshPenDetails(currentPenId);
        }
      } catch (e) {
        alert("Lỗi khi chuyển chuồng: " + e);
      }
    }

    function connectWS() {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        const badge = document.getElementById('wsStatus');
        badge.className = "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-950 text-emerald-400 border border-emerald-800";
        badge.innerHTML = '<span class="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span> Realtime Connected';
      };

      ws.onmessage = (event) => {
        const payload = JSON.parse(event.data);
        handleWsEvent(payload);
      };

      ws.onclose = () => {
        const badge = document.getElementById('wsStatus');
        badge.className = "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-red-950 text-red-400 border border-red-800";
        badge.innerHTML = '<span class="w-2 h-2 rounded-full bg-red-400"></span> Disconnected (Retrying...)';
        setTimeout(connectWS, 3000);
      };
    }

    function handleWsEvent(msg) {
      if (msg.event === 'alert') {
        showAlertPopup(msg.data);
      } else if (msg.event === 'chat_response') {
        appendAIMessage(msg.reply, msg.tool_calls);
      } else if (msg.event === 'morning_briefing') {
        showBriefingPopup(msg.data);
      } else if (msg.event === 'animal_transfer') {
        showAlertPopup({
          alert_type: "🚚 ĐIỀU CHUYỂN CHUỒNG",
          message: `Vật nuôi ${msg.data.animal_id} vừa được chuyển từ [${msg.data.old_pen_id}] sang [${msg.data.target_pen_id}]!`
        });
        refreshPenDetails(currentPenId);
      } else if (msg.event === 'device_update') {
        refreshPenDetails(currentPenId);
      } else if (msg.event === 'env_update') {
        refreshPenDetails(currentPenId);
      } else if (msg.event === 'staff_checkin') {
        showAlertPopup({
          alert_type: "STAFF_CHECKIN",
          message: `👤 Nhân sự ${msg.data.staff_name} (${msg.data.staff_id}) đã vào ca trực tại chuồng ${msg.data.pen_id || '123'}.`
        });
        loadStaffAttendance();
      }
    }

    function appendAIMessage(text, toolCalls) {
      const box = document.getElementById('chatBox');
      const toolHtml = toolCalls && toolCalls.length ? 
        `<div class="mt-2 text-xs bg-slate-950 p-2 rounded border border-slate-700 text-emerald-300">
           <b>🛠️ MCP Tool:</b> ${toolCalls.map(t => `<code>${t.tool || t.name}</code>`).join(', ')}
         </div>` : '';
      
      const div = document.createElement('div');
      div.className = "flex items-start gap-3";
      div.innerHTML = `
        <div class="w-8 h-8 rounded-full bg-emerald-600/30 text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0">AI</div>
        <div class="bg-slate-800/80 p-3.5 rounded-2xl rounded-tl-none border border-slate-700/60 chat-bubble text-slate-100">
          <div>${text.replace(/\\n/g, '<br/>')}</div>
          ${toolHtml}
        </div>
      `;
      box.appendChild(div);
      box.scrollTop = box.scrollHeight;
    }

    function appendUserMessage(text) {
      const box = document.getElementById('chatBox');
      const div = document.createElement('div');
      div.className = "flex items-start gap-3 justify-end";
      div.innerHTML = `
        <div class="bg-emerald-600 text-white p-3.5 rounded-2xl rounded-tr-none chat-bubble shadow">
          ${text}
        </div>
        <div class="w-8 h-8 rounded-full bg-slate-700 text-slate-300 flex items-center justify-center font-bold text-xs shrink-0">BẠN</div>
      `;
      box.appendChild(div);
      box.scrollTop = box.scrollHeight;
    }

    function sendChat() {
      const input = document.getElementById('chatInput');
      const text = input.value.trim();
      if (!text) return;

      appendUserMessage(text);
      input.value = '';

      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ action: "chat", message: text }));
      } else {
        fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text })
        })
        .then(res => res.json())
        .then(data => appendAIMessage(data.reply, data.tool_calls))
        .catch(err => appendAIMessage("❌ Lỗi khi gửi lệnh: " + err, []));
      }
    }

    function sendQuickPrompt(prompt) {
      document.getElementById('chatInput').value = prompt;
      sendChat();
    }

    function showAlertPopup(data) {
      alertCount++;
      document.getElementById('alertCountBadge').textContent = `${alertCount} mới`;

      const container = document.getElementById('alertsContainer');
      if (alertCount === 1) container.innerHTML = '';

      const card = document.createElement('div');
      card.className = "p-3 rounded-xl bg-amber-950/40 border border-amber-700/60 space-y-1 shadow animate-fade-in";
      card.innerHTML = `
        <div class="flex justify-between items-center font-semibold text-amber-300">
          <span>🚨 ${data.alert_type || 'CẢNH BÁO'}</span>
          <span class="text-[10px] text-slate-400">${new Date().toLocaleTimeString()}</span>
        </div>
        <p class="text-slate-200 text-xs">${data.message || ''}</p>
      `;
      container.prepend(card);
    }

    function showBriefingPopup(data) {
      showAlertPopup({
        alert_type: "🌅 BRIEFING BUỔI SÁNG",
        message: data.content
      });
    }

    function pushSensorData(isTempSpike, isSmellSpike) {
      let temp = parseFloat(document.getElementById('simTemp').value) || 28.5;
      let hum = parseFloat(document.getElementById('simHum').value) || 75.0;
      let smell = parseFloat(document.getElementById('simSmell').value) || 2.5;

      if (isTempSpike) {
        temp = 38.5;
        hum = 35.0;
      }
      if (isSmellSpike) {
        smell = 16.5;
      }

      fetch('/api/env/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ temperature: temp, humidity: hum, smell_level: smell, pen_id: currentPenId })
      })
      .then(res => res.json())
      .then(res => {
        showAlertPopup({
          alert_type: "IOT_TELEMETRY",
          message: `📡 Chuồng [${currentPenId}]: ${temp}°C, Độ ẩm: ${hum}%, Mùi: ${smell} ppm.`
        });
      });
    }

    function triggerBriefing() {
      fetch('/api/scheduler/trigger-briefing', { method: 'POST' });
    }

    async function submitRAGDiagnosis() {
      const query = document.getElementById('diagQuery').value.trim();
      const imageInput = document.getElementById('diagImage');
      const file = imageInput.files ? imageInput.files[0] : null;

      if (!query && !file) {
        alert("Vui lòng nhập triệu chứng hoặc chọn ảnh để chẩn đoán!");
        return;
      }

      appendUserMessage(`🩺 [Chẩn đoán RAG]: ${query || 'Phân tích hình ảnh'}`);

      const formData = new FormData();
      if (query) formData.append('user_query', query);
      if (file) formData.append('image', file);

      try {
        const res = await fetch('/api/diagnose', {
          method: 'POST',
          body: formData,
        });
        const data = await res.json();
        const replyHtml = `<b>🩺 Chẩn đoán:</b> ${data.disease_name || 'Chưa rõ'} (${data.category || ''} - ${data.species || ''})<br/><br/><b>📋 Phác đồ điều trị (RAG Knowledge):</b><br/>${(data.answer || '').replace(/\n/g, '<br/>')}`;
        appendAIMessage(replyHtml, [{ tool: "diagnose_agricultural_disease (RAG Pinecone)" }]);
        document.getElementById('diagQuery').value = '';
        if (imageInput) imageInput.value = '';
      } catch (e) {
        appendAIMessage("❌ Lỗi khi gửi chẩn đoán: " + e, []);
      }
    }

    function clearChat() {
      document.getElementById('chatBox').innerHTML = '';
    }

    let dashboardCheckType = 'check_in';
    let isDashboardCamActive = false;

    function setDashboardCheckType(type) {
      dashboardCheckType = type;
      const btnIn = document.getElementById('btnCheckInType');
      const btnOut = document.getElementById('btnCheckOutType');
      if (type === 'check_in') {
        btnIn.className = 'flex-1 py-1 rounded bg-emerald-600 text-white font-bold transition';
        btnOut.className = 'flex-1 py-1 rounded bg-slate-800 text-slate-300 font-bold transition';
      } else {
        btnIn.className = 'flex-1 py-1 rounded bg-slate-800 text-slate-300 font-bold transition';
        btnOut.className = 'flex-1 py-1 rounded bg-rose-600 text-white font-bold transition';
      }
    }

    async function toggleDashboardServerCam() {
      const box = document.getElementById('dashboardWebcamBox');
      const btn = document.getElementById('btnToggleDashboardCam');
      const img = document.getElementById('dashboardServerCam');

      if (isDashboardCamActive) {
        isDashboardCamActive = false;
        img.src = '';
        box.classList.add('hidden');
        btn.innerHTML = '📸 Bật Camera Quét Mặt Server';
        btn.classList.remove('text-rose-400');
        btn.classList.add('text-cyan-400');
        fetch('/api/camera/stop', { method: 'POST' }).catch(() => {});
      } else {
        try {
          await fetch('/api/camera/start', { method: 'POST' });
          img.src = '/api/camera/video_feed?overlay=true&t=' + Date.now();
          isDashboardCamActive = true;
          box.classList.remove('hidden');
          btn.innerHTML = '🛑 Tắt Camera Server';
          btn.classList.remove('text-cyan-400');
          btn.classList.add('text-rose-400');
        } catch (e) {
          alert("Không thể kết nối camera server: " + e);
        }
      }
    }

    async function captureDashboardFace() {
      try {
        const telRes = await fetch('/api/camera/latest');
        const telData = await telRes.json();
        const validFace = telData.faces && telData.faces.find(f => f.student_id && f.student_id !== 'UNKNOWN');
        if (validFace) {
          const res = await fetch('/api/staff/checkin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              staff_id: validFace.student_id,
              staff_name: validFace.name,
              pen_id: currentPenId, 
              check_type: dashboardCheckType,
              confidence: validFace.confidence || 0.95,
              note: 'Nhận diện tự động qua Camera Server 24/7'
            })
          });
          const data = await res.json();
          showAlertPopup({
            alert_type: "STAFF_CHECKIN",
            message: `👤 ${data.message || 'Chấm công thành công: ' + validFace.name}`
          });
          await loadStaffAttendance();
        } else {
          alert("Chưa phát hiện nhân sự trong khung hình camera server.");
        }
      } catch (e) {
        alert("Lỗi khi quét mặt: " + e);
      }
    }

    async function loadStaffAttendance() {
      try {
        const res = await fetch('/api/staff/attendance/history?limit=15');
        const logs = await res.json();
        const listEl = document.getElementById('staffAttendanceList');
        const countEl = document.getElementById('staffPresentCount');
        if (countEl) countEl.textContent = `${logs.length} lượt`;
        if (!listEl) return;
        if (logs.length === 0) {
          listEl.innerHTML = '<p class="text-slate-500 text-center py-2">Chưa có ai chấm công.</p>';
          return;
        }
        listEl.innerHTML = logs.map(l => {
          const isOut = l.check_type === 'check_out';
          const typeTag = isOut ? '<span class="text-rose-400 font-bold">[Tan ca]</span>' : '<span class="text-emerald-400 font-bold">[Vào ca]</span>';
          return `
            <div class="flex justify-between items-center p-1.5 rounded bg-slate-950 border border-slate-800">
              <div>
                <span class="font-medium text-slate-200">${l.staff_name}</span>
                <span class="text-[10px] text-slate-400">(${l.staff_id})</span>
                ${typeTag}
              </div>
              <span class="text-[10px] text-cyan-400 font-mono">Chuồng ${l.pen_id || '123'} • ${new Date(l.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}</span>
            </div>
          `;
        }).join('');
      } catch (e) {
        console.error("Error loading staff attendance:", e);
      }
    }

    async function quickStaffCheckIn() {
      const staffId = document.getElementById('staffCheckinId').value;
      try {
        const res = await fetch('/api/staff/checkin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            staff_id: staffId, 
            pen_id: currentPenId, 
            check_type: dashboardCheckType,
            note: 'Chấm công thủ công qua Web Dashboard' 
          })
        });
        const data = await res.json();
        showAlertPopup({
          alert_type: "STAFF_CHECKIN",
          message: `👤 ${data.message || 'Chấm công thành công'}`
        });
        await loadStaffAttendance();
      } catch (e) {
        alert("Lỗi khi chấm công: " + e);
      }
    }

    loadPensList();
    loadStaffAttendance();
    connectWS();
  </script>
</body>
</html>
"""
    return HTMLResponse(content=html_content)
