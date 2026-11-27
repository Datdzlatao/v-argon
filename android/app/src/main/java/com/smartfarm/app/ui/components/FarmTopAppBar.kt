package com.smartfarm.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
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
import com.smartfarm.app.ui.theme.*

@Composable
fun FarmTopAppBar(
    currentMode: String,
    onModeChange: (String) -> Unit,
    wsConnected: Boolean,
    unreadAlertsCount: Int,
    isMuted: Boolean,
    onToggleMute: () -> Unit,
    userEmail: String?,
    onLogout: () -> Unit,
    onOpenExtendedModules: () -> Unit = {}
) {
    var showMenu by remember { mutableStateOf(false) }

    Surface(
        color = Color.White,
        shadowElevation = 2.dp,
        border = androidx.compose.foundation.BorderStroke(1.dp, FarmCardBorderLight),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .statusBarsPadding()
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                // Bên trái: Biểu tượng & Tên trang trại
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .size(38.dp)
                            .clip(CircleShape)
                            .background(FarmPrimary),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.Agriculture,
                            contentDescription = "Biểu tượng nông trại",
                            tint = Color.White,
                            modifier = Modifier.size(22.dp)
                        )
                    }

                    Column {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            Text(
                                text = "V-ARGON",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.ExtraBold,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                                color = FarmForegroundLight
                            )
                            // Đèn báo kết nối hệ thống
                            Box(
                                modifier = Modifier
                                    .size(8.dp)
                                    .clip(CircleShape)
                                    .background(if (wsConnected) FarmSuccess else FarmWarning)
                            )
                        }
                        Text(
                            text = if (currentMode == "livestock") "Khu Vực Chăn Nuôi" else "Khu Vực Trồng Trọt",
                            style = MaterialTheme.typography.labelSmall,
                            color = FarmTextMutedLight
                        )
                    }
                }

                // Bên phải: Các nút thao tác
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    // Nút mở Quản Lý Chung (Thu Chi, Office, Nhân Sự, QR, Giá)
                    IconButton(
                        onClick = onOpenExtendedModules,
                        modifier = Modifier
                            .size(38.dp)
                            .clip(CircleShape)
                            .background(FarmPrimary.copy(alpha = 0.10f))
                    ) {
                        Icon(
                            imageVector = Icons.Default.WorkOutline,
                            contentDescription = "Quản Lý Chung",
                            tint = FarmPrimary,
                            modifier = Modifier.size(20.dp)
                        )
                    }
                    // Nút tắt/bật chuông cảnh báo
                    IconButton(
                        onClick = onToggleMute,
                        modifier = Modifier
                            .size(38.dp)
                            .clip(CircleShape)
                            .background(FarmMutedLight)
                    ) {
                        Icon(
                            imageVector = if (isMuted) Icons.Default.VolumeOff else Icons.Default.VolumeUp,
                            contentDescription = if (isMuted) "Bật âm thanh" else "Tắt âm thanh",
                            tint = if (isMuted) FarmWarning else FarmPrimary,
                            modifier = Modifier.size(20.dp)
                        )
                    }

                    // Nút thông báo cảnh báo
                    Box {
                        IconButton(
                            onClick = onToggleMute,
                            modifier = Modifier
                                .size(38.dp)
                                .clip(CircleShape)
                                .background(FarmMutedLight)
                        ) {
                            Icon(
                                imageVector = Icons.Outlined.Notifications,
                                contentDescription = "Thông báo cảnh báo",
                                tint = FarmForegroundLight,
                                modifier = Modifier.size(20.dp)
                            )
                        }
                        if (unreadAlertsCount > 0) {
                            Badge(
                                modifier = Modifier.align(Alignment.TopEnd),
                                containerColor = FarmDestructive
                            ) {
                                Text("$unreadAlertsCount", fontSize = 10.sp, color = Color.White)
                            }
                        }
                    }

                    // Menu tài khoản người dùng
                    Box {
                        IconButton(
                            onClick = { showMenu = true },
                            modifier = Modifier
                                .size(38.dp)
                                .clip(CircleShape)
                                .background(FarmPrimary)
                        ) {
                            Text(
                                text = userEmail?.firstOrNull()?.uppercase() ?: "B",
                                fontWeight = FontWeight.Bold,
                                color = Color.White,
                                fontSize = 15.sp
                            )
                        }

                        DropdownMenu(
                            expanded = showMenu,
                            onDismissRequest = { showMenu = false }
                        ) {
                            DropdownMenuItem(
                                text = { Text(userEmail ?: "Chủ trang trại") },
                                onClick = { showMenu = false },
                                leadingIcon = { Icon(Icons.Default.Person, contentDescription = null) }
                            )
                            HorizontalDivider()
                            DropdownMenuItem(
                                text = { Text("Đăng Xuất Khỏi Tài Khoản", color = FarmDestructive) },
                                onClick = {
                                    showMenu = false
                                    onLogout()
                                },
                                leadingIcon = {
                                    Icon(Icons.Default.ExitToApp, contentDescription = null, tint = FarmDestructive)
                                }
                            )
                        }
                    }
                }
            }

            // Thanh chọn Chăn Nuôi / Trồng Trọt
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 6.dp),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                ModeChip(
                    title = "Chăn Nuôi",
                    icon = "🐖",
                    isSelected = currentMode == "livestock",
                    onClick = { onModeChange("livestock") },
                    modifier = Modifier.weight(1f)
                )

                ModeChip(
                    title = "Trồng Trọt",
                    icon = "🌿",
                    isSelected = currentMode == "cultivation",
                    onClick = { onModeChange("cultivation") },
                    modifier = Modifier.weight(1f)
                )
            }
            Spacer(modifier = Modifier.height(6.dp))
        }
    }
}

@Composable
fun ModeChip(
    title: String,
    icon: String,
    isSelected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Surface(
        onClick = onClick,
        shape = RoundedCornerShape(12.dp),
        color = if (isSelected) Color.White else FarmMutedLight,
        border = androidx.compose.foundation.BorderStroke(
            width = if (isSelected) 1.5.dp else 1.dp,
            color = if (isSelected) FarmPrimary else FarmCardBorderLight
        ),
        shadowElevation = if (isSelected) 2.dp else 0.dp,
        modifier = modifier.height(42.dp)
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.Center,
            modifier = Modifier.fillMaxSize()
        ) {
            Text(text = icon, fontSize = 16.sp)
            Spacer(modifier = Modifier.width(6.dp))
            Text(
                text = title,
                style = MaterialTheme.typography.labelLarge,
                maxLines = 1,
                softWrap = false,
                overflow = TextOverflow.Ellipsis,
                fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                color = if (isSelected) FarmPrimary else FarmTextMutedLight
            )
        }
    }
}
