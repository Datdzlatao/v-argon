import logging
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from app.db.supabase_client import get_supabase_client

logger = logging.getLogger("smart_manager.repo.office")

_LOCAL_DB_PATH = Path(__file__).resolve().parent.parent / "farm_office_local.db"


def _is_valid_uuid(val: Optional[str]) -> bool:
    if not val:
        return False
    try:
        uuid.UUID(str(val))
        return True
    except ValueError:
        return False


def _init_local_db():
    try:
        conn = sqlite3.connect(str(_LOCAL_DB_PATH))
        cursor = conn.cursor()
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS office (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT,
                report_date TEXT NOT NULL,
                hour_slot TEXT NOT NULL DEFAULT '',
                category TEXT NOT NULL DEFAULT 'tong_ket',
                code TEXT NOT NULL DEFAULT '',
                item TEXT NOT NULL,
                quantity_or_amount REAL DEFAULT 0,
                unit TEXT DEFAULT '',
                status TEXT DEFAULT 'Đã tổng hợp',
                note TEXT DEFAULT '',
                source_table TEXT DEFAULT '',
                timestampt TEXT NOT NULL
            );
            """
        )
        conn.commit()
        conn.close()
    except Exception as e:
        logger.error(f"Error initializing local office SQLite: {e}")


_init_local_db()


class OfficeRepository:
    """
    Repository quản lý bảng `office` (V-Argon Office - Tổng hợp cuối ngày).
    Ưu tiên Supabase `public.office`, tự động fallback sang SQLite cục bộ nếu bảng chưa tạo.
    """

    def __init__(self):
        self._table = "office"
        self._supabase_available = True

    @property
    def client(self):
        return get_supabase_client()

    @property
    def storage_mode(self) -> str:
        return "supabase" if self._supabase_available else "local_sqlite"

    def _normalize_payload(self, payload: dict[str, Any]) -> dict[str, Any]:
        now_iso = datetime.now(timezone.utc).isoformat()
        ts = str(payload.get("timestampt") or now_iso)
        report_date = str(payload.get("report_date") or ts[:10])
        hour_slot = str(payload.get("hour_slot") or "")
        if not hour_slot and len(ts) >= 16 and "T" in ts:
            hour_slot = ts[11:16]

        row: dict[str, Any] = {
            "report_date": report_date,
            "hour_slot": hour_slot,
            "category": str(payload.get("category") or "tong_ket"),
            "code": str(payload.get("code") or ""),
            "item": str(payload.get("item") or "").strip(),
            "quantity_or_amount": float(payload.get("quantity_or_amount") or 0),
            "unit": str(payload.get("unit") or ""),
            "status": str(payload.get("status") or "Đã tổng hợp"),
            "note": str(payload.get("note") or ""),
            "source_table": str(payload.get("source_table") or ""),
            "timestampt": ts,
        }
        uid = payload.get("user_id")
        if _is_valid_uuid(uid):
            row["user_id"] = str(uid)
        return row

    def list_records(
        self,
        report_date: Optional[str] = None,
        category: Optional[str] = None,
        user_id: Optional[str] = None,
        limit: int = 200,
    ) -> list[dict[str, Any]]:
        """Lấy danh sách bản ghi từ bảng `office`, sắp xếp theo cột `timestampt` giảm dần."""
        if self._supabase_available:
            try:
                query = (
                    self.client.table(self._table)
                    .select("*")
                    .order("timestampt", desc=True)
                    .limit(limit)
                )
                if report_date:
                    query = query.eq("report_date", report_date)
                if category and category != "all":
                    query = query.eq("category", category)
                if _is_valid_uuid(user_id):
                    query = query.or_(f"user_id.eq.{user_id},user_id.is.null")
                res = query.execute()
                if res.data is not None:
                    return res.data
            except Exception as e:
                logger.warning(f"Supabase office list_records fallback to SQLite: {e}")
                self._supabase_available = False

        try:
            conn = sqlite3.connect(str(_LOCAL_DB_PATH))
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            sql = "SELECT * FROM office WHERE 1=1"
            params: list[Any] = []
            if report_date:
                sql += " AND report_date = ?"
                params.append(report_date)
            if category and category != "all":
                sql += " AND category = ?"
                params.append(category)
            if _is_valid_uuid(user_id):
                sql += " AND (user_id = ? OR user_id IS NULL)"
                params.append(str(user_id))
            sql += " ORDER BY timestampt DESC, id DESC LIMIT ?"
            params.append(limit)
            cursor.execute(sql, tuple(params))
            rows = [dict(r) for r in cursor.fetchall()]
            conn.close()
            return rows
        except Exception as e:
            logger.error(f"Local SQLite office list_records error: {e}")
            return []

    def create_record(self, payload: dict[str, Any]) -> dict[str, Any]:
        """Thêm mới 1 bản ghi vào bảng `office`."""
        row = self._normalize_payload(payload)
        if self._supabase_available:
            try:
                res = self.client.table(self._table).insert(row).execute()
                if res.data and len(res.data) > 0:
                    return res.data[0]
            except Exception as e:
                logger.warning(f"Supabase office create_record fallback to SQLite: {e}")
                self._supabase_available = False

        conn = sqlite3.connect(str(_LOCAL_DB_PATH))
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO office (
                user_id, report_date, hour_slot, category, code, item,
                quantity_or_amount, unit, status, note, source_table, timestampt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                row.get("user_id"),
                row["report_date"],
                row["hour_slot"],
                row["category"],
                row["code"],
                row["item"],
                row["quantity_or_amount"],
                row["unit"],
                row["status"],
                row["note"],
                row["source_table"],
                row["timestampt"],
            ),
        )
        new_id = cursor.lastrowid
        conn.commit()
        conn.close()
        return {"id": new_id, **row}

    def replace_agent_records_for_date(
        self,
        report_date: str,
        records: list[dict[str, Any]],
        user_id: Optional[str] = None,
    ) -> list[dict[str, Any]]:
        """
        Xóa các bản ghi tổng hợp tự động (source_table != 'manual') của ngày `report_date`
        rồi ghi mới toàn bộ danh sách tổng hợp theo giờ để tránh trùng lặp khi chạy lại.
        """
        normalized = [self._normalize_payload({**r, "report_date": report_date}) for r in records]

        if self._supabase_available:
            try:
                del_query = (
                    self.client.table(self._table)
                    .delete()
                    .eq("report_date", report_date)
                    .neq("source_table", "manual")
                )
                if _is_valid_uuid(user_id):
                    del_query = del_query.or_(f"user_id.eq.{user_id},user_id.is.null")
                del_query.execute()

                if normalized:
                    res = self.client.table(self._table).insert(normalized).execute()
                    if res.data is not None:
                        return res.data
                return []
            except Exception as e:
                logger.warning(f"Supabase office replace_agent_records_for_date fallback to SQLite: {e}")
                self._supabase_available = False

        conn = sqlite3.connect(str(_LOCAL_DB_PATH))
        cursor = conn.cursor()
        if _is_valid_uuid(user_id):
            cursor.execute(
                "DELETE FROM office WHERE report_date = ? AND source_table != 'manual' AND (user_id = ? OR user_id IS NULL)",
                (report_date, str(user_id)),
            )
        else:
            cursor.execute(
                "DELETE FROM office WHERE report_date = ? AND source_table != 'manual'",
                (report_date,),
            )

        inserted: list[dict[str, Any]] = []
        for row in normalized:
            cursor.execute(
                """
                INSERT INTO office (
                    user_id, report_date, hour_slot, category, code, item,
                    quantity_or_amount, unit, status, note, source_table, timestampt
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    row.get("user_id"),
                    row["report_date"],
                    row["hour_slot"],
                    row["category"],
                    row["code"],
                    row["item"],
                    row["quantity_or_amount"],
                    row["unit"],
                    row["status"],
                    row["note"],
                    row["source_table"],
                    row["timestampt"],
                ),
            )
            inserted.append({"id": cursor.lastrowid, **row})
        conn.commit()
        conn.close()
        return inserted

    def update_record(self, record_id: int | str, payload: dict[str, Any]) -> Optional[dict[str, Any]]:
        """Cập nhật bản ghi trong bảng `office`."""
        allowed_fields = {
            "code",
            "item",
            "category",
            "quantity_or_amount",
            "unit",
            "status",
            "note",
            "hour_slot",
            "timestampt",
        }
        updates = {k: v for k, v in payload.items() if k in allowed_fields and v is not None}
        if not updates:
            return None

        if self._supabase_available:
            try:
                res = (
                    self.client.table(self._table)
                    .update(updates)
                    .eq("id", record_id)
                    .execute()
                )
                if res.data and len(res.data) > 0:
                    return res.data[0]
            except Exception as e:
                logger.warning(f"Supabase office update_record fallback to SQLite: {e}")
                self._supabase_available = False

        conn = sqlite3.connect(str(_LOCAL_DB_PATH))
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        set_clause = ", ".join(f"{k} = ?" for k in updates.keys())
        values = list(updates.values()) + [record_id]
        cursor.execute(f"UPDATE office SET {set_clause} WHERE id = ?", tuple(values))
        conn.commit()
        cursor.execute("SELECT * FROM office WHERE id = ?", (record_id,))
        row = cursor.fetchone()
        conn.close()
        return dict(row) if row else None

    def delete_record(self, record_id: int | str) -> bool:
        """Xóa bản ghi trong bảng `office`."""
        if self._supabase_available:
            try:
                self.client.table(self._table).delete().eq("id", record_id).execute()
                return True
            except Exception as e:
                logger.warning(f"Supabase office delete_record fallback to SQLite: {e}")
                self._supabase_available = False

        conn = sqlite3.connect(str(_LOCAL_DB_PATH))
        cursor = conn.cursor()
        cursor.execute("DELETE FROM office WHERE id = ?", (record_id,))
        conn.commit()
        deleted = cursor.rowcount > 0
        conn.close()
        return deleted
