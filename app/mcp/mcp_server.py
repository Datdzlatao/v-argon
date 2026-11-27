import asyncio
import json
import logging
from datetime import date
from typing import Optional

from mcp.server.fastmcp import FastMCP
from app.config import get_settings
from app.db.repositories.env_logs import EnvLogsRepository
from app.db.repositories.inventory import InventoryRepository
from app.db.repositories.schedules import SchedulesRepository
from app.db.repositories.alerts import AlertsRepository
from app.db.repositories.pens import PensRepository
from app.db.repositories.devices import DevicesRepository
from app.db.repositories.animals import AnimalsRepository
from app.db.repositories.crops import CropsRepository
from app.db.repositories.feed_logs import FeedLogsRepository
from app.db.repositories.staff import StaffRepository
from app.api.websocket_manager import ws_manager

logger = logging.getLogger("smart_manager.mcp")

settings = get_settings()

# Initialize FastMCP Server
mcp = FastMCP(
    name=settings.MCP_SERVER_NAME,
    instructions="MCP Server cho Hệ Thống Quản Lý Đa Chuồng Trại Nông Nghiệp Thông Minh & IoT Tích Hợp AI Agent.",
)

# Initialize Repositories
env_repo = EnvLogsRepository()
inventory_repo = InventoryRepository()
schedules_repo = SchedulesRepository()
alerts_repo = AlertsRepository()
pens_repo = PensRepository()
devices_repo = DevicesRepository()
animals_repo = AnimalsRepository()
crops_repo = CropsRepository()
feed_repo = FeedLogsRepository()
staff_repo = StaffRepository()


def _notify_websocket_safe(event: str, data: dict):
    """Safely broadcast WebSocket event across sync or async execution contexts."""
    try:
        loop = asyncio.get_running_loop()
        loop.create_task(ws_manager.broadcast(event=event, data=data))
    except RuntimeError:
        try:
            asyncio.run(ws_manager.broadcast(event=event, data=data))
        except Exception as e:
            logger.warning(f"Could not broadcast via WebSocket: {e}")


# ====================================================================
# MCP RESOURCES (ĐỌC NGỮ CẢNH HỆ THỐNG TRANG TRẠI)
# ====================================================================

@mcp.resource("resource://farm/overview")
def get_farm_overview() -> str:
    """
    MCP Resource: Thống kê tổng quan toàn trang trại (danh sách chuồng, thiết bị, vật nuôi, cây trồng).
    """
    try:
        pens = pens_repo.list_all()
        devices = devices_repo.list_all()
        animals = animals_repo.list_all()
        crops = crops_repo.list_all()
        sick_animals = animals_repo.get_sick_or_attention_animals()

        overview = {
            "total_pens": len(pens),
            "total_devices": len(devices),
            "devices_active": len([d for d in devices if d.get("is_active")]),
            "total_animals": len(animals),
            "sick_or_attention_animals": len(sick_animals),
            "total_crops": len(crops),
            "pens": [
                {
                    "id": p.get("id"),
                    "name": p.get("name"),
                    "type": p.get("type"),
                    "animals_count": len(animals_repo.list_by_pen(p.get("id"))),
                    "devices_count": len(devices_repo.list_by_pen(p.get("id"))),
                }
                for p in pens
            ],
        }
        return json.dumps(overview, ensure_ascii=False, default=str, indent=2)
    except Exception as e:
        logger.error(f"Error reading farm overview resource: {e}")
        return f"Lỗi đọc farm overview: {str(e)}"


@mcp.resource("resource://pens/list")
def get_pens_list() -> str:
    """
    MCP Resource: Danh sách đầy đủ tất cả các chuồng trại kèm thống kê chi tiết theo chuồng.
    """
    try:
        pens = pens_repo.list_all()
        pens_detailed = []
        for p in pens:
            pid = str(p.get("id"))
            animals = animals_repo.list_by_pen(pid)
            devices = devices_repo.list_by_pen(pid)
            latest_env = env_repo.get_latest_logs(limit=1, pen_id=pid)
            pens_detailed.append({
                "pen_id": pid,
                "name": p.get("name"),
                "type": p.get("type"),
                "animals": [{"id": a.get("id"), "species": a.get("species"), "status": a.get("status")} for a in animals],
                "devices": [{"id": d.get("id"), "name": d.get("name"), "is_active": d.get("is_active")} for d in devices],
                "telemetry": latest_env[0] if latest_env else None,
            })
        return json.dumps(pens_detailed, ensure_ascii=False, default=str, indent=2)
    except Exception as e:
        return f"Lỗi lấy danh sách chuồng: {str(e)}"


@mcp.resource("resource://env/latest")
def get_latest_env_logs() -> str:
    """
    MCP Resource: Lấy các bản ghi cảm biến môi trường mới nhất trên toàn trại.
    """
    try:
        logs = env_repo.get_latest_logs(limit=10)
        if not logs:
            return "Chưa có dữ liệu cảm biến môi trường nào trong hệ thống."
        return json.dumps(logs, ensure_ascii=False, default=str, indent=2)
    except Exception as e:
        logger.error(f"Error fetching env logs resource: {e}")
        return f"Lỗi khi đọc resource://env/latest: {str(e)}"


@mcp.resource("resource://inventory/low-stock")
def get_low_stock_inventory() -> str:
    """
    MCP Resource: Lấy danh sách thức ăn, thuốc, vật tư chạm hoặc thấp hơn ngưỡng tối thiểu.
    """
    try:
        low_stock = inventory_repo.get_low_stock()
        if not low_stock:
            return "Tất cả vật tư trong kho đều đang ở mức an toàn (không có mặt hàng nào thiếu hụt)."
        return json.dumps(low_stock, ensure_ascii=False, default=str, indent=2)
    except Exception as e:
        logger.error(f"Error fetching low stock resource: {e}")
        return f"Lỗi khi đọc resource://inventory/low-stock: {str(e)}"


