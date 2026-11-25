import logging
from typing import Any, Optional
from datetime import datetime, timezone
from app.db.supabase_client import get_supabase_client

logger = logging.getLogger("smart_manager.repo.pens")

# Danh sách đa dạng các chuồng trại / khu vực nuôi trồng
_PENS_FALLBACK = [
    {"id": "123", "name": "Chuồng Heo Thịt Khu A1", "type": "livestock", "camera_url": "http://10.17.220.234:8080/video", "webcam_url": "0", "created_at": "2026-08-01T00:00:00Z"},
    {"id": "PEN-A02", "name": "Chuồng Heo Thịt Khu A2", "type": "livestock", "camera_url": None, "webcam_url": "0", "created_at": "2026-08-15T00:00:00Z"},
    {"id": "PEN-ISO-01", "name": "Khu Cách Ly Y Tế / Heo Bệnh", "type": "livestock", "camera_url": None, "webcam_url": "0", "created_at": "2026-09-01T00:00:00Z"},
    {"id": "PEN-B01", "name": "Khu Nhà Màng Dưa Lưới B1", "type": "crops", "camera_url": "http://10.17.220.234:8080/video", "webcam_url": "0", "created_at": "2026-09-10T00:00:00Z"},
    {"id": "PEN-B02", "name": "Khu Nhà Màng Cà Chua Cherry B2", "type": "crops", "camera_url": None, "webcam_url": "0", "created_at": "2026-10-01T00:00:00Z"},
]

# Bộ nhớ tạm lưu camera_url và webcam_url nếu schema Supabase chưa kịp chạy lệnh ALTER TABLE
_PEN_CAMERAS: dict[str, str] = {
    "123": "http://10.17.220.234:8080/video",
    "PEN-B01": "http://10.17.220.234:8080/video"
}
_PEN_WEBCAMS: dict[str, str] = {
    "123": "0",
    "PEN-A02": "0",
    "PEN-ISO-01": "0",
    "PEN-B01": "0",
    "PEN-B02": "0"
}



