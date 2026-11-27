package com.smartfarm.app.ui.screens

import android.content.Context
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.FileDownload
import androidx.compose.material.icons.filled.PersonAdd
import androidx.compose.material.icons.filled.QrCode
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.google.gson.Gson
import com.google.gson.JsonParser
import com.google.gson.annotations.SerializedName
import com.google.gson.reflect.TypeToken
import com.smartfarm.app.data.models.Crop
import com.smartfarm.app.data.remote.ApiConfig
import com.smartfarm.app.data.remote.SupabaseRestClient
import com.smartfarm.app.ui.components.parseCropQrPayload
import com.smartfarm.app.ui.components.rememberQrBitmap
import com.smartfarm.app.ui.theme.*
import com.smartfarm.app.util.rememberCsvExporter
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.TimeUnit

data class FinanceRow(
    val id: Long? = null,
    val type: String = "thu",
    val title: String = "",
    val amount: Double = 0.0,
    @SerializedName("record_date") val recordDate: String? = null
)

data class LeaveRow(
    val id: Long? = null,
    @SerializedName("staff_name") val staffName: String = "",
    val reason: String = "",
    val status: String = "pending"
)

data class QuotaRow(
    val id: Long? = null,
    @SerializedName("staff_name") val staffName: String = "",
    @SerializedName("task_name") val taskName: String = "",
    val target: Double = 0.0,
    val completed: Double = 0.0,
    val unit: String = "kg"
)

data class QrRow(
    val id: Long? = null,
    @SerializedName("product_name") val productName: String = "",
    @SerializedName("lot_code") val lotCode: String = "",
    @SerializedName("video_url") val videoUrl: String = ""
)

data class OfficeEntry(
    val id: String = "",
    val code: String = "",
    val item: String = "",
    val category: String = "thu_chi",
    val quantityOrAmount: Double = 0.0,
    val unit: String = "",
    val status: String = "",
    val note: String = "",
    val hourSlot: String = "",
    val timestampt: String = ""
)

data class StaffWageRow(
    val id: String = "",
    val name: String = "",
    val role: String? = "Nhân viên",
    @SerializedName("pen_id") val penId: String? = "",
    @SerializedName("daily_wage") val dailyWage: Double? = 300000.0
)