@mcp.resource("resource://animals/attention")
def get_animals_attention() -> str:
    """
    MCP Resource: Danh sách vật nuôi cần chăm sóc đặc biệt (ốm, sốt, bỏ ăn) kèm chuồng hiện tại.
    """
    try:
        sick = animals_repo.get_sick_or_attention_animals()
        if not sick:
            return "Tất cả vật nuôi trong trang trại đều khỏe mạnh bình thường."
        return json.dumps(sick, ensure_ascii=False, default=str, indent=2)
    except Exception as e:
        return f"Lỗi đọc danh sách vật nuôi: {str(e)}"


@mcp.resource("resource://crops/harvest")
def get_crops_harvest() -> str:
    """
    MCP Resource: Danh sách cây trồng / vụ mùa sắp đến hạn thu hoạch trong 7 ngày tới.
    """
    try:
        upcoming = crops_repo.get_upcoming_harvests(within_days=7)
        if not upcoming:
            return "Không có cây trồng nào cần thu hoạch trong 7 ngày tới."
        return json.dumps(upcoming, ensure_ascii=False, default=str, indent=2)
    except Exception as e:
        return f"Lỗi đọc thông tin cây trồng: {str(e)}"


@mcp.resource("resource://staff/today")
def get_today_staff_attendance() -> str:
    """
    MCP Resource: Danh sách nhân sự trang trại đã có mặt / điểm danh hôm nay kèm thời gian và chuồng phụ trách.
    """
    try:
        attendance = staff_repo.get_today_attendance()
        if not attendance:
            return "Hôm nay chưa có nhân sự nào điểm danh vào ca."
        return json.dumps(attendance, ensure_ascii=False, default=str, indent=2)
    except Exception as e:
        return f"Lỗi đọc điểm danh nhân sự: {str(e)}"


@mcp.resource("resource://staff/list")
def get_all_staff_resource() -> str:
    """
    MCP Resource: Danh sách toàn bộ nhân sự trang trại, chức vụ và chuồng trại phụ trách.
    """
    try:
        staff_members = staff_repo.list_all()
        return json.dumps(staff_members, ensure_ascii=False, default=str, indent=2)
    except Exception as e:
        return f"Lỗi đọc danh sách nhân sự: {str(e)}"


# ====================================================================
# MCP TOOLS (CÁNH TAY THỰC THI CHO AI AGENT)
# ====================================================================

@mcp.tool()
def transfer_animal_pen(
    animal_id: str,
    target_pen_id: str,
    reason: str = "",
) -> str:
    """
    Chuyển đổi cá thể vật nuôi từ chuồng hiện tại sang chuồng khác (ví dụ: chuyển sang chuồng cách ly y tế, chuồng xuất chuồng, hoặc đổi khu).

    Args:
        animal_id: Mã định danh cá thể vật nuôi (ví dụ: 'HEO-101', 'HEO-102')
        target_pen_id: Mã chuồng mới chuyển đến (ví dụ: 'PEN-ISO-01', 'PEN-A02', '123')
        reason: Lý do điều chuyển chuồng (ví dụ: 'Cách ly điều trị sốt', 'Tách đàn nuôi thịt')
    """
    try:
        target_clean = target_pen_id.strip()
        animal_clean = animal_id.strip()

        # Kiểm tra chuồng đích, nếu chưa có thì tự động tạo
        pen = pens_repo.get_by_id(target_clean)
        if pen:
            target_clean = pen.get("id")
        else:
            pens_repo.create_pen(pen_id=target_clean, name=f"Chuồng {target_clean}")

        res = animals_repo.transfer_pen(
            animal_id=animal_clean,
            target_pen_id=target_clean,
            reason=reason,
        )

        _notify_websocket_safe("animal_transfer", res)
        return (
            f"🚚 ĐÃ CHUYỂN CHUỒNG THÀNH CÔNG: Vật nuôi '{animal_clean}' từ [{res.get('old_pen_id')}] "
            f"sang [{target_clean}]. Lý do: {reason or 'Điều chuyển chuồng trại'}."
        )
    except Exception as e:
        logger.error(f"Error in transfer_animal_pen: {e}")
        return f"❌ Lỗi khi chuyển chuồng: {str(e)}"


@mcp.tool()
def get_pen_status(pen_id: str) -> str:
    """
    Tra cứu chi tiết một chuồng bất kỳ: Chỉ số cảm biến (nhiệt độ, độ ẩm, mùi), thiết bị IoT và danh sách vật nuôi hiện có.

    Args:
        pen_id: Mã chuồng cần tra cứu (ví dụ: '123', 'PEN-A02', 'PEN-ISO-01', 'PEN-B01')
    """
    clean_pen = pen_id.strip()
    pen = pens_repo.get_by_id(clean_pen)
    if not pen:
        return f"❌ Không tìm thấy chuồng có mã '{clean_pen}' trong hệ thống."

    animals = animals_repo.list_by_pen(clean_pen)
    devices = devices_repo.list_by_pen(clean_pen)
    latest_env = env_repo.get_latest_logs(limit=1, pen_id=clean_pen)

    status_data = {
        "pen_id": clean_pen,
        "name": pen.get("name"),
        "type": pen.get("type"),
        "latest_sensor": latest_env[0] if latest_env else "Chưa có dữ liệu cảm biến",
        "total_animals": len(animals),
        "animals": [{"id": a.get("id"), "species": a.get("species"), "status": a.get("status"), "weight": a.get("weight")} for a in animals],
        "devices": [{"id": d.get("id"), "name": d.get("name"), "is_active": d.get("is_active")} for d in devices],
    }
    return json.dumps(status_data, ensure_ascii=False, default=str, indent=2)


