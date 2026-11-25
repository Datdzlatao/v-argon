package com.smartfarm.app.ui.components

import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.smartfarm.app.data.models.Pen
import com.smartfarm.app.ui.theme.*

@Composable
fun PenStoriesCarousel(
    pens: List<Pen>,
    currentPenId: String,
    onSelectPen: (String) -> Unit,
    onOpenAddPenModal: () -> Unit,
    onDeletePen: ((String) -> Unit)? = null,
    modifier: Modifier = Modifier
) {
    var penToDelete by remember { mutableStateOf<Pen?>(null) }

    if (penToDelete != null) {
        AlertDialog(
            onDismissRequest = { penToDelete = null },
            title = { Text("Xác Nhận Xóa Phân Khu") },
            text = { Text("Bạn có chắc chắn muốn xóa phân khu \"${penToDelete?.name}\" (Mã: ${penToDelete?.id}) khỏi hệ thống?") },
            confirmButton = {
                Button(
                    onClick = {
                        penToDelete?.let { onDeletePen?.invoke(it.id) }
                        penToDelete = null
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = FarmDestructive)
                ) {
                    Text("Xóa Ngay")
                }
            },
            dismissButton = {
                TextButton(onClick = { penToDelete = null }) {
                    Text("Hủy")
                }
            }
        )
    }
    LazyRow(
        modifier = modifier.fillMaxWidth(),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 6.dp),
        horizontalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        // Thẻ đầu tiên: Thêm Chuồng / Khu Mới
        item {
            Card(
                shape = RoundedCornerShape(18.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
                border = androidx.compose.foundation.BorderStroke(1.5.dp, FarmCardBorderLight),
                modifier = Modifier
                    .width(115.dp)
                    .height(135.dp)
                    .clickable { onOpenAddPenModal() }
            ) {
                Column(
                    modifier = Modifier.fillMaxSize().padding(10.dp),
                    verticalArrangement = Arrangement.Center,
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Box(
                        modifier = Modifier
                            .size(38.dp)
                            .clip(CircleShape)
                            .background(FarmPrimary.copy(alpha = 0.12f)),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.Add,
                            contentDescription = "Thêm chuồng mới",
                            tint = FarmPrimary,
                            modifier = Modifier.size(22.dp)
                        )
                    }

                    Spacer(modifier = Modifier.height(10.dp))

                    Text(
                        text = "Thêm Khu Vực",
                        style = MaterialTheme.typography.labelLarge,
                        fontSize = 11.sp,
                        color = FarmForegroundLight,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "Tạo chuồng mới",
                        style = MaterialTheme.typography.labelSmall,
                        fontSize = 9.sp,
                        color = FarmTextMutedLight
                    )
                }
            }
        }

        // Danh sách thẻ các chuồng nuôi / vườn trồng
        items(pens, key = { it.id }) { pen ->
            val isSelected = pen.id == currentPenId
            val hasAlert = pen.hasAlert

            val infiniteTransition = rememberInfiniteTransition(label = "pulse")
            val pulseAlpha by infiniteTransition.animateFloat(
                initialValue = 0.4f,
                targetValue = 1.0f,
                animationSpec = infiniteRepeatable(
                    animation = tween(800, easing = FastOutSlowInEasing),
                    repeatMode = RepeatMode.Reverse
                ),
                label = "alpha"
            )

            Card(
                shape = RoundedCornerShape(18.dp),
                colors = CardDefaults.cardColors(
                    containerColor = if (isSelected) FarmPrimary.copy(alpha = 0.05f) else Color.White
                ),
                elevation = CardDefaults.cardElevation(defaultElevation = if (isSelected) 2.dp else 1.dp),
                modifier = Modifier
                    .width(120.dp)
                    .height(135.dp)
                    .border(
                        width = if (isSelected || hasAlert) 2.dp else 1.dp,
                        color = if (hasAlert) FarmDestructive.copy(alpha = pulseAlpha) else if (isSelected) FarmPrimary else FarmCardBorderLight,
                        shape = RoundedCornerShape(18.dp)
                    )
                    .clickable { onSelectPen(pen.id) }
            ) {
                Column(
                    modifier = Modifier.fillMaxSize().padding(10.dp),
                    verticalArrangement = Arrangement.SpaceBetween
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Box(
                            modifier = Modifier
                                .size(32.dp)
                                .clip(CircleShape)
                                .background(FarmMutedLight),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = if (pen.type == "cultivation" || pen.type == "crops") "🌿" else "🐖",
                                fontSize = 16.sp
                            )
                        }

                        if (hasAlert) {
                            Box(
                                modifier = Modifier
                                    .size(20.dp)
                                    .clip(CircleShape)
                                    .background(FarmDestructive),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Warning,
                                    contentDescription = "Báo động",
                                    tint = Color.White,
                                    modifier = Modifier.size(12.dp)
                                )
                            }
                        } else if (isSelected) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                if (onDeletePen != null && pens.size > 1) {
                                    IconButton(
                                        onClick = { penToDelete = pen },
                                        modifier = Modifier.size(22.dp)
                                    ) {
                                        Icon(
                                            imageVector = Icons.Default.Delete,
                                            contentDescription = "Xóa phân khu",
                                            tint = FarmDestructive,
                                            modifier = Modifier.size(14.dp)
                                        )
                                    }
                                }
                                Box(
                                    modifier = Modifier
                                        .size(20.dp)
                                        .clip(CircleShape)
                                        .background(FarmPrimary),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.Check,
                                        contentDescription = "Đang chọn",
                                        tint = Color.White,
                                        modifier = Modifier.size(12.dp)
                                    )
                                }
                            }
                        }
                    }

                    Column {
                        Text(
                            text = pen.name,
                            style = MaterialTheme.typography.labelLarge,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            color = if (isSelected) FarmPrimary else FarmForegroundLight,
                            maxLines = 2,
                            overflow = TextOverflow.Ellipsis
                        )
                        Spacer(modifier = Modifier.height(2.dp))
                        Text(
                            text = "Mã: ${pen.id}",
                            style = MaterialTheme.typography.labelSmall,
                            fontSize = 9.sp,
                            color = FarmTextMutedLight
                        )
                    }
                }
            }
        }
    }
}
