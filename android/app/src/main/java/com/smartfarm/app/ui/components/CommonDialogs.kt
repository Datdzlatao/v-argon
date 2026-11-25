package com.smartfarm.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import com.smartfarm.app.data.models.InventoryItem
import com.smartfarm.app.data.models.Pen
import com.smartfarm.app.ui.theme.*
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale

// ==========================================
// 1. HỘP THOẠI THÊM KHU VỰC CHUỒNG / VƯỜN
// ==========================================
@Composable
fun AddPenDialog(
    isOpen: Boolean,
    currentMode: String,
    onDismiss: () -> Unit,
    onConfirm: (id: String, name: String, type: String, cameraUrl: String, webcamUrl: String) -> Unit
) {
    if (!isOpen) return

    var id by remember { mutableStateOf("") }
    var name by remember { mutableStateOf("") }
    var type by remember { mutableStateOf(currentMode) }
    var cameraUrl by remember { mutableStateOf("") }
    var webcamUrl by remember { mutableStateOf("0") }

    Dialog(onDismissRequest = onDismiss) {
        Card(
            shape = RoundedCornerShape(20.dp),
            colors = CardDefaults.cardColors(containerColor = Color.White),
            border = androidx.compose.foundation.BorderStroke(1.dp, FarmCardBorderLight),
            elevation = CardDefaults.cardElevation(defaultElevation = 4.dp),
            modifier = Modifier.fillMaxWidth().padding(12.dp)
        ) {
            Column(
                modifier = Modifier.padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                Text(
                    text = if (type == "livestock") "Thêm Chuồng Trại Mới" else "Thêm Vườn Trồng Mới",
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold,
                    color = FarmPrimary
                )

                OutlinedTextField(
                    value = id,
                    onValueChange = { id = it },
                    label = { Text("Mã khu vực (ví dụ: CHUONG-A03, VUON-B02)") },
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth()
                )

                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Tên khu vực (ví dụ: Chuồng Nuôi Heo Số 3)") },
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth()
                )

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    FilterChip(
                        selected = type == "livestock",
                        onClick = { type = "livestock" },
                        label = { Text("Chăn Nuôi (Chuồng)") },
                        modifier = Modifier.weight(1f)
                    )
                    FilterChip(
                        selected = type == "cultivation",
                        onClick = { type = "cultivation" },
                        label = { Text("Trồng Trọt (Vườn)") },
                        modifier = Modifier.weight(1f)
                    )
                }

                OutlinedTextField(
                    value = cameraUrl,
                    onValueChange = { cameraUrl = it },
                    label = { Text("📱 Luồng 1: IP Camera Điện Thoại (tùy chọn)") },
                    placeholder = { Text("http://192.168.1.X:8080/video hoặc rtsp://...") },
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth()
                )

                OutlinedTextField(
                    value = webcamUrl,
                    onValueChange = { webcamUrl = it },
                    label = { Text("💻 Luồng 2: Webcam Máy Tính (tùy chọn)") },
                    placeholder = { Text("0 (tích hợp) hoặc 1 (USB)") },
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth()
                )

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.End
                ) {
                    TextButton(onClick = onDismiss) { Text("Hủy Bỏ", color = FarmTextMutedLight) }
                    Spacer(modifier = Modifier.width(8.dp))
                    Button(
                        onClick = {
                            if (id.isNotBlank() && name.isNotBlank()) {
                                onConfirm(id.trim(), name.trim(), type, cameraUrl.trim(), webcamUrl.trim().ifBlank { "0" })
                                onDismiss()
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = FarmPrimary),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Text("Tạo Khu Vực", fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}

// ==========================================
// 2. HỘP THOẠI THÊM THIẾT BỊ ĐIỆN
// ==========================================
@Composable
fun AddDeviceDialog(
    isOpen: Boolean,
    penId: String,
    onDismiss: () -> Unit,
    onConfirm: (name: String, pin: Int) -> Unit
) {
    if (!isOpen) return

    var name by remember { mutableStateOf("") }
    var pinStr by remember { mutableStateOf("4") }

    Dialog(onDismissRequest = onDismiss) {
        Card(
            shape = RoundedCornerShape(20.dp),
            colors = CardDefaults.cardColors(containerColor = Color.White),
            border = androidx.compose.foundation.BorderStroke(1.dp, FarmCardBorderLight),
            elevation = CardDefaults.cardElevation(defaultElevation = 4.dp),
            modifier = Modifier.fillMaxWidth().padding(12.dp)
        ) {
            Column(
                modifier = Modifier.padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                Text(
                    text = "Thêm Thiết Bị Điều Khiển",
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold,
                    color = FarmPrimary
                )

                Text(
                    text = "Thiết lập công tắc bật/tắt cho khu vực $penId",
                    style = MaterialTheme.typography.bodyMedium,
                    color = FarmTextMutedLight
                )

                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Tên thiết bị (ví dụ: Quạt hút mùi số 2, Máy tưới)") },
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth()
                )

                OutlinedTextField(
                    value = pinStr,
                    onValueChange = { pinStr = it },
                    label = { Text("Số hiệu chân cắm điều khiển (GPIO 4, 5, 6...)") },
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth()
                )

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.End
                ) {
                    TextButton(onClick = onDismiss) { Text("Hủy Bỏ", color = FarmTextMutedLight) }
                    Spacer(modifier = Modifier.width(8.dp))
                    Button(
                        onClick = {
                            val pin = pinStr.toIntOrNull() ?: 4
                            if (name.isNotBlank()) {
                                onConfirm(name.trim(), pin)
                                onDismiss()
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = FarmPrimary),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Text("Kết Nối Thiết Bị", fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}

// ==========================================
// 3. HỘP THOẠI THÊM VẬT NUÔI
// ==========================================
@Composable
fun AddAnimalDialog(
    isOpen: Boolean,
    penId: String,
    pens: List<Pen> = emptyList(),
    onDismiss: () -> Unit,
    onConfirm: (id: String, species: String, weight: Double, targetWeight: Double, selectedPenId: String) -> Unit
) {
    if (!isOpen) return

    val validPens = remember(pens) {
        pens.filter { it.type == "livestock" || it.type.isBlank() }
    }
    var selectedTargetPen by remember(penId, validPens) {
        mutableStateOf(if (penId.isNotBlank() && penId != "all") penId else (validPens.firstOrNull()?.id ?: ""))
    }
    var id by remember { mutableStateOf("") }
    var species by remember { mutableStateOf("Heo thịt siêu nạc") }
    var weightStr by remember { mutableStateOf("50.0") }
    var targetStr by remember { mutableStateOf("100.0") }

    Dialog(onDismissRequest = onDismiss) {
        Card(
            shape = RoundedCornerShape(20.dp),
            colors = CardDefaults.cardColors(containerColor = Color.White),
            border = androidx.compose.foundation.BorderStroke(1.dp, FarmCardBorderLight),
            elevation = CardDefaults.cardElevation(defaultElevation = 4.dp),
            modifier = Modifier.fillMaxWidth().padding(12.dp)
        ) {
            Column(
                modifier = Modifier.padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                Text(
                    text = "Ghi Nhận Cá Thể Vật Nuôi Mới",
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold,
                    color = FarmPrimary
                )

                if (validPens.isNotEmpty()) {
                    Text(
                        text = "Chọn chuồng nuôi:",
                        style = MaterialTheme.typography.labelMedium,
                        fontWeight = FontWeight.Bold
                    )
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        validPens.forEach { p ->
                            FilterChip(
                                selected = selectedTargetPen == p.id,
                                onClick = { selectedTargetPen = p.id },
                                label = { Text(p.name, fontSize = 11.sp) }
                            )
                        }
                    }
                }

                OutlinedTextField(
                    value = id,
                    onValueChange = { id = it },
                    label = { Text("Mã vật nuôi (ví dụ: HEO-301, BO-102)") },
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth()
                )

                OutlinedTextField(
                    value = species,
                    onValueChange = { species = it },
                    label = { Text("Loại giống vật nuôi (Heo thịt, Bò, Gà...)") },
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth()
                )

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    OutlinedTextField(
                        value = weightStr,
                        onValueChange = { weightStr = it },
                        label = { Text("Cân nặng (kg)") },
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.weight(1f)
                    )
                    OutlinedTextField(
                        value = targetStr,
                        onValueChange = { targetStr = it },
                        label = { Text("Mục tiêu xuất (kg)") },
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.weight(1f)
                    )
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.End
                ) {
                    TextButton(onClick = onDismiss) { Text("Hủy Bỏ", color = FarmTextMutedLight) }
                    Spacer(modifier = Modifier.width(8.dp))
                    Button(
                        onClick = {
                            val w = weightStr.toDoubleOrNull() ?: 50.0
                            val tw = targetStr.toDoubleOrNull() ?: 100.0
                            val finalId = if (id.isNotBlank()) id.trim() else "HEO-${System.currentTimeMillis() % 10000}"
                            val finalPen = if (selectedTargetPen.isNotBlank()) selectedTargetPen else (validPens.firstOrNull()?.id ?: "")
                            onConfirm(finalId, species.trim(), w, tw, finalPen)
                            onDismiss()
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = FarmPrimary),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Text("Thêm Vào Đàn", fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}

// ==========================================
// 4. HỘP THOẠI CHUYỂN CHUỒNG VẬT NUÔI
// ==========================================
@Composable
fun TransferAnimalDialog(
    isOpen: Boolean,
    animalId: String,
    pens: List<Pen>,
    onDismiss: () -> Unit,
    onConfirm: (animalId: String, targetPenId: String, reason: String) -> Unit
) {
    if (!isOpen) return

    var targetPenId by remember { mutableStateOf(pens.firstOrNull()?.id ?: "") }
    var reason by remember { mutableStateOf("Chăm sóc y tế cách ly") }

    Dialog(onDismissRequest = onDismiss) {
        Card(
            shape = RoundedCornerShape(20.dp),
            colors = CardDefaults.cardColors(containerColor = Color.White),
            border = androidx.compose.foundation.BorderStroke(1.dp, FarmCardBorderLight),
            elevation = CardDefaults.cardElevation(defaultElevation = 4.dp),
            modifier = Modifier.fillMaxWidth().padding(12.dp)
        ) {
            Column(
                modifier = Modifier.padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                Text(
                    text = "Chuyển Khu Vực Chuồng Nuôi",
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold,
                    color = FarmPrimary
                )

                Text(
                    text = "Đang chuyển vật nuôi mã: $animalId",
                    style = MaterialTheme.typography.bodyMedium,
                    color = FarmTextMutedLight
                )

                Text(
                    text = "Chọn chuồng nuôi chuyển đến:",
                    style = MaterialTheme.typography.labelMedium,
                    fontWeight = FontWeight.Bold,
                    color = FarmForegroundLight
                )

                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    pens.forEach { pen ->
                        Surface(
                            onClick = { targetPenId = pen.id },
                            shape = RoundedCornerShape(10.dp),
                            color = if (targetPenId == pen.id) FarmPrimary.copy(alpha = 0.12f) else FarmMutedLight,
                            border = androidx.compose.foundation.BorderStroke(
                                1.dp,
                                if (targetPenId == pen.id) FarmPrimary else FarmCardBorderLight
                            ),
                            modifier = Modifier.fillMaxWidth().height(42.dp)
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                modifier = Modifier.padding(horizontal = 12.dp)
                            ) {
                                RadioButton(
                                    selected = targetPenId == pen.id,
                                    onClick = { targetPenId = pen.id },
                                    colors = RadioButtonDefaults.colors(selectedColor = FarmPrimary)
                                )
                                Spacer(modifier = Modifier.width(6.dp))
                                Text(pen.name, style = MaterialTheme.typography.bodyMedium, color = FarmForegroundLight)
                            }
                        }
                    }
                }

                OutlinedTextField(
                    value = reason,
                    onValueChange = { reason = it },
                    label = { Text("Lý do chuyển (tăng trọng, cách ly, xuất chuồng...)") },
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth()
                )

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.End
                ) {
                    TextButton(onClick = onDismiss) { Text("Hủy Bỏ", color = FarmTextMutedLight) }
                    Spacer(modifier = Modifier.width(8.dp))
                    Button(
                        onClick = {
                            if (targetPenId.isNotBlank()) {
                                onConfirm(animalId, targetPenId, reason)
                                onDismiss()
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = FarmPrimary),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Text("Xác Nhận Chuyển", fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}

// ==========================================
// 5. HỘP THOẠI THÊM VỤ MÙA CÂY TRỒNG
// ==========================================
@Composable
fun AddCropDialog(
    isOpen: Boolean,
    penId: String,
    pens: List<Pen> = emptyList(),
    onDismiss: () -> Unit,
    onConfirm: (name: String, quantity: Int, plantDate: String, harvestDate: String, stage: String, selectedPenId: String) -> Unit
) {
    if (!isOpen) return

    val validPens = remember(pens) {
        pens.filter { it.type == "cultivation" || it.type == "crops" || it.type.isBlank() }
    }
    var selectedTargetPen by remember(penId, validPens) {
        mutableStateOf(if (penId.isNotBlank() && penId != "all") penId else (validPens.firstOrNull()?.id ?: ""))
    }

    val todayStr = remember { SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date()) }
    val defaultHarvestStr = remember {
        val cal = Calendar.getInstance()
        cal.add(Calendar.DAY_OF_YEAR, 60)
        SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(cal.time)
    }

    var name by remember { mutableStateOf("Dưa lưới Hoàng Kim") }
    var quantityStr by remember { mutableStateOf("100") }
    var plantDate by remember { mutableStateOf(todayStr) }
    var harvestDate by remember { mutableStateOf(defaultHarvestStr) }
    var stage by remember { mutableStateOf("Growing") }

    Dialog(onDismissRequest = onDismiss) {
        Card(
            shape = RoundedCornerShape(20.dp),
            colors = CardDefaults.cardColors(containerColor = Color.White),
            border = androidx.compose.foundation.BorderStroke(1.dp, FarmCardBorderLight),
            elevation = CardDefaults.cardElevation(defaultElevation = 4.dp),
            modifier = Modifier.fillMaxWidth().padding(12.dp)
        ) {
            Column(
                modifier = Modifier.padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                Text(
                    text = "Ghi Nhận Vụ Mùa Trồng Trọt",
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold,
                    color = FarmSecondary
                )

                if (validPens.isNotEmpty()) {
                    Text(
                        text = "Chọn vườn trồng:",
                        style = MaterialTheme.typography.labelMedium,
                        fontWeight = FontWeight.Bold
                    )
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        validPens.forEach { p ->
                            FilterChip(
                                selected = selectedTargetPen == p.id,
                                onClick = { selectedTargetPen = p.id },
                                label = { Text(p.name, fontSize = 11.sp) }
                            )
                        }
                    }
                }

                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Tên giống cây (Dưa lưới, Cà chua bi, Dâu tây...)") },
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth()
                )

                OutlinedTextField(
                    value = quantityStr,
                    onValueChange = { quantityStr = it },
                    label = { Text("Số lượng cây / luống trồng") },
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth()
                )

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    OutlinedTextField(
                        value = plantDate,
                        onValueChange = { plantDate = it },
                        label = { Text("Ngày gieo (YYYY-MM-DD)") },
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.weight(1f)
                    )
                    OutlinedTextField(
                        value = harvestDate,
                        onValueChange = { harvestDate = it },
                        label = { Text("Ngày thu hoạch (YYYY-MM-DD)") },
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.weight(1f)
                    )
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.End
                ) {
                    TextButton(onClick = onDismiss) { Text("Hủy Bỏ", color = FarmTextMutedLight) }
                    Spacer(modifier = Modifier.width(8.dp))
                    Button(
                        onClick = {
                            val q = quantityStr.toIntOrNull() ?: 50
                            if (name.isNotBlank()) {
                                val finalPen = if (selectedTargetPen.isNotBlank()) selectedTargetPen else (validPens.firstOrNull()?.id ?: "")
                                onConfirm(name.trim(), q, plantDate.trim(), harvestDate.trim(), stage, finalPen)
                                onDismiss()
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = FarmSecondary),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Text("Gieo Trồng", fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}

// ==========================================
// 6. HỘP THOẠI NHẬP HÀNG VÀO KHO
// ==========================================
@Composable
fun ImportInventoryDialog(
    isOpen: Boolean,
    onDismiss: () -> Unit,
    onConfirm: (name: String, category: String, qty: Double, unit: String, price: Double) -> Unit
) {
    if (!isOpen) return

    var name by remember { mutableStateOf("") }
    var category by remember { mutableStateOf("Thức ăn") }
    var qtyStr by remember { mutableStateOf("100.0") }
    var unit by remember { mutableStateOf("kg") }
    var priceStr by remember { mutableStateOf("350000") }

    Dialog(onDismissRequest = onDismiss) {
        Card(
            shape = RoundedCornerShape(20.dp),
            colors = CardDefaults.cardColors(containerColor = Color.White),
            border = androidx.compose.foundation.BorderStroke(1.dp, FarmCardBorderLight),
            elevation = CardDefaults.cardElevation(defaultElevation = 4.dp),
            modifier = Modifier.fillMaxWidth().padding(12.dp)
        ) {
            Column(
                modifier = Modifier.padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                Text(
                    text = "Nhập Hàng Vào Kho Vật Tư",
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold,
                    color = FarmPrimary
                )

                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Tên mặt hàng (Cám heo, Phân bón NPK...)") },
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth()
                )

                OutlinedTextField(
                    value = category,
                    onValueChange = { category = it },
                    label = { Text("Phân loại (Thức ăn, Phân bón, Thuốc thú y, Dụng cụ)") },
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth()
                )

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    OutlinedTextField(
                        value = qtyStr,
                        onValueChange = { qtyStr = it },
                        label = { Text("Số lượng") },
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.weight(1f)
                    )
                    OutlinedTextField(
                        value = unit,
                        onValueChange = { unit = it },
                        label = { Text("Đơn vị (kg, bao, chai)") },
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.weight(1f)
                    )
                }

                OutlinedTextField(
                    value = priceStr,
                    onValueChange = { priceStr = it },
                    label = { Text("Đơn giá (VNĐ/đơn vị)") },
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth()
                )

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.End
                ) {
                    TextButton(onClick = onDismiss) { Text("Hủy Bỏ", color = FarmTextMutedLight) }
                    Spacer(modifier = Modifier.width(8.dp))
                    Button(
                        onClick = {
                            val q = qtyStr.toDoubleOrNull() ?: 1.0
                            val p = priceStr.toDoubleOrNull() ?: 0.0
                            if (name.isNotBlank()) {
                                onConfirm(name.trim(), category, q, unit, p)
                                onDismiss()
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = FarmPrimary),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Text("Nhập Vào Kho", fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}

// ==========================================
// 7. HỘP THOẠI XUẤT DÙNG KHO
// ==========================================
@Composable
fun ExportInventoryDialog(
    isOpen: Boolean,
    selectedItem: InventoryItem?,
    onDismiss: () -> Unit,
    onConfirm: (itemId: String, currentQty: Double, exportQty: Double) -> Unit
) {
    if (!isOpen || selectedItem == null) return

    var exportQtyStr by remember { mutableStateOf("10.0") }

    Dialog(onDismissRequest = onDismiss) {
        Card(
            shape = RoundedCornerShape(20.dp),
            colors = CardDefaults.cardColors(containerColor = Color.White),
            border = androidx.compose.foundation.BorderStroke(1.dp, FarmCardBorderLight),
            elevation = CardDefaults.cardElevation(defaultElevation = 4.dp),
            modifier = Modifier.fillMaxWidth().padding(12.dp)
        ) {
            Column(
                modifier = Modifier.padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                Text(
                    text = "Xuất Dùng Cho Chuồng Trại",
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold,
                    color = FarmWarning
                )

                Text(
                    text = "Mặt hàng: ${selectedItem.name}\nTồn kho hiện có: ${selectedItem.quantity} ${selectedItem.unit}",
                    style = MaterialTheme.typography.bodyMedium,
                    color = FarmTextMutedLight
                )

                OutlinedTextField(
                    value = exportQtyStr,
                    onValueChange = { exportQtyStr = it },
                    label = { Text("Số lượng cần xuất (${selectedItem.unit})") },
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth()
                )

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.End
                ) {
                    TextButton(onClick = onDismiss) { Text("Hủy Bỏ", color = FarmTextMutedLight) }
                    Spacer(modifier = Modifier.width(8.dp))
                    Button(
                        onClick = {
                            val eq = exportQtyStr.toDoubleOrNull() ?: 0.0
                            if (eq > 0) {
                                onConfirm(selectedItem.displayId, selectedItem.quantity, eq)
                                onDismiss()
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = FarmWarning),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Text("Xác Nhận Xuất", fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}

// ==========================================
// 8. HỘP THOẠI CÀI ĐẶT 2 LUỒNG CAMERA CHUỒNG (ĐỒNG BỘ VỚI FRONTEND)
// ==========================================
@Composable
fun ConfigCameraDialog(
    isOpen: Boolean,
    penId: String,
    currentUrl: String?,
    currentWebcamUrl: String? = "0",
    onDismiss: () -> Unit,
    onConfirm: (cameraUrl: String, webcamUrl: String) -> Unit,
    penName: String? = null
) {
    if (!isOpen) return

    var cameraUrl by remember(isOpen, currentUrl) { mutableStateOf(currentUrl ?: "") }
    var webcamUrl by remember(isOpen, currentWebcamUrl) { mutableStateOf(currentWebcamUrl ?: "0") }

    Dialog(onDismissRequest = onDismiss) {
        Card(
            shape = RoundedCornerShape(20.dp),
            colors = CardDefaults.cardColors(containerColor = Color.White),
            border = androidx.compose.foundation.BorderStroke(1.dp, FarmCardBorderLight),
            elevation = CardDefaults.cardElevation(defaultElevation = 6.dp),
            modifier = Modifier.fillMaxWidth().padding(12.dp)
        ) {
            Column(
                modifier = Modifier.padding(18.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.Videocam,
                        contentDescription = null,
                        tint = FarmPrimary,
                        modifier = Modifier.size(24.dp)
                    )
                    Text(
                        text = "Cấu Hình 2 Luồng Camera Chuồng",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = FarmPrimary
                    )
                }

                Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = FarmPrimary.copy(alpha = 0.08f),
                    border = androidx.compose.foundation.BorderStroke(1.dp, FarmPrimary.copy(alpha = 0.2f)),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(10.dp)) {
                        Text(
                            text = "Khu vực: ${penName ?: penId} ($penId)",
                            fontWeight = FontWeight.Bold,
                            fontSize = 12.sp,
                            color = FarmPrimary
                        )
                        Spacer(modifier = Modifier.height(2.dp))
                        Text(
                            text = "Hệ thống hỗ trợ 2 luồng: Luồng 1 là IP Camera từ điện thoại (Port 8080/RTSP) và Luồng 2 là Webcam máy tính (Index 0, 1 hoặc USB).",
                            fontSize = 10.sp,
                            color = FarmForegroundLight.copy(alpha = 0.8f),
                            lineHeight = 14.sp
                        )
                    }
                }

                // 1. IP Cam Điện Thoại
                OutlinedTextField(
                    value = cameraUrl,
                    onValueChange = { cameraUrl = it },
                    label = { Text("📱 Luồng 1: IP Cam Điện Thoại", fontSize = 12.sp) },
                    placeholder = { Text("http://192.168.1.X:8080/video hoặc rtsp://...", fontSize = 11.sp) },
                    shape = RoundedCornerShape(12.dp),
                    textStyle = androidx.compose.ui.text.TextStyle(
                        fontSize = 12.sp,
                        fontFamily = androidx.compose.ui.text.font.FontFamily.Monospace
                    ),
                    modifier = Modifier.fillMaxWidth()
                )

                Row(
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    SuggestionChip(
                        onClick = { cameraUrl = "http://192.168.1.15:8080/video" },
                        label = { Text("IP Webcam (8080)", fontSize = 9.sp) }
                    )
                    SuggestionChip(
                        onClick = { cameraUrl = "http://192.168.1.15:4747/video" },
                        label = { Text("DroidCam (4747)", fontSize = 9.sp) }
                    )
                }

                // 2. Webcam Máy Tính
                OutlinedTextField(
                    value = webcamUrl,
                    onValueChange = { webcamUrl = it },
                    label = { Text("💻 Luồng 2: Webcam Máy Tính", fontSize = 12.sp) },
                    placeholder = { Text("0 (tích hợp), 1 (USB)", fontSize = 11.sp) },
                    shape = RoundedCornerShape(12.dp),
                    textStyle = androidx.compose.ui.text.TextStyle(
                        fontSize = 12.sp,
                        fontFamily = androidx.compose.ui.text.font.FontFamily.Monospace
                    ),
                    modifier = Modifier.fillMaxWidth()
                )

                Row(
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    SuggestionChip(
                        onClick = { webcamUrl = "0" },
                        label = { Text("0 (Webcam tích hợp)", fontSize = 9.sp) }
                    )
                    SuggestionChip(
                        onClick = { webcamUrl = "1" },
                        label = { Text("1 (Webcam USB ngoài)", fontSize = 9.sp) }
                    )
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.End
                ) {
                    TextButton(onClick = onDismiss) { Text("Hủy Bỏ", color = FarmTextMutedLight) }
                    Spacer(modifier = Modifier.width(8.dp))
                    Button(
                        onClick = {
                            onConfirm(cameraUrl.trim(), webcamUrl.trim().ifBlank { "0" })
                            onDismiss()
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = FarmPrimary),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Text("Lưu 2 Luồng Camera", fontWeight = FontWeight.Bold, fontSize = 12.sp)
                    }
                }
            }
        }
    }
}
