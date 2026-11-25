package com.smartfarm.app.ui.components

import androidx.compose.foundation.background
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
import com.smartfarm.app.data.models.Device
import com.smartfarm.app.ui.theme.*

@Composable
fun DeviceControlCard(
    devices: List<Device>,
    penName: String,
    onToggleDevice: (Device) -> Unit,
    onDeleteDevice: (Device) -> Unit,
    onOpenAddDevice: () -> Unit,
    modifier: Modifier = Modifier
) {
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
            // Tiêu đề khối
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
                            .background(FarmPrimary.copy(alpha = 0.12f)),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.Power,
                            contentDescription = null,
                            tint = FarmPrimary,
                            modifier = Modifier.size(20.dp)
                        )
                    }

                    Column {
                        Text(
                            text = "Thiết Bị Điện Tự Động",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                            color = FarmForegroundLight
                        )
                        Text(
                            text = "Khu vực: $penName (${devices.size} thiết bị)",
                            style = MaterialTheme.typography.labelSmall,
                            color = FarmTextMutedLight
                        )
                    }
                }

                Button(
                    onClick = onOpenAddDevice,
                    shape = RoundedCornerShape(10.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = FarmPrimary),
                    contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp)
                ) {
                    Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("Thêm Mới", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            if (devices.isEmpty()) {
                Surface(
                    shape = RoundedCornerShape(14.dp),
                    color = FarmMutedLight,
                    border = androidx.compose.foundation.BorderStroke(1.dp, FarmCardBorderLight),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(
                        text = "Chưa có thiết bị nào trong khu vực này. Bấm nút 'Thêm Mới' ở trên để kết nối quạt thông gió, máy bơm nước hoặc đèn sưởi ấm.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = FarmTextMutedLight,
                        fontSize = 12.sp,
                        modifier = Modifier.padding(14.dp)
                    )
                }
            } else {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    devices.forEach { device ->
                        DeviceRowItem(
                            device = device,
                            onToggle = { onToggleDevice(device) },
                            onDelete = { onDeleteDevice(device) }
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun DeviceRowItem(
    device: Device,
    onToggle: () -> Unit,
    onDelete: () -> Unit
) {
    val nameLower = device.name.lowercase()
    val icon = when {
        nameLower.contains("quạt") || nameLower.contains("fan") -> Icons.Default.Air
        nameLower.contains("phun") || nameLower.contains("bơm") || nameLower.contains("tưới") || nameLower.contains("nước") -> Icons.Default.WaterDrop
        nameLower.contains("đèn") || nameLower.contains("sưởi") -> Icons.Default.WbSunny
        else -> Icons.Default.ToggleOn
    }

    Surface(
        shape = RoundedCornerShape(16.dp),
        color = if (device.isActive) Color.White else FarmMutedLight,
        border = androidx.compose.foundation.BorderStroke(
            1.dp,
            if (device.isActive) FarmPrimary else FarmCardBorderLight
        ),
        shadowElevation = if (device.isActive) 1.dp else 0.dp,
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 14.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                modifier = Modifier.weight(1f)
            ) {
                Box(
                    modifier = Modifier
                        .size(40.dp)
                        .clip(CircleShape)
                        .background(if (device.isActive) FarmPrimary else FarmCardBorderLight),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = icon,
                        contentDescription = null,
                        tint = if (device.isActive) Color.White else FarmTextMutedLight,
                        modifier = Modifier.size(22.dp)
                    )
                }

                Column {
                    Text(
                        text = device.name,
                        style = MaterialTheme.typography.bodyLarge,
                        fontWeight = FontWeight.Bold,
                        color = FarmForegroundLight,
                        fontSize = 14.sp
                    )
                    Text(
                        text = "GPIO ${device.pinNumber ?: "--"} • ${if (device.isActive) "Đang BẬT" else "Đang TẮT"}",
                        style = MaterialTheme.typography.labelSmall,
                        color = if (device.isActive) FarmPrimary else FarmTextMutedLight,
                        fontSize = 11.sp
                    )
                }
            }

            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Switch(
                    checked = device.isActive,
                    onCheckedChange = { onToggle() },
                    colors = SwitchDefaults.colors(
                        checkedThumbColor = Color.White,
                        checkedTrackColor = FarmPrimary,
                        uncheckedThumbColor = Color.White,
                        uncheckedTrackColor = FarmCardBorderLight
                    )
                )

                IconButton(
                    onClick = onDelete,
                    modifier = Modifier.size(32.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.DeleteOutline,
                        contentDescription = "Xóa thiết bị",
                        tint = FarmDestructive,
                        modifier = Modifier.size(18.dp)
                    )
                }
            }
        }
    }
}
