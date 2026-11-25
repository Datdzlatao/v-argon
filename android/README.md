# 📱 Smart Farm & Agriculture AI Agent - Android Kotlin App (Jetpack Compose)

Ứng dụng Android Native hoàn chỉnh được xây dựng bằng **Kotlin & Jetpack Compose (Material 3)**, áp dụng hệ thống thiết kế **UI/UX Pro Max (Phong cách Organic Biophilic)**, chuyển giao toàn bộ 100% tính năng từ giao diện web Frontend của Hệ thống Nông Trại Thông Minh (FastMCP + Gemini + Supabase + FastAPI).

---

## 🌿 1. Triết Lý Thiết Kế UI/UX Pro Max (Organic Biophilic)

Hệ thống giao diện được tối ưu chuẩn xác theo kết quả trích xuất từ bộ kỹ năng `ui-ux-pro-max`:
* **Bảng màu tự nhiên (Biophilic Palette)**:
  * `Primary`: `#15803D` (Xanh lá rừng nông nghiệp)
  * `Secondary`: `#22C55E` (Xanh mầm non sinh thái)
  * `Accent`: `#A16207` (Vàng hạt lúa chín / Nắng thu hoạch)
  * `Background`: `#F0FDF4` (Xanh ngọc nhạt mát mắt)
  * `Card Surface`: `#FFFFFF` viền bo mềm `#BBF7D0`
  * `Destructive / Alarm`: `#DC2626` (Đỏ cảnh báo vượt ngưỡng)
* **Bo góc hữu cơ (Organic Curves)**: 16dp - 24dp cho toàn bộ Card, Dialog, Nút bấm.
* **Tối ưu tương tác di động (Mobile UX Guidelines)**:
  * Kích thước vùng chạm cảm ứng tối thiểu 48dp.
  * Tỷ lệ tương phản văn bản đạt chuẩn WCAG > 4.5:1.
  * Hỗ trợ phản hồi xúc giác (Haptic) & âm thanh cảnh báo khi vi khí hậu vượt ngưỡng.

---

## 🏛️ 2. Cấu Trúc Mã Nguồn (Clean Architecture)

```
android/
├── settings.gradle.kts               # Khai báo settings Gradle & module :app
├── build.gradle.kts                  # Root Gradle build script
├── gradle.properties                 # JVM arguments & AndroidX flags
├── app/
│   ├── build.gradle.kts              # Compose BOM, Retrofit, OkHttp, Coil, CameraX
│   └── src/main/
│       ├── AndroidManifest.xml       # Quyền Internet, Camera, Vibrate, Network
│       ├── res/
│       │   ├── values/               # strings.xml, colors.xml, themes.xml
│       │   └── xml/                  # network_security_config.xml
│       └── java/com/smartfarm/app/
│           ├── SmartFarmApplication.kt
│           ├── MainActivity.kt       # Scaffold điều hướng chính, TopBar & BottomNav
│           ├── data/
│           │   ├── models/           # Pen, Device, Animal, Crop, Inventory, Staff...
│           │   ├── remote/
│           │   │   ├── ApiConfig.kt          # Cấu hình Backend URL & Supabase Key
│           │   │   ├── FarmApiService.kt     # Retrofit endpoints
│           │   │   ├── SupabaseRestClient.kt # REST Client truy vấn Supabase
│           │   │   └── FarmWebSocketManager.kt # WebSocket OkHttp realtime (/ws)
│           │   └── repository/
│           │       └── FarmRepository.kt     # Đồng bộ API, Supabase & WebSocket
│           └── ui/
│               ├── theme/            # Color, Type, Shape, Theme (Biophilic Tokens)
│               ├── components/
│               │   ├── FarmTopAppBar.kt          # Thanh tiêu đề, đổi Mode, trạng thái WS
│               │   ├── PenStoriesCarousel.kt     # Stories xem nhanh chuồng & cảnh báo
│               │   ├── EmergencyAlertBanner.kt   # Băng cảnh báo vi khí hậu khẩn cấp
│               │   ├── MorningBriefingCard.kt    # Bản tin sáng tự động từ Gemini AI
│               │   ├── EnvironmentMetricCards.kt # Thẻ đo Cảm biến & Biểu đồ Canvas
│               │   ├── DeviceControlCard.kt      # Điều khiển thiết bị IoT (Quạt, máy bơm)
│               │   └── CommonDialogs.kt          # Tất cả các Dialog nhập liệu
│               ├── screens/
│               │   ├── HomeScreen.kt             # Bảng tin trang trại tổng quan
│               │   ├── LivestockCropsScreen.kt   # Quản lý đàn vật nuôi & vụ cây trồng
│               │   ├── AttendanceScreen.kt       # Điểm danh FaceID 2 bước & Bảo hộ y tế
│               │   ├── CameraActionScreen.kt     # IP Camera & AI nhận diện hành động
│               │   ├── InventoryScreen.kt        # Quản lý kho cám, phân bón & xuất nhập
│               │   ├── AIChatScreen.kt           # Trợ lý AI FastMCP + Gemini 24/7
│               │   └── AuthScreen.kt             # Đăng nhập, Đăng ký & Chế độ Demo
│               ├── navigation/                   # Bottom Navigation & Định tuyến
│               └── viewmodel/                    # FarmViewModel (StateFlow quản lý state)
```

---

## ⚡ 3. Tính Năng Chi Tiết Tương Đương Web Frontend

1. **Xác thực & Cách ly dữ liệu người dùng (`AuthScreen`)**:
   * Hỗ trợ Đăng nhập, Đăng ký qua Supabase Auth.
   * Nút **Chế độ Dùng Thử (Demo Mode)** vào app ngay lập tức với dữ liệu giả lập thực tế.
