# 🌾 Smart Farm & Agriculture AI Agent System (MCP + Gemini + Supabase + FastAPI)

Hệ thống Quản lý Trang Trại & Chuồng Trại Nông Nghiệp Thông Minh đa nền tảng (**Web Next.js**, **PWA iOS**, **Android Native**) tích hợp **AI Agent (FastMCP + Google Gemini)**, **RAG Chẩn Đoán Bệnh Đa Phương Thức (Pinecone + Base64 Image)**, **Máy Quan Sát Chủ Động 24/7 (Live Observer News Feed)** và **2 Microservice AI Vision** (nhận diện khuôn mặt/đồng phục & theo dõi hành vi qua IP Camera).

---

## 📁 Cấu Trúc Các Dự Án Trong Workspace

```
n-ng-c-p/
├── app/                              # Backend chính (FastAPI + FastMCP + Gemini Streaming + RAG + Watcher/Scheduler) - Port 8000
├── action_vision_api/                # Microservice AI Vision theo dõi hành vi & chuyển động qua IP Camera (Port 8002)
├── standalone_ai_engine/             # Microservice AI nhận diện khuôn mặt (FaceID), chống giả mạo & kiểm tra đồng phục (Port 8001)
├── frontend/                         # Giao diện Web Dashboard chính & route /ios (Next.js 14 + Tailwind CSS) - Port 3000
├── pwa-ios/                          # Progressive Web App tối ưu riêng cho iPhone/iPad (Next.js 14) - Port 3001
├── android/                          # Ứng dụng Android Native (Kotlin + Jetpack Compose Material 3)
├── disease_diagnosis_rag/            # Prototype RAG chẩn đoán bệnh cây trồng/vật nuôi ban đầu (đã tích hợp vào app/services/rag_service.py)
├── legacy_web_dashboard/             # Phiên bản Web Dashboard tĩnh ban đầu (HTML/CSS/JS + Supabase + Chart.js)
├── scripts/                          # Bộ script kiểm thử hệ thống E2E
│   ├── verify_farm_system.py         # Kiểm tra toàn diện E2E các module trang trại
│   ├── verify_staff_workflow.py      # Kiểm tra luồng nhân sự & điểm danh FaceID
│   ├── verify_all_phases.py          # Kiểm thử theo từng giai đoạn
│   └── verify_phase1.py              # Kiểm thử giai đoạn 1
├── mcp_server.py                     # Entrypoint FastMCP Server độc lập (stdio)
├── schema.sql                        # Toàn bộ DDL hoàn chỉnh, RLS Policies & Seed Data cho trang trại
├── database.sql                      # Schema tham chiếu các bảng gốc
├── start.sh                          # Script khởi chạy nền toàn bộ 4 dịch vụ (Ports 3000, 8000, 8001, 8002)
├── start_apis.sh                     # Script khởi chạy nền riêng 3 API (Ports 8000, 8001, 8002)
├── stop.sh                           # Script dừng toàn bộ hệ thống
└── stop_apis.sh                      # Script dừng 3 API backend & AI
```

---

## 🏛️ Kiến Trúc Backend Chính (`app/`)

