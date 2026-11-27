"""
==============================================================================
DỰ ÁN NÔNG NGHIỆP THÔNG MINH V-ARGON
Phân hệ: Action Tracking & Hybrid AI Vision (Microservice API Độc Lập)
File: main.py (FastAPI Backend - Multi-Pen IP Camera & Motion Tracker)
==============================================================================
Nguyên lý thiết kế (Andrej Karpathy Guidelines):
- Đơn giản, trực quan, không speculative abstractions.
- Tách biệt hoàn toàn thành Microservice độc lập (Port 8002).
- Tích hợp IP Web Cam tùy chỉnh cho từng chuồng/vườn (Multi-Pen Isolation).
- Mỗi chuồng chỉ nhận và phân tích dữ liệu từ IP camera của riêng khu vực đó.
- Loại bỏ hoàn toàn sự phụ thuộc vào ESP32, sử dụng IP Web Cam + Gemini AI.
==============================================================================
"""

import asyncio
import os
import threading
import time
import uuid
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Literal, Optional

import cv2
import numpy as np
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query, Request, status, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from supabase import Client, create_client

from vision_tracker import VideoStreamReader, VisionFSMTracker, normalize_camera_source

# 1. Khởi tạo cấu hình môi trường
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")

# Khởi tạo Supabase Client
supabase: Optional[Client] = None
if SUPABASE_URL and SUPABASE_KEY:
    try:
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    except Exception as e:
        print(f"[CẢNH BÁO] Không thể kết nối Supabase: {e}")

DEFAULT_CAMERA_SOURCE = os.getenv("CAMERA_SOURCE", "http://10.17.220.234:8080/video")
DEFAULT_COOLDOWN_SEC = float(os.getenv("VISION_COOLDOWN_SEC", "15.0"))

app = FastAPI(
    title="V-ARGON Action & Motion Tracking API",
    description="Microservice AI Vision & Cooldown Controller: Giám sát camera IP cho từng chuồng/vườn, tự động phát hiện hành vi tưới nước, cho ăn, bón phân.",
    version="2.0.0"
)

