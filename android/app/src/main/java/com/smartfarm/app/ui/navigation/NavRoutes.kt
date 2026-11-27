package com.smartfarm.app.ui.navigation

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.ui.graphics.vector.ImageVector

sealed class Screen(val route: String, val title: String, val icon: ImageVector) {
    object Home : Screen("home", "Trang Chủ", Icons.Default.Dashboard)
    object LivestockCrops : Screen("livestock_crops", "Nuôi Trồng", Icons.Default.Pets)
    object Attendance : Screen("attendance", "Ra Vào", Icons.Default.History)
    object CameraAction : Screen("camera", "Máy Quay", Icons.Default.Videocam)
    object Inventory : Screen("inventory", "Kho Vật Tư", Icons.Default.Inventory2)
    object ExtendedModules : Screen("extended_modules", "Quản Lý", Icons.Default.WorkOutline)
    object AIChat : Screen("ai_chat", "Trợ Lý", Icons.Default.SupportAgent)
    object Auth : Screen("auth", "Đăng Nhập", Icons.Default.Lock)
}
