import logging
from typing import Any, Optional
from datetime import date, datetime, timedelta, timezone
from app.db.supabase_client import get_supabase_client

logger = logging.getLogger("smart_manager.repo.crops")

_CROPS_FALLBACK = [
    {
        "id": 1,
        "pen_id": "PEN-B01",
        "name": "Dưa Lưới Fuji F1",
        "quantity": 500,
        "plant_date": (date.today() - timedelta(days=65)).isoformat(),
        "harvest_date": (date.today() + timedelta(days=5)).isoformat(),
        "status": "Ripening",
    }
]

_CROP_GROWTH_FALLBACK = []
_CROP_CARE_FALLBACK = []


class CropsRepository:
    """Repository handling database operations for `crops`, `crop_growth_logs`, and `crop_care_logs`."""

    def __init__(self):
        self._table = "crops"
        self._growth_table = "crop_growth_logs"
        self._care_table = "crop_care_logs"

    @property
    def client(self):
        return get_supabase_client()

    def list_all(self) -> list[dict[str, Any]]:
        """List all crops."""
        try:
            res = self.client.table(self._table).select("*").order("id", desc=False).execute()
            if res.data and len(res.data) > 0:
                return res.data
        except Exception as e:
            logger.warning(f"Error fetching crops from Supabase: {e}")
        return _CROPS_FALLBACK

    def get_by_id(self, crop_id: int) -> Optional[dict[str, Any]]:
        """Get crop by ID."""
        try:
            res = self.client.table(self._table).select("*").eq("id", crop_id).limit(1).execute()
            if res.data and len(res.data) > 0:
                return res.data[0]
        except Exception as e:
            logger.warning(f"Error fetching crop {crop_id}: {e}")

        for c in _CROPS_FALLBACK:
            if c.get("id") == crop_id:
                return c
        return None

    def find_by_name(self, name: str, pen_id: Optional[str] = None) -> Optional[dict[str, Any]]:
        """Find crop by name (case-insensitive) and optional pen_id."""
        clean_name = name.strip().lower()
        clean_pen = pen_id.strip().lower() if pen_id else None

        all_crops = self.list_all()
        for c in all_crops:
            crop_name = str(c.get("name", "")).strip().lower()
            crop_pen = str(c.get("pen_id", "")).strip().lower()

            if clean_name in crop_name or crop_name in clean_name:
                if clean_pen is None or crop_pen == clean_pen:
                    return c
        return None

    def get_upcoming_harvests(self, within_days: int = 7) -> list[dict[str, Any]]:
        """Get crops ready for harvest within the next N days."""
        all_crops = self.list_all()
        today = date.today()
        upcoming = []
        for c in all_crops:
            h_date_str = c.get("harvest_date")
            if h_date_str:
                try:
                    h_date = date.fromisoformat(str(h_date_str)[:10])
                    delta = (h_date - today).days
                    if 0 <= delta <= within_days:
                        c_copy = dict(c)
                        c_copy["days_remaining"] = delta
                        upcoming.append(c_copy)
                except Exception:
                    pass
        return upcoming

    def create_crop(
        self,
        name: str,
        quantity: int = 1,
        pen_id: str = "PEN-B01",
        plant_date: Optional[str] = None,
        harvest_date: Optional[str] = None,
        status: str = "Growing",
    ) -> dict[str, Any]:
        """Create/plant a new crop record."""
        clean_name = name.strip()
        clean_pen = pen_id.strip() if pen_id else "PEN-B01"
        clean_plant_date = plant_date or date.today().isoformat()

        payload = {
            "name": clean_name,
            "quantity": int(quantity),
            "pen_id": clean_pen,
            "plant_date": clean_plant_date,
            "harvest_date": harvest_date,
            "status": status,
        }

        try:
            res = self.client.table(self._table).insert(payload).execute()
            if res.data and len(res.data) > 0:
                _CROPS_FALLBACK.append(res.data[0])
                return res.data[0]
        except Exception as e:
            logger.warning(f"Error creating crop in Supabase: {e}")

        # Fallback in-memory
        next_id = max([c.get("id", 0) for c in _CROPS_FALLBACK], default=0) + 1
        item = {"id": next_id, **payload, "created_at": datetime.now(timezone.utc).isoformat()}
        _CROPS_FALLBACK.append(item)
        return item

    def update_quantity(
        self,
        crop_id: int,
        quantity: int,
        mode: str = "set",
    ) -> dict[str, Any]:
        """Update or adjust crop quantity."""
        crop = self.get_by_id(crop_id)
        if not crop:
            raise ValueError(f"Không tìm thấy cây trồng với ID={crop_id}")

        new_qty = int(quantity) if mode == "set" else max(0, int(crop.get("quantity", 0)) + int(quantity))
        crop["quantity"] = new_qty

        try:
            res = self.client.table(self._table).update({"quantity": new_qty}).eq("id", crop_id).execute()
            if res.data and len(res.data) > 0:
                return res.data[0]
        except Exception as e:
            logger.warning(f"Error updating crop quantity in Supabase: {e}")

        return crop

    def update_status(
        self,
        crop_id: int,
        status: str,
    ) -> dict[str, Any]:
        """Update crop status (e.g. disease name, stage, etc.)."""
        crop = self.get_by_id(crop_id)
        if not crop:
            raise ValueError(f"Không tìm thấy cây trồng với ID={crop_id}")

        crop["status"] = status
        try:
            res = self.client.table(self._table).update({"status": status}).eq("id", crop_id).execute()
            if res.data and len(res.data) > 0:
                return res.data[0]
        except Exception as e:
            logger.warning(f"Error updating crop status in Supabase: {e}")

        return crop

    def log_growth(
        self,
        crop_id: int,
        size: float,
        note: str = "",
    ) -> dict[str, Any]:
        """Log crop growth size/height into crop_growth_logs."""
        crop = self.get_by_id(crop_id)
        if not crop:
            raise ValueError(f"Không tìm thấy cây trồng với ID={crop_id}")

        payload = {
            "crop_id": crop_id,
            "size": float(size),
            "note": note,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

        try:
            res = self.client.table(self._growth_table).insert(payload).execute()
            if res.data and len(res.data) > 0:
                return res.data[0]
        except Exception as e:
            logger.warning(f"Error inserting crop_growth_logs in Supabase: {e}")

        next_id = len(_CROP_GROWTH_FALLBACK) + 1
        item = {"id": next_id, **payload}
        _CROP_GROWTH_FALLBACK.append(item)
        return item

    def log_care(
        self,
        crop_id: int,
        care_type: str,
        note: str = "",
    ) -> dict[str, Any]:
        """Log crop care activity (e.g. Watering, Fertilizer, Prune, Disease treatment) into crop_care_logs."""
        crop = self.get_by_id(crop_id)
        if not crop:
            raise ValueError(f"Không tìm thấy cây trồng với ID={crop_id}")

        payload = {
            "crop_id": crop_id,
            "type": care_type,
            "note": note,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

        try:
            res = self.client.table(self._care_table).insert(payload).execute()
            if res.data and len(res.data) > 0:
                return res.data[0]
        except Exception as e:
            logger.warning(f"Error inserting crop_care_logs in Supabase: {e}")

        next_id = len(_CROP_CARE_FALLBACK) + 1
        item = {"id": next_id, **payload}
        _CROP_CARE_FALLBACK.append(item)
        return item
