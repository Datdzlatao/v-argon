# 🌾 Hệ Thống Quản Lý Nông Trại Thông Minh & Trợ Lý AI Đa Nền Tảng

Hệ thống quản lý trang trại chăn nuôi & trồng trọt toàn diện trên **3 nền tảng** (**Web Next.js**, **PWA iOS**, **Android Native**), tích hợp **Trợ lý AI (FastMCP + Google Gemini)**, **Chẩn đoán bệnh qua hình ảnh (Pinecone RAG + Multimodal)**, **Theo dõi tự động 24/7 (Bản tin trực tiếp)** và **2 dịch vụ thị giác máy tính độc lập** (nhận diện khuôn mặt/đồ bảo hộ & theo dõi hành vi qua máy quay chuồng trại).

> Toàn bộ giao diện người dùng trên Web, iOS và Android được Việt hóa 100% bằng ngôn ngữ phổ thông, rõ ràng, dễ sử dụng cho nông dân và người lớn tuổi.

---

## 📁 Cấu Trúc Toàn Bộ Dự Án

```text
n-ng-c-p/
├── app/                              # Backend chính (FastAPI + FastMCP + Gemini + RAG + Watcher) - Port 8000
├── standalone_ai_engine/             # Dịch vụ AI nhận diện khuôn mặt, chống giả mạo & đồ bảo hộ - Port 8001
├── action_vision_api/                # Dịch vụ AI theo dõi hành vi & phát luồng máy quay chuồng trại - Port 8002
├── frontend/                         # Giao diện Web Dashboard chính & giao diện /ios (Next.js 14) - Port 3000
├── pwa-ios/                          # Ứng dụng Web PWA tối ưu riêng cho iPhone/iPad (Next.js 14) - Port 3001
├── android/                          # Ứng dụng Android Native (Kotlin + Jetpack Compose Material 3)
├── disease_diagnosis_rag/            # Module RAG chẩn đoán bệnh gốc (đã tích hợp vào app/services/rag_service.py)
├── legacy_web_dashboard/             # Giao diện Web tĩnh đời đầu (HTML/CSS/JS + Supabase + Chart.js)
├── scripts/                          # Bộ script kiểm thử hệ thống E2E
│   ├── verify_farm_system.py         # Kiểm tra E2E các phân hệ nông trại
│   ├── verify_staff_workflow.py      # Kiểm tra luồng nhân sự & điểm danh khuôn mặt
│   ├── verify_all_phases.py          # Kiểm thử toàn bộ các giai đoạn
│   └── verify_phase1.py              # Kiểm thử giai đoạn 1
├── known_faces/                      # Thư mục ảnh khuôn mặt nhân sự đã đăng ký
├── logs/                             # Log chạy nền và PID files của các dịch vụ
├── mcp_server.py                     # Entrypoint FastMCP Server độc lập (stdio)
├── schema.sql                        # DDL hoàn chỉnh, RLS Policies & dữ liệu mẫu cho Supabase
├── database.sql                      # Schema tham chiếu các bảng gốc
├── start.sh                          # Khởi chạy nền toàn bộ 4 dịch vụ (3000, 8000, 8001, 8002) + Tailscale Funnel
├── start_apis.sh                     # Khởi chạy nền riêng 3 API Backend & AI (8000, 8001, 8002)
├── stop.sh                           # Dừng toàn bộ hệ thống và reset Tailscale Funnel
└── stop_apis.sh                      # Dừng 3 API Backend & AI
```

---

## 🌐 Sơ Đồ Cổng Dịch Vụ & Tailscale Funnel

| Dịch vụ | Thư mục | Cổng nội bộ (LAN) | Tailscale Funnel (HTTPS/WSS) |
| :--- | :--- | :---: | :--- |
| **Backend Chính (FastAPI + MCP)** | `app/` | `8000` | `https://dat-latitude-5590-2.tail2bda46.ts.net:8443` |
| **AI Khuôn Mặt & Bảo Hộ** | `standalone_ai_engine/` | `8001` | `https://dat-latitude-5590-2.tail2bda46.ts.net:10000` |
| **AI Hành Vi & Máy Quay** | `action_vision_api/` | `8002` | `https://dat-latitude-5590-2.tail2bda46.ts.net` (443) |
| **Web Dashboard & `/ios`** | `frontend/` | `3000` | Truy cập nội bộ hoặc deploy Vercel |
| **PWA iOS độc lập** | `pwa-ios/` | `3001` | Truy cập nội bộ hoặc deploy Vercel |

