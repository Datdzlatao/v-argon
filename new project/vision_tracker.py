"""
==============================================================================
DỰ ÁN NÔNG NGHIỆP THÔNG MINH V-ARGON
Phân hệ: Action Tracking & Hybrid AI Vision
File: vision_tracker.py (Edge-to-Cloud Hybrid AI Vision Tracker)
==============================================================================
Nguyên lý thiết kế (Andrej Karpathy Guidelines):
- Tối giản, không speculative abstractions.
- Máy trạng thái hữu hạn (FSM) lọc 99% khung hình vô nghĩa tại Edge.
- Chỉ gọi Cloud VLM (Gemini) vào "Khoảnh khắc vàng" (Golden Trigger).
- Debug HUD trực quan ngay trên luồng video để căn chỉnh threshold dễ dàng.
==============================================================================
"""

import argparse
import json
import math
import os
import threading
import time
from typing import Dict, Optional, Tuple

import cv2
import numpy as np
import requests
from dotenv import load_dotenv
from PIL import Image

# Tải cấu hình môi trường (.env)
load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL_NAME = os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite")
BACKEND_LOG_URL = os.getenv("BACKEND_LOG_URL", "http://localhost:8002/api/actions/log")

# ==============================================================================
# KHỞI TẠO MEDIAPIPE POSE LANDMARKER (Hỗ trợ cả Tasks API & Legacy Solutions)
# ==============================================================================
try:
    import mediapipe as mp
    from mediapipe.tasks import python as mp_python
    from mediapipe.tasks.python import vision as mp_vision

    # Kiểm tra file model task cho mediapipe tasks API
    MODEL_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "pose_landmarker_lite.task")
    if not os.path.exists(MODEL_PATH):
        # Tải tự động nếu chưa có
        print("[AI VISION] Đang tải mô hình pose_landmarker_lite.task từ Google CDN...")
        import urllib.request
        cdn_url = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task"
        urllib.request.urlretrieve(cdn_url, MODEL_PATH)

    base_options = mp_python.BaseOptions(model_asset_path=MODEL_PATH)
    options = mp_vision.PoseLandmarkerOptions(
        base_options=base_options,
        output_segmentation_masks=False,
        min_pose_detection_confidence=0.5,
        min_tracking_confidence=0.5
    )
    pose_detector = mp_vision.PoseLandmarker.create_from_options(options)
    USE_TASKS_API = True
    print("[AI VISION] Đã khởi tạo MediaPipe PoseLandmarker (Tasks API) thành công.")
except Exception as e:
    print(f"[AI VISION] Chuyển sang chế độ MediaPipe Legacy Solutions: {e}")
    import mediapipe as mp
    mp_pose = mp.solutions.pose
    pose_detector = mp_pose.Pose(
        min_detection_confidence=0.5,
        min_tracking_confidence=0.5,
        model_complexity=1
    )
    USE_TASKS_API = False

# ==============================================================================
# KHỞI TẠO GEMINI CLIENT
# ==============================================================================
gemini_client = None
try:
    # Ưu tiên google.genai hiện đại
    from google import genai
    gemini_client = genai.Client(api_key=GEMINI_API_KEY)
    print(f"[AI VISION] Đã kết nối Gemini Client (google.genai SDK) - Model: {GEMINI_MODEL_NAME}")
except ImportError:
    try:
        import google.generativeai as genai_legacy
        genai_legacy.configure(api_key=GEMINI_API_KEY)
        gemini_client = genai_legacy.GenerativeModel(GEMINI_MODEL_NAME)
        print(f"[AI VISION] Đã kết nối Gemini Client (google-generativeai SDK) - Model: {GEMINI_MODEL_NAME}")
    except Exception as e:
        print(f"[CẢNH BÁO] Không thể khởi tạo Gemini Client: {e}")