@mcp.tool()
def manage_pen(
    action: str,
    pen_id: str,
    name: str = "",
    pen_type: str = "livestock",
) -> str:
    """
    Quản lý chuồng trại: Thêm chuồng mới hoặc cập nhật thông tin chuồng.

    Args:
        action: 'create' hoặc 'update'
        pen_id: Mã chuồng (ví dụ: 'PEN-A03', 'PEN-ISO-02')
        name: Tên gọi chuồng (ví dụ: 'Chuồng Heo Nái A3')
        pen_type: Phân loại: 'livestock' (gia súc), 'crops' (trồng trọt), 'greenhouse' (nhà màng)
    """
    action_clean = action.strip().lower()
    clean_id = pen_id.strip()

    try:
        if action_clean in ["create", "add"]:
            created = pens_repo.create_pen(pen_id=clean_id, name=name or f"Chuồng {clean_id}", pen_type=pen_type)
            _notify_websocket_safe("pen_update", {"action": "create", "pen": created})
            return f"✅ Đã tạo mới thành công chuồng [{clean_id}] - '{created.get('name')}' (Loại: {pen_type})."
        else:
            return f"❌ Hành động '{action}' không hỗ trợ. Vui lòng chọn 'create'."
    except Exception as e:
        return f"❌ Lỗi quản lý chuồng: {str(e)}"


@mcp.tool()
def control_device(
    action: str,
    device_name: str = "",
    pen_id: str = "123",
    device_id: str = "",
) -> str:
    """
    Điều khiển thiết bị IoT tại chuồng trại bất kỳ (bật/tắt quạt thông gió, đèn sưởi, máy phun sương).

    Args:
        action: 'turn_on' (bật), 'turn_off' (tắt), hoặc 'toggle'
        device_name: Tên thiết bị (ví dụ: 'quạt', 'bóng đèn', 'phun sương', 'nước')
        pen_id: Mã chuồng lắp đặt thiết bị (ví dụ: '123', 'PEN-A02', 'PEN-ISO-01')
        device_id: Mã định danh thiết bị nếu biết chính xác
    """
    action_clean = action.strip().lower()
    is_active = True if action_clean in ["turn_on", "on", "bat", "bật", "mo", "mở"] else False

    try:
        updated = devices_repo.set_device_state(
            device_id=device_id if device_id else None,
            pen_id=pen_id if pen_id else "123",
            device_name=device_name if device_name else None,
            is_active=is_active,
        )
        status_text = "ĐÃ BẬT 🟢" if is_active else "ĐÃ TẮT 🔴"
        _notify_websocket_safe("device_update", updated)
        return f"✅ {status_text} thiết bị '{updated.get('name')}' (ID: {updated.get('id')}) tại chuồng {pen_id}."
    except Exception as e:
        logger.error(f"Error in control_device: {e}")
        return f"❌ Lỗi khi điều khiển thiết bị: {str(e)}"


@mcp.tool()
def log_feeding(
    pen_id: str,
    food_name: str,
    amount: float,
) -> str:
    """
    Ghi nhận cho vật nuôi ăn tại chuồng được chỉ định và tự động trừ số lượng tồn kho tương ứng trong bảng inventory.

    Args:
        pen_id: Mã chuồng được cho ăn (ví dụ: '123', 'PEN-A02', 'PEN-ISO-01')
        food_name: Tên loại thức ăn (ví dụ: 'Cám Con Cò Siêu Tăng Trọng')
        amount: Số lượng thức ăn cho ăn (kg)
    """
    if amount <= 0:
        return "❌ Lượng thức ăn cho ăn phải lớn hơn 0."

    try:
        updated_stock = inventory_repo.adjust_quantity(
            item_name=food_name,
            delta_quantity=-abs(amount),
            pen_id=pen_id,
            note=f"Xuất cho chuồng {pen_id} ăn",
        )

        feed_log = feed_repo.log_feeding(pen_id=pen_id, food_name=food_name, amount=amount)

        _notify_websocket_safe("feed_update", {"feed_log": feed_log, "inventory": updated_stock})

        warning = ""
        if float(updated_stock.get("quantity", 0)) <= float(updated_stock.get("min_threshold", 5.0)):
            warning = f" ⚠️ CẢNH BÁO: Thức ăn '{food_name}' đã chạm/dưới ngưỡng an toàn ({updated_stock.get('quantity')} {updated_stock.get('unit')} còn lại)!"

        return f"✅ Đã ghi nhận cho chuồng {pen_id} ăn {amount} kg '{food_name}'. Tồn kho còn lại: {updated_stock.get('quantity')} {updated_stock.get('unit')}.{warning}"

    except ValueError as ve:
        return f"❌ Lỗi cho ăn: {str(ve)}"
    except Exception as e:
        logger.error(f"Error in log_feeding: {e}")
        return f"❌ Lỗi hệ thống khi ghi nhận cho ăn: {str(e)}"


@mcp.tool()
def update_animal_health(
    animal_id: str,
    status: str,
    note: str = "",
    health_type: str = "Disease",
) -> str:
    """
    Cập nhật tình trạng sức khỏe hoặc bệnh tật cho cá thể vật nuôi (Khỏe, Sốt nhẹ, Bệnh Tai Xanh, Dịch tả heo châu phi, Tiêu chảy PED, Cách ly) và lưu nhật ký y tế/phác đồ điều trị.

    Args:
        animal_id: Mã định danh cá thể (ví dụ: 'HEO-101', 'HEO-102', 'HEO-201')
        status: Trạng thái sức khỏe hoặc tên bệnh lý mới ('Khoe', 'Sot nhe', 'Bo an', 'Cach ly', 'Bệnh Tai Xanh', 'Dịch tả', ...)
        note: Ghi chú triệu chứng hoặc hướng điều trị y tế
        health_type: Phân loại nhật ký ('Routine', 'Disease', 'Vaccine')
    """
    try:
        res = animals_repo.update_health_status(
            animal_id=animal_id,
            status=status,
            note=note,
            health_type=health_type,
        )
        _notify_websocket_safe("animal_update", res)
        return f"✅ Đã cập nhật sức khỏe vật nuôi '{animal_id}' sang trạng thái: [{status}]. Ghi chú y tế: {note or 'Không có'}."
    except Exception as e:
        logger.error(f"Error in update_animal_health: {e}")
        return f"❌ Lỗi khi cập nhật sức khỏe: {str(e)}"