2. **Chuyển đổi phân hệ Chăn Nuôi 🐖 và Trồng Trọt 🌿 (`FarmTopAppBar`)**:
   * Chuyển đổi linh hoạt giữa 2 phân hệ; tự động lọc danh sách chuồng, vật nuôi hoặc vườn cây trồng tương ứng.
3. **Thanh Stories Xem Nhanh Khu Vực (`PenStoriesCarousel`)**:
   * Hiển thị danh sách chuồng theo dạng Story tròn/bo góc.
   * Viền nhấp nháy đỏ (`alert-pulse`) báo động ngay lập tức nếu chuồng đó có sự cố.
   * Thẻ tạo mới chuồng trại (`+ Thêm Khu`).
4. **Giám Sát Vi Khí Hậu & Báo Động Môi Trường Khẩn Cấp (`EnvironmentMetricCards` & `EmergencyAlertBanner`)**:
   * Đo nhiệt độ (°C), độ ẩm (%) và nồng độ khí chuồng/mùi hôi (ppm) cho chăn nuôi hoặc độ ẩm đất (%) cho trồng trọt.
   * Biểu đồ đường thời gian thực 6 giờ gần nhất vẽ trực tiếp bằng Jetpack Compose Canvas.
   * Băng báo động đỏ nổi bật khi vượt ngưỡng: Có nút tắt/bật còi báo, nút **Bật Quạt Hút Mùi / Máy Phun**, và nút **Hỏi Trợ Lý AI**.
5. **Bản Tin Nông Trại Buổi Sáng 07:00 (`MorningBriefingCard`)**:
   * Gemini AI tổng hợp tình hình công việc, cảnh báo tồn kho, sức khỏe vật nuôi.
   * Nút **Làm Mới** kích hoạt lại AI tóm tắt; nút **Thả Tim / Hữu Ích**.
6. **Điều Khiển Thiết Bị Điện Thông Minh IoT (`DeviceControlCard`)**:
   * Bật/tắt Quạt hút mùi, Máy phun sương, Đèn sưởi ấm, Máy tưới nước qua WebSocket & REST API.
   * Hiển thị số chân GPIO vi điều khiển tương ứng.
7. **Quản Lý Vật Nuôi & Cây Trồng (`LivestockCropsScreen`)**:
   * Chuyển đổi giữa chế độ thẻ (Cards) và bảng (Table).
   * Lọc theo trạng thái: Tất cả, Sẵn sàng xuất/thu hoạch, Cần theo dõi, Khỏe mạnh.
   * Thanh tiến độ tăng trọng tự động tính toán theo cân nặng thực tế và mục tiêu xuất chuồng.
   * Chức năng Chuyển chuồng, Xóa và Thêm mới vật nuôi/vụ mùa.
8. **Điểm Danh FaceID 2 Bước & Kiểm Tra An Toàn Sinh Học (`AttendanceScreen`)**:
   * **Bước 1**: Nhận diện khuôn mặt FaceID qua YuNet + SFace (bỏ khẩu trang).
   * **Bước 2**: Quét trang phục bảo hộ (Khẩu trang y tế + Áo xanh bảo hộ + Quần tối màu).
   * Điểm danh vào ca (`check_in`) hoặc tan ca (`check_out`).
   * Xem danh sách nhân sự phụ trách từng khu và lịch sử ra vào ca trong ngày.
9. **IP Camera Chuồng & Nhận Diện Hành Động Bằng AI (`CameraActionScreen`)**:
   * Phát luồng IP Camera (RTSP / HTTP MJPEG).
   * Gemini Vision tự động phân tích hành vi theo thời gian thực (cho ăn, dọn dẹp, té ngã, bất thường).
   * Bảng nhật ký sự kiện kèm độ tin cậy AI (%).
10. **Kho Vật Tư Nông Trại (`InventoryScreen`)**:
    * Quản lý cám, phân bón, thuốc thú y, dụng cụ.
    * Huy hiệu cảnh báo tồn kho sắp hết (`Sắp hết`).
    * Hộp thoại **Nhập Kho** và **Xuất Dùng** (tự trừ tồn kho).
11. **Trợ Lý AI Nông Trại 24/7 (`AIChatScreen`)**:
    * Trò chuyện tự nhiên với Gemini 2.0 qua FastMCP.
    * Hiển thị thẻ thực thi công cụ trực quan khi AI gọi lệnh (`control_device`, `diagnose_agricultural_disease`, `log_feeding`).
    * Các nút gợi ý câu hỏi nhanh (bật quạt, chẩn đoán bệnh, kiểm tra kho).
12. **Kết Nối Realtime WebSocket & Snackbar Toast**:
    * Lắng nghe liên tục luồng sự kiện từ FastAPI `/ws` và hiển thị thông báo nổi tức thì khi có biến động trong nông trại.

---

## 🚀 4. Hướng Dẫn Mở & Chạy Dự Án

1. Mở **Android Studio** (Hedgehog, Iguana, Koala hoặc mới hơn).
2. Chọn **Open** và dẫn tới thư mục:
   ```
   /home/dat/n-ng-c-p/android
   ```
3. Chờ Android Studio đồng bộ Gradle (Gradle Sync).
4. Cấu hình địa chỉ IP backend (nếu muốn thay đổi) trong file:
   `android/app/src/main/java/com/smartfarm/app/data/remote/ApiConfig.kt`
5. Chọn thiết bị giả lập (Android Emulator API 34+) hoặc thiết bị Android thật (bật USB Debugging) và nhấn **Run (Shift + F10)**.