# ==============================================================================
# HÀM HÌNH HỌC TÍNH TOÁN TƯ THẾ (POSTURE GEOMETRY)
# ==============================================================================

def calculate_angle_3points(p1: Tuple[float, float], p2: Tuple[float, float], p3: Tuple[float, float]) -> float:
    """
    Tính góc tạo bởi 3 điểm p1 - p2 - p3 (p2 là đỉnh góc).
    Ví dụ: SHOULDER(p1) - HIP(p2) - KNEE(p3).
    Góc mở đứng thẳng ~ 170°-180°, gập người < 120°.
    """
    v1 = (p1[0] - p2[0], p1[1] - p2[1])
    v2 = (p3[0] - p2[0], p3[1] - p2[1])
    
    dot = v1[0] * v2[0] + v1[1] * v2[1]
    mag1 = math.sqrt(v1[0]**2 + v1[1]**2)
    mag2 = math.sqrt(v2[0]**2 + v2[1]**2)

    if mag1 * mag2 == 0:
        return 180.0
    
    cos_theta = max(min(dot / (mag1 * mag2), 1.0), -1.0)
    angle_deg = math.degrees(math.acos(cos_theta))
    return angle_deg


# ==============================================================================
# GỬI ẢNH PHÂN TÍCH NGỮ CẢNH BẰNG GEMINI 1.5 FLASH / 3.5 FLASH (CLOUD VLM)
# ==============================================================================

VLM_SYSTEM_PROMPT = """
Bạn là hệ thống AI giám sát nông nghiệp thông minh V-ARGON.
Nhiệm vụ: Phân tích bức ảnh chụp người nông dân và xác định CHÍNH XÁC hành vi đang diễn ra.

QUY TẮC PHÂN BIỆT:
1. "WATERING": Cầm ô doa, vòi nước, kéo dây tưới và đang cúi người hướng vòi tưới xuống luống cây/đất.
2. "FERTILIZING": Cầm bao tải hoặc xô/chậu + cúi người thò tay bốc/vãi/rắc phân xuống đất hoặc gốc cây.
3. "FEEDING": Cầm xô/thau thức ăn + cúi người nghiêng đổ cám vào máng ăn cho gia súc/thủy sản.
4. "UNKNOWN": Người chỉ đi ngang qua, đứng nghỉ, quét dọn, cầm vật nhưng KHÔNG thực hiện thao tác chăm sóc.

YÊU CẦU ĐẦU RA:
BẮT BUỘC chỉ trả về duy nhất 1 JSON object thuần túy (không markdown, không ```json, không giải thích bên ngoài):
{"action": "WATERING" | "FERTILIZING" | "FEEDING" | "UNKNOWN", "reason": "Mô tả ngắn gọn bằng tiếng Việt dưới 20 từ"}
"""

def analyze_action_with_gemini(frame_bgr: np.ndarray) -> Optional[Dict[str, str]]:
    """Gửi khung hình lên Gemini VLM để phân tích ngữ cảnh."""
    if not gemini_client:
        print("[VLM] Gemini client chưa được cấu hình!")
        return None

    # Chuyển đổi khung hình BGR sang RGB dạng PIL Image
    rgb_frame = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
    pil_img = Image.fromarray(rgb_frame)

    try:
        raw_text = ""
        # 1. Gọi qua modern google.genai SDK
        if hasattr(gemini_client, "models"):
            resp = gemini_client.models.generate_content(
                model=GEMINI_MODEL_NAME,
                contents=[pil_img, VLM_SYSTEM_PROMPT]
            )
            raw_text = resp.text
        # 2. Hoặc qua legacy google.generativeai SDK
        elif hasattr(gemini_client, "generate_content"):
            resp = gemini_client.generate_content([VLM_SYSTEM_PROMPT, pil_img])
            raw_text = resp.text

        # Chuẩn hóa chuỗi JSON đầu ra
        raw_text = raw_text.strip()
        if raw_text.startswith("```json"):
            raw_text = raw_text.replace("```json", "", 1).rsplit("```", 1)[0].strip()
        elif raw_text.startswith("```"):
            raw_text = raw_text.replace("```", "", 1).rsplit("```", 1)[0].strip()

        data = json.loads(raw_text)
        action = data.get("action", "UNKNOWN")
        reason = data.get("reason", "")
        return {"action": action, "reason": reason}

    except Exception as e:
        print(f"[VLM LỖI] Gọi Gemini thất bại: {e}")
        return None


