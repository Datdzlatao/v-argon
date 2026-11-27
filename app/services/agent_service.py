import asyncio
import json
import logging
import re
from datetime import datetime, timezone
from typing import Any, Optional

from app.config import get_settings
from app.mcp.mcp_server import (
    get_farm_overview,
    get_pens_list,
    get_latest_env_logs,
    get_low_stock_inventory,
    get_animals_attention,
    get_crops_harvest,
    get_pen_status,
    transfer_animal_pen,
    manage_pen,
    control_device,
    log_feeding,
    update_animal_health,
    add_animal,
    plant_crop,
    manage_crop_quantity,
    log_crop_growth,
    log_crop_care,
    update_crop_disease,
    manage_inventory,
    manage_schedule,
    create_system_alert,
    search_agricultural_knowledge,
    diagnose_agricultural_disease,
    get_today_staff_attendance,
    get_all_staff_resource,
    get_staff_list,
    check_in_staff_face,
    get_today_attendance_summary,
    google_web_search,
    search_and_analyze_product_price,
)

logger = logging.getLogger("smart_manager.agent")


class AIAgentService:
    """
    AI Agent Service acting as MCP Host / Client for Smart Farm & IoT.
    Bridges Gemini LLM with FastMCP Resources and Tools across all farm pens.
    """

    def __init__(self):
        self.settings = get_settings()
        self._mcp_ctx_cache: Optional[str] = None
        self._mcp_ctx_cache_ts: float = 0.0
        self._genai_client = None

        if self.settings.is_gemini_configured:
            try:
                from google import genai
                self._genai_client = genai.Client(api_key=self.settings.GEMINI_API_KEY)
                logger.info("Google Gemini Client initialized with model: %s", self.settings.GEMINI_MODEL)
            except Exception as e:
                logger.warning(f"Could not initialize Google GenAI Client: {e}. Falling back to Rule-based Engine.")

    def get_system_prompt_with_mcp_context(self) -> str:
        """
        Dynamically read MCP Resources to build the latest real-time context for the AI Agent.
        Uses a 30s TTL cache to avoid 30+ redundant Supabase HTTP queries on consecutive chat turns.
        """
        import time
        now = time.monotonic()
        if self._mcp_ctx_cache and (now - self._mcp_ctx_cache_ts) < 30.0:
            return self._mcp_ctx_cache

        overview_ctx = get_farm_overview()
        pens_ctx = get_pens_list()
        env_ctx = get_latest_env_logs()
        inventory_ctx = get_low_stock_inventory()
        animals_ctx = get_animals_attention()
        crops_ctx = get_crops_harvest()
        staff_ctx = get_today_staff_attendance()

        current_time = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")

        prompt = f"""Bạn là Quản Lý Trang Trại Nông Nghiệp Thông Minh (Smart Farm AI Agent) điều phối đa chuồng trại qua giao thức FastMCP.
Thời gian hiện tại: {current_time}

NGỮ CẢNH TOÀN BỘ CÁC CHUỒNG TRẠI VÀ TRANG TRẠI (TỪ GIAO THỨC MCP):
--------------------------------------------------
[MCP Resource: resource://farm/overview - Thống kê tổng quan]
{overview_ctx}

[MCP Resource: resource://pens/list - Danh sách chi tiết từng chuồng trại]
{pens_ctx}

[MCP Resource: resource://env/latest - Cảm biến môi trường mới nhất]
{env_ctx}

[MCP Resource: resource://animals/attention - Vật nuôi ốm sốt / cần theo dõi]
{animals_ctx}

[MCP Resource: resource://crops/harvest - Vụ mùa / cây trồng sắp thu hoạch]
{crops_ctx}

[MCP Resource: resource://inventory/low-stock - Thức ăn, thuốc, vật tư chạm ngưỡng an toàn]
{inventory_ctx}

[MCP Resource: resource://staff/today - Danh sách nhân sự đã có mặt / điểm danh hôm nay]
{staff_ctx}
--------------------------------------------------

CÁC CÔNG CỤ (MCP TOOLS) BẠN CÓ:
1. `transfer_animal_pen(animal_id, target_pen_id, reason)`: CHUYỂN ĐỔI CHUỒNG cho cá thể vật nuôi từ chuồng cũ sang chuồng mới (ví dụ: chuyển sang chuồng cách ly y tế PEN-ISO-01, đổi chuồng thịt PEN-A02...).
2. `get_pen_status(pen_id)`: Tra cứu tình trạng chi tiết của một chuồng bất kỳ (cảm biến nhiệt độ, ẩm, mùi, thiết bị, vật nuôi).
3. `manage_pen(action, pen_id, name, pen_type)`: Tạo chuồng mới hoặc cập nhật thông tin chuồng.
4. `control_device(action, device_name, pen_id)`: Bật/tắt thiết bị IoT (quạt, đèn sưởi, máy phun sương) tại chuồng được chỉ định.
5. `log_feeding(pen_id, food_name, amount)`: Ghi nhận cho vật nuôi ăn tại chuồng và tự động trừ kho thức ăn.
6. `update_animal_health(animal_id, status, note, health_type)`: CẬP NHẬT SỨC KHỎE HOẶC BỆNH TẬT (Khỏe, Sốt nhẹ, Sốt cao, Bệnh Tai Xanh, Dịch tả heo, Tiêu chảy PED, Cách ly...) cho vật nuôi và lưu nhật ký điều trị.
7. `add_animal(species, pen_id, count, animal_id, weight, target_weight, status)`: THÊM CÁ THỂ MỚI HOẶC THÊM SỐ LƯỢNG VẬT NUÔI theo đàn vào chuồng trại (ví dụ: thêm 5 con heo vào chuồng PEN-A02, thêm cá thể bò BO-01).
8. `plant_crop(name, quantity, pen_id, plant_date, harvest_date, status)`: TRỒNG CÂY TRỒNG MỚI hoặc gieo hạt vào khu vực/chuồng trồng trọt (ví dụ: trồng 50 cây cà chua vào chuồng PEN-B01).
9. `manage_crop_quantity(crop_name_or_id, quantity, action, pen_id)`: THAY ĐỔI HOẶC ĐIỀU CHỈNH SỐ LƯỢNG CÂY TRỒNG (đặt mới 'set', tăng 'add', hoặc giảm 'reduce').
10. `log_crop_growth(crop_name_or_id, size, note, pen_id)`: CẬP NHẬT KÍCH THƯỚC / CHIỀU CAO tăng trưởng của cây trồng (cm).
11. `log_crop_care(crop_name_or_id, care_type, note, pen_id)`: GHI NHẬT KÝ CHĂM SÓC CÂY TRỒNG (tưới nước, bón phân, tỉa cành, bắt sâu...).
12. `update_crop_disease(crop_name_or_id, disease_name, note, pen_id)`: CẬP NHẬT BỆNH LÝ CÂY TRỒNG (sương mai, đạo ôn, rầy nâu...) và lưu nhật ký điều trị thực vật.
13. `manage_inventory(action, name, quantity, unit, category)`: Nhập kho, xuất kho hoặc tạo mới thức ăn/vật tư.
14. `manage_schedule(action, task_name, target_date, pen_id, note)`: Lên lịch hoặc hoàn thành công việc theo chuồng.
15. `create_system_alert(alert_type, message, pen_id)`: Phát cảnh báo nguy cơ chuồng trại qua WebSocket.
16. `search_agricultural_knowledge(query, limit)`: TRA CỨU CƠ SỞ TRI THỨC RAG (Pinecone Knowledge Base) về phác đồ điều trị bệnh gia súc/cây trồng, thông tin thuốc thú y, bệnh lý nông nghiệp.
17. `diagnose_agricultural_disease(symptoms_or_description, species)`: CHẨN ĐOÁN BỆNH LÝ & TRÍCH XUẤT PHÁC ĐỒ ĐIỀU TRỊ chuyên sâu từ cơ sở tri thức RAG.
18. `get_staff_list(pen_id)`: Tra cứu danh sách nhân sự trang trại, phân công ca trực và chuồng phụ trách.
19. `check_in_staff_face(staff_id, pen_id, note)`: Điểm danh vào ca làm việc cho nhân viên bằng FaceID nhận diện khuôn mặt.
20. `get_today_attendance_summary()`: Xem tổng hợp tình hình điểm danh nhân sự hôm nay (ai đã có mặt, ai chưa đến).
21. `google_web_search(query, num_results)`: TÌM KIẾM WEB QUA TAVILY trực tiếp để tra cứu thông tin thị trường, kỹ thuật hoặc tin tức mới nhất.
22. `search_and_analyze_product_price(product_name, region, purpose, num_results)`: TÌM KIẾM GIÁ SẢN PHẨM QUA TAVILY VÀ PHÂN TÍCH (khoảng giá, so sánh nguồn, nhận định xu hướng, khuyến nghị nhập kho / xuất chuồng / thu hoạch).

NHIỆM VỤ CỦA BẠN:
- Hệ thống hỗ trợ RẤT NHIỀU CHUỒNG KHÁC NHAU (ví dụ: Chuồng Heo Khu A1 '123', Chuồng Heo Khu A2 'PEN-A02', Khu Cách Ly 'PEN-ISO-01', Nhà Màng 'PEN-B01'...).
- Khi người dùng muốn trồng cây hoặc thay đổi số lượng cây trồng, bạn PHẢI gọi `plant_crop` hoặc `manage_crop_quantity`.
- Khi người dùng muốn thêm con vật hoặc tăng số lượng đàn vật nuôi, bạn PHẢI gọi `add_animal`.
- Khi người dùng muốn cập nhật kích thước, chiều cao cây trồng, bạn PHẢI gọi `log_crop_growth`.
- Khi người dùng muốn ghi chép chăm sóc cây (tưới nước, bón phân, tỉa cành...), bạn PHẢI gọi `log_crop_care`.
- Khi người dùng báo cáo cây trồng bị bệnh hoặc sâu bệnh, bạn PHẢI gọi `update_crop_disease`.
- Khi người dùng cập nhật bệnh tật hoặc sức khỏe của vật nuôi, bạn PHẢI gọi `update_animal_health`.
- Khi người dùng muốn đổi chuồng, chuyển chuồng cho vật nuôi, hoặc kiểm tra bất kỳ chuồng nào, hãy gọi tool tương ứng với mã `pen_id` chính xác.
- Khi người dùng hỏi về bệnh tật của vật nuôi (sốt, tai xanh, tiêu chảy PED, lở mồm long móng...) hoặc sâu bệnh cây trồng (đạo ôn, rầy nâu, sương mai...), bạn PHẢI gọi `search_agricultural_knowledge` hoặc `diagnose_agricultural_disease` để trích xuất phác đồ y tế chuẩn xác và hướng dẫn người dùng chi tiết, an tâm.
- Khi người dùng hỏi về giá cả sản phẩm, giá vật tư (cám, phân bón, thuốc), giá heo hơi/nông sản hôm nay hoặc nhờ tìm kiếm và phân tích giá thị trường, bạn PHẢI gọi `search_and_analyze_product_price` để tìm kiếm qua Tavily và trả về kết quả phân tích chi tiết.
- Khi người dùng cần tra cứu thông tin thị trường, tin tức nông nghiệp hoặc kỹ thuật mới nhất trên web, hãy gọi `google_web_search` để tìm kiếm qua Tavily.
- Luôn trả lời bằng tiếng Việt lịch sự, thân thiện, rõ ràng về mã chuồng thao tác.
"""
        self._mcp_ctx_cache = prompt
        self._mcp_ctx_cache_ts = now
        return prompt

    def _fallback_intent_engine(self, user_message: str) -> dict[str, Any]:
        """
        Rule-based NLP Engine: Ensures multi-pen tools and animal transfers are executable seamlessly.
        """
        msg = user_message.lower().strip()
        executed_tools = []
        reply_lines = []

        # 1. Action: CHUYỂN CHUỒNG / ĐỔI CHUỒNG VẬT NUÔI
        if any(k in msg for k in ["chuyển chuồng", "đổi chuồng", "chuyển sang chuồng", "chuyển con", "chuyển cá thể", "dời chuồng", "cách ly"]):
            # Detect animal ID
            id_match = re.findall(r"(heo[\-_]?[0-9a-zA-Z]+|bò[\-_]?[0-9a-zA-Z]+|[a-zA-Z]+[\-_][0-9a-zA-Z]+)", msg)
            animal_id = id_match[0].upper() if id_match else "HEO-102"

            # Detect target pen
            target_pen = "PEN-ISO-01"
            if "cách ly" in msg or "iso" in msg or "y tế" in msg or "bệnh" in msg:
                target_pen = "PEN-ISO-01"
            elif "a02" in msg or "a2" in msg or "chuồng a2" in msg:
                target_pen = "PEN-A02"
            elif "b01" in msg or "b1" in msg:
                target_pen = "PEN-B01"
            elif "123" in msg or "a1" in msg:
                target_pen = "123"
            else:
                pen_match = re.findall(r"chuồng\s*([a-zA-Z0-9_\-]+)", msg)
                if pen_match:
                    target_pen = pen_match[0].upper()

            reason = user_message
            result = transfer_animal_pen(animal_id=animal_id, target_pen_id=target_pen, reason=reason)
            executed_tools.append({
                "tool": "transfer_animal_pen",
                "args": {"animal_id": animal_id, "target_pen_id": target_pen, "reason": reason},
                "result": result,
            })
            reply_lines.append(f"🤖 [Smart Farm Agent]: {result}")

        # 2. Action: ĐIỀU KHIỂN THIẾT BỊ (THEO CHUỒNG)
        elif any(k in msg for k in ["bật", "mở", "tắt", "khởi động", "dừng"]) and any(k in msg for k in ["quạt", "đèn", "phun sương", "nước", "thiết bị", "van"]):
            action = "turn_on" if any(k in msg for k in ["bật", "mở", "khởi động"]) else "turn_off"
            dev_name = "quạt"
            if "đèn" in msg or "uv" in msg:
                dev_name = "đèn"
            elif "nước" in msg or "phun sương" in msg:
                dev_name = "phun sương"
            elif "tưới" in msg or "van" in msg:
                dev_name = "van"

            pen_id = "123"
            if "a02" in msg or "a2" in msg:
                pen_id = "PEN-A02"
            elif "cách ly" in msg or "iso" in msg:
                pen_id = "PEN-ISO-01"
            elif "b01" in msg or "b1" in msg:
                pen_id = "PEN-B01"
            else:
                pen_match = re.findall(r"chuồng\s*([a-zA-Z0-9_\-]+)", msg)
                if pen_match:
                    pen_id = pen_match[0]

            result = control_device(action=action, device_name=dev_name, pen_id=pen_id)
            executed_tools.append({"tool": "control_device", "args": {"action": action, "device_name": dev_name, "pen_id": pen_id}, "result": result})
            reply_lines.append(f"🤖 [Smart Farm Agent]: {result}")

        # 3. Action: CHO ĂN THEO CHUỒNG
        elif any(k in msg for k in ["cho ăn", "ăn", "cung cấp thức ăn", "bữa ăn"]) and any(k in msg for k in ["cám", "chuồng", "thức ăn", "kg"]):
            numbers = re.findall(r"[-+]?\d*\.\d+|\d+", msg)
            amount = float(numbers[0]) if numbers else 5.0
            food_name = "Cám Con Cò Siêu Tăng Trọng"
            pen_id = "123"
            if "a02" in msg or "a2" in msg:
                pen_id = "PEN-A02"
            elif "cách ly" in msg or "iso" in msg:
                pen_id = "PEN-ISO-01"
            else:
                pen_match = re.findall(r"chuồng\s*([a-zA-Z0-9_\-]+)", msg)
                if pen_match:
                    pen_id = pen_match[0]

            result = log_feeding(pen_id=pen_id, food_name=food_name, amount=amount)
            executed_tools.append({"tool": "log_feeding", "args": {"pen_id": pen_id, "food_name": food_name, "amount": amount}, "result": result})
            reply_lines.append(f"🤖 [Smart Farm Agent]: {result}")

        # 4. Action: TRA CỨU CHUỒNG CỤ THỂ
        elif any(k in msg for k in ["xem chuồng", "thông tin chuồng", "chuồng nào", "tình hình chuồng", "chỉ số chuồng"]):
            pen_id = "123"
            if "a02" in msg or "a2" in msg:
                pen_id = "PEN-A02"
            elif "cách ly" in msg or "iso" in msg:
                pen_id = "PEN-ISO-01"
            elif "b01" in msg or "b1" in msg:
                pen_id = "PEN-B01"
            elif "b02" in msg or "b2" in msg:
                pen_id = "PEN-B02"
            else:
                pen_match = re.findall(r"chuồng\s*([a-zA-Z0-9_\-]+)", msg)
                if pen_match:
                    pen_id = pen_match[0]

            result = get_pen_status(pen_id=pen_id)
            executed_tools.append({"tool": "get_pen_status", "args": {"pen_id": pen_id}, "result": result})
            reply_lines.append(f"🤖 [Smart Farm Agent]: Thông tin chi tiết chuồng [{pen_id}]:\n{result}")

        # 5. Action: SỨC KHỎE VẬT NUÔI & CẬP NHẬT BỆNH VẬT NUÔI
        elif any(k in msg for k in ["sốt", "ốm", "bệnh", "bỏ ăn", "khỏe", "tiêu chảy", "sức khỏe", "tai xanh", "dịch tả", "ped", "lở mồm"]) and any(k in msg for k in ["heo", "bò", "vật nuôi", "cá thể"]) and not any(k in msg for k in ["cây", "dưa", "rau", "cà chua", "lúa"]):
            id_match = re.findall(r"(heo[\-_]?[0-9a-zA-Z]+|bò[\-_]?[0-9a-zA-Z]+|[a-zA-Z]+[\-_][0-9a-zA-Z]+)", msg)
            animal_id = id_match[0].upper() if id_match else "HEO-102"

            if "tai xanh" in msg:
                status = "Bệnh Tai Xanh"
            elif "dịch tả" in msg or "asf" in msg:
                status = "Dịch Tả Heo"
            elif "tiêu chảy" in msg or "ped" in msg:
                status = "Tiêu Chảy PED"
            elif "lở mồm" in msg:
                status = "Lở Mồm Long Móng"
            elif "sốt" in msg:
                status = "Sốt Cao" if "cao" in msg else "Sốt Nhẹ"
            elif "khỏe" in msg or "khoẻ" in msg:
                status = "Khoe"
            elif "bỏ ăn" in msg:
                status = "Bo An"
            else:
                status = "Benh"

            result = update_animal_health(animal_id=animal_id, status=status, note=user_message, health_type="Disease")
            executed_tools.append({"tool": "update_animal_health", "args": {"animal_id": animal_id, "status": status, "note": user_message, "health_type": "Disease"}, "result": result})
            reply_lines.append(f"🤖 [Smart Farm Agent]: {result}")

        # 6. Action: XUẤT NHẬP KHO
        elif any(k in msg for k in ["xuất", "nhập", "kho"]) and any(k in msg for k in ["cám", "thuốc", "phân", "kg", "bao"]):
            action = "import" if any(k in msg for k in ["nhập", "thêm", "mua"]) else "export"
            numbers = re.findall(r"[-+]?\d*\.\d+|\d+", msg)
            qty = float(numbers[0]) if numbers else 10.0
            item_name = "Cám Con Cò Siêu Tăng Trọng"
            result = manage_inventory(action=action, name=item_name, quantity=qty)
            executed_tools.append({"tool": "manage_inventory", "args": {"action": action, "name": item_name, "quantity": qty}, "result": result})
            reply_lines.append(f"🤖 [Smart Farm Agent]: {result}")

        # 7. Resource: DANH SÁCH TẤT CẢ CÁC CHUỒNG
        elif any(k in msg for k in ["các chuồng", "danh sách chuồng", "tất cả chuồng", "mấy chuồng", "chuồng trại"]):
            pens_str = get_pens_list()
            reply_lines.append(f"🤖 [Smart Farm Agent]: Danh sách toàn bộ các chuồng trong trang trại:\n{pens_str}")

        # 8. Action: TRỒNG CÂY TRỒNG MỚI
        elif any(k in msg for k in ["trồng cây", "trồng", "gieo hạt", "gieo", "xuống giống", "thêm cây"]) and not any(k in msg for k in ["kích thước", "chiều cao", "chăm sóc", "tưới", "bón phân"]):
            crop_name = "Cà Chua Cherry"
            for cn in ["dưa lưới", "cà chua", "rau muống", "lúa", "dâu tây", "xà lách", "ngô", "bắp"]:
                if cn in msg:
                    crop_name = cn.title()
                    break

            nums = re.findall(r"\d+", msg)
            qty = int(nums[0]) if nums else 50

            pen_id = "PEN-B01"
            if "b02" in msg or "b2" in msg:
                pen_id = "PEN-B02"
            elif "vườn" in msg or "vuon" in msg:
                v_match = re.findall(r"(vườn\s*[0-9a-zA-Z]+|vuon\s*[0-9a-zA-Z]+)", msg)
                pen_id = v_match[0] if v_match else "Vườn01"
            else:
                pen_match = re.findall(r"chuồng\s*([a-zA-Z0-9_\-]+)", msg)
                if pen_match:
                    pen_id = pen_match[0]

            result = plant_crop(name=crop_name, quantity=qty, pen_id=pen_id)
            executed_tools.append({"tool": "plant_crop", "args": {"name": crop_name, "quantity": qty, "pen_id": pen_id}, "result": result})
            reply_lines.append(f"🤖 [Smart Farm Agent]: {result}")

        # 9. Action: THAY ĐỔI SỐ LƯỢNG CÂY
        elif any(k in msg for k in ["số lượng cây", "đổi số lượng", "thay đổi số lượng", "tăng cây", "giảm cây", "tăng số lượng cây", "giảm số lượng cây"]):
            crop_name = "Cà Chua Cherry"
            for cn in ["dưa lưới", "cà chua", "rau muống", "lúa", "dâu tây", "xà lách"]:
                if cn in msg:
                    crop_name = cn.title()
                    break

            nums = re.findall(r"\d+", msg)
            qty = int(nums[0]) if nums else 20
            action = "add" if any(k in msg for k in ["tăng", "thêm", "cộng"]) else ("reduce" if any(k in msg for k in ["giảm", "bớt", "trừ"]) else "set")

            result = manage_crop_quantity(crop_name_or_id=crop_name, quantity=qty, action=action)
            executed_tools.append({"tool": "manage_crop_quantity", "args": {"crop_name_or_id": crop_name, "quantity": qty, "action": action}, "result": result})
            reply_lines.append(f"🤖 [Smart Farm Agent]: {result}")

        # 10. Action: THÊM CON VẬT / SỐ LƯỢNG CON VẬT
        elif any(k in msg for k in ["thêm con", "thêm heo", "thêm bò", "nhập đàn", "thêm vật nuôi", "thêm gia súc"]) or (("thêm" in msg or "nhập" in msg) and any(k in msg for k in ["heo", "bò", "gà", "dê", "vịt"])):
            species = "Heo"
            if "bò" in msg or "bo" in msg:
                species = "Bò"
            elif "gà" in msg or "ga" in msg:
                species = "Gà"
            elif "dê" in msg or "de" in msg:
                species = "Dê"
            elif "vịt" in msg or "vit" in msg:
                species = "Vịt"

            nums = re.findall(r"\d+", msg)
            count = int(nums[0]) if nums else 1

            pen_id = "123"
            if "a02" in msg or "a2" in msg:
                pen_id = "PEN-A02"
            elif "cách ly" in msg or "iso" in msg:
                pen_id = "PEN-ISO-01"
            else:
                pen_match = re.findall(r"chuồng\s*([a-zA-Z0-9_\-]+)", msg)
                if pen_match:
                    pen_id = pen_match[0]

            id_match = re.findall(r"(heo[\-_]?[0-9a-zA-Z]+|bò[\-_]?[0-9a-zA-Z]+|[a-zA-Z]+[\-_][0-9a-zA-Z]+)", msg)
            animal_id = id_match[0].upper() if id_match and count == 1 else ""

            result = add_animal(species=species, pen_id=pen_id, count=count, animal_id=animal_id)
            executed_tools.append({"tool": "add_animal", "args": {"species": species, "pen_id": pen_id, "count": count, "animal_id": animal_id}, "result": result})
            reply_lines.append(f"🤖 [Smart Farm Agent]: {result}")

        # 11. Action: CẬP NHẬT KÍCH THƯỚC CÂY TRỒNG
        elif any(k in msg for k in ["kích thước", "chiều cao", "đường kính", "đo cây", "tăng trưởng", "phát triển"]) and any(k in msg for k in ["cây", "dưa", "rau", "cà chua", "lúa", "cm"]):
            crop_name = "Rau Muống"
            for cn in ["dưa lưới", "cà chua", "rau muống", "lúa", "dâu tây", "xà lách"]:
                if cn in msg:
                    crop_name = cn.title()
                    break

            nums = re.findall(r"[-+]?\d*\.\d+|\d+", msg)
            size = float(nums[0]) if nums else 20.0

            result = log_crop_growth(crop_name_or_id=crop_name, size=size, note=user_message)
            executed_tools.append({"tool": "log_crop_growth", "args": {"crop_name_or_id": crop_name, "size": size, "note": user_message}, "result": result})
            reply_lines.append(f"🤖 [Smart Farm Agent]: {result}")

        # 12. Action: CHĂM SÓC CÂY TRỒNG
        elif any(k in msg for k in ["chăm sóc", "tưới nước", "bón phân", "tỉa lá", "tỉa cành", "bắt sâu", "làm cỏ"]) and any(k in msg for k in ["cây", "dưa", "rau", "cà chua", "lúa", "vườn"]):
            crop_name = "Rau Muống"
            for cn in ["dưa lưới", "cà chua", "rau muống", "lúa", "dâu tây", "xà lách"]:
                if cn in msg:
                    crop_name = cn.title()
                    break

            care_type = "Tưới nước"
            if "bón phân" in msg or "phân" in msg:
                care_type = "Bón phân"
            elif "tỉa" in msg:
                care_type = "Tỉa lá"
            elif "phun thuốc" in msg or "sâu" in msg:
                care_type = "Phun thuốc phòng sâu bệnh"

            result = log_crop_care(crop_name_or_id=crop_name, care_type=care_type, note=user_message)
            executed_tools.append({"tool": "log_crop_care", "args": {"crop_name_or_id": crop_name, "care_type": care_type, "note": user_message}, "result": result})
            reply_lines.append(f"🤖 [Smart Farm Agent]: {result}")

        # 13. Action: CẬP NHẬT BỆNH CÂY TRỒNG
        elif ("bệnh" in msg or "sâu" in msg) and any(k in msg for k in ["cây", "dưa", "rau", "cà chua", "lúa", "lá", "sương mai", "đạo ôn", "rầy nâu", "thán thư"]) and not any(k in msg for k in ["heo", "bò"]):
            crop_name = "Dưa Lưới"
            for cn in ["dưa lưới", "cà chua", "rau muống", "lúa", "dâu tây", "xà lách"]:
                if cn in msg:
                    crop_name = cn.title()
                    break

            disease_name = "Sương mai"
            for dn in ["sương mai", "đạo ôn", "rầy nâu", "thán thư", "phấn trắng", "đốm lá", "héo xanh"]:
                if dn in msg:
                    disease_name = dn.title()
                    break

            result = update_crop_disease(crop_name_or_id=crop_name, disease_name=disease_name, note=user_message)
            executed_tools.append({"tool": "update_crop_disease", "args": {"crop_name_or_id": crop_name, "disease_name": disease_name, "note": user_message}, "result": result})
            reply_lines.append(f"🤖 [Smart Farm Agent]: {result}")

        # 14. Action: RAG TRA CỨU TRI THỨC NÔNG NGHIỆP & CHẨN ĐOÁN BỆNH (TÍCH HỢP TỪ WORKFLOW STEM)
        elif any(k in msg for k in [
            "chẩn đoán", "bệnh gì", "phác đồ", "cách chữa", "điều trị", "triệu chứng", "thuốc trị",
            "tai xanh", "dịch tả", "asf", "prrs", "ped", "lở mồm", "đạo ôn", "sương mai", "rầy nâu",
            "mốc sương", "bệnh học", "phòng trị", "kháng sinh", "cẩm nang"
        ]):
            from app.services.rag_service import rag_service
            rag_diag = rag_service.diagnose_disease(user_query=user_message)
            executed_tools.append({
                "tool": "diagnose_agricultural_disease",
                "args": {"symptoms_or_description": user_message},
                "result": rag_diag,
            })
            reply_lines.append(
                f"🩺 **[Smart Farm AI Agent - RAG Disease Diagnosis]**\n"
                f"• Phân loại: {rag_diag.get('category')} ({rag_diag.get('species')})\n"
                f"• Bệnh lý chẩn đoán: **{rag_diag.get('disease_name')}**\n"
                f"• Triệu chứng ghi nhận: {rag_diag.get('text')}\n\n"
                f"📋 **Phác đồ can thiệp & điều trị y tế (RAG Knowledge Base):**\n"
                f"{rag_diag.get('answer')}"
            )

        # 15. Action: QUẢN LÝ NHÂN SỰ & ĐIỂM DANH FACE ID
        elif any(k in msg for k in ["nhân sự", "nhân viên", "điểm danh", "ai đang trực", "vào ca", "chấm công", "faceid", "khuôn mặt"]):
            if any(k in msg for k in ["điểm danh", "vào ca", "chấm công"]) and any(k in msg for k in ["nv", "tech", "cho", "bằng"]):
                id_match = re.findall(r"(nv[0-9]+|tech[\-_]?[0-9]+)", msg)
                staff_id = id_match[0].upper() if id_match else "NV01"
                pen_id = "123"
                if "a02" in msg or "a2" in msg:
                    pen_id = "PEN-A02"
                elif "cách ly" in msg or "iso" in msg:
                    pen_id = "PEN-ISO-01"
                elif "b01" in msg or "b1" in msg:
                    pen_id = "PEN-B01"

                res = check_in_staff_face(staff_id=staff_id, pen_id=pen_id, note="Điểm danh qua chat AI")
                executed_tools.append({"tool": "check_in_staff_face", "args": {"staff_id": staff_id, "pen_id": pen_id}, "result": res})
                reply_lines.append(f"🤖 [Smart Farm Agent]: {res}")
            elif any(k in msg for k in ["danh sách", "tất cả", "các nhân viên", "có ai"]):
                res = get_staff_list()
                executed_tools.append({"tool": "get_staff_list", "args": {}, "result": res})
                reply_lines.append(f"🤖 [Smart Farm Agent]: Danh sách nhân sự trang trại:\n{res}")
            else:
                summary = get_today_attendance_summary()
                executed_tools.append({"tool": "get_today_attendance_summary", "args": {}, "result": summary})
                reply_lines.append(f"🤖 [Smart Farm Agent]: Tình hình điểm danh nhân sự hôm nay:\n{summary}")

        elif any(k in msg for k in ["giá ", "bao nhiêu tiền", "thị trường", "tìm kiếm", "tra cứu web", "search"]):
            if any(k in msg for k in ["giá ", "bao nhiêu tiền", "thị trường"]):
                product = re.sub(r"^(tìm|tra|xem|cho hỏi|hỏi|phân tích)?\s*(giá|thị trường)\s*", "", msg).strip() or user_message
                res = search_and_analyze_product_price(product_name=product)
                executed_tools.append({"tool": "search_and_analyze_product_price", "args": {"product_name": product}, "result": res})
                reply_lines.append(res)
            else:
                res = google_web_search(query=user_message)
                executed_tools.append({"tool": "google_web_search", "args": {"query": user_message}, "result": res})
                reply_lines.append(res)

        else:
            reply_lines.append(
                f"🤖 [Smart Farm AI Agent]: Tôi đã nhận yêu cầu: '{user_message}'.\n"
                "Tôi hỗ trợ bạn quản lý linh hoạt giữa các chuồng:\n"
                "- 👤 Nhân sự FaceID: 'Điểm danh cho nhân viên NV01 tại chuồng 123', 'Danh sách nhân sự trang trại'\n"
                "- 🚚 Đổi chuồng: 'Chuyển con HEO-102 sang chuồng cách ly PEN-ISO-01'\n"
                "- 🩺 Chẩn đoán RAG: 'Chẩn đoán bệnh heo bị sốt cao tai tím', 'Phác đồ điều trị bệnh đạo ôn'\n"
                "- 💰 Tra giá & thị trường (Tavily): 'Giá heo hơi hôm nay miền Nam', 'Giá cám Con Cò bao nhiêu tiền'\n"
                "- 🔎 Tra cứu chuồng: 'Xem thông tin chuồng PEN-A02', 'Danh sách các chuồng'\n"
                "- 🌬️ Điều khiển thiết bị: 'Bật quạt chuồng A2', 'Bật đèn sưởi chuồng 123'\n"
                "- 🥣 Cho ăn: 'Cho chuồng PEN-A02 ăn 10 kg cám'\n"
                "- 🩺 Sức khỏe: 'Cập nhật cá thể HEO-102 đã khỏi sốt'"
            )

        return {
            "reply": "\n\n".join(reply_lines),
            "tool_calls": executed_tools,
        }

    async def chat(self, user_message: str, history: Optional[list[dict[str, Any]]] = None) -> dict[str, Any]:
        """
        Process chat with Smart Farm AI Agent:
        1. Injects live farm context across all pens + recent conversation history.
        2. Dispatches to Gemini API with registered tools.
        3. Seamlessly fallbacks to rule engine if API key is not configured or errors out.
        """
        if not self._genai_client:
            return self._fallback_intent_engine(user_message)

        try:
            from google.genai import types

            recent_turns_text = ""
            if history:
                turns = []
                for h in history[-6:]:
                    role_label = "Người dùng" if h.get("sender") == "user" else "Trợ lý AI"
                    turns.append(f"{role_label}: {h.get('content', '')}")
                if turns:
                    recent_turns_text = "\n\nLỊCH SỬ TRÒ CHUYỆN GẦN ĐÂY VỚI NGƯỜI DÙNG:\n" + "\n".join(turns) + "\n"

            system_instruction = (
                await asyncio.to_thread(self.get_system_prompt_with_mcp_context)
            ) + recent_turns_text

            tools_list = [
                transfer_animal_pen,
                get_pen_status,
                manage_pen,
                control_device,
                log_feeding,
                update_animal_health,
                add_animal,
                plant_crop,
                manage_crop_quantity,
                log_crop_growth,
                log_crop_care,
                update_crop_disease,
                manage_inventory,
                manage_schedule,
                create_system_alert,
                search_agricultural_knowledge,
                diagnose_agricultural_disease,
                get_staff_list,
                check_in_staff_face,
                get_today_attendance_summary,
                google_web_search,
                search_and_analyze_product_price,
            ]

            config = types.GenerateContentConfig(
                system_instruction=system_instruction,
                tools=tools_list,
                temperature=0.2,
            )

            response = self._genai_client.models.generate_content(
                model=self.settings.GEMINI_MODEL,
                contents=user_message,
                config=config,
            )

            executed_tools = []
            if hasattr(response, "function_calls") and response.function_calls:
                for fc in response.function_calls:
                    executed_tools.append({
                        "tool": fc.name,
                        "args": dict(fc.args) if fc.args else {},
                    })
            elif hasattr(response, "automatic_function_calling_history") and response.automatic_function_calling_history:
                for hist in response.automatic_function_calling_history:
                    if getattr(hist, "parts", None):
                        for part in hist.parts:
                            fc = getattr(part, "function_call", None)
                            if fc:
                                executed_tools.append({
                                    "tool": fc.name,
                                    "args": dict(fc.args) if fc.args else {},
                                })

            reply_text = response.text if response.text else "Yêu cầu trang trại đã được xử lý thành công."

            return {
                "reply": reply_text,
                "tool_calls": executed_tools,
            }

        except Exception as e:
            logger.error(f"Error invoking Gemini model: {e}. Switching to fallback engine.")
            res = self._fallback_intent_engine(user_message)
            res["reply"] += f"\n\n*(Lưu ý: Gemini API gặp lỗi [{str(e)}], hệ thống đã tự động xử lý qua Smart Farm Rule Engine)*"
            return res

    async def chat_stream(self, user_message: str, history: Optional[list[dict[str, Any]]] = None):
        """
        Async generator streaming chat chunks from Gemini API in real time (SSE).
        Falls back to rule engine if Gemini is unavailable.
        """
        yield {"type": "status", "text": "Đang kết nối Smart Farm AI..."}

        if not self._genai_client:
            res = self._fallback_intent_engine(user_message)
            yield {"type": "chunk", "text": res["reply"]}
            yield {"type": "done", "reply": res["reply"], "tool_calls": res.get("tool_calls", [])}
            return

        try:
            import asyncio
            from google.genai import types

            recent_turns_text = ""
            if history:
                turns = []
                for h in history[-6:]:
                    role_label = "Người dùng" if h.get("sender") == "user" else "Trợ lý AI"
                    turns.append(f"{role_label}: {h.get('content', '')}")
                if turns:
                    recent_turns_text = "\n\nLỊCH SỬ TRÒ CHUYỆN GẦN ĐÂY VỚI NGƯỜI DÙNG:\n" + "\n".join(turns) + "\n"

            system_instruction = (
                await asyncio.to_thread(self.get_system_prompt_with_mcp_context)
            ) + recent_turns_text

            tools_list = [
                transfer_animal_pen,
                get_pen_status,
                manage_pen,
                control_device,
                log_feeding,
                update_animal_health,
                add_animal,
                plant_crop,
                manage_crop_quantity,
                log_crop_growth,
                log_crop_care,
                update_crop_disease,
                manage_inventory,
                manage_schedule,
                create_system_alert,
                search_agricultural_knowledge,
                diagnose_agricultural_disease,
                get_staff_list,
                check_in_staff_face,
                get_today_attendance_summary,
                google_web_search,
                search_and_analyze_product_price,
            ]

            config = types.GenerateContentConfig(
                system_instruction=system_instruction,
                tools=tools_list,
                temperature=0.2,
            )

            full_text_parts: list[str] = []
            executed_tools: list[dict[str, Any]] = []

            def _next_chunk(iterator):
                try:
                    return next(iterator), False
                except StopIteration:
                    return None, True

            stream_iter = iter(
                self._genai_client.models.generate_content_stream(
                    model=self.settings.GEMINI_MODEL,
                    contents=user_message,
                    config=config,
                )
            )

            while True:
                chunk, done = await asyncio.to_thread(_next_chunk, stream_iter)
                if done:
                    break
                if chunk is None:
                    continue

                if hasattr(chunk, "function_calls") and chunk.function_calls:
                    for fc in chunk.function_calls:
                        executed_tools.append({
                            "tool": fc.name,
                            "args": dict(fc.args) if fc.args else {},
                        })

                chunk_text = getattr(chunk, "text", None)
                if chunk_text:
                    full_text_parts.append(chunk_text)
                    yield {"type": "chunk", "text": chunk_text}

            reply_text = "".join(full_text_parts).strip() or "Yêu cầu trang trại đã được xử lý thành công."
            if not full_text_parts:
                yield {"type": "chunk", "text": reply_text}

            yield {
                "type": "done",
                "reply": reply_text,
                "tool_calls": executed_tools,
            }
        except Exception as e:
            logger.error(f"Error streaming Gemini model: {e}. Switching to fallback engine.")
            res = self._fallback_intent_engine(user_message)
            res["reply"] += f"\n\n*(Lưu ý: Gemini API gặp lỗi [{str(e)}], hệ thống đã tự động xử lý qua Smart Farm Rule Engine)*"
            yield {"type": "chunk", "text": res["reply"]}
            yield {"type": "done", "reply": res["reply"], "tool_calls": res.get("tool_calls", [])}

    async def diagnose_multimodal(
        self,
        user_query: Optional[str] = None,
        image_bytes: Optional[bytes] = None,
        content_type: Optional[str] = "image/jpeg",
    ) -> dict[str, Any]:
        """
        Multimodal agricultural disease diagnosis integrating RAG context and visual recognition.
        Directly inherits and enhances the workflow from stem/app/services/agent.py.
        """
        from app.services.rag_service import rag_service
        return rag_service.diagnose_disease(
            user_query=user_query,
            image_bytes=image_bytes,
            image_mime_type=content_type,
        )


agent_service = AIAgentService()
