import json
import logging
import urllib.request
import urllib.error
from typing import Optional, Dict, Any
from app.config import get_settings

logger = logging.getLogger("smart_manager.face_service")


class FaceVisionService:
    """
    Client service interfacing with Standalone AI Vision Engine (api_server.py).
    Handles face recognition, anti-spoofing liveness verification, and face enrollment.
    """

    def __init__(self):
        self.settings = get_settings()

    @property
    def base_url(self) -> str:
        return self.settings.VISION_ENGINE_URL.rstrip("/")

    def _candidate_urls(self) -> list[str]:
        urls = [self.base_url]
        if "127.0.0.1:8001" not in self.base_url and "localhost:8001" not in self.base_url:
            urls.append("http://127.0.0.1:8001")
        return urls

    def _post_enroll_multipart(self, full_body: bytes, boundary: str, timeout: int = 30) -> Optional[dict]:
        """Try enrolling against configured VISION_ENGINE_URL and local 127.0.0.1:8001."""
        for base in self._candidate_urls():
            url = f"{base}/api/v1/faces/enroll"
            try:
                req = urllib.request.Request(
                    url,
                    data=full_body,
                    headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
                    method="POST"
                )
                with urllib.request.urlopen(req, timeout=timeout) as resp:
                    if resp.status == 200:
                        return json.loads(resp.read().decode("utf-8"))
            except urllib.error.HTTPError as he:
                err_body = he.read().decode("utf-8", errors="replace")
                try:
                    err_json = json.loads(err_body)
                    detail = err_json.get("detail") or err_json.get("message") or err_body
                except Exception:
                    detail = err_body
                logger.warning(f"AI Vision enroll HTTP {he.code} at {url}: {detail}")
                return {"status": "error", "code": he.code, "message": detail}
            except Exception as e:
                logger.warning(f"Error enrolling face at {url}: {e}")
        return None

    def check_health(self) -> dict:
        """Check if standalone AI engine is online."""
        url = f"{self.base_url}/api/v1/health"
        try:
            req = urllib.request.Request(url, method="GET")
            with urllib.request.urlopen(req, timeout=3) as resp:
                if resp.status == 200:
                    data = json.loads(resp.read().decode("utf-8"))
                    return {"online": True, **data}
        except Exception as e:
            logger.debug(f"Standalone AI engine offline at {url}: {e}")
        return {"online": False, "status": "offline", "engine_url": self.base_url}

    def analyze_face_base64(self, image_base64: str) -> dict:
        """
        Send base64 image to standalone AI engine for face recognition & anti-spoofing check.
        Returns normalized dictionary with detected faces and liveness status.
        """
        url = f"{self.base_url}/api/v1/analyze"
        payload = json.dumps({"image_base64": image_base64}).encode("utf-8")

        try:
            req = urllib.request.Request(
                url,
                data=payload,
                headers={"Content-Type": "application/json"},
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                if resp.status == 200:
                    return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as he:
            err_body = he.read().decode("utf-8")
            logger.warning(f"AI Vision API error {he.code}: {err_body}")
            return {"error": f"AI Engine HTTP {he.code}", "detail": err_body, "faces": []}
        except Exception as e:
            logger.warning(f"Could not connect to AI Vision Engine at {url}: {e}")

        # Local fallback attempt if direct import is possible
        try:
            import base64
            import cv2
            import numpy as np
            from standalone_ai_engine.face_engine import FaceEngine
            from standalone_ai_engine.anti_spoofing import AntiSpoofingDetector

            if "," in image_base64:
                image_base64 = image_base64.split(",", 1)[1]
            img_bytes = base64.b64decode(image_base64)
            arr = np.frombuffer(img_bytes, dtype=np.uint8)
            img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
            if img is not None:
                engine = FaceEngine()
                results = engine.recognize(img)
                anti_spoof = AntiSpoofingDetector()
                for fr in results:
                    loc = fr.get("location")
                    if loc:
                        fr["liveness"] = anti_spoof.check_liveness(img, loc)
                    else:
                        fr["liveness"] = {"is_real": True, "status": "SKIPPED", "confidence": 1.0}
                return {
                    "mode": "embedded_fallback",
                    "faces_detected": len(results),
                    "faces": results
                }
        except Exception as direct_err:
            logger.debug(f"Direct embedded engine fallback not available: {direct_err}")

        return {
            "status": "vision_engine_offline",
            "message": "AI Vision Engine đang offline. Vui lòng khởi động standalone_ai_engine/api_server.py trên cổng 8001.",
            "faces_detected": 0,
            "faces": []
        }

    def inspect_uniform_base64(self, image_base64: str, weekday: int = -1, return_annotated: bool = True) -> dict:
        """
        Send base64 image to standalone AI engine for full-body person detection & uniform inspection.
        """
        url = f"{self.base_url}/api/v1/uniform/inspect"
        payload = json.dumps({
            "image_base64": image_base64,
            "weekday": weekday,
            "return_annotated": return_annotated
        }).encode("utf-8")

        try:
            req = urllib.request.Request(
                url,
                data=payload,
                headers={"Content-Type": "application/json"},
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                if resp.status == 200:
                    return json.loads(resp.read().decode("utf-8"))
        except Exception as e:
            logger.warning(f"Could not connect to AI Uniform Engine at {url}: {e}")

        # Local fallback if standalone server is offline
        try:
            import base64
            import cv2
            import numpy as np
            import sys
            import os
            engine_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "standalone_ai_engine")
            if engine_dir not in sys.path:
                sys.path.insert(0, engine_dir)
            from standalone_ai_engine.uniform_checker import UniformChecker
            from standalone_ai_engine.face_engine import FaceEngine

            raw_b64 = image_base64
            if "," in raw_b64:
                raw_b64 = raw_b64.split(",", 1)[1]
            img_bytes = base64.b64decode(raw_b64)
            arr = np.frombuffer(img_bytes, dtype=np.uint8)
            img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
            if img is not None:
                fe = FaceEngine()
                faces = fe.recognize(img)
                floc = faces[0]["location"] if faces else None
                checker = UniformChecker()
                res = checker.check_uniform(img, face_location=floc, weekday_override=weekday)
                annotated_b64 = None
                if return_annotated:
                    hud = checker.draw_uniform_hud(img, res)
                    _, buf = cv2.imencode(".jpg", hud, [cv2.IMWRITE_JPEG_QUALITY, 85])
                    annotated_b64 = "data:image/jpeg;base64," + base64.b64encode(buf.tobytes()).decode("utf-8")
                return {
                    "status": "success",
                    "mode": "embedded_fallback",
                    "person_detected": res.get("person_detected", False),
                    "faces_detected": len(faces),
                    "faces": faces,
                    "uniform": res,
                    "annotated_image_base64": annotated_b64
                }
        except Exception as direct_err:
            logger.debug(f"Direct embedded uniform fallback error: {direct_err}")

        return {
            "status": "vision_engine_offline",
            "message": "AI Vision Engine đang offline. Vui lòng chạy start.sh để khởi động cổng 8001.",
            "person_detected": False,
            "uniform": None
        }

    def enroll_face(self, staff_id: str, staff_name: str, image_bytes: bytes, filename: str = "avatar.jpg") -> dict:
        """
        Enroll a new staff member face into the known faces database.
        Uses multipart form data to call /api/v1/faces/enroll.
        """
        url = f"{self.base_url}/api/v1/faces/enroll"
        boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW"
        
        body_parts = []
        # student_id field
        body_parts.append(f"--{boundary}\r\nContent-Disposition: form-data; name=\"student_id\"\r\n\r\n{staff_id}\r\n".encode("utf-8"))
        # student_name field
        body_parts.append(f"--{boundary}\r\nContent-Disposition: form-data; name=\"student_name\"\r\n\r\n{staff_name}\r\n".encode("utf-8"))
        # file field
        file_header = f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"{filename}\"\r\nContent-Type: image/jpeg\r\n\r\n".encode("utf-8")
        body_parts.append(file_header)
        body_parts.append(image_bytes)
        body_parts.append(f"\r\n--{boundary}--\r\n".encode("utf-8"))

        full_body = b"".join(body_parts)

        remote_res = self._post_enroll_multipart(full_body, boundary, timeout=30)
        if remote_res is not None:
            return remote_res

        # Local fallback enrollment directly to disk if AI Vision Engine is offline
        try:
            import os
            import re
            import cv2
            import numpy as np
            arr = np.frombuffer(image_bytes, dtype=np.uint8)
            img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
            if img is not None:
                faces_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "..", "standalone_ai_engine", "known_faces")
                os.makedirs(faces_dir, exist_ok=True)
                clean_id = re.sub(r"[^a-zA-Z0-9_-]", "", staff_id.strip()) or "0"
                clean_name = re.sub(r"[^a-zA-Z0-9_-]", "", staff_name.strip().replace(" ", "_"))
                out_fn = f"{clean_id}_{clean_name}_thang.jpg" if clean_name else f"{clean_id}_thang.jpg"
                out_path = os.path.join(faces_dir, out_fn)
                cv2.imwrite(out_path, img)
                return {"status": "success", "message": f"Đã lưu ảnh nhân sự {staff_name} vào {out_path}", "local_fallback": True}
        except Exception as fe:
            logger.debug(f"Direct local enrollment error: {fe}")

        return {"status": "error", "message": "Không thể kết nối tới AI Vision Engine để đăng ký khuôn mặt."}

    def enroll_face_3_angles(
        self,
        staff_id: str,
        staff_name: str,
        thang_bytes: bytes,
        trai_bytes: bytes,
        phai_bytes: bytes
    ) -> dict:
        """
        Đăng ký FaceID 3 góc eKYC (Thẳng, Nghiêng Trái, Nghiêng Phải) gửi sang AI Vision Engine.
        """
        url = f"{self.base_url}/api/v1/faces/enroll"
        boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW"

        body_parts = []
        body_parts.append(f"--{boundary}\r\nContent-Disposition: form-data; name=\"student_id\"\r\n\r\n{staff_id}\r\n".encode("utf-8"))
        body_parts.append(f"--{boundary}\r\nContent-Disposition: form-data; name=\"student_name\"\r\n\r\n{staff_name}\r\n".encode("utf-8"))

        # file_thang
        body_parts.append(f"--{boundary}\r\nContent-Disposition: form-data; name=\"file_thang\"; filename=\"{staff_id}_thang.jpg\"\r\nContent-Type: image/jpeg\r\n\r\n".encode("utf-8"))
        body_parts.append(thang_bytes)
        body_parts.append(f"\r\n".encode("utf-8"))

        # file_nghieng_trai
        body_parts.append(f"--{boundary}\r\nContent-Disposition: form-data; name=\"file_nghieng_trai\"; filename=\"{staff_id}_nghieng_trai.jpg\"\r\nContent-Type: image/jpeg\r\n\r\n".encode("utf-8"))
        body_parts.append(trai_bytes)
        body_parts.append(f"\r\n".encode("utf-8"))

        # file_nghieng_phai
        body_parts.append(f"--{boundary}\r\nContent-Disposition: form-data; name=\"file_nghieng_phai\"; filename=\"{staff_id}_nghieng_phai.jpg\"\r\nContent-Type: image/jpeg\r\n\r\n".encode("utf-8"))
        body_parts.append(phai_bytes)
        body_parts.append(f"\r\n--{boundary}--\r\n".encode("utf-8"))

        full_body = b"".join(body_parts)

        remote_res = self._post_enroll_multipart(full_body, boundary, timeout=30)
        if remote_res is not None:
            return remote_res

        # Local fallback enrollment directly to disk if AI Vision Engine is offline
        try:
            import os, re, cv2, numpy as np
            faces_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "..", "standalone_ai_engine", "known_faces")
            os.makedirs(faces_dir, exist_ok=True)
            clean_id = re.sub(r"[^a-zA-Z0-9_-]", "", staff_id.strip()) or "0"
            clean_name = re.sub(r"[^a-zA-Z0-9_-]", "", staff_name.strip().replace(" ", "_"))

            for ang, b in [("thang", thang_bytes), ("nghieng_trai", trai_bytes), ("nghieng_phai", phai_bytes)]:
                arr = np.frombuffer(b, dtype=np.uint8)
                img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
                if img is not None:
                    out_fn = f"{clean_id}_{clean_name}_{ang}.jpg" if clean_name else f"{clean_id}_{ang}.jpg"
                    out_path = os.path.join(faces_dir, out_fn)
                    cv2.imwrite(out_path, img)

            return {
                "status": "success",
                "message": f"Đã lưu ảnh 3 góc nhân sự {staff_name} vào {faces_dir}",
                "local_fallback": True
            }
        except Exception as fe:
            logger.debug(f"Direct local enrollment error: {fe}")

        return {"status": "error", "message": "Không thể kết nối tới AI Vision Engine để đăng ký 3 góc khuôn mặt."}


face_service = FaceVisionService()
