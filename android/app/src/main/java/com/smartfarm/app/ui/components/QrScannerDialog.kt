package com.smartfarm.app.ui.components

import android.Manifest
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.QrCodeScanner
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import com.google.zxing.BarcodeFormat
import com.google.zxing.BinaryBitmap
import com.google.zxing.MultiFormatReader
import com.google.zxing.PlanarYUVLuminanceSource
import com.google.zxing.common.HybridBinarizer
import com.google.zxing.qrcode.QRCodeWriter
import com.smartfarm.app.ui.theme.FarmPrimary
import org.json.JSONObject
import java.util.concurrent.Executors

data class ParsedCropQr(
    val cropId: String? = null,
    val penId: String? = null,
    val raw: String = ""
)

fun parseCropQrPayload(raw: String): ParsedCropQr {
    val text = raw.trim()
    if (text.isEmpty()) return ParsedCropQr(raw = text)

    if (text.startsWith("{")) {
        try {
            val obj = JSONObject(text)
            val cid = obj.optString("crop_id").ifEmpty { obj.optString("cropId") }
            if (cid.isNotEmpty()) {
                val pid = obj.optString("pen_id").ifEmpty { obj.optString("penId") }.ifEmpty { null }
                return ParsedCropQr(cropId = cid, penId = pid, raw = text)
            }
        } catch (_: Exception) {}
    }

    try {
        val normalized = if (text.startsWith("smartfarm://")) text.replace("smartfarm://", "https://smartfarm.local/") else text
        val uri = Uri.parse(normalized)
        val cid = uri.getQueryParameter("crop_id") ?: uri.getQueryParameter("cropId")
        val pid = uri.getQueryParameter("pen_id") ?: uri.getQueryParameter("penId")
        if (!cid.isNullOrBlank()) {
            return ParsedCropQr(cropId = cid, penId = pid, raw = text)
        }
    } catch (_: Exception) {}

    val match = Regex("^crop:(\\d+)", RegexOption.IGNORE_CASE).find(text)
    if (match != null) {
        return ParsedCropQr(cropId = match.groupValues[1], raw = text)
    }

    return ParsedCropQr(raw = text)
}

@Composable
fun rememberQrBitmap(content: String, sizePx: Int = 240): Bitmap? {
    return remember(content, sizePx) {
        if (content.isBlank()) return@remember null
        try {
            val matrix = QRCodeWriter().encode(content, BarcodeFormat.QR_CODE, sizePx, sizePx)
            val bmp = Bitmap.createBitmap(sizePx, sizePx, Bitmap.Config.RGB_565)
            for (x in 0 until sizePx) {
                for (y in 0 until sizePx) {
                    bmp.setPixel(x, y, if (matrix.get(x, y)) android.graphics.Color.BLACK else android.graphics.Color.WHITE)
                }
            }
            bmp
        } catch (_: Exception) {
            null
        }
    }
}

@Composable
fun QrScannerDialog(
    onDismiss: () -> Unit,
    onDetected: (ParsedCropQr) -> Unit
) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    var hasCameraPermission by remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED
        )
    }
    var manualText by remember { mutableStateOf("") }
    var detectedOnce by remember { mutableStateOf(false) }

    val permLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted -> hasCameraPermission = granted }

    LaunchedEffect(Unit) {
        if (!hasCameraPermission) {
            permLauncher.launch(Manifest.permission.CAMERA)
        }
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Icon(Icons.Default.QrCodeScanner, contentDescription = null, tint = FarmPrimary)
                    Text("Quét Mã QR Cây Trồng", fontWeight = FontWeight.Bold, fontSize = 16.sp)
                }
                IconButton(onClick = onDismiss, modifier = Modifier.size(28.dp)) {
                    Icon(Icons.Default.Close, contentDescription = "Đóng")
                }
            }
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                if (hasCameraPermission) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(240.dp)
                            .clip(RoundedCornerShape(16.dp))
                            .background(Color.Black)
                    ) {
                        AndroidView(
                            factory = { ctx ->
                                val previewView = PreviewView(ctx)
                                val cameraProviderFuture = ProcessCameraProvider.getInstance(ctx)
                                val executor = Executors.newSingleThreadExecutor()
                                val reader = MultiFormatReader()

                                cameraProviderFuture.addListener({
                                    val cameraProvider = cameraProviderFuture.get()
                                    val preview = Preview.Builder().build().also {
                                        it.setSurfaceProvider(previewView.surfaceProvider)
                                    }
                                    val analysis = ImageAnalysis.Builder()
                                        .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                                        .build()
                                    analysis.setAnalyzer(executor) { imageProxy ->
                                        if (detectedOnce) {
                                            imageProxy.close()
                                            return@setAnalyzer
                                        }
                                        try {
                                            val plane = imageProxy.planes[0]
                                            val buffer = plane.buffer
                                            val bytes = ByteArray(buffer.remaining())
                                            buffer.get(bytes)
                                            val source = PlanarYUVLuminanceSource(
                                                bytes,
                                                imageProxy.width,
                                                imageProxy.height,
                                                0,
                                                0,
                                                imageProxy.width,
                                                imageProxy.height,
                                                false
                                            )
                                            val bitmap = BinaryBitmap(HybridBinarizer(source))
                                            val result = reader.decodeWithState(bitmap)
                                            if (!result.text.isNullOrBlank()) {
                                                detectedOnce = true
                                                previewView.post {
                                                    onDetected(parseCropQrPayload(result.text))
                                                }
                                            }
                                        } catch (_: Exception) {
                                        } finally {
                                            imageProxy.close()
                                        }
                                    }
                                    try {
                                        cameraProvider.unbindAll()
                                        cameraProvider.bindToLifecycle(
                                            lifecycleOwner,
                                            CameraSelector.DEFAULT_BACK_CAMERA,
                                            preview,
                                            analysis
                                        )
                                    } catch (_: Exception) {}
                                }, ContextCompat.getMainExecutor(ctx))
                                previewView
                            },
                            modifier = Modifier.fillMaxSize()
                        )
                    }
                } else {
                    Text(
                        "Cần quyền Camera để quét mã QR trực tiếp.",
                        fontSize = 12.sp,
                        color = Color.Gray
                    )
                    Button(
                        onClick = { permLauncher.launch(Manifest.permission.CAMERA) },
                        colors = ButtonDefaults.buttonColors(containerColor = FarmPrimary)
                    ) {
                        Text("Cấp quyền Camera")
                    }
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    OutlinedTextField(
                        value = manualText,
                        onValueChange = { manualText = it },
                        placeholder = { Text("Hoặc nhập / dán link QR...", fontSize = 12.sp) },
                        singleLine = true,
                        modifier = Modifier.weight(1f)
                    )
                    Button(
                        onClick = {
                            if (manualText.isNotBlank()) {
                                onDetected(parseCropQrPayload(manualText))
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = FarmPrimary),
                        shape = RoundedCornerShape(10.dp)
                    ) { Text("Mở") }
                }
            }
        },
        confirmButton = {}
    )
}