```
app/
├── config.py                         # Quản lý Settings bằng pydantic-settings (.env)
├── models/
│   └── schemas.py                    # Pydantic schemas (IoT, vật nuôi, cây trồng, RAG Base64, nhân sự...)
├── db/
│   ├── supabase_client.py            # Singleton Client kết nối Supabase
│   └── repositories/                 # Data Access Layer
│       ├── pens.py                   # Quản lý chuồng trại / phân khu (pens)
│       ├── devices.py                # Quản lý thiết bị IoT (quạt hút, phun sương, đèn sưởi)
│       ├── animals.py                # Quản lý vật nuôi, tăng trọng & nhật ký thú y
│       ├── crops.py                  # Quản lý cây trồng, sinh trưởng & thu hoạch
│       ├── env_logs.py               # Quản lý cảm biến môi trường (nhiệt độ, độ ẩm, mùi hôi)
│       ├── inventory.py              # Quản lý kho thức ăn, phân bón & thuốc thú y
│       ├── feed_logs.py              # Quản lý nhật ký cho ăn & trừ tồn kho
│       ├── schedules.py              # Quản lý lịch trình công việc
│       ├── alerts.py                 # Quản lý cảnh báo hệ thống
│       ├── chat_history.py           # Lưu lịch sử chat (Supabase cho UUID + SQLite fallback cho guest/demo)
│       └── staff.py                  # Quản lý nhân sự & điểm danh FaceID
├── mcp/
│   └── mcp_server.py                 # FastMCP Server (Resources & Tools điều khiển trang trại)
├── services/
│   ├── agent_service.py              # Gemini AI Agent (Chat, SSE Streaming `chat_stream`, Multimodal RAG + Rule Fallback)
│   ├── rag_service.py                # RAG Engine (Pinecone VectorStore + Gemini Embeddings 1024D + Phác đồ bệnh)
│   ├── embeddings.py                 # Custom Gemini Embeddings (dim: 1024)
│   └── face_service.py               # Giao tiếp Microservice FaceID & Uniform (Port 8001)
├── background/
│   ├── watcher.py                    # The Watcher: Quan sát từng chuồng 24/7, tự bật quạt/đèn/phun sương & đẩy newsfeed
│   ├── newsfeed_service.py           # Tổng hợp Bản Tin Quan Sát Trực Tiếp kèm lối tắt xử lý nhanh (`quick_api`)
│   └── scheduler.py                  # APScheduler: Tổng hợp bản tin trang trại buổi sáng 07:00
├── api/
│   └── websocket_manager.py          # Quản lý WebSocket realtime (`/ws`) đồng bộ đa thiết bị
└── main.py                           # FastAPI Web Server & REST/SSE/WS Endpoints
```

---

## 🚀 Các Tính Năng Nổi Bật