def post_action_log(action_type: str, reason: str, target_id: str = "GARDEN_01"):
    """Gọi HTTP POST sang FastAPI backend để ghi log vào Supabase."""
    payload = {
        "action_type": action_type,
        "trigger_source": "AI_VISION",
        "target_id": target_id,
        "duration_sec": None,
        "status": "SUCCESS",
        "confidence_note": reason
    }
    try:
        res = requests.post(BACKEND_LOG_URL, json=payload, timeout=5)
        if res.status_code == 200:
            print(f"✅ [API LOG THÀNH CÔNG] {action_type} -> Supabase ID: {res.json().get('log_id')}")
        else:
            print(f"⚠️ [API LOG THẤT BẠI] Status {res.status_code}: {res.text}")
    except Exception as e:
        print(f"❌ [API LOG LỖI KẾT NỐI] Không thể kết nối tới Backend: {e}")


# ==============================================================================
# HÀM VẼ KHUNG XƯƠNG VÀ HUD DEBUG TRỰC QUAN (OPENCV DRAWING)
# ==============================================================================

SKELETON_PAIRS = [
    (0, 11), (0, 12),           # Mũi tới 2 vai
    (11, 12),                   # Giữa 2 vai
    (11, 13), (13, 15),         # Cánh tay trái: Vai -> Khuỷu -> Cổ tay
    (12, 14), (14, 16),         # Cánh tay phải: Vai -> Khuỷu -> Cổ tay
    (11, 23), (12, 24),         # Vai tới Hông
    (23, 24),                   # Giữa 2 Hông
    (23, 25), (25, 27),         # Chân trái: Hông -> Gối -> Cổ chân
    (24, 26), (26, 28)          # Chân phải: Hông -> Gối -> Cổ chân
]

def draw_hud(frame: np.ndarray, landmarks_dict: dict, fsm_state: str, metrics: dict, cooldown_left: float, last_action: str):
    """Chỉ vẽ các đường nối khung xương và các điểm khớp theo sát người."""
    h, w, _ = frame.shape

    # Vẽ các đường nối xương và khớp điểm nếu có landmarks
    if landmarks_dict:
        # Vẽ các đoạn xương
        for idx1, idx2 in SKELETON_PAIRS:
            if idx1 in landmarks_dict and idx2 in landmarks_dict:
                pt1 = (int(landmarks_dict[idx1]["x"] * w), int(landmarks_dict[idx1]["y"] * h))
                pt2 = (int(landmarks_dict[idx2]["x"] * w), int(landmarks_dict[idx2]["y"] * h))
                cv2.line(frame, pt1, pt2, (200, 200, 200), 2)

        # Vẽ các khớp điểm chính
        for idx, lm in landmarks_dict.items():
            cx, cy = int(lm["x"] * w), int(lm["y"] * h)
            vis = lm["vis"]
            # Đổi màu theo độ tin cậy: Xanh lá (>0.7), Vàng (0.4-0.7), Đỏ (<0.4)
            color = (0, 255, 0) if vis > 0.7 else ((0, 255, 255) if vis >= 0.4 else (0, 0, 255))
            cv2.circle(frame, (cx, cy), 5, color, -1)


# ==============================================================================
# QUẢN LÝ LUỒNG CAMERA TỐI ƯU ĐỘ TRỄ (ZERO-LATENCY THREADED READER)
# ==============================================================================

