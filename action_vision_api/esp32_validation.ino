/*
==============================================================================
DỰ ÁN NÔNG NGHIỆP THÔNG MINH V-ARGON
Phân hệ: Action Tracking & Hardware Validation
File: esp32_validation.ino (ESP32 Arduino C++ / PlatformIO)
==============================================================================
Nguyên lý thiết kế (Andrej Karpathy Guidelines):
- Đơn giản, thực dụng, không phụ thuộc thư viện rườm rà (dùng HTTPClient chuẩn và snprintf).
- Kiểm chứng thực chất (Ground Truth): Đọc cảm biến TRƯỚC và SAU khi bật Relay.
  Chỉ ghi nhận SUCCESS khi môi trường vật lý có sự thay đổi thực sự!
==============================================================================
*/

#include <WiFi.h>
#include <HTTPClient.h>

// ==========================================
// CẤU HÌNH KẾT NỐI & HỆ THỐNG
// ==========================================
const char* WIFI_SSID     = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// Địa chỉ IP của máy chủ FastAPI (Ví dụ: 192.168.1.100 hoặc domain)
const char* BACKEND_BASE_URL = "http://192.168.1.100:8000";

// Định danh khu vực của Node này
const char* TARGET_ID = "GARDEN_01";

// ==========================================
// ĐỊNH NGHĨA CHÂN PHẦN CỨNG (PIN MAP)
// ==========================================
#define PIN_RELAY_PUMP      23   // Relay máy bơm nước hoặc van xả cám
#define PIN_SOIL_MOISTURE   34   // Cảm biến độ ẩm đất (ADC1 Pin an toàn khi dùng WiFi)
#define PIN_TRIG_ULTRASONIC 5    // HC-SR04 Trigger Pin
#define PIN_ECHO_ULTRASONIC 18   // HC-SR04 Echo Pin

#define RELAY_ON            LOW  // Thường module Relay kích hoạt mức LOW
#define RELAY_OFF           HIGH

// Ngưỡng kiểm chứng vật lý (Calibration Thresholds)
const float MOISTURE_THRESHOLD_DELTA_PCT = 3.0; // Độ ẩm phải tăng ít nhất 3% sau khi tưới
const float DISTANCE_THRESHOLD_DELTA_CM  = 2.0; // Khoảng cách cám phải tăng ít nhất 2cm (cám vơi)

// ==========================================
// HÀM ĐỌC CẢM BIẾN (SENSOR READING)
// ==========================================

// Đọc độ ẩm đất dạng phần trăm (%) với lấy mẫu trung bình 10 lần chống nhiễu
float readSoilMoisturePercent() {
    long sum = 0;
    for (int i = 0; i < 10; i++) {
        sum += analogRead(PIN_SOIL_MOISTURE);
        delay(20);
    }
    float rawValue = (float)sum / 10.0;

    // Giả định chuẩn hóa ESP32 ADC 12-bit (0 - 4095):
    // Cảm biến điện dung: 4095 (không khí khô) -> ~1500 (nước đầy)
    // Tùy chỉnh công thức theo cảm biến thực tế:
    float dryValue = 3500.0;
    float wetValue = 1500.0;
    float pct = (dryValue - rawValue) / (dryValue - wetValue) * 100.0;
    
    if (pct < 0.0) pct = 0.0;
    if (pct > 100.0) pct = 100.0;
    return pct;
}

// Đọc khoảng cách cảm biến siêu âm HC-SR04 (cm)
float readUltrasonicDistanceCm() {
    digitalWrite(PIN_TRIG_ULTRASONIC, LOW);
    delayMicroseconds(2);
    digitalWrite(PIN_TRIG_ULTRASONIC, HIGH);
    delayMicroseconds(10);
    digitalWrite(PIN_TRIG_ULTRASONIC, LOW);

    // Timeout 30000us (~5m tối đa)
    long duration = pulseIn(PIN_ECHO_ULTRASONIC, HIGH, 30000);
    if (duration == 0) {
        return -1.0; // Lỗi cảm biến không phản hồi
    }
    float distanceCm = (float)duration * 0.0343 / 2.0;
    return distanceCm;
}