class PensRepository:
    """Repository handling database operations for the `pens` table."""

    def __init__(self):
        self._table = "pens"

    @property
    def client(self):
        return get_supabase_client()

    def list_all(self, user_id: Optional[str] = None) -> list[dict[str, Any]]:
        """List all pens, optionally isolated by user_id."""
        pens: list[dict[str, Any]] = []
        try:
            query = self.client.table(self._table).select("*")
            if user_id:
                query = query.eq("user_id", str(user_id).strip())
            response = query.order("id").execute()
            if response.data is not None:
                if user_id:
                    pens = response.data
                else:
                    existing_ids = {str(p.get("id")).strip() for p in response.data}
                    combined = list(response.data)
                    for fb in _PENS_FALLBACK:
                        if fb["id"] not in existing_ids:
                            combined.append(fb)
                    pens = combined
        except Exception as e:
            logger.warning(f"Error fetching pens from Supabase: {e}. Using fallback.")
            pens = [fb for fb in _PENS_FALLBACK if not user_id or fb.get("user_id") == user_id]

        # Gắn kèm camera_url và webcam_url từ bộ nhớ cache nếu cột trong Supabase chưa sẵn sàng
        for p in pens:
            pid = str(p.get("id")).strip()
            if not p.get("camera_url") and pid in _PEN_CAMERAS:
                p["camera_url"] = _PEN_CAMERAS[pid]
            if not p.get("webcam_url") and pid in _PEN_WEBCAMS:
                p["webcam_url"] = _PEN_WEBCAMS[pid]
            elif not p.get("webcam_url"):
                p["webcam_url"] = "0"
        return pens

    def get_by_id(self, pen_id: str) -> Optional[dict[str, Any]]:
        """Get pen by ID."""
        clean_id = pen_id.strip()
        pen = None
        try:
            response = self.client.table(self._table).select("*").eq("id", clean_id).limit(1).execute()
            if response.data and len(response.data) > 0:
                pen = response.data[0]
        except Exception as e:
            logger.warning(f"Error getting pen {clean_id}: {e}")

        if not pen:
            for p in self.list_all():
                if str(p.get("id")).strip().lower() == clean_id.lower():
                    pen = p
                    break

        if pen:
            if not pen.get("camera_url") and clean_id in _PEN_CAMERAS:
                pen["camera_url"] = _PEN_CAMERAS[clean_id]
            if not pen.get("webcam_url") and clean_id in _PEN_WEBCAMS:
                pen["webcam_url"] = _PEN_WEBCAMS[clean_id]
            elif not pen.get("webcam_url"):
                pen["webcam_url"] = "0"
        return pen

    def create_pen(
        self,
        pen_id: str,
        name: str,
        pen_type: str = "livestock",
        user_id: Optional[str] = None,
        camera_url: Optional[str] = None,
        webcam_url: Optional[str] = "0",
    ) -> dict[str, Any]:
        """Create a new pen assigned to a specific user_id."""
        clean_id = pen_id.strip()
        if camera_url:
            _PEN_CAMERAS[clean_id] = camera_url.strip()
        if webcam_url:
            _PEN_WEBCAMS[clean_id] = webcam_url.strip()

        existing = self.get_by_id(clean_id)
        if existing:
            if camera_url:
                existing["camera_url"] = camera_url.strip()
            if webcam_url:
                existing["webcam_url"] = webcam_url.strip()
            return existing

        item = {
            "id": clean_id,
            "name": name.strip(),
            "type": pen_type.strip(),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        if camera_url:
            item["camera_url"] = camera_url.strip()
        if webcam_url:
            item["webcam_url"] = webcam_url.strip()
        if user_id:
            item["user_id"] = str(user_id).strip()

        # Thử chèn bản ghi kèm camera_url, webcam_url vào Supabase
        try:
            response = self.client.table(self._table).insert(item).execute()
            if response.data:
                ret = response.data[0]
                if camera_url and not ret.get("camera_url"):
                    ret["camera_url"] = camera_url.strip()
                if webcam_url and not ret.get("webcam_url"):
                    ret["webcam_url"] = webcam_url.strip()
                return ret
        except Exception as e:
            err_msg = str(e)
            logger.warning(f"Error creating pen in Supabase: {err_msg}. Retrying without optional camera columns if missing.")
            try:
                fallback_item = {k: v for k, v in item.items() if k not in ("camera_url", "webcam_url")}
                res_retry = self.client.table(self._table).insert(fallback_item).execute()
                if res_retry.data:
                    ret = res_retry.data[0]
                    if camera_url:
                        ret["camera_url"] = camera_url.strip()
                    if webcam_url:
                        ret["webcam_url"] = webcam_url.strip()
                    return ret
            except Exception as e2:
                logger.warning(f"Retry insert failed: {e2}")

        _PENS_FALLBACK.append(item)
        return item

    def update_pen(self, pen_id: str, updates: dict[str, Any]) -> Optional[dict[str, Any]]:
        """Update pen attributes (such as camera_url, webcam_url, name, type)."""
        clean_id = pen_id.strip()
        camera_url = updates.get("camera_url")
        if camera_url is not None:
            _PEN_CAMERAS[clean_id] = str(camera_url).strip()
        webcam_url = updates.get("webcam_url")
        if webcam_url is not None:
            _PEN_WEBCAMS[clean_id] = str(webcam_url).strip()

        pen = self.get_by_id(clean_id)
        if not pen:
            return None

        # Cập nhật trong bộ nhớ
        for k, v in updates.items():
            pen[k] = v

        # Cập nhật Supabase
        try:
            res = self.client.table(self._table).update(updates).eq("id", clean_id).execute()
            if res.data and len(res.data) > 0:
                ret = res.data[0]
                if camera_url and not ret.get("camera_url"):
                    ret["camera_url"] = camera_url
                if webcam_url and not ret.get("webcam_url"):
                    ret["webcam_url"] = webcam_url
                return ret
        except Exception as e:
            err_msg = str(e)
            logger.warning(f"Error updating pen in Supabase: {err_msg}. Stripping missing camera columns.")
            try:
                safe_updates = {k: v for k, v in updates.items() if k not in ("camera_url", "webcam_url")}
                if safe_updates:
                    self.client.table(self._table).update(safe_updates).eq("id", clean_id).execute()
            except Exception as e2:
                logger.warning(f"Safe update failed: {e2}")

        return pen
