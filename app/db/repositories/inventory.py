import logging
import re
from typing import Any, Optional
from datetime import datetime, timezone
from app.db.supabase_client import get_supabase_client

logger = logging.getLogger("smart_manager.repo.inventory")
_UUID_RE = re.compile(r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$")


def _is_valid_uuid(val: Optional[str]) -> bool:
    return bool(val and _UUID_RE.match(str(val).strip()))

_INVENTORY_FALLBACK = [
    {
        "id": 1,
        "name": "Cám Con Cò Siêu Tăng Trọng",
        "category": "Feed",
        "quantity": 85.0,
        "unit": "kg",
        "unit_price": 15000.0,
        "min_threshold": 20.0,
        "location": "Kho Cám A",
    },
    {
        "id": 2,
        "name": "Kháng Sinh Amoxicillin 50%",
        "category": "Medicine",
        "quantity": 3.0,
        "unit": "hộp",
        "unit_price": 120000.0,
        "min_threshold": 5.0,
        "location": "Tủ Thuốc Thú Y",
    },
    {
        "id": 3,
        "name": "Phân Bón NPK Dinh Dưỡng Dưa",
        "category": "Fertilizer",
        "quantity": 15.0,
        "unit": "kg",
        "unit_price": 25000.0,
        "min_threshold": 30.0,
        "location": "Kho Phân Bón",
    },
]

_INVENTORY_LOGS_FALLBACK: list[dict[str, Any]] = []


class InventoryRepository:
    """Repository handling database operations for the `inventory` table."""

    def __init__(self):
        self._table = "inventory"
        self._logs_table = "inventory_logs"

    @property
    def client(self):
        return get_supabase_client()

    def list_all(self, user_id: Optional[str] = None) -> list[dict[str, Any]]:
        """List inventory items, strictly scoped to user_id when provided."""
        clean_uid = str(user_id).strip() if user_id else None
        if clean_uid:
            if _is_valid_uuid(clean_uid):
                try:
                    response = self.client.table(self._table).select("*").eq("user_id", clean_uid).execute()
                    if response.data is not None:
                        return response.data
                except Exception as e:
                    logger.warning(f"Error fetching user inventory from Supabase: {e}")
            return [i for i in _INVENTORY_FALLBACK if i.get("user_id") == clean_uid]
        try:
            response = self.client.table(self._table).select("*").execute()
            if response.data and len(response.data) > 0:
                return response.data
        except Exception as e:
            logger.warning(f"Error fetching inventory from Supabase: {e}")
        return _INVENTORY_FALLBACK

    def get_by_name(self, item_name: str, user_id: Optional[str] = None) -> Optional[dict[str, Any]]:
        """Find an inventory item by name (case-insensitive fuzzy match), strictly scoped to user_id when provided."""
        clean_name = item_name.strip().lower()
        clean_uid = str(user_id).strip() if user_id else None

        if clean_uid:
            if _is_valid_uuid(clean_uid):
                try:
                    response = (
                        self.client.table(self._table)
                        .select("*")
                        .eq("user_id", clean_uid)
                        .ilike("name", f"%{clean_name}%")
                        .limit(1)
                        .execute()
                    )
                    if response.data and len(response.data) > 0:
                        return response.data[0]
                except Exception as e:
                    logger.warning(f"Error querying user inventory by name '{item_name}': {e}")
            for item in _INVENTORY_FALLBACK:
                if item.get("user_id") == clean_uid and (
                    clean_name in item.get("name", "").lower()
                    or clean_name in item.get("item_name", "").lower()
                ):
                    return item
            return None

        # Try Supabase query using 'name' column
        try:
            response = (
                self.client.table(self._table)
                .select("*")
                .ilike("name", f"%{clean_name}%")
                .limit(1)
                .execute()
            )
            if response.data and len(response.data) > 0:
                return response.data[0]
        except Exception as e:
            logger.warning(f"Error querying inventory by name '{item_name}': {e}")

        # Check fallback
        for item in _INVENTORY_FALLBACK:
            if clean_name in item.get("name", "").lower() or clean_name in item.get("item_name", "").lower():
                return item
        return None

    def get_low_stock(self, user_id: Optional[str] = None) -> list[dict[str, Any]]:
        """Fetch items where current quantity is less than or equal to min_threshold."""
        items = self.list_all(user_id=user_id)
        low_stock_items = []
        for item in items:
            qty = float(item.get("quantity", 0))
            thresh = float(item.get("min_threshold", 5.0))
            if qty <= thresh:
                low_stock_items.append(item)
        return low_stock_items

    def create_item(
        self,
        item_name: str,
        quantity: float,
        unit: str = "kg",
        category: str = "Feed",
        min_threshold: float = 5.0,
        unit_price: float = 0.0,
        location: str = "Kho Chính",
        user_id: Optional[str] = None,
    ) -> dict[str, Any]:
        """Create a new item in the inventory, scoped to user_id when provided."""
        clean_uid = str(user_id).strip() if user_id else None
        existing = self.get_by_name(item_name, user_id=clean_uid)
        if existing:
            raise ValueError(f"Vật tư '{item_name}' đã tồn tại trong kho (ID: {existing['id']}).")

        payload: dict[str, Any] = {
            "name": item_name.strip(),
            "category": category.strip(),
            "quantity": max(0.0, float(quantity)),
            "unit": unit.strip(),
            "unit_price": float(unit_price),
            "min_threshold": max(0.0, float(min_threshold)),
        }
        if clean_uid:
            payload["user_id"] = clean_uid

        if not clean_uid or _is_valid_uuid(clean_uid):
            try:
                response = self.client.table(self._table).insert(payload).execute()
                if response.data:
                    return response.data[0]
            except Exception as e:
                logger.warning(f"Could not insert inventory into Supabase: {e}. Storing in fallback.")

        payload["id"] = len(_INVENTORY_FALLBACK) + 1
        _INVENTORY_FALLBACK.append(payload)
        return payload

    def adjust_quantity(
        self,
        item_name: str,
        delta_quantity: float,
        pen_id: Optional[str] = None,
        note: str = "",
        user_id: Optional[str] = None,
    ) -> dict[str, Any]:
        """
        Adjust quantity by adding delta_quantity (positive for import, negative for export).
        Validates inventory stock to prevent negative stock values.
        Logs to inventory_logs if available.
        """
        clean_uid = str(user_id).strip() if user_id else None
        existing = self.get_by_name(item_name, user_id=clean_uid)
        if not existing:
            # Auto-create if importing a new item
            if delta_quantity > 0:
                existing = self.create_item(item_name=item_name, quantity=0.0, user_id=clean_uid)
            else:
                raise ValueError(f"Không tìm thấy vật tư '{item_name}' trong kho để xuất.")

        current_qty = float(existing.get("quantity", 0))
        new_qty = current_qty + delta_quantity

        if new_qty < 0:
            raise ValueError(
                f"Tồn kho không đủ! Vật tư '{existing.get('name')}' hiện chỉ còn {current_qty} {existing.get('unit')}, "
                f"không thể xuất {abs(delta_quantity)} {existing.get('unit')}."
            )

        existing["quantity"] = new_qty
        existing["updated_at"] = datetime.now(timezone.utc).isoformat()

        # Update Supabase when unscoped or valid UUID
        if not clean_uid or _is_valid_uuid(clean_uid):
            try:
                item_id = existing.get("id")
                self.client.table(self._table).update({"quantity": new_qty}).eq("id", item_id).execute()

                # Record to inventory_logs
                action_type = "IMPORT" if delta_quantity > 0 else "EXPORT"
                log_entry: dict[str, Any] = {
                    "item_name": existing.get("name"),
                    "action_type": action_type,
                    "amount": abs(delta_quantity),
                    "pen_id": pen_id,
                    "note": note or f"AI Agent adjust quantity: {delta_quantity}",
                }
                if clean_uid and _is_valid_uuid(clean_uid):
                    log_entry["user_id"] = clean_uid
                self.client.table(self._logs_table).insert(log_entry).execute()
            except Exception as e:
                logger.warning(f"Could not update inventory in Supabase: {e}")

        fallback_log: dict[str, Any] = {
            "id": len(_INVENTORY_LOGS_FALLBACK) + 1,
            "item_name": existing.get("name"),
            "action_type": "IMPORT" if delta_quantity > 0 else "EXPORT",
            "amount": abs(delta_quantity),
            "pen_id": pen_id,
            "note": note or f"AI Agent adjust quantity: {delta_quantity}",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        if clean_uid:
            fallback_log["user_id"] = clean_uid
        _INVENTORY_LOGS_FALLBACK.insert(0, fallback_log)

        return existing

    def list_logs(
        self,
        limit: int = 100,
        action_type: Optional[str] = None,
        user_id: Optional[str] = None,
    ) -> list[dict[str, Any]]:
        """List operation logs (import, export, animal export, crop harvest) from `inventory_logs`."""
        clean_uid = str(user_id).strip() if user_id else None
        if clean_uid and not _is_valid_uuid(clean_uid):
            rows = [l for l in _INVENTORY_LOGS_FALLBACK if l.get("user_id") == clean_uid]
            if action_type:
                rows = [l for l in rows if l.get("action_type") == action_type]
            return rows[:limit]
        try:
            query = (
                self.client.table(self._logs_table)
                .select("*")
                .order("created_at", desc=True)
                .limit(limit)
            )
            if clean_uid:
                query = query.eq("user_id", clean_uid)
            if action_type:
                query = query.eq("action_type", action_type)
            response = query.execute()
            if response.data is not None:
                return response.data
        except Exception as e:
            logger.warning(f"Error fetching inventory_logs from Supabase: {e}")
        rows = _INVENTORY_LOGS_FALLBACK
        if clean_uid:
            rows = [l for l in rows if l.get("user_id") == clean_uid]
        if action_type:
            rows = [l for l in rows if l.get("action_type") == action_type]
        return rows[:limit]