// ==========================================
// GỬI LOG KẾT QUẢ VỀ FASTAPI BACKEND
// ==========================================
bool sendLogToBackend(const char* actionType, const char* triggerSource, 
                      int durationSec, const char* statusStr, const char* note) {
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("[LỖI] WiFi ngắt kết nối, không thể gửi log!");
        return false;
    }

    HTTPClient http;
    char endpoint[128];
    snprintf(endpoint, sizeof(endpoint), "%s/api/actions/log", BACKEND_BASE_URL);
    
    http.begin(endpoint);
    http.addHeader("Content-Type", "application/json");

    // Chuẩn bị payload JSON bằng snprintf (Không cần thư viện bên thứ 3)
    char payload[512];
    snprintf(payload, sizeof(payload),
        "{"
        "\"action_type\":\"%s\","
        "\"trigger_source\":\"%s\","
        "\"target_id\":\"%s\","
        "\"duration_sec\":%d,"
        "\"status\":\"%s\","
        "\"confidence_note\":\"%s\""
        "}",
        actionType, triggerSource, TARGET_ID, durationSec, statusStr, note
    );

    Serial.print("[HTTP] Gửi log: ");
    Serial.println(payload);

    int httpCode = http.POST(payload);
    bool success = false;

    if (httpCode > 0) {
        String response = http.getString();
        Serial.printf("[HTTP] Mã phản hồi: %d, Chi tiết: %s\n", httpCode, response.c_str());
        if (httpCode == 200 || httpCode == 201) {
            success = true;
        }
    } else {
        Serial.printf("[HTTP] Lỗi kết nối: %s\n", http.errorToString(httpCode).c_str());
    }

    http.end();
    return success;
}

// ==========================================
// CORE LOGIC: CROSS-VALIDATION (ĐỐI CHIẾU KÉP)
// ==========================================
void executeAndValidateAction(const char* actionType, int durationSec, const char* triggerSource) {
    Serial.println("==================================================");
    Serial.printf("BẮT ĐẦU THỰC THI & KIỂM CHỨNG: %s (Thời lượng: %ds)\n", actionType, durationSec);
    Serial.println("==================================================");

    char note[256];
    bool isValidated = false;

    if (strcmp(actionType, "WATERING") == 0) {
        // -------------------------------------------------------------
        // KIỂM CHỨNG TƯỚI NƯỚC: SO SÁNH ĐỘ ẨM TRƯỚC VÀ SAU
        // -------------------------------------------------------------
        float moistureBefore = readSoilMoisturePercent();
        Serial.printf("-> [BƯỚC 1] Độ ẩm đất ban đầu (TRƯỚC khi bơm): %.2f%%\n", moistureBefore);

        // Kích hoạt Relay bơm
        Serial.println("-> [BƯỚC 2] Bật máy bơm...");
        digitalWrite(PIN_RELAY_PUMP, RELAY_ON);
        delay(durationSec * 1000);
        digitalWrite(PIN_RELAY_PUMP, RELAY_OFF);
        Serial.println("-> [BƯỚC 3] Tắt máy bơm.");

        // Chờ 5 giây cho nước ngấm đều vào đất
        Serial.println("-> [BƯỚC 4] Chờ 5 giây để nước ngấm vào đất...");
        delay(5000);

        float moistureAfter = readSoilMoisturePercent();
        float delta = moistureAfter - moistureBefore;
        Serial.printf("-> [BƯỚC 5] Độ ẩm đất đo lại (SAU khi ngấm): %.2f%% (Delta: %+.2f%%)\n", moistureAfter, delta);

        // Kiểm tra điều kiện thực tế
        if (delta >= MOISTURE_THRESHOLD_DELTA_PCT) {
            isValidated = true;
            snprintf(note, sizeof(note), "Độ ẩm tăng thực tế từ %.1f%% lên %.1f%% (Delta: +%.1f%%). Cấp nước tốt.", 
                     moistureBefore, moistureAfter, delta);
        } else {
            isValidated = false;
            snprintf(note, sizeof(note), "CẢNH BÁO BƠM LỖI: Độ ẩm không đổi (Trước: %.1f%%, Sau: %.1f%%). Nghi hết nước bồn hoặc nghẹt ống.",
                     moistureBefore, moistureAfter);
        }

    } else if (strcmp(actionType, "FEEDING") == 0) {
        // -------------------------------------------------------------
        // KIỂM CHỨNG CHO ĂN: KHOẢNG CÁCH SIÊU ÂM TỚI MẶT CÁM TRONG PHỄU
        // (Khi cám rơi xuống máng, khoảng cách từ cảm biến tới mặt cám tăng lên)
        // -------------------------------------------------------------
        float distBefore = readUltrasonicDistanceCm();
        Serial.printf("-> [BƯỚC 1] Khoảng cách phễu cám TRƯỚC khi mở van: %.2f cm\n", distBefore);

        // Mở van cấp thức ăn
        digitalWrite(PIN_RELAY_PUMP, RELAY_ON);
        delay(durationSec * 1000);
        digitalWrite(PIN_RELAY_PUMP, RELAY_OFF);

        // Chờ 5 giây cho thức ăn rơi hết
        delay(5000);

        float distAfter = readUltrasonicDistanceCm();
        float delta = distAfter - distBefore;
        Serial.printf("-> [BƯỚC 5] Khoảng cách phễu cám SAU khi xả: %.2f cm (Delta: %+.2f cm)\n", distAfter, delta);

        if (delta >= DISTANCE_THRESHOLD_DELTA_CM) {
            isValidated = true;
            snprintf(note, sizeof(note), "Cám đã xả thành công. Mức phễu vơi từ %.1fcm xuống %.1fcm (Delta: +%.1fcm).",
                     distBefore, distAfter, delta);
        } else {
            isValidated = false;
            snprintf(note, sizeof(note), "CẢNH BÁO KẸT CÁM: Khoảng cách phễu không đổi (Trước: %.1fcm, Sau: %.1fcm). Có thể bị vón cục kẹt van.",
                     distBefore, distAfter);
        }
    }

    // Gửi log kết quả với trạng thái SUCCESS hoặc FAILED
    const char* finalStatus = isValidated ? "SUCCESS" : "FAILED";
    Serial.printf("-> KẾT LUẬN KIỂM CHỨNG: [%s]\n", finalStatus);
    sendLogToBackend(actionType, triggerSource, durationSec, finalStatus, note);
}

