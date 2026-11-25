import json
import logging
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from app.db.supabase_client import get_supabase_client

logger = logging.getLogger("smart_manager.repo.newsfeed")

_LOCAL_DB_PATH = Path(__file__).resolve().parent.parent / "farm_newsfeed_local.db"


def _init_local_db():
    try:
        conn = sqlite3.connect(str(_LOCAL_DB_PATH))
        cursor = conn.cursor()
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS farm_newsfeed_state (
                id TEXT PRIMARY KEY,
                summary_text TEXT NOT NULL,
                briefing_text TEXT,
                items TEXT NOT NULL DEFAULT '[]',
                pending_tasks_count INTEGER DEFAULT 0,
                low_stock_count INTEGER DEFAULT 0,
                sick_animals_count INTEGER DEFAULT 0,
                updated_at TEXT NOT NULL
            );
            """
        )
        conn.commit()
        conn.close()
    except Exception as e:
        logger.error(f"Error initializing local newsfeed SQLite: {e}")


_init_local_db()


class NewsfeedRepository:
    """
    Repository storing synchronized Newsfeed & Smart Farm Assistant text summaries.
    Prioritizes Supabase `farm_newsfeed_state` table, with SQLite fallback.
    """

    def __init__(self):
        self._table = "farm_newsfeed_state"
        self._supabase_available = True

    @property
    def client(self):
        return get_supabase_client()

    def get_state(self, state_id: str = "global") -> Optional[dict[str, Any]]:
        if self._supabase_available:
            try:
                res = (
                    self.client.table(self._table)
                    .select("*")
                    .eq("id", state_id)
                    .limit(1)
                    .execute()
                )
                if res.data and len(res.data) > 0:
                    return res.data[0]
            except Exception as e:
                logger.warning(f"Supabase newsfeed get_state fallback to SQLite: {e}")
                self._supabase_available = False

        try:
            conn = sqlite3.connect(str(_LOCAL_DB_PATH))
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM farm_newsfeed_state WHERE id = ? LIMIT 1", (state_id,))
            row = cursor.fetchone()
            conn.close()
            if not row:
                return None
            data = dict(row)
            if isinstance(data.get("items"), str):
                try:
                    data["items"] = json.loads(data["items"])
                except Exception:
                    data["items"] = []
            return data
        except Exception as e:
            logger.error(f"Local SQLite newsfeed get_state error: {e}")
            return None

    def upsert_state(self, state: dict[str, Any], state_id: str = "global") -> dict[str, Any]:
        now_iso = datetime.now(timezone.utc).isoformat()
        payload = {
            "id": state_id,
            "summary_text": str(state.get("summary_text") or ""),
            "briefing_text": state.get("briefing_text"),
            "items": state.get("items") or [],
            "pending_tasks_count": int(state.get("pending_tasks_count") or 0),
            "low_stock_count": int(state.get("low_stock_count") or 0),
            "sick_animals_count": int(state.get("sick_animals_count") or 0),
            "updated_at": now_iso,
        }

        if self._supabase_available:
            try:
                res = (
                    self.client.table(self._table)
                    .upsert(payload, on_conflict="id")
                    .execute()
                )
                if res.data and len(res.data) > 0:
                    return res.data[0]
                return payload
            except Exception as e:
                logger.warning(f"Supabase newsfeed upsert fallback to SQLite: {e}")
                self._supabase_available = False

        try:
            conn = sqlite3.connect(str(_LOCAL_DB_PATH))
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO farm_newsfeed_state
                    (id, summary_text, briefing_text, items, pending_tasks_count, low_stock_count, sick_animals_count, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    summary_text = excluded.summary_text,
                    briefing_text = excluded.briefing_text,
                    items = excluded.items,
                    pending_tasks_count = excluded.pending_tasks_count,
                    low_stock_count = excluded.low_stock_count,
                    sick_animals_count = excluded.sick_animals_count,
                    updated_at = excluded.updated_at
                """,
                (
                    payload["id"],
                    payload["summary_text"],
                    payload["briefing_text"],
                    json.dumps(payload["items"], ensure_ascii=False),
                    payload["pending_tasks_count"],
                    payload["low_stock_count"],
                    payload["sick_animals_count"],
                    payload["updated_at"],
                ),
            )
            conn.commit()
            conn.close()
        except Exception as e:
            logger.error(f"Local SQLite newsfeed upsert error: {e}")

        return payload
