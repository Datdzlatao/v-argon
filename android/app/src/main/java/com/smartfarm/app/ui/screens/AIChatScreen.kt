package com.smartfarm.app.ui.screens

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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.smartfarm.app.data.models.ChatMessage
import com.smartfarm.app.data.models.ToolCall
import com.smartfarm.app.ui.theme.*
import com.smartfarm.app.ui.viewmodel.FarmViewModel

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
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        modifier = Modifier.padding(start = 8.dp)
                    ) {
                        CircularProgressIndicator(modifier = Modifier.size(16.dp), color = FarmPrimary, strokeWidth = 2.dp)
                        Text(
                            "Trợ lý đang phân tích dữ liệu nông trại và phản hồi...",
                            fontSize = 11.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
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

        // Khung nhập câu hỏi
        Surface(
            color = Color.White,
            shadowElevation = 4.dp,
            border = androidx.compose.foundation.BorderStroke(1.dp, FarmCardBorderLight),
            modifier = Modifier.fillMaxWidth()
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .navigationBarsPadding()
                    .padding(horizontal = 12.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                OutlinedTextField(
                    value = inputText,
                    onValueChange = { inputText = it },
                    placeholder = { Text("Nhập câu hỏi (ví dụ: Bật quạt, kiểm tra bệnh)...", fontSize = 12.sp) },
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
                        if (inputText.isNotBlank()) {
                            viewModel.sendChatMessage(inputText.trim())
                            inputText = ""
                        }
                    },
                    modifier = Modifier
                        .size(46.dp)
                        .clip(CircleShape)
                        .background(FarmPrimary)
                ) {
                    Icon(
                        imageVector = Icons.Default.Send,
                        contentDescription = "Gửi câu hỏi",
                        tint = Color.White,
                        modifier = Modifier.size(20.dp)
                    )
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
                    Text(
                        text = message.content,
                        color = if (isUser) Color.White else MaterialTheme.colorScheme.onSurface,
                        fontSize = 13.sp,
                        lineHeight = 18.sp
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
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }
    }
}
