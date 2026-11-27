package com.smartfarm.app.ui.screens

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
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
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.smartfarm.app.data.models.Animal
import com.smartfarm.app.data.models.Crop
import com.smartfarm.app.ui.components.AddAnimalDialog
import com.smartfarm.app.ui.components.AddCropDialog
import com.smartfarm.app.ui.components.TransferAnimalDialog
import com.smartfarm.app.ui.theme.*
import com.smartfarm.app.ui.viewmodel.FarmViewModel
import com.smartfarm.app.util.rememberCsvExporter

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LivestockCropsScreen(
    viewModel: FarmViewModel,
    modifier: Modifier = Modifier
) {
    val currentMode by viewModel.currentMode.collectAsState()
    val animals by viewModel.animals.collectAsState()
    val crops by viewModel.crops.collectAsState()
    val pens by viewModel.pens.collectAsState()
    val currentPenId by viewModel.currentPenId.collectAsState()

    val currentPen = pens.firstOrNull { it.id == currentPenId }
    val currentPenName = currentPen?.name ?: (if (currentMode == "livestock") "Chuồng Nuôi Hiện Tại" else "Vườn Trồng Hiện Tại")

    var searchQuery by remember { mutableStateOf("") }
    var selectedFilter by remember { mutableStateOf("all") } // "all" | "ready" | "attention" | "healthy"

    var showAddAnimalDialog by remember { mutableStateOf(false) }
    var showAddCropDialog by remember { mutableStateOf(false) }

    var selectedAnimalForTransfer by remember { mutableStateOf<Animal?>(null) }
    var showTransferDialog by remember { mutableStateOf(false) }

    var activeHealthAnimal by remember { mutableStateOf<Animal?>(null) }
    var activeWeightAnimal by remember { mutableStateOf<Animal?>(null) }
    var activeGrowthCrop by remember { mutableStateOf<Crop?>(null) }
    var activeCareCrop by remember { mutableStateOf<Crop?>(null) }
    var harvestTargetAnimal by remember { mutableStateOf<Animal?>(null) }
    var harvestTargetCrop by remember { mutableStateOf<Crop?>(null) }

    val healthLogs by viewModel.healthLogs.collectAsState()
    val weightLogs by viewModel.weightLogs.collectAsState()
    val cropGrowthLogs by viewModel.cropGrowthLogs.collectAsState()
    val cropCareLogs by viewModel.cropCareLogs.collectAsState()
    val operationLogs by viewModel.operationLogs.collectAsState()
    var showExportHistory by remember { mutableStateOf(false) }
    val exportCsv = rememberCsvExporter { _, msg -> viewModel.showToast(msg) }

    val isLivestock = currentMode == "livestock"

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
                            text = if (isLivestock) "Quản Lý Đàn Vật Nuôi" else "Quản Lý Vụ Mùa Cây Trồng",
                            style = MaterialTheme.typography.titleLarge,
                            fontWeight = FontWeight.Bold,
                            color = FarmPrimary
                        )
                        Text(
                            text = "Khu vực: $currentPenName (${if (isLivestock) "${animals.size} cá thể" else "${crops.size} luống cây"})",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }

                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        OutlinedButton(
                            onClick = {
                                if (isLivestock) {
                                    exportCsv(
                                        "vat-nuoi-vargon",
                                        listOf("Mã", "Loài", "Cân nặng (kg)", "Mục tiêu (kg)", "Trạng thái"),
                                        animals.map { listOf(it.id, it.species, it.weight, it.targetWeight, it.status ?: "") }
                                    )
                                } else {
                                    exportCsv(
                                        "cay-trong-vargon",
                                        listOf("Mã", "Tên cây", "Số lượng", "Giai đoạn", "Thu hoạch"),
                                        crops.map { listOf(it.displayId, it.name, it.quantity, it.stage, it.expectedHarvest) }
                                    )
                                }
                            },
                            shape = RoundedCornerShape(12.dp),
                            contentPadding = PaddingValues(horizontal = 10.dp, vertical = 8.dp)
                        ) {
                            Text("CSV", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = FarmPrimary)
                        }
                        Button(
                            onClick = {
                                if (isLivestock) showAddAnimalDialog = true
                                else showAddCropDialog = true
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = FarmPrimary),
                            shape = RoundedCornerShape(12.dp),
                            contentPadding = PaddingValues(horizontal = 12.dp, vertical = 8.dp)
                        ) {
                            Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text(
                                text = if (isLivestock) "Thêm Vật Nuôi" else "Thêm Giống Cây",
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(12.dp))

                // Ô tìm kiếm
                OutlinedTextField(
                    value = searchQuery,
                    onValueChange = { searchQuery = it },
                    placeholder = {
                        Text(
                            if (isLivestock) "Tìm theo mã thẻ, giống loài..." else "Tìm tên giống cây, mã luống...",
                            fontSize = 12.sp
                        )
                    },
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

                Spacer(modifier = Modifier.height(8.dp))

                // Thanh chọn phân khu chuồng / vườn
                LazyRow(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    item {
                        FilterChip(
                            selected = currentPenId == "" || currentPenId == "all",
                            onClick = { viewModel.selectPen("all") },
                            label = { Text("Tất Cả", fontSize = 11.sp, fontWeight = FontWeight.SemiBold) }
                        )
                    }
                    items(pens, key = { it.id }) { p ->
                        FilterChip(
                            selected = currentPenId == p.id,
                            onClick = { viewModel.selectPen(p.id) },
                            label = { Text(p.name, fontSize = 11.sp) }
                        )
                    }
                }

                Spacer(modifier = Modifier.height(6.dp))

                // Các nút lọc trạng thái
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    FilterChipItem("Tất cả", isSelected = selectedFilter == "all", onClick = { selectedFilter = "all" })
                    FilterChipItem("Sẵn sàng xuất", isSelected = selectedFilter == "ready", onClick = { selectedFilter = "ready" })
                    FilterChipItem("Cần chăm sóc", isSelected = selectedFilter == "attention", onClick = { selectedFilter = "attention" })
                    FilterChipItem("Lịch sử xuất", isSelected = showExportHistory, onClick = { showExportHistory = !showExportHistory; if (showExportHistory) viewModel.loadOperationLogs() })
                }

                if (showExportHistory) {
                    val exports = operationLogs.filter { it.actionType == "ANIMAL_EXPORT" || it.actionType == "CROP_HARVEST" }
                    Spacer(modifier = Modifier.height(8.dp))
                    Surface(shape = RoundedCornerShape(12.dp), color = Color(0xFFFFFBEB), border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFFDE68A)), modifier = Modifier.fillMaxWidth()) {
                        Column(modifier = Modifier.padding(10.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            Text("Lịch sử xuất chuồng / thu hoạch (${exports.size})", fontWeight = FontWeight.Bold, fontSize = 12.sp, color = Color(0xFF92400E))
                            if (exports.isEmpty()) {
                                Text("Chưa có lịch sử xuất bán.", fontSize = 11.sp, color = Color(0xFFB45309))
                            } else {
                                exports.take(6).forEach { log ->
                                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                        Text(log.itemName, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
                                        Text("${log.quantity} ${log.unit ?: ""}", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = FarmPrimary)
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // Danh sách cá thể / cây trồng
        if (isLivestock) {
            val filteredAnimals = animals.filter {
                val matchSearch = it.id.contains(searchQuery, ignoreCase = true) || it.species.contains(searchQuery, ignoreCase = true)
                val matchFilter = when (selectedFilter) {
                    "ready" -> it.status == "ready" || it.weight >= it.targetWeight
                    "attention" -> it.status == "attention" || it.status == "Sot nhe"
                    "healthy" -> it.status == "healthy" || it.status == "Khoe"
                    else -> true
                }
                matchSearch && matchFilter
            }

            if (filteredAnimals.isEmpty()) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(32.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(Icons.Default.Pets, contentDescription = null, tint = FarmPrimary.copy(alpha = 0.4f), modifier = Modifier.size(48.dp))
                        Spacer(modifier = Modifier.height(10.dp))
                        Text("Không có cá thể vật nuôi nào trong chuồng này", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 13.sp)
                    }
                }
            } else {
                LazyColumn(
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    items(filteredAnimals, key = { it.id }) { animal ->
                        AnimalItemCard(
                            animal = animal,
                            onDelete = { viewModel.deleteAnimal(animal.id) },
                            onTransferClick = {
                                selectedAnimalForTransfer = animal
                                showTransferDialog = true
                            },
                            onHealthClick = {
                                viewModel.loadHealthLogs(animal.id)
                                activeHealthAnimal = animal
                            },
                            onWeightClick = {
                                viewModel.loadWeightLogs(animal.id)
                                activeWeightAnimal = animal
                            },
                            onHarvestClick = { harvestTargetAnimal = animal }
                        )
                    }
                }
            }
        } else {
            val filteredCrops = crops.filter {
                val matchSearch = it.displayId.contains(searchQuery, ignoreCase = true) || it.name.contains(searchQuery, ignoreCase = true)
                val matchFilter = when (selectedFilter) {
                    "ready" -> it.status == "ready"
                    "attention" -> it.status == "attention"
                    "healthy" -> it.status == "healthy" || it.status == "Growing"
                    else -> true
                }
                matchSearch && matchFilter
            }

            if (filteredCrops.isEmpty()) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(32.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(Icons.Default.Spa, contentDescription = null, tint = FarmPrimary.copy(alpha = 0.4f), modifier = Modifier.size(48.dp))
                        Spacer(modifier = Modifier.height(10.dp))
                        Text("Không có giống cây trồng nào trong vườn này", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 13.sp)
                    }
                }
            } else {
                LazyColumn(
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    items(filteredCrops, key = { it.displayId }) { crop ->
                        CropItemCard(
                            crop = crop,
                            onDelete = { viewModel.deleteCrop(crop.displayId) },
                            onGrowthClick = {
                                viewModel.loadCropGrowthLogs(crop.displayId)
                                activeGrowthCrop = crop
                            },
                            onCareClick = {
                                viewModel.loadCropCareLogs(crop.displayId)
                                activeCareCrop = crop
                            },
                            onHarvestClick = { harvestTargetCrop = crop }
                        )
                    }
                }
            }
        }
    }

    // Hộp thoại thêm vật nuôi
    AddAnimalDialog(
        isOpen = showAddAnimalDialog,
        penId = currentPenId,
        pens = pens,
        onDismiss = { showAddAnimalDialog = false },
        onConfirm = { id, species, w, tw, targetPen -> viewModel.addAnimal(id, species, w, tw, "healthy", targetPen) }
    )

    // Hộp thoại thêm giống cây
    AddCropDialog(
        isOpen = showAddCropDialog,
        penId = currentPenId,
        pens = pens,
        onDismiss = { showAddCropDialog = false },
        onConfirm = { name, q, pd, hd, st, targetPen -> viewModel.addCrop(name, q, pd, hd, st, targetPen) }
    )

    // Hộp thoại chuyển chuồng nuôi
    if (selectedAnimalForTransfer != null) {
        TransferAnimalDialog(
            isOpen = showTransferDialog,
            animalId = selectedAnimalForTransfer!!.id,
            pens = pens,
            onDismiss = {
                showTransferDialog = false
                selectedAnimalForTransfer = null
            },
            onConfirm = { animalId, targetPenId, reason ->
                viewModel.transferAnimal(animalId, targetPenId, reason)
                showTransferDialog = false
                selectedAnimalForTransfer = null
            }
        )
    }

    // Xác nhận xuất chuồng
    if (harvestTargetAnimal != null) {
        val ani = harvestTargetAnimal!!
        AlertDialog(
            onDismissRequest = { harvestTargetAnimal = null },
            title = { Text("Xác Nhận Xuất Chuồng", fontWeight = FontWeight.Bold) },
            text = { Text("Xuất bán cá thể ${ani.id} (${ani.species}, ${ani.weight} kg)?") },
            confirmButton = {
                Button(onClick = { viewModel.harvestAnimal(ani); harvestTargetAnimal = null }, colors = ButtonDefaults.buttonColors(containerColor = FarmPrimary)) {
                    Text("Xuất Chuồng")
                }
            },
            dismissButton = { TextButton(onClick = { harvestTargetAnimal = null }) { Text("Hủy") } }
        )
    }

    // Xác nhận thu hoạch
    if (harvestTargetCrop != null) {
        val crp = harvestTargetCrop!!
        AlertDialog(
            onDismissRequest = { harvestTargetCrop = null },
            title = { Text("Xác Nhận Thu Hoạch", fontWeight = FontWeight.Bold) },
            text = { Text("Thu hoạch vụ mùa ${crp.name} (${crp.quantity} gốc)?") },
            confirmButton = {
                Button(onClick = { viewModel.harvestCrop(crp); harvestTargetCrop = null }, colors = ButtonDefaults.buttonColors(containerColor = FarmPrimary)) {
                    Text("Thu Hoạch")
                }
            },
            dismissButton = { TextButton(onClick = { harvestTargetCrop = null }) { Text("Hủy") } }
        )
    }

    // Nhật ký sức khỏe vật nuôi
    if (activeHealthAnimal != null) {
        val ani = activeHealthAnimal!!
        var title by remember { mutableStateOf("") }
        var note by remember { mutableStateOf("") }
        AlertDialog(
            onDismissRequest = { activeHealthAnimal = null },
            title = { Text("Thú Y & Sức Khỏe: ${ani.id}", fontWeight = FontWeight.Bold, fontSize = 15.sp) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(value = title, onValueChange = { title = it }, label = { Text("Tình trạng / Tiêm phòng") }, singleLine = true)
                    OutlinedTextField(value = note, onValueChange = { note = it }, label = { Text("Ghi chú thuốc / liều lượng") }, singleLine = true)
                    Button(
                        onClick = { if (title.isNotBlank()) { viewModel.addHealthLog(ani.id, "Khám", title, note); title = ""; note = "" } },
                        colors = ButtonDefaults.buttonColors(containerColor = FarmPrimary),
                        modifier = Modifier.fillMaxWidth()
                    ) { Text("+ Thêm Nhật Ký") }
                    healthLogs.take(6).forEach { log ->
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                            Text("${log.title} ${log.note?.let { "• $it" } ?: ""}", fontSize = 11.sp, modifier = Modifier.weight(1f))
                            log.id?.let { id ->
                                IconButton(onClick = { viewModel.deleteHealthLog(ani.id, id) }, modifier = Modifier.size(28.dp)) {
                                    Icon(Icons.Default.Delete, contentDescription = null, tint = FarmDestructive, modifier = Modifier.size(15.dp))
                                }
                            }
                        }
                    }
                }
            },
            confirmButton = { TextButton(onClick = { activeHealthAnimal = null }) { Text("Đóng") } }
        )
    }

    // Theo dõi cân nặng vật nuôi
    if (activeWeightAnimal != null) {
        val ani = activeWeightAnimal!!
        var weightStr by remember { mutableStateOf(ani.weight.toString()) }
        AlertDialog(
            onDismissRequest = { activeWeightAnimal = null },
            title = { Text("Cân Nặng: ${ani.id}", fontWeight = FontWeight.Bold, fontSize = 15.sp) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(value = weightStr, onValueChange = { weightStr = it }, label = { Text("Cân nặng mới (kg)") }, singleLine = true)
                    Button(
                        onClick = { weightStr.toDoubleOrNull()?.let { viewModel.addWeightLog(ani.id, it) } },
                        colors = ButtonDefaults.buttonColors(containerColor = FarmPrimary),
                        modifier = Modifier.fillMaxWidth()
                    ) { Text("Lưu Mốc Cân") }
                    weightLogs.take(6).forEach { log ->
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                            Text("${log.weight} kg", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                            log.id?.let { id ->
                                IconButton(onClick = { viewModel.deleteWeightLog(ani.id, id) }, modifier = Modifier.size(28.dp)) {
                                    Icon(Icons.Default.Delete, contentDescription = null, tint = FarmDestructive, modifier = Modifier.size(15.dp))
                                }
                            }
                        }
                    }
                }
            },
            confirmButton = { TextButton(onClick = { activeWeightAnimal = null }) { Text("Đóng") } }
        )
    }

    // Đo sinh trưởng cây trồng
    if (activeGrowthCrop != null) {
        val crp = activeGrowthCrop!!
        var sizeStr by remember { mutableStateOf("") }
        AlertDialog(
            onDismissRequest = { activeGrowthCrop = null },
            title = { Text("Sinh Trưởng: ${crp.name}", fontWeight = FontWeight.Bold, fontSize = 15.sp) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(value = sizeStr, onValueChange = { sizeStr = it }, label = { Text("Chiều cao / kích thước (cm)") }, singleLine = true)
                    Button(
                        onClick = { sizeStr.toDoubleOrNull()?.let { viewModel.addCropGrowthLog(crp.displayId, it); sizeStr = "" } },
                        colors = ButtonDefaults.buttonColors(containerColor = FarmPrimary),
                        modifier = Modifier.fillMaxWidth()
                    ) { Text("+ Ghi Mốc Đo") }
                    cropGrowthLogs.take(6).forEach { log ->
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                            Text("${log.heightCm} cm", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                            log.id?.let { id ->
                                IconButton(onClick = { viewModel.deleteCropGrowthLog(crp.displayId, id) }, modifier = Modifier.size(28.dp)) {
                                    Icon(Icons.Default.Delete, contentDescription = null, tint = FarmDestructive, modifier = Modifier.size(15.dp))
                                }
                            }
                        }
                    }
                }
            },
            confirmButton = { TextButton(onClick = { activeGrowthCrop = null }) { Text("Đóng") } }
        )
    }

    // Nhật ký chăm sóc cây trồng
    if (activeCareCrop != null) {
        val crp = activeCareCrop!!
        var action by remember { mutableStateOf("Tưới nước") }
        var note by remember { mutableStateOf("") }
        AlertDialog(
            onDismissRequest = { activeCareCrop = null },
            title = { Text("Chăm Sóc: ${crp.name}", fontWeight = FontWeight.Bold, fontSize = 15.sp) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(value = action, onValueChange = { action = it }, label = { Text("Thao tác (Tưới, Bón phân, Phun thuốc)") }, singleLine = true)
                    OutlinedTextField(value = note, onValueChange = { note = it }, label = { Text("Ghi chú chi tiết") }, singleLine = true)
                    Button(
                        onClick = { if (action.isNotBlank()) { viewModel.addCropCareLog(crp.displayId, "Chăm sóc", action, note); note = "" } },
                        colors = ButtonDefaults.buttonColors(containerColor = FarmPrimary),
                        modifier = Modifier.fillMaxWidth()
                    ) { Text("+ Ghi Nhật Ký") }
                    cropCareLogs.take(6).forEach { log ->
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                            Text("${log.materialName ?: log.careType} ${log.notes?.let { "• $it" } ?: ""}", fontSize = 11.sp, modifier = Modifier.weight(1f))
                            log.id?.let { id ->
                                IconButton(onClick = { viewModel.deleteCropCareLog(crp.displayId, id) }, modifier = Modifier.size(28.dp)) {
                                    Icon(Icons.Default.Delete, contentDescription = null, tint = FarmDestructive, modifier = Modifier.size(15.dp))
                                }
                            }
                        }
                    }
                }
            },
            confirmButton = { TextButton(onClick = { activeCareCrop = null }) { Text("Đóng") } }
        )
    }
}