class VideoStreamReader:
    """
    Quản lý luồng Camera chạy trong Thread riêng (Background Worker).
    Giải quyết triệt để 3 nguyên nhân gây lag trên IP Camera / RTSP / HTTP Stream:
    1. Tràn bộ đệm (Buffer Bloat) trên mạng LAN/Wi-Fi: Luôn xả sạch buffer và giữ lại frame mới nhất.
    2. Quá tải độ phân giải: Tự động scale về độ phân giải chuẩn (max_width=640) giúp CPU chạy cực mượt.
    3. Hỗ trợ cờ tăng tốc FFMPEG không đệm (fflags=nobuffer, rtsp_transport=tcp).
    4. Tự động thử kết nối lại (Auto-Reconnect) nếu luồng IP Cam bị chập chờn.
    """
    def __init__(self, src=0, max_width: int = 640):
        self.src = int(src) if str(src).isdigit() else str(src)
        self.max_width = max_width
        self.cap = None
        self.latest_frame = None
        self.is_running = False
        self.lock = threading.Lock()
        self.worker_thread = None

    def _init_cap(self):
        try:
            if isinstance(self.src, str) and (self.src.startswith("rtsp://") or self.src.startswith("http://")):
                os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "rtsp_transport;tcp|fflags;nobuffer|max_delay;500000"
            self.cap = cv2.VideoCapture(self.src)
            if self.cap.isOpened():
                self.cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        except Exception as e:
            print(f"⚠️ [CAMERA INIT CẢNH BÁO] Không thể mở nguồn {self.src}: {e}")

    def start(self):
        if not self.is_running:
            self.is_running = True
            self.worker_thread = threading.Thread(target=self._capture_worker, daemon=True)
            self.worker_thread.start()
            print(f"🚀 [CAMERA ENGINE] Khởi chạy Zero-Latency Stream Reader cho nguồn: {self.src}")
        return self

    def _capture_worker(self):
        consecutive_failures = 0
        while self.is_running:
            if not self.cap or not self.cap.isOpened():
                if self.is_running:
                    self._init_cap()
                if not self.cap or not self.cap.isOpened():
                    time.sleep(2.0)
                continue

            ret, frame = self.cap.read()
            if not ret or frame is None:
                consecutive_failures += 1
                if consecutive_failures > 30:
                    time.sleep(2.0)
                    if self.is_running:
                        self._init_cap()
                    consecutive_failures = 0
                else:
                    time.sleep(0.05)
                continue

            consecutive_failures = 0
            # Tự động resize giảm tải CPU nếu camera gửi ảnh phân giải lớn (1080p, 2K)
            h, w = frame.shape[:2]
            if w > self.max_width:
                scale = self.max_width / w
                frame = cv2.resize(frame, (self.max_width, int(h * scale)), interpolation=cv2.INTER_LINEAR)

            with self.lock:
                self.latest_frame = frame

    def read(self) -> Tuple[bool, Optional[np.ndarray]]:
        with self.lock:
            if self.latest_frame is None:
                return False, None
            return True, self.latest_frame.copy()

    def isOpened(self) -> bool:
        return self.cap is not None and self.cap.isOpened()

    def release(self):
        self.is_running = False
        if self.worker_thread and self.worker_thread.is_alive():
            self.worker_thread.join(timeout=0.5)
        if self.cap:
            try:
                self.cap.release()
            except Exception:
                pass
            print(f"🛑 [CAMERA ENGINE] Đã đóng kết nối camera nguồn: {self.src}")


# ==============================================================================
# VISION FSM TRACKER CLASS
# ==============================================================================

