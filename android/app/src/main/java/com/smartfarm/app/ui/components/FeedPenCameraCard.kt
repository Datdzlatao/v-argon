package com.smartfarm.app.ui.components

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
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
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.smartfarm.app.data.models.ActionLog
import com.smartfarm.app.data.models.ActionTelemetry
import com.smartfarm.app.data.remote.ApiConfig
import com.smartfarm.app.ui.theme.*
import java.net.URLEncoder

/**
 * Thẻ hiển thị Camera Giám Sát Chuồng Trại / Vườn Trồng AI (Port 8002)
 * Đồng bộ chuẩn kiến trúc với FeedPenCamera.tsx của Web Frontend
 */
@Composable
fun FeedPenCameraCard(
    currentPenId: String,
    penName: String,
    penCameraUrl: String,
    penWebcamUrl: String = "0",
    currentMode: String,
    telemetry: ActionTelemetry?,
    actionLogs: List<ActionLog>,
    onConfigureCamera: () -> Unit,
    onRefreshLogs: () -> Unit,
    onToggleCamera: (Boolean) -> Unit,
    modifier: Modifier = Modifier
) {
    val isLivestock = currentMode == "livestock"
    var isCameraActive by remember { mutableStateOf(false) }
    var streamKey by remember { mutableLongStateOf(System.currentTimeMillis()) }
    var streamDisplayMode by remember { mutableStateOf("ipcam") } // "ipcam" | "webcam" | "dual"

    // Cập nhật streamKey khi đổi chuồng hoặc đổi cameraUrl / webcamUrl
    LaunchedEffect(currentPenId, penCameraUrl, penWebcamUrl) {
        streamKey = System.currentTimeMillis()
    }

    val ipStreamUrl = remember(currentPenId, penCameraUrl, streamKey) {
        val target = if (currentPenId.isNotBlank()) currentPenId else "DEFAULT"
        val encTarget = try { URLEncoder.encode(target, "UTF-8") } catch (_: Exception) { target }
        val encSource = try { URLEncoder.encode(penCameraUrl, "UTF-8") } catch (_: Exception) { penCameraUrl }
        "${ApiConfig.actionWsUrl}/ws/video_feed?target_id=$encTarget&stream_type=ipcam&source=$encSource&t=$streamKey"
    }

    val webcamStreamUrl = remember(currentPenId, penWebcamUrl, streamKey) {
        val target = if (currentPenId.isNotBlank()) currentPenId else "DEFAULT"
        val encTarget = try { URLEncoder.encode(target, "UTF-8") } catch (_: Exception) { target }
        val encSource = try { URLEncoder.encode(if (penWebcamUrl.isNotBlank()) penWebcamUrl else "0", "UTF-8") } catch (_: Exception) { "0" }
        "${ApiConfig.actionWsUrl}/ws/video_feed?target_id=$encTarget&stream_type=webcam&source=$encSource&t=$streamKey"
    }

    val fsmState = telemetry?.fsmState ?: "IDLE"
    val (fsmBg, fsmText, fsmBorder) = when (fsmState) {
        "SUSPENDED" -> Triple(Color(0xFFFEF2F2), Color(0xFFB91C1C), Color(0xFFFCA5A5))
        "RESUMED" -> Triple(Color(0xFFFFFBEB), Color(0xFFB45309), Color(0xFFFDE68A))
        "TRIGGERED" -> Triple(Color(0xFFF3E8FF), Color(0xFF6B21A8), Color(0xFFD8B4FE))
        "COOLDOWN" -> Triple(Color(0xFFFFF7ED), Color(0xFFC2410C), Color(0xFFFDBA74))
        else -> Triple(Color(0xFFF1F5F9), Color(0xFF334155), Color(0xFFCBD5E1))
    }

    Card(
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
        border = BorderStroke(1.dp, FarmCardBorderLight),
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 6.dp)
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            // 1. HEADER POST
            Row(
                modifier = Modifier.fillMaxWidth(),
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
                            .size(42.dp)
                            .clip(RoundedCornerShape(14.dp))
                            .background(FarmPrimary),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.Videocam,
                            contentDescription = null,
                            tint = Color.White,
                            modifier = Modifier.size(24.dp)
                        )
                    }

                    Column {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            Text(
                                text = if (isLivestock) "Camera Chuồng Nuôi AI" else "Camera Vườn Trồng AI",
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Bold,
                                color = FarmForegroundLight
                            )
                            Surface(
                                shape = RoundedCornerShape(6.dp),
                                color = FarmPrimary.copy(alpha = 0.12f),
                                border = BorderStroke(1.dp, FarmPrimary.copy(alpha = 0.25f))
                            ) {
                                Text(
                                    text = penName,
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = FarmPrimary,
                                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                )
                            }
                        }

                        Text(
                            text = "IP: ${if (penCameraUrl.isNotBlank()) penCameraUrl else "8080"} • Web: ${if (penWebcamUrl.isNotBlank()) penWebcamUrl else "0"}",
                            fontSize = 10.sp,
                            fontFamily = FontFamily.Monospace,
                            color = FarmTextMutedLight,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                }

                // Controls
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    OutlinedButton(
                        onClick = onConfigureCamera,
                        shape = RoundedCornerShape(10.dp),
                        contentPadding = PaddingValues(horizontal = 8.dp, vertical = 4.dp),
                        modifier = Modifier.height(32.dp)
                    ) {
                        Icon(Icons.Default.Settings, contentDescription = "Cấu hình 2 Luồng Cam", modifier = Modifier.size(13.dp))
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("2 Luồng", fontSize = 10.sp, fontWeight = FontWeight.SemiBold)
                    }

                    Button(
                        onClick = {
                            val nextState = !isCameraActive
                            isCameraActive = nextState
                            if (nextState) {
                                streamKey = System.currentTimeMillis()
                            }
                            onToggleCamera(nextState)
                        },
                        colors = ButtonDefaults.buttonColors(
                            containerColor = if (isCameraActive) FarmDestructive else FarmPrimary
                        ),
                        shape = RoundedCornerShape(10.dp),
                        contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp),
                        modifier = Modifier.height(32.dp)
                    ) {
                        Icon(
                            imageVector = if (isCameraActive) Icons.Default.VideocamOff else Icons.Default.Videocam,
                            contentDescription = null,
                            modifier = Modifier.size(13.dp)
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            text = if (isCameraActive) "Tắt Cam" else "Bật Cam",
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            // STREAM SELECTOR CHIPS (IP Cam / Webcam / Cả 2 Luồng)
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                FilterChip(
                    selected = streamDisplayMode == "ipcam",
                    onClick = { streamDisplayMode = "ipcam" },
                    label = { Text("📱 IP Cam", fontSize = 10.sp, fontWeight = FontWeight.Bold) },
                    modifier = Modifier.weight(1f)
                )
                FilterChip(
                    selected = streamDisplayMode == "webcam",
                    onClick = { streamDisplayMode = "webcam" },
                    label = { Text("💻 Webcam", fontSize = 10.sp, fontWeight = FontWeight.Bold) },
                    modifier = Modifier.weight(1f)
                )
                FilterChip(
                    selected = streamDisplayMode == "dual",
                    onClick = { streamDisplayMode = "dual" },
                    label = { Text("👥 2 Luồng", fontSize = 10.sp, fontWeight = FontWeight.Bold) },
                    modifier = Modifier.weight(1f)
                )
            }

            Spacer(modifier = Modifier.height(8.dp))

            // 2. MAIN VIEWPORT
            if (isCameraActive) {
                if (streamDisplayMode == "dual") {
                    // DUAL STREAM MODE: Hiển thị cả 2 luồng
                    Column(
                        modifier = Modifier.fillMaxWidth(),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        // Stream 1: IP Camera Điện Thoại
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .aspectRatio(16f / 9f)
                                .clip(RoundedCornerShape(14.dp))
                                .background(Color.Black),
                            contentAlignment = Alignment.Center
                        ) {
                            WebSocketStreamPlayer(
                                streamUrl = ipStreamUrl,
                                isPlaying = isCameraActive,
                                onRetry = { streamKey = System.currentTimeMillis() },
                                modifier = Modifier.fillMaxSize(),
                                overlayContent = {
                                    Surface(
                                        shape = RoundedCornerShape(6.dp),
                                        color = Color.Black.copy(alpha = 0.75f),
                                        modifier = Modifier.padding(6.dp).align(Alignment.TopStart)
                                    ) {
                                        Text(
                                            text = "📱 IP Cam Điện Thoại",
                                            color = Color.White,
                                            fontSize = 9.sp,
                                            fontWeight = FontWeight.Bold,
                                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                        )
                                    }
                                }
                            )
                        }

                        // Stream 2: Webcam Máy Tính
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .aspectRatio(16f / 9f)
                                .clip(RoundedCornerShape(14.dp))
                                .background(Color.Black),
                            contentAlignment = Alignment.Center
                        ) {
                            WebSocketStreamPlayer(
                                streamUrl = webcamStreamUrl,
                                isPlaying = isCameraActive,
                                onRetry = { streamKey = System.currentTimeMillis() },
                                modifier = Modifier.fillMaxSize(),
                                overlayContent = {
                                    Surface(
                                        shape = RoundedCornerShape(6.dp),
                                        color = Color.Black.copy(alpha = 0.75f),
                                        modifier = Modifier.padding(6.dp).align(Alignment.TopStart)
                                    ) {
                                        Text(
                                            text = "💻 Webcam Máy Tính",
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
                    // SINGLE STREAM MODE (IP Cam hoặc Webcam)
                    val activeUrl = if (streamDisplayMode == "webcam") webcamStreamUrl else ipStreamUrl
                    val activeLabel = if (streamDisplayMode == "webcam") "💻 Webcam Máy Tính" else "📱 IP Cam Điện Thoại"
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .aspectRatio(16f / 9f)
                            .clip(RoundedCornerShape(16.dp))
                            .background(Color.Black),
                        contentAlignment = Alignment.Center
                    ) {
                        WebSocketStreamPlayer(
                            streamUrl = activeUrl,
                            isPlaying = isCameraActive,
                            onRetry = { streamKey = System.currentTimeMillis() },
                            modifier = Modifier.fillMaxSize(),
                            overlayContent = {
                                Surface(
                                    shape = RoundedCornerShape(6.dp),
                                    color = Color.Black.copy(alpha = 0.75f),
                                    modifier = Modifier.padding(8.dp).align(Alignment.TopStart)
                                ) {
                                    Row(
                                        verticalAlignment = Alignment.CenterVertically,
                                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 3.dp)
                                    ) {
                                        Box(
                                            modifier = Modifier.size(6.dp).clip(CircleShape).background(FarmSuccess)
                                        )
                                        Spacer(modifier = Modifier.width(4.dp))
                                        Text(
                                            text = "$penName • $activeLabel • ${if (fsmState != "IDLE") "[FSM: $fsmState]" else "LIVE"}",
                                            color = Color.White,
                                            fontSize = 9.sp,
                                            fontWeight = FontWeight.Bold
                                        )
                                    }
                                }

                                if (telemetry != null && telemetry.cooldownRemaining > 0) {
                                    Surface(
                                        shape = RoundedCornerShape(6.dp),
                                        color = Color(0xFF78350F).copy(alpha = 0.85f),
                                        modifier = Modifier.padding(8.dp).align(Alignment.TopEnd)
                                    ) {
                                        Row(
                                            verticalAlignment = Alignment.CenterVertically,
                                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 3.dp)
                                        ) {
                                            Icon(
                                                Icons.Default.AccessTime,
                                                contentDescription = null,
                                                tint = Color(0xFFFDE68A),
                                                modifier = Modifier.size(10.dp)
                                            )
                                            Spacer(modifier = Modifier.width(3.dp))
                                            Text(
                                                text = "Cooldown: ${telemetry.cooldownRemaining}s",
                                                color = Color(0xFFFDE68A),
                                                fontSize = 9.sp,
                                                fontFamily = FontFamily.Monospace,
                                                fontWeight = FontWeight.Bold
                                            )
                                        }
                                    }
                                }
                            }
                        )
                    }
                }
            } else {
                // Placeholder when camera is OFF
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .aspectRatio(16f / 9f)
                        .clip(RoundedCornerShape(16.dp))
                        .background(Color.Black),
                    contentAlignment = Alignment.Center
                ) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center,
                        modifier = Modifier.padding(16.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(48.dp)
                                .clip(RoundedCornerShape(14.dp))
                                .background(Color(0xFF1E293B)),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.Videocam,
                                contentDescription = null,
                                tint = Color.Gray,
                                modifier = Modifier.size(26.dp)
                            )
                        }
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = "Camera Chuồng $penName Đang Tắt",
                            color = Color.White,
                            fontWeight = FontWeight.Bold,
                            fontSize = 12.sp
                        )
                        Spacer(modifier = Modifier.height(2.dp))
                        Text(
                            text = "Hỗ trợ 2 luồng: IP Cam điện thoại & Webcam máy tính. Bật camera để AI tự động nhận diện.",
                            color = Color.White.copy(alpha = 0.6f),
                            fontSize = 10.sp,
                            textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                            modifier = Modifier.padding(horizontal = 16.dp)
                        )
                        Spacer(modifier = Modifier.height(10.dp))
                        Button(
                            onClick = {
                                isCameraActive = true
                                streamKey = System.currentTimeMillis()
                                onToggleCamera(true)
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = FarmPrimary),
                            shape = RoundedCornerShape(10.dp),
                            contentPadding = PaddingValues(horizontal = 14.dp, vertical = 6.dp)
                        ) {
                            Icon(Icons.Default.Videocam, contentDescription = null, modifier = Modifier.size(14.dp))
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("Bật Camera Khu Vực Này", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(10.dp))

            // 3. COMPACT CURRENT ACTION STATUS (Dựa trên nội dung API trả về)
            val rawAction = telemetry?.lastAction?.trim().orEmpty()
            val actionTitle = when {
                rawAction.equals("FEEDING", ignoreCase = true) -> "🍲 Đang thực hiện: Cho vật nuôi ăn"
                rawAction.equals("WATERING", ignoreCase = true) -> "💧 Đang thực hiện: Tưới nước"
                rawAction.equals("FERTILIZING", ignoreCase = true) -> "🌱 Đang thực hiện: Bón phân"
                rawAction.equals("AI Analyzing...", ignoreCase = true) -> "🤖 Đang phân tích hành động bằng AI..."
                rawAction.isBlank() || rawAction.equals("None", ignoreCase = true) || rawAction == "Bình thường" -> {
                    when (fsmState) {
                        "TRIGGERED" -> "⚡ Phát hiện thao tác — đang xác thực AI..."
                        "RESUMED" -> if (telemetry?.isBending == true) "👀 Phát hiện người đang cúi thao tác..." else "👀 Đang theo dõi thao tác..."
                        "COOLDOWN" -> "⏳ Vừa hoàn tất thao tác (${telemetry?.cooldownRemaining?.toInt() ?: 0}s)"
                        else -> "👀 Đang giám sát (Chưa phát hiện hành động)"
                    }
                }
                else -> "🎬 Hành động: $rawAction"
            }
            val actionReason = telemetry?.lastActionReason?.takeIf { it.isNotBlank() }

            Surface(
                shape = RoundedCornerShape(12.dp),
                color = FarmPrimary.copy(alpha = 0.08f),
                border = BorderStroke(1.dp, FarmPrimary.copy(alpha = 0.22f)),
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
                            text = actionTitle,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            color = FarmPrimary,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                        if (actionReason != null) {
                            Spacer(modifier = Modifier.height(2.dp))
                            Text(
                                text = actionReason,
                                fontSize = 11.sp,
                                color = FarmForegroundLight.copy(alpha = 0.8f),
                                maxLines = 2,
                                overflow = TextOverflow.Ellipsis
                            )
                        }
                    }
                }
            }

            // 4. RECENT ACTION LOGS
            Spacer(modifier = Modifier.height(10.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    Icon(Icons.Default.History, contentDescription = null, tint = FarmPrimary, modifier = Modifier.size(14.dp))
                    Text(
                        text = "Lịch Sử Hành Động Ghi Nhận Tại $penName",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = FarmForegroundLight
                    )
                }

                IconButton(onClick = onRefreshLogs, modifier = Modifier.size(24.dp)) {
                    Icon(Icons.Default.Refresh, contentDescription = "Làm mới logs", tint = FarmTextMutedLight, modifier = Modifier.size(14.dp))
                }
            }

            Spacer(modifier = Modifier.height(4.dp))

            if (actionLogs.isEmpty()) {
                Text(
                    text = "Chưa có hành động nào được ghi nhận gần đây cho $penName.",
                    fontSize = 10.sp,
                    color = FarmTextMutedLight,
                    modifier = Modifier.padding(vertical = 4.dp)
                )
            } else {
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    actionLogs.take(3).forEach { log ->
                        Surface(
                            shape = RoundedCornerShape(8.dp),
                            color = FarmBackgroundLight,
                            border = BorderStroke(1.dp, FarmCardBorderLight),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(horizontal = 8.dp, vertical = 6.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                    Box(
                                        modifier = Modifier
                                            .size(6.dp)
                                            .clip(CircleShape)
                                            .background(FarmPrimary)
                                    )
                                    Text(
                                        text = log.action,
                                        fontSize = 10.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = FarmForegroundLight
                                    )
                                }
                                Text(
                                    text = log.time,
                                    fontSize = 9.sp,
                                    fontFamily = FontFamily.Monospace,
                                    color = FarmTextMutedLight
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}
