package com.smartfarm.app.ui.components

import android.annotation.SuppressLint
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.widget.ImageView
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.VideocamOff
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import com.smartfarm.app.ui.theme.FarmDestructive
import com.smartfarm.app.ui.theme.FarmPrimary
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import okio.ByteString
import java.security.SecureRandom
import java.security.cert.X509Certificate
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import javax.net.ssl.SSLContext
import javax.net.ssl.TrustManager
import javax.net.ssl.X509TrustManager

private fun getUnsafeWsClient(): OkHttpClient {
    return try {
        val trustAllCerts = arrayOf<TrustManager>(
            @SuppressLint("CustomX509TrustManager")
            object : X509TrustManager {
                @SuppressLint("TrustAllX509TrustManager")
                override fun checkClientTrusted(chain: Array<X509Certificate>?, authType: String?) {}
                @SuppressLint("TrustAllX509TrustManager")
                override fun checkServerTrusted(chain: Array<X509Certificate>?, authType: String?) {}
                override fun getAcceptedIssuers(): Array<X509Certificate> = arrayOf()
            }
        )
        val sslContext = SSLContext.getInstance("SSL")
        sslContext.init(null, trustAllCerts, SecureRandom())
        val sslSocketFactory = sslContext.socketFactory

        OkHttpClient.Builder()
            .sslSocketFactory(sslSocketFactory, trustAllCerts[0] as X509TrustManager)
            .hostnameVerifier { _, _ -> true }
            .connectTimeout(6, TimeUnit.SECONDS)
            .readTimeout(0, TimeUnit.MILLISECONDS)
            .pingInterval(20, TimeUnit.SECONDS)
            .retryOnConnectionFailure(true)
            .build()
    } catch (_: Exception) {
        OkHttpClient.Builder()
            .connectTimeout(6, TimeUnit.SECONDS)
            .readTimeout(0, TimeUnit.MILLISECONDS)
            .pingInterval(20, TimeUnit.SECONDS)
            .retryOnConnectionFailure(true)
            .build()
    }
}

private val sharedWsStreamClient: OkHttpClient by lazy { getUnsafeWsClient() }

/**
 * Trình phát luồng video WebSocket nhị phân thời gian thực (Zero-Lag Native Android).
 * - Nhận frame JPEG trực tiếp qua WebSocket binary (`send_bytes`).
 * - Dùng `Channel.CONFLATED` để tự động bỏ qua frame cũ nếu giải mã chậm, đảm bảo không tồn đọng độ trễ.
 * - Tái sử dụng `Bitmap` (`inBitmap` + `RGB_565`) để tránh GC lag.
 * - Gửi `"ack"` sau mỗi frame để điều tiết lưu lượng Zero-Lag (không Buffer Bloat).
 */