---

## 🏛️ Chi Tiết Từng Phân Hệ

### 1. Backend Chính (`app/` — Port `8000`)

```text
app/
├── config.py                         # Cấu hình biến môi trường bằng pydantic-settings (.env)
├── main.py                           # FastAPI REST, SSE Streaming, WebSocket & CORS
├── api/
│   └── websocket_manager.py          # Quản lý kết nối WebSocket `/ws` phát sự kiện realtime
├── background/
│   ├── watcher.py                    # Theo dõi cảm biến 24/7 theo từng chuồng, tự bật thiết bị ứng phó
│   ├── newsfeed_service.py           # Tổng hợp Bản tin theo dõi trực tiếp kèm nút xử lý nhanh & đồng bộ SQLite
│   └── scheduler.py                  # APScheduler: Tổng hợp bản tin trang trại buổi sáng (07:00)
├── db/
│   ├── supabase_client.py            # Singleton Client kết nối Supabase
│   └── repositories/                 # Tầng truy cập dữ liệu (pens, devices, animals, crops, env_logs, inventory, feed_logs, schedules, alerts, chat_history, staff)
├── mcp/
│   └── mcp_server.py                 # FastMCP Server cung cấp Resources & Tools cho AI Agent
├── models/
│   └── schemas.py                    # Pydantic schemas cho IoT, vật nuôi, cây trồng, chẩn đoán ảnh, nhân sự
└── services/
    ├── agent_service.py              # Gemini AI Agent (Chat thường, SSE Streaming `chat_stream`, gọi Tool MCP)
    ├── rag_service.py                # Pinecone VectorStore + Gemini Embeddings 1024D + Phác đồ xử lý bệnh
    ├── embeddings.py                 # Custom Gemini Embeddings (dim: 1024)
    └── face_service.py               # Kết nối dịch vụ nhận diện khuôn mặt & đồ bảo hộ (Port 8001)
```

**Chức năng cốt lõi:**
* **Theo dõi tự động 24/7 (`watcher.py`)**: Giám sát cảm biến nhiệt độ, độ ẩm, mùi hôi độc lập từng khu vực; tự động bật quạt khi nóng/mùi cao, bật đèn sưởi khi lạnh, bật phun sương khi khô; đồng thời quét vật tư sắp hết, vật nuôi cần chăm sóc và cây trồng đến kỳ thu hoạch.
* **Bản Tin Theo Dõi Trực Tiếp (`newsfeed_service.py`)**: Cung cấp `GET /api/newsfeed` sắp xếp theo mức độ ưu tiên (`critical` → `warning` → `info`) kèm nút thao tác nhanh (`quick_api`, `action_route`) chuyển thẳng đến đúng khu vực/vật nuôi/kho cần xử lý, phát sự kiện `newsfeed_update` qua WebSocket để Web, iOS và Android luôn đồng bộ.
* **Trợ lý AI Streaming & Chẩn đoán bệnh qua ảnh**: `POST /api/chat/stream` trả chữ theo thời gian thực qua SSE; `POST /api/diagnose/base64` nhận ảnh chụp/dán từ người dùng để phân tích bệnh cây trồng/vật nuôi và lưu đồng bộ vào lịch sử chat (`chat_history.py`, hỗ trợ cả Supabase UUID và SQLite local fallback).

### 2. AI Khuôn Mặt & Đồ Bảo Hộ (`standalone_ai_engine/` — Port `8001`)

* **Thành phần chính**: `api_server.py`, `face_engine.py`, `anti_spoofing.py`, `person_detector.py`, `uniform_checker.py`, `uniform_color_analyzer.py`, `camera_service.py`.
* **Quy trình 2 bước**:
  * **Bước 1**: Nhận diện khuôn mặt bằng YuNet + SFace (embedding 128D) kết hợp kiểm tra chống giả mạo MiniFASNet (phát hiện ảnh chụp/màn hình).
  * **Bước 2**: Kiểm tra trang phục bảo hộ lao động (khẩu trang, màu áo bảo hộ, màu quần) trước khi cho phép chấm công vào ca/tan ca.
