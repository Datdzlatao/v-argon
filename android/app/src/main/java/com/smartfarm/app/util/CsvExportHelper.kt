package com.smartfarm.app.util

import android.content.Context
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.*
import androidx.compose.ui.platform.LocalContext

fun buildCsvContent(headers: List<String>, rows: List<List<Any?>>): String {
    val sb = StringBuilder("\uFEFF")
    sb.append(headers.joinToString(",") { "\"${it.replace("\"", "\"\"")}\"" }).append("\n")
    rows.forEach { row ->
        sb.append(row.joinToString(",") { cell ->
            val str = cell?.toString() ?: ""
            "\"${str.replace("\"", "\"\"")}\""
        }).append("\n")
    }
    return sb.toString()
}

@Composable
fun rememberCsvExporter(onResult: (Boolean, String) -> Unit): (filename: String, headers: List<String>, rows: List<List<Any?>>) -> Unit {
    val context: Context = LocalContext.current
    var pendingContent by remember { mutableStateOf<String?>(null) }

    val launcher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.CreateDocument("text/csv")
    ) { uri: Uri? ->
        val content = pendingContent
        pendingContent = null
        if (uri != null && content != null) {
            try {
                context.contentResolver.openOutputStream(uri)?.use { out ->
                    out.write(content.toByteArray(Charsets.UTF_8))
                }
                onResult(true, "Đã xuất file CSV thành công!")
            } catch (e: Exception) {
                onResult(false, "Lỗi xuất file: ${e.message}")
            }
        }
    }

    return { filename, headers, rows ->
        pendingContent = buildCsvContent(headers, rows)
        launcher.launch("$filename.csv")
    }
}