@mcp.tool()
def add_animal(
    species: str = "Heo",
    pen_id: str = "123",
    count: int = 1,
    animal_id: str = "",
    weight: float = 50.0,
    target_weight: float = 100.0,
    status: str = "Khoe",
) -> str:
    """
    Thêm cá thể mới hoặc thêm số lượng vật nuôi vào chuồng trại (ví dụ: thêm 5 con heo vào chuồng PEN-A02, hoặc thêm cá thể bò BO-01).

    Args:
        species: Loài vật nuôi (ví dụ: 'Heo', 'Heo Siêu Nạc', 'Bò', 'Gà', 'Dê', 'Vịt')
        pen_id: Mã chuồng cần thêm vật nuôi (ví dụ: '123', 'PEN-A02', 'PEN-ISO-01')
        count: Số lượng con vật cần thêm (mặc định: 1)
        animal_id: Mã định danh nếu thêm đích danh 1 cá thể (ví dụ: 'HEO-105', 'BO-01', để trống để hệ thống tự sinh mã)
        weight: Trọng lượng ban đầu (kg)
        target_weight: Trọng lượng mục tiêu (kg)
        status: Tình trạng ban đầu ('Khoe', 'Sot nhe', ...)
    """
    try:
        clean_pen = pen_id.strip() if pen_id else "123"
        pen = pens_repo.get_by_id(clean_pen)
        if pen:
            clean_pen = pen.get("id")
        else:
            pens_repo.create_pen(pen_id=clean_pen, name=f"Chuồng {clean_pen}")

        if count > 1 or not animal_id.strip():
            created_list = animals_repo.add_animals_batch(
                count=count,
                species=species,
                pen_id=clean_pen,
                base_id=animal_id if animal_id.strip() else None,
                weight=weight,
                target_weight=target_weight,
                status=status,
            )
            _notify_websocket_safe("animal_update", {"action": "batch_create", "animals": created_list})
            ids_str = ", ".join([a.get("id") for a in created_list])
            return f"🐾 ĐÃ THÊM THÀNH CÔNG {len(created_list)} con {species} vào chuồng [{clean_pen}]. Danh sách mã: [{ids_str}]."
        else:
            created = animals_repo.add_animal(
                animal_id=animal_id.strip(),
                species=species,
                pen_id=clean_pen,
                weight=weight,
                target_weight=target_weight,
                status=status,
            )
            _notify_websocket_safe("animal_update", {"action": "create", "animal": created})
            return f"🐾 ĐÃ THÊM THÀNH CÔNG vật nuôi '{created.get('id')}' ({species}) vào chuồng [{clean_pen}]. Cân nặng: {weight}kg."
    except Exception as e:
        logger.error(f"Error in add_animal: {e}")
        return f"❌ Lỗi khi thêm vật nuôi: {str(e)}"


def _resolve_crop(crop_name_or_id: str, pen_id: str = ""):
    """Helper to locate a crop by ID or partial name."""
    clean_val = str(crop_name_or_id).strip()
    try:
        cid = int(clean_val)
        c = crops_repo.get_by_id(cid)
        if c:
            return c
    except ValueError:
        pass

    c = crops_repo.find_by_name(clean_val, pen_id=pen_id if pen_id else None)
    if c:
        return c

    for part in ["cà chua", "dưa lưới", "rau muống", "lúa", "dâu tây", "xà lách"]:
        if part in clean_val.lower():
            c = crops_repo.find_by_name(part, pen_id=pen_id if pen_id else None)
            if c:
                return c
    return None


@mcp.tool()
def plant_crop(
    name: str,
    quantity: int = 1,
    pen_id: str = "PEN-B01",
    plant_date: str = "",
    harvest_date: str = "",
    status: str = "Growing",
) -> str:
    """
    Trồng cây trồng mới hoặc gieo vụ mùa mới vào khu vực/chuồng trồng trọt (ví dụ: trồng 50 cây cà chua vào chuồng PEN-B01).

    Args:
        name: Tên cây trồng (ví dụ: 'Cà Chua Cherry', 'Dưa Lưới Fuji F1', 'Rau Muống', 'Lúa ST25')
        quantity: Số lượng cây trồng (ví dụ: 50, 100, 500)
        pen_id: Mã chuồng/khu vực nhà màng (ví dụ: 'PEN-B01', 'PEN-B02', 'Vườn01')
        plant_date: Ngày trồng (định dạng YYYY-MM-DD, để trống sẽ lấy hôm nay)
        harvest_date: Ngày dự kiến thu hoạch (YYYY-MM-DD, tùy chọn)
        status: Trạng thái sinh trưởng ban đầu ('Growing', 'Flowering', 'Ripening')
    """
    try:
        clean_pen = pen_id.strip() if pen_id else "PEN-B01"
        pen = pens_repo.get_by_id(clean_pen)
        if pen:
            clean_pen = pen.get("id")
        else:
            pens_repo.create_pen(pen_id=clean_pen, name=f"Khu Trồng {clean_pen}", pen_type="crops")

        created = crops_repo.create_crop(
            name=name,
            quantity=quantity,
            pen_id=clean_pen,
            plant_date=plant_date or None,
            harvest_date=harvest_date or None,
            status=status,
        )
        _notify_websocket_safe("crop_update", {"action": "create", "crop": created})
        return (
            f"🌱 ĐÃ TRỒNG CÂY THÀNH CÔNG: Đã thêm {quantity} cây '{name}' (ID: {created.get('id')}) "
            f"vào khu vực [{clean_pen}]. Ngày trồng: {created.get('plant_date')}. Trạng thái: {status}."
        )
    except Exception as e:
        logger.error(f"Error in plant_crop: {e}")
        return f"❌ Lỗi khi trồng cây: {str(e)}"


