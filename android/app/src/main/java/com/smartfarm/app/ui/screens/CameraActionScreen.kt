package com.smartfarm.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.smartfarm.app.data.remote.ApiConfig
import com.smartfarm.app.ui.components.ConfigCameraDialog
import com.smartfarm.app.ui.components.WebSocketStreamPlayer
import com.smartfarm.app.ui.theme.*
import com.smartfarm.app.ui.viewmodel.FarmViewModel

@Composable
fun CameraActionScreen(
    viewModel: FarmViewModel,
    modifier: Modifier = Modifier
) {
    val pens by viewModel.pens.collectAsState()
    val currentPenId by viewModel.currentPenId.collectAsState()
    val currentPen = pens.firstOrNull { it.id == currentPenId }
    val penName = currentPen?.name ?: "Chuồng Nuôi Đang Chọn"
    val cameraUrl = currentPen?.cameraUrl
    val webcamUrl = currentPen?.webcamUrl ?: "0"

    val telemetry by viewModel.actionTelemetry.collectAsState()
    val actionLogs by viewModel.actionLogs.collectAsState()

    var showConfigCameraDialog by remember { mutableStateOf(false) }
    var isLiveStreamOn by remember { mutableStateOf(true) }
    var streamKey by remember { mutableLongStateOf(System.currentTimeMillis()) }
    var streamDisplayMode by remember { mutableStateOf("ipcam") } // "ipcam" | "webcam" | "dual"

    // Tự động làm mới streamKey khi penId hoặc cameraUrl thay đổi
    LaunchedEffect(currentPenId, cameraUrl, webcamUrl) {
        streamKey = System.currentTimeMillis()
    }

    val ipStreamUrl = remember(currentPenId, cameraUrl, streamKey) {
        val target = if (currentPenId.isNotBlank()) currentPenId else "DEFAULT"
        val encTarget = try { java.net.URLEncoder.encode(target, "UTF-8") } catch (_: Exception) { target }
        val encSource = try { java.net.URLEncoder.encode(cameraUrl ?: "", "UTF-8") } catch (_: Exception) { cameraUrl ?: "" }
        "${ApiConfig.actionWsUrl}/ws/video_feed?target_id=$encTarget&stream_type=ipcam&source=$encSource&t=$streamKey"
    }

    val webcamStreamUrl = remember(currentPenId, webcamUrl, streamKey) {
        val target = if (currentPenId.isNotBlank()) currentPenId else "DEFAULT"
        val encTarget = try { java.net.URLEncoder.encode(target, "UTF-8") } catch (_: Exception) { target }
        val encSource = try { java.net.URLEncoder.encode(if (webcamUrl.isNotBlank()) webcamUrl else "0", "UTF-8") } catch (_: Exception) { "0" }
        "${ApiConfig.actionWsUrl}/ws/video_feed?target_id=$encTarget&stream_type=webcam&source=$encSource&t=$streamKey"
    }

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(FarmBackgroundLight)
    ) {
        // Tiêu đề đầu trang
        Surface(
            color = Color.White,
            shadowElevation = 1.dp,
            border = androidx.compose.foundation.BorderStroke(1.dp, FarmCardBorderLight),
            modifier = Modifier.fillMaxWidth()
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Column {
                    Text(
                        text = "Máy Quay Giám Sát Chuồng",
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold,
                        color = FarmForegroundLight
                    )
                    Text(
                        text = "Khu vực: $penName ($currentPenId) • Nhận diện hành vi tự động",
                        style = MaterialTheme.typography.labelSmall,
                        color = FarmTextMutedLight
                    )
                }

                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    IconButton(
                        onClick = {
                            streamKey = System.currentTimeMillis()
                        },
                        modifier = Modifier
                            .size(38.dp)
                            .clip(CircleShape)
                            .background(FarmMutedLight)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Refresh,
                            contentDescription = "Tải lại hình ảnh",
                            tint = FarmPrimary,
                            modifier = Modifier.size(20.dp)
                        )
                    }

                    IconButton(
                        onClick = { showConfigCameraDialog = true },
                        modifier = Modifier
                            .size(38.dp)
                            .clip(CircleShape)
                            .background(FarmMutedLight)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Settings,
                            contentDescription = "Cài đặt máy quay",
                            tint = FarmPrimary,
                            modifier = Modifier.size(20.dp)
                        )
                    }
                }
            }
        }

        LazyColumn(
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            // Thanh chuyển đổi nhanh giữa các chuồng nuôi
            if (pens.isNotEmpty()) {
                item {
                    LazyRow(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        items(pens) { pen ->
                            val isSelected = pen.id == currentPenId
                            FilterChip(
                                selected = isSelected,
                                onClick = {
                                    viewModel.selectPen(pen.id)
                                    streamKey = System.currentTimeMillis()
                                },
                                label = {
                                    Text(
                                        text = pen.name,
                                        fontSize = 11.sp,
                                        fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal
                                    )
                                },
                                leadingIcon = {
                                    Icon(
                                        imageVector = Icons.Default.Pets,
                                        contentDescription = null,
                                        modifier = Modifier.size(14.dp),
                                        tint = if (isSelected) FarmPrimary else FarmTextMutedLight
                                    )
                                }
                            )
                        }
                    }
                }
            }

            // Bộ chọn luồng camera: 📱 IP Cam | 💻 Webcam | 👥 Cả 2 Luồng
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    FilterChip(
                        selected = streamDisplayMode == "ipcam",
                        onClick = { streamDisplayMode = "ipcam" },
                        label = { Text("📱 Máy quay ĐT", fontSize = 11.sp, fontWeight = FontWeight.Bold) },
                        modifier = Modifier.weight(1f)
                    )
                    FilterChip(
                        selected = streamDisplayMode == "webcam",
                        onClick = { streamDisplayMode = "webcam" },
                        label = { Text("💻 Máy quay MT", fontSize = 11.sp, fontWeight = FontWeight.Bold) },
                        modifier = Modifier.weight(1f)
                    )
                    FilterChip(
                        selected = streamDisplayMode == "dual",
                        onClick = { streamDisplayMode = "dual" },
                        label = { Text("👥 2 Luồng", fontSize = 11.sp, fontWeight = FontWeight.Bold) },
                        modifier = Modifier.weight(1f)
                    )
                }
            }

            // Khung hình phát trực tiếp từ máy quay
            item {
                val activeStreamUrl = if (streamDisplayMode == "webcam") webcamStreamUrl else ipStreamUrl
                Card(
                    shape = RoundedCornerShape(20.dp),
                    colors = CardDefaults.cardColors(containerColor = Color.Black),
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(if (streamDisplayMode == "dual") 480.dp else 250.dp)
                ) {
                    if (streamDisplayMode == "dual") {
                        Column(
                            modifier = Modifier.fillMaxSize().padding(6.dp),
                            verticalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            Box(modifier = Modifier.weight(1f).fillMaxWidth().clip(RoundedCornerShape(12.dp))) {
                                WebSocketStreamPlayer(
                                    streamUrl = ipStreamUrl,
                                    isPlaying = isLiveStreamOn,
                                    onRetry = { streamKey = System.currentTimeMillis() },
                                    modifier = Modifier.fillMaxSize(),
                                    overlayContent = {
                                        Surface(
                                            shape = RoundedCornerShape(6.dp),
                                            color = Color.Black.copy(alpha = 0.75f),
                                            modifier = Modifier.padding(6.dp).align(Alignment.TopStart)
                                        ) {
                                            Text(
                                                text = "📱 Luồng 1: Máy quay điện thoại",
                                                color = Color.White,
                                                fontSize = 9.sp,
                                                fontWeight = FontWeight.Bold,
                                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                            )
                                        }
                                    }
                                )
                            }
                            Box(modifier = Modifier.weight(1f).fillMaxWidth().clip(RoundedCornerShape(12.dp))) {
                                WebSocketStreamPlayer(
                                    streamUrl = webcamStreamUrl,
                                    isPlaying = isLiveStreamOn,
                                    onRetry = { streamKey = System.currentTimeMillis() },
                                    modifier = Modifier.fillMaxSize(),
                                    overlayContent = {
                                        Surface(
                                            shape = RoundedCornerShape(6.dp),
                                            color = Color.Black.copy(alpha = 0.75f),
                                            modifier = Modifier.padding(6.dp).align(Alignment.TopStart)
                                        ) {
                                            Text(
                                                text = "💻 Luồng 2: Máy quay máy tính",
                                                color = Color.White,
                                                fontSize = 9.sp,
                                                fontWeight = FontWeight.Bold,
                                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                            )
                                        }
                                    }
                                )
                            }
                        }
                    } else {
                        Box(modifier = Modifier.fillMaxSize()) {
                            WebSocketStreamPlayer(
                                streamUrl = activeStreamUrl,
                            isPlaying = isLiveStreamOn,
                            onRetry = {
                                streamKey = System.currentTimeMillis()
                            },
                            modifier = Modifier.fillMaxSize(),
                            overlayContent = {
                                // Đèn báo trực tiếp góc trên bên trái
                                Surface(
                                    shape = RoundedCornerShape(8.dp),
                                    color = if (isLiveStreamOn) FarmDestructive else Color.Gray,
                                    modifier = Modifier
                                        .padding(12.dp)
                                        .align(Alignment.TopStart)
                                ) {
                                    Row(
                                        verticalAlignment = Alignment.CenterVertically,
                                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                                    ) {
                                        Box(
                                            modifier = Modifier
                                                .size(6.dp)
                                                .clip(CircleShape)
                                                .background(Color.White)
                                        )
                                        Spacer(modifier = Modifier.width(4.dp))
                                        Text(
                                            text = if (isLiveStreamOn) "TRỰC TIẾP" else "TẠM DỪNG",
                                            color = Color.White,
                                            fontWeight = FontWeight.Bold,
                                            fontSize = 10.sp
                                        )
                                    }
                                }

                                // Thông số đo đạc góc trên bên phải
                                Surface(
                                    shape = RoundedCornerShape(8.dp),
                                    color = Color.Black.copy(alpha = 0.70f),
                                    modifier = Modifier
                                        .padding(12.dp)
                                        .align(Alignment.TopEnd)
                                ) {
                                    Text(
                                        text = "Tốc độ: ${telemetry?.fps?.toInt() ?: 15} hình/giây • Tin cậy: ${((telemetry?.confidence ?: 0.95) * 100).toInt()}%",
                                        color = Color.White,
                                        fontSize = 10.sp,
                                        fontWeight = FontWeight.Bold,
                                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                                    )
                                }

                                // Thanh trạng thái hành động phía dưới
                                Surface(
                                    shape = RoundedCornerShape(12.dp),
                                    color = Color.Black.copy(alpha = 0.85f),
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .align(Alignment.BottomCenter)
                                        .padding(10.dp)
                                ) {
                                    Row(
                                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.SpaceBetween
                                    ) {
                                        Row(
                                            verticalAlignment = Alignment.CenterVertically,
                                            modifier = Modifier.weight(1f)
                                        ) {
                                            Icon(
                                                imageVector = Icons.Default.Visibility,
                                                contentDescription = null,
                                                tint = FarmSecondary,
                                                modifier = Modifier.size(18.dp)
                                            )
                                            Spacer(modifier = Modifier.width(8.dp))
                                            Column {
                                                val rawAct = telemetry?.lastAction?.trim().orEmpty()
                                                val actLabel = when {
                                                    rawAct.equals("FEEDING", ignoreCase = true) -> "🍲 Đang thực hiện: Cho ăn"
                                                    rawAct.equals("WATERING", ignoreCase = true) -> "💧 Đang thực hiện: Tưới nước"
                                                    rawAct.equals("FERTILIZING", ignoreCase = true) -> "🌱 Đang thực hiện: Bón phân"
                                                    rawAct.equals("AI Analyzing...", ignoreCase = true) -> "🤖 AI đang phân tích hành động..."
                                                    rawAct.isBlank() || rawAct.equals("None", ignoreCase = true) || rawAct == "Bình thường" -> {
                                                        when (telemetry?.fsmState) {
                                                            "TRIGGERED" -> "⚡ Phát hiện thao tác — đang xác thực AI..."
                                                            "RESUMED" -> if (telemetry?.isBending == true) "👀 Phát hiện người đang cúi thao tác..." else "👀 Đang theo dõi thao tác..."
                                                            "COOLDOWN" -> "⏳ Vừa hoàn tất thao tác (${telemetry?.cooldownRemaining?.toInt() ?: 0}s)"
                                                            else -> "👀 Đang giám sát khu vực"
                                                        }
                                                    }
                                                    else -> "🎬 Hành động: $rawAct"
                                                }
                                                Text(
                                                    text = actLabel,
                                                    color = Color.White,
                                                    fontWeight = FontWeight.Bold,
                                                    fontSize = 11.sp,
                                                    maxLines = 1
                                                )
                                                if (!telemetry?.lastActionReason.isNullOrBlank()) {
                                                    Text(
                                                        text = telemetry!!.lastActionReason!!,
                                                        color = Color.White.copy(alpha = 0.8f),
                                                        fontSize = 10.sp,
                                                        maxLines = 1
                                                    )
                                                }
                                            }
                                        }

                                        IconButton(
                                            onClick = {
                                                val next = !isLiveStreamOn
                                                isLiveStreamOn = next
                                                if (next) {
                                                    streamKey = System.currentTimeMillis()
                                                } else {
                                                    viewModel.stopPenCamera(currentPenId)
                                                }
                                            },
                                            modifier = Modifier.size(28.dp)
                                        ) {
                                            Icon(
                                                imageVector = if (isLiveStreamOn) Icons.Default.Pause else Icons.Default.PlayArrow,
                                                contentDescription = if (isLiveStreamOn) "Tạm dừng" else "Tiếp tục",
                                                tint = Color.White,
                                                modifier = Modifier.size(20.dp)
                                            )
                                        }
                                    }
                                }
                            }
                        )
                    }
                }
            }
        }

            // Thanh trạng thái hành động gọn nhẹ dựa trên nội dung API trả về
            item {
                val rawAct = telemetry?.lastAction?.trim().orEmpty()
                val actLabel = when {
                    rawAct.equals("FEEDING", ignoreCase = true) -> "🍲 Đang thực hiện: Cho vật nuôi ăn"
                    rawAct.equals("WATERING", ignoreCase = true) -> "💧 Đang thực hiện: Tưới nước"
                    rawAct.equals("FERTILIZING", ignoreCase = true) -> "🌱 Đang thực hiện: Bón phân"
                    rawAct.equals("AI Analyzing...", ignoreCase = true) -> "🤖 AI đang phân tích hành động..."
                    rawAct.isBlank() || rawAct.equals("None", ignoreCase = true) || rawAct == "Bình thường" -> {
                        when (telemetry?.fsmState) {
                            "TRIGGERED" -> "⚡ Phát hiện thao tác — đang xác thực AI..."
                            "RESUMED" -> if (telemetry?.isBending == true) "👀 Phát hiện người đang cúi thao tác..." else "👀 Đang theo dõi thao tác..."
                            "COOLDOWN" -> "⏳ Vừa hoàn tất thao tác (${telemetry?.cooldownRemaining?.toInt() ?: 0}s)"
                            else -> "👀 Đang giám sát (Chưa phát hiện hành động)"
                        }
                    }
                    else -> "🎬 Hành động: $rawAct"
                }
                val actReason = telemetry?.lastActionReason?.takeIf { it.isNotBlank() }

                Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = FarmPrimary.copy(alpha = 0.08f),
                    border = androidx.compose.foundation.BorderStroke(1.dp, FarmPrimary.copy(alpha = 0.22f)),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.AutoAwesome,
                            contentDescription = null,
                            tint = FarmPrimary,
                            modifier = Modifier.size(16.dp)
                        )
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = actLabel,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold,
                                color = FarmPrimary
                            )
                            if (actReason != null) {
                                Spacer(modifier = Modifier.height(2.dp))
                                Text(
                                    text = actReason,
                                    fontSize = 11.sp,
                                    color = FarmForegroundLight.copy(alpha = 0.8f),
                                    maxLines = 2
                                )
                            }
                        }
                    }
                }
            }

            // Thẻ nguồn máy quay hiện tại
            item {
                Card(
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = Color.White),
                    elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, FarmCardBorderLight),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(14.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(
                                text = "Nguồn Máy Quay Đang Dùng",
                                style = MaterialTheme.typography.titleSmall,
                                fontWeight = FontWeight.Bold,
                                color = FarmForegroundLight
                            )
                            Surface(
                                shape = RoundedCornerShape(6.dp),
                                color = if (isLiveStreamOn) FarmSuccess.copy(alpha = 0.12f) else Color.Gray.copy(alpha = 0.12f)
                            ) {
                                Text(
                                    text = if (isLiveStreamOn) "Đang Truyền Hình Ảnh" else "Đã Tắt Luồng",
                                    color = if (isLiveStreamOn) FarmSuccess else Color.Gray,
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Bold,
                                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                )
                            }
                        }
                        Spacer(modifier = Modifier.height(6.dp))
                        Text(
                            text = cameraUrl ?: telemetry?.cameraSource ?: "Đang dùng máy quay chuồng nuôi tự động",
                            style = MaterialTheme.typography.labelSmall,
                            color = FarmTextMutedLight,
                            maxLines = 1
                        )
                    }
                }
            }

            // Danh sách nhật ký hành động ghi nhận
            item {
                Text(
                    text = "Nhật Ký Hoạt Động Trong Chuồng",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = FarmForegroundLight
                )
            }

            if (actionLogs.isEmpty()) {
                item {
                    Card(
                        shape = RoundedCornerShape(14.dp),
                        colors = CardDefaults.cardColors(containerColor = Color.White),
                        border = androidx.compose.foundation.BorderStroke(1.dp, FarmCardBorderLight),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Box(modifier = Modifier.fillMaxWidth().padding(24.dp), contentAlignment = Alignment.Center) {
                            Text("Chưa có hành động nào được ghi nhận cho khu vực này.", fontSize = 12.sp, color = FarmTextMutedLight)
                        }
                    }
                }
            } else {
                items(actionLogs) { log ->
                    Card(
                        shape = RoundedCornerShape(16.dp),
                        colors = CardDefaults.cardColors(containerColor = Color.White),
                        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
                        border = androidx.compose.foundation.BorderStroke(1.dp, FarmCardBorderLight),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(14.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(10.dp),
                                modifier = Modifier.weight(1f)
                            ) {
                                Box(
                                    modifier = Modifier
                                        .size(36.dp)
                                        .clip(CircleShape)
                                        .background(FarmPrimary.copy(alpha = 0.12f)),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.MotionPhotosOn,
                                        contentDescription = null,
                                        tint = FarmPrimary,
                                        modifier = Modifier.size(20.dp)
                                    )
                                }

                                Column {
                                    Text(
                                        text = log.action,
                                        style = MaterialTheme.typography.bodyLarge,
                                        fontWeight = FontWeight.Bold,
                                        color = FarmForegroundLight
                                    )
                                    Text(
                                        text = "Độ tin cậy: ${(log.confidence * 100).toInt()}% • Khu: ${log.targetId.ifBlank { currentPenId }}",
                                        style = MaterialTheme.typography.labelSmall,
                                        color = FarmTextMutedLight
                                    )
                                }
                            }

                            Text(
                                text = log.time,
                                style = MaterialTheme.typography.labelSmall,
                                color = FarmTextMutedLight,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }
            }
        }
    }

    ConfigCameraDialog(
        isOpen = showConfigCameraDialog,
        penId = currentPenId,
        penName = penName,
        currentUrl = cameraUrl,
        currentWebcamUrl = webcamUrl,
        onDismiss = { showConfigCameraDialog = false },
        onConfirm = { newIp, newWebcam ->
            viewModel.updatePenCameras(currentPenId, newIp, newWebcam)
            streamKey = System.currentTimeMillis()
        }
    )
}
