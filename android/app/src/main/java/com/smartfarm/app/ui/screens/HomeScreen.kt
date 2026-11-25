package com.smartfarm.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.SupportAgent
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.smartfarm.app.ui.components.*
import com.smartfarm.app.ui.theme.*
import com.smartfarm.app.ui.viewmodel.FarmViewModel

@Composable
fun HomeScreen(
    viewModel: FarmViewModel,
    onOpenChat: () -> Unit,
    modifier: Modifier = Modifier
) {
    val pens by viewModel.pens.collectAsState()
    val currentPenId by viewModel.currentPenId.collectAsState()
    val currentMode by viewModel.currentMode.collectAsState()
    val devices by viewModel.devices.collectAsState()
    val envData by viewModel.envData.collectAsState()
    val historyLogs by viewModel.historyLogs.collectAsState()
    val activeAlerts by viewModel.activeAlerts.collectAsState()
    val briefing by viewModel.dailyBriefing.collectAsState()
    val isBriefingLoading by viewModel.isBriefingLoading.collectAsState()
    val actionTelemetry by viewModel.actionTelemetry.collectAsState()
    val actionLogs by viewModel.actionLogs.collectAsState()

    var showAddPenDialog by remember { mutableStateOf(false) }
    var showAddDeviceDialog by remember { mutableStateOf(false) }
    var showConfigCameraDialog by remember { mutableStateOf(false) }

    val currentPen = pens.firstOrNull { it.id == currentPenId }
    val currentPenName = currentPen?.name ?: (if (currentMode == "livestock") "Chuồng Nuôi Hiện Tại" else "Vườn Trồng Hiện Tại")

    val scrollState = rememberScrollState()

    Scaffold(
        containerColor = FarmBackgroundLight,
        floatingActionButton = {
            FloatingActionButton(
                onClick = onOpenChat,
                containerColor = FarmPrimary,
                contentColor = Color.White,
                shape = CircleShape,
                elevation = FloatingActionButtonDefaults.elevation(4.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.SupportAgent,
                    contentDescription = "Trợ lý nông trại",
                    modifier = Modifier.size(26.dp)
                )
            }
        }
    ) { paddingValues ->
        Column(
            modifier = modifier
                .fillMaxSize()
                .padding(paddingValues)
                .background(FarmBackgroundLight)
                .verticalScroll(scrollState)
        ) {
            Spacer(modifier = Modifier.height(8.dp))

            // 1. Danh sách chuồng nuôi / vườn trồng
            PenStoriesCarousel(
                pens = pens,
                currentPenId = currentPenId,
                onSelectPen = { viewModel.selectPen(it) },
                onOpenAddPenModal = { showAddPenDialog = true },
                onDeletePen = { viewModel.deletePen(it) }
            )

            // 2. Bảng cảnh báo khẩn cấp (nếu có vấn đề về nhiệt độ/mùi)
            EmergencyAlertBanner(
                penName = currentPenName,
                penId = currentPenId,
                issues = activeAlerts,
                temp = envData.temp,
                smell = envData.smell,
                currentMode = currentMode,
                onActivateFan = {
                    val fan = devices.firstOrNull { it.name.contains("quạt", ignoreCase = true) }
                    if (fan != null) viewModel.toggleDevice(fan)
                    else viewModel.showToast("Đang kích hoạt quạt thông gió...")
                },
                onAskAI = onOpenChat,
                onDismiss = { viewModel.dismissAlert() }
            )

            // 3. Bản tin sáng thông minh
            MorningBriefingCard(
                briefing = briefing,
                isLoading = isBriefingLoading,
                onRefresh = { viewModel.refreshBriefing() },
                onOpenChat = onOpenChat,
                currentMode = currentMode
            )

            // 4. Camera Giám Sát Chuồng Nuôi AI (Port 8002 - Đồng bộ với Frontend)
            FeedPenCameraCard(
                currentPenId = currentPenId,
                penName = currentPenName,
                penCameraUrl = currentPen?.cameraUrl ?: "",
                penWebcamUrl = currentPen?.webcamUrl ?: "0",
                currentMode = currentMode,
                telemetry = actionTelemetry,
                actionLogs = actionLogs,
                onConfigureCamera = { showConfigCameraDialog = true },
                onRefreshLogs = { viewModel.refreshActionLogs(currentPenId) },
                onToggleCamera = { active ->
                    if (!active) viewModel.stopPenCamera(currentPenId)
                }
            )

            // 5. Giám sát các chỉ số môi trường
            EnvironmentMetricCards(
                envData = envData,
                historyLogs = historyLogs,
                currentMode = currentMode,
                onRefresh = { viewModel.loadPenDetails(currentPenId) },
                onAskAI = onOpenChat
            )

            // 5. Điều khiển thiết bị điện thông minh
            DeviceControlCard(
                devices = devices,
                penName = currentPenName,
                onToggleDevice = { viewModel.toggleDevice(it) },
                onDeleteDevice = { viewModel.deleteDevice(it.id) },
                onOpenAddDevice = { showAddDeviceDialog = true }
            )

            Spacer(modifier = Modifier.height(28.dp))
        }

        // Hộp thoại thêm chuồng và thiết bị
        AddPenDialog(
            isOpen = showAddPenDialog,
            currentMode = currentMode,
            onDismiss = { showAddPenDialog = false },
            onConfirm = { id, name, type, cam, webcam -> viewModel.addPen(id, name, type, cam, webcam) }
        )

        AddDeviceDialog(
            isOpen = showAddDeviceDialog,
            penId = currentPenId,
            onDismiss = { showAddDeviceDialog = false },
            onConfirm = { name, pin -> viewModel.addDevice(name, pin) }
        )

        ConfigCameraDialog(
            isOpen = showConfigCameraDialog,
            penId = currentPenId,
            penName = currentPenName,
            currentUrl = currentPen?.cameraUrl,
            currentWebcamUrl = currentPen?.webcamUrl ?: "0",
            onDismiss = { showConfigCameraDialog = false },
            onConfirm = { newIpUrl, newWebcamUrl ->
                viewModel.updatePenCameras(currentPenId, newIpUrl, newWebcamUrl)
            }
        )
    }
}