# Cho phép kết nối CORS an toàn (có thể cấu hình qua biến môi trường CORS_ORIGINS)
_raw_origins = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:3000,http://localhost:3001,http://127.0.0.1:3000,http://127.0.0.1:3001,https://dat-latitude-5590-2.tail2bda46.ts.net,https://dat-latitude-5590-2.tail2bda46.ts.net:8443"
)
_cors_origins = [o.strip() for o in _raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials="*" not in _cors_origins,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response

# Mount thư mục static cho Web Dashboard
STATIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")
os.makedirs(STATIC_DIR, exist_ok=True)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

# Bộ nhớ tạm lưu trữ action_logs trong RAM phòng khi bảng trên Supabase chưa sẵn sàng
_LOCAL_ACTION_LOGS: List[dict] = []

# ==============================================================================
# SCHEMAS (Pydantic Models)
# ==============================================================================

ActionType = Literal["WATERING", "FEEDING", "FERTILIZING"]
TriggerSource = Literal["AUTO", "MANUAL", "AI_VISION"]
ActionStatus = Literal["SUCCESS", "FAILED"]


class CameraConfigureRequest(BaseModel):
    target_id: str = Field(..., description="Mã định danh chuồng/vườn (VD: CHUONG_01, 123, PEN-B01)")
    source: str = Field(..., description="Địa chỉ IP Web Cam, RTSP hoặc index webcam (VD: http://192.168.1.15:8080/video hoặc 0)")
    stream_type: Optional[str] = Field("ipcam", description="Loại luồng: 'ipcam' (IP Cam điện thoại) hoặc 'webcam' (Webcam máy tính)")


class CameraStopRequest(BaseModel):
    target_id: str = Field(..., description="Mã định danh chuồng/vườn cần dừng camera")
    stream_type: Optional[str] = Field("all", description="Loại luồng cần dừng: 'ipcam', 'webcam', hoặc 'all'")


class TriggerRequest(BaseModel):
    action_type: ActionType
    trigger_source: Literal["AUTO", "MANUAL"]
    target_id: str
    duration_sec: Optional[int] = 10
    cooldown_seconds: Optional[int] = 7200


class TriggerResponse(BaseModel):
    allowed: bool
    status_code: Literal["APPROVED", "REJECTED_COOLDOWN", "MANUAL_BYPASS"]
    action_type: ActionType
    target_id: str
    trigger_source: str
    message: str
    last_action_time: Optional[str] = None
    last_action_source: Optional[str] = None


class ActionLogCreate(BaseModel):
    action_type: ActionType
    trigger_source: TriggerSource
    target_id: str
    duration_sec: Optional[int] = None
    status: ActionStatus = "SUCCESS"
    confidence_note: Optional[str] = None


class ActionLogResponse(BaseModel):
    success: bool
    message: str
    log_id: Optional[str] = None
    data: Optional[dict] = None


class ValidateActionRequest(BaseModel):
    target_id: str
    action_type: ActionType
    note: Optional[str] = None


# ==============================================================================
# LOGGING HELPER (SUPABASE + LOCAL RESILIENT STORAGE)
# ==============================================================================

def save_action_log(record: dict) -> dict:
    """Lưu trữ bản ghi hành động vào Supabase, tự động chuyển về RAM nếu Supabase chưa có bảng."""
    if not record.get("id"):
        record["id"] = str(uuid.uuid4())
    if not record.get("created_at"):
        record["created_at"] = datetime.now(timezone.utc).isoformat()

    inserted_row = None
    if supabase:
        try:
            res = supabase.table("action_logs").insert(record).execute()
            if res.data and len(res.data) > 0:
                inserted_row = res.data[0]
        except Exception as e:
            # Fallback nếu bảng action_logs chưa tồn tại
            # print(f"[LOG DB NOTICE] Supabase insert fallback: {e}")
            pass

    if not inserted_row:
        inserted_row = record

    # Luôn ghi nhận vào cache RAM để truy vấn siêu tốc và chống mất dữ liệu
    _LOCAL_ACTION_LOGS.insert(0, inserted_row)
    if len(_LOCAL_ACTION_LOGS) > 500:
        _LOCAL_ACTION_LOGS.pop()

    return inserted_row


def query_active_cooldown(target_id: str, action_type: str, cooldown_seconds: int) -> tuple[bool, Optional[dict]]:
    """Kiểm tra thời gian cooldown hành động thành công tại khu vực target_id."""
    cutoff_time = datetime.now(timezone.utc) - timedelta(seconds=cooldown_seconds)
    cutoff_iso = cutoff_time.isoformat()

    # 1. Thử truy vấn từ Supabase
    if supabase:
        try:
            res = supabase.table("action_logs") \
                .select("*") \
                .eq("target_id", target_id) \
                .eq("action_type", action_type) \
                .eq("status", "SUCCESS") \
                .gte("created_at", cutoff_iso) \
                .order("created_at", desc=True) \
                .limit(1) \
                .execute()
            if res.data and len(res.data) > 0:
                return True, res.data[0]
        except Exception:
            pass

    # 2. Fallback kiểm tra trong RAM
    for row in _LOCAL_ACTION_LOGS:
        if row.get("target_id") == target_id and row.get("action_type") == action_type and row.get("status") == "SUCCESS":
            created_at_str = row.get("created_at", "")
            try:
                dt = datetime.fromisoformat(created_at_str.replace("Z", "+00:00"))
                if dt >= cutoff_time:
                    return True, row
            except Exception:
                return True, row

    return False, None


# ==============================================================================
# MULTI-PEN CAMERA SESSION & TRACKER MANAGER
# ==============================================================================

class PenCameraSession:
    """Phiên quản lý luồng IP Camera / Webcam và AI Vision Tracker cho 1 chuồng/vườn cụ thể."""
    def __init__(self, target_id: str, source: str, stream_type: str = "ipcam"):
        self.target_id = target_id
        self.source = source
        self.stream_type = stream_type.strip().lower() if stream_type else "ipcam"
        self.reader: Optional[VideoStreamReader] = None
        self.tracker = VisionFSMTracker(
            target_id=target_id,
            cooldown_sec=DEFAULT_COOLDOWN_SEC,
            on_action_callback=self._handle_action_detected
        )
        self.current_frame: Optional[bytes] = None
        self.lock = threading.Lock()
        self.is_running = False
        self.last_accessed = time.time()
        self.worker_thread: Optional[threading.Thread] = None

    def _handle_action_detected(self, action: str, reason: str, target: str):
        """Callback lưu log khi Gemini VLM xác thực hành vi thành công."""
        stream_label = "IP Cam Điện Thoại" if self.stream_type == "ipcam" else "Webcam Máy Tính"
        record = {
            "action_type": action,
            "trigger_source": "AI_VISION",
            "target_id": target,
            "duration_sec": None,
            "status": "SUCCESS",
            "confidence_note": f"[{stream_label}] {reason}"
        }
        save_action_log(record)
        print(f"✅ [MULTI-CAM LOG - {stream_label}] Ghi nhận hành động {action} tại chuồng {target}")

    def start(self):
        with self.lock:
            if not self.is_running:
                try:
                    self.reader = VideoStreamReader(src=self.source, max_width=640).start()
                    self.is_running = True
                    self.worker_thread = threading.Thread(target=self._capture_loop, daemon=True)
                    self.worker_thread.start()
                    stream_label = "IP Cam Điện Thoại" if self.stream_type == "ipcam" else "Webcam Máy Tính"
                    print(f"📹 [PEN CAM - {stream_label}] Đã bật camera cho [{self.target_id}] từ nguồn: {self.source}")
                except Exception as e:
                    print(f"❌ [PEN CAM LỖI] Không thể bật camera [{self.target_id}]: {e}")

    def update_source(self, new_source: str):
        """Đổi IP Camera nguồn mà không cần tắt session."""
        if str(self.source) != str(new_source):
            print(f"🔄 [PEN CAM] Đổi nguồn camera của [{self.target_id}]: {self.source} -> {new_source}")
            self.stop()
            self.current_frame = None
            self.source = new_source
            self.start()

    def _capture_loop(self):
        target_interval = 1.0 / 30.0  # Mục tiêu 30 FPS thực tế
        while self.is_running:
            loop_start = time.perf_counter()
            self.last_accessed = time.time()
            if not self.reader:
                time.sleep(0.05)
                continue

            ret, frame = self.reader.read()
            if not ret or frame is None:
                time.sleep(0.01)
                continue

            # Xử lý khung xương và cập nhật FSM cho riêng chuồng này
            annotated = self.tracker.process_frame(frame)
            # Tối ưu kích thước JPEG và nén nhanh (Quality 52) cho truyền WAN/Internet siêu nhẹ và không nghẽn
            ret_enc, buffer = cv2.imencode('.jpg', annotated, [int(cv2.IMWRITE_JPEG_QUALITY), 52, int(cv2.IMWRITE_JPEG_OPTIMIZE), 0])
            if ret_enc:
                self.current_frame = buffer.tobytes()

            elapsed = time.perf_counter() - loop_start
            sleep_time = target_interval - elapsed
            if sleep_time > 0.001:
                time.sleep(sleep_time)

    def get_frame(self) -> Optional[bytes]:
        self.last_accessed = time.time()
        if not self.is_running:
            self.start()
        return self.current_frame

    def stop(self):
        self.is_running = False
        if self.reader:
            self.reader.release()
            self.reader = None
        print(f"🛑 [PEN CAM] Đã dừng camera [{self.target_id}] (luồng: {self.stream_type})")


class MultiCameraManager:
    """Quản lý độc lập toàn bộ các luồng camera cho từng chuồng/vườn (hỗ trợ cả IP Cam điện thoại và Webcam máy tính)."""
    def __init__(self):
        self.sessions: Dict[str, PenCameraSession] = {}
        self.lock = threading.Lock()

    @staticmethod
    def _make_key(target_id: str, stream_type: str = "ipcam") -> str:
        clean_target = (target_id or "DEFAULT").strip()
        clean_type = (stream_type or "ipcam").strip().lower()
        return f"{clean_target}:{clean_type}"

    def get_or_create(self, target_id: str, source: Optional[str] = None, stream_type: str = "ipcam") -> PenCameraSession:
        clean_target = (target_id or "DEFAULT").strip()
        clean_type = (stream_type or "ipcam").strip().lower()
        key = self._make_key(clean_target, clean_type)

        if clean_type == "webcam":
            default_src = os.getenv("WEBCAM_SOURCE", "0")
        else:
            default_src = DEFAULT_CAMERA_SOURCE

        raw_source = source.strip() if source and str(source).strip() else default_src
        clean_source = str(normalize_camera_source(raw_source))

        with self.lock:
            session = self.sessions.get(key)
            if not session:
                session = PenCameraSession(target_id=clean_target, source=clean_source, stream_type=clean_type)
                self.sessions[key] = session
                session.start()
            elif source and str(session.source).strip() != clean_source:
                session.update_source(clean_source)
            elif not session.is_running:
                session.start()
            return session

    def stop_pen_camera(self, target_id: str, stream_type: str = "all"):
        clean_target = (target_id or "DEFAULT").strip()
        clean_type = (stream_type or "all").strip().lower()

        with self.lock:
            keys_to_remove = []
            for k, sess in self.sessions.items():
                if clean_type == "all":
                    if k == clean_target or k.startswith(f"{clean_target}:"):
                        keys_to_remove.append(k)
                else:
                    if k == f"{clean_target}:{clean_type}":
                        keys_to_remove.append(k)

            for k in keys_to_remove:
                sess = self.sessions.pop(k, None)
                if sess:
                    sess.stop()

    def get_status(self, target_id: str, stream_type: str = "ipcam") -> dict:
        clean_target = (target_id or "DEFAULT").strip()
        clean_type = (stream_type or "ipcam").strip().lower()
        key = self._make_key(clean_target, clean_type)

        session = self.sessions.get(key)
        if not session and clean_type == "ipcam":
            session = self.sessions.get(clean_target)

        if not session:
            default_src = os.getenv("WEBCAM_SOURCE", "0") if clean_type == "webcam" else DEFAULT_CAMERA_SOURCE
            stream_name = "Webcam Máy Tính" if clean_type == "webcam" else "IP Cam Điện Thoại"
            return {
                "target_id": clean_target,
                "stream_type": clean_type,
                "is_running": False,
                "camera_source": default_src,
                "fsm_state": "IDLE",
                "is_occluded": False,
                "cooldown_remaining": 0.0,
                "last_action": f"Chưa kết nối {stream_name}",
                "last_action_reason": f"Bật {stream_name} để AI nhận diện tư thế",
                "metrics": {
                    "hip_vis": 0.0,
                    "wrist_vis": 0.0,
                    "head_drop": 0.0,
                    "torso_angle": 180.0,
                    "wrist_reach": 0.0,
                    "is_bending": False,
                    "is_occluded": False
                }
            }

        curr = time.time()
        cd_left = max(0.0, session.tracker.cooldown_sec - (curr - session.tracker.last_trigger_time))
        return {
            "target_id": clean_target,
            "stream_type": session.stream_type,
            "is_running": session.is_running,
            "camera_source": session.source,
            "fsm_state": session.tracker.fsm_state,
            "is_occluded": session.tracker.is_occluded,
            "cooldown_remaining": round(cd_left, 1),
            "last_action": session.tracker.last_action_text,
            "last_action_reason": session.tracker.last_action_reason,
            "metrics": session.tracker.metrics
        }


multi_camera_manager = MultiCameraManager()

_PLACEHOLDER_CACHE: Dict[str, bytes] = {}

def create_placeholder_frame(target_id: str, message: str = "Đang kết nối camera...", stream_type: str = "ipcam") -> bytes:
    stream_label = "Webcam May Tinh" if stream_type == "webcam" else "IP Cam Dien Thoai"
    key = f"{target_id}_{stream_type}_{message}"
    if key in _PLACEHOLDER_CACHE:
        return _PLACEHOLDER_CACHE[key]
    
    img = np.zeros((480, 640, 3), dtype=np.uint8)
    img[:] = (24, 24, 27)  # Dark slate background
    cv2.putText(img, f"V-ARGON AI VISION - [{stream_label.upper()}]", (30, 150), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (16, 185, 129), 2)
    cv2.putText(img, f"Khu vuc: {target_id}", (30, 200), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
    cv2.putText(img, message, (30, 250), cv2.FONT_HERSHEY_SIMPLEX, 0.52, (200, 200, 200), 1)
    cv2.putText(img, f"Dang dong bo luong {stream_label} voi AI...", (30, 300), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (130, 130, 130), 1)
    
    ret, buf = cv2.imencode('.jpg', img, [int(cv2.IMWRITE_JPEG_QUALITY), 75])
    if ret:
        _PLACEHOLDER_CACHE[key] = buf.tobytes()
        return _PLACEHOLDER_CACHE[key]
    return b""


# ==============================================================================
# API ENDPOINTS (SEPARATE ISOLATED MICROSERVICE - PORT 8002)
# ==============================================================================

@app.get("/")
def serve_dashboard():
    """Giao diện Dashboard kiểm thử trực quan độc lập của module Action Tracking."""
    index_path = os.path.join(STATIC_DIR, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {
        "service": "V-ARGON Action & Motion Tracking API",
        "status": "online",
        "version": "2.0.0",
        "note": "Web dashboard static/index.html not found."
    }


@app.get("/health")
def health_check():
    """Kiểm tra sức khỏe dịch vụ Action Tracking API độc lập."""
    return {
        "status": "healthy",
        "service": "action_vision_engine",
        "version": "2.0.0",
        "port": 8002,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "active_pens": list(multi_camera_manager.sessions.keys()),
        "supabase_connected": supabase is not None
    }


@app.websocket("/ws/video_feed")
async def websocket_video_feed(
    websocket: WebSocket,
    target_id: Optional[str] = None,
    source: Optional[str] = None,
    stream_type: Optional[str] = None
):
    """
    Endpoint phát luồng Video trực tiếp qua giao thức WebSocket (Binary JPEG Frames).
    - Giải quyết triệt để vấn đề Buffer Bloat / nghẽn mạng tích tụ trên Tailscale Funnel.
    - Zero-Lag / Tự động drop frame: Client luôn luôn nhận khung hình mới nhất mà không bị xếp hàng.
    - Bảo mật & Mã hóa: Truyền qua WSS (wss://) được mã hóa TLS 1.3 End-to-End tuyệt đối.
    """
    await websocket.accept()
    qp = websocket.query_params
    clean_target = (target_id or qp.get("target_id") or "DEFAULT").strip()
    clean_type = (stream_type or qp.get("stream_type") or "ipcam").strip().lower()
    clean_src = source or qp.get("source") or None

    session = await asyncio.to_thread(
        multi_camera_manager.get_or_create,
        target_id=clean_target,
        source=clean_src,
        stream_type=clean_type
    )
    stream_label = "IP Cam Điện Thoại" if clean_type == "ipcam" else "Webcam Máy Tính"
    print(f"🔌 [WS VIDEO KẾT NỐI] Chuồng [{clean_target}] - Luồng {stream_label} - Nguồn: {session.source}")

    # Lắng nghe ngắt kết nối hoặc tin nhắn ACK từ client để điều tiết lưu lượng Zero-Lag (tối đa 2 frame trên đường truyền)
    max_in_flight = 2
    credits = max_in_flight
    ack_event = asyncio.Event()
    ack_event.set()
    client_uses_ack = False

    async def listen_client():
        nonlocal client_uses_ack, credits
        try:
            while True:
                msg = await websocket.receive_text()
                if msg in ("ack", "next"):
                    client_uses_ack = True
                    credits = min(max_in_flight, credits + 1)
                    ack_event.set()
        except Exception:
            pass

    recv_task = asyncio.create_task(listen_client())
    last_sent_frame: Optional[bytes] = None

    try:
        while not recv_task.done():
            if client_uses_ack and credits <= 0:
                ack_event.clear()
                try:
                    await asyncio.wait_for(ack_event.wait(), timeout=0.5)
                except asyncio.TimeoutError:
                    credits = 1

            frame_bytes = session.get_frame()
            if not frame_bytes:
                err_msg = getattr(session.reader, "last_error", None) if session.reader else None
                status_text = (
                    f"Chua ket noi duoc IP Cam ({session.source})"
                    if err_msg
                    else f"Dang ket noi: {session.source}"
                )
                frame_bytes = create_placeholder_frame(
                    clean_target,
                    status_text,
                    stream_type=clean_type
                )
            elif frame_bytes is last_sent_frame:
                await asyncio.sleep(0.005)
                continue

            if client_uses_ack:
                credits = max(0, credits - 1)

            # Gửi frame dưới dạng Binary nguyên bản (Không có HTTP Header thừa)
            await websocket.send_bytes(frame_bytes)
            last_sent_frame = frame_bytes

            if not client_uses_ack:
                # Fallback nhịp ~30 FPS cho client cũ chưa gửi ACK
                await asyncio.sleep(0.033)
    except (WebSocketDisconnect, ConnectionResetError):
        print(f"🔌 [WS VIDEO NGẮT] Chuồng [{clean_target}] - Luồng {stream_label} đã đóng.")
    except Exception as e:
        print(f"⚠️ [WS VIDEO LỖI] Chuồng [{clean_target}]: {e}")
    finally:
        if not recv_task.done():
            recv_task.cancel()


@app.websocket("/ws/video_feed/{target_id}")
async def websocket_video_feed_by_path(
    websocket: WebSocket,
    target_id: str,
    source: Optional[str] = None,
    stream_type: Optional[str] = None
):
    """Alias WebSocket hỗ trợ truyền target_id ngay trên path URL."""
    await websocket_video_feed(
        websocket=websocket,
        target_id=target_id,
        source=source,
        stream_type=stream_type
    )


@app.get("/api/tracker/status")
def get_tracker_status(
    target_id: str = Query("DEFAULT", description="Mã chuồng/vườn cần lấy thông số FSM"),
    stream_type: str = Query("ipcam", description="Loại luồng: 'ipcam' hoặc 'webcam'")
):
    """Lấy trạng thái Máy trạng thái hữu hạn (FSM) và chỉ số realtime của chuồng/vườn chỉ định."""
    return multi_camera_manager.get_status(target_id=target_id, stream_type=stream_type)


@app.post("/api/camera/configure")
def configure_pen_camera(req: CameraConfigureRequest):
    """Thiết lập hoặc đổi địa chỉ IP Camera hoặc Webcam tùy chỉnh cho chuồng/vườn."""
    stream_type = (req.stream_type or "ipcam").strip().lower()
    try:
        session = multi_camera_manager.get_or_create(target_id=req.target_id, source=req.source, stream_type=stream_type)
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    stream_label = "IP Cam Điện Thoại" if stream_type == "ipcam" else "Webcam Máy Tính"
    return {
        "success": True,
        "message": f"Đã cấu hình {stream_label} cho [{req.target_id}]: {req.source}",
        "target_id": req.target_id,
        "stream_type": stream_type,
        "source": req.source,
        "is_running": session.is_running
    }


@app.post("/api/camera/stop")
def stop_pen_camera(req: CameraStopRequest):
    """Dừng luồng camera (IP Cam hoặc Webcam hoặc cả hai) của chuồng/vườn chỉ định."""
    stream_type = (req.stream_type or "all").strip().lower()
    multi_camera_manager.stop_pen_camera(target_id=req.target_id, stream_type=stream_type)
    return {
        "success": True,
        "message": f"Đã dừng camera chuồng [{req.target_id}] (luồng: {stream_type}) thành công."
    }


@app.get("/api/camera/snapshot")
def get_camera_snapshot(
    target_id: str = Query("DEFAULT", description="Mã chuồng/vườn"),
    stream_type: str = Query("ipcam", description="Loại luồng: 'ipcam' hoặc 'webcam'")
):
    """Chụp 1 khung hình JPEG tĩnh từ camera chuồng chỉ định."""
    session = multi_camera_manager.get_or_create(target_id=target_id, stream_type=stream_type)
    frame_bytes = session.get_frame()
    if not frame_bytes:
        frame_bytes = create_placeholder_frame(target_id, f"Chưa kết nối: {session.source}", stream_type=stream_type)
    return Response(content=frame_bytes, media_type="image/jpeg")


@app.post("/api/actions/trigger", response_model=TriggerResponse)
def handle_action_trigger(req: TriggerRequest):
    """Xử lý yêu cầu kích hoạt lệnh từ hệ thống AUTO hoặc người dùng MANUAL."""
    # 1. Logic AUTO: Kiểm tra Cooldown
    if req.trigger_source == "AUTO":
        is_cooling, last_log = query_active_cooldown(
            target_id=req.target_id,
            action_type=req.action_type,
            cooldown_seconds=req.cooldown_seconds or 7200
        )

        if is_cooling and last_log:
            last_created = last_log.get("created_at")
            last_source = last_log.get("trigger_source")
            return TriggerResponse(
                allowed=False,
                status_code="REJECTED_COOLDOWN",
                action_type=req.action_type,
                target_id=req.target_id,
                trigger_source=req.trigger_source,
                message=(
                    f"Từ chối lệnh AUTO: {req.action_type} tại {req.target_id} đã thực hiện lúc {last_created} "
                    f"(Nguồn: {last_source}). Đang trong Cooldown ({req.cooldown_seconds}s) để chống dư thừa."
                ),
                last_action_time=last_created,
                last_action_source=last_source
            )

        return TriggerResponse(
            allowed=True,
            status_code="APPROVED",
            action_type=req.action_type,
            target_id=req.target_id,
            trigger_source=req.trigger_source,
            message="Chấp thuận lệnh AUTO: Đã kiểm tra Cooldown hợp lệ, cho phép kích hoạt thiết bị."
        )

    # 2. Logic MANUAL: Bypass Cooldown
    return TriggerResponse(
        allowed=True,
        status_code="MANUAL_BYPASS",
        action_type=req.action_type,
        target_id=req.target_id,
        trigger_source=req.trigger_source,
        message="Chấp thuận lệnh MANUAL: Người vận hành ép chạy (Bypass Cooldown kiểm tra)."
    )


@app.post("/api/actions/log", response_model=ActionLogResponse)
def log_action_result(payload: ActionLogCreate):
    """Lưu trữ kết quả kiểm chứng hành động từ IP Camera AI Vision vào hệ thống."""
    record = {
        "action_type": payload.action_type,
        "trigger_source": payload.trigger_source,
        "target_id": payload.target_id,
        "duration_sec": payload.duration_sec,
        "status": payload.status,
        "confidence_note": payload.confidence_note
    }

    try:
        inserted = save_action_log(record)
        return ActionLogResponse(
            success=True,
            message=f"Đã ghi nhận log thành công: {payload.action_type} [{payload.status}]",
            log_id=str(inserted.get("id")),
            data=inserted
        )
    except Exception as e:
        print(f"[ACTION LOG ERROR] {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Lỗi hệ thống khi lưu log hành động."
        )


@app.post("/api/actions/validate", response_model=ActionLogResponse)
def validate_action_from_ip_cam(req: ValidateActionRequest):
    """Kiểm tra và xác thực nhanh hành động cho IP Web Cam (thay thế giả lập ESP32)."""
    note = req.note or f"IP Web Cam AI Vision: Đã xác thực thành công hành vi {req.action_type} tại {req.target_id}"
    log_req = ActionLogCreate(
        action_type=req.action_type,
        trigger_source="AI_VISION",
        target_id=req.target_id,
        duration_sec=10,
        status="SUCCESS",
        confidence_note=note
    )
    return log_action_result(log_req)


@app.get("/api/actions/logs")
def get_recent_action_logs(
    target_id: Optional[str] = Query(None, description="Lọc theo target_id của chuồng/vườn"),
    action_type: Optional[ActionType] = Query(None, description="Lọc theo loại hành động"),
    limit: int = Query(20, ge=1, le=100, description="Số lượng bản ghi tối đa")
):
    """Truy vấn lịch sử hành động cho chuồng/vườn cụ thể."""
    # 1. Thử truy vấn từ Supabase
    if supabase:
        try:
            query = supabase.table("action_logs").select("*").order("created_at", desc=True).limit(limit)
            if target_id:
                query = query.eq("target_id", target_id)
            if action_type:
                query = query.eq("action_type", action_type)

            result = query.execute()
            if result.data is not None and len(result.data) > 0:
                return {"count": len(result.data), "data": result.data, "source": "supabase"}
        except Exception:
            pass

    # 2. Fallback từ bộ nhớ RAM
    filtered = []
    for r in _LOCAL_ACTION_LOGS:
        if target_id and r.get("target_id") != target_id:
            continue
        if action_type and r.get("action_type") != action_type:
            continue
        filtered.append(r)
        if len(filtered) >= limit:
            break

    return {"count": len(filtered), "data": filtered, "source": "local_memory"}


if __name__ == "__main__":
    import uvicorn
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", 8002))
    print(f"🚀 Khởi động V-ARGON Action & Motion Tracking API tại http://{host}:{port}")
    uvicorn.run("main:app", host=host, port=port, reload=True)
