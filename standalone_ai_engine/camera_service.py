# -*- coding: utf-8 -*-
"""
CAMERA STREAM SERVICE — QUẢN LÝ LUỒNG CAMERA VÀ PHÂN TÍCH THỜI GIAN THỰC
camera_service.py

Tính năng:
- Thu nhận luồng camera thời gian thực (Webcam/RTSP) đa luồng (Multi-threaded).
- Chạy suy luận AI (Nhận diện khuôn mặt, Anti-spoofing, Đồng phục) bất đồng bộ (Zero-lag).
- Phát luồng video MJPEG (chuẩn HTTP Streaming) để nhúng trực tiếp vào Web HTML/img.
- Cung cấp API trạng thái, dữ liệu telemetries (FPS, MSSV, tên, đồng phục) theo thời gian thực.
"""
import cv2
import ipaddress
import socket
import time
import threading
from urllib.parse import urlparse
import numpy as np
from typing import Optional, Union, Dict, Any, Generator
from standalone_runner import StandaloneVisionPipeline


def validate_camera_source(source: Union[int, str]) -> Union[int, str]:
    """Validate camera source to prevent SSRF (loopback/metadata) and local file read."""
    raw = str(source).strip() if source is not None else "0"
    if not raw:
        return 0
    if raw.isdigit():
        idx = int(raw)
        if 0 <= idx <= 16:
            return idx
        raise ValueError("Chỉ số webcam không hợp lệ (chỉ hỗ trợ 0-16).")

    parsed = urlparse(raw)
    if parsed.scheme.lower() not in ("http", "https", "rtsp", "rtmp"):
        raise ValueError("Chỉ hỗ trợ nguồn camera http, https, rtsp, rtmp hoặc chỉ số webcam.")

    hostname = (parsed.hostname or "").strip().lower()
    if not hostname:
        raise ValueError("Địa chỉ camera thiếu hostname.")
    if hostname in ("localhost", "metadata.google.internal", "metadata"):
        raise ValueError("Không cho phép kết nối camera tới địa chỉ nội bộ/metadata.")

    try:
        ip_obj = ipaddress.ip_address(hostname)
        if ip_obj.is_loopback or ip_obj.is_link_local or ip_obj.is_unspecified:
            raise ValueError("Không cho phép kết nối camera tới loopback hoặc link-local/metadata IP.")
    except ValueError as exc:
        if "Không cho phép" in str(exc):
            raise
        try:
            for info in socket.getaddrinfo(hostname, None):
                resolved_ip = ipaddress.ip_address(info[4][0])
                if resolved_ip.is_loopback or resolved_ip.is_link_local or resolved_ip.is_unspecified:
                    raise ValueError("Hostname camera phân giải tới địa chỉ bị chặn (loopback/metadata).")
        except socket.gaierror:
            pass
    return raw


