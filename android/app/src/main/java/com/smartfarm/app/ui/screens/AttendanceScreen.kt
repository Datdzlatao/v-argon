package com.smartfarm.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
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
import com.smartfarm.app.data.models.AttendanceRecord
import com.smartfarm.app.data.models.Staff
import com.smartfarm.app.ui.theme.*
import com.smartfarm.app.ui.viewmodel.FarmViewModel

/**
 * Màn hình theo dõi Lịch Sử Ra Vào & Danh Sách Nhân Sự Phụ Trách Chuồng Trại
 */
@Composable
fun AttendanceScreen(
    viewModel: FarmViewModel,
    modifier: Modifier = Modifier
) {
    val staffList by viewModel.staffList.collectAsState()
    val attendanceHistory by viewModel.attendanceHistory.collectAsState()

    var activeTab by remember { mutableIntStateOf(0) } // 0: Lịch Sử Ra Vào, 1: Danh Sách Nhân Sự
    var filterType by remember { mutableStateOf("all") } // "all" | "check_in" | "check_out"
    var searchQuery by remember { mutableStateOf("") }

    LaunchedEffect(Unit) {
        viewModel.loadStaff()
        viewModel.loadAttendance()
    }

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(FarmBackgroundLight)
    ) {
        // Thanh tiêu đề phía trên
        Surface(
            color = Color.White,
            shadowElevation = 1.dp,
            border = androidx.compose.foundation.BorderStroke(1.dp, FarmCardBorderLight),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = "Nhật Ký Ra Vào Chuồng Trại",
                            style = MaterialTheme.typography.titleLarge,
                            fontWeight = FontWeight.Bold,
                            color = FarmPrimary
                        )
                        Text(
                            text = "Lịch sử kiểm soát an toàn sinh học & nhân viên phụ trách",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }

                    IconButton(
                        onClick = {
                            viewModel.loadStaff()
                            viewModel.loadAttendance()
                        },
                        modifier = Modifier
                            .size(38.dp)
                            .clip(CircleShape)
                            .background(FarmBackgroundLight)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Refresh,
                            contentDescription = "Tải lại dữ liệu",
                            tint = FarmPrimary,
                            modifier = Modifier.size(20.dp)
                        )
                    }
                }

                Spacer(modifier = Modifier.height(12.dp))

                // Thanh điều hướng tab
                TabRow(
                    selectedTabIndex = activeTab,
                    containerColor = Color.Transparent,
                    contentColor = FarmPrimary
                ) {
                    Tab(
                        selected = activeTab == 0,
                        onClick = { activeTab = 0 },
                        text = {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Default.History, contentDescription = null, modifier = Modifier.size(16.dp))
                                Spacer(modifier = Modifier.width(6.dp))
                                Text("Lịch Sử Ra Vào", fontWeight = FontWeight.Bold, fontSize = 12.sp)
                            }
                        }
                    )
                    Tab(
                        selected = activeTab == 1,
                        onClick = { activeTab = 1 },
                        text = {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Default.People, contentDescription = null, modifier = Modifier.size(16.dp))
                                Spacer(modifier = Modifier.width(6.dp))
                                Text("Danh Sách Nhân Sự", fontWeight = FontWeight.Bold, fontSize = 12.sp)
                            }
                        }
                    )
                }
            }
        }

        // Nội dung theo Tab
        when (activeTab) {
            0 -> {
                val filteredHistory = remember(attendanceHistory, filterType, searchQuery) {
                    attendanceHistory.filter { record ->
                        val matchesType = when (filterType) {
                            "check_in" -> record.checkType == "check_in"
                            "check_out" -> record.checkType == "check_out"
                            else -> true
                        }
                        val matchesQuery = if (searchQuery.isBlank()) true else {
                            record.staffName.contains(searchQuery, ignoreCase = true) ||
                                    record.staffId.contains(searchQuery, ignoreCase = true) ||
                                    (record.penId ?: "").contains(searchQuery, ignoreCase = true)
                        }
                        matchesType && matchesQuery
                    }
                }

                AttendanceHistoryView(
                    history = filteredHistory,
                    filterType = filterType,
                    searchQuery = searchQuery,
                    onFilterChange = { filterType = it },
                    onSearchQueryChange = { searchQuery = it }
                )
            }

            1 -> {
                val filteredStaff = remember(staffList, searchQuery) {
                    if (searchQuery.isBlank()) staffList
                    else staffList.filter {
                        it.name.contains(searchQuery, ignoreCase = true) ||
                                it.id.contains(searchQuery, ignoreCase = true) ||
                                (it.role ?: "").contains(searchQuery, ignoreCase = true)
                    }
                }

                StaffListView(
                    staffList = filteredStaff,
                    searchQuery = searchQuery,
                    onSearchQueryChange = { searchQuery = it }
                )
            }
        }
    }
}