@Composable
fun ExtendedModulesScreen(
    onBack: () -> Unit,
    onEnrollFace: (String, String, ByteArray, ByteArray?, ByteArray?) -> Unit = { _, _, _, _, _ -> },
    onQuickAccessCrop: (String, String?) -> Unit = { _, _ -> }
) {
    var selectedTab by remember { mutableStateOf(0) }
    val tabs = listOf("Thu Chi", "Office", "Nhân Sự", "Tem QR")
    val scope = rememberCoroutineScope()
    val supabase = remember { SupabaseRestClient() }
    val httpClient = remember {
        OkHttpClient.Builder()
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(20, TimeUnit.SECONDS)
            .build()
    }
    val gson = remember { Gson() }
    val jsonMedia = remember { "application/json; charset=utf-8".toMediaType() }

    val finances = remember { mutableStateListOf<FinanceRow>() }
    val leaves = remember { mutableStateListOf<LeaveRow>() }
    val quotas = remember { mutableStateListOf<QuotaRow>() }
    val qrs = remember { mutableStateListOf<QrRow>() }
    val cropsList = remember { mutableStateListOf<Crop>() }
    var selectedCropIndex by remember { mutableStateOf(0) }
    var showCropDropdown by remember { mutableStateOf(false) }
    val officeRecords = remember { mutableStateListOf<OfficeEntry>() }
    val staffWages = remember { mutableStateListOf<StaffWageRow>() }
    var editingWageStaff by remember { mutableStateOf<StaffWageRow?>(null) }
    var officeSummary by remember { mutableStateOf("") }
    var isLoading by remember { mutableStateOf(false) }

    // Form states
    var newTitle by remember { mutableStateOf("") }
    var newAmount by remember { mutableStateOf("") }
    var isIncome by remember { mutableStateOf(true) }

    var officeTitle by remember { mutableStateOf("") }
    var leaveStaff by remember { mutableStateOf("") }
    var leaveReason by remember { mutableStateOf("") }
    var quotaStaff by remember { mutableStateOf("") }
    var quotaTask by remember { mutableStateOf("") }
    var quotaTarget by remember { mutableStateOf("") }
    var qrProduct by remember { mutableStateOf("") }
    var qrLot by remember { mutableStateOf("") }
    var qrUrl by remember { mutableStateOf("") }

    val fmt = remember { NumberFormat.getInstance(Locale("vi", "VN")) }
    val today = remember { SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date()) }
    var officeDate by remember { mutableStateOf(today) }
    var officeCatFilter by remember { mutableStateOf("all") }
    var officeSummaryMsg by remember { mutableStateOf("") }
    var newOfficeCat by remember { mutableStateOf("thu_chi") }
    var newOfficeCode by remember { mutableStateOf("") }
    var newOfficeAmount by remember { mutableStateOf("") }
    var newOfficeNote by remember { mutableStateOf("") }
    var editingOffice by remember { mutableStateOf<OfficeEntry?>(null) }
    var showOfficeCatDropdown by remember { mutableStateOf(false) }
    val exportCsv = rememberCsvExporter { _, msg -> officeSummaryMsg = msg }

    suspend fun loadAll() {
        isLoading = true
        try {
            val finList = supabase.queryList<FinanceRow>(
                "farm_finances",
                mapOf("order" to "id.desc", "limit" to "30"),
                object : TypeToken<List<FinanceRow>>() {}
            )
            finances.clear()
            finances.addAll(finList)

            val leaveList = supabase.queryList<LeaveRow>(
                "farm_hr_leaves",
                mapOf("order" to "id.desc", "limit" to "20"),
                object : TypeToken<List<LeaveRow>>() {}
            )
            leaves.clear()
            leaves.addAll(leaveList)

            val quotaList = supabase.queryList<QuotaRow>(
                "farm_hr_quotas",
                mapOf("order" to "id.desc", "limit" to "20"),
                object : TypeToken<List<QuotaRow>>() {}
            )
            quotas.clear()
            quotas.addAll(quotaList)

            val qrList = supabase.queryList<QrRow>(
                "farm_video_qrs",
                mapOf("order" to "id.desc", "limit" to "20"),
                object : TypeToken<List<QrRow>>() {}
            )
            qrs.clear()
            qrs.addAll(qrList)

            val loadedCrops = try {
                supabase.queryList<Crop>(
                    "crops",
                    mapOf("order" to "id.desc"),
                    object : TypeToken<List<Crop>>() {}
                )
            } catch (_: Exception) { emptyList() }
            cropsList.clear()
            cropsList.addAll(loadedCrops)

            val supaStaff = try {
                supabase.queryList<StaffWageRow>(
                    "staff",
                    mapOf("order" to "id.asc"),
                    object : TypeToken<List<StaffWageRow>>() {}
                )
            } catch (_: Exception) { emptyList() }
            if (supaStaff.isNotEmpty()) {
                staffWages.clear()
                staffWages.addAll(supaStaff.map {
                    StaffWageRow(
                        id = it.id,
                        name = it.name.ifBlank { it.id },
                        role = it.role ?: "Nhân viên",
                        penId = it.penId ?: "",
                        dailyWage = it.dailyWage ?: 300000.0
                    )
                })
            }

            withContext(Dispatchers.IO) {
                try {
                    val urlBuilder = StringBuilder("${ApiConfig.backendUrl.trimEnd('/')}/api/office/records?limit=50")
                    if (officeDate.isNotBlank()) urlBuilder.append("&report_date=$officeDate")
                    val req = Request.Builder()
                        .url(urlBuilder.toString())
                        .get()
                        .build()
                    val res = httpClient.newCall(req).execute()
                    val body = res.body?.string() ?: "{}"
                    if (res.isSuccessful) {
                        val root = JsonParser.parseString(body).asJsonObject
                        val arr = when {
                            root.has("records") && root.get("records").isJsonArray -> root.getAsJsonArray("records")
                            root.has("data") && root.get("data").isJsonArray -> root.getAsJsonArray("data")
                            else -> null
                        }
                        val parsed = mutableListOf<OfficeEntry>()
                        arr?.forEach { el ->
                            val o = el.asJsonObject
                            fun str(k: String) = if (o.has(k) && !o.get(k).isJsonNull) o.get(k).asString else ""
                            val id = str("id")
                            val itemText = str("item").ifBlank { str("title") }.ifBlank { str("task_name") }.ifBlank { "Bản ghi Office" }
                            val cat = str("category").ifBlank { "thu_chi" }
                            val qty = if (o.has("quantity_or_amount") && !o.get("quantity_or_amount").isJsonNull) {
                                try { o.get("quantity_or_amount").asDouble } catch (_: Exception) { 0.0 }
                            } else 0.0
                            parsed.add(
                                OfficeEntry(
                                    id = id,
                                    code = str("code"),
                                    item = itemText,
                                    category = cat,
                                    quantityOrAmount = qty,
                                    unit = str("unit"),
                                    status = str("status"),
                                    note = str("note"),
                                    hourSlot = str("hour_slot"),
                                    timestampt = str("timestampt")
                                )
                            )
                        }
                        withContext(Dispatchers.Main) {
                            officeRecords.clear()
                            officeRecords.addAll(parsed)
                        }
                    }

                    if (staffWages.isEmpty()) {
                        val staffReq = Request.Builder()
                            .url("${ApiConfig.backendUrl.trimEnd('/')}/api/staff")
                            .get()
                            .build()
                        val staffRes = httpClient.newCall(staffReq).execute()
                        val staffBody = staffRes.body?.string() ?: "[]"
                        if (staffRes.isSuccessful) {
                            val sArr = JsonParser.parseString(staffBody).asJsonArray
                            val sList = mutableListOf<StaffWageRow>()
                            sArr.forEach { el ->
                                val o = el.asJsonObject
                                val id = if (o.has("id") && !o.get("id").isJsonNull) o.get("id").asString else ""
                                val name = when {
                                    o.has("full_name") && !o.get("full_name").isJsonNull -> o.get("full_name").asString
                                    o.has("name") && !o.get("name").isJsonNull -> o.get("name").asString
                                    else -> id
                                }
                                val role = if (o.has("role") && !o.get("role").isJsonNull) o.get("role").asString else "Nhân viên"
                                val pen = if (o.has("pen_id") && !o.get("pen_id").isJsonNull) o.get("pen_id").asString else ""
                                val wage = if (o.has("daily_wage") && !o.get("daily_wage").isJsonNull) o.get("daily_wage").asDouble else 300000.0
                                sList.add(StaffWageRow(id, name, role, pen, wage))
                            }
                            withContext(Dispatchers.Main) {
                                staffWages.clear()
                                staffWages.addAll(sList)
                            }
                        }
                    }
                } catch (_: Exception) {
                }
            }
        } finally {
            isLoading = false
        }
    }

    LaunchedEffect(Unit) {
        loadAll()
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(FarmBackgroundLight)
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = onBack) {
                    Icon(Icons.Default.ArrowBack, contentDescription = "Quay lại", tint = FarmPrimary)
                }
                Text(
                    text = "Quản Lý Chung V-ARGON",
                    fontSize = 18.sp,
                    fontWeight = FontWeight.ExtraBold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    color = FarmForegroundLight
                )
            }
            IconButton(onClick = { scope.launch { loadAll() } }) {
                Icon(Icons.Default.Refresh, contentDescription = "Làm mới", tint = FarmPrimary)
            }
        }

        if (isLoading) {
            LinearProgressIndicator(modifier = Modifier.fillMaxWidth(), color = FarmPrimary)
        }

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            tabs.forEachIndexed { idx, label ->
                val active = selectedTab == idx
                FilterChip(
                    selected = active,
                    onClick = { selectedTab = idx },
                    label = {
                        Text(
                            text = label,
                            maxLines = 1,
                            softWrap = false,
                            fontWeight = FontWeight.Bold,
                            fontSize = 12.sp
                        )
                    },
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = FarmPrimary,
                        selectedLabelColor = Color.White
                    )
                )
            }
        }

        when (selectedTab) {
            0 -> {
                val thu = finances.filter { it.type == "thu" }.sumOf { it.amount.toLong() }
                val chi = finances.filter { it.type == "chi" }.sumOf { it.amount.toLong() }
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Card(modifier = Modifier.weight(1f), colors = CardDefaults.cardColors(containerColor = Color(0xFFECFDF5))) {
                        Column(modifier = Modifier.padding(10.dp)) {
                            Text("Tổng thu", fontSize = 11.sp, color = FarmPrimary)
                            Text("${fmt.format(thu)}đ", fontWeight = FontWeight.Bold, fontSize = 13.sp, maxLines = 1)
                        }
                    }
                    Card(modifier = Modifier.weight(1f), colors = CardDefaults.cardColors(containerColor = Color(0xFFFEF2F2))) {
                        Column(modifier = Modifier.padding(10.dp)) {
                            Text("Tổng chi", fontSize = 11.sp, color = FarmDestructive)
                            Text("${fmt.format(chi)}đ", fontWeight = FontWeight.Bold, fontSize = 13.sp, maxLines = 1)
                        }
                    }
                }

                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                    FilterChip(
                        selected = isIncome,
                        onClick = { isIncome = !isIncome },
                        label = { Text(if (isIncome) "+Thu" else "-Chi", fontWeight = FontWeight.Bold, maxLines = 1) }
                    )
                    OutlinedTextField(
                        value = newTitle,
                        onValueChange = { newTitle = it },
                        placeholder = { Text("Nội dung", fontSize = 12.sp) },
                        singleLine = true,
                        modifier = Modifier.weight(1f)
                    )
                    OutlinedTextField(
                        value = newAmount,
                        onValueChange = { newAmount = it },
                        placeholder = { Text("Tiền", fontSize = 12.sp) },
                        singleLine = true,
                        modifier = Modifier.width(96.dp)
                    )
                    Button(
                        onClick = {
                            val amt = newAmount.toDoubleOrNull() ?: 0.0
                            if (newTitle.isNotBlank() && amt > 0.0) {
                                val titleCopy = newTitle.trim()
                                val typeStr = if (isIncome) "thu" else "chi"
                                newTitle = ""
                                newAmount = ""
                                scope.launch {
                                    supabase.insert("farm_finances", mapOf(
                                        "type" to typeStr,
                                        "title" to titleCopy,
                                        "amount" to amt,
                                        "record_date" to today
                                    ))
                                    loadAll()
                                }
                            }
                        },
                        shape = RoundedCornerShape(10.dp)
                    ) {
                        Text("Lưu", maxLines = 1)
                    }
                }

                LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(finances, key = { it.id ?: it.hashCode().toLong() }) { item ->
                        Card(colors = CardDefaults.cardColors(containerColor = Color.White)) {
                            Row(
                                modifier = Modifier.fillMaxWidth().padding(12.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(item.title, fontWeight = FontWeight.Bold, fontSize = 13.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                    Text(item.recordDate ?: today, fontSize = 11.sp, color = FarmTextMutedLight)
                                }
                                Text(
                                    text = "${if (item.type == "thu") "+" else "-"}${fmt.format(item.amount.toLong())}đ",
                                    fontWeight = FontWeight.Bold,
                                    color = if (item.type == "thu") FarmPrimary else FarmDestructive,
                                    maxLines = 1
                                )
                                if (item.id != null) {
                                    IconButton(onClick = {
                                        scope.launch {
                                            supabase.delete("farm_finances", "id", item.id.toString())
                                            loadAll()
                                        }
                                    }) {
                                        Icon(Icons.Default.Delete, contentDescription = "Xóa", tint = FarmTextMutedLight)
                                    }
                                }
                            }
                        }
                    }
                }
            }
            1 -> {
                val categoryLabels = mapOf(
                    "tong_ket" to "Tổng kết ngày",
                    "thu_chi" to "Thu chi",
                    "xuat_nhap_kho" to "Xuất nhập kho",
                    "xuat_chuong" to "Xuất chuồng",
                    "thu_hoach" to "Thu hoạch",
                    "nhan_su_khoan" to "Nhân sự & Khoán",
                    "thong_bao" to "Thông báo",
                    "nhat_ky_vat_nuoi" to "Nhật ký vật nuôi",
                    "nhat_ky_tang_truong" to "Nhật ký tăng trưởng"
                )
                val eodRow = officeRecords.firstOrNull { it.category == "tong_ket" }
                val filteredOffice = if (officeCatFilter == "all") officeRecords else officeRecords.filter { it.category == officeCatFilter }

                // Thanh ngày + Tổng hợp + Xuất Excel/CSV
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    OutlinedTextField(
                        value = officeDate,
                        onValueChange = { officeDate = it },
                        label = { Text("Ngày", fontSize = 10.sp) },
                        singleLine = true,
                        modifier = Modifier.width(120.dp)
                    )
                    Button(
                        onClick = {
                            scope.launch {
                                isLoading = true
                                officeSummaryMsg = ""
                                withContext(Dispatchers.IO) {
                                    try {
                                        val payload = gson.toJson(mapOf("target_date" to officeDate))
                                        val req = Request.Builder()
                                            .url("${ApiConfig.backendUrl.trimEnd('/')}/api/office/summarize")
                                            .post(payload.toRequestBody(jsonMedia))
                                            .build()
                                        val res = httpClient.newCall(req).execute()
                                        val body = res.body?.string() ?: "{}"
                                        if (res.isSuccessful) {
                                            val root = JsonParser.parseString(body).asJsonObject
                                            val s = if (root.has("summary") && !root.get("summary").isJsonNull) root.get("summary").asString else "Đã tổng hợp cuối ngày."
                                            withContext(Dispatchers.Main) {
                                                officeSummary = s
                                                officeSummaryMsg = "✅ Đã tổng hợp V-Argon Office ngày $officeDate"
                                            }
                                        }
                                    } catch (e: Exception) {
                                        withContext(Dispatchers.Main) { officeSummaryMsg = "⚠️ Lỗi tổng hợp: ${e.message}" }
                                    }
                                }
                                loadAll()
                                isLoading = false
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF15803D)),
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier.weight(1f)
                    ) {
                        Icon(Icons.Default.AutoAwesome, contentDescription = null, modifier = Modifier.size(15.dp))
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("Tổng hợp", fontSize = 11.sp, fontWeight = FontWeight.Bold, maxLines = 1)
                    }
                    OutlinedButton(
                        onClick = {
                            exportCsv(
                                "v-argon-office-$officeDate",
                                listOf("Giờ", "Phân loại", "Mã", "Nội dung", "Số lượng / Giá trị", "Đơn vị", "Trạng thái", "Ghi chú"),
                                officeRecords.map { r ->
                                    listOf(
                                        r.timestampt.ifBlank { r.hourSlot },
                                        categoryLabels[r.category] ?: r.category,
                                        r.code,
                                        r.item,
                                        r.quantityOrAmount,
                                        r.unit,
                                        r.status,
                                        r.note
                                    )
                                }
                            )
                        },
                        shape = RoundedCornerShape(10.dp)
                    ) {
                        Icon(Icons.Default.FileDownload, contentDescription = "Xuất Excel", modifier = Modifier.size(16.dp))
                    }
                }

                if (officeSummaryMsg.isNotBlank()) {
                    Text(officeSummaryMsg, fontSize = 11.sp, color = FarmPrimary, fontWeight = FontWeight.SemiBold)
                }

                // Banner AI Tổng Kết Cuối Ngày
                if (eodRow != null || officeSummary.isNotBlank()) {
                    Card(colors = CardDefaults.cardColors(containerColor = Color(0xFFF3E8FF)), shape = RoundedCornerShape(12.dp)) {
                        Column(modifier = Modifier.padding(10.dp), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                            Text(
                                text = eodRow?.item ?: "Tổng kết cuối ngày AI",
                                fontWeight = FontWeight.Bold,
                                fontSize = 12.sp,
                                color = Color(0xFF581C87)
                            )
                            Text(
                                text = eodRow?.note?.ifBlank { officeSummary } ?: officeSummary,
                                fontSize = 11.sp,
                                color = Color(0xFF3B0764)
                            )
                        }
                    }
                }

                // 9 Category Filter Pills với số lượng
                val filterChips = listOf("all" to "Tất cả (${officeRecords.size})") + categoryLabels.entries.map { (k, label) ->
                    val cnt = officeRecords.count { it.category == k }
                    k to "$label ($cnt)"
                }
                Row(
                    modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    filterChips.forEach { (id, label) ->
                        FilterChip(
                            selected = officeCatFilter == id,
                            onClick = { officeCatFilter = id },
                            label = { Text(label, fontSize = 11.sp) }
                        )
                    }
                }

                // Form thêm bản ghi Office đầy đủ
                Card(colors = CardDefaults.cardColors(containerColor = Color.White), shape = RoundedCornerShape(12.dp)) {
                    Column(modifier = Modifier.padding(10.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            Box(modifier = Modifier.weight(1f)) {
                                OutlinedButton(
                                    onClick = { showOfficeCatDropdown = true },
                                    shape = RoundedCornerShape(8.dp),
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Text(categoryLabels[newOfficeCat] ?: newOfficeCat, fontSize = 11.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                }
                                DropdownMenu(expanded = showOfficeCatDropdown, onDismissRequest = { showOfficeCatDropdown = false }) {
                                    categoryLabels.filterKeys { it != "tong_ket" }.forEach { (k, v) ->
                                        DropdownMenuItem(
                                            text = { Text(v, fontSize = 12.sp) },
                                            onClick = {
                                                newOfficeCat = k
                                                showOfficeCatDropdown = false
                                            }
                                        )
                                    }
                                }
                            }
                            OutlinedTextField(
                                value = newOfficeCode,
                                onValueChange = { newOfficeCode = it },
                                placeholder = { Text("Mã (LO-01)", fontSize = 11.sp) },
                                singleLine = true,
                                modifier = Modifier.width(96.dp)
                            )
                            OutlinedTextField(
                                value = newOfficeAmount,
                                onValueChange = { newOfficeAmount = it },
                                placeholder = { Text("SL/Tiền", fontSize = 11.sp) },
                                singleLine = true,
                                modifier = Modifier.width(88.dp)
                            )
                        }
                        OutlinedTextField(
                            value = officeTitle,
                            onValueChange = { officeTitle = it },
                            placeholder = { Text("Nội dung bản ghi Office...", fontSize = 12.sp) },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth()
                        )
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                            OutlinedTextField(
                                value = newOfficeNote,
                                onValueChange = { newOfficeNote = it },
                                placeholder = { Text("Ghi chú...", fontSize = 12.sp) },
                                singleLine = true,
                                modifier = Modifier.weight(1f)
                            )
                            Button(
                                onClick = {
                                    if (officeTitle.isNotBlank()) {
                                        val payloadMap = mapOf(
                                            "category" to newOfficeCat,
                                            "code" to newOfficeCode.trim().ifBlank { "OFF-${officeRecords.size + 1}" },
                                            "item" to officeTitle.trim(),
                                            "title" to officeTitle.trim(),
                                            "quantity_or_amount" to (newOfficeAmount.toDoubleOrNull() ?: 0.0),
                                            "unit" to if (newOfficeCat == "thu_chi") "VNĐ" else "",
                                            "status" to "Ghi nhận thủ công",
                                            "note" to newOfficeNote.trim(),
                                            "report_date" to officeDate
                                        )
                                        officeTitle = ""
                                        newOfficeCode = ""
                                        newOfficeAmount = ""
                                        newOfficeNote = ""
                                        scope.launch {
                                            withContext(Dispatchers.IO) {
                                                val req = Request.Builder()
                                                    .url("${ApiConfig.backendUrl.trimEnd('/')}/api/office/records")
                                                    .post(gson.toJson(payloadMap).toRequestBody(jsonMedia))
                                                    .build()
                                                httpClient.newCall(req).execute().close()
                                            }
                                            loadAll()
                                        }
                                    }
                                },
                                colors = ButtonDefaults.buttonColors(containerColor = FarmPrimary),
                                shape = RoundedCornerShape(10.dp)
                            ) { Text("Lưu") }
                        }
                    }
                }

                // Danh sách bản ghi Office
                LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(filteredOffice, key = { it.id.ifEmpty { it.hashCode().toString() } }) { rec ->
                        Card(colors = CardDefaults.cardColors(containerColor = Color.White)) {
                            Row(
                                modifier = Modifier.fillMaxWidth().padding(12.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                                        Surface(color = Color(0xFFECFDF5), shape = RoundedCornerShape(6.dp)) {
                                            Text(
                                                text = categoryLabels[rec.category] ?: rec.category,
                                                fontSize = 10.sp,
                                                fontWeight = FontWeight.Bold,
                                                color = FarmPrimary,
                                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                            )
                                        }
                                        if (rec.code.isNotBlank()) {
                                            Text(rec.code, fontSize = 10.sp, fontWeight = FontWeight.Bold, color = FarmTextMutedLight)
                                        }
                                        if (rec.hourSlot.isNotBlank()) {
                                            Text(rec.hourSlot, fontSize = 10.sp, color = FarmTextMutedLight)
                                        }
                                    }
                                    Text(rec.item, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                                    if (rec.quantityOrAmount != 0.0 || rec.status.isNotBlank()) {
                                        Text(
                                            text = "${if (rec.quantityOrAmount != 0.0) "${fmt.format(rec.quantityOrAmount.toLong())} ${rec.unit}" else ""}${if (rec.status.isNotBlank()) " • ${rec.status}" else ""}".trim(' ', '•'),
                                            fontSize = 11.sp,
                                            color = FarmPrimary,
                                            fontWeight = FontWeight.SemiBold
                                        )
                                    }
                                    if (rec.note.isNotBlank()) {
                                        Text(rec.note, fontSize = 11.sp, color = FarmTextMutedLight)
                                    }
                                }
                                if (rec.id.isNotBlank()) {
                                    Row {
                                        IconButton(onClick = { editingOffice = rec }) {
                                            Icon(Icons.Default.Edit, contentDescription = "Sửa", tint = FarmPrimary, modifier = Modifier.size(18.dp))
                                        }
                                        IconButton(onClick = {
                                            scope.launch {
                                                withContext(Dispatchers.IO) {
                                                    val req = Request.Builder()
                                                        .url("${ApiConfig.backendUrl.trimEnd('/')}/api/office/records/${rec.id}")
                                                        .delete()
                                                        .build()
                                                    httpClient.newCall(req).execute().close()
                                                }
                                                loadAll()
                                            }
                                        }) {
                                            Icon(Icons.Default.Delete, contentDescription = "Xóa", tint = FarmTextMutedLight, modifier = Modifier.size(18.dp))
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                if (editingOffice != null) {
                    val target = editingOffice!!
                    var editItem by remember(target.id) { mutableStateOf(target.item) }
                    var editAmount by remember(target.id) { mutableStateOf(target.quantityOrAmount.toLong().toString()) }
                    var editNote by remember(target.id) { mutableStateOf(target.note) }
                    AlertDialog(
                        onDismissRequest = { editingOffice = null },
                        title = { Text("Sửa Bản Ghi Office", fontWeight = FontWeight.Bold, fontSize = 15.sp) },
                        text = {
                            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                OutlinedTextField(value = editItem, onValueChange = { editItem = it }, label = { Text("Nội dung") }, singleLine = true)
                                OutlinedTextField(value = editAmount, onValueChange = { editAmount = it }, label = { Text("Số lượng / Giá trị") }, singleLine = true)
                                OutlinedTextField(value = editNote, onValueChange = { editNote = it }, label = { Text("Ghi chú") })
                            }
                        },
                        confirmButton = {
                            Button(
                                onClick = {
                                    scope.launch {
                                        withContext(Dispatchers.IO) {
                                            val payload = gson.toJson(mapOf(
                                                "item" to editItem.trim(),
                                                "quantity_or_amount" to (editAmount.toDoubleOrNull() ?: target.quantityOrAmount),
                                                "note" to editNote.trim()
                                            ))
                                            val req = Request.Builder()
                                                .url("${ApiConfig.backendUrl.trimEnd('/')}/api/office/records/${target.id}")
                                                .patch(payload.toRequestBody(jsonMedia))
                                                .build()
                                            httpClient.newCall(req).execute().close()
                                        }
                                        editingOffice = null
                                        loadAll()
                                    }
                                },
                                colors = ButtonDefaults.buttonColors(containerColor = FarmPrimary)
                            ) { Text("Lưu") }
                        },
                        dismissButton = { TextButton(onClick = { editingOffice = null }) { Text("Hủy") } }
                    )
                }
            }
            2 -> {
                var showHrEnrollDialog by remember { mutableStateOf(false) }
                val context = androidx.compose.ui.platform.LocalContext.current
                val prefs = remember { context.getSharedPreferences("smartfarm_hr_workdays", Context.MODE_PRIVATE) }
                val workDaysMap = remember {
                    mutableStateMapOf<String, Double>().apply {
                        prefs.all.forEach { (k, v) ->
                            val d = v?.toString()?.toDoubleOrNull()
                            if (d != null) put(k, d)
                        }
                    }
                }
                fun updateWorkDays(staffId: String, days: Double) {
                    val clamped = (kotlin.math.round(days.coerceAtLeast(0.0) * 10.0) / 10.0)
                    workDaysMap[staffId] = clamped
                    prefs.edit().putString(staffId, clamped.toString()).apply()
                }

                val grandTotalDays = staffWages.sumOf { workDaysMap[it.id] ?: 0.0 }
                val grandTotalPay = staffWages.sumOf { s ->
                    val w = s.dailyWage ?: 300000.0
                    val d = workDaysMap[s.id] ?: 0.0
                    kotlin.math.round(w * d).toLong()
                }

                LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    // Header + Nút Thêm khuôn mặt + Xuất Excel Công & Lương
                    item {
                        Card(colors = CardDefaults.cardColors(containerColor = Color(0xFFEEF2FF)), shape = RoundedCornerShape(14.dp)) {
                            Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                Text("Bảng Nhân Sự, Tiền Công & Ghi Công (DB staff)", fontWeight = FontWeight.Bold, fontSize = 14.sp, color = Color(0xFF1E1B4B))
                                Text("Thiết lập mức tiền công 1 ngày, ghi số ngày công để tự tính thành tiền và xuất Excel.", fontSize = 11.sp, color = Color(0xFF3730A3))
                                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    Button(
                                        onClick = { showHrEnrollDialog = true },
                                        colors = ButtonDefaults.buttonColors(containerColor = FarmPrimary),
                                        shape = RoundedCornerShape(10.dp),
                                        modifier = Modifier.weight(1f)
                                    ) {
                                        Icon(Icons.Default.PersonAdd, contentDescription = null, modifier = Modifier.size(16.dp))
                                        Spacer(modifier = Modifier.width(4.dp))
                                        Text("Thêm khuôn mặt", fontSize = 11.sp, fontWeight = FontWeight.Bold, maxLines = 1)
                                    }
                                    OutlinedButton(
                                        onClick = {
                                            val rows = staffWages.map { s ->
                                                val w = (s.dailyWage ?: 300000.0).toLong()
                                                val d = workDaysMap[s.id] ?: 0.0
                                                val total = kotlin.math.round(w * d).toLong()
                                                listOf(s.id, s.name, s.role ?: "Nhân viên", s.penId ?: "", w, d, total)
                                            } + listOf(listOf("", "TỔNG CỘNG", "", "", "", grandTotalDays, grandTotalPay))
                                            exportCsv(
                                                "bang-cong-luong-nhan-su-$today",
                                                listOf("Mã NV", "Họ tên", "Chức vụ", "Khu", "Tiền công / ngày (VNĐ)", "Số ngày công", "Thành tiền (VNĐ)"),
                                                rows
                                            )
                                        },
                                        shape = RoundedCornerShape(10.dp)
                                    ) {
                                        Icon(Icons.Default.FileDownload, contentDescription = null, modifier = Modifier.size(16.dp))
                                        Spacer(modifier = Modifier.width(4.dp))
                                        Text("Xuất Excel", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                                    }
                                }
                            }
                        }
                    }

                    if (staffWages.isEmpty()) {
                        item {
                            Card(colors = CardDefaults.cardColors(containerColor = Color.White)) {
                                Text("Chưa có nhân sự trong bảng staff.", modifier = Modifier.padding(16.dp), fontSize = 12.sp, color = FarmTextMutedLight)
                            }
                        }
                    } else {
                        items(staffWages, key = { "staff_${it.id}" }) { s ->
                            val wageVal = (s.dailyWage ?: 300000.0).toLong()
                            val days = workDaysMap[s.id] ?: 0.0
                            val totalPay = kotlin.math.round(wageVal * days).toLong()
                            Card(colors = CardDefaults.cardColors(containerColor = Color.White), shape = RoundedCornerShape(14.dp)) {
                                Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Column(modifier = Modifier.weight(1f)) {
                                            Text("${s.name} (ID: ${s.id})", fontWeight = FontWeight.Bold, fontSize = 14.sp)
                                            Text("${s.role ?: "Nhân viên"}${if (!s.penId.isNullOrBlank()) " • Khu ${s.penId}" else ""}", fontSize = 11.sp, color = FarmTextMutedLight)
                                        }
                                        TextButton(onClick = { editingWageStaff = s }) {
                                            Text("${fmt.format(wageVal)} đ/ngày", fontWeight = FontWeight.Bold, fontSize = 12.sp, color = Color(0xFF4338CA))
                                        }
                                    }

                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                            Text("Công:", fontSize = 12.sp, color = FarmTextMutedLight, fontWeight = FontWeight.Medium)
                                            FilledTonalButton(
                                                onClick = { updateWorkDays(s.id, days - 0.5) },
                                                contentPadding = PaddingValues(horizontal = 10.dp, vertical = 2.dp),
                                                modifier = Modifier.height(30.dp)
                                            ) { Text("-0.5", fontSize = 11.sp, fontWeight = FontWeight.Bold) }
                                            Text("$days ngày", fontWeight = FontWeight.Bold, fontSize = 13.sp)
                                            FilledTonalButton(
                                                onClick = { updateWorkDays(s.id, days + 1.0) },
                                                contentPadding = PaddingValues(horizontal = 10.dp, vertical = 2.dp),
                                                modifier = Modifier.height(30.dp)
                                            ) { Text("+1", fontSize = 11.sp, fontWeight = FontWeight.Bold) }
                                        }
                                        Text(
                                            text = "${fmt.format(totalPay)} đ",
                                            fontWeight = FontWeight.ExtraBold,
                                            fontSize = 14.sp,
                                            color = FarmPrimary
                                        )
                                    }
                                }
                            }
                        }

                        // Tổng cộng
                        item {
                            Card(colors = CardDefaults.cardColors(containerColor = Color(0xFFECFDF5)), shape = RoundedCornerShape(12.dp)) {
                                Row(
                                    modifier = Modifier.fillMaxWidth().padding(12.dp),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text("Tổng cộng ($grandTotalDays ngày công)", fontWeight = FontWeight.Bold, fontSize = 13.sp, color = FarmPrimary)
                                    Text("${fmt.format(grandTotalPay)} đ", fontWeight = FontWeight.ExtraBold, fontSize = 15.sp, color = FarmPrimary)
                                }
                            }
                        }
                    }
                }

                if (editingWageStaff != null) {
                    val target = editingWageStaff!!
                    var wageStr by remember(target.id) { mutableStateOf((target.dailyWage ?: 300000.0).toLong().toString()) }
                    AlertDialog(
                        onDismissRequest = { editingWageStaff = null },
                        title = { Text("Cập Nhật Lương: ${target.name}", fontWeight = FontWeight.Bold, fontSize = 15.sp) },
                        text = {
                            OutlinedTextField(value = wageStr, onValueChange = { wageStr = it }, label = { Text("Tiền công / ngày (VNĐ)") }, singleLine = true)
                        },
                        confirmButton = {
                            Button(onClick = {
                                val w = wageStr.toDoubleOrNull()
                                if (w != null && w >= 0) {
                                    scope.launch {
                                        try {
                                            supabase.update("staff", "id", target.id, mapOf("daily_wage" to w.toLong()))
                                        } catch (_: Exception) {}
                                        withContext(Dispatchers.IO) {
                                            try {
                                                val payload = gson.toJson(mapOf("daily_wage" to w))
                                                val req = Request.Builder()
                                                    .url("${ApiConfig.backendUrl.trimEnd('/')}/api/staff/${target.id}/wage")
                                                    .patch(payload.toRequestBody(jsonMedia))
                                                    .build()
                                                httpClient.newCall(req).execute().close()
                                            } catch (_: Exception) {}
                                        }
                                        editingWageStaff = null
                                        loadAll()
                                    }
                                }
                            }, colors = ButtonDefaults.buttonColors(containerColor = FarmPrimary)) { Text("Lưu") }
                        },
                        dismissButton = { TextButton(onClick = { editingWageStaff = null }) { Text("Hủy") } }
                    )
                }

                if (showHrEnrollDialog) {
                    EnrollFaceDialog(
                        onDismiss = { showHrEnrollDialog = false },
                        onEnroll = { _, name, role, b1, b2, b3 ->
                            showHrEnrollDialog = false
                            onEnrollFace(name, role, b1, b2, b3)
                        }
                    )
                }
            }
            else -> {
                val currentCrop = cropsList.getOrNull(selectedCropIndex)
                Card(colors = CardDefaults.cardColors(containerColor = Color.White), shape = RoundedCornerShape(14.dp)) {
                    Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("Chọn Cây Trồng Để Tạo Mã QR Truy Cập Nhanh", fontWeight = FontWeight.Bold, fontSize = 13.sp, color = FarmPrimary)
                        Box {
                            OutlinedButton(
                                onClick = { if (cropsList.isNotEmpty()) showCropDropdown = true },
                                shape = RoundedCornerShape(10.dp),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Text(
                                    text = if (currentCrop != null) "🌱 ${currentCrop.name} (ID #${currentCrop.id} • Khu ${currentCrop.penId ?: "---"})" else "Chưa có cây trồng trong DB",
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis,
                                    fontSize = 12.sp
                                )
                            }
                            DropdownMenu(expanded = showCropDropdown, onDismissRequest = { showCropDropdown = false }) {
                                cropsList.forEachIndexed { idx, crop ->
                                    DropdownMenuItem(
                                        text = { Text("🌱 ${crop.name} (ID #${crop.id} • Khu ${crop.penId ?: "---"})", fontSize = 12.sp) },
                                        onClick = {
                                            selectedCropIndex = idx
                                            showCropDropdown = false
                                        }
                                    )
                                }
                            }
                        }
                        Button(
                            onClick = {
                                if (currentCrop != null) {
                                    val penPart = if (!currentCrop.penId.isNullOrBlank()) "&pen_id=${currentCrop.penId}" else ""
                                    val quickUrl = "${ApiConfig.backendUrl.trimEnd('/')}/?crop_id=${currentCrop.id}$penPart"
                                    val lotLabel = "CROP-${currentCrop.id}${if (!currentCrop.penId.isNullOrBlank()) " • Khu ${currentCrop.penId}" else ""}"
                                    scope.launch {
                                        supabase.insert("farm_video_qrs", mapOf(
                                            "product_name" to currentCrop.name,
                                            "lot_code" to lotLabel,
                                            "video_url" to quickUrl
                                        ))
                                        loadAll()
                                    }
                                }
                            },
                            enabled = currentCrop != null,
                            colors = ButtonDefaults.buttonColors(containerColor = FarmPrimary),
                            shape = RoundedCornerShape(10.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Icon(Icons.Default.QrCode, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("Tạo Mã QR Cây Trồng", fontWeight = FontWeight.Bold)
                        }
                    }
                }

                LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(qrs, key = { it.id ?: it.hashCode().toLong() }) { q ->
                        val qrBmp = rememberQrBitmap(q.videoUrl, 160)
                        Card(colors = CardDefaults.cardColors(containerColor = Color.White)) {
                            Row(
                                modifier = Modifier.fillMaxWidth().padding(12.dp),
                                horizontalArrangement = Arrangement.spacedBy(10.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                if (qrBmp != null) {
                                    Image(
                                        bitmap = qrBmp.asImageBitmap(),
                                        contentDescription = q.productName,
                                        modifier = Modifier.size(58.dp)
                                    )
                                }
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(q.productName, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                                    Text(q.lotCode, fontSize = 11.sp, color = FarmTextMutedLight, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                }
                                TextButton(onClick = {
                                    val parsed = parseCropQrPayload(q.videoUrl)
                                    if (!parsed.cropId.isNullOrBlank()) {
                                        onQuickAccessCrop(parsed.cropId, parsed.penId)
                                    }
                                }) {
                                    Text("Mở", color = FarmPrimary, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                                }
                                if (q.id != null) {
                                    IconButton(onClick = {
                                        scope.launch {
                                            supabase.delete("farm_video_qrs", "id", q.id.toString())
                                            loadAll()
                                        }
                                    }) {
                                        Icon(Icons.Default.Delete, contentDescription = "Xóa", tint = FarmTextMutedLight)
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