class VisionFSMTracker:
    """
    Quản lý luồng xử lý nhận diện khung xương và Máy trạng thái hữu hạn (FSM):
    - Độc lập với nguồn video (dùng được cho cả CLI OpenCV window và Web MJPEG Stream).
    """
    def __init__(self, target_id: str = "GARDEN_01", cooldown_sec: float = 15.0, on_action_callback=None):
        self.target_id = target_id
        self.cooldown_sec = cooldown_sec
        self.on_action_callback = on_action_callback
        self.fsm_state = "IDLE"
        self.is_occluded = False
        self.is_analyzing = False
        self.last_trigger_time = 0.0
        self.last_action_text = "None"
        self.last_action_reason = ""
        self.metrics = {
            "hip_vis": 0.0,
            "wrist_vis": 0.0,
            "head_drop": 0.0,
            "torso_angle": 180.0,
            "wrist_reach": 0.0,
            "is_bending": False,
            "is_occluded": False
        }

    def _async_analyze_vlm(self, snap_frame: np.ndarray):
        """Worker chạy trong thread riêng để gọi Gemini và ghi log Supabase không làm đơ camera."""
        try:
            self.last_action_text = "AI Analyzing..."
            self.last_action_reason = "Đang gửi lên Gemini VLM..."
            vlm_result = analyze_action_with_gemini(snap_frame)
            if vlm_result:
                action = vlm_result.get("action", "UNKNOWN")
                reason = vlm_result.get("reason", "")
                self.last_action_text = action
                self.last_action_reason = reason
                print(f"🤖 [GEMINI KẾT QUẢ - {self.target_id}]: {action} - {reason}")

                if action in ["WATERING", "FEEDING", "FERTILIZING"]:
                    if self.on_action_callback:
                        try:
                            self.on_action_callback(action, reason, self.target_id)
                        except Exception as cb_err:
                            print(f"❌ [CALLBACK LỖI]: {cb_err}")
                            post_action_log(action, reason, target_id=self.target_id)
                    else:
                        post_action_log(action, reason, target_id=self.target_id)
            else:
                self.last_action_text = "VLM Error"
        except Exception as e:
            print(f"❌ [VLM ASYNC LỖI]: {e}")
            self.last_action_text = "VLM Error"
        finally:
            self.is_analyzing = False
            self.fsm_state = "COOLDOWN"

    def process_frame(self, frame: np.ndarray) -> np.ndarray:
        """
        Nhận vào 1 frame (BGR), thực hiện nhận diện MediaPipe, cập nhật FSM,
        kích hoạt VLM khi có Golden Trigger và vẽ HUD lên frame.
        Trả về frame đã vẽ HUD.
        """
        # Tự động giảm kích thước nếu frame quá to (1080p -> 640px) để MediaPipe xử lý mượt mà
        h, w = frame.shape[:2]
        if w > 640:
            scale = 640.0 / w
            frame = cv2.resize(frame, (640, int(h * scale)), interpolation=cv2.INTER_LINEAR)
            h, w = frame.shape[:2]

        current_time = time.time()
        cooldown_remaining = max(0.0, self.cooldown_sec - (current_time - self.last_trigger_time))

        landmarks_dict = {}
        self.metrics = {
            "hip_vis": 0.0,
            "wrist_vis": 0.0,
            "head_drop": 0.0,
            "torso_angle": 180.0,
            "wrist_reach": 0.0,
            "is_bending": False,
            "is_occluded": self.is_occluded
        }

        # -------------------------------------------------------------
        # BƯỚC 1: TRÍCH XUẤT KHUNG XƯƠNG (MEDIAPIPE POSE)
        # -------------------------------------------------------------
        landmarks = None
        if USE_TASKS_API:
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            mp_img = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)
            detection_result = pose_detector.detect(mp_img)
            if detection_result.pose_landmarks and len(detection_result.pose_landmarks) > 0:
                landmarks = detection_result.pose_landmarks[0]
        else:
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            results = pose_detector.process(rgb_frame)
            if results.pose_landmarks:
                landmarks = results.pose_landmarks.landmark

        if landmarks:
            # Lưu các khớp cần thiết vào dictionary
            for idx in [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]:
                lm = landmarks[idx]
                landmarks_dict[idx] = {
                    "x": lm.x,
                    "y": lm.y,
                    "vis": getattr(lm, "visibility", 1.0)
                }

            # Tọa độ các khớp quan trọng
            nose = landmarks_dict[0]
            l_sh, r_sh = landmarks_dict[11], landmarks_dict[12]
            l_hip, r_hip = landmarks_dict[23], landmarks_dict[24]
            l_wrist, r_wrist = landmarks_dict[15], landmarks_dict[16]
            l_knee, r_knee = landmarks_dict[25], landmarks_dict[26]

            # Điểm trung bình của vai, hông, gối
            sh_x, sh_y = (l_sh["x"] + r_sh["x"]) / 2.0, (l_sh["y"] + r_sh["y"]) / 2.0
            hip_x, hip_y = (l_hip["x"] + r_hip["x"]) / 2.0, (l_hip["y"] + r_hip["y"]) / 2.0
            knee_x, knee_y = (l_knee["x"] + r_knee["x"]) / 2.0, (l_knee["y"] + r_knee["y"]) / 2.0

            # Điểm tin cậy (Lấy giá trị cao nhất giữa 2 bên để tránh bị khuất 1 bên khi đứng nghiêng)
            hip_vis = max(l_hip["vis"], r_hip["vis"])
            wrist_vis = max(l_wrist["vis"], r_wrist["vis"])

            # ---------------------------------------------------------
            # BƯỚC 2: XỬ LÝ BÀI TOÁN CHE KHUẤT (OCCLUSION STATE MACHINE)
            # ---------------------------------------------------------
            if hip_vis < 0.4:
                # Nông dân đang vác/bê bao tải, xô to che mất hông
                self.is_occluded = True
                self.fsm_state = "SUSPENDED"
            elif hip_vis > 0.7 and wrist_vis > 0.7:
                # Đặt vật xuống hoặc lộ diện rõ ràng các khớp thao tác
                if self.is_occluded:
                    self.is_occluded = False
                    self.fsm_state = "RESUMED"
                elif self.fsm_state != "COOLDOWN":
                    self.fsm_state = "RESUMED"

            # ---------------------------------------------------------
            # BƯỚC 3: NHẬN DIỆN TƯ THẾ ĐẶC BIỆT (POSTURE GEOMETRY)
            # (Chỉ tính toán khi KHÔNG ở trạng thái SUSPENDED để tránh nhiễu)
            # ---------------------------------------------------------
            head_drop = abs(nose["y"] - sh_y)
            torso_angle = calculate_angle_3points((sh_x, sh_y), (hip_x, hip_y), (knee_x, knee_y))

            # Độ vươn tay: khoảng cách trục Y từ cổ tay xuống vai (cổ tay vươn xuống thấp hơn vai)
            max_wrist_y = max(l_wrist["y"], r_wrist["y"])
            wrist_reach = abs(max_wrist_y - sh_y)

            # Điều kiện 1: Gập người
            cond_bending = (head_drop < 0.15) or (torso_angle < 120.0)
            # Điều kiện 2: Vươn tay
            cond_reaching = (wrist_reach > 0.25)

            is_bending = (not self.is_occluded) and cond_bending and cond_reaching

            self.metrics.update({
                "hip_vis": hip_vis,
                "wrist_vis": wrist_vis,
                "head_drop": head_drop,
                "torso_angle": torso_angle,
                "wrist_reach": wrist_reach,
                "is_bending": is_bending,
                "is_occluded": self.is_occluded
            })

            # ---------------------------------------------------------
            # BƯỚC 4: KHOẢNH KHẮC VÀNG (GOLDEN TRIGGER) & DEBOUNCE
            # ---------------------------------------------------------
            can_trigger = (self.fsm_state == "RESUMED") and is_bending and (cooldown_remaining <= 0) and (not self.is_analyzing)

            if can_trigger:
                self.fsm_state = "TRIGGERED"
                self.is_analyzing = True
                self.last_trigger_time = time.time()
                self.last_action_text = "AI Analyzing..."
                self.last_action_reason = "Gửi Gemini VLM..."
                print("\n🔥 [GOLDEN TRIGGER] Phát hiện nông dân đang cúi gập người thao tác!")
                print(f"-> Metrics: HipVis={hip_vis:.2f}, TorsoAngle={torso_angle:.1f}°, HeadDrop={head_drop:.2f}")

                # Chạy phân tích VLM bất đồng bộ trong background thread để không giật luồng video
                snap_frame = frame.copy()
                threading.Thread(target=self._async_analyze_vlm, args=(snap_frame,), daemon=True).start()

        else:
            # Không phát hiện người trong khung hình
            if self.fsm_state not in ["COOLDOWN", "TRIGGERED"]:
                self.fsm_state = "IDLE"

        # Cập nhật trạng thái Cooldown nếu hết thời gian và không trong tiến trình gọi VLM
        if self.fsm_state == "COOLDOWN" and cooldown_remaining <= 0 and (not self.is_analyzing):
            self.fsm_state = "IDLE"

        # -------------------------------------------------------------
        # BƯỚC 5: HIỂN THỊ HUD DEBUG TRỰC QUAN
        # -------------------------------------------------------------
        display_action = f"{self.last_action_text} ({self.last_action_reason})" if self.last_action_reason else self.last_action_text
        draw_hud(frame, landmarks_dict, self.fsm_state, self.metrics, cooldown_remaining, display_action)
        return frame