class CameraStreamService:
    def __init__(self, pipeline: StandaloneVisionPipeline):
        self.pipeline = pipeline
        self.source: Union[int, str] = 0
        self.weekday_override: Optional[int] = None

        self.cap: Optional[cv2.VideoCapture] = None
        self.is_running: bool = False
        self.lock = threading.Lock()

        self.latest_raw_frame: Optional[np.ndarray] = None
        self.latest_result: Dict[str, Any] = {
            "status": "idle",
            "faces_detected": 0,
            "faces": [],
            "uniform": None,
            "process_time_ms": 0.0
        }

        self.latest_jpeg: Optional[bytes] = None
        self.latest_raw_jpeg: Optional[bytes] = None

        self.capture_fps: float = 0.0
        self.ai_fps: float = 0.0
        self.last_ai_time_ms: float = 0.0
        self.error_message: Optional[str] = None

        self._capture_thread: Optional[threading.Thread] = None
        self._ai_thread: Optional[threading.Thread] = None

    def start(self, source: Union[int, str] = 0, weekday_override: Optional[int] = None) -> bool:
        """Khởi động luồng camera và tiến trình AI nền."""
        src_val = validate_camera_source(source)

        with self.lock:
            if self.is_running and self.source == src_val:
                self.weekday_override = weekday_override
                return True

        # Nếu đang chạy nguồn khác thì dừng trước
        if self.is_running:
            self.stop()

        self.source = src_val
        self.weekday_override = weekday_override
        self.error_message = None

        print(f"[CAM SERVICE] Đang kết nối tới nguồn camera: {self.source}...")
        if isinstance(self.source, int) and hasattr(cv2, "CAP_V4L2"):
            cap = cv2.VideoCapture(self.source, cv2.CAP_V4L2)
            if not cap.isOpened():
                cap = cv2.VideoCapture(self.source)
        else:
            cap = cv2.VideoCapture(self.source)
        if not cap.isOpened():
            self.error_message = f"Không thể mở nguồn camera: {self.source}"
            print(f"[CAM SERVICE ERROR] {self.error_message}")
            return False

        # Tối ưu kích thước, định dạng MJPG (tránh nghẽn băng thông USB YUYV 10-15 FPS) và buffer
        if isinstance(self.source, int):
            cap.set(cv2.CAP_PROP_FOURCC, cv2.VideoWriter_fourcc(*"MJPG"))
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
        cap.set(cv2.CAP_PROP_FPS, 30)
        cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

        self.cap = cap
        self.is_running = True

        self._capture_thread = threading.Thread(target=self._capture_loop, daemon=True)
        self._ai_thread = threading.Thread(target=self._ai_worker_loop, daemon=True)

        self._capture_thread.start()
        self._ai_thread.start()
        print(f"[CAM SERVICE] Đã bật camera thành công: {self.source}")
        return True

    def stop(self):
        """Dừng thu luồng camera và giải phóng tài nguyên."""
        self.is_running = False

        if self._capture_thread and self._capture_thread.is_alive():
            self._capture_thread.join(timeout=1.0)
        if self._ai_thread and self._ai_thread.is_alive():
            self._ai_thread.join(timeout=1.0)

        with self.lock:
            if self.cap is not None:
                try:
                    self.cap.release()
                except Exception:
                    pass
                self.cap = None
            self.latest_raw_frame = None
            self.latest_jpeg = None
            self.latest_raw_jpeg = None
            self.capture_fps = 0.0
            self.ai_fps = 0.0

        print("[CAM SERVICE] Đã dừng camera.")

    def _capture_loop(self):
        """Luồng thu nhận khung hình tốc độ cao (30 FPS) và mã hóa JPEG stream tối ưu."""
        frame_count = 0
        start_time = time.time()
        target_interval = 1.0 / 30.0
        encode_params = [int(cv2.IMWRITE_JPEG_QUALITY), 50, int(cv2.IMWRITE_JPEG_OPTIMIZE), 0]

        while self.is_running and self.cap is not None:
            loop_start = time.perf_counter()
            ret, frame = self.cap.read()
            if not ret or frame is None:
                time.sleep(0.005)
                continue

            # Chuẩn hóa độ phân giải tối đa 640px để giảm độ trễ & tải CPU
            h, w = frame.shape[:2]
            if w > 640:
                scale = 640.0 / w
                frame = cv2.resize(frame, (640, int(h * scale)), interpolation=cv2.INTER_LINEAR)

            with self.lock:
                self.latest_raw_frame = frame
                res = self.latest_result

            # Vẽ HUD nhận diện lên khung hình
            annotated = self.pipeline.draw_hud(frame, res)

            # Mã hóa JPEG nhẹ tối ưu băng thông internet và giảm triệt để độ trễ
            _, hud_jpg = cv2.imencode(".jpg", annotated, encode_params)

            with self.lock:
                self.latest_jpeg = hud_jpg.tobytes()

            frame_count += 1
            now = time.time()
            elapsed = now - start_time
            if elapsed >= 1.0:
                self.capture_fps = round(frame_count / elapsed, 1)
                frame_count = 0
                start_time = now

            loop_elapsed = time.perf_counter() - loop_start
            sleep_time = target_interval - loop_elapsed
            if sleep_time > 0.001:
                time.sleep(sleep_time)

    def _ai_worker_loop(self):
        """Luồng xử lý AI bất đồng bộ tốc độ cao (Zero-lag)."""
        ai_count = 0
        start_time = time.time()

        while self.is_running:
            frame_to_process = None
            with self.lock:
                if self.latest_raw_frame is not None:
                    frame_to_process = self.latest_raw_frame.copy()

            if frame_to_process is None:
                time.sleep(0.01)
                continue

            t0 = time.time()
            try:
                res = self.pipeline.process_frame(
                    frame_to_process,
                    weekday_override=self.weekday_override
                )
                dt = (time.time() - t0) * 1000
                with self.lock:
                    self.latest_result = res
                    self.last_ai_time_ms = round(dt, 1)
            except Exception as e:
                print(f"[CAM SERVICE AI ERROR] {e}")

            ai_count += 1
            now = time.time()
            elapsed = now - start_time
            if elapsed >= 1.0:
                self.ai_fps = round(ai_count / elapsed, 1)
                ai_count = 0
                start_time = now

            # Nghỉ hợp lý để không chiếm hết CPU/GIL của luồng stream video (~3-4 AI scans/s là dư dùng cho điểm danh)
            time.sleep(0.08)

    def get_status(self) -> Dict[str, Any]:
        """Lấy thông tin trạng thái dịch vụ và số liệu telemetries."""
        with self.lock:
            return {
                "is_running": self.is_running,
                "source": self.source,
                "weekday_override": self.weekday_override,
                "capture_fps": self.capture_fps,
                "ai_fps": self.ai_fps,
                "process_time_ms": self.last_ai_time_ms,
                "error": self.error_message,
                "faces_detected": self.latest_result.get("faces_detected", 0)
            }

    def get_latest_result(self) -> Dict[str, Any]:
        """Lấy kết quả nhận diện và đồng phục mới nhất."""
        with self.lock:
            res = dict(self.latest_result)
            res["capture_fps"] = self.capture_fps
            res["ai_fps"] = self.ai_fps
            res["is_running"] = self.is_running
            return res

    def get_snapshot(self, overlay: bool = True) -> Optional[bytes]:
        """Chụp 1 ảnh tĩnh tức thời từ luồng camera."""
        with self.lock:
            if overlay and self.latest_jpeg is not None:
                return self.latest_jpeg
            if self.latest_raw_frame is not None:
                _, raw = cv2.imencode(".jpg", self.latest_raw_frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
                return raw.tobytes()
            return self.latest_jpeg

    def generate_mjpeg(self, overlay: bool = True) -> Generator[bytes, None, None]:
        """Tạo luồng multipart/x-mixed-replace cho thẻ <img> hoặc trình duyệt kèm Content-Length."""
        while self.is_running:
            with self.lock:
                frame_bytes = self.latest_jpeg if overlay else self.latest_raw_jpeg

            if frame_bytes is not None:
                yield (b"--frame\r\n"
                       b"Content-Type: image/jpeg\r\n"
                       b"Content-Length: " + str(len(frame_bytes)).encode("ascii") + b"\r\n\r\n"
                       + frame_bytes + b"\r\n")
            time.sleep(0.042)  # Giới hạn ~24 FPS mượt mà cho truyền Internet không bị nghẽn buffer
