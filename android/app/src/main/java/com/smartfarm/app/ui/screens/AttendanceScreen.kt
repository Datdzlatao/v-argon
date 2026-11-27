package com.smartfarm.app.ui.screens

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.smartfarm.app.data.models.AttendanceRecord
import com.smartfarm.app.data.models.Staff
import com.smartfarm.app.data.remote.ApiConfig
import com.smartfarm.app.ui.components.WebSocketStreamPlayer
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
    val isFaceCamActive by viewModel.isFaceCameraActive.collectAsState()
    val faceTelemetry by viewModel.faceCameraTelemetry.collectAsState()

    var activeTab by remember { mutableIntStateOf(0) } // 0: Quét Mặt AI, 1: Lịch Sử Ra Vào, 2: Nhân Sự
    var filterType by remember { mutableStateOf("all") } // "all" | "check_in" | "check_out"
    var searchQuery by remember { mutableStateOf("") }
    var showEnrollDialog by remember { mutableStateOf(false) }

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

                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        IconButton(
                            onClick = { showEnrollDialog = true },
                            modifier = Modifier
                                .size(38.dp)
                                .clip(CircleShape)
                                .background(FarmPrimary.copy(alpha = 0.12f))
                        ) {
                            Icon(
                                imageVector = Icons.Default.PersonAdd,
                                contentDescription = "Đăng ký khuôn mặt",
                                tint = FarmPrimary,
                                modifier = Modifier.size(20.dp)
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
                                Icon(Icons.Default.Face, contentDescription = null, modifier = Modifier.size(15.dp))
                                Spacer(modifier = Modifier.width(4.dp))
                                Text("Quét Mặt", fontWeight = FontWeight.Bold, fontSize = 11.sp)
                            }
                        }
                    )
                    Tab(
                        selected = activeTab == 1,
                        onClick = { activeTab = 1 },
                        text = {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Default.History, contentDescription = null, modifier = Modifier.size(15.dp))
                                Spacer(modifier = Modifier.width(4.dp))
                                Text("Lịch Sử", fontWeight = FontWeight.Bold, fontSize = 11.sp)
                            }
                        }
                    )
                    Tab(
                        selected = activeTab == 2,
                        onClick = { activeTab = 2 },
                        text = {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Default.People, contentDescription = null, modifier = Modifier.size(15.dp))
                                Spacer(modifier = Modifier.width(4.dp))
                                Text("Nhân Sự", fontWeight = FontWeight.Bold, fontSize = 11.sp)
                            }
                        }
                    )
                }
            }
        }

        // Nội dung theo Tab
        when (activeTab) {
            0 -> {
                FaceScanAndCheckInView(
                    isFaceCamActive = isFaceCamActive,
                    faceTelemetry = faceTelemetry,
                    staffList = staffList,
                    onStartCam = { viewModel.startFaceCamera("0") },
                    onStopCam = { viewModel.stopFaceCamera() },
                    onManualCheckIn = { id, name, type, note ->
                        viewModel.checkInStaff(id, name, type, note)
                    }
                )
            }

            1 -> {
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

            2 -> {
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

    if (showEnrollDialog) {
        EnrollFaceDialog(
            onDismiss = { showEnrollDialog = false },
            onEnroll = { id, name, role, b1, b2, b3 ->
                viewModel.enrollStaffFace(id, name, role, b1, b2, b3)
                showEnrollDialog = false
            }
        )
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

@Composable
fun FaceScanAndCheckInView(
    isFaceCamActive: Boolean,
    faceTelemetry: com.smartfarm.app.data.models.FaceCameraTelemetry?,
    staffList: List<Staff>,
    onStartCam: () -> Unit,
    onStopCam: () -> Unit,
    onManualCheckIn: (String, String, String, String?) -> Unit
) {
    val faceWsUrl = remember { "${ApiConfig.faceWsUrl}/api/v1/camera/ws?overlay=true" }
    var selectedStaffIdx by remember { mutableIntStateOf(0) }
    var checkType by remember { mutableStateOf("check_in") }
    var note by remember { mutableStateOf("") }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        // Camera Stream Box
        Card(
            shape = RoundedCornerShape(20.dp),
            colors = CardDefaults.cardColors(containerColor = Color.Black),
            modifier = Modifier
                .fillMaxWidth()
                .height(220.dp)
        ) {
            if (isFaceCamActive) {
                WebSocketStreamPlayer(
                    streamUrl = faceWsUrl,
                    isPlaying = true,
                    modifier = Modifier.fillMaxSize()
                )
            } else {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(Icons.Default.Face, contentDescription = null, tint = Color.White.copy(alpha = 0.5f), modifier = Modifier.size(44.dp))
                        Spacer(modifier = Modifier.height(6.dp))
                        Text("Camera điểm danh & bảo hộ đang tắt", color = Color.White.copy(alpha = 0.7f), fontSize = 13.sp)
                    }
                }
            }
        }

        Button(
            onClick = { if (isFaceCamActive) onStopCam() else onStartCam() },
            colors = ButtonDefaults.buttonColors(containerColor = if (isFaceCamActive) FarmDestructive else FarmPrimary),
            shape = RoundedCornerShape(14.dp),
            modifier = Modifier.fillMaxWidth().height(46.dp)
        ) {
            Icon(Icons.Default.PowerSettingsNew, contentDescription = null, modifier = Modifier.size(18.dp))
            Spacer(modifier = Modifier.width(8.dp))
            Text(if (isFaceCamActive) "Tắt Camera Điểm Danh" else "Bật Camera Điểm Danh AI", fontWeight = FontWeight.Bold)
        }

        // Uniform & Face Telemetry Card
        if (faceTelemetry != null) {
            val uniform = faceTelemetry.uniform
            Card(
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                border = androidx.compose.foundation.BorderStroke(1.dp, FarmCardBorderLight),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        Text("Trạng thái bảo hộ", fontWeight = FontWeight.Bold, fontSize = 13.sp)
                        Surface(
                            shape = RoundedCornerShape(8.dp),
                            color = if (uniform?.isCorrect == true) FarmSuccess.copy(alpha = 0.15f) else FarmWarning.copy(alpha = 0.15f)
                        ) {
                            Text(
                                text = uniform?.status ?: "Đang quét",
                                color = if (uniform?.isCorrect == true) FarmSuccess else FarmWarning,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                            )
                        }
                    }
                    if (!uniform?.message.isNullOrBlank()) {
                        Text(uniform?.message ?: "", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    if (faceTelemetry.faces.isNotEmpty()) {
                        Text(
                            text = "Nhận diện: ${faceTelemetry.faces.first().name}",
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold,
                            color = FarmPrimary
                        )
                    }
                }
            }
        }

        // Manual Check-in Card
        Card(
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(containerColor = Color.White),
            border = androidx.compose.foundation.BorderStroke(1.dp, FarmCardBorderLight),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text("Chấm Công Thủ Công", fontWeight = FontWeight.Bold, fontSize = 14.sp, color = FarmPrimary)
                if (staffList.isNotEmpty()) {
                    val currentStaff = staffList[selectedStaffIdx.coerceIn(0, staffList.lastIndex)]
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedButton(
                            onClick = { selectedStaffIdx = (selectedStaffIdx + 1) % staffList.size },
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.weight(1f)
                        ) {
                            Text("${currentStaff.id} - ${currentStaff.name}", maxLines = 1, fontSize = 12.sp)
                        }
                        OutlinedButton(
                            onClick = { checkType = if (checkType == "check_in") "check_out" else "check_in" },
                            shape = RoundedCornerShape(12.dp)
                        ) {
                            Text(if (checkType == "check_in") "Vào ca" else "Tan ca", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                    OutlinedTextField(
                        value = note,
                        onValueChange = { note = it },
                        placeholder = { Text("Ghi chú chấm công...", fontSize = 12.sp) },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                    Button(
                        onClick = {
                            onManualCheckIn(currentStaff.id, currentStaff.name, checkType, note.ifBlank { null })
                            note = ""
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = FarmPrimary),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(if (checkType == "check_in") "Ghi Nhận Vào Ca" else "Ghi Nhận Tan Ca", fontWeight = FontWeight.Bold)
                    }
                } else {
                    Text("Chưa có danh sách nhân sự.", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }
    }
}

@Composable
fun EnrollFaceDialog(
    onDismiss: () -> Unit,
    onEnroll: (String, String, String, ByteArray, ByteArray?, ByteArray?) -> Unit
) {
    val context = LocalContext.current
    var staffId by remember { mutableStateOf("") }
    var staffName by remember { mutableStateOf("") }
    var role by remember { mutableStateOf("Kỹ thuật viên") }
    var uriThang by remember { mutableStateOf<Uri?>(null) }
    var uriTrai by remember { mutableStateOf<Uri?>(null) }
    var uriPhai by remember { mutableStateOf<Uri?>(null) }

    val pickThang = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uriThang = it }
    val pickTrai = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uriTrai = it }
    val pickPhai = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uriPhai = it }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Đăng Ký Khuôn Mặt (eKYC)", fontWeight = FontWeight.Bold, fontSize = 16.sp) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(value = staffId, onValueChange = { staffId = it }, label = { Text("Mã NV (VD: NV05)") }, singleLine = true)
                OutlinedTextField(value = staffName, onValueChange = { staffName = it }, label = { Text("Họ và tên") }, singleLine = true)
                OutlinedTextField(value = role, onValueChange = { role = it }, label = { Text("Chức vụ") }, singleLine = true)
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    OutlinedButton(onClick = { pickThang.launch("image/*") }, modifier = Modifier.weight(1f)) {
                        Text(if (uriThang != null) "✓ Thẳng" else "Ảnh Thẳng", fontSize = 11.sp)
                    }
                    OutlinedButton(onClick = { pickTrai.launch("image/*") }, modifier = Modifier.weight(1f)) {
                        Text(if (uriTrai != null) "✓ Trái" else "Nghiêng Trái", fontSize = 11.sp)
                    }
                    OutlinedButton(onClick = { pickPhai.launch("image/*") }, modifier = Modifier.weight(1f)) {
                        Text(if (uriPhai != null) "✓ Phải" else "Nghiêng Phải", fontSize = 11.sp)
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    val b1 = uriThang?.let { context.contentResolver.openInputStream(it)?.use { s -> s.readBytes() } }
                    if (staffId.isNotBlank() && staffName.isNotBlank() && b1 != null) {
                        val b2 = uriTrai?.let { context.contentResolver.openInputStream(it)?.use { s -> s.readBytes() } }
                        val b3 = uriPhai?.let { context.contentResolver.openInputStream(it)?.use { s -> s.readBytes() } }
                        onEnroll(staffId, staffName, role, b1, b2, b3)
                    }
                },
                colors = ButtonDefaults.buttonColors(containerColor = FarmPrimary)
            ) {
                Text("Lưu Hồ Sơ")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Hủy") }
        }
    )
}