@Composable
fun AttendanceHistoryView(
    history: List<AttendanceRecord>,
    filterType: String,
    searchQuery: String,
    onFilterChange: (String) -> Unit,
    onSearchQueryChange: (String) -> Unit
) {
    LazyColumn(
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
        modifier = Modifier.fillMaxSize()
    ) {
        // Thống kê nhanh lượt vào ca / tan ca
        item {
            val totalIn = history.count { it.checkType == "check_in" }
            val totalOut = history.count { it.checkType == "check_out" }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Card(
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = Color.White),
                    border = androidx.compose.foundation.BorderStroke(1.dp, FarmCardBorderLight),
                    elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
                    modifier = Modifier.weight(1f)
                ) {
                    Column(modifier = Modifier.padding(14.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            Box(modifier = Modifier.size(8.dp).clip(CircleShape).background(FarmSuccess))
                            Text("Lượt Vào Ca", fontSize = 11.sp, color = FarmSuccess, fontWeight = FontWeight.SemiBold)
                        }
                        Spacer(modifier = Modifier.height(4.dp))
                        Text("$totalIn lượt", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurface)
                    }
                }

                Card(
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = Color.White),
                    border = androidx.compose.foundation.BorderStroke(1.dp, FarmCardBorderLight),
                    elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
                    modifier = Modifier.weight(1f)
                ) {
                    Column(modifier = Modifier.padding(14.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            Box(modifier = Modifier.size(8.dp).clip(CircleShape).background(FarmWarning))
                            Text("Lượt Tan Ca", fontSize = 11.sp, color = FarmWarning, fontWeight = FontWeight.SemiBold)
                        }
                        Spacer(modifier = Modifier.height(4.dp))
                        Text("$totalOut lượt", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurface)
                    }
                }
            }
        }

        // Ô tìm kiếm nhân viên / khu vực
        item {
            OutlinedTextField(
                value = searchQuery,
                onValueChange = onSearchQueryChange,
                placeholder = { Text("Tìm theo tên nhân viên, mã số, phân khu...", fontSize = 12.sp) },
                leadingIcon = {
                    Icon(Icons.Default.Search, contentDescription = null, tint = FarmPrimary, modifier = Modifier.size(18.dp))
                },
                trailingIcon = {
                    if (searchQuery.isNotEmpty()) {
                        IconButton(onClick = { onSearchQueryChange("") }) {
                            Icon(Icons.Default.Clear, contentDescription = "Xóa tìm kiếm", modifier = Modifier.size(16.dp))
                        }
                    }
                },
                shape = RoundedCornerShape(14.dp),
                singleLine = true,
                colors = OutlinedTextFieldDefaults.colors(
                    focusedContainerColor = Color.White,
                    unfocusedContainerColor = Color.White,
                    focusedBorderColor = FarmPrimary,
                    unfocusedBorderColor = FarmCardBorderLight
                ),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(48.dp)
            )
        }

        // Bộ lọc Tất Cả / Vào Ca / Tan Ca
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                FilterChipItem(
                    label = "Tất Cả (${history.size})",
                    isSelected = filterType == "all",
                    onClick = { onFilterChange("all") }
                )
                FilterChipItem(
                    label = "Vào Ca",
                    isSelected = filterType == "check_in",
                    onClick = { onFilterChange("check_in") }
                )
                FilterChipItem(
                    label = "Tan Ca",
                    isSelected = filterType == "check_out",
                    onClick = { onFilterChange("check_out") }
                )
            }
        }

        if (history.isEmpty()) {
            item {
                Card(
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = Color.White),
                    border = androidx.compose.foundation.BorderStroke(1.dp, FarmCardBorderLight),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(32.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Icon(
                                imageVector = Icons.Default.EventNote,
                                contentDescription = null,
                                tint = FarmPrimary.copy(alpha = 0.4f),
                                modifier = Modifier.size(44.dp)
                            )
                            Spacer(modifier = Modifier.height(10.dp))
                            Text(
                                text = "Chưa có lượt ra vào nào được ghi nhận.",
                                fontSize = 12.sp,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                fontWeight = FontWeight.Medium
                            )
                        }
                    }
                }
            }
        } else {
            items(history) { record ->
                val isCheckIn = record.checkType != "check_out"
                Card(
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = Color.White),
                    border = androidx.compose.foundation.BorderStroke(1.dp, FarmCardBorderLight),
                    elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
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
                            horizontalArrangement = Arrangement.spacedBy(12.dp),
                            modifier = Modifier.weight(1f)
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(40.dp)
                                    .clip(CircleShape)
                                    .background(
                                        if (isCheckIn) FarmSuccess.copy(alpha = 0.12f) else FarmWarning.copy(alpha = 0.12f)
                                    ),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    imageVector = if (isCheckIn) Icons.Default.Login else Icons.Default.Logout,
                                    contentDescription = null,
                                    tint = if (isCheckIn) FarmSuccess else FarmWarning,
                                    modifier = Modifier.size(20.dp)
                                )
                            }

                            Column {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                                ) {
                                    Text(
                                        text = record.staffName,
                                        style = MaterialTheme.typography.bodyLarge,
                                        fontWeight = FontWeight.Bold,
                                        color = MaterialTheme.colorScheme.onSurface
                                    )
                                    Surface(
                                        shape = RoundedCornerShape(6.dp),
                                        color = if (isCheckIn) FarmSuccess.copy(alpha = 0.15f) else FarmWarning.copy(alpha = 0.15f)
                                    ) {
                                        Text(
                                            text = if (isCheckIn) "Vào Ca" else "Tan Ca",
                                            color = if (isCheckIn) FarmSuccess else FarmWarning,
                                            fontSize = 9.sp,
                                            fontWeight = FontWeight.Bold,
                                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                        )
                                    }
                                }

                                Text(
                                    text = "Mã số: ${record.staffId} • Khu vực: ${record.penId ?: "Toàn trang trại"}",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )

                                if (!record.note.isNullOrBlank()) {
                                    Spacer(modifier = Modifier.height(2.dp))
                                    Text(
                                        text = record.note,
                                        style = MaterialTheme.typography.labelSmall,
                                        color = FarmPrimary,
                                        fontSize = 10.sp
                                    )
                                }
                            }
                        }

                        Text(
                            text = record.createdAt ?: "Vừa xong",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            fontWeight = FontWeight.Bold,
                            fontSize = 11.sp
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun StaffListView(
    staffList: List<Staff>,
    searchQuery: String,
    onSearchQueryChange: (String) -> Unit
) {
    LazyColumn(
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
        modifier = Modifier.fillMaxSize()
    ) {
        // Ô tìm kiếm nhân sự
        item {
            OutlinedTextField(
                value = searchQuery,
                onValueChange = onSearchQueryChange,
                placeholder = { Text("Tìm nhân sự theo tên, mã số, chức vụ...", fontSize = 12.sp) },
                leadingIcon = {
                    Icon(Icons.Default.Search, contentDescription = null, tint = FarmPrimary, modifier = Modifier.size(18.dp))
                },
                trailingIcon = {
                    if (searchQuery.isNotEmpty()) {
                        IconButton(onClick = { onSearchQueryChange("") }) {
                            Icon(Icons.Default.Clear, contentDescription = "Xóa tìm kiếm", modifier = Modifier.size(16.dp))
                        }
                    }
                },
                shape = RoundedCornerShape(14.dp),
                singleLine = true,
                colors = OutlinedTextFieldDefaults.colors(
                    focusedContainerColor = Color.White,
                    unfocusedContainerColor = Color.White,
                    focusedBorderColor = FarmPrimary,
                    unfocusedBorderColor = FarmCardBorderLight
                ),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(48.dp)
            )
        }

        if (staffList.isEmpty()) {
            item {
                Card(
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = Color.White),
                    border = androidx.compose.foundation.BorderStroke(1.dp, FarmCardBorderLight),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Box(modifier = Modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) {
                        Text("Chưa có dữ liệu nhân sự phù hợp.", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 12.sp)
                    }
                }
            }
        } else {
            items(staffList) { staff ->
                Card(
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = Color.White),
                    border = androidx.compose.foundation.BorderStroke(1.dp, FarmCardBorderLight),
                    elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(14.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(44.dp)
                                .clip(CircleShape)
                                .background(FarmPrimary.copy(alpha = 0.12f)),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = staff.name.take(1).uppercase(),
                                color = FarmPrimary,
                                fontWeight = FontWeight.Bold,
                                fontSize = 16.sp
                            )
                        }

                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = staff.name,
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.onSurface
                            )
                            Text(
                                text = "Mã: ${staff.id} • Vị trí: ${staff.role ?: "Kỹ thuật viên"}",
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                            if (!staff.phone.isNullOrBlank()) {
                                Text(
                                    text = "Số điện thoại: ${staff.phone}",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                        }

                        Surface(
                            shape = RoundedCornerShape(8.dp),
                            color = FarmBackgroundLight,
                            border = androidx.compose.foundation.BorderStroke(1.dp, FarmCardBorderLight)
                        ) {
                            Text(
                                text = "Phụ trách: ${staff.penId ?: "Toàn bộ"}",
                                fontSize = 10.sp,
                                color = FarmPrimary,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                            )
                        }
                    }
                }
            }
        }
    }
}
