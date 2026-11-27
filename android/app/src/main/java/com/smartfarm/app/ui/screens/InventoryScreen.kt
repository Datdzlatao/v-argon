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
import com.smartfarm.app.data.models.InventoryItem
import com.smartfarm.app.ui.components.ExportInventoryDialog
import com.smartfarm.app.ui.components.ImportInventoryDialog
import com.smartfarm.app.ui.theme.*
import com.smartfarm.app.ui.viewmodel.FarmViewModel
import com.smartfarm.app.util.rememberCsvExporter

@Composable
fun InventoryScreen(
    viewModel: FarmViewModel,
    modifier: Modifier = Modifier
) {
    val inventory by viewModel.inventory.collectAsState()
    val operationLogs by viewModel.operationLogs.collectAsState()

    var activeTab by remember { mutableIntStateOf(0) } // 0: Tồn Kho, 1: Nhật Ký Kho
    var logFilter by remember { mutableStateOf("ALL") }
    var searchQuery by remember { mutableStateOf("") }
    var selectedCategory by remember { mutableStateOf("Tất cả") }

    LaunchedEffect(Unit) {
        viewModel.loadOperationLogs()
    }

    var showImportDialog by remember { mutableStateOf(false) }
    var showExportDialog by remember { mutableStateOf(false) }
    var selectedItemForExport by remember { mutableStateOf<InventoryItem?>(null) }
    val exportCsv = rememberCsvExporter { _, msg -> viewModel.showToast(msg) }

    val categories = listOf("Tất cả", "Thức ăn", "Feed", "Phân bón", "Thuốc thú y", "Crops", "Vật tư")

    val filteredItems = inventory.filter { item ->
        val matchSearch = item.name.contains(searchQuery, ignoreCase = true)
        val matchCat = selectedCategory == "Tất cả" || item.category.contains(selectedCategory, ignoreCase = true)
        matchSearch && matchCat
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
                            text = "Kho Vật Tư Nông Trại",
                            style = MaterialTheme.typography.titleLarge,
                            fontWeight = FontWeight.Bold,
                            color = FarmPrimary
                        )
                        Text(
                            text = "Quản lý thức ăn, phân bón, thuốc phòng bệnh (${inventory.size} mặt hàng)",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }

                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        OutlinedButton(
                            onClick = {
                                if (activeTab == 0) {
                                    exportCsv(
                                        "ton-kho-vargon",
                                        listOf("Tên", "Danh mục", "Số lượng", "Đơn vị", "Đơn giá"),
                                        inventory.map { listOf(it.name, it.category, it.quantity, it.unit, it.unitPrice ?: 0) }
                                    )
                                } else {
                                    exportCsv(
                                        "nhat-ky-kho-vargon",
                                        listOf("Loại", "Tên", "Số lượng", "Đơn vị", "Ghi chú"),
                                        operationLogs.map { listOf(it.actionType, it.itemName, it.quantity, it.unit ?: "", it.note ?: "") }
                                    )
                                }
                            },
                            shape = RoundedCornerShape(12.dp),
                            contentPadding = PaddingValues(horizontal = 10.dp, vertical = 8.dp)
                        ) {
                            Text("CSV", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = FarmPrimary)
                        }
                        Button(
                            onClick = { showImportDialog = true },
                            colors = ButtonDefaults.buttonColors(containerColor = FarmPrimary),
                            shape = RoundedCornerShape(12.dp),
                            contentPadding = PaddingValues(horizontal = 12.dp, vertical = 8.dp)
                        ) {
                            Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("Nhập Kho", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        }

                        Button(
                            onClick = {
                                selectedItemForExport = filteredItems.firstOrNull() ?: inventory.firstOrNull()
                                if (selectedItemForExport != null) {
                                    showExportDialog = true
                                }
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = FarmWarning),
                            shape = RoundedCornerShape(12.dp),
                            contentPadding = PaddingValues(horizontal = 12.dp, vertical = 8.dp)
                        ) {
                            Icon(Icons.Default.Remove, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("Xuất Kho", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }

                Spacer(modifier = Modifier.height(12.dp))

                // Ô tìm kiếm
                OutlinedTextField(
                    value = searchQuery,
                    onValueChange = { searchQuery = it },
                    placeholder = { Text("Tìm theo tên cám, phân bón, thuốc thú y...", fontSize = 12.sp) },
                    leadingIcon = {
                        Icon(Icons.Default.Search, contentDescription = null, tint = FarmPrimary, modifier = Modifier.size(18.dp))
                    },
                    trailingIcon = {
                        if (searchQuery.isNotEmpty()) {
                            IconButton(onClick = { searchQuery = "" }) {
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

                Spacer(modifier = Modifier.height(10.dp))

                // Phân loại danh mục
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    categories.forEach { cat ->
                        val isSelected = selectedCategory == cat
                        Surface(
                            onClick = { selectedCategory = cat },
                            shape = RoundedCornerShape(10.dp),
                            color = if (isSelected) FarmPrimary else Color.White,
                            border = androidx.compose.foundation.BorderStroke(
                                1.dp,
                                if (isSelected) FarmPrimary else FarmCardBorderLight
                            ),
                            modifier = Modifier.height(32.dp)
                        ) {
                            Text(
                                text = cat,
                                fontSize = 11.sp,
                                fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                                color = if (isSelected) Color.White else MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(10.dp))

                TabRow(selectedTabIndex = activeTab, containerColor = Color.Transparent, contentColor = FarmPrimary) {
                    Tab(selected = activeTab == 0, onClick = { activeTab = 0 }, text = { Text("Tồn Kho (${filteredItems.size})", fontWeight = FontWeight.Bold, fontSize = 12.sp) })
                    Tab(selected = activeTab == 1, onClick = { activeTab = 1; viewModel.loadOperationLogs() }, text = { Text("Nhật Ký Kho (${operationLogs.size})", fontWeight = FontWeight.Bold, fontSize = 12.sp) })
                }
            }
        }

        if (activeTab == 1) {
            Column(modifier = Modifier.fillMaxSize()) {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    listOf("ALL" to "Tất cả", "IMPORT" to "Nhập", "EXPORT" to "Xuất", "ANIMAL_EXPORT" to "Xuất chuồng", "CROP_HARVEST" to "Thu hoạch").forEach { (key, label) ->
                        val sel = logFilter == key
                        Surface(
                            onClick = { logFilter = key },
                            shape = RoundedCornerShape(10.dp),
                            color = if (sel) FarmPrimary else Color.White,
                            border = androidx.compose.foundation.BorderStroke(1.dp, if (sel) FarmPrimary else FarmCardBorderLight)
                        ) {
                            Text(label, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = if (sel) Color.White else FarmTextMutedLight, modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp))
                        }
                    }
                }
                val filteredLogs = operationLogs.filter { log ->
                    (logFilter == "ALL" || log.actionType == logFilter) &&
                    (searchQuery.isBlank() || log.itemName.contains(searchQuery, ignoreCase = true) || (log.note ?: "").contains(searchQuery, ignoreCase = true))
                }
                if (filteredLogs.isEmpty()) {
                    Box(modifier = Modifier.fillMaxSize().padding(32.dp), contentAlignment = Alignment.Center) {
                        Text("Chưa có nhật ký xuất nhập nào.", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 13.sp)
                    }
                } else {
                    LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        items(filteredLogs) { log ->
                            Card(shape = RoundedCornerShape(14.dp), colors = CardDefaults.cardColors(containerColor = Color.White), border = androidx.compose.foundation.BorderStroke(1.dp, FarmCardBorderLight)) {
                                Row(modifier = Modifier.fillMaxWidth().padding(12.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text("${log.actionType} • ${log.itemName}", fontWeight = FontWeight.Bold, fontSize = 13.sp)
                                        if (!log.note.isNullOrBlank()) Text(log.note, fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                    }
                                    Text("${log.quantity} ${log.unit ?: ""}", fontWeight = FontWeight.Bold, color = FarmPrimary, fontSize = 13.sp)
                                }
                            }
                        }
                    }
                }
            }
        } else if (filteredItems.isEmpty()) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(32.dp),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(
                        imageVector = Icons.Default.Inventory2,
                        contentDescription = null,
                        tint = FarmPrimary.copy(alpha = 0.4f),
                        modifier = Modifier.size(48.dp)
                    )
                    Spacer(modifier = Modifier.height(10.dp))
                    Text(
                        text = "Không tìm thấy mặt hàng nào trong kho",
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        fontSize = 13.sp
                    )
                }
            }
        } else {
            LazyColumn(
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                items(filteredItems, key = { it.displayId }) { item ->
                    InventoryCardItem(
                        item = item,
                        onExportClick = {
                            selectedItemForExport = item
                            showExportDialog = true
                        },
                        onDeleteClick = {
                            viewModel.deleteInventory(item.displayId)
                        }
                    )
                }
            }
        }
    }

    // Hộp thoại nhập kho
    ImportInventoryDialog(
        isOpen = showImportDialog,
        onDismiss = { showImportDialog = false },
        onConfirm = { name, cat, qty, unit, price -> viewModel.importInventory(name, cat, qty, unit, price) }
    )

    // Hộp thoại xuất kho
    if (selectedItemForExport != null) {
        ExportInventoryDialog(
            isOpen = showExportDialog,
            selectedItem = selectedItemForExport,
            onDismiss = {
                showExportDialog = false
                selectedItemForExport = null
            },
            onConfirm = { id, cur, exp ->
                viewModel.exportInventory(id, cur, exp)
                showExportDialog = false
                selectedItemForExport = null
            }
        )
    }
}

@Composable
fun InventoryCardItem(
    item: InventoryItem,
    onExportClick: () -> Unit,
    onDeleteClick: () -> Unit
) {
    val isLowStock = item.quantity <= item.minThreshold
    val categoryIcon = when {
        item.category.contains("thức ăn", ignoreCase = true) || item.category.contains("feed", ignoreCase = true) -> Icons.Default.Fastfood
        item.category.contains("phân", ignoreCase = true) || item.category.contains("crops", ignoreCase = true) -> Icons.Default.Agriculture
        item.category.contains("thuốc", ignoreCase = true) -> Icons.Default.Medication
        else -> Icons.Default.Build
    }

    Card(
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
        border = androidx.compose.foundation.BorderStroke(
            1.dp,
            if (isLowStock) FarmDestructive.copy(alpha = 0.5f) else FarmCardBorderLight
        ),
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
                        .size(44.dp)
                        .clip(CircleShape)
                        .background(if (isLowStock) FarmDestructive.copy(alpha = 0.12f) else FarmCardBorderLight),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = categoryIcon,
                        contentDescription = null,
                        tint = if (isLowStock) FarmDestructive else FarmPrimary,
                        modifier = Modifier.size(22.dp)
                    )
                }

                Column {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text(
                            text = item.name,
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onSurface
                        )
                        if (isLowStock) {
                            Surface(
                                shape = RoundedCornerShape(6.dp),
                                color = FarmDestructive.copy(alpha = 0.15f)
                            ) {
                                Text(
                                    text = "Sắp hết hàng",
                                    fontSize = 9.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = FarmDestructive,
                                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                )
                            }
                        }
                    }
                    Text(
                        text = "Mã hàng: ${item.displayId} • Phân loại: ${item.category}",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Column(horizontalAlignment = Alignment.End) {
                    Text(
                        text = "${item.quantity} ${item.unit}",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = if (isLowStock) FarmDestructive else FarmPrimary
                    )
                    if (item.price > 0) {
                        Text(
                            text = "${item.price.toInt()} đ/${item.unit}",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }

                // Nút xuất kho
                IconButton(
                    onClick = onExportClick,
                    modifier = Modifier.size(34.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.RemoveCircleOutline,
                        contentDescription = "Xuất sử dụng",
                        tint = FarmWarning,
                        modifier = Modifier.size(18.dp)
                    )
                }

                // Nút xóa mặt hàng khỏi kho
                IconButton(
                    onClick = onDeleteClick,
                    modifier = Modifier.size(34.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.DeleteOutline,
                        contentDescription = "Xóa khỏi kho",
                        tint = FarmDestructive,
                        modifier = Modifier.size(18.dp)
                    )
                }
            }
        }
    }
}
