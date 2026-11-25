package com.smartfarm.app.data.models

import com.google.gson.annotations.SerializedName

/**
 * Data Models matching Supabase tables and FastAPI Backend endpoints
 */

data class Pen(
    @SerializedName("id") val id: String,
    @SerializedName("name") val name: String,
    @SerializedName("type") val type: String = "livestock", // "livestock" | "cultivation" | "crops"
    @SerializedName("user_id") val userId: String? = null,
    @SerializedName("camera_url") val cameraUrl: String? = null,
    @SerializedName("webcam_url") val webcamUrl: String? = "0",
    val hasAlert: Boolean = false
)

data class Device(
    @SerializedName("id") val id: String,
    @SerializedName("name") val name: String,
    @SerializedName("is_active") val isActive: Boolean = false,
    @SerializedName("pen_id") val penId: String? = null,
    @SerializedName("pin_number") val pinNumber: Int? = null
) {
    val pin: Int?
        get() = pinNumber
}

data class Animal(
    @SerializedName("id") val id: String,
    @SerializedName("species") val species: String,
    @SerializedName("weight") val weight: Double,
    @SerializedName("target_weight") val targetWeight: Double,
    @SerializedName("feeding_status") val feedingStatus: String? = "Normal",
    @SerializedName("status") val status: String? = "healthy", // "healthy" | "attention" | "ready" | "Khoe" | "Sot nhe"
    @SerializedName("pen_id") val penId: String? = null
)

data class AnimalHealthLog(
    val id: String,
    val animalId: String,
    val date: String,
    val condition: String,
    val diagnosis: String? = null,
    val treatment: String? = null
)

data class AnimalWeightLog(
    val id: String,
    val animalId: String,
    val date: String,
    val weight: Double
)

data class Crop(
    @SerializedName("id") val id: Any? = null,
    @SerializedName("name") val name: String,
    @SerializedName("quantity") val quantity: Int = 0,
    @SerializedName("plant_date") val plantDate: String? = null,
    @SerializedName("harvest_date") val harvestDate: String? = null,
    @SerializedName("status") val status: String? = "healthy",
    @SerializedName("pen_id") val penId: String? = null
) {
    val displayId: String
        get() = when (val currentId = id) {
            is Double -> currentId.toLong().toString()
            is Number -> currentId.toLong().toString()
            is String -> currentId
            else -> currentId?.toString() ?: ""
        }

    val stage: String
        get() = when (status) {
            "Growing" -> "Đang phát triển"
            "ready" -> "Sẵn sàng thu hoạch"
            "attention" -> "Cần chăm sóc"
            else -> status ?: "Đang phát triển"
        }

    val expectedHarvest: String
        get() = harvestDate ?: "Dự kiến"

    val plantingDate: String
        get() = plantDate ?: "Mới gieo"
}

data class CropGrowthLog(
    val id: String,
    val cropId: String,
    val date: String,
    val stage: String,
    val heightCm: Double,
    val notes: String? = null
)

data class CropCareLog(
    val id: String,
    val cropId: String,
    val date: String,
    val careType: String, // "Tưới nước", "Bón phân", "Phun thuốc"
    val materialName: String? = null,
    val amount: String? = null,
    val notes: String? = null
)

data class InventoryItem(
    @SerializedName("id") val id: Any? = null,
    @SerializedName("name") val name: String,
    @SerializedName("category") val category: String = "Vật tư", // "Feed", "Crops", "Thức ăn", "Phân bón", "Thuốc thú y", "Dụng cụ"
    @SerializedName("quantity") val quantity: Double = 0.0,
    @SerializedName("unit") val unit: String = "kg",
    @SerializedName("unit_price") val unitPrice: Double? = 0.0,
    @SerializedName("min_threshold") val minThreshold: Double = 10.0,
    @SerializedName("location") val location: String? = "Kho Chính"
) {
    val displayId: String
        get() = when (val currentId = id) {
            is Double -> currentId.toLong().toString()
            is Number -> currentId.toLong().toString()
            is String -> currentId
            else -> currentId?.toString() ?: ""
        }

    val price: Double
        get() = unitPrice ?: 0.0
}

data class EnvData(
    val temp: Double = 28.5,
    val hum: Double = 70.0,
    val smell: Double = 150.0 // Smell Level in ppm for livestock OR Soil Moisture % for crops
)

data class EnvHistoryPoint(
    val time: String,
    val temp: Double,
    val hum: Double,
    val smell: Double
)

data class Staff(
    @SerializedName("id") val id: String,
    @SerializedName("name") val name: String,
    @SerializedName("role") val role: String? = "Kỹ thuật viên",
    @SerializedName("pen_id") val penId: String? = null,
    @SerializedName("phone") val phone: String? = null,
    @SerializedName("avatar_url") val avatarUrl: String? = null
)

data class AttendanceRecord(
    @SerializedName("id") val id: Any? = null,
    @SerializedName("staff_id") val staffId: String,
    @SerializedName("staff_name") val staffName: String,
    @SerializedName("pen_id") val penId: String? = null,
    @SerializedName("status") val status: String = "present",
    @SerializedName("check_type") val checkType: String = "check_in",
    @SerializedName("confidence") val confidence: Double = 0.98,
    @SerializedName("is_real") val isReal: Boolean = true,
    @SerializedName("note") val note: String? = null,
    @SerializedName("created_at") val createdAt: String? = null
)

data class UniformInspectionResult(
    val isCompliant: Boolean,
    val hasMask: Boolean,
    val hasProtectiveCoat: Boolean,
    val hasDarkTrousers: Boolean,
    val overallConfidence: Double,
    val details: String
)