* **Đăng ký 3 góc**: Hỗ trợ chụp/tải lên 3 góc mặt (Thẳng, Nghiêng Trái, Nghiêng Phải) lưu vào `known_faces/`.

### 3. AI Hành Vi & Luồng Máy Quay (`action_vision_api/` — Port `8002`)

* **Thành phần chính**: `main.py`, `vision_tracker.py`, `pose_landmarker_lite.task`, `esp32_validation.ino`.
* **Cô lập theo từng khu vực (`MultiCameraManager`)**: Mỗi chuồng/vườn chạy luồng **Máy quay điện thoại (IP Cam)** và **Máy quay máy tính (Webcam)** riêng biệt.
* **Giao thức truyền hình ảnh 2 chặng**:
  * **Chặng 1 (Camera → Server)**: Hỗ trợ **HTTP MJPEG** (tự chuẩn hóa URL `IP:8080` → `http://IP:8080/video`, có fallback đọc luồng MJPEG trực tiếp bằng `requests` khi OpenCV/FFmpeg lỗi) và **RTSP/RTMP** (`rtsp_transport;tcp`).
  * **Chặng 2 (Server → Web / iOS / Android)**: Phát khung hình JPEG nhị phân qua **WebSocket (`/ws/video_feed`)** kèm cơ chế `"ack"` (`max_in_flight = 2`) giúp giảm trễ tối đa.
* **Nhận diện hành vi**: Dùng MediaPipe Pose Landmarker + Máy trạng thái hữu hạn (FSM) để lọc khung hình tĩnh và chỉ gọi Gemini Vision xác thực hành vi (cho ăn, tưới nước, bón phân...) vào đúng thời điểm cần thiết.

### 4. Ứng Dụng Khách Đa Nền Tảng

* **Web Dashboard (`frontend/` — Port `3000`)**:
  * Next.js 14 + React 18 + Tailwind CSS + Chart.js.
  * Tích hợp đầy đủ: Bảng tin trực tiếp, Giám sát cảm biến & biểu đồ, Điều khiển thiết bị IoT, Quản lý đàn vật nuôi & cây trồng, Kho vật tư, Điểm danh 2 bước, Máy quay trực tiếp, Bong bóng chat trợ lý (hỗ trợ dán ảnh `Ctrl+V`) và trang di động `/ios`.
* **PWA iOS (`pwa-ios/` — Port `3001`)**:
  * Next.js 14 tối ưu cho Safari trên iPhone/iPad (cài đặt ra màn hình chính, giao diện 4 tab gọn nhẹ, đồng bộ WebSocket realtime).