// ==========================================
// ARDUINO SETUP & LOOP
// ==========================================
void setup() {
    Serial.begin(115200);
    delay(1000);

    // Cấu hình chân GPIO
    pinMode(PIN_RELAY_PUMP, OUTPUT);
    digitalWrite(PIN_RELAY_PUMP, RELAY_OFF); // Đảm bảo tắt bơm khi mới khởi động

    pinMode(PIN_TRIG_ULTRASONIC, OUTPUT);
    pinMode(PIN_ECHO_ULTRASONIC, INPUT);
    pinMode(PIN_SOIL_MOISTURE, INPUT);

    // Kết nối WiFi
    Serial.println();
    Serial.printf("Đang kết nối WiFi: %s ", WIFI_SSID);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    
    int retries = 0;
    while (WiFi.status() != WL_CONNECTED && retries < 20) {
        delay(500);
        Serial.print(".");
        retries++;
    }

    if (WiFi.status() == WL_CONNECTED) {
        Serial.println("\n[WiFi] Đã kết nối thành công!");
        Serial.printf("[WiFi] IP Address: %s\n", WiFi.localIP().toString().c_str());
    } else {
        Serial.println("\n[WiFi] Kết nối thất bại. Chạy chế độ Offline.");
    }

    Serial.println("\n[SẴN SÀNG] Gõ phím lệnh trên Serial Monitor để test kiểm chứng:");
    Serial.println("  'w' -> Test thực thi WATERING (Tưới nước 5s)");
    Serial.println("  'f' -> Test thực thi FEEDING (Cho ăn 5s)");
}

void loop() {
    // Nhận phím test từ Serial Monitor để kiểm chứng trực tiếp
    if (Serial.available()) {
        char cmd = Serial.read();
        if (cmd == 'w') {
            executeAndValidateAction("WATERING", 5, "AUTO");
        } else if (cmd == 'f') {
            executeAndValidateAction("FEEDING", 5, "AUTO");
        }
    }

    delay(100);
}
