import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from app.api.websocket_manager import ws_manager
from app.config import get_settings
from app.db.repositories.alerts import AlertsRepository
from app.db.repositories.inventory import InventoryRepository
from app.db.repositories.office import OfficeRepository, _is_valid_uuid
from app.db.repositories.staff import StaffRepository
from app.db.supabase_client import get_supabase_client

logger = logging.getLogger("smart_manager.office_agent")

VN_TZ = timezone(timedelta(hours=7))


def _parse_dt_vn(raw_ts: Optional[str], fallback_dt: datetime) -> datetime:
    """Parse ISO timestamp string and convert to Vietnam local time (+07:00)."""
    if not raw_ts:
        return fallback_dt
    try:
        s = str(raw_ts).strip()
        if s.endswith("Z"):
            s = s[:-1] + "+00:00"
        dt = datetime.fromisoformat(s)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(VN_TZ)
    except Exception:
        return fallback_dt


def _matches_target_date(raw_ts: Optional[str], target_date: str, record_date_text: Optional[str] = None) -> bool:
    """Check if an ISO timestamp (in VN_TZ) or dd/mm/yyyy text matches target_date (YYYY-MM-DD)."""
    if raw_ts:
        dt = _parse_dt_vn(raw_ts, datetime.now(VN_TZ))
        if dt.date().isoformat() == target_date:
            return True
    if record_date_text:
        txt = str(record_date_text).strip()
        if txt == target_date:
            return True
        # Match dd/mm/yyyy
        try:
            parts = txt.split("/")
            if len(parts) == 3:
                d, m, y = int(parts[0]), int(parts[1]), int(parts[2])
                if f"{y:04d}-{m:02d}-{d:02d}" == target_date:
                    return True
        except Exception:
            pass
    return False


