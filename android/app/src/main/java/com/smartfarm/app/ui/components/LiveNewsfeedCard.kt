package com.smartfarm.app.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.smartfarm.app.data.models.NewsfeedItem
import com.smartfarm.app.ui.theme.*

@Composable
fun LiveNewsfeedCard(
    items: List<NewsfeedItem>,
    isLoading: Boolean,
    onRefresh: () -> Unit,
    onQuickAction: (NewsfeedItem) -> Unit,
    modifier: Modifier = Modifier
) {
    Card(
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
        border = BorderStroke(1.dp, FarmCardBorderLight),
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 6.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
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
                            .size(40.dp)
                            .clip(RoundedCornerShape(12.dp))
                            .background(FarmPrimary.copy(alpha = 0.12f)),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.Sensors,
                            contentDescription = "Quan sát trực tiếp",
                            tint = FarmPrimary,
                            modifier = Modifier.size(22.dp)
                        )
                    }
                    Column {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            Text(
                                text = "Bản Tin Quan Sát Trực Tiếp",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold,
                                color = FarmForegroundLight
                            )
                            Surface(
                                shape = RoundedCornerShape(999.dp),
                                color = FarmPrimary.copy(alpha = 0.12f)
                            ) {
                                Text(
                                    text = "LIVE",
                                    fontSize = 9.sp,
                                    fontWeight = FontWeight.ExtraBold,
                                    color = FarmPrimary,
                                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                )
                            }
                        }
                        Text(
                            text = "Backend theo dõi 24/7 • Lối tắt xử lý nhanh",
                            style = MaterialTheme.typography.labelSmall,
                            color = FarmTextMutedLight
                        )
                    }
                }

                IconButton(
                    onClick = onRefresh,
                    enabled = !isLoading
                ) {
                    if (isLoading) {
                        CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp, color = FarmPrimary)
                    } else {
                        Icon(Icons.Default.Refresh, contentDescription = "Cập nhật bản tin", tint = FarmPrimary)
                    }
                }
            }

            if (items.isEmpty()) {
                Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = FarmPrimary.copy(alpha = 0.06f),
                    border = BorderStroke(1.dp, FarmPrimary.copy(alpha = 0.2f)),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier.padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Icon(Icons.Default.CheckCircle, contentDescription = null, tint = FarmPrimary, modifier = Modifier.size(18.dp))
                        Text(
                            text = "Hệ thống quan sát chưa ghi nhận cảnh báo mới. Trang trại đang ổn định!",
                            fontSize = 12.sp,
                            color = FarmForegroundLight
                        )
                    }
                }
            } else {
                items.take(5).forEach { item ->
                    val isCritical = item.severity == "critical"
                    val isWarning = item.severity == "warning"
                    val bgColor = when {
                        isCritical -> Color(0xFFFEF2F2)
                        isWarning -> Color(0xFFFFFBEB)
                        else -> Color(0xFFF8FAFC)
                    }
                    val borderColor = when {
                        isCritical -> Color(0xFFFECACA)
                        isWarning -> Color(0xFFFDE68A)
                        else -> Color(0xFFE2E8F0)
                    }
                    val accentColor = when {
                        isCritical -> Color(0xFFDC2626)
                        isWarning -> Color(0xFFD97706)
                        else -> FarmPrimary
                    }

                    Surface(
                        shape = RoundedCornerShape(14.dp),
                        color = bgColor,
                        border = BorderStroke(1.dp, borderColor),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(
                            modifier = Modifier.padding(12.dp),
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(6.dp)
                            ) {
                                Icon(
                                    imageVector = if (isCritical) Icons.Default.Warning else Icons.Default.NotificationsActive,
                                    contentDescription = null,
                                    tint = accentColor,
                                    modifier = Modifier.size(16.dp)
                                )
                                Text(
                                    text = item.title,
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = FarmForegroundLight,
                                    modifier = Modifier.weight(1f)
                                )
                            }

                            Text(
                                text = item.summary,
                                fontSize = 12.sp,
                                lineHeight = 16.sp,
                                color = Color(0xFF334155)
                            )

                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.End
                            ) {
                                Button(
                                    onClick = { onQuickAction(item) },
                                    shape = RoundedCornerShape(10.dp),
                                    colors = ButtonDefaults.buttonColors(containerColor = accentColor),
                                    contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp),
                                    modifier = Modifier.height(34.dp)
                                ) {
                                    Icon(
                                        imageVector = if (item.quickDeviceType != null) Icons.Default.Bolt else Icons.Default.ArrowForward,
                                        contentDescription = null,
                                        modifier = Modifier.size(14.dp)
                                    )
                                    Spacer(modifier = Modifier.width(4.dp))
                                    Text(
                                        text = item.actionLabel,
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.Bold
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
