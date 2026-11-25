package com.smartfarm.app.ui.components

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
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
import com.smartfarm.app.ui.theme.*

@Composable
fun EmergencyAlertBanner(
    penName: String,
    penId: String,
    issues: List<String>,
    temp: Double,
    smell: Double,
    currentMode: String,
    onActivateFan: () -> Unit,
    onAskAI: () -> Unit,
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier
) {
    AnimatedVisibility(
        visible = issues.isNotEmpty(),
        enter = fadeIn(),
        exit = fadeOut()
    ) {
        Card(
            shape = RoundedCornerShape(20.dp),
            colors = CardDefaults.cardColors(containerColor = Color.White),
            elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
            modifier = modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 6.dp)
                .border(1.5.dp, FarmDestructive, RoundedCornerShape(20.dp))
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp)
            ) {
                // Tiêu đề cảnh báo
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
                                .size(36.dp)
                                .clip(CircleShape)
                                .background(FarmDestructive.copy(alpha = 0.12f)),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.Shield,
                                contentDescription = "Biểu tượng cảnh báo",
                                tint = FarmDestructive,
                                modifier = Modifier.size(20.dp)
                            )
                        }

                        Column {
                            Text(
                                text = "BÁO ĐỘNG KHẨN CẤP",
                                style = MaterialTheme.typography.labelLarge,
                                fontWeight = FontWeight.Bold,
                                color = FarmDestructive,
                                fontSize = 12.sp
                            )
                            Text(
                                text = "Khu vực: $penName ($penId)",
                                style = MaterialTheme.typography.labelSmall,
                                color = FarmTextMutedLight
                            )
                        }
                    }

                    IconButton(
                        onClick = onDismiss,
                        modifier = Modifier.size(28.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Close,
                            contentDescription = "Đóng cảnh báo",
                            tint = FarmTextMutedLight,
                            modifier = Modifier.size(18.dp)
                        )
                    }
                }

                Spacer(modifier = Modifier.height(10.dp))

                // Danh sách vấn đề phát hiện
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .background(FarmDestructive.copy(alpha = 0.06f))
                        .padding(12.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    issues.forEach { issue ->
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                imageVector = Icons.Default.Warning,
                                contentDescription = null,
                                tint = FarmDestructive,
                                modifier = Modifier.size(16.dp)
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                text = issue,
                                style = MaterialTheme.typography.bodyMedium,
                                fontWeight = FontWeight.SemiBold,
                                color = FarmDestructive,
                                fontSize = 12.sp
                            )
                        }
                    }

                    HorizontalDivider(color = FarmDestructive.copy(alpha = 0.2f), modifier = Modifier.padding(vertical = 4.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(
                            text = "Nhiệt độ hiện tại: ${temp}°C",
                            style = MaterialTheme.typography.labelSmall,
                            color = FarmDestructive
                        )
                        Text(
                            text = if (currentMode == "livestock") "Chỉ số mùi chuồng: ${smell.toInt()}" else "Độ ẩm đất: ${smell.toInt()}%",
                            style = MaterialTheme.typography.labelSmall,
                            color = FarmDestructive
                        )
                    }
                }

                Spacer(modifier = Modifier.height(12.dp))

                // Các nút xử lý nhanh
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Button(
                        onClick = onActivateFan,
                        colors = ButtonDefaults.buttonColors(containerColor = FarmDestructive),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.weight(1.2f)
                    ) {
                        Icon(Icons.Default.Air, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("Bật Quạt Thông Gió", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    }

                    OutlinedButton(
                        onClick = onAskAI,
                        shape = RoundedCornerShape(12.dp),
                        border = androidx.compose.foundation.BorderStroke(1.dp, FarmDestructive),
                        modifier = Modifier.weight(1f)
                    ) {
                        Icon(Icons.Default.SupportAgent, contentDescription = null, tint = FarmDestructive, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("Hỏi Trợ Lý", fontSize = 12.sp, color = FarmDestructive, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}
