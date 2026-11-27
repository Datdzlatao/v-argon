# V-ARGON — Hướng Dẫn Sử Dụng Logo (Mini Brand Guidelines)

> Tài liệu tóm tắt 1 trang dành cho đội ngũ kỹ thuật, truyền thông và đối tác in ấn.

## 1. Ý tưởng & Ý nghĩa biểu tượng ("Mầm Chữ V")
- **Ý tưởng cốt lõi:** Chữ **V** của **V-ARGON** được tạo hình thành đôi lá non đối xứng vươn lên, ôm trọn **hạt mầm sinh trưởng** ở trung tâm — biểu trưng cho nông nghiệp thông minh (trồng trọt & chăn nuôi), sự bảo vệ (từ tên gọi Argon) và công nghệ giám sát chính xác 24/7.
- **Các phiên bản chuẩn:**
  - `v-argon-horizontal-color.svg` — Lockup ngang chính (header web, tài liệu, slide).
  - `v-argon-horizontal-tagline-color.svg` — Lockup ngang kèm dòng phụ `SMART AGRICULTURE AI` (dùng cho bản lớn, banner, bìa tài liệu; không dùng dưới 160 px).
  - `v-argon-stacked-color.svg` — Lockup xếp dọc (bao bì, biển hiệu trang trại, thẻ nhân viên, splash screen).
  - `v-argon-symbol-color.svg` — Biểu tượng đơn (app icon, avatar, huy hiệu).
  - `v-argon-symbol-small.svg` — Bản tối ưu cỡ nhỏ (`16–24 px`, favicon).
  - `v-argon-wordmark-color.svg` — Chữ V-ARGON đơn thuần (không có biểu tượng).
- **Chọn đúng định dạng:**
  - **Màn hình / Web / App:** Dùng file trong `digital/`, `web-icons/` và `social/` (`.svg` vector, `.png` nền trong suốt, hệ màu RGB).
  - **In ấn / Biển hiệu / Thêu đồng phục:** Dùng file vector gốc trong `print/` và quy đổi theo hệ màu CMYK hoặc Pantone bên dưới — **không** gửi file `.png` RGB hoặc ảnh chụp màn hình cho nhà in.

## 2. Vùng an toàn (Clear Space)
- Giữ khoảng trống tối thiểu bằng **1 × `u`** xung quanh bốn phía của logo, trong đó **`u` = chiều rộng phần hạt mầm trung tâm** (hoặc **1/2 chiều cao chữ hoa `V-ARGON`** đối với lockup). Không đặt chữ, viền khung hoặc yếu tố trang trí xâm phạm vùng này.

## 3. Kích thước tối thiểu (Minimum Size)
| Phiên bản | Màn hình (Screen) | In ấn (Print) |
|---|---|---|
| Lockup ngang (`horizontal`) | Rộng tối thiểu `96 px` (không kèm tagline) | Rộng tối thiểu `25 mm` |
| Lockup xếp dọc (`stacked`) | Rộng tối thiểu `72 px` | Rộng tối thiểu `20 mm` |
| Biểu tượng đơn (`symbol`) | `16 px` (dùng bản `v-argon-symbol-small.svg` / `favicon`) | `6 mm` |

## 4. Bảng màu thương hiệu (Brand Colour Palette)
| Tên màu | Vai trò | HEX | RGB | CMYK (tham khảo) | Pantone (gần đúng) |
|---|---|---|---|---|---|
| **V-ARGON Emerald** | Màu chủ đạo (đôi lá chữ V, nền app icon, nút chính) | `#15803D` | `21, 128, 61` | `84, 0, 52, 50` | `348 C` |
| **Sprout Green** | Điểm nhấn sinh trưởng (hạt mầm, trạng thái hoạt động) | `#22C55E` | `34, 197, 94` | `83, 0, 52, 23` | `7480 C` |
| **Mint Glow** | Điểm nhấn trên nền tối (Dark Mode) | `#4ADE80` | `74, 222, 128` | `67, 0, 42, 13` | `7479 C` |
| **Forest Ink** | Màu chữ wordmark & nền tối | `#14211A` | `20, 33, 26` | `39, 0, 21, 87` | `5535 C` |
| **Mint Mist** | Nền sáng nhẹ / thẻ phụ | `#ECFDF5` | `236, 253, 245` | `7, 0, 3, 1` | `—` |

- **Phối nền được duyệt:**
  - Nền trắng (`#FFFFFF`) hoặc Mint Mist (`#ECFDF5`): dùng bản đầy đủ màu (`*-color.svg`) hoặc bản 1 màu đen (`*-black.svg`).
  - Nền tối (`#14211A`, `#161616`): dùng bản dark-mode màu (`*-dark.svg`) hoặc bản âm bản trắng (`v-argon-symbol-white.svg`, đã được làm mảnh nét ~1.8 đơn vị để bù hiện tượng lóa trắng khi đảo nền).
  - Nền xanh Emerald (`#15803D`): dùng bản trắng đơn sắc (`*-white.svg`).
  - Trên ảnh chụp trang trại: đặt bản trắng/đen ở vùng nền tĩnh ít chi tiết, hoặc đặt biểu tượng trong ô vuông bo góc `#15803D` (`app-icon.svg`).

## 5. Kiểu chữ (Typography)
- **Wordmark:** Dựng vector path tùy biến kerning dựa trên bộ chữ mở **Noto Sans Bold** (`SIL Open Font License`) — **tuyệt đối không gõ lại logo bằng font hệ thống thông thường**.
- **Giao diện & Tiêu đề ứng dụng (UI):** `Be Vietnam Pro` (Web/Next.js) · `Fraunces` (tiêu đề landing trang trọng) · System Sans fallback (`system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`).

## 6. Những điều không nên làm (Don'ts)
- Không kéo dãn, bóp méo tỷ lệ ngang/dọc hoặc xoay nghiêng biểu tượng.
- Không đổi sang màu ngoài bảng màu quy định (tránh tím/xanh dương AI chatbot hoặc ngôi sao 4 cánh).
- Không thêm bóng đổ (`drop shadow`), viền nổi (`bevel`), phát sáng (`glow`) hay chuyển sắc phức tạp lên logo chính.
- Không tự ý thay đổi tỷ lệ hoặc khoảng cách giữa biểu tượng và chữ `V-ARGON` trong lockup.
- Không dùng bản lockup kèm dòng phụ `SMART AGRICULTURE AI` ở kích thước nhỏ (< 160 px).

## 7. Kiểm tra bàn giao & Lưu ý pháp lý
- **Đã kiểm thử:** Đạt `100/100` kiểm tra cấu trúc SVG (`svg_audit.py`) cho toàn bộ biến thể biểu tượng; đã kiểm tra hiển thị thực tế ở các cỡ `16 px`, `32 px`, `48 px`, `512 px`, bản âm bản và mockup ngành nông nghiệp thông minh.
- **Khuyến nghị trước công bố rộng rãi:** Cần thực hiện tra cứu nhãn hiệu (Cục Sở hữu trí tuệ / WIPO / reverse image search) và thử nghiệm màu thực tế với bảng Pantone vật lý trước khi in ấn số lượng lớn.
- **Thư mục gốc bộ kit:** `v-argon-logo-kit/` (`digital/`, `print/`, `social/`, `web-icons/`, `source/`, `presentation-board.html`).
