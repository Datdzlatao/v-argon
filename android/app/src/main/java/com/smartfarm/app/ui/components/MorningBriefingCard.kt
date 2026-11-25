package com.smartfarm.app.ui.components

import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.ThumbUp
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.smartfarm.app.data.models.DailyBriefing
import com.smartfarm.app.ui.theme.*

@Composable
fun MorningBriefingCard(
    briefing: DailyBriefing?,
    isLoading: Boolean,
    onRefresh: () -> Unit,
    onOpenChat: () -> Unit,
    currentMode: String,
    modifier: Modifier = Modifier
) {
    var isLiked by remember { mutableStateOf(false) }
    var likeCount by remember { mutableIntStateOf(14) }

    val rotation = rememberInfiniteTransition(label = "spin")
    val angle by rotation.animateFloat(
        initialValue = 0f,
        targetValue = 360f,
        animationSpec = infiniteRepeatable(
            animation = tween(1000, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "angle"
    )

    Card(
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
        border = androidx.compose.foundation.BorderStroke(1.dp, FarmCardBorderLight),
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 6.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp)
        ) {
            // Tiêu đề & Nút làm mới
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .size(42.dp)
                            .clip(RoundedCornerShape(14.dp))
                            .background(FarmPrimary.copy(alpha = 0.12f)),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.SupportAgent,
                            contentDescription = "Trợ lý",
                            tint = FarmPrimary,
                            modifier = Modifier.size(24.dp)
                        )
                    }

                    Column {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                            Text(
                                text = "Bản Tin Sáng Thông Minh",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold,
                                color = FarmForegroundLight
                            )
                            Icon(
                                imageVector = Icons.Default.CheckCircle,
                                contentDescription = "Đã xác thực",
                                tint = FarmPrimary,
                                modifier = Modifier.size(16.dp)
                            )
                        }
                        Text(
                            text = "07:00 Sáng • ${if (currentMode == "livestock") "Khu Chăn Nuôi" else "Khu Trồng Trọt"}",
                            style = MaterialTheme.typography.labelSmall,
                            color = FarmTextMutedLight
                        )
                    }
                }

                Button(
                    onClick = onRefresh,
                    enabled = !isLoading,
                    shape = RoundedCornerShape(10.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = FarmPrimary),
                    contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.Refresh,
                        contentDescription = "Làm mới",
                        modifier = Modifier
                            .size(16.dp)
                            .then(if (isLoading) Modifier.rotate(angle) else Modifier)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(if (isLoading) "Đang đọc..." else "Làm Mới", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Nội dung tóm tắt
            Surface(
                shape = RoundedCornerShape(14.dp),
                color = FarmMutedLight,
                border = androidx.compose.foundation.BorderStroke(1.dp, FarmCardBorderLight),
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(
                    text = briefing?.content
                        ?: "Hệ thống đang kiểm tra cảm biến chuồng trại và cập nhật lịch chăn nuôi. Bấm 'Làm Mới' để xem bản tin tổng hợp hôm nay.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = FarmForegroundLight,
                    lineHeight = 22.sp,
                    modifier = Modifier.padding(14.dp)
                )
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Thống kê nhanh
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                StatChip(
                    label = "2 việc cần xử lý",
                    color = FarmInfo,
                    modifier = Modifier.weight(1f)
                )
                StatChip(
                    label = "1 vật tư cần thêm",
                    color = FarmWarning,
                    modifier = Modifier.weight(1f)
                )
                StatChip(
                    label = "1 cá thể theo dõi",
                    color = FarmDestructive,
                    modifier = Modifier.weight(1f)
                )
            }

            HorizontalDivider(modifier = Modifier.padding(vertical = 12.dp), color = FarmCardBorderLight)

            // Nút hữu ích & Hỏi đáp trợ lý
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier
                        .clip(RoundedCornerShape(10.dp))
                        .clickable {
                            isLiked = !isLiked
                            likeCount = if (isLiked) likeCount + 1 else likeCount - 1
                        }
                        .padding(horizontal = 8.dp, vertical = 4.dp)
                ) {
                    Icon(
                        imageVector = if (isLiked) Icons.Default.ThumbUp else Icons.Outlined.ThumbUp,
                        contentDescription = "Hữu ích",
                        tint = if (isLiked) FarmPrimary else FarmTextMutedLight,
                        modifier = Modifier.size(18.dp)
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = "$likeCount Thích",
                        style = MaterialTheme.typography.labelSmall,
                        color = if (isLiked) FarmPrimary else FarmTextMutedLight
                    )
                }

                Button(
                    onClick = onOpenChat,
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = FarmPrimary),
                    contentPadding = PaddingValues(horizontal = 14.dp, vertical = 6.dp)
                ) {
                    Icon(Icons.Default.SupportAgent, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Trò Chuyện Với Trợ Lý", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

@Composable
fun StatChip(label: String, color: Color, modifier: Modifier = Modifier) {
    Surface(
        shape = RoundedCornerShape(8.dp),
        color = color.copy(alpha = 0.08f),
        border = androidx.compose.foundation.BorderStroke(1.dp, color.copy(alpha = 0.25f)),
        modifier = modifier
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            color = color,
            fontWeight = FontWeight.Bold,
            fontSize = 9.sp,
            maxLines = 1,
            modifier = Modifier.padding(horizontal = 6.dp, vertical = 5.dp)
        )
    }
}
