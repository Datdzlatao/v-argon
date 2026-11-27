package com.smartfarm.app.ui.viewmodel

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.smartfarm.app.SmartFarmApplication
import com.smartfarm.app.data.models.*
import com.smartfarm.app.data.repository.FarmRepository
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import java.util.UUID

class FarmViewModel(
    private val repository: FarmRepository = FarmRepository()
) : ViewModel() {

    // Auth State
    private val _userSession = MutableStateFlow<UserSession?>(null)
    val userSession: StateFlow<UserSession?> = _userSession.asStateFlow()

    private val sessionManager by lazy {
        SmartFarmApplication.instance.sessionManager
    }

    val authLoading = MutableStateFlow(false)
    val authError = MutableStateFlow<String?>(null)
    val authSuccess = MutableStateFlow<String?>(null)

    // Mode: "livestock" (Chăn Nuôi) vs "cultivation" (Trồng Trọt)
    private val _currentMode = MutableStateFlow("livestock")
    val currentMode: StateFlow<String> = _currentMode.asStateFlow()

    // Pens & Areas
    private val _pens = MutableStateFlow<List<Pen>>(emptyList())
    val pens: StateFlow<List<Pen>> = _pens.asStateFlow()

    private val _currentPenId = MutableStateFlow("")
    val currentPenId: StateFlow<String> = _currentPenId.asStateFlow()

    // Devices
    private val _devices = MutableStateFlow<List<Device>>(emptyList())
    val devices: StateFlow<List<Device>> = _devices.asStateFlow()

    // Animals & Crops
    private val _animals = MutableStateFlow<List<Animal>>(emptyList())
    val animals: StateFlow<List<Animal>> = _animals.asStateFlow()

    private val _crops = MutableStateFlow<List<Crop>>(emptyList())
    val crops: StateFlow<List<Crop>> = _crops.asStateFlow()

    // Inventory
    private val _inventory = MutableStateFlow<List<InventoryItem>>(emptyList())
    val inventory: StateFlow<List<InventoryItem>> = _inventory.asStateFlow()

    // Realtime Environment & History
    private val _envData = MutableStateFlow(EnvData())
    val envData: StateFlow<EnvData> = _envData.asStateFlow()

    private val _historyLogs = MutableStateFlow<List<EnvHistoryPoint>>(emptyList())
    val historyLogs: StateFlow<List<EnvHistoryPoint>> = _historyLogs.asStateFlow()

    // Alerts
    private val _activeAlerts = MutableStateFlow<List<String>>(emptyList())
    val activeAlerts: StateFlow<List<String>> = _activeAlerts.asStateFlow()

    private val _isMuted = MutableStateFlow(false)
    val isMuted: StateFlow<Boolean> = _isMuted.asStateFlow()

    // Daily Briefing
    private val _dailyBriefing = MutableStateFlow<DailyBriefing?>(null)
    val dailyBriefing: StateFlow<DailyBriefing?> = _dailyBriefing.asStateFlow()
    val isBriefingLoading = MutableStateFlow(false)

    // Live Observer Newsfeed
    private val _newsfeedItems = MutableStateFlow<List<NewsfeedItem>>(emptyList())
    val newsfeedItems: StateFlow<List<NewsfeedItem>> = _newsfeedItems.asStateFlow()
    val isNewsfeedLoading = MutableStateFlow(false)

    // Chat Assistant
    private val _chatMessages = MutableStateFlow<List<ChatMessage>>(
        listOf(
            ChatMessage(
                id = "init",
                sender = "agent",
                content = "Kính chào bà con! Tôi là Trợ Lý Nông Trại Thông Minh 24/7. Tôi có thể hỗ trợ bà con theo dõi nhiệt độ vi khí hậu, điều khiển quạt thông gió, kiểm tra sức khỏe đàn vật nuôi và tra cứu phác đồ bệnh. Bà con cần hỗ trợ gì hôm nay?",
                time = "Vừa xong"
            )
        )
    )
    val chatMessages: StateFlow<List<ChatMessage>> = _chatMessages.asStateFlow()
    val isChatLoading = MutableStateFlow(false)

    // Staff Attendance
    private val _staffList = MutableStateFlow<List<Staff>>(emptyList())
    val staffList: StateFlow<List<Staff>> = _staffList.asStateFlow()

    private val _attendanceHistory = MutableStateFlow<List<AttendanceRecord>>(emptyList())
    val attendanceHistory: StateFlow<List<AttendanceRecord>> = _attendanceHistory.asStateFlow()

    // Face Recognition & Uniform AI Telemetry (Port 8001 / 10000)
    private val _faceCameraTelemetry = MutableStateFlow<FaceCameraTelemetry?>(null)
    val faceCameraTelemetry: StateFlow<FaceCameraTelemetry?> = _faceCameraTelemetry.asStateFlow()

    private val _isFaceCameraActive = MutableStateFlow(false)
    val isFaceCameraActive: StateFlow<Boolean> = _isFaceCameraActive.asStateFlow()

    private val _isFaceCameraLoading = MutableStateFlow(false)
    val isFaceCameraLoading: StateFlow<Boolean> = _isFaceCameraLoading.asStateFlow()

    private val _faceCameraError = MutableStateFlow<String?>(null)
    val faceCameraError: StateFlow<String?> = _faceCameraError.asStateFlow()

    private var facePollJob: Job? = null

    // Camera Action Tracker Telemetry
    private val _actionTelemetry = MutableStateFlow<ActionTelemetry?>(null)
    val actionTelemetry: StateFlow<ActionTelemetry?> = _actionTelemetry.asStateFlow()

    private val _actionLogs = MutableStateFlow<List<ActionLog>>(emptyList())
    val actionLogs: StateFlow<List<ActionLog>> = _actionLogs.asStateFlow()

    // In-app Realtime Notification Toast
    private val _realtimeToast = MutableStateFlow<String?>(null)
    val realtimeToast: StateFlow<String?> = _realtimeToast.asStateFlow()

    // WebSocket status
    val wsConnected: StateFlow<Boolean> = repository.wsConnected.stateIn(
        viewModelScope,
        SharingStarted.WhileSubscribed(5000),
        false
    )

    // Polling Jobs
    private var telemetryPollJob: Job? = null
    private var continuousDataPollJob: Job? = null

    init {
        val savedSession = try {
            sessionManager.getSession()
        } catch (_: Exception) {
            null
        }

        if (savedSession != null) {
            _userSession.value = savedSession
            repository.setAuthToken(savedSession.accessToken)
        }

        loadInitialData()
        startContinuousDataPolling()

        repository.webSocketManager.connect()
        observeWebSocketEvents()
    }

    private fun observeWebSocketEvents() {
        viewModelScope.launch {
            repository.liveEvents.collect { packet ->
                when (packet.event) {
                    "device_update" -> {
                        loadPenDetails(_currentPenId.value)
                        loadNewsfeed(null)
                        showToast("Thiết bị vừa được cập nhật từ hệ thống")
                    }
                    "alert" -> {
                        val msg = packet.data?.get("message")?.asString ?: "Cảnh báo môi trường mới!"
                        _activeAlerts.value = listOf(msg)
                        showToast("⚠️ $msg")
                        loadNewsfeed(null)
                    }
                    "newsfeed_update" -> {
                        val arr = packet.data?.getAsJsonArray("items")
                        if (arr != null) {
                            _newsfeedItems.value = repository.parseNewsfeedArray(arr)
                        } else {
                            loadNewsfeed(null)
                        }
                    }
                    "briefing" -> {
                        val content = packet.data?.get("content")?.asString
                        if (!content.isNullOrEmpty()) {
                            _dailyBriefing.value = DailyBriefing(content = content)
                            showToast("Đã có bản tin nông trại buổi sáng")
                        }
                    }
                    "staff_checkin" -> {
                        val name = packet.data?.get("staff_name")?.asString ?: "Nhân sự"
                        val type = packet.data?.get("check_type")?.asString ?: "vào ca"
                        showToast("👤 $name đã điểm danh ($type)")
                        loadAttendance()
                    }
                    "animal_transfer" -> {
                        loadPenDetails(_currentPenId.value)
                        showToast("Vật nuôi đã được chuyển chuồng thành công")
                    }
                    "chat_message" -> {
                        val d = packet.data ?: return@collect
                        val msgUserId = d.get("user_id")?.takeIf { !it.isJsonNull }?.asString ?: "guest"
                        val currentUid = _userSession.value?.userId ?: "guest"
                        val msgPenId = d.get("pen_id")?.takeIf { !it.isJsonNull }?.asString
                        val curPen = _currentPenId.value
                        if (msgUserId == currentUid && (msgPenId == null || curPen.isBlank() || msgPenId == curPen)) {
                            val msgId = d.get("id")?.takeIf { !it.isJsonNull }?.asString ?: UUID.randomUUID().toString()
                            val sender = d.get("sender")?.takeIf { !it.isJsonNull }?.asString ?: "agent"
                            val content = d.get("content")?.takeIf { !it.isJsonNull }?.asString ?: ""
                            val alreadyExists = _chatMessages.value.any {
                                it.id == msgId || (it.sender == sender && it.content == content)
                            }
                            if (!alreadyExists && content.isNotBlank()) {
                                _chatMessages.value = _chatMessages.value + ChatMessage(
                                    id = msgId,
                                    sender = sender,
                                    content = content,
                                    time = "Vừa xong"
                                )
                            }
                        }
                    }
                }
            }
        }
    }

    fun showToast(message: String) {
        _realtimeToast.value = message
        viewModelScope.launch {
            delay(4000)
            if (_realtimeToast.value == message) {
                _realtimeToast.value = null
            }
        }
    }

    fun loadInitialData() {
        viewModelScope.launch {
            loadPens()
            loadInventory()
            loadStaff()
            loadAttendance()
            refreshBriefing()
        }
    }

    // ==========================================
    // CHỦ ĐỘNG LIÊN TỤC POLLING LẤY DỮ LIỆU CẬP NHẬT
    // ==========================================
    private fun startContinuousDataPolling() {
        continuousDataPollJob?.cancel()
        continuousDataPollJob = viewModelScope.launch {
            var counter = 0
            while (true) {
                try {
                    val penId = _currentPenId.value
                    if (penId.isNotEmpty()) {
                        // 1. Cập nhật Môi trường & Thiết bị mỗi 3 giây
                        val (env, history) = repository.getLatestEnvData(penId)
                        _envData.value = env
                        if (history.isNotEmpty()) {
                            _historyLogs.value = history
                        }
                        checkEnvAlerts(env)

                        val updatedDevices = repository.getDevices(penId)
                        if (updatedDevices.isNotEmpty() || _devices.value.isEmpty()) {
                            _devices.value = updatedDevices
                        }
                    }

                    // 2. Cứ mỗi 6 giây (counter % 2 == 0), cập nhật Vật nuôi/Cây trồng, Kho & Phân khu + Polling Newsfeed
                    if (counter % 2 == 0) {
                        val activeUid = _userSession.value?.userId
                        repository.getNewsfeedState(null, 12, activeUid)?.let { state ->
                            _newsfeedItems.value = state.items
                            if (state.summaryText.isNotBlank()) {
                                _dailyBriefing.value = DailyBriefing(
                                    content = state.summaryText,
                                    pendingTasksCount = state.pendingTasksCount,
                                    lowStockCount = state.lowStockCount,
                                    sickAnimalsCount = state.sickAnimalsCount
                                )
                            }
                        }
                        if (penId.isNotEmpty()) {
                            if (_currentMode.value == "livestock") {
                                val updatedAnimals = repository.getAnimals(penId)
                                if (updatedAnimals.isNotEmpty() || _animals.value.isEmpty()) {
                                    _animals.value = updatedAnimals
                                }
                            } else {
                                val updatedCrops = repository.getCrops(penId)
                                if (updatedCrops.isNotEmpty() || _crops.value.isEmpty()) {
                                    _crops.value = updatedCrops
                                }
                            }
                        }

                        // Polling kho vật tư
                        val updatedInventory = repository.getInventory(_userSession.value?.userId)
                        if (updatedInventory.isNotEmpty() || _inventory.value.isNotEmpty()) {
                            _inventory.value = updatedInventory
                        }

                        // Polling danh sách nhân sự điểm danh
                        val updatedAttendance = repository.getAttendanceHistory()
                        if (updatedAttendance.isNotEmpty() || _attendanceHistory.value.isNotEmpty()) {
                            _attendanceHistory.value = updatedAttendance
                        }
                    }

                    // 3. Cứ mỗi 15 giây (counter % 5 == 0), cập nhật danh sách Phân khu (Pens)
                    if (counter % 5 == 0) {
                        val updatedPens = repository.getPens(_currentMode.value, _userSession.value?.userId)
                        if (updatedPens.isNotEmpty()) {
                            _pens.value = updatedPens
                        }
                    }

                    counter++
                } catch (e: Exception) {
                    Log.e("FarmViewModel", "continuousDataPolling error", e)
                }

                delay(3000) // Chu kỳ polling liên tục 3 giây
            }
        }
    }

    fun setMode(mode: String) {
        if (_currentMode.value != mode) {
            _currentMode.value = mode
            loadPens()
        }
    }

    fun loadPens() {
        viewModelScope.launch {
            val list = repository.getPens(_currentMode.value, _userSession.value?.userId)
            _pens.value = list
            if (list.isNotEmpty()) {
                val current = _currentPenId.value
                val stillExists = list.any { it.id == current }
                val targetId = if (stillExists && current.isNotBlank()) current else {
                    // Ưu tiên chọn chuồng có dữ liệu mẫu thực tế
                    if (_currentMode.value == "livestock") {
                        list.firstOrNull { it.id == "PEN-A02" || it.id == "123" }?.id ?: list[0].id
                    } else {
                        list.firstOrNull { it.id == "PEN-B01" || it.id == "Vườn01" }?.id ?: list[0].id
                    }
                }
                selectPen(targetId)
            } else {
                _currentPenId.value = ""
                _devices.value = emptyList()
                _animals.value = emptyList()
                _crops.value = emptyList()
            }
        }
    }

    fun selectPen(penId: String) {
        _currentPenId.value = penId
        loadPenDetails(penId)
        loadChatHistory(penId)
        loadNewsfeed(null)
        if (penId.isNotBlank() && penId != "all") {
            startTelemetryPolling(penId)
        }
    }

    fun loadNewsfeed(penId: String? = _currentPenId.value) {
        viewModelScope.launch {
            isNewsfeedLoading.value = true
            val state = repository.getNewsfeedState(penId = penId, limit = 12, userId = _userSession.value?.userId)
            if (state != null) {
                _newsfeedItems.value = state.items
                if (state.summaryText.isNotBlank()) {
                    _dailyBriefing.value = DailyBriefing(
                        content = state.summaryText,
                        pendingTasksCount = state.pendingTasksCount,
                        lowStockCount = state.lowStockCount,
                        sickAnimalsCount = state.sickAnimalsCount
                    )
                }
            }
            isNewsfeedLoading.value = false
        }
    }

    fun executeNewsfeedQuickDevice(item: NewsfeedItem) {
        val devType = item.quickDeviceType ?: return
        val targetPen = item.penId ?: _currentPenId.value.ifBlank { "123" }
        viewModelScope.launch {
            val ok = repository.controlDeviceByName(devType, item.quickDeviceState, targetPen)
            if (ok) {
                showToast("✅ Đã xử lý nhanh: ${item.actionLabel}")
                loadPenDetails(targetPen)
                loadNewsfeed(_currentPenId.value)
            } else {
                showToast("⚠️ Không thể điều khiển thiết bị $devType")
            }
        }
    }

    fun loadChatHistory(penId: String = _currentPenId.value) {
        viewModelScope.launch {
            val uid = _userSession.value?.userId ?: "guest"
            val history = repository.getChatHistory(uid, penId)
            if (history.isNotEmpty()) {
                _chatMessages.value = history
            }
        }
    }

    fun loadPenDetails(penId: String) {
        viewModelScope.launch {
            val effectivePenId = if (penId == "all") "" else penId
            _devices.value = repository.getDevices(effectivePenId)
            if (_currentMode.value == "livestock") {
                _animals.value = repository.getAnimals(effectivePenId)
            } else {
                _crops.value = repository.getCrops(effectivePenId)
            }

            if (effectivePenId.isNotEmpty()) {
                val (env, history) = repository.getLatestEnvData(effectivePenId)
                _envData.value = env
                _historyLogs.value = history
                checkEnvAlerts(env)
            }
        }
    }

    private fun checkEnvAlerts(env: EnvData) {
        val issues = mutableListOf<String>()
        val isLivestock = _currentMode.value == "livestock"
        if (env.temp >= if (isLivestock) 35.0 else 40.0) issues.add("Nhiệt độ quá cao (${env.temp}°C)")
        if (env.hum >= 90.0) issues.add("Độ ẩm cao quá ngưỡng (${env.hum}%)")
        if (isLivestock && env.smell >= 400.0) issues.add("Mùi hôi chuồng trại cao (${env.smell})")
        if (!isLivestock && env.smell <= 30.0) issues.add("Độ ẩm đất khô cằn (${env.smell}%)")

        _activeAlerts.value = issues
    }

    // ==========================================
    // IOT DEVICES (CREATE / UPDATE / DELETE)
    // ==========================================
    fun toggleDevice(device: Device) {
        viewModelScope.launch {
            _devices.value = _devices.value.map {
                if (it.id == device.id) it.copy(isActive = !it.isActive) else it
            }
            repository.toggleDevice(_currentPenId.value, device)
            showToast("Thiết bị ${device.name}: ${if (!device.isActive) "ĐÃ BẬT" else "ĐÃ TẮT"}")
        }
    }

    fun addDevice(name: String, pin: Int, targetPenId: String? = null) {
        viewModelScope.launch {
            val penIdToUse = targetPenId?.takeIf { it.isNotBlank() }
                ?: _currentPenId.value.takeIf { it.isNotBlank() && it != "all" }
                ?: _pens.value.firstOrNull()?.id
                ?: ""
            val ok = repository.addDevice(name, pin, penIdToUse)
            if (ok) {
                _devices.value = repository.getDevices(_currentPenId.value)
                showToast("Đã thêm thiết bị mới: $name (Chân $pin)")
            } else {
                showToast("Thêm thiết bị thất bại, vui lòng thử lại!")
            }
        }
    }

    fun deleteDevice(deviceId: String) {
        viewModelScope.launch {
            val ok = repository.deleteDevice(deviceId)
            if (ok) {
                _devices.value = _devices.value.filter { it.id != deviceId }
                showToast("Đã xóa thiết bị thành công")
            } else {
                showToast("Xóa thiết bị thất bại!")
            }
        }
    }

    // ==========================================
    // PENS & AREAS (CREATE / DELETE)
    // ==========================================
    fun addPen(id: String, name: String, type: String, cameraUrl: String, webcamUrl: String = "0") {
        viewModelScope.launch {
            val pen = Pen(id = id, name = name, type = type, userId = _userSession.value?.userId, cameraUrl = cameraUrl, webcamUrl = webcamUrl)
            val ok = repository.createPen(pen)
            if (ok) {
                loadPens()
                showToast("Đã thêm phân khu mới: $name")
            } else {
                showToast("Tạo khu vực thất bại, kiểm tra lại mã khu vực!")
            }
        }
    }

    fun deletePen(penId: String) {
        viewModelScope.launch {
            val ok = repository.deletePen(penId)
            if (ok) {
                _pens.value = _pens.value.filter { it.id != penId }
                if (_currentPenId.value == penId) {
                    _currentPenId.value = _pens.value.firstOrNull()?.id ?: ""
                    loadPenDetails(_currentPenId.value)
                }
                showToast("Đã xóa khu vực $penId thành công")
            } else {
                showToast("Xóa khu vực thất bại!")
            }
        }
    }

    fun updatePenCamera(cameraUrl: String) {
        val penId = _currentPenId.value
        if (penId.isNotBlank()) {
            updatePenCameraSource(penId, cameraUrl)
        }
    }

    // ==========================================
    // ANIMALS (CREATE / DELETE / TRANSFER)
    // ==========================================
    fun addAnimal(id: String, species: String, weight: Double, targetWeight: Double, status: String, targetPenId: String? = null) {
        viewModelScope.launch {
            val penIdToUse = targetPenId?.takeIf { it.isNotBlank() }
                ?: _currentPenId.value.takeIf { it.isNotBlank() && it != "all" }
                ?: _pens.value.firstOrNull()?.id
                ?: ""
            val animal = Animal(id, species, weight, targetWeight, "Normal", status, penIdToUse.ifBlank { null })
            val ok = repository.addAnimal(animal)
            if (ok) {
                _animals.value = repository.getAnimals(_currentPenId.value)
                showToast("Đã thêm cá thể vật nuôi: ${animal.id} ($species)")
            } else {
                showToast("Thêm vật nuôi thất bại, kiểm tra lại mã cá thể!")
            }
        }
    }

    fun deleteAnimal(animalId: String) {
        viewModelScope.launch {
            val ok = repository.deleteAnimal(animalId)
            if (ok) {
                _animals.value = _animals.value.filter { it.id != animalId }
                showToast("Đã xóa cá thể $animalId khỏi cơ sở dữ liệu")
            } else {
                showToast("Xóa vật nuôi thất bại!")
            }
        }
    }

    fun transferAnimal(animalId: String, targetPenId: String, reason: String) {
        viewModelScope.launch {
            val ok = repository.transferAnimal(animalId, targetPenId, reason)
            if (ok) {
                _animals.value = _animals.value.filter { it.id != animalId }
                showToast("Vật nuôi $animalId đã chuyển sang $targetPenId")
            } else {
                showToast("Chuyển chuồng thất bại!")
            }
        }
    }

    // ==========================================
    // CROPS (CREATE / DELETE)
    // ==========================================
    fun addCrop(name: String, quantity: Int, plantDate: String, harvestDate: String?, status: String, targetPenId: String? = null) {
        viewModelScope.launch {
            val penIdToUse = targetPenId?.takeIf { it.isNotBlank() }
                ?: _currentPenId.value.takeIf { it.isNotBlank() && it != "all" }
                ?: _pens.value.firstOrNull()?.id
                ?: ""
            val ok = repository.addCrop(name, quantity, plantDate, harvestDate, status, penIdToUse.ifBlank { null })
            if (ok) {
                _crops.value = repository.getCrops(_currentPenId.value)
                showToast("Đã thêm giống cây trồng mới: $name")
            } else {
                showToast("Thêm giống cây trồng thất bại!")
            }
        }
    }

    fun deleteCrop(cropId: String) {
        viewModelScope.launch {
            val ok = repository.deleteCrop(cropId)
            if (ok) {
                _crops.value = _crops.value.filter { it.displayId != cropId }
                showToast("Đã xóa mục cây trồng $cropId khỏi cơ sở dữ liệu")
            } else {
                showToast("Xóa mục cây trồng thất bại!")
            }
        }
    }

    // ==========================================
    // INVENTORY (CREATE / UPDATE / DELETE)
    // ==========================================
    fun loadInventory() {
        viewModelScope.launch {
            _inventory.value = repository.getInventory(_userSession.value?.userId)
        }
    }

    fun importInventory(name: String, category: String, qty: Double, unit: String, price: Double) {
        viewModelScope.launch {
            val uid = _userSession.value?.userId
            val ok = repository.importInventory(name, category, qty, unit, price, uid)
            if (ok) {
                _inventory.value = repository.getInventory(uid)
                showToast("Nhập kho thành công: $qty $unit $name")
            } else {
                showToast("Nhập kho thất bại, vui lòng thử lại!")
            }
        }
    }

    fun exportInventory(itemId: String, currentQty: Double, exportQty: Double) {
        viewModelScope.launch {
            val ok = repository.exportInventory(itemId, currentQty, exportQty)
            if (ok) {
                _inventory.value = repository.getInventory(_userSession.value?.userId)
                showToast("Đã xuất kho $exportQty cho chuồng nuôi")
            } else {
                showToast("Xuất kho thất bại!")
            }
        }
    }

    fun deleteInventory(itemId: String) {
        viewModelScope.launch {
            val ok = repository.deleteInventory(itemId)
            if (ok) {
                _inventory.value = _inventory.value.filter { it.displayId != itemId }
                showToast("Đã xóa mặt hàng kho thành công")
            } else {
                showToast("Xóa mặt hàng kho thất bại!")
            }
        }
    }

    // Briefing
    fun refreshBriefing() {
        viewModelScope.launch {
            isBriefingLoading.value = true
            val briefing = repository.triggerDailyBriefing()
            _dailyBriefing.value = briefing
            isBriefingLoading.value = false
        }
    }

    // Chat
    fun sendChatMessage(text: String) {
        if (text.isBlank()) return
        val userMsg = ChatMessage(
            id = UUID.randomUUID().toString(),
            sender = "user",
            content = text,
            time = "Vừa xong"
        )
        _chatMessages.value = _chatMessages.value + userMsg

        val streamMsgId = UUID.randomUUID().toString()
        viewModelScope.launch {
            isChatLoading.value = true
            var msgAdded = false
            var accumulated = ""
            repository.sendChatStream(
                message = text,
                penId = _currentPenId.value,
                userId = _userSession.value?.userId ?: "guest",
                onChunk = { delta ->
                    accumulated += delta
                    if (!msgAdded) {
                        msgAdded = true
                        isChatLoading.value = false
                        _chatMessages.value = _chatMessages.value + ChatMessage(
                            id = streamMsgId,
                            sender = "agent",
                            content = accumulated,
                            time = "Vừa xong",
                            isStreaming = true
                        )
                    } else {
                        _chatMessages.value = _chatMessages.value.map {
                            if (it.id == streamMsgId) it.copy(content = accumulated) else it
                        }
                    }
                },
                onDone = { fullReply, tools ->
                    isChatLoading.value = false
                    val finalText = fullReply.ifBlank { accumulated }.ifBlank { "Đã xử lý." }
                    if (!msgAdded) {
                        msgAdded = true
                        _chatMessages.value = _chatMessages.value + ChatMessage(
                            id = streamMsgId,
                            sender = "agent",
                            content = finalText,
                            time = "Vừa xong",
                            toolCalls = tools,
                            isStreaming = false
                        )
                    } else {
                        _chatMessages.value = _chatMessages.value.map {
                            if (it.id == streamMsgId) {
                                it.copy(content = finalText, toolCalls = tools, isStreaming = false)
                            } else it
                        }
                    }
                }
            )
            isChatLoading.value = false
        }
    }

    fun sendDiagnosisImage(imageBase64: String, query: String? = null, contentType: String = "image/jpeg") {
        if (imageBase64.isBlank()) return
        val displayContent = if (!query.isNullOrBlank()) query else "📷 Gửi ảnh kiểm chứng & phân tích RAG"
        val userMsg = ChatMessage(
            id = UUID.randomUUID().toString(),
            sender = "user",
            content = displayContent,
            time = "Vừa xong",
            imageBase64 = imageBase64
        )
        _chatMessages.value = _chatMessages.value + userMsg

        viewModelScope.launch {
            isChatLoading.value = true
            val agentReply = repository.diagnoseDiseaseBase64(
                imageBase64 = imageBase64,
                userQuery = query ?: "Phân tích và chẩn đoán hình ảnh nông nghiệp này giúp tôi",
                contentType = contentType,
                userId = _userSession.value?.userId ?: "guest",
                penId = _currentPenId.value
            )
            _chatMessages.value = _chatMessages.value + agentReply
            isChatLoading.value = false
        }
    }

    // Staff & Attendance
    fun loadStaff() {
        viewModelScope.launch {
            _staffList.value = repository.getStaffList()
        }
    }

    fun loadAttendance() {
        viewModelScope.launch {
            _attendanceHistory.value = repository.getAttendanceHistory()
        }
    }

    fun checkInStaff(staffId: String, staffName: String, checkType: String, note: String?) {
        viewModelScope.launch {
            repository.checkInStaff(staffId, staffName, _currentPenId.value, checkType, note)
            loadAttendance()
            showToast("✅ Đã ghi nhận điểm danh: $staffName ($checkType)")
        }
    }

    // Face AI Controls (Port 8001 / 10000)
    fun startFaceCamera(source: String = "0", weekday: Int? = null) {
        viewModelScope.launch {
            _isFaceCameraLoading.value = true
            _faceCameraError.value = null
            val ok = repository.startFaceCamera(source, weekday)
            _isFaceCameraLoading.value = false
            _isFaceCameraActive.value = true
            startFaceTelemetryPolling()
            if (ok) {
                showToast("Đã kích hoạt máy quay nhận diện")
            }
        }
    }

    fun stopFaceCamera() {
        stopFaceTelemetryPolling()
        _isFaceCameraActive.value = false
        viewModelScope.launch {
            repository.stopFaceCamera()
        }
    }

    fun startFaceTelemetryPolling() {
        facePollJob?.cancel()
        facePollJob = viewModelScope.launch {
            while (_isFaceCameraActive.value) {
                val t = repository.getFaceCameraLatest()
                if (t != null) {
                    _faceCameraTelemetry.value = t
                }
                delay(200)
            }
        }
    }

    fun stopFaceTelemetryPolling() {
        facePollJob?.cancel()
        facePollJob = null
    }

    fun updatePenCameras(penId: String, ipCameraUrl: String, webcamUrl: String = "0") {
        viewModelScope.launch {
            val cleanIp = ipCameraUrl.trim()
            val cleanWebcam = webcamUrl.trim().ifBlank { "0" }
            _pens.value = _pens.value.map {
                if (it.id == penId) it.copy(cameraUrl = cleanIp, webcamUrl = cleanWebcam) else it
            }
            repository.updatePenCameras(penId, cleanIp, cleanWebcam)
            if (cleanIp.isNotBlank()) {
                repository.configureCameraStream(penId, cleanIp, "ipcam")
            }
            if (cleanWebcam.isNotBlank()) {
                repository.configureCameraStream(penId, cleanWebcam, "webcam")
            }
            loadPens()
            loadPenDetails(penId)
            showToast("Đã lưu cấu hình 2 luồng camera (IP Cam & Webcam) cho $penId")
        }
    }

    fun updatePenCameraSource(penId: String, newUrl: String) {
        updatePenCameras(penId, newUrl, "0")
    }

    fun stopPenCamera(penId: String) {
        viewModelScope.launch {
            repository.stopPenCamera(penId)
        }
    }

    fun refreshActionLogs(penId: String) {
        viewModelScope.launch {
            _actionLogs.value = repository.getActionLogs(penId)
        }
    }

    // Telemetry Polling (Port 8002)
    private fun startTelemetryPolling(penId: String) {
        telemetryPollJob?.cancel()
        telemetryPollJob = viewModelScope.launch {
            while (true) {
                _actionTelemetry.value = repository.getActionTrackerStatus(penId)
                _actionLogs.value = repository.getActionLogs(penId)
                delay(1500)
            }
        }
    }

    fun toggleMute() {
        _isMuted.value = !_isMuted.value
    }

    fun dismissAlert() {
        _activeAlerts.value = emptyList()
    }

    // Auth
    fun clearAuthMessages() {
        authError.value = null
        authSuccess.value = null
    }

    fun login(email: String) {
        val session = UserSession(email, email.substringBefore("@"), isDemo = false)
        sessionManager.saveSession(session)
        _userSession.value = session
        repository.setAuthToken(null)
        loadInitialData()
        showToast("Đăng nhập thành công: $email")
    }

    fun loginWithSupabase(email: String, pass: String) {
        if (email.isBlank() || pass.isBlank()) {
            authError.value = "Vui lòng nhập đầy đủ hộp thư điện tử và mật khẩu."
            return
        }
        viewModelScope.launch {
            authLoading.value = true
            authError.value = null
            authSuccess.value = null

            val result = repository.signIn(email.trim(), pass)
            authLoading.value = false
            result.onSuccess { session ->
                sessionManager.saveSession(session)
                _userSession.value = session
                loadInitialData()
                showToast("Chào mừng bạn trở lại, ${session.email}!")
            }.onFailure { err ->
                authError.value = err.message ?: "Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin."
            }
        }
    }

    fun signUpWithSupabase(email: String, pass: String, passConfirm: String) {
        if (email.isBlank() || pass.isBlank()) {
            authError.value = "Vui lòng điền đầy đủ hộp thư điện tử và mật khẩu."
            return
        }
        if (pass.length < 6) {
            authError.value = "Mật khẩu phải chứa ít nhất 6 ký tự."
            return
        }
        if (pass != passConfirm) {
            authError.value = "Mật khẩu xác nhận không trùng khớp."
            return
        }
        viewModelScope.launch {
            authLoading.value = true
            authError.value = null
            authSuccess.value = null

            val result = repository.signUp(email.trim(), pass)
            authLoading.value = false
            result.onSuccess { msg ->
                authSuccess.value = msg
            }.onFailure { err ->
                authError.value = err.message ?: "Đăng ký thất bại. Vui lòng thử lại."
            }
        }
    }

    fun loginDemo() {
        val demoUid = sessionManager.getOrCreateDemoUserId()
        val demoSession = UserSession("demo@smartfarm.vn", demoUid, isDemo = true)
        sessionManager.saveSession(demoSession)
        _userSession.value = demoSession
        repository.setAuthToken(null)
        loadInitialData()
        showToast("Đã kích hoạt chế độ Trải Nghiệm riêng biệt")
    }

    fun logout() {
        val currentToken = _userSession.value?.accessToken
        viewModelScope.launch {
            repository.signOut(currentToken)
        }
        sessionManager.clearSession()
        _userSession.value = null
        _pens.value = emptyList()
        _currentPenId.value = ""
        _devices.value = emptyList()
        _animals.value = emptyList()
        _crops.value = emptyList()
        _inventory.value = emptyList()
        _newsfeedItems.value = emptyList()
        _activeAlerts.value = emptyList()
        showToast("Đã đăng xuất tài khoản.")
    }

    private val _operationLogs = MutableStateFlow<List<OperationLog>>(emptyList())
    val operationLogs: StateFlow<List<OperationLog>> = _operationLogs.asStateFlow()

    private val _healthLogs = MutableStateFlow<List<HealthLog>>(emptyList())
    val healthLogs: StateFlow<List<HealthLog>> = _healthLogs.asStateFlow()

    private val _weightLogs = MutableStateFlow<List<WeightLog>>(emptyList())
    val weightLogs: StateFlow<List<WeightLog>> = _weightLogs.asStateFlow()

    private val _cropGrowthLogs = MutableStateFlow<List<CropGrowthLog>>(emptyList())
    val cropGrowthLogs: StateFlow<List<CropGrowthLog>> = _cropGrowthLogs.asStateFlow()

    private val _cropCareLogs = MutableStateFlow<List<CropCareLog>>(emptyList())
    val cropCareLogs: StateFlow<List<CropCareLog>> = _cropCareLogs.asStateFlow()

    fun loadOperationLogs() {
        viewModelScope.launch {
            _operationLogs.value = repository.getOperationLogs()
        }
    }

    fun loadHealthLogs(animalId: String) {
        viewModelScope.launch { _healthLogs.value = repository.getHealthLogs(animalId) }
    }

    fun addHealthLog(animalId: String, type: String, title: String, note: String) {
        viewModelScope.launch {
            repository.addHealthLog(animalId, type, title, note)
            _healthLogs.value = repository.getHealthLogs(animalId)
            showToast("Đã thêm nhật ký thú y")
        }
    }

    fun deleteHealthLog(animalId: String, logId: String) {
        viewModelScope.launch {
            repository.deleteHealthLog(logId)
            _healthLogs.value = repository.getHealthLogs(animalId)
        }
    }

    fun loadWeightLogs(animalId: String) {
        viewModelScope.launch { _weightLogs.value = repository.getWeightLogs(animalId) }
    }

    fun addWeightLog(animalId: String, weight: Double) {
        viewModelScope.launch {
            repository.addWeightLog(animalId, weight)
            _weightLogs.value = repository.getWeightLogs(animalId)
            _animals.value = repository.getAnimals(_currentPenId.value)
            showToast("Đã cập nhật cân nặng: $weight kg")
        }
    }

    fun deleteWeightLog(animalId: String, logId: String) {
        viewModelScope.launch {
            repository.deleteWeightLog(logId)
            _weightLogs.value = repository.getWeightLogs(animalId)
        }
    }

    fun loadCropGrowthLogs(cropId: String) {
        viewModelScope.launch { _cropGrowthLogs.value = repository.getCropGrowthLogs(cropId) }
    }

    fun addCropGrowthLog(cropId: String, heightCm: Double) {
        viewModelScope.launch {
            repository.addCropGrowthLog(cropId, heightCm)
            _cropGrowthLogs.value = repository.getCropGrowthLogs(cropId)
            showToast("Đã ghi đo sinh trưởng: $heightCm cm")
        }
    }

    fun deleteCropGrowthLog(cropId: String, logId: String) {
        viewModelScope.launch {
            repository.deleteCropGrowthLog(logId)
            _cropGrowthLogs.value = repository.getCropGrowthLogs(cropId)
        }
    }

    fun loadCropCareLogs(cropId: String) {
        viewModelScope.launch { _cropCareLogs.value = repository.getCropCareLogs(cropId) }
    }

    fun addCropCareLog(cropId: String, type: String, action: String, note: String) {
        viewModelScope.launch {
            repository.addCropCareLog(cropId, type, action, note)
            _cropCareLogs.value = repository.getCropCareLogs(cropId)
            showToast("Đã ghi nhật ký chăm sóc cây")
        }
    }

    fun deleteCropCareLog(cropId: String, logId: String) {
        viewModelScope.launch {
            repository.deleteCropCareLog(logId)
            _cropCareLogs.value = repository.getCropCareLogs(cropId)
        }
    }

    fun harvestAnimal(animal: Animal) {
        viewModelScope.launch {
            repository.deleteAnimal(animal.id)
            repository.recordOperationLog(
                "ANIMAL_EXPORT",
                "${animal.id} (${animal.species})",
                animal.weight,
                "kg",
                _currentPenId.value,
                "Xuất chuồng cá thể ${animal.id} (${animal.weight} kg)"
            )
            _animals.value = repository.getAnimals(_currentPenId.value)
            loadOperationLogs()
            showToast("🎉 Đã xuất chuồng cá thể ${animal.id}")
        }
    }

    fun harvestCrop(crop: Crop) {
        viewModelScope.launch {
            repository.deleteCrop(crop.displayId)
            repository.recordOperationLog(
                "CROP_HARVEST",
                crop.name,
                crop.quantity.toDouble(),
                "cây",
                _currentPenId.value,
                "Thu hoạch vụ mùa ${crop.name} (${crop.quantity} cây)"
            )
            _crops.value = repository.getCrops(_currentPenId.value)
            loadOperationLogs()
            showToast("🎉 Đã thu hoạch vụ mùa ${crop.name}")
        }
    }

    fun enrollStaffFace(
        staffId: String,
        name: String,
        role: String,
        thangBytes: ByteArray,
        traiBytes: ByteArray? = null,
        phaiBytes: ByteArray? = null
    ) {
        viewModelScope.launch {
            val ok = repository.enrollStaffFace(staffId, name, role, _currentPenId.value, thangBytes, traiBytes, phaiBytes)
            loadStaff()
            showToast(if (ok) "✅ Đã đăng ký khuôn mặt cho $name" else "⚠️ Đã lưu nhân sự, lỗi trích xuất khuôn mặt")
        }
    }

    override fun onCleared() {
        super.onCleared()
        repository.webSocketManager.disconnect()
        telemetryPollJob?.cancel()
        continuousDataPollJob?.cancel()
        facePollJob?.cancel()
    }
}
