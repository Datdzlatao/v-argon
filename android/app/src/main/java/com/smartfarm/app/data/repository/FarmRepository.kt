package com.smartfarm.app.data.repository

import android.util.Log
import com.google.gson.Gson
import com.google.gson.JsonObject
import com.google.gson.reflect.TypeToken
import com.smartfarm.app.data.models.*
import com.smartfarm.app.data.remote.*
import kotlinx.coroutines.flow.Flow
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.UUID
import java.util.concurrent.TimeUnit

class FarmRepository(
    private val supabase: SupabaseRestClient = SupabaseRestClient(),
    val webSocketManager: FarmWebSocketManager = FarmWebSocketManager(),
    val authClient: SupabaseAuthClient = SupabaseAuthClient()
) {
    private val gson = Gson()
    private val api: FarmApiService
    private val faceApi: FaceApiService
    private val actionApi: ActionApiService

    fun setAuthToken(token: String?) {
        supabase.authToken = token
    }

    suspend fun signIn(email: String, password: String): Result<UserSession> {
        val result = authClient.signInWithPassword(email, password)
        if (result.isSuccess) {
            setAuthToken(result.getOrNull()?.accessToken)
        }
        return result
    }

    suspend fun signUp(email: String, password: String): Result<String> {
        return authClient.signUp(email, password)
    }

    suspend fun signOut(accessToken: String?) {
        authClient.signOut(accessToken)
        setAuthToken(null)
    }

    init {
        val logging = HttpLoggingInterceptor().apply {
            level = HttpLoggingInterceptor.Level.BODY
        }
        val okHttpClient = OkHttpClient.Builder()
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(60, TimeUnit.SECONDS)
            .writeTimeout(30, TimeUnit.SECONDS)
            .addInterceptor(logging)
            .build()

        val backendRetrofit = Retrofit.Builder()
            .baseUrl(ApiConfig.backendUrl)
            .client(okHttpClient)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
        api = backendRetrofit.create(FarmApiService::class.java)

        val faceRetrofit = Retrofit.Builder()
            .baseUrl(ApiConfig.faceApiUrl)
            .client(okHttpClient)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
        faceApi = faceRetrofit.create(FaceApiService::class.java)

        val actionRetrofit = Retrofit.Builder()
            .baseUrl(ApiConfig.actionApiUrl)
            .client(okHttpClient)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
        actionApi = actionRetrofit.create(ActionApiService::class.java)
    }

    val liveEvents: Flow<WebSocketPacket> = webSocketManager.events
    val wsConnected: Flow<Boolean> = webSocketManager.connectionStatus

    // ==========================================
    // 1. PENS & AREAS
    // ==========================================
    suspend fun getPens(mode: String, userId: String?): List<Pen> {
        val typeToken = object : TypeToken<List<Pen>>() {}
        // Lấy toàn bộ danh sách phân khu để không bị sót
        val remotePens = supabase.queryList("pens", emptyMap(), typeToken)
        if (remotePens.isNotEmpty()) {
            return if (mode == "cultivation") {
                val cult = remotePens.filter { it.type == "cultivation" || it.type == "crops" }
                if (cult.isNotEmpty()) cult else remotePens
            } else {
                val live = remotePens.filter { it.type == "livestock" || it.type.isBlank() }
                if (live.isNotEmpty()) live else remotePens
            }
        }

        // Fallback Pens nếu hoàn toàn không kết nối được
        return if (mode == "livestock") {
            listOf(
                Pen("PEN-A02", "Chuồng Nuôi Heo Thịt Khu A2", "livestock"),
                Pen("123", "Chuồng Nuôi Heo Thịt Khu A1", "livestock"),
                Pen("PEN-ISO-01", "Khu Cách Ly Y Tế / Heo Bệnh", "livestock")
            )
        } else {
            listOf(
                Pen("PEN-B01", "Khu Nhà Màng Dưa Lưới B1", "crops"),
                Pen("Vườn01", "Vườn cà chua Thủy Canh", "cultivation")
            )
        }
    }

    suspend fun createPen(pen: Pen): Boolean {
        val trimmedId = pen.id.trim()
        val isUuid = pen.userId?.matches(Regex("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$")) == true
        val payload = mutableMapOf<String, Any>(
            "id" to trimmedId,
            "name" to pen.name.trim(),
            "type" to pen.type
        )
        if (isUuid) {
            payload["user_id"] = pen.userId!!
        }
        if (!pen.cameraUrl.isNullOrBlank()) {
            payload["camera_url"] = pen.cameraUrl.trim()
        }
        if (!pen.webcamUrl.isNullOrBlank()) {
            payload["webcam_url"] = pen.webcamUrl.trim()
        }
        return supabase.upsert("pens", "id", payload)
    }

    suspend fun deletePen(penId: String): Boolean {
        val trimmedId = penId.trim()
        try {
            supabase.update("animals", "pen_id", trimmedId, mapOf("pen_id" to null))
        } catch (_: Exception) {}
        try {
            supabase.update("crops", "pen_id", trimmedId, mapOf("pen_id" to null))
        } catch (_: Exception) {}
        try {
            supabase.delete("devices", "pen_id", trimmedId)
        } catch (_: Exception) {}
        return supabase.delete("pens", "id", trimmedId)
    }

    suspend fun updatePenCameras(penId: String, cameraUrl: String, webcamUrl: String = "0"): Boolean {
        val trimmedPenId = penId.trim()
        val trimmedUrl = cameraUrl.trim()
        val trimmedWebcam = webcamUrl.trim()
        val payload = mutableMapOf<String, String>()
        payload["camera_url"] = trimmedUrl
        payload["webcam_url"] = trimmedWebcam

        try {
            api.updatePenMetadata(trimmedPenId, payload)
        } catch (_: Exception) {}
        return try {
            supabase.update("pens", "id", trimmedPenId, payload)
            true
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
    }

    suspend fun updatePenCamera(penId: String, cameraUrl: String): Boolean {
        return updatePenCameras(penId, cameraUrl, "0")
    }

    // ==========================================
    // 2. IOT DEVICES
    // ==========================================
    suspend fun getDevices(penId: String): List<Device> {
        val params = if (penId.isNotBlank() && penId != "all") mapOf("pen_id" to "eq.$penId") else emptyMap()
        val typeToken = object : TypeToken<List<Device>>() {}
        return supabase.queryList("devices", params, typeToken)
    }

    suspend fun toggleDevice(penId: String, device: Device): Boolean {
        val nextState = !device.isActive
        val action = if (nextState) "turn_on" else "turn_off"
        try {
            api.controlDevice(mapOf(
                "pen_id" to penId,
                "device_name" to device.name,
                "action" to action
            ))
        } catch (e: Exception) {
            e.printStackTrace()
        }
        return supabase.update("devices", "id", device.id.trim(), mapOf("is_active" to nextState))
    }

    suspend fun addDevice(name: String, pin: Int, penId: String): Boolean {
        val devId = "DEV_${UUID.randomUUID().toString().take(8).uppercase()}"
        val payload = mutableMapOf<String, Any>(
            "id" to devId,
            "name" to name.trim(),
            "is_active" to false,
            "pin_number" to pin
        )
        if (penId.isNotBlank() && penId != "all") {
            payload["pen_id"] = penId.trim()
        }
        return supabase.insert("devices", payload)
    }

    suspend fun deleteDevice(deviceId: String): Boolean {
        return supabase.delete("devices", "id", deviceId.trim())
    }

    // ==========================================
    // 3. ANIMALS (LIVESTOCK)
    // ==========================================
    suspend fun getAnimals(penId: String): List<Animal> {
        val params = if (penId.isNotBlank() && penId != "all") mapOf("pen_id" to "eq.$penId") else emptyMap()
        val typeToken = object : TypeToken<List<Animal>>() {}
        return supabase.queryList("animals", params, typeToken)
    }

    suspend fun addAnimal(animal: Animal): Boolean {
        val animalId = if (animal.id.isNotBlank()) animal.id.trim() else "HEO-${System.currentTimeMillis() % 10000}"
        val payload = mutableMapOf<String, Any>(
            "id" to animalId,
            "species" to animal.species.trim(),
            "weight" to animal.weight,
            "target_weight" to animal.targetWeight,
            "feeding_status" to (animal.feedingStatus ?: "Normal"),
            "status" to (animal.status ?: "healthy")
        )
        if (!animal.penId.isNullOrBlank() && animal.penId != "all") {
            payload["pen_id"] = animal.penId.trim()
        }
        return supabase.upsert("animals", "id", payload)
    }

    suspend fun deleteAnimal(animalId: String): Boolean {
        return supabase.delete("animals", "id", animalId.trim())
    }

    suspend fun transferAnimal(animalId: String, targetPenId: String, reason: String): Boolean {
        try {
            api.transferAnimal(mapOf(
                "animal_id" to animalId.trim(),
                "target_pen_id" to targetPenId.trim(),
                "reason" to reason
            ))
        } catch (e: Exception) {
            e.printStackTrace()
        }
        return supabase.update("animals", "id", animalId.trim(), mapOf("pen_id" to targetPenId.trim()))
    }

    // ==========================================
    // 4. CROPS (CULTIVATION)
    // ==========================================
    suspend fun getCrops(penId: String): List<Crop> {
        val params = if (penId.isNotBlank() && penId != "all") mapOf("pen_id" to "eq.$penId") else emptyMap()
        val typeToken = object : TypeToken<List<Crop>>() {}
        return supabase.queryList("crops", params, typeToken)
    }

    suspend fun addCrop(name: String, quantity: Int, plantDate: String, harvestDate: String?, status: String, penId: String?): Boolean {
        val todayStr = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())
        val validPlantDate = if (plantDate.matches(Regex("^\\d{4}-\\d{2}-\\d{2}$"))) plantDate else todayStr
        val validHarvestDate = if (!harvestDate.isNullOrBlank() && harvestDate.matches(Regex("^\\d{4}-\\d{2}-\\d{2}$"))) harvestDate else null

        val payload = mutableMapOf<String, Any>(
            "name" to name.trim(),
            "quantity" to quantity,
            "plant_date" to validPlantDate,
            "status" to status
        )
        if (!penId.isNullOrBlank() && penId != "all") {
            payload["pen_id"] = penId.trim()
        }
        if (validHarvestDate != null) {
            payload["harvest_date"] = validHarvestDate
        }
        return supabase.insert("crops", payload)
    }

    suspend fun deleteCrop(cropId: String): Boolean {
        return supabase.delete("crops", "id", cropId.trim())
    }

    // ==========================================
    // 5. INVENTORY
    // ==========================================
    suspend fun getInventory(): List<InventoryItem> {
        val typeToken = object : TypeToken<List<InventoryItem>>() {}
        return supabase.queryList("inventory", emptyMap(), typeToken)
    }

    suspend fun importInventory(name: String, category: String, qty: Double, unit: String, price: Double): Boolean {
        val trimmedName = name.trim()
        val typeToken = object : TypeToken<List<InventoryItem>>() {}
        val existingList = supabase.queryList("inventory", mapOf("name" to "eq.$trimmedName"), typeToken)
        val existingItem = existingList.firstOrNull()

        return if (existingItem != null && existingItem.id != null) {
            val newQty = existingItem.quantity + qty
            val updatePayload = mutableMapOf<String, Any>(
                "quantity" to newQty
            )
            if (price > 0) updatePayload["unit_price"] = price
            supabase.update("inventory", "id", existingItem.displayId, updatePayload)
        } else {
            val payload = mapOf(
                "name" to trimmedName,
                "category" to category.trim(),
                "quantity" to qty,
                "unit" to unit.trim(),
                "unit_price" to price,
                "min_threshold" to 10.0,
                "location" to "Kho Chính"
            )
            val ok = supabase.insert("inventory", payload)
            if (!ok) {
                supabase.upsert("inventory", "name", payload)
            } else {
                true
            }
        }
    }

    suspend fun exportInventory(itemId: String, currentQty: Double, exportQty: Double): Boolean {
        val remain = (currentQty - exportQty).coerceAtLeast(0.0)
        return supabase.update("inventory", "id", itemId.trim(), mapOf("quantity" to remain))
    }

    suspend fun deleteInventory(itemId: String): Boolean {
        return supabase.delete("inventory", "id", itemId.trim())
    }

    // ==========================================
    // 6. ENVIRONMENT SENSORS & ALERTS
    // ==========================================
    suspend fun getLatestEnvData(penId: String): Pair<EnvData, List<EnvHistoryPoint>> {
        if (penId.isEmpty()) return Pair(EnvData(), emptyList())
        val params = mapOf(
            "pen_id" to "eq.$penId",
            "order" to "created_at.desc",
            "limit" to "6"
        )
        val typeToken = object : TypeToken<List<Map<String, Any>>>() {}
        val raw = supabase.queryList("env_logs", params, typeToken)

        if (raw.isNotEmpty()) {
            val first = raw[0]
            val temp = (first["temperature"] as? Number)?.toDouble() ?: 28.5
            val hum = (first["humidity"] as? Number)?.toDouble() ?: 70.0
            val smell = (first["smell_level"] as? Number)?.toDouble() ?: 150.0

            val history = raw.reversed().map {
                val t = (it["temperature"] as? Number)?.toDouble() ?: 28.0
                val h = (it["humidity"] as? Number)?.toDouble() ?: 70.0
                val s = (it["smell_level"] as? Number)?.toDouble() ?: 150.0
                val created = it["created_at"]?.toString() ?: ""
                val timeStr = if (created.length >= 16) created.substring(11, 16) else "12:00"
                EnvHistoryPoint(timeStr, t, h, s)
            }
            return Pair(EnvData(temp, hum, smell), history)
        }

        // Fallback default
        return Pair(EnvData(temp = 28.5, hum = 70.0, smell = 150.0), emptyList())
    }

    // ==========================================
    // 7. AI AGENT CHAT & BRIEFING
    // ==========================================
    suspend fun sendChat(message: String, penId: String, userId: String): ChatMessage {
        try {
            val res = api.sendChat(mapOf(
                "message" to message,
                "pen_id" to penId,
                "user_id" to userId
            ))
            if (res.isSuccessful && res.body() != null) {
                val body = res.body()!!
                val replyEl = body.get("reply")
                val reply = if (replyEl != null && !replyEl.isJsonNull) replyEl.asString else "Đã xử lý chỉ dẫn."
                val tools = mutableListOf<ToolCall>()
                val toolArr = body.get("tool_calls")
                if (toolArr != null && toolArr.isJsonArray) {
                    toolArr.asJsonArray.forEach { el ->
                        if (el.isJsonObject) {
                            val tObj = el.asJsonObject
                            val toolNameEl = tObj.get("tool")
                            val toolName = if (toolNameEl != null && !toolNameEl.isJsonNull) toolNameEl.asString else ""
                            val resEl = tObj.get("result")
                            val result = when {
                                resEl == null || resEl.isJsonNull -> null
                                resEl.isJsonPrimitive -> resEl.asString
                                else -> resEl.toString()
                            }
                            tools.add(ToolCall(toolName, emptyMap(), result))
                        }
                    }
                }
                return ChatMessage(
                    id = UUID.randomUUID().toString(),
                    sender = "agent",
                    content = reply,
                    time = "Vừa xong",
                    toolCalls = tools
                )
            } else {
                val errBody = res.errorBody()?.string()?.take(200) ?: res.message()
                return ChatMessage(
                    id = UUID.randomUUID().toString(),
                    sender = "agent",
                    content = "⚠️ Lỗi máy chủ AI (${res.code()}): $errBody",
                    time = "Vừa xong"
                )
            }
        } catch (e: Exception) {
            e.printStackTrace()
            return ChatMessage(
                id = UUID.randomUUID().toString(),
                sender = "agent",
                content = "⚠️ Không kết nối được tới AI Agent: ${e.localizedMessage ?: e.javaClass.simpleName}",
                time = "Vừa xong"
            )
        }
    }

    suspend fun triggerDailyBriefing(): DailyBriefing {
        try {
            val res = api.triggerBriefing()
            if (res.isSuccessful && res.body() != null) {
                val content = res.body()?.getAsJsonObject("briefing")?.get("content")?.asString
                if (!content.isNullOrEmpty()) {
                    return DailyBriefing(content = content)
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }

        return DailyBriefing(
            content = "Chào buổi sáng bà con! Hệ thống AI ghi nhận toàn bộ chuồng nuôi ổn định. Nhiệt độ bình quân 28.5°C, độ ẩm 70%. Kho còn cám De Heus. Chúc bà con một ngày làm việc hiệu quả!",
            pendingTasksCount = 2,
            lowStockCount = 1,
            sickAnimalsCount = 1
        )
    }

    // ==========================================
    // 8. STAFF & FACE ATTENDANCE
    // ==========================================
    suspend fun getStaffList(): List<Staff> {
        val typeToken = object : TypeToken<List<Staff>>() {}
        return supabase.queryList("staff", emptyMap(), typeToken)
    }

    suspend fun getAttendanceHistory(): List<AttendanceRecord> {
        val params = mapOf("order" to "created_at.desc", "limit" to "30")
        val typeToken = object : TypeToken<List<AttendanceRecord>>() {}
        return supabase.queryList("staff_attendance", params, typeToken)
    }

    suspend fun checkInStaff(staffId: String, staffName: String, penId: String, checkType: String, note: String?): Boolean {
        val record = AttendanceRecord(
            staffId = staffId.trim(),
            staffName = staffName.trim(),
            penId = penId.trim().ifBlank { null },
            checkType = checkType,
            status = if (checkType == "check_out") "completed" else "present",
            confidence = 0.98,
            isReal = true,
            note = note ?: "Điểm danh FaceID trên app Android"
        )
        return supabase.insert("staff_attendance", record)
    }

    // ==========================================
    // 8.1 FACE AI ENGINE CONTROLS (PORT 8001 / 10000)
    // ==========================================
    suspend fun startFaceCamera(source: String = "0", weekday: Int? = null): Boolean {
        return try {
            val body = mutableMapOf<String, Any>("source" to source)
            weekday?.let { body["weekday_override"] = it }
            val res = faceApi.startCamera(body)
            res.isSuccessful
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
    }

    suspend fun stopFaceCamera(): Boolean {
        return try {
            val res = faceApi.stopCamera()
            res.isSuccessful
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
    }

    suspend fun getFaceCameraLatest(): FaceCameraTelemetry? {
        return try {
            val res = faceApi.getLatestTelemetry()
            if (res.isSuccessful && res.body() != null) {
                gson.fromJson(res.body(), FaceCameraTelemetry::class.java)
            } else {
                null
            }
        } catch (e: Exception) {
            null
        }
    }

    // ==========================================
    // 9. IP CAMERA ACTION TRACKER (PORT 8002 / 443)
    // ==========================================
    suspend fun getActionTrackerStatus(penId: String): ActionTelemetry {
        try {
            val res = actionApi.getTrackerStatus(penId)
            if (res.isSuccessful && res.body() != null) {
                val b = res.body()!!
                val isRunning = b.get("is_running")?.asBoolean ?: false
                val metricsObj = if (b.has("metrics") && b.get("metrics").isJsonObject) b.getAsJsonObject("metrics") else null
                val hipVis = metricsObj?.get("hip_vis")?.asDouble ?: 0.0
                val wristVis = metricsObj?.get("wrist_vis")?.asDouble ?: 0.0
                val torsoAngle = metricsObj?.get("torso_angle")?.asDouble ?: 180.0
                val isBending = metricsObj?.get("is_bending")?.asBoolean ?: false
                val cooldownRemaining = b.get("cooldown_remaining")?.asDouble ?: 0.0

                return ActionTelemetry(
                    targetId = penId,
                    lastAction = b.get("last_action")?.asString ?: "Hoạt động bình thường",
                    confidence = b.get("confidence")?.asDouble ?: 0.95,
                    fps = b.get("fps")?.asDouble ?: 15.0,
                    status = if (isRunning) "running" else "idle",
                    isRunning = isRunning,
                    cameraSource = b.get("camera_source")?.asString,
                    fsmState = b.get("fsm_state")?.asString,
                    lastActionReason = b.get("last_action_reason")?.asString,
                    hipVis = hipVis,
                    wristVis = wristVis,
                    torsoAngle = torsoAngle,
                    isBending = isBending,
                    cooldownRemaining = cooldownRemaining
                )
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }

        return ActionTelemetry(
            targetId = penId,
            lastAction = "Đang quan sát chuồng nuôi",
            confidence = 0.95,
            fps = 15.0,
            status = "idle",
            isRunning = false
        )
    }

    suspend fun getActionLogs(penId: String, limit: Int = 20): List<ActionLog> {
        try {
            val res = actionApi.getActionLogs(penId, limit)
            if (res.isSuccessful && res.body() != null) {
                val dataArr = res.body()?.getAsJsonArray("data")
                if (dataArr != null && dataArr.size() > 0) {
                    val logs = mutableListOf<ActionLog>()
                    dataArr.forEach { el ->
                        try {
                            val item = gson.fromJson(el, ActionLog::class.java)
                            logs.add(item)
                        } catch (_: Exception) {}
                    }
                    if (logs.isNotEmpty()) return logs
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }

        return emptyList()
    }

    suspend fun configurePenCamera(penId: String, sourceUrl: String): Boolean {
        val cleanPenId = penId.trim()
        val cleanSource = sourceUrl.trim()
        val dbOk = updatePenCamera(cleanPenId, cleanSource)
        return try {
            val res = actionApi.configureCamera(mapOf("target_id" to cleanPenId, "source" to cleanSource))
            res.isSuccessful || dbOk
        } catch (e: Exception) {
            dbOk
        }
    }

    suspend fun stopPenCamera(penId: String): Boolean {
        return try {
            val res = actionApi.stopCamera(mapOf("target_id" to penId.trim()))
            res.isSuccessful
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
    }
}