@mcp.tool()
def manage_crop_quantity(
    crop_name_or_id: str,
    quantity: int,
    action: str = "set",
    pen_id: str = "",
) -> str:
    """
    Thay đổi hoặc cập nhật số lượng cây trồng cho một vụ mùa/loại cây (ví dụ: tăng thêm 30 cây, giảm 10 cây, hoặc đặt số lượng là 100 cây).

    Args:
        crop_name_or_id: Tên cây trồng hoặc mã ID (ví dụ: 'Dưa Lưới', 'Cà Chua', 'Rau Muống', '12')
        quantity: Số lượng cây (giá trị mới hoặc số lượng thay đổi)
        action: Hành động: 'set' (đặt số lượng mới), 'add'/'increase' (tăng thêm), 'reduce'/'decrease' (giảm bớt)
        pen_id: Mã chuồng nếu cần lọc chính xác theo khu vực
    """
    try:
        crop = _resolve_crop(crop_name_or_id, pen_id=pen_id)
        if not crop:
            return f"❌ Không tìm thấy cây trồng '{crop_name_or_id}' trong trang trại."

        mode = "adjust" if action.lower() in ["add", "increase", "them", "tăng", "reduce", "decrease", "giam", "giảm"] else "set"
        delta_qty = -abs(quantity) if action.lower() in ["reduce", "decrease", "giam", "giảm"] else quantity

        updated = crops_repo.update_quantity(
            crop_id=crop["id"],
            quantity=delta_qty,
            mode=mode,
        )
        _notify_websocket_safe("crop_update", {"action": "update_quantity", "crop": updated})
        return f"🌳 ĐÃ CẬP NHẬT SỐ LƯỢNG CÂY TRỒNG: Cây '{crop.get('name')}' (ID: {crop.get('id')}) hiện có số lượng: {updated.get('quantity')} cây."
    except Exception as e:
        logger.error(f"Error in manage_crop_quantity: {e}")
        return f"❌ Lỗi khi thay đổi số lượng cây: {str(e)}"


@mcp.tool()
def log_crop_growth(
    crop_name_or_id: str,
    size: float,
    note: str = "",
    pen_id: str = "",
) -> str:
    """
    Cập nhật kích thước, chiều cao hoặc đường kính phát triển của cây trồng (ví dụ: cây cao 25 cm, đường kính quả 8 cm).

    Args:
        crop_name_or_id: Tên cây hoặc mã ID (ví dụ: 'Dưa Lưới', 'Cà Chua', 'Rau Muống', '12')
        size: Kích thước đo đạc được (cm)
        note: Ghi chú giai đoạn tăng trưởng (ví dụ: 'Bắt đầu ra hoa', 'Phát triển tốt')
        pen_id: Mã chuồng nếu cần xác định rõ khu vực
    """
    try:
        crop = _resolve_crop(crop_name_or_id, pen_id=pen_id)
        if not crop:
            clean_pen = pen_id if pen_id else "PEN-B01"
            crop = crops_repo.create_crop(name=crop_name_or_id, quantity=1, pen_id=clean_pen)

        log_entry = crops_repo.log_growth(
            crop_id=crop["id"],
            size=size,
            note=note,
        )
        _notify_websocket_safe("crop_growth_logs", log_entry)
        return (
            f"📏 ĐÃ CẬP NHẬT KÍCH THƯỚC CÂY TRỒNG: Cây '{crop.get('name')}' (ID: {crop.get('id')}) "
            f"đạt kích thước: {size} cm. Ghi chú: {note or 'Phát triển bình thường'}."
        )
    except Exception as e:
        logger.error(f"Error in log_crop_growth: {e}")
        return f"❌ Lỗi cập nhật kích thước cây: {str(e)}"


@mcp.tool()
def log_crop_care(
    crop_name_or_id: str,
    care_type: str = "Tưới nước",
    note: str = "",
    pen_id: str = "",
) -> str:
    """
    Ghi nhật ký chăm sóc cây trồng (ví dụ: tưới nước, bón phân NPK, tỉa lá, phun thuốc vi sinh, bắt sâu).

    Args:
        crop_name_or_id: Tên cây hoặc mã ID (ví dụ: 'Dưa Lưới', 'Cà Chua', 'Rau Muống', '12')
        care_type: Loại công việc chăm sóc ('Tưới nước', 'Bón phân', 'Tỉa lá', 'Phun thuốc', ...)
        note: Chi tiết liều lượng hoặc kỹ thuật chăm sóc
        pen_id: Mã chuồng nếu cần chỉ định khu vực
    """
    try:
        crop = _resolve_crop(crop_name_or_id, pen_id=pen_id)
        if not crop:
            clean_pen = pen_id if pen_id else "PEN-B01"
            crop = crops_repo.create_crop(name=crop_name_or_id, quantity=1, pen_id=clean_pen)

        care_entry = crops_repo.log_care(
            crop_id=crop["id"],
            care_type=care_type,
            note=note,
        )
        _notify_websocket_safe("crop_care_logs", care_entry)
        return (
            f"💧 ĐÃ GHI NHẬT KÝ CHĂM SÓC: Cây '{crop.get('name')}' (ID: {crop.get('id')}) - "
            f"Hoạt động: [{care_type}]. Nội dung: {note or 'Đã hoàn thành'}."
        )
    except Exception as e:
        logger.error(f"Error in log_crop_care: {e}")
        return f"❌ Lỗi ghi nhật ký chăm sóc cây: {str(e)}"