@Composable
fun FilterChipItem(
    label: String,
    isSelected: Boolean,
    onClick: () -> Unit
) {
    Surface(
        onClick = onClick,
        shape = RoundedCornerShape(10.dp),
        color = if (isSelected) FarmPrimary else Color.White,
        border = androidx.compose.foundation.BorderStroke(
            1.dp,
            if (isSelected) FarmPrimary else FarmCardBorderLight
        ),
        modifier = Modifier.height(32.dp)
    ) {
        Text(
            text = label,
            fontSize = 11.sp,
            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
            color = if (isSelected) Color.White else MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)
        )
    }
}

@Composable
fun AnimalItemCard(
    animal: Animal,
    onDelete: () -> Unit,
    onTransferClick: () -> Unit,
    onHealthClick: () -> Unit = {},
    onWeightClick: () -> Unit = {},
    onHarvestClick: () -> Unit = {}
) {
    val progress = (animal.weight / animal.targetWeight.coerceAtLeast(1.0)).toFloat().coerceIn(0f, 1f)
    val speciesIcon = when {
        animal.species.contains("gà", ignoreCase = true) -> "🐔"
        animal.species.contains("bò", ignoreCase = true) -> "🐮"
        animal.species.contains("dê", ignoreCase = true) -> "🐐"
        animal.species.contains("vịt", ignoreCase = true) -> "🦆"
        else -> "🐷"
    }

    Card(
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
        border = androidx.compose.foundation.BorderStroke(1.dp, FarmCardBorderLight),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
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
                            .size(44.dp)
                            .clip(CircleShape)
                            .background(FarmCardBorderLight),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(speciesIcon, fontSize = 22.sp)
                    }

                    Column {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            Text(
                                text = animal.id,
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.onSurface
                            )
                            StatusBadge(animal.status ?: "healthy")
                        }
                        Text(
                            text = animal.species,
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }

                Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    // Nút chuyển chuồng
                    IconButton(
                        onClick = onTransferClick,
                        modifier = Modifier.size(36.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.SwapHoriz,
                            contentDescription = "Chuyển chuồng",
                            tint = FarmPrimary,
                            modifier = Modifier.size(20.dp)
                        )
                    }

                    // Nút xóa
                    IconButton(
                        onClick = onDelete,
                        modifier = Modifier.size(36.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.DeleteOutline,
                            contentDescription = "Xóa vật nuôi",
                            tint = FarmDestructive,
                            modifier = Modifier.size(20.dp)
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Thể trọng và Tiến độ
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Hiện tại: ${animal.weight} kg",
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.Bold,
                    color = FarmPrimary
                )
                Text(
                    text = "Mục tiêu: ${animal.targetWeight} kg (${(progress * 100).toInt()}%)",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            Spacer(modifier = Modifier.height(6.dp))

            LinearProgressIndicator(
                progress = { progress },
                color = FarmPrimary,
                trackColor = FarmCardBorderLight,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(8.dp)
                    .clip(RoundedCornerShape(4.dp))
            )

            Spacer(modifier = Modifier.height(10.dp))

            Row(horizontalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.fillMaxWidth()) {
                OutlinedButton(onClick = onWeightClick, contentPadding = PaddingValues(horizontal = 8.dp, vertical = 4.dp), modifier = Modifier.weight(1f).height(32.dp)) {
                    Text("Cân", fontSize = 11.sp)
                }
                OutlinedButton(onClick = onHealthClick, contentPadding = PaddingValues(horizontal = 8.dp, vertical = 4.dp), modifier = Modifier.weight(1f).height(32.dp)) {
                    Text("Sức khỏe", fontSize = 11.sp)
                }
                Button(onClick = onHarvestClick, colors = ButtonDefaults.buttonColors(containerColor = FarmPrimary), contentPadding = PaddingValues(horizontal = 8.dp, vertical = 4.dp), modifier = Modifier.weight(1f).height(32.dp)) {
                    Text("Xuất chuồng", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

@Composable
fun CropItemCard(
    crop: Crop,
    onDelete: () -> Unit,
    onGrowthClick: () -> Unit = {},
    onCareClick: () -> Unit = {},
    onHarvestClick: () -> Unit = {}
) {
    val cropIcon = when {
        crop.name.contains("dưa", ignoreCase = true) -> "🍈"
        crop.name.contains("cà chua", ignoreCase = true) -> "🍅"
        crop.name.contains("lúa", ignoreCase = true) -> "🌾"
        crop.name.contains("bắp", ignoreCase = true) || crop.name.contains("ngô", ignoreCase = true) -> "🌽"
        crop.name.contains("dâu", ignoreCase = true) -> "🍓"
        else -> "🥬"
    }

    Card(
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
        border = androidx.compose.foundation.BorderStroke(1.dp, FarmCardBorderLight),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
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
                            .size(44.dp)
                            .clip(CircleShape)
                            .background(FarmCardBorderLight),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(cropIcon, fontSize = 22.sp)
                    }

                    Column {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            Text(
                                text = crop.name,
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.onSurface,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                            StatusBadge(crop.status ?: "healthy")
                        }
                        Text(
                            text = "Mã luống: ${crop.displayId} • Số lượng: ${crop.quantity} gốc",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }

                IconButton(
                    onClick = onDelete,
                    modifier = Modifier.size(36.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.DeleteOutline,
                        contentDescription = "Xóa cây trồng",
                        tint = FarmDestructive,
                        modifier = Modifier.size(20.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.height(10.dp))

            Surface(
                shape = RoundedCornerShape(10.dp),
                color = FarmBackgroundLight,
                border = androidx.compose.foundation.BorderStroke(1.dp, FarmCardBorderLight),
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier.padding(10.dp),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(
                        text = "Giai đoạn: ${crop.stage}",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = FarmPrimary
                    )
                    Text(
                        text = "Thu hoạch: ${crop.expectedHarvest}",
                        fontSize = 11.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            Spacer(modifier = Modifier.height(10.dp))

            Row(horizontalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.fillMaxWidth()) {
                OutlinedButton(onClick = onGrowthClick, contentPadding = PaddingValues(horizontal = 8.dp, vertical = 4.dp), modifier = Modifier.weight(1f).height(32.dp)) {
                    Text("Sinh trưởng", fontSize = 11.sp)
                }
                OutlinedButton(onClick = onCareClick, contentPadding = PaddingValues(horizontal = 8.dp, vertical = 4.dp), modifier = Modifier.weight(1f).height(32.dp)) {
                    Text("Chăm sóc", fontSize = 11.sp)
                }
                Button(onClick = onHarvestClick, colors = ButtonDefaults.buttonColors(containerColor = FarmPrimary), contentPadding = PaddingValues(horizontal = 8.dp, vertical = 4.dp), modifier = Modifier.weight(1f).height(32.dp)) {
                    Text("Thu hoạch", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

@Composable
fun StatusBadge(status: String) {
    val (label, bg, fg) = when (status) {
        "ready" -> Triple("Sẵn sàng xuất", FarmSuccess.copy(alpha = 0.15f), FarmSuccess)
        "attention", "Sot nhe" -> Triple("Cần chăm sóc", FarmDestructive.copy(alpha = 0.15f), FarmDestructive)
        "Growing" -> Triple("Đang phát triển", FarmSuccess.copy(alpha = 0.15f), FarmSuccess)
        else -> Triple("Khỏe mạnh", FarmPrimary.copy(alpha = 0.15f), FarmPrimary)
    }

    Surface(
        shape = RoundedCornerShape(6.dp),
        color = bg
    ) {
        Text(
            text = label,
            fontSize = 9.sp,
            fontWeight = FontWeight.Bold,
            color = fg,
            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
        )
    }
}
