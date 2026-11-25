package com.smartfarm.app.ui.screens

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.ErrorOutline
import androidx.compose.material.icons.outlined.Shield
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.smartfarm.app.ui.theme.*
import com.smartfarm.app.ui.viewmodel.FarmViewModel

@Composable
fun AuthScreen(
    viewModel: FarmViewModel,
    modifier: Modifier = Modifier
) {
    var isRegisterMode by remember { mutableStateOf(false) }
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var confirmPassword by remember { mutableStateOf("") }
    var passwordVisible by remember { mutableStateOf(false) }
    var confirmPasswordVisible by remember { mutableStateOf(false) }

    val authLoading by viewModel.authLoading.collectAsState()
    val authError by viewModel.authError.collectAsState()
    val authSuccess by viewModel.authSuccess.collectAsState()

    val focusManager = LocalFocusManager.current
    val scrollState = rememberScrollState()

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(FarmBackgroundLight),
        contentAlignment = Alignment.Center
    ) {
        Card(
            shape = RoundedCornerShape(24.dp),
            colors = CardDefaults.cardColors(containerColor = Color.White),
            elevation = CardDefaults.cardElevation(defaultElevation = 3.dp),
            border = androidx.compose.foundation.BorderStroke(1.dp, FarmCardBorderLight),
            modifier = Modifier
                .fillMaxWidth()
                .padding(20.dp)
                .imePadding()
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .verticalScroll(scrollState)
                    .padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                // Biểu tượng Logo
                Box(
                    modifier = Modifier
                        .size(56.dp)
                        .clip(CircleShape)
                        .background(FarmPrimary),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.Spa,
                        contentDescription = "Biểu tượng nông trại",
                        tint = Color.White,
                        modifier = Modifier.size(32.dp)
                    )
                }

                Spacer(modifier = Modifier.height(10.dp))

                Text(
                    text = "Nông Trại Thông Minh",
                    style = MaterialTheme.typography.headlineMedium,
                    fontWeight = FontWeight.Bold,
                    color = FarmPrimary
                )

                Text(
                    text = "Hệ thống Quản lý Chuồng Trại & Trồng Trọt Tự Động",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    fontSize = 12.sp,
                    textAlign = TextAlign.Center
                )

                Spacer(modifier = Modifier.height(20.dp))

                // Chuyển đổi Đăng nhập / Đăng ký
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .background(FarmBackgroundLight)
                        .border(1.dp, FarmCardBorderLight, RoundedCornerShape(12.dp))
                        .padding(4.dp)
                ) {
                    Surface(
                        onClick = {
                            isRegisterMode = false
                            viewModel.clearAuthMessages()
                        },
                        shape = RoundedCornerShape(10.dp),
                        color = if (!isRegisterMode) FarmPrimary else Color.Transparent,
                        modifier = Modifier.weight(1f).height(38.dp)
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Text(
                                text = "Đăng Nhập",
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Bold,
                                color = if (!isRegisterMode) Color.White else MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }

                    Surface(
                        onClick = {
                            isRegisterMode = true
                            viewModel.clearAuthMessages()
                        },
                        shape = RoundedCornerShape(10.dp),
                        color = if (isRegisterMode) FarmPrimary else Color.Transparent,
                        modifier = Modifier.weight(1f).height(38.dp)
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Text(
                                text = "Đăng Ký",
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Bold,
                                color = if (isRegisterMode) Color.White else MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Thông báo lỗi
                AnimatedVisibility(visible = authError != null) {
                    authError?.let { msg ->
                        Surface(
                            shape = RoundedCornerShape(12.dp),
                            color = FarmDestructive.copy(alpha = 0.12f),
                            border = androidx.compose.foundation.BorderStroke(1.dp, FarmDestructive.copy(alpha = 0.3f)),
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(bottom = 12.dp)
                        ) {
                            Row(
                                modifier = Modifier.padding(12.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Icon(
                                    imageVector = Icons.Outlined.ErrorOutline,
                                    contentDescription = "Lỗi",
                                    tint = FarmDestructive,
                                    modifier = Modifier.size(20.dp)
                                )
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(
                                    text = msg,
                                    style = MaterialTheme.typography.bodySmall,
                                    color = FarmDestructive,
                                    modifier = Modifier.weight(1f)
                                )
                            }
                        }
                    }
                }

                // Thông báo thành công
                AnimatedVisibility(visible = authSuccess != null) {
                    authSuccess?.let { msg ->
                        Surface(
                            shape = RoundedCornerShape(12.dp),
                            color = FarmSuccess.copy(alpha = 0.12f),
                            border = androidx.compose.foundation.BorderStroke(1.dp, FarmSuccess.copy(alpha = 0.3f)),
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(bottom = 12.dp)
                        ) {
                            Row(
                                modifier = Modifier.padding(12.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Icon(
                                    imageVector = Icons.Outlined.CheckCircle,
                                    contentDescription = "Thành công",
                                    tint = FarmSuccess,
                                    modifier = Modifier.size(20.dp)
                                )
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(
                                    text = msg,
                                    style = MaterialTheme.typography.bodySmall,
                                    color = FarmForegroundLight,
                                    modifier = Modifier.weight(1f)
                                )
                            }
                        }
                    }
                }

                // Trường nhập Hộp thư điện tử
                OutlinedTextField(
                    value = email,
                    onValueChange = {
                        email = it
                        if (authError != null) viewModel.clearAuthMessages()
                    },
                    label = { Text("Hộp thư điện tử") },
                    placeholder = { Text("nguyenvanan@gmail.com") },
                    leadingIcon = { Icon(Icons.Default.Email, contentDescription = null, tint = FarmPrimary) },
                    trailingIcon = {
                        if (email.isNotBlank()) {
                            IconButton(onClick = { email = "" }) {
                                Icon(Icons.Default.Clear, contentDescription = "Xóa nội dung", tint = Color.Gray, modifier = Modifier.size(18.dp))
                            }
                        }
                    },
                    keyboardOptions = KeyboardOptions(
                        keyboardType = KeyboardType.Email,
                        imeAction = ImeAction.Next
                    ),
                    shape = RoundedCornerShape(14.dp),
                    singleLine = true,
                    enabled = !authLoading,
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedContainerColor = Color.White,
                        unfocusedContainerColor = Color.White,
                        focusedBorderColor = FarmPrimary,
                        unfocusedBorderColor = FarmCardBorderLight
                    ),
                    modifier = Modifier.fillMaxWidth()
                )

                Spacer(modifier = Modifier.height(10.dp))

                // Trường nhập Mật khẩu
                OutlinedTextField(
                    value = password,
                    onValueChange = {
                        password = it
                        if (authError != null) viewModel.clearAuthMessages()
                    },
                    label = { Text("Mật khẩu") },
                    placeholder = { Text("Tối thiểu 6 ký tự") },
                    leadingIcon = { Icon(Icons.Default.Lock, contentDescription = null, tint = FarmPrimary) },
                    trailingIcon = {
                        IconButton(onClick = { passwordVisible = !passwordVisible }) {
                            Icon(
                                imageVector = if (passwordVisible) Icons.Default.Visibility else Icons.Default.VisibilityOff,
                                contentDescription = if (passwordVisible) "Ẩn mật khẩu" else "Hiện mật khẩu",
                                tint = FarmPrimary,
                                modifier = Modifier.size(20.dp)
                            )
                        }
                    },
                    visualTransformation = if (passwordVisible) VisualTransformation.None else PasswordVisualTransformation(),
                    keyboardOptions = KeyboardOptions(
                        keyboardType = KeyboardType.Password,
                        imeAction = if (isRegisterMode) ImeAction.Next else ImeAction.Done
                    ),
                    keyboardActions = KeyboardActions(
                        onDone = {
                            focusManager.clearFocus()
                            if (!isRegisterMode && !authLoading) {
                                viewModel.loginWithSupabase(email, password)
                            }
                        }
                    ),
                    shape = RoundedCornerShape(14.dp),
                    singleLine = true,
                    enabled = !authLoading,
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedContainerColor = Color.White,
                        unfocusedContainerColor = Color.White,
                        focusedBorderColor = FarmPrimary,
                        unfocusedBorderColor = FarmCardBorderLight
                    ),
                    modifier = Modifier.fillMaxWidth()
                )

                // Trường nhập Xác nhận Mật khẩu (khi Đăng Ký)
                if (isRegisterMode) {
                    Spacer(modifier = Modifier.height(10.dp))
                    OutlinedTextField(
                        value = confirmPassword,
                        onValueChange = {
                            confirmPassword = it
                            if (authError != null) viewModel.clearAuthMessages()
                        },
                        label = { Text("Xác nhận lại mật khẩu") },
                        placeholder = { Text("Nhập lại mật khẩu ở trên") },
                        leadingIcon = { Icon(Icons.Default.Lock, contentDescription = null, tint = FarmPrimary) },
                        trailingIcon = {
                            IconButton(onClick = { confirmPasswordVisible = !confirmPasswordVisible }) {
                                Icon(
                                    imageVector = if (confirmPasswordVisible) Icons.Default.Visibility else Icons.Default.VisibilityOff,
                                    contentDescription = if (confirmPasswordVisible) "Ẩn mật khẩu" else "Hiện mật khẩu",
                                    tint = FarmPrimary,
                                    modifier = Modifier.size(20.dp)
                                )
                            }
                        },
                        visualTransformation = if (confirmPasswordVisible) VisualTransformation.None else PasswordVisualTransformation(),
                        keyboardOptions = KeyboardOptions(
                            keyboardType = KeyboardType.Password,
                            imeAction = ImeAction.Done
                        ),
                        keyboardActions = KeyboardActions(
                            onDone = {
                                focusManager.clearFocus()
                                if (!authLoading) {
                                    viewModel.signUpWithSupabase(email, password, confirmPassword)
                                }
                            }
                        ),
                        shape = RoundedCornerShape(14.dp),
                        singleLine = true,
                        enabled = !authLoading,
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedContainerColor = Color.White,
                            unfocusedContainerColor = Color.White,
                            focusedBorderColor = FarmPrimary,
                            unfocusedBorderColor = FarmCardBorderLight
                        ),
                        modifier = Modifier.fillMaxWidth()
                    )
                }

                Spacer(modifier = Modifier.height(20.dp))

                // Nút Đăng nhập / Đăng ký
                Button(
                    onClick = {
                        focusManager.clearFocus()
                        if (!isRegisterMode) {
                            viewModel.loginWithSupabase(email, password)
                        } else {
                            viewModel.signUpWithSupabase(email, password, confirmPassword)
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = FarmPrimary),
                    shape = RoundedCornerShape(14.dp),
                    enabled = !authLoading,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(50.dp)
                ) {
                    if (authLoading) {
                        CircularProgressIndicator(
                            color = Color.White,
                            modifier = Modifier.size(22.dp),
                            strokeWidth = 2.5.dp
                        )
                        Spacer(modifier = Modifier.width(10.dp))
                        Text(
                            text = if (!isRegisterMode) "Đang đăng nhập..." else "Đang khởi tạo tài khoản...",
                            fontWeight = FontWeight.Bold,
                            fontSize = 14.sp
                        )
                    } else {
                        Text(
                            text = if (!isRegisterMode) "Đăng Nhập Hệ Thống" else "Tạo Tài Khoản Mới",
                            fontWeight = FontWeight.Bold,
                            fontSize = 14.sp
                        )
                    }
                }

                Spacer(modifier = Modifier.height(14.dp))

                // Dòng phân cách HOẶC
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    HorizontalDivider(modifier = Modifier.weight(1f), color = FarmCardBorderLight)
                    Text(
                        text = "HOẶC",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(horizontal = 12.dp)
                    )
                    HorizontalDivider(modifier = Modifier.weight(1f), color = FarmCardBorderLight)
                }

                Spacer(modifier = Modifier.height(14.dp))

                // Nút Chế độ Dùng Thử Trải Nghiệm
                OutlinedButton(
                    onClick = {
                        focusManager.clearFocus()
                        viewModel.loginDemo()
                    },
                    shape = RoundedCornerShape(14.dp),
                    border = androidx.compose.foundation.BorderStroke(1.2.dp, FarmPrimary),
                    enabled = !authLoading,
                    colors = ButtonDefaults.outlinedButtonColors(containerColor = Color.White),
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(48.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.PlayArrow,
                        contentDescription = "Trải nghiệm dùng thử",
                        tint = FarmPrimary,
                        modifier = Modifier.size(18.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "Trải Nghiệm Dùng Thử Ngay",
                        color = FarmPrimary,
                        fontWeight = FontWeight.Bold,
                        fontSize = 13.sp
                    )
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Huy hiệu Bảo mật
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.Center,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Icon(
                        imageVector = Icons.Outlined.Shield,
                        contentDescription = "Bảo mật",
                        tint = FarmPrimary,
                        modifier = Modifier.size(14.dp)
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = "Hệ thống bảo mật dữ liệu đám mây mã hóa an toàn",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        fontSize = 11.sp
                    )
                }
            }
        }
    }
}