@mcp.tool()
def update_crop_disease(
    crop_name_or_id: str,
    disease_name: str,
    note: str = "",
    pen_id: str = "",
) -> str:
    """
    Cập nhật bệnh hoặc sâu bệnh hại cho cây trồng, đồng thời lưu nhật ký xử lý điều trị thực vật.

    Args:
        crop_name_or_id: Tên cây hoặc mã ID (ví dụ: 'Dưa Lưới', 'Cà Chua', 'Rau Muống', '12')
        disease_name: Tên bệnh lý hoặc sâu bệnh (ví dụ: 'Sương mai', 'Đạo ôn', 'Rầy nâu', 'Thán thư', 'Bọ trĩ')
        note: Mô tả triệu chứng hoặc phác đồ xử lý thuốc bảo vệ thực vật
        pen_id: Mã chuồng nếu cần
    """
    try:
        crop = _resolve_crop(crop_name_or_id, pen_id=pen_id)
        if not crop:
            clean_pen = pen_id if pen_id else "PEN-B01"
            crop = crops_repo.create_crop(name=crop_name_or_id, quantity=1, pen_id=clean_pen)

        new_status = f"Bệnh: {disease_name}"
        crops_repo.update_status(crop_id=crop["id"], status=new_status)

        care_note = f"Ghi nhận bệnh {disease_name}. {note}".strip()
        crops_repo.log_care(crop_id=crop["id"], care_type="Disease Treatment", note=care_note)

        _notify_websocket_safe("crop_update", {"action": "disease", "crop_id": crop["id"], "disease": disease_name})
        return (
            f"🩺 ĐÃ CẬP NHẬT BỆNH CÂY TRỒNG: Cây '{crop.get('name')}' (ID: {crop.get('id')}) "
            f"đã chuyển sang trạng thái [{new_status}]. Nhật ký y tế thực vật đã được lưu."
        )
    except Exception as e:
        logger.error(f"Error in update_crop_disease: {e}")
        return f"❌ Lỗi cập nhật bệnh cây trồng: {str(e)}"


@mcp.tool()
def manage_inventory(
    action: str,
    name: str,
    quantity: float = 0.0,
    unit: str = "kg",
    category: str = "Feed",
) -> str:
    """
    Quản lý kho thức ăn, thuốc thú y, phân bón: Thêm mới, nhập kho, xuất kho hoặc điều chỉnh.
    """
    action_clean = action.strip().lower()
    item_clean = name.strip()

    try:
        if action_clean in ["create", "add"]:
            created = inventory_repo.create_item(
                item_name=item_clean,
                quantity=quantity,
                unit=unit,
                category=category,
            )
            _notify_websocket_safe("inventory_update", {"action": "create", "item": created})
            return f"✅ Đã thêm mới mặt hàng '{item_clean}' ({category}) với số lượng {quantity} {unit}."

        elif action_clean in ["import", "increase", "add_stock"]:
            if quantity <= 0:
                return "❌ Số lượng nhập kho phải lớn hơn 0."
            updated = inventory_repo.adjust_quantity(item_name=item_clean, delta_quantity=abs(quantity))
            _notify_websocket_safe("inventory_update", {"action": "import", "item": updated})
            return f"✅ Đã nhập thêm {quantity} {updated.get('unit')} vào kho cho '{item_clean}'. Tồn kho hiện tại: {updated.get('quantity')} {updated.get('unit')}."

        elif action_clean in ["export", "decrease", "reduce_stock"]:
            if quantity <= 0:
                return "❌ Số lượng xuất kho phải lớn hơn 0."
            updated = inventory_repo.adjust_quantity(item_name=item_clean, delta_quantity=-abs(quantity))
            _notify_websocket_safe("inventory_update", {"action": "export", "item": updated})
            warning = ""
            if float(updated.get("quantity", 0)) <= float(updated.get("min_threshold", 5.0)):
                warning = f" ⚠️ CẢNH BÁO: Mặt hàng này hiện đã chạm/dưới ngưỡng an toàn ({updated.get('quantity')} {updated.get('unit')})!"
            return f"✅ Đã xuất {quantity} {updated.get('unit')} khỏi kho cho '{item_clean}'. Tồn kho còn lại: {updated.get('quantity')} {updated.get('unit')}.{warning}"

        else:
            return f"❌ Hành động '{action}' không hợp lệ. Hãy chọn: 'import', 'export', 'create'."

    except ValueError as ve:
        return f"❌ Lỗi kho: {str(ve)}"
    except Exception as e:
        logger.error(f"Error in manage_inventory: {e}")
        return f"❌ Lỗi hệ thống khi thao tác kho: {str(e)}"


@mcp.tool()
def manage_schedule(
    action: str,
    task_name: str,
    target_date: str = "",
    pen_id: str = "123",
    note: str = "",
) -> str:
    """
    Quản lý lịch trình công việc: Tạo lịch công việc mới hoặc cập nhật hoàn thành theo chuồng.
    """
    action_clean = action.strip().lower()
    task_clean = task_name.strip()

    try:
        final_date = target_date.strip() if target_date.strip() else date.today().isoformat()

        if action_clean in ["create", "add"]:
            created = schedules_repo.create_schedule(
                task_name=task_clean,
                target_date=final_date,
                pen_id=pen_id,
                note=note,
                status="pending",
            )
            _notify_websocket_safe("schedule_update", {"action": "create", "schedule": created})
            return f"✅ Đã lên lịch thành công cho công việc: '{task_clean}' vào ngày {final_date} (Chuồng {pen_id}). Ghi chú: {note or 'Không có'}."

        elif action_clean in ["done", "complete", "finish"]:
            updated = schedules_repo.update_schedule(
                task_name=task_clean,
                status="done",
                note=f"Hoàn thành lúc {date.today().isoformat()} - {note}" if note else None,
            )
            _notify_websocket_safe("schedule_update", {"action": "done", "schedule": updated})
            return f"🎉 Đã cập nhật công việc '{task_clean}' sang trạng thái HOÀN THÀNH."

        else:
            return f"❌ Hành động '{action}' không hợp lệ. Vui lòng chọn 'create' hoặc 'done'."

    except Exception as e:
        logger.error(f"Error in manage_schedule: {e}")
        return f"❌ Lỗi hệ thống khi thao tác lịch trình: {str(e)}"


@mcp.tool()
def create_system_alert(
    alert_type: str,
    message: str,
    pen_id: str = "123",
) -> str:
    """
    Tạo cảnh báo bất thường trong trang trại (môi trường, mùi hôi, sức khỏe vật nuôi, cạn kho) và phát realtime qua WebSocket.
    """
    try:
        created = alerts_repo.create_alert(alert_type=alert_type, message=message, pen_id=pen_id)
        _notify_websocket_safe("alert", created)
        return f"🚨 Đã phát và lưu cảnh báo thành công: [{created.get('alert_type')}] {created.get('message')} (Chuồng: {pen_id})."
    except Exception as e:
        logger.error(f"Error in create_system_alert: {e}")
        return f"❌ Lỗi khi ghi nhận cảnh báo: {str(e)}"