@Composable
fun WebSocketStreamPlayer(
    streamUrl: String,
    modifier: Modifier = Modifier,
    isPlaying: Boolean = true,
    overlayContent: @Composable (BoxScope.() -> Unit)? = null,
    onRetry: (() -> Unit)? = null
) {
    var isConnecting by remember { mutableStateOf(true) }
    var hasError by remember { mutableStateOf(false) }
    var reloadKey by remember { mutableIntStateOf(0) }
    var imageViewRef by remember { mutableStateOf<ImageView?>(null) }

    LaunchedEffect(streamUrl, reloadKey, isPlaying) {
        if (!isPlaying || streamUrl.isBlank()) {
            isConnecting = false
            withContext(Dispatchers.Main) {
                imageViewRef?.setImageBitmap(null)
            }
            return@LaunchedEffect
        }

        isConnecting = true
        hasError = false

        val frameChannel = Channel<ByteArray>(capacity = Channel.CONFLATED)

        withContext(Dispatchers.IO) {
            var retryCount = 0
            var reusableBitmap: Bitmap? = null
            var firstFrameReceived = false
            val decodeOpts = BitmapFactory.Options().apply {
                inPreferredConfig = Bitmap.Config.RGB_565
                inMutable = true
                inSampleSize = 1
            }

            while (isActive && isPlaying) {
                val connectionDone = AtomicBoolean(false)
                var currentWs: WebSocket? = null

                try {
                    val request = Request.Builder()
                        .url(streamUrl)
                        .build()

                    currentWs = sharedWsStreamClient.newWebSocket(request, object : WebSocketListener() {
                        override fun onOpen(webSocket: WebSocket, response: Response) {
                            retryCount = 0
                        }

                        override fun onMessage(webSocket: WebSocket, bytes: ByteString) {
                            frameChannel.trySend(bytes.toByteArray())
                            // Gửi ACK ngay khi nhận gói tin để pipeline song song với giải mã Bitmap
                            webSocket.send("ack")
                        }

                        override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
                            webSocket.close(1000, null)
                            connectionDone.set(true)
                        }

                        override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                            connectionDone.set(true)
                        }

                        override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                            connectionDone.set(true)
                        }
                    })

                    while (isActive && isPlaying && !connectionDone.get()) {
                        val frameBytes = withTimeoutOrNull(50) { frameChannel.receive() }
                        if (frameBytes != null) {
                            if (reusableBitmap?.isRecycled == false) {
                                decodeOpts.inBitmap = reusableBitmap
                            }

                            val bitmap = try {
                                BitmapFactory.decodeByteArray(frameBytes, 0, frameBytes.size, decodeOpts)
                            } catch (_: IllegalArgumentException) {
                                decodeOpts.inBitmap = null
                                BitmapFactory.decodeByteArray(frameBytes, 0, frameBytes.size, decodeOpts)
                            }

                            if (bitmap != null) {
                                reusableBitmap = bitmap
                                imageViewRef?.let { iv ->
                                    iv.post {
                                        iv.setImageBitmap(bitmap)
                                        if (!firstFrameReceived) {
                                            firstFrameReceived = true
                                            isConnecting = false
                                            hasError = false
                                        }
                                    }
                                }
                            }
                        }
                    }
                } catch (_: Exception) {
                    // Handled below
                } finally {
                    try {
                        currentWs?.close(1000, "Stream stopped")
                    } catch (_: Exception) {
                        currentWs?.cancel()
                    }
                }

                if (!isActive || !isPlaying) break

                retryCount++
                if (retryCount > 2) {
                    withContext(Dispatchers.Main) {
                        hasError = true
                        isConnecting = false
                    }
                }
                delay(1500)
            }
        }

        frameChannel.close()
    }

    Box(
        modifier = modifier
            .clip(RoundedCornerShape(20.dp))
            .background(Color.Black),
        contentAlignment = Alignment.Center
    ) {
        if (isPlaying) {
            AndroidView(
                factory = { context ->
                    ImageView(context).apply {
                        scaleType = ImageView.ScaleType.FIT_CENTER
                        adjustViewBounds = true
                        imageViewRef = this
                    }
                },
                modifier = Modifier.fillMaxSize(),
                update = { view ->
                    imageViewRef = view
                }
            )
        } else {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
                modifier = Modifier.fillMaxSize().padding(16.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.VideocamOff,
                    contentDescription = null,
                    tint = Color.Gray,
                    modifier = Modifier.size(54.dp)
                )
                Spacer(modifier = Modifier.height(10.dp))
                Text(
                    text = "MÁY QUAY ĐANG TẠM DỪNG",
                    color = Color.White,
                    fontWeight = FontWeight.Bold,
                    fontSize = 12.sp
                )
                Text(
                    text = "Bấm nút Bật Camera để xem hình ảnh trực tiếp",
                    color = Color.White.copy(alpha = 0.6f),
                    fontSize = 10.sp
                )
            }
        }

        AnimatedVisibility(
            visible = isPlaying && isConnecting,
            enter = fadeIn(),
            exit = fadeOut(),
            modifier = Modifier.align(Alignment.Center)
        ) {
            Surface(
                shape = RoundedCornerShape(12.dp),
                color = Color.Black.copy(alpha = 0.75f),
                modifier = Modifier.padding(16.dp)
            ) {
                Row(
                    modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(18.dp),
                        color = FarmPrimary,
                        strokeWidth = 2.dp
                    )
                    Spacer(modifier = Modifier.width(10.dp))
                    Text(
                        text = "Đang kết nối luồng WSS...",
                        color = Color.White,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                }
            }
        }

        AnimatedVisibility(
            visible = isPlaying && hasError,
            enter = fadeIn(),
            exit = fadeOut(),
            modifier = Modifier.align(Alignment.Center)
        ) {
            Surface(
                shape = RoundedCornerShape(14.dp),
                color = Color.Black.copy(alpha = 0.85f),
                modifier = Modifier.padding(20.dp)
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        text = "Đang chờ đường truyền máy quay",
                        color = FarmDestructive,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Button(
                        onClick = {
                            hasError = false
                            isConnecting = true
                            reloadKey++
                            onRetry?.invoke()
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = FarmPrimary),
                        shape = RoundedCornerShape(10.dp),
                        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp)
                    ) {
                        Icon(Icons.Default.Refresh, contentDescription = null, modifier = Modifier.size(14.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("Tải Lại Hình Ảnh", fontSize = 11.sp)
                    }
                }
            }
        }

        overlayContent?.invoke(this)
    }

    DisposableEffect(isPlaying) {
        onDispose {
            if (!isPlaying) {
                imageViewRef?.setImageBitmap(null)
            }
        }
    }
}