def run_vision_tracker(source_input: str, target_id: str = "GARDEN_01", cooldown_sec: float = 15.0):
    """
    Vòng lặp chính xử lý luồng Video tối ưu Zero-Latency:
    - FSM States: IDLE -> SUSPENDED (che khuất) -> RESUMED (lộ diện) -> TRIGGERED -> COOLDOWN
    """
    reader = VideoStreamReader(src=source_input, max_width=640).start()

    if not reader.isOpened():
        print(f"❌ [LỖI] Không thể mở luồng camera từ nguồn: {source_input}")
        return

    print("==================================================================")
    print(f"🚀 [V-ARGON VISION] Đang chạy Tracker trên nguồn: {source_input}")
    print(f"🎯 Target ID: {target_id} | Cooldown Debounce: {cooldown_sec}s")
    print("Nhấn phím 'q' trên cửa sổ video để dừng chương trình.")
    print("==================================================================")

    tracker = VisionFSMTracker(target_id=target_id, cooldown_sec=cooldown_sec)

    while reader.is_running:
        ret, frame = reader.read()
        if not ret or frame is None:
            time.sleep(0.01)
            continue

        annotated_frame = tracker.process_frame(frame)
        cv2.imshow("V-ARGON AI Vision Tracker", annotated_frame)

        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    reader.release()
    cv2.destroyAllWindows()
    print("🛑 [V-ARGON VISION] Đã dừng Tracker.")


# ==============================================================================
# CLI ENTRY POINT
# ==============================================================================
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="V-ARGON Edge-to-Cloud Hybrid AI Vision Tracker")
    parser.add_argument("--source", type=str, default=os.getenv("CAMERA_SOURCE", "0"),
                        help="Nguồn Video: Webcam index (0) hoặc URL stream ESP32-CAM (http://...)")
    parser.add_argument("--target", type=str, default="GARDEN_01",
                        help="Target ID cần theo dõi (VD: GARDEN_01, PEN_01)")
    parser.add_argument("--cooldown", type=float, default=15.0,
                        help="Thời gian Cooldown debounce giữa 2 lần chụp (giây)")
    args = parser.parse_args()

    run_vision_tracker(
        source_input=args.source,
        target_id=args.target,
        cooldown_sec=args.cooldown
    )