# ====================================================================
# MCP STAFF MANAGEMENT & FACE ATTENDANCE TOOLS
# ====================================================================

@mcp.tool()
def get_staff_list(pen_id: str = "") -> str:
    """
    Tra cứu danh sách nhân sự trang trại, chức danh và phân công chuồng phụ trách.

    Args:
        pen_id: Mã chuồng cần lọc nhân sự (ví dụ: '123', 'PEN-ISO-01', để trống để xem tất cả)
    """
    try:
        clean_pen = pen_id.strip() if pen_id else None
        staff = staff_repo.list_all(pen_id=clean_pen)
        if not staff:
            return f"Không tìm thấy nhân sự nào thuộc khu vực/chuồng '{pen_id}'." if pen_id else "Chưa có nhân sự nào trong hệ thống."
        return json.dumps(staff, ensure_ascii=False, default=str, indent=2)
    except Exception as e:
        logger.error(f"Error in get_staff_list: {e}")
        return f"❌ Lỗi tra cứu danh sách nhân sự: {str(e)}"


@mcp.tool()
def check_in_staff_face(
    staff_id: str,
    pen_id: str = "123",
    note: str = "",
) -> str:
    """
    Điểm danh nhân sự vào ca trực tại chuồng trại thông qua AI nhận diện khuôn mặt (FaceID).

    Args:
        staff_id: Mã nhân viên (ví dụ: 'NV01', 'NV02', 'NV03')
        pen_id: Mã chuồng nhân sự bắt đầu làm việc (ví dụ: '123', 'PEN-A02', 'PEN-ISO-01')
        note: Ghi chú ca trực hoặc kiểm tra bảo hộ
    """
    try:
        staff_member = staff_repo.get_by_id(staff_id)
        if not staff_member:
            return f"❌ Không tìm thấy nhân sự có mã '{staff_id}' trong hệ thống."

        staff_name = staff_member.get("name", staff_id)
        record = staff_repo.log_attendance(
            staff_id=staff_id,
            staff_name=staff_name,
            pen_id=pen_id,
            status="present",
            confidence=0.98,
            is_real=True,
            note=note or "Điểm danh FaceID thành công qua AI Agent",
        )

        _notify_websocket_safe("staff_checkin", record)
        return (
            f"✅ ĐÃ ĐIỂM DANH THÀNH CÔNG: Nhân sự [{staff_id}] {staff_name} - {staff_member.get('role')} "
            f"đã nhận ca tại chuồng [{pen_id}]. Độ tin cậy Face AI: 98% (Người thật). Ghi chú: {note or 'Vào ca đúng giờ'}."
        )
    except Exception as e:
        logger.error(f"Error in check_in_staff_face: {e}")
        return f"❌ Lỗi khi điểm danh nhân sự: {str(e)}"


@mcp.tool()
def get_today_attendance_summary() -> str:
    """
    Tổng hợp báo cáo điểm danh nhân sự hôm nay: Số người đã vào ca, danh sách có mặt và chuồng phụ trách.
    """
    try:
        attendance = staff_repo.get_today_attendance()
        all_staff = staff_repo.list_all()
        present_ids = {a.get("staff_id") for a in attendance}

        summary = {
            "total_staff": len(all_staff),
            "present_count": len(present_ids),
            "absent_count": max(0, len(all_staff) - len(present_ids)),
            "checked_in": [
                {
                    "staff_id": a.get("staff_id"),
                    "name": a.get("staff_name"),
                    "pen_id": a.get("pen_id"),
                    "time": a.get("created_at"),
                    "confidence": a.get("confidence"),
                }
                for a in attendance
            ],
            "not_checked_in": [
                {"staff_id": s.get("id"), "name": s.get("name"), "role": s.get("role"), "pen_id": s.get("pen_id")}
                for s in all_staff if s.get("id") not in present_ids
            ],
        }
        return json.dumps(summary, ensure_ascii=False, default=str, indent=2)
    except Exception as e:
        return f"❌ Lỗi tổng hợp báo cáo điểm danh: {str(e)}"


# ====================================================================
# MCP RAG KNOWLEDGE BASE TOOLS & RESOURCES (TÍCH HỢP TỪ WORKFLOW STEM)
# ====================================================================

@mcp.resource("resource://knowledge/overview")
def get_knowledge_overview() -> str:
    """
    MCP Resource: Tổng quan cơ sở tri thức RAG nông nghiệp & danh mục phác đồ điều trị bệnh lý.
    """
    from app.services.rag_service import BUILTIN_KNOWLEDGE_DOCS
    overview = {
        "status": "ready",
        "pinecone_configured": settings.is_pinecone_configured,
        "index_name": settings.PINECONE_INDEX_NAME,
        "total_protocols": len(BUILTIN_KNOWLEDGE_DOCS),
        "available_protocols": [
            {
                "id": doc.get("id"),
                "category": doc.get("category"),
                "species": doc.get("species"),
                "disease": doc.get("disease_name"),
            }
            for doc in BUILTIN_KNOWLEDGE_DOCS
        ],
    }
    return json.dumps(overview, ensure_ascii=False, indent=2)


@mcp.tool()
def search_agricultural_knowledge(query: str, limit: int = 3) -> str:
    """
    Tra cứu cẩm nang y tế nông nghiệp, phác đồ điều trị bệnh gia súc/cây trồng, hướng dẫn dùng thuốc từ cơ sở tri thức RAG (Pinecone Knowledge Base).

    Args:
        query: Từ khóa hoặc câu hỏi bệnh lý (ví dụ: 'phác đồ điều trị tai xanh heo', 'bệnh sương mai dưa lưới', 'thuốc trị tiêu chảy heo con')
        limit: Số lượng tài liệu trích xuất tối đa (mặc định: 3)
    """
    try:
        from app.services.rag_service import rag_service
        context_str, docs = rag_service.retrieve_context(query, k=limit)
        return f"📚 KẾT QUẢ TRA CỨU TRI THỨC NÔNG NGHIỆP RAG:\n{context_str}"
    except Exception as e:
        logger.error(f"Error in search_agricultural_knowledge: {e}")
        return f"❌ Lỗi tra cứu tri thức: {str(e)}"