* **Android Native (`android/`)**:
  * Kotlin + Jetpack Compose (Material 3), kiến trúc MVVM (`FarmViewModel`, `FarmRepository`, `ApiConfig`, `FarmWebSocketManager`).
  * 5 tab chính (`Trang Chủ`, `Nuôi Trồng`, `Ra Vào`, `Máy Quay`, `Kho Vật Tư`) + màn hình `Trợ Lý`. Trang Chủ tập trung thông tin trang trại (không trùng lặp khung máy quay với tab Máy Quay), điều hướng tab chuẩn xác qua `navigateToTab`.
  * Chi tiết xem thêm tại [`android/README.md`](file:///home/dat/n-ng-c-p/android/README.md).

---

## 🔌 Các API & WebSocket Chính (Port `8000`)

| Phương thức | Endpoint | Mô tả |
| :--- | :--- | :--- |
| `GET` | `/api/pens` | Danh sách chuồng nuôi / vườn trồng |
| `PATCH` | `/api/pens/{pen_id}` | Cập nhật thông tin khu vực, địa chỉ `camera_url` và `webcam_url` |
| `GET` | `/api/dashboard` | Dữ liệu tổng quan cảm biến, thiết bị, cảnh báo |
| `GET` | `/api/newsfeed` | Bản tin theo dõi trực tiếp kèm nút thao tác nhanh |
| `POST` | `/api/chat` | Trò chuyện AI Agent (trả về JSON đầy đủ) |
| `POST` | `/api/chat/stream` | Trò chuyện AI theo luồng SSE thời gian thực |
| `GET` | `/api/chat/history` | Lịch sử hội thoại theo `user_id` và `pen_id` |
| `POST` | `/api/diagnose/base64` | Chẩn đoán bệnh qua ảnh Base64 + RAG và lưu lịch sử |
| `POST` | `/api/diagnose` | Chẩn đoán bệnh qua `multipart/form-data` |
| `POST` | `/api/devices/control` | Bật/tắt thiết bị IoT & đồng bộ bản tin |
| `GET` / `POST` | `/api/staff`, `/api/staff/checkin`, `/api/staff/enroll` | Quản lý nhân sự, đăng ký 3 góc & điểm danh |
| `WS` | `/ws` | Đồng bộ realtime: `newsfeed_update`, `chat_message`, `alert`, `device_update`, `morning_briefing`, `staff_checkin`, `animal_transfer` |

---

## 🛠️ Hướng Dẫn Cài Đặt & Vận Hành

### 1. Cấu hình môi trường (`.env`)
Cần cấu hình các biến môi trường chính trong `.env` ở thư mục gốc:
* `SUPABASE_URL`, `SUPABASE_KEY`
* `GEMINI_API_KEY` (và tùy chọn `PINECONE_API_KEY`, `PINECONE_INDEX_NAME`)
* `CAMERA_SOURCE`, `WEBCAM_SOURCE` (mặc định `0`)

Khởi tạo cơ sở dữ liệu trên Supabase bằng file [`schema.sql`](file:///home/dat/n-ng-c-p/schema.sql).

### 2. Khởi chạy toàn bộ hệ thống (Chế độ chạy nền)
```bash
./start.sh          # Khởi động Frontend (3000), Backend (8000), Face/Uniform AI (8001), Action Vision (8002) + Tailscale Funnel
./start.sh status   # Kiểm tra trạng thái các cổng và Tailscale Funnel
./stop.sh           # Dừng toàn bộ dịch vụ
```

Nếu chỉ muốn chạy 3 API Backend & AI (Ports `8000`, `8001`, `8002`):
```bash
./start_apis.sh     # Khởi động 3 API
./stop_apis.sh      # Dừng 3 API
```

### 3. Chạy thủ công từng dịch vụ
```bash
# Backend chính (Port 8000)
.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# AI Khuôn mặt & Bảo hộ (Port 8001)
.venv/bin/uvicorn api_server:app --app-dir standalone_ai_engine --host 0.0.0.0 --port 8001 --reload

# AI Hành vi & Máy quay (Port 8002)
.venv/bin/uvicorn main:app --app-dir action_vision_api --host 0.0.0.0 --port 8002 --reload

# Web Dashboard (Port 3000) & PWA iOS (Port 3001)
cd frontend && npm run dev
cd pwa-ios && npm run dev
```

### 4. Build ứng dụng Android APK
```bash
cd android
./gradlew assembleDebug
# File APK xuất ra tại: android/app/build/outputs/apk/debug/app-debug.apk
```

### 5. Chạy MCP Server độc lập & Kiểm thử E2E
```bash
# Chạy FastMCP stdio cho MCP Client ngoài (Claude Desktop, Cursor...)
.venv/bin/python mcp_server.py

# Chạy kiểm thử toàn hệ thống
.venv/bin/python scripts/verify_farm_system.py
.venv/bin/python scripts/verify_staff_workflow.py
```

### 6. Truy cập nhanh
* **Web Dashboard**: [http://localhost:3000](http://localhost:3000) (giao diện di động: [http://localhost:3000/ios](http://localhost:3000/ios))
* **PWA iOS**: [http://localhost:3001](http://localhost:3001)
* **Backend API Docs (Swagger)**: [http://localhost:8000/docs](http://localhost:8000/docs)
* **AI Khuôn Mặt & Bảo Hộ**: [http://localhost:8001](http://localhost:8001)
* **AI Hành Vi & Máy Quay**: [http://localhost:8002](http://localhost:8002)