### 1. Bản Tin Quan Sát Trực Tiếp Đồng Bộ Đa Thiết Bị (Live Observer News Feed)
* **Máy quan sát chủ động 24/7 ([`app/background/watcher.py`](file:///home/dat/n-ng-c-p/app/background/watcher.py))**:
  * Theo dõi cảm biến `env_logs` **độc lập theo từng chuồng** (`_last_processed_log_by_pen`) để phát hiện đột biến nhiệt độ, độ ẩm và mùi hôi (`smell_level >= 10.0`).
  * Tự động kích hoạt thiết bị ứng phó: bật **quạt** khi quá nóng (`> 35°C`) hoặc mùi cao, bật **đèn sưởi** khi quá lạnh (`< 15°C`), bật **phun sương** khi quá khô (`< 40%`).
  * Quét chủ động định kỳ kho vật tư sắp hết (`LOW_STOCK`), vật nuôi ốm/cần theo dõi (`HEALTH_ALERT`) và cây trồng sắp thu hoạch (`HARVEST_READY`).
* **News Feed ở đầu trang & Đồng bộ Realtime ([`app/background/newsfeed_service.py`](file:///home/dat/n-ng-c-p/app/background/newsfeed_service.py))**:
  * Endpoint `GET /api/newsfeed` trả về danh sách sự kiện ưu tiên (`critical` ➔ `warning` ➔ `info`) kèm **đường dẫn xử lý nhanh** (`action_route`, `action_label`, `quick_api`) và trạng thái `is_resolved` theo thiết bị thực tế.
  * Tự động phát sóng `newsfeed_update` qua WebSocket ngay khi có thay đổi cảm biến, điều khiển thiết bị hoặc cập nhật sức khỏe vật nuôi để **Web**, **PWA iOS** và **Android** luôn hiển thị đồng nhất.

### 2. Chatbot AI Streaming Giống Gemini Web & Đồng Bộ Web / Android
* **SSE Streaming (`POST /api/chat/stream`)**: Sử dụng `generate_content_stream` của Gemini để trả từng đoạn chữ theo thời gian thực kèm hiệu ứng shimmer *"Gemini AI đang suy nghĩ..."* và chữ chạy mượt trên cả **Web**, **PWA iOS** và **Android**.
* **Đồng bộ lịch sử & Realtime (`chat_message`)**: Tin nhắn văn bản và tin nhắn chẩn đoán ảnh được lưu qua [`chat_history.py`](file:///home/dat/n-ng-c-p/app/db/repositories/chat_history.py) và phát sự kiện `chat_message` qua WebSocket giúp **Web**, **PWA iOS** và **Android** tự động đồng bộ hội thoại.

### 3. Chẩn Đoán Bệnh Nông Nghiệp Đa Phương Thức Qua Ảnh Base64 + RAG
* **Hỗ trợ chọn ảnh & Copy-Paste ảnh (`Ctrl+V` / Clipboard)**: Trên cả **Frontend Web**, **PWA iOS** và **Android**, người dùng có thể chọn ảnh từ thư viện/camera hoặc dán ảnh trực tiếp vào thanh chat.
* **Pipeline `POST /api/diagnose/base64` (và `POST /api/diagnose`)**: Ảnh được mã hóa Base64, gửi kèm mô tả triệu chứng tới Gemini Multimodal + Pinecone RAG (`smart-farm-knowledge-base` + Built-in Veterinary/Crop Knowledge Base), trả về JSON chẩn đoán (`category`, `species`, `disease_name`, `answer`, `sources`) và tự động lưu vào lịch sử chat.

### 4. FastMCP Server Cho AI Agent ([`app/mcp/mcp_server.py`](file:///home/dat/n-ng-c-p/app/mcp/mcp_server.py))
* **MCP Resources**: `resource://farm/overview`, `resource://env/latest`, `resource://inventory/low-stock`, `resource://animals/attention`, `resource://crops/harvest`, `resource://staff/today`, `resource://staff/list`, `resource://knowledge/overview`.
* **MCP Tools**: Điều khiển thiết bị (`control_device`), cho ăn & trừ kho (`log_feeding`), cập nhật y tế vật nuôi/cây trồng, quản lý kho & lịch trình, tạo cảnh báo realtime (`create_system_alert`), tra cứu & chẩn đoán RAG (`search_agricultural_knowledge`, `diagnose_agricultural_disease`), và điểm danh nhân sự (`check_in_staff_face`).

### 5. Hai Microservice AI Vision Độc Lập
* **FaceID, Anti-Spoofing & Uniform Checker ([`standalone_ai_engine/`](file:///home/dat/n-ng-c-p/standalone_ai_engine/), Port `8001`)**: YuNet + SFace (128D embeddings), MiniFASNet Liveness chống giả mạo và kiểm tra đồng phục bảo hộ lao động.
* **Action Tracking & Motion AI Vision ([`action_vision_api/`](file:///home/dat/n-ng-c-p/action_vision_api/), Port `8002`)**: Giám sát IP Camera riêng cho từng chuồng/vườn (Multi-Pen Isolation), nhận diện hành vi tưới nước, cho ăn, bón phân bằng MediaPipe Pose Landmarker (`pose_landmarker_lite.task`) và phát luồng video qua WebSocket (`/ws/video_feed`).

### 6. Ứng Dụng Khách Đa Nền Tảng
* **Web Dashboard ([`frontend/`](file:///home/dat/n-ng-c-p/frontend/))**: Next.js 14 + Tailwind CSS + Chart.js (Port `3000`, tích hợp thêm giao diện `/ios`).
* **iOS PWA ([`pwa-ios/`](file:///home/dat/n-ng-c-p/pwa-ios/))**: Progressive Web App tối ưu cho Safari / Add to Home Screen trên iPhone & iPad (Port `3001`).
* **Android Native ([`android/`](file:///home/dat/n-ng-c-p/android/))**: Kotlin + Jetpack Compose Material 3 (xem chi tiết tại [`android/README.md`](file:///home/dat/n-ng-c-p/android/README.md)).

---

## 🔌 Các API & WebSocket Chính (Port `8000`)

| Phương thức | Endpoint | Mô tả |
| :--- | :--- | :--- |
| `GET` | `/api/newsfeed` | Lấy Bản Tin Quan Sát Trực Tiếp kèm lối tắt xử lý nhanh (`quick_api`, `action_route`) |
| `POST` | `/api/chat` | Chat với AI Agent (trả về JSON đầy đủ) |
| `POST` | `/api/chat/stream` | Chat SSE Streaming thời gian thực giống Gemini Web |
| `GET` | `/api/chat/history` | Lấy lịch sử chat theo `user_id` và `pen_id` |
| `POST` | `/api/diagnose/base64` | Chẩn đoán bệnh qua ảnh Base64 + RAG & tự động lưu lịch sử chat |
| `POST` | `/api/diagnose` | Chẩn đoán bệnh qua `multipart/form-data` |
| `GET` | `/api/knowledge/search` | Tra cứu cơ sở tri thức nông nghiệp (Pinecone + Fallback) |
| `POST` | `/api/devices/control` | Bật/tắt thiết bị IoT (`quạt`, `phun sương`, `đèn sưởi`) & đồng bộ newsfeed |
| `GET` | `/api/alerts` | Lấy danh sách cảnh báo hệ thống gần nhất |
| `POST` | `/api/scheduler/trigger-briefing` | Kích hoạt thủ công bản tin buổi sáng |
| `GET` / `POST` | `/api/staff`, `/api/staff/checkin`, `/api/staff/enroll` | Quản lý nhân sự & điểm danh FaceID |
| `WS` | `/ws` | Kênh WebSocket phát sự kiện: `newsfeed_update`, `chat_message`, `alert`, `device_update`, `morning_briefing`, `staff_checkin`, `animal_transfer` |

---

## 🛠️ Hướng Dẫn Vận Hành

### 1. Khởi chạy toàn bộ hệ thống (Background Mode)
```bash
./start.sh          # Khởi động Frontend (3000), Backend (8000), Face/Uniform AI (8001), Action Vision (8002)
./start.sh status   # Kiểm tra trạng thái các dịch vụ
./stop.sh           # Dừng toàn bộ hệ thống
```
Nếu chỉ muốn chạy 3 API Backend & AI (ví dụ khi Frontend deploy trên Vercel):
```bash
./start_apis.sh     # Khởi động các port 8000, 8001, 8002
./stop_apis.sh      # Dừng 3 API
```

### 2. Chạy riêng từng dịch vụ
* **Backend FastAPI (Port 8000)**:
  ```bash
  .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
  ```
* **AI Face & Uniform Engine (Port 8001)**:
  ```bash
  .venv/bin/uvicorn api_server:app --app-dir standalone_ai_engine --host 0.0.0.0 --port 8001 --reload
  ```
* **Action & Motion Vision API (Port 8002)**:
  ```bash
  .venv/bin/uvicorn main:app --app-dir action_vision_api --host 0.0.0.0 --port 8002 --reload
  ```
* **Frontend Web (Port 3000)** & **iOS PWA (Port 3001)**:
  ```bash
  cd frontend && npm run dev
  cd pwa-ios && npm run dev
  ```

Truy cập nhanh:
* **Web Dashboard**: [http://localhost:3000](http://localhost:3000) (giao diện iOS tại [http://localhost:3000/ios](http://localhost:3000/ios))
* **iOS PWA**: [http://localhost:3001](http://localhost:3001)
* **Backend API Swagger Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)
* **WebSocket Endpoint**: `ws://localhost:8000/ws`
* **Face & Uniform AI**: [http://localhost:8001](http://localhost:8001)
* **Action Vision Dashboard**: [http://localhost:8002](http://localhost:8002)

### 3. Chạy MCP Server Độc Lập (FastMCP stdio)
Kết nối với MCP Client ngoài (Claude Desktop, Cursor, Gemini MCP Host):
```bash
.venv/bin/python mcp_server.py
```

### 4. Kiểm Tra Toàn Bộ Hệ Thống (E2E Test)
```bash
.venv/bin/python scripts/verify_farm_system.py
.venv/bin/python scripts/verify_staff_workflow.py
```