data class ActionTelemetry(
    @SerializedName("target_id") val targetId: String = "DEFAULT",
    @SerializedName("last_action") val lastAction: String = "Bình thường",
    @SerializedName("confidence") val confidence: Double = 0.95,
    @SerializedName("fps") val fps: Double = 15.0,
    @SerializedName("status") val status: String = "running",
    @SerializedName("is_running") val isRunning: Boolean = false,
    @SerializedName("camera_source") val cameraSource: String? = null,
    @SerializedName("fsm_state") val fsmState: String? = null,
    @SerializedName("last_action_reason") val lastActionReason: String? = null,
    @SerializedName("hip_vis") val hipVis: Double = 0.0,
    @SerializedName("wrist_vis") val wristVis: Double = 0.0,
    @SerializedName("torso_angle") val torsoAngle: Double = 180.0,
    @SerializedName("is_bending") val isBending: Boolean = false,
    @SerializedName("cooldown_remaining") val cooldownRemaining: Double = 0.0
)

data class ActionLog(
    @SerializedName("id") val id: String = "",
    @SerializedName("target_id") val targetId: String = "",
    @SerializedName("action_name") val actionName: String? = null,
    @SerializedName("confidence") val confidence: Double = 0.95,
    @SerializedName("time") val timeField: String? = null,
    @SerializedName("action_type") val actionType: String? = null,
    @SerializedName("action") val actionField: String? = null,
    @SerializedName("created_at") val createdAt: String? = null
) {
    val action: String
        get() = actionName ?: actionField ?: actionType ?: "Hành động chuồng trại"
    val time: String
        get() = timeField ?: createdAt ?: "Vừa xong"
}

data class DailyBriefing(
    val content: String,
    val pendingTasksCount: Int = 2,
    val lowStockCount: Int = 1,
    val sickAnimalsCount: Int = 1,
    val timestamp: String = "07:00 Hôm nay"
)

data class ToolCall(
    val tool: String,
    val args: Map<String, Any?> = emptyMap(),
    val result: String? = null
)

data class ChatMessage(
    val id: String,
    val sender: String, // "user" | "agent"
    val content: String,
    val time: String,
    val toolCalls: List<ToolCall>? = null
)

data class UserSession(
    val email: String,
    val userId: String,
    val accessToken: String? = null,
    val refreshToken: String? = null,
    val isDemo: Boolean = false
)

data class AuthTokenResponse(
    @SerializedName("access_token") val accessToken: String,
    @SerializedName("token_type") val tokenType: String? = null,
    @SerializedName("expires_in") val expiresIn: Long? = null,
    @SerializedName("refresh_token") val refreshToken: String? = null,
    @SerializedName("user") val user: AuthUser
)

data class AuthUser(
    @SerializedName("id") val id: String,
    @SerializedName("email") val email: String?,
    @SerializedName("role") val role: String? = null
)

data class AuthErrorResponse(
    @SerializedName("code") val code: Int? = null,
    @SerializedName("error") val error: String? = null,
    @SerializedName("error_description") val errorDescription: String? = null,
    @SerializedName("msg") val msg: String? = null,
    @SerializedName("message") val message: String? = null
)

// ==========================================
// FACE AI ENGINE & UNIFORM TELEMETRY
// ==========================================

data class FaceCameraTelemetry(
    @SerializedName("is_running") val isRunning: Boolean = false,
    @SerializedName("faces_detected") val facesDetected: Int = 0,
    @SerializedName("faces") val faces: List<DetectedFace> = emptyList(),
    @SerializedName("uniform") val uniform: UniformTelemetryResult? = null,
    @SerializedName("capture_fps") val captureFps: Double = 0.0,
    @SerializedName("ai_fps") val aiFps: Double = 0.0,
    @SerializedName("process_time_ms") val processTimeMs: Double = 0.0,
    @SerializedName("source") val source: Any? = null,
    @SerializedName("error") val error: String? = null
)

data class DetectedFace(
    @SerializedName("student_id") val studentId: String? = null,
    @SerializedName("staff_id") val staffId: String? = null,
    @SerializedName("name") val name: String = "Người lạ",
    @SerializedName("confidence") val confidence: Double = 0.0,
    @SerializedName("status") val status: String = "stranger",
    @SerializedName("liveness") val liveness: FaceLiveness? = null
) {
    val effectiveId: String?
        get() = (studentId ?: staffId)?.takeIf { it.isNotBlank() && it != "UNKNOWN" }
    val isReal: Boolean
        get() = liveness?.isReal ?: true
}

data class FaceLiveness(
    @SerializedName("is_real") val isReal: Boolean = true,
    @SerializedName("status") val status: String = "REAL",
    @SerializedName("confidence") val confidence: Double = 1.0,
    @SerializedName("message") val message: String? = null
)

data class UniformTelemetryResult(
    @SerializedName("person_detected") val personDetected: Boolean = false,
    @SerializedName("is_correct") val isCorrect: Boolean = false,
    @SerializedName("status") val status: String = "UNCLEAR",
    @SerializedName("rule") val rule: String? = null,
    @SerializedName("message") val message: String? = null,
    @SerializedName("shirt_color") val shirtColor: String? = null,
    @SerializedName("pants_color") val pantsColor: String? = null,
    @SerializedName("mask") val mask: MaskTelemetry? = null
)

data class MaskTelemetry(
    @SerializedName("has_mask") val hasMask: Boolean = false,
    @SerializedName("mask_color") val maskColor: String = "none",
    @SerializedName("confidence") val confidence: Double = 0.0
)