@mcp.tool()
def diagnose_agricultural_disease(symptoms_or_description: str, species: str = "") -> str:
    """
    Chẩn đoán bệnh lý chuyên sâu cho vật nuôi hoặc cây trồng dựa trên triệu chứng và tra cứu phác đồ can thiệp chuẩn y tế từ RAG.

    Args:
        symptoms_or_description: Mô tả chi tiết triệu chứng quan sát được (ví dụ: 'Heo sốt 41 độ, tai tím, ho nhiều', 'Lá lúa xuất hiện đốm hình thoi cháy lá')
        species: Loài vật nuôi hoặc cây trồng nếu biết (ví dụ: 'Heo', 'Bò', 'Lúa', 'Cà chua')
    """
    try:
        from app.services.rag_service import rag_service
        full_query = f"{species} {symptoms_or_description}".strip()
        result = rag_service.diagnose_disease(user_query=full_query)
        return (
            f"🩺 KẾT QUẢ CHẨN ĐOÁN & PHÁC ĐỒ ĐIỀU TRỊ (RAG):\n"
            f"• Phân loại: {result.get('category')} ({result.get('species')})\n"
            f"• Bệnh chẩn đoán: {result.get('disease_name')}\n"
            f"• Triệu chứng tóm tắt: {result.get('text')}\n\n"
            f"• Hướng dẫn & Phác đồ điều trị:\n{result.get('answer')}"
        )
    except Exception as e:
        logger.error(f"Error in diagnose_agricultural_disease: {e}")
        return f"❌ Lỗi chẩn đoán bệnh: {str(e)}"


@mcp.tool()
def google_web_search(query: str, num_results: int = 5) -> str:
    """
    Tìm kiếm thông tin trực tiếp trên web (ưu tiên Tavily Search API, dự phòng Gemini Google Search Grounding).

    Args:
        query: Từ khóa cần tìm kiếm (ví dụ: 'giá cám heo con cò hôm nay', 'giá heo hơi miền Nam')
        num_results: Số lượng kết quả tối đa (1-10, mặc định: 5)
    """
    try:
        from app.services.google_search_service import google_search_service

        payload = google_search_service.search_web(query=query, num_results=num_results)
        results = payload.get("results") or []
        raw_summary = payload.get("raw_summary") or ""
        lines = [
            f"🔎 KẾT QUẢ TÌM KIẾM GOOGLE ({payload.get('engine')}):",
            f"• Từ khóa: {payload.get('query')}",
        ]
        if raw_summary:
            lines.append(f"\n📄 Tóm tắt từ Google:\n{raw_summary}")
        if results:
            lines.append("\n🔗 Nguồn tham khảo:")
            for idx, r in enumerate(results, start=1):
                title = r.get("title") or "Nguồn"
                link = r.get("link") or ""
                snippet = r.get("snippet") or ""
                lines.append(f"{idx}. {title} — {link}")
                if snippet:
                    lines.append(f"   {snippet}")
        return "\n".join(lines)
    except Exception as e:
        logger.error(f"Error in google_web_search: {e}")
        return f"❌ Lỗi tìm kiếm Google: {str(e)}"


@mcp.tool()
def search_and_analyze_product_price(
    product_name: str,
    region: str = "Việt Nam",
    purpose: str = "tham khảo mua bán",
    num_results: int = 6,
) -> str:
    """
    Tìm kiếm giá sản phẩm trên web (Tavily Search API / Google Search Grounding) và trả về báo cáo phân tích giá chi tiết cho trang trại.

    Args:
        product_name: Tên sản phẩm, vật tư hoặc nông sản cần tìm và phân tích giá (ví dụ: 'Cám Con Cò', 'Heo hơi', 'Phân NPK Đầu Trâu', 'Dưa lưới')
        region: Khu vực thị trường (ví dụ: 'Miền Nam', 'Đồng Nai', 'Hà Nội', mặc định: 'Việt Nam')
        purpose: Mục đích phân tích ('nhập kho', 'xuất chuồng', 'bán thu hoạch', mặc định: 'tham khảo mua bán')
        num_results: Số lượng kết quả tối đa để đối chiếu (mặc định: 6)
    """
    try:
        from app.services.google_search_service import google_search_service

        report = google_search_service.search_and_analyze_price(
            product_name=product_name,
            region=region,
            purpose=purpose,
            num_results=num_results,
        )
        results = report.get("results") or []
        lines = [
            f"📊 BÁO CÁO TÌM KIẾM & PHÂN TÍCH GIÁ SẢN PHẨM: {report.get('product_name')}",
            f"• Khu vực: {report.get('region')} | Mục đích: {report.get('purpose')}",
            f"• Nguồn tìm kiếm: {report.get('engine')} (Từ khóa: \"{report.get('query')}\")",
            "",
            "📈 KẾT QUẢ PHÂN TÍCH:",
            report.get("analysis") or "",
        ]
        if results:
            lines.append("\n🔗 CÁC NGUỒN GOOGLE ĐÃ ĐỐI CHIẾU:")
            for idx, r in enumerate(results, start=1):
                title = r.get("title") or "Nguồn Google"
                link = r.get("link") or ""
                snippet = r.get("snippet") or ""
                lines.append(f"{idx}. {title} ({link})")
                if snippet:
                    lines.append(f"   {snippet}")
        return "\n".join(lines)
    except Exception as e:
        logger.error(f"Error in search_and_analyze_product_price: {e}")
        return f"❌ Lỗi tìm kiếm và phân tích giá sản phẩm: {str(e)}"


if __name__ == "__main__":
    print(f"🚀 Starting Smart Farm FastMCP Server: {settings.MCP_SERVER_NAME}...")
    mcp.run()
