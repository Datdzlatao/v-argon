package com.smartfarm.app.ui.screens

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.util.Base64
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
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
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.smartfarm.app.data.models.ChatMessage
import com.smartfarm.app.data.models.ToolCall
import com.smartfarm.app.ui.components.GeminiRichText
import com.smartfarm.app.ui.theme.*
import com.smartfarm.app.ui.viewmodel.FarmViewModel
import java.io.ByteArrayOutputStream

@Composable
fun AIChatScreen(
    viewModel: FarmViewModel,
    onBack: () -> Unit,
    modifier: Modifier = Modifier
) {
    val chatMessages by viewModel.chatMessages.collectAsState()
    val isChatLoading by viewModel.isChatLoading.collectAsState()
    val currentPenId by viewModel.currentPenId.collectAsState()

    var inputText by remember { mutableStateOf("") }
    var selectedImageBase64 by remember { mutableStateOf<String?>(null) }
    val context = LocalContext.current

    val imagePickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent()
    ) { uri: Uri? ->
        if (uri != null) {
            selectedImageBase64 = encodeUriToBase64(context, uri)
        }
    }

    val quickQuestions = listOf(
        "Bật quạt thông gió khu $currentPenId",
        "Nhiệt độ và độ ẩm hiện tại ra sao?",
        "Chẩn đoán bệnh thường gặp ở vật nuôi",
        "Kho thức ăn còn đủ dùng mấy ngày?"
    )

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
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .statusBarsPadding()
                    .padding(horizontal = 12.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Quay lại màn hình chính", tint = FarmPrimary)
                    }

                    Box(
                        modifier = Modifier
                            .size(38.dp)
                            .clip(CircleShape)
                            .background(FarmPrimary),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(Icons.Default.SupportAgent, contentDescription = null, tint = Color.White, modifier = Modifier.size(22.dp))
                    }

                    Column {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                            Text(
                                text = "Trợ Lý Kỹ Thuật Nông Trại",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.onSurface
                            )
                            Icon(Icons.Default.CheckCircle, contentDescription = null, tint = FarmPrimary, modifier = Modifier.size(14.dp))
                        }
                        Text(
                            text = "Hỗ trợ 24/7 • Khu vực phụ trách: $currentPenId",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }
        }

        // Danh sách tin nhắn trao đổi
        LazyColumn(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth(),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            items(chatMessages, key = { it.id }) { msg ->
                ChatMessageBubble(message = msg)
            }

            if (isChatLoading) {
                item {
                    Surface(
                        shape = RoundedCornerShape(16.dp),
                        color = Color.White,
                        border = androidx.compose.foundation.BorderStroke(1.dp, FarmPrimary.copy(alpha = 0.25f)),
                        shadowElevation = 1.dp,
                        modifier = Modifier.fillMaxWidth(0.78f)
                    ) {
                        Column(
                            modifier = Modifier.padding(12.dp),
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(6.dp)
                            ) {
                                CircularProgressIndicator(modifier = Modifier.size(14.dp), color = FarmPrimary, strokeWidth = 2.dp)
                                Text(
                                    "Trợ lý đang suy nghĩ...",
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.SemiBold,
                                    color = FarmPrimary
                                )
                            }
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth(0.92f)
                                    .height(8.dp)
                                    .clip(RoundedCornerShape(4.dp))
                                    .background(FarmPrimary.copy(alpha = 0.14f))
                            )
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth(0.72f)
                                    .height(8.dp)
                                    .clip(RoundedCornerShape(4.dp))
                                    .background(FarmPrimary.copy(alpha = 0.10f))
                            )
                        }
                    }
                }
            }
        }

        // Hàng câu hỏi gợi ý nhanh
        LazyRow(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 6.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            items(quickQuestions) { q ->
                Surface(
                    onClick = { viewModel.sendChatMessage(q) },
                    shape = RoundedCornerShape(12.dp),
                    color = Color.White,
                    border = androidx.compose.foundation.BorderStroke(1.dp, FarmPrimary.copy(alpha = 0.4f)),
                    modifier = Modifier.height(32.dp)
                ) {
                    Text(
                        text = q,
                        fontSize = 11.sp,
                        color = FarmPrimary,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)
                    )
                }
            }
        }

        // Khung nhập câu hỏi & gửi ảnh RAG
        Surface(
            color = Color.White,
            shadowElevation = 4.dp,
            border = androidx.compose.foundation.BorderStroke(1.dp, FarmCardBorderLight),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .navigationBarsPadding()
            ) {
                if (selectedImageBase64 != null) {
                    val previewBitmap = remember(selectedImageBase64) {
                        decodeBase64ToBitmap(selectedImageBase64!!)
                    }
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(FarmPrimary.copy(alpha = 0.08f))
                            .padding(horizontal = 12.dp, vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(10.dp),
                            modifier = Modifier.weight(1f)
                        ) {
                            if (previewBitmap != null) {
                                Image(
                                    bitmap = previewBitmap.asImageBitmap(),
                                    contentDescription = "Ảnh xem trước",
                                    contentScale = ContentScale.Crop,
                                    modifier = Modifier
                                        .size(44.dp)
                                        .clip(RoundedCornerShape(8.dp))
                                )
                            }
                            Text(
                                text = "Ảnh đã sẵn sàng gửi kiểm tra bệnh",
                                fontSize = 11.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = FarmPrimary
                            )
                        }
                        IconButton(
                            onClick = { selectedImageBase64 = null },
                            modifier = Modifier.size(28.dp)
                        ) {
                            Icon(Icons.Default.Close, contentDescription = "Bỏ ảnh", tint = FarmPrimary, modifier = Modifier.size(18.dp))
                        }
                    }
                }

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 12.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    IconButton(
                        onClick = { imagePickerLauncher.launch("image/*") },
                        modifier = Modifier
                            .size(40.dp)
                            .clip(CircleShape)
                            .background(FarmPrimary.copy(alpha = 0.12f))
                    ) {
                        Icon(
                            imageVector = Icons.Default.AddPhotoAlternate,
                            contentDescription = "Chọn ảnh kiểm tra bệnh",
                            tint = FarmPrimary,
                            modifier = Modifier.size(19.dp)
                        )
                    }

                    IconButton(
                        onClick = {
                            val clipboard = context.getSystemService(android.content.Context.CLIPBOARD_SERVICE) as? android.content.ClipboardManager
                            val clip = clipboard?.primaryClip
                            var pastedBase64: String? = null
                            if (clip != null && clip.itemCount > 0) {
                                val uri = clip.getItemAt(0).uri
                                if (uri != null) {
                                    pastedBase64 = encodeUriToBase64(context, uri)
                                }
                            }
                            if (pastedBase64 != null) {
                                selectedImageBase64 = pastedBase64
                            } else {
                                android.widget.Toast.makeText(
                                    context,
                                    "Không tìm thấy ảnh vừa sao chép",
                                    android.widget.Toast.LENGTH_SHORT
                                ).show()
                            }
                        },
                        modifier = Modifier
                            .size(40.dp)
                            .clip(CircleShape)
                            .background(FarmPrimary.copy(alpha = 0.12f))
                    ) {
                        Icon(
                            imageVector = Icons.Default.ContentPaste,
                            contentDescription = "Dán ảnh vừa sao chép",
                            tint = FarmPrimary,
                            modifier = Modifier.size(18.dp)
                        )
                    }

                    OutlinedTextField(
                        value = inputText,
                        onValueChange = { inputText = it },
                        placeholder = {
                            Text(
                                if (selectedImageBase64 != null) "Mô tả thêm triệu chứng..." else "Nhập câu hỏi hoặc chọn ảnh gửi...",
                                fontSize = 12.sp
                            )
                        },
                        shape = RoundedCornerShape(20.dp),
                        maxLines = 3,
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedContainerColor = Color.White,
                            unfocusedContainerColor = Color.White,
                            focusedBorderColor = FarmPrimary,
                            unfocusedBorderColor = FarmCardBorderLight
                        ),
                        modifier = Modifier
                            .weight(1f)
                            .heightIn(min = 46.dp)
                    )

                    IconButton(
                        onClick = {
                            val img = selectedImageBase64
                            val txt = inputText.trim()
                            if (img != null) {
                                viewModel.sendDiagnosisImage(img, txt.ifBlank { null })
                                selectedImageBase64 = null
                                inputText = ""
                            } else if (txt.isNotBlank()) {
                                viewModel.sendChatMessage(txt)
                                inputText = ""
                            }
                        },
                        enabled = !isChatLoading && (inputText.isNotBlank() || selectedImageBase64 != null),
                        modifier = Modifier
                            .size(46.dp)
                            .clip(CircleShape)
                            .background(if (inputText.isNotBlank() || selectedImageBase64 != null) FarmPrimary else FarmPrimary.copy(alpha = 0.4f))
                    ) {
                        Icon(
                            imageVector = Icons.Default.Send,
                            contentDescription = "Gửi câu hỏi hoặc ảnh kiểm tra bệnh",
                            tint = Color.White,
                            modifier = Modifier.size(20.dp)
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun ChatMessageBubble(message: ChatMessage) {
    val isUser = message.sender == "user"

    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = if (isUser) Arrangement.End else Arrangement.Start
    ) {
        if (!isUser) {
            Box(
                modifier = Modifier
                    .size(32.dp)
                    .clip(CircleShape)
                    .background(FarmPrimary),
                contentAlignment = Alignment.Center
            ) {
                Icon(Icons.Default.SupportAgent, contentDescription = null, tint = Color.White, modifier = Modifier.size(18.dp))
            }
            Spacer(modifier = Modifier.width(8.dp))
        }

        Column(
            modifier = Modifier.widthIn(max = 280.dp),
            horizontalAlignment = if (isUser) Alignment.End else Alignment.Start
        ) {
            Surface(
                shape = RoundedCornerShape(
                    topStart = 16.dp,
                    topEnd = 16.dp,
                    bottomStart = if (isUser) 16.dp else 4.dp,
                    bottomEnd = if (isUser) 4.dp else 16.dp
                ),
                color = if (isUser) FarmPrimary else Color.White,
                shadowElevation = if (isUser) 1.dp else 2.dp,
                border = if (!isUser) androidx.compose.foundation.BorderStroke(1.dp, FarmCardBorderLight) else null
            ) {
                Column(modifier = Modifier.padding(12.dp)) {
                    if (!message.imageBase64.isNullOrBlank()) {
                        val msgBitmap = remember(message.imageBase64) {
                            decodeBase64ToBitmap(message.imageBase64)
                        }
                        if (msgBitmap != null) {
                            Image(
                                bitmap = msgBitmap.asImageBitmap(),
                                contentDescription = "Ảnh kiểm chứng",
                                contentScale = ContentScale.Crop,
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .heightIn(max = 180.dp)
                                    .clip(RoundedCornerShape(12.dp))
                            )
                            Spacer(modifier = Modifier.height(8.dp))
                        }
                    }

                    GeminiRichText(
                        text = message.content,
                        isUser = isUser,
                        isStreaming = message.isStreaming,
                        fontSize = 13.sp,
                        lineHeight = 19.sp
                    )

                    // Hiển thị tác vụ công cụ tự động nếu có
                    message.toolCalls?.forEach { tool ->
                        Spacer(modifier = Modifier.height(8.dp))
                        ToolCallBadge(tool = tool)
                    }
                }
            }

            Spacer(modifier = Modifier.height(2.dp))

            Text(
                text = message.time,
                fontSize = 9.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

@Composable
fun ToolCallBadge(tool: ToolCall) {
    val friendlyToolName = when {
        tool.tool.contains("device", ignoreCase = true) || tool.tool.contains("fan", ignoreCase = true) -> "Điều khiển thiết bị tự động"
        tool.tool.contains("env", ignoreCase = true) -> "Thu thập chỉ số môi trường"
        tool.tool.contains("disease", ignoreCase = true) -> "Tra cứu phác đồ bệnh"
        tool.tool.contains("feed", ignoreCase = true) -> "Tính toán khẩu phần ăn"
        else -> "Thực hiện tác vụ hệ thống"
    }

    Surface(
        shape = RoundedCornerShape(8.dp),
        color = FarmSecondary.copy(alpha = 0.12f),
        border = androidx.compose.foundation.BorderStroke(0.8.dp, FarmSecondary.copy(alpha = 0.4f)),
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier.padding(8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            Icon(Icons.Default.Build, contentDescription = null, tint = FarmPrimary, modifier = Modifier.size(14.dp))
            Column {
                Text(
                    text = friendlyToolName,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                    color = FarmPrimary
                )
                if (!tool.result.isNullOrEmpty()) {
                    Text(
                        text = "Kết quả: ${tool.result}",
                        fontSize = 9.sp,
                        maxLines = 3,
                        overflow = TextOverflow.Ellipsis,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }
    }
}

private fun encodeUriToBase64(context: android.content.Context, uri: Uri): String? {
    return try {
        val rawBytes = context.contentResolver.openInputStream(uri)?.use { it.readBytes() } ?: return null
        val original = BitmapFactory.decodeByteArray(rawBytes, 0, rawBytes.size) ?: return null
        val maxDim = 1024
        val scaled = if (original.width > maxDim || original.height > maxDim) {
            val ratio = minOf(maxDim.toFloat() / original.width, maxDim.toFloat() / original.height)
            Bitmap.createScaledBitmap(
                original,
                (original.width * ratio).toInt().coerceAtLeast(1),
                (original.height * ratio).toInt().coerceAtLeast(1),
                true
            )
        } else {
            original
        }
        val out = ByteArrayOutputStream()
        scaled.compress(Bitmap.CompressFormat.JPEG, 85, out)
        Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP)
    } catch (_: Exception) {
        null
    }
}

private fun decodeBase64ToBitmap(base64Str: String): Bitmap? {
    return try {
        val clean = base64Str.substringAfter("base64,", base64Str)
        val bytes = Base64.decode(clean, Base64.DEFAULT)
        BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
    } catch (_: Exception) {
        null
    }
}