async def run_end_of_day_office_summary(
    target_date: Optional[str] = None,
    user_id: Optional[str] = None,
) -> dict[str, Any]:
    """
    V-Argon Office End-of-Day AI Agent:
    Tổng hợp toàn bộ hoạt động trong ngày gồm:
    - Thu chi (`farm_finances`)
    - Xuất nhập kho (`inventory_logs`: IMPORT / EXPORT)
    - Xuất chuồng (`inventory_logs`: ANIMAL_EXPORT)
    - Thu hoạch (`inventory_logs`: CROP_HARVEST)
    Ghi chi tiết theo từng giờ vào cột `timestampt` của bảng `office` và tạo bản tổng kết cuối ngày.
    """
    now_vn = datetime.now(VN_TZ)
    clean_date = (target_date or now_vn.date().isoformat()).strip()[:10]
    settings = get_settings()

    office_repo = OfficeRepository()
    records_to_save: list[dict[str, Any]] = []

    total_thu = 0.0
    total_chi = 0.0
    total_wages = 0.0
    import_count = 0
    export_count = 0
    animal_export_count = 0
    crop_harvest_count = 0
    staff_completed_count = 0
    staff_working_count = 0
    quotas_count = 0
    leaves_count = 0
    alerts_count = 0
    animal_health_count = 0
    animal_weight_count = 0
    crop_growth_count = 0
    crop_care_count = 0

    # 1. Thu thập Thu Chi từ `farm_finances`
    finances_rows: list[dict[str, Any]] = []
    try:
        client = get_supabase_client()
        q = client.table("farm_finances").select("*").order("created_at", desc=False).limit(300)
        if _is_valid_uuid(user_id):
            q = q.eq("user_id", user_id)
        res = q.execute()
        finances_rows = res.data or []
    except Exception as e:
        logger.warning(f"Office agent could not read farm_finances: {e}")

    for idx, f in enumerate(finances_rows, start=1):
        created_at = f.get("created_at")
        if not _matches_target_date(created_at, clean_date, f.get("record_date")):
            continue
        dt_vn = _parse_dt_vn(created_at, now_vn)
        ftype = str(f.get("type") or "thu").lower()
        amt = float(f.get("amount") or 0)
        if ftype == "thu":
            total_thu += amt
            code = f"THU-{idx:02d}"
            status = "Phiếu thu"
        else:
            total_chi += amt
            code = f"CHI-{idx:02d}"
            status = "Phiếu chi"

        debt_note = str(f.get("debt_note") or "").strip()
        note_parts = [f"Loại: {status}", f"Số tiền: {amt:,.0f}đ"]
        if debt_note:
            note_parts.append(f"Công nợ: {debt_note}")

        records_to_save.append({
            "user_id": user_id,
            "report_date": clean_date,
            "hour_slot": dt_vn.strftime("%H:%M"),
            "category": "thu_chi",
            "code": code,
            "item": str(f.get("title") or "Giao dịch thu chi"),
            "quantity_or_amount": amt,
            "unit": "VNĐ",
            "status": status,
            "note": " • ".join(note_parts),
            "source_table": "farm_finances",
            "timestampt": dt_vn.isoformat(),
        })

    # 2. Thu thập Xuất Nhập Kho, Xuất Chuồng, Thu Hoạch từ `inventory_logs`
    inv_logs: list[dict[str, Any]] = []
    try:
        inv_logs = InventoryRepository().list_logs(limit=300)
    except Exception as e:
        logger.warning(f"Office agent could not read inventory_logs: {e}")

    for idx, log in enumerate(inv_logs, start=1):
        created_at = log.get("created_at")
        if not _matches_target_date(created_at, clean_date):
            continue
        dt_vn = _parse_dt_vn(created_at, now_vn)
        action_type = str(log.get("action_type") or "").upper()
        item_name = str(log.get("item_name") or "Vật tư / Nông sản")
        amount = float(log.get("amount") or 0)
        pen_id = str(log.get("pen_id") or "").strip()
        raw_note = str(log.get("note") or "").strip()

        if action_type == "IMPORT":
            import_count += 1
            category = "xuat_nhap_kho"
            code = f"NK-{idx:02d}"
            status = "Nhập kho"
            unit = "đv"
        elif action_type == "EXPORT":
            export_count += 1
            category = "xuat_nhap_kho"
            code = f"XK-{idx:02d}"
            status = "Xuất kho"
            unit = "đv"
        elif action_type == "ANIMAL_EXPORT":
            animal_export_count += 1
            category = "xuat_chuong"
            code = f"XC-{idx:02d}"
            status = "Xuất chuồng"
            unit = "kg"
        elif action_type == "CROP_HARVEST":
            crop_harvest_count += 1
            category = "thu_hoach"
            code = f"TH-{idx:02d}"
            status = "Thu hoạch"
            unit = "gốc/kg"
        else:
            continue

        note_parts = [raw_note] if raw_note else []
        if pen_id:
            note_parts.append(f"Khu/Chuồng: {pen_id}")

        records_to_save.append({
            "user_id": user_id,
            "report_date": clean_date,
            "hour_slot": dt_vn.strftime("%H:%M"),
            "category": category,
            "code": code,
            "item": item_name,
            "quantity_or_amount": amount,
            "unit": unit,
            "status": status,
            "note": " • ".join(note_parts) or status,
            "source_table": "inventory_logs",
            "timestampt": dt_vn.isoformat(),
        })

    # 3. Thu thập Nhân Sự (Điểm danh & Tự động cộng tiền công hết ngày) + Khoán + Nghỉ phép
    staff_repo = StaffRepository()
    staff_map: dict[str, dict[str, Any]] = {}
    try:
        for s in staff_repo.list_all():
            sid = str(s.get("id") or "").strip()
            if sid:
                staff_map[sid] = s
    except Exception as e:
        logger.warning(f"Office agent could not read staff list: {e}")

    att_logs: list[dict[str, Any]] = []
    try:
        # Fetch wider window and filter accurately in VN_TZ
        att_logs = staff_repo.get_attendance_history(limit=200)
    except Exception as e:
        logger.warning(f"Office agent could not read staff_attendance: {e}")

    att_by_staff: dict[str, dict[str, Any]] = {}
    for log in att_logs:
        created_at = log.get("created_at")
        if not _matches_target_date(created_at, clean_date):
            continue
        sid = str(log.get("staff_id") or "").strip()
        if not sid:
            continue
        dt_vn = _parse_dt_vn(created_at, now_vn)
        ctype = str(log.get("check_type") or "check_in").lower()
        entry = att_by_staff.setdefault(
            sid,
            {
                "staff_name": str(log.get("staff_name") or staff_map.get(sid, {}).get("name") or sid),
                "pen_id": str(log.get("pen_id") or staff_map.get(sid, {}).get("pen_id") or ""),
                "check_in_dt": None,
                "check_out_dt": None,
                "last_dt": dt_vn,
            },
        )
        if dt_vn > entry["last_dt"]:
            entry["last_dt"] = dt_vn
        if ctype == "check_out":
            if entry["check_out_dt"] is None or dt_vn > entry["check_out_dt"]:
                entry["check_out_dt"] = dt_vn
        else:
            if entry["check_in_dt"] is None or dt_vn < entry["check_in_dt"]:
                entry["check_in_dt"] = dt_vn

    for sid, info in att_by_staff.items():
        staff_info = staff_map.get(sid, {})
        daily_wage = float(staff_info.get("daily_wage") or 300000)
        in_dt = info["check_in_dt"]
        out_dt = info["check_out_dt"]
        in_str = in_dt.strftime("%H:%M") if in_dt else "--:--"

        if out_dt is not None:
            staff_completed_count += 1
            total_wages += daily_wage
            out_str = out_dt.strftime("%H:%M")
            status_label = "Đủ công • Đã cộng tiền"
            wage_amt = daily_wage
            event_dt = out_dt
            note_txt = f"Vào ca {in_str} → Tan ca {out_str} • Tự động cộng {daily_wage:,.0f}đ tiền công ngày"
        else:
            staff_working_count += 1
            status_label = "Đang trong ca"
            wage_amt = 0.0
            event_dt = in_dt or info["last_dt"]
            note_txt = f"Vào ca lúc {in_str} (chưa tan ca, chưa cộng tiền công {daily_wage:,.0f}đ)"

        if info["pen_id"]:
            note_txt += f" • Khu: {info['pen_id']}"

        records_to_save.append({
            "user_id": user_id,
            "report_date": clean_date,
            "hour_slot": event_dt.strftime("%H:%M"),
            "category": "nhan_su_khoan",
            "code": f"NS-{sid}",
            "item": f"Chấm công: {info['staff_name']}",
            "quantity_or_amount": wage_amt,
            "unit": "VNĐ",
            "status": status_label,
            "note": note_txt,
            "source_table": "staff_attendance",
            "timestampt": event_dt.isoformat(),
        })

    # 3b. Định mức giao khoán (`farm_hr_quotas`) & Nghỉ phép (`farm_hr_leaves`)
    try:
        client = get_supabase_client()
        q_quotas = client.table("farm_hr_quotas").select("*").order("id", desc=True).limit(100)
        if _is_valid_uuid(user_id):
            q_quotas = q_quotas.eq("user_id", user_id)
        for idx, q in enumerate(q_quotas.execute().data or [], start=1):
            quotas_count += 1
            dt_vn = _parse_dt_vn(q.get("created_at"), now_vn)
            comp = float(q.get("completed_qty") or 0)
            targ = float(q.get("target_qty") or 0)
            unit = str(q.get("unit") or "đơn vị")
            pct = round((comp / targ) * 100) if targ > 0 else 0
            records_to_save.append({
                "user_id": user_id,
                "report_date": clean_date,
                "hour_slot": dt_vn.strftime("%H:%M"),
                "category": "nhan_su_khoan",
                "code": f"KHOAN-{idx:02d}",
                "item": f"Khoán: {q.get('staff_name')} — {q.get('task_title')}",
                "quantity_or_amount": comp,
                "unit": unit,
                "status": f"Đạt {pct}% ({comp:g}/{targ:g})",
                "note": f"Định mức giao khoán: {comp:g}/{targ:g} {unit}",
                "source_table": "farm_hr_quotas",
                "timestampt": dt_vn.isoformat(),
            })

        q_leaves = client.table("farm_hr_leaves").select("*").order("id", desc=True).limit(100)
        if _is_valid_uuid(user_id):
            q_leaves = q_leaves.eq("user_id", user_id)
        for idx, lv in enumerate(q_leaves.execute().data or [], start=1):
            if not _matches_target_date(lv.get("created_at"), clean_date, lv.get("leave_date")):
                continue
            leaves_count += 1
            dt_vn = _parse_dt_vn(lv.get("created_at"), now_vn)
            st_map = {"approved": "Đã duyệt nghỉ", "rejected": "Từ chối", "pending": "Chờ duyệt"}
            records_to_save.append({
                "user_id": user_id,
                "report_date": clean_date,
                "hour_slot": dt_vn.strftime("%H:%M"),
                "category": "nhan_su_khoan",
                "code": f"NP-{idx:02d}",
                "item": f"Nghỉ phép: {lv.get('staff_name')}",
                "quantity_or_amount": 1,
                "unit": "ngày",
                "status": st_map.get(str(lv.get("status")), "Chờ duyệt"),
                "note": f"Lý do: {lv.get('reason')} • Ngày nghỉ: {lv.get('leave_date')}",
                "source_table": "farm_hr_leaves",
                "timestampt": dt_vn.isoformat(),
            })
    except Exception as e:
        logger.warning(f"Office agent could not read farm_hr_quotas/leaves: {e}")

    # 3c. Thu thập Toàn Bộ Thông Báo & Cảnh Báo (`alerts`)
    try:
        alerts_rows = AlertsRepository().get_recent_alerts(limit=300)
        for idx, al in enumerate(alerts_rows, start=1):
            created_at = al.get("created_at")
            if not _matches_target_date(created_at, clean_date):
                continue
            alerts_count += 1
            dt_vn = _parse_dt_vn(created_at, now_vn)
            atype = str(al.get("alert_type") or "SYSTEM").strip()
            msg = str(al.get("message") or "").strip()
            pen_id = str(al.get("pen_id") or "").strip()
            is_read = bool(al.get("is_read"))
            note_parts = [msg] if msg else []
            if pen_id:
                note_parts.insert(0, f"Khu/Chuồng: {pen_id}")
            records_to_save.append({
                "user_id": user_id,
                "report_date": clean_date,
                "hour_slot": dt_vn.strftime("%H:%M"),
                "category": "thong_bao",
                "code": f"TB-{idx:02d}",
                "item": f"[{atype}] {msg[:80]}" if msg else f"Thông báo {atype}",
                "quantity_or_amount": 1,
                "unit": "thông báo",
                "status": "Đã đọc" if is_read else "Chưa đọc",
                "note": " • ".join(note_parts) or atype,
                "source_table": "alerts",
                "timestampt": dt_vn.isoformat(),
            })
    except Exception as e:
        logger.warning(f"Office agent could not read alerts: {e}")

    # 3d. Thu thập Nhật Ký Con Vật (`health_logs` & `weight_logs`)
    health_type_labels = {
        "Vaccine": "Tiêm Vắc-xin",
        "Treatment": "Điều trị / Thuốc",
        "Sick": "Phát hiện bệnh",
        "Checkup": "Khám sức khỏe",
        "Routine": "Kiểm tra định kỳ",
    }
    try:
        client = get_supabase_client()
        h_rows = client.table("health_logs").select("*").order("created_at", desc=False).limit(300).execute().data or []
        for idx, h in enumerate(h_rows, start=1):
            created_at = h.get("created_at")
            if not _matches_target_date(created_at, clean_date):
                continue
            animal_health_count += 1
            dt_vn = _parse_dt_vn(created_at, now_vn)
            animal_id = str(h.get("animal_id") or "Vật nuôi").strip()
            htype = str(h.get("type") or "Routine").strip()
            type_label = health_type_labels.get(htype, htype)
            action_or_title = str(h.get("action") or h.get("title") or "").strip()
            raw_note = str(h.get("note") or "").strip()
            note_parts = [p for p in [action_or_title, raw_note] if p]
            records_to_save.append({
                "user_id": user_id,
                "report_date": clean_date,
                "hour_slot": dt_vn.strftime("%H:%M"),
                "category": "nhat_ky_vat_nuoi",
                "code": f"TY-{idx:02d}",
                "item": f"Thú y ({animal_id}): {action_or_title or type_label}",
                "quantity_or_amount": 1,
                "unit": "lần",
                "status": type_label,
                "note": " • ".join(note_parts) or type_label,
                "source_table": "health_logs",
                "timestampt": dt_vn.isoformat(),
            })
    except Exception as e:
        logger.warning(f"Office agent could not read health_logs: {e}")

    try:
        client = get_supabase_client()
        w_rows = client.table("weight_logs").select("*").order("created_at", desc=False).limit(300).execute().data or []
        for idx, w in enumerate(w_rows, start=1):
            created_at = w.get("created_at")
            if not _matches_target_date(created_at, clean_date):
                continue
            animal_weight_count += 1
            dt_vn = _parse_dt_vn(created_at, now_vn)
            animal_id = str(w.get("animal_id") or "Vật nuôi").strip()
            weight_val = float(w.get("weight") or 0)
            records_to_save.append({
                "user_id": user_id,
                "report_date": clean_date,
                "hour_slot": dt_vn.strftime("%H:%M"),
                "category": "nhat_ky_vat_nuoi",
                "code": f"CN-{idx:02d}",
                "item": f"Cân nặng vật nuôi ({animal_id})",
                "quantity_or_amount": weight_val,
                "unit": "kg",
                "status": "Đo tăng trọng",
                "note": f"Ghi nhận cân nặng {animal_id}: {weight_val:g} kg",
                "source_table": "weight_logs",
                "timestampt": dt_vn.isoformat(),
            })
    except Exception as e:
        logger.warning(f"Office agent could not read weight_logs: {e}")

    # 3e. Thu thập Nhật Ký Tăng Trưởng & Chăm Sóc Cây Trồng (`crop_growth_logs` & `crop_care_logs`)
    crop_name_map: dict[str, str] = {}
    try:
        client = get_supabase_client()
        for c in client.table("crops").select("id,name").limit(300).execute().data or []:
            cid = str(c.get("id") or "").strip()
            if cid:
                crop_name_map[cid] = str(c.get("name") or cid).strip()
    except Exception as e:
        logger.debug(f"Office agent could not read crops map: {e}")

    try:
        client = get_supabase_client()
        cg_rows = client.table("crop_growth_logs").select("*").order("created_at", desc=False).limit(300).execute().data or []
        for idx, cg in enumerate(cg_rows, start=1):
            created_at = cg.get("created_at")
            if not _matches_target_date(created_at, clean_date):
                continue
            crop_growth_count += 1
            dt_vn = _parse_dt_vn(created_at, now_vn)
            cid = str(cg.get("crop_id") or "").strip()
            crop_label = crop_name_map.get(cid, cid or "Cây trồng")
            size_val = float(cg.get("size") or cg.get("height_or_size") or 0)
            raw_note = str(cg.get("note") or "").strip()
            note_txt = f"Chiều cao / kích thước: {size_val:g} cm"
            if raw_note:
                note_txt += f" • {raw_note}"
            records_to_save.append({
                "user_id": user_id,
                "report_date": clean_date,
                "hour_slot": dt_vn.strftime("%H:%M"),
                "category": "nhat_ky_tang_truong",
                "code": f"TT-{idx:02d}",
                "item": f"Sinh trưởng cây: {crop_label}",
                "quantity_or_amount": size_val,
                "unit": "cm",
                "status": "Đo tăng trưởng",
                "note": note_txt,
                "source_table": "crop_growth_logs",
                "timestampt": dt_vn.isoformat(),
            })
    except Exception as e:
        logger.warning(f"Office agent could not read crop_growth_logs: {e}")

    care_type_labels = {
        "Water": "Tưới Nước",
        "Fertilizer": "Bón Phân NPK",
        "Pesticide": "Phun Thuốc BVTV",
        "Prune": "Tỉa Cành / Chồi",
        "Inspect": "Kiểm Tra Sâu Bệnh",
    }
    try:
        client = get_supabase_client()
        cc_rows = client.table("crop_care_logs").select("*").order("created_at", desc=False).limit(300).execute().data or []
        for idx, cc in enumerate(cc_rows, start=1):
            created_at = cc.get("created_at")
            if not _matches_target_date(created_at, clean_date):
                continue
            crop_care_count += 1
            dt_vn = _parse_dt_vn(created_at, now_vn)
            cid = str(cc.get("crop_id") or "").strip()
            crop_label = crop_name_map.get(cid, cid or "Cây trồng")
            ctype = str(cc.get("type") or "Care").strip()
            type_label = care_type_labels.get(ctype, ctype)
            action_txt = str(cc.get("action") or "").strip()
            raw_note = str(cc.get("note") or "").strip()
            note_parts = [p for p in [action_txt, raw_note] if p]
            records_to_save.append({
                "user_id": user_id,
                "report_date": clean_date,
                "hour_slot": dt_vn.strftime("%H:%M"),
                "category": "nhat_ky_tang_truong",
                "code": f"CT-{idx:02d}",
                "item": f"Canh tác ({crop_label}): {action_txt or type_label}",
                "quantity_or_amount": 1,
                "unit": "lần",
                "status": type_label,
                "note": " • ".join(note_parts) or type_label,
                "source_table": "crop_care_logs",
                "timestampt": dt_vn.isoformat(),
            })
    except Exception as e:
        logger.warning(f"Office agent could not read crop_care_logs: {e}")

    # 4. Tạo bản Tổng Kết Cuối Ngày bằng AI Agent (hoặc fallback nếu không có Gemini)
    net_cash = total_thu - total_chi
    stats_text = (
        f"Ngày {clean_date}: "
        f"Thu {total_thu:,.0f}đ, Chi {total_chi:,.0f}đ (Chênh lệch {net_cash:+,.0f}đ); "
        f"Nhập kho {import_count} lượt, Xuất kho {export_count} lượt; "
        f"Xuất chuồng {animal_export_count} lượt; Thu hoạch {crop_harvest_count} lượt; "
        f"Nhân sự đủ công {staff_completed_count} người (tổng tiền công tự cộng {total_wages:,.0f}đ), "
        f"đang trong ca {staff_working_count} người, khoán {quotas_count} đầu việc, nghỉ phép {leaves_count} đơn; "
        f"Thông báo/cảnh báo {alerts_count} tin; "
        f"Nhật ký vật nuôi: {animal_health_count} lượt thú y, {animal_weight_count} lượt cân; "
        f"Nhật ký cây trồng: {crop_growth_count} lượt đo tăng trưởng, {crop_care_count} lượt chăm sóc."
    )

    ai_summary_note = ""
    if settings.is_gemini_configured:
        try:
            from google import genai
            client = genai.Client(api_key=settings.GEMINI_API_KEY)
            details_lines = "\n".join(
                f"- [{r['hour_slot']}] ({r['status']}) {r['item']}: {r['quantity_or_amount']:,.0f} {r['unit']} | {r['note']}"
                for r in records_to_save[:25]
            ) or "Chưa có giao dịch phát sinh trong ngày."
            prompt = (
                f"Bạn là V-Argon Office AI Agent — trợ lý tổng hợp báo cáo vận hành cuối ngày cho trang trại.\n"
                f"Số liệu ngày {clean_date}:\n{stats_text}\n\n"
                f"Chi tiết theo giờ:\n{details_lines}\n\n"
                "Hãy viết một đoạn tóm tắt quản trị cuối ngày súc tích (2-3 câu tiếng Việt), nêu rõ tình hình thu chi, biến động kho, xuất chuồng/thu hoạch và 1 lưu ý quản lý quan trọng."
            )
            response = client.models.generate_content(
                model=settings.GEMINI_MODEL,
                contents=prompt,
            )
            if response and response.text:
                ai_summary_note = response.text.strip()
        except Exception as e:
            logger.warning(f"Gemini end-of-day office summary failed: {e}")

    if not ai_summary_note:
        if len(records_to_save) == 0:
            ai_summary_note = f"Ngày {clean_date} chưa ghi nhận phát sinh thu chi, xuất nhập kho, xuất chuồng hoặc thu hoạch."
        else:
            ai_summary_note = stats_text

    summary_dt = now_vn if clean_date == now_vn.date().isoformat() else datetime.fromisoformat(f"{clean_date}T21:00:00+07:00")
    records_to_save.append({
        "user_id": user_id,
        "report_date": clean_date,
        "hour_slot": summary_dt.strftime("%H:%M"),
        "category": "tong_ket",
        "code": f"EOD-{clean_date.replace('-', '')}",
        "item": f"Tổng hợp cuối ngày {clean_date} ({len(records_to_save)} hoạt động)",
        "quantity_or_amount": net_cash,
        "unit": "VNĐ",
        "status": "Agent đã tổng hợp",
        "note": ai_summary_note,
        "source_table": "office_agent",
        "timestampt": summary_dt.isoformat(),
    })

    # Sắp xếp theo thời gian mới nhất trước khi lưu
    records_to_save.sort(key=lambda r: r.get("timestampt", ""), reverse=True)
    saved_rows = office_repo.replace_agent_records_for_date(
        report_date=clean_date,
        records=records_to_save,
        user_id=user_id,
    )

    result = {
        "status": "success",
        "report_date": clean_date,
        "storage_mode": office_repo.storage_mode,
        "count": len(saved_rows),
        "summary": {
            "total_thu": total_thu,
            "total_chi": total_chi,
            "net_cash": net_cash,
            "import_count": import_count,
            "export_count": export_count,
            "animal_export_count": animal_export_count,
            "crop_harvest_count": crop_harvest_count,
            "staff_completed_count": staff_completed_count,
            "staff_working_count": staff_working_count,
            "total_wages": total_wages,
            "quotas_count": quotas_count,
            "leaves_count": leaves_count,
            "alerts_count": alerts_count,
            "animal_health_count": animal_health_count,
            "animal_weight_count": animal_weight_count,
            "crop_growth_count": crop_growth_count,
            "crop_care_count": crop_care_count,
            "ai_note": ai_summary_note,
        },
        "records": saved_rows,
        "timestampt": summary_dt.isoformat(),
    }

    try:
        await ws_manager.broadcast(event="office_summary_update", data=result)
    except Exception as ws_err:
        logger.debug(f"Could not broadcast office_summary_update: {ws_err}")

    logger.info(f"V-Argon Office end-of-day summary completed for {clean_date}: {len(saved_rows)} rows ({office_repo.storage_mode}).")
    return result
