package com.smartfarm.app.ui.screens

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
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.google.gson.Gson
import com.google.gson.JsonParser
import com.google.gson.annotations.SerializedName
import com.google.gson.reflect.TypeToken
import com.smartfarm.app.data.remote.ApiConfig
import com.smartfarm.app.data.remote.SupabaseRestClient
import com.smartfarm.app.ui.theme.*
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
    val id: String,
    val title: String,
    val category: String
)

@Composable
fun ExtendedModulesScreen(onBack: () -> Unit) {
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
    val officeRecords = remember { mutableStateListOf<OfficeEntry>() }
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

            withContext(Dispatchers.IO) {
                try {
                    val req = Request.Builder()
                        .url("${ApiConfig.backendUrl.trimEnd('/')}/api/office/records?limit=20")
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
                            val id = if (o.has("id") && !o.get("id").isJsonNull) o.get("id").asString else ""
                            val title = when {
                                o.has("title") && !o.get("title").isJsonNull -> o.get("title").asString
                                o.has("task_name") && !o.get("task_name").isJsonNull -> o.get("task_name").asString
                                else -> "Bản ghi Office"
                            }
                            val cat = if (o.has("category") && !o.get("category").isJsonNull) o.get("category").asString else "Office"
                            parsed.add(OfficeEntry(id, title, cat))
                        }
                        withContext(Dispatchers.Main) {
                            officeRecords.clear()
                            officeRecords.addAll(parsed)
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
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    OutlinedTextField(
                        value = officeTitle,
                        onValueChange = { officeTitle = it },
                        placeholder = { Text("Thêm ghi chép Office...", fontSize = 12.sp) },
                        singleLine = true,
                        modifier = Modifier.weight(1f)
                    )
                    Button(
                        onClick = {
                            if (officeTitle.isNotBlank()) {
                                val t = officeTitle.trim()
                                officeTitle = ""
                                scope.launch {
                                    withContext(Dispatchers.IO) {
                                        val payload = gson.toJson(mapOf("title" to t, "category" to "Nhật ký"))
                                        val req = Request.Builder()
                                            .url("${ApiConfig.backendUrl.trimEnd('/')}/api/office/records")
                                            .post(payload.toRequestBody(jsonMedia))
                                            .build()
                                        httpClient.newCall(req).execute().close()
                                    }
                                    loadAll()
                                }
                            }
                        },
                        shape = RoundedCornerShape(10.dp)
                    ) { Text("Lưu") }
                }

                Button(
                    onClick = {
                        scope.launch {
                            isLoading = true
                            withContext(Dispatchers.IO) {
                                try {
                                    val req = Request.Builder()
                                        .url("${ApiConfig.backendUrl.trimEnd('/')}/api/office/summarize")
                                        .post("{\"limit\":15}".toRequestBody(jsonMedia))
                                        .build()
                                    val res = httpClient.newCall(req).execute()
                                    val body = res.body?.string() ?: "{}"
                                    if (res.isSuccessful) {
                                        val root = JsonParser.parseString(body).asJsonObject
                                        val s = if (root.has("summary")) root.get("summary").asString else ""
                                        withContext(Dispatchers.Main) { officeSummary = s }
                                    }
                                } catch (_: Exception) {
                                }
                            }
                            isLoading = false
                        }
                    },
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF4F46E5))
                ) {
                    Text("AI Tổng hợp V-Argon Office")
                }

                if (officeSummary.isNotBlank()) {
                    Card(colors = CardDefaults.cardColors(containerColor = Color(0xFFEEF2FF))) {
                        Text(officeSummary, modifier = Modifier.padding(12.dp), fontSize = 12.sp, color = Color(0xFF312E81))
                    }
                }

                LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(officeRecords, key = { it.id.ifEmpty { it.hashCode().toString() } }) { rec ->
                        Card(colors = CardDefaults.cardColors(containerColor = Color.White)) {
                            Row(
                                modifier = Modifier.fillMaxWidth().padding(12.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(rec.title, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                                    Text(rec.category, fontSize = 11.sp, color = FarmTextMutedLight)
                                }
                                if (rec.id.isNotBlank()) {
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
                                        Icon(Icons.Default.Delete, contentDescription = "Xóa", tint = FarmTextMutedLight)
                                    }
                                }
                            }
                        }
                    }
                }
            }
            2 -> {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                    OutlinedTextField(
                        value = leaveStaff,
                        onValueChange = { leaveStaff = it },
                        placeholder = { Text("Nhân viên", fontSize = 12.sp) },
                        singleLine = true,
                        modifier = Modifier.weight(1f)
                    )
                    OutlinedTextField(
                        value = leaveReason,
                        onValueChange = { leaveReason = it },
                        placeholder = { Text("Lý do nghỉ", fontSize = 12.sp) },
                        singleLine = true,
                        modifier = Modifier.weight(1f)
                    )
                    Button(
                        onClick = {
                            if (leaveStaff.isNotBlank() && leaveReason.isNotBlank()) {
                                val st = leaveStaff.trim()
                                val rs = leaveReason.trim()
                                leaveStaff = ""
                                leaveReason = ""
                                scope.launch {
                                    supabase.insert("farm_hr_leaves", mapOf(
                                        "staff_name" to st,
                                        "reason" to rs,
                                        "leave_date" to today,
                                        "status" to "pending"
                                    ))
                                    loadAll()
                                }
                            }
                        },
                        shape = RoundedCornerShape(10.dp)
                    ) { Text("Gửi") }
                }

                LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(leaves, key = { it.id ?: it.hashCode().toLong() }) { l ->
                        Card(colors = CardDefaults.cardColors(containerColor = Color.White)) {
                            Row(
                                modifier = Modifier.fillMaxWidth().padding(12.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(l.staffName, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                                    Text(l.reason, fontSize = 12.sp, color = FarmTextMutedLight)
                                }
                                if (l.status == "pending" && l.id != null) {
                                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                        TextButton(onClick = {
                                            scope.launch {
                                                supabase.update("farm_hr_leaves", "id", l.id.toString(), mapOf("status" to "approved"))
                                                loadAll()
                                            }
                                        }) { Text("Duyệt", color = FarmPrimary, fontWeight = FontWeight.Bold) }
                                    }
                                } else {
                                    Text(
                                        text = if (l.status == "approved") "Đã duyệt" else "Từ chối",
                                        color = if (l.status == "approved") FarmPrimary else FarmDestructive,
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 12.sp
                                    )
                                }
                            }
                        }
                    }
                    items(quotas, key = { (it.id ?: it.hashCode().toLong()) + 100000L }) { q ->
                        Card(colors = CardDefaults.cardColors(containerColor = Color(0xFFF0F9FF))) {
                            Row(
                                modifier = Modifier.fillMaxWidth().padding(12.dp),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Text("Khoán: ${q.staffName} • ${q.taskName}", fontWeight = FontWeight.Bold, fontSize = 12.sp)
                                Text("${q.completed.toInt()}/${q.target.toInt()} ${q.unit}", color = FarmPrimary, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                            }
                        }
                    }
                }
            }
            else -> {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                    OutlinedTextField(
                        value = qrProduct,
                        onValueChange = { qrProduct = it },
                        placeholder = { Text("Sản phẩm", fontSize = 12.sp) },
                        singleLine = true,
                        modifier = Modifier.weight(1f)
                    )
                    OutlinedTextField(
                        value = qrLot,
                        onValueChange = { qrLot = it },
                        placeholder = { Text("Mã lô", fontSize = 12.sp) },
                        singleLine = true,
                        modifier = Modifier.width(96.dp)
                    )
                    Button(
                        onClick = {
                            if (qrProduct.isNotBlank() && qrLot.isNotBlank()) {
                                val p = qrProduct.trim()
                                val l = qrLot.trim()
                                val u = qrUrl.trim().ifEmpty { "https://v-argon.farm" }
                                qrProduct = ""
                                qrLot = ""
                                qrUrl = ""
                                scope.launch {
                                    supabase.insert("farm_video_qrs", mapOf(
                                        "product_name" to p,
                                        "lot_code" to l,
                                        "video_url" to u
                                    ))
                                    loadAll()
                                }
                            }
                        },
                        shape = RoundedCornerShape(10.dp)
                    ) { Text("Tạo") }
                }

                LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(qrs, key = { it.id ?: it.hashCode().toLong() }) { q ->
                        Card(colors = CardDefaults.cardColors(containerColor = Color.White)) {
                            Row(
                                modifier = Modifier.fillMaxWidth().padding(12.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(q.productName, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                                    Text("Lô: ${q.lotCode} • ${q.videoUrl}", fontSize = 12.sp, color = FarmTextMutedLight, maxLines = 1, overflow = TextOverflow.Ellipsis)
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
