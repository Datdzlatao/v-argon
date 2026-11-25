package com.smartfarm.app.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.smartfarm.app.data.models.EnvData
import com.smartfarm.app.data.models.EnvHistoryPoint
import com.smartfarm.app.ui.theme.*

@Composable
fun EnvironmentMetricCards(
    envData: EnvData,
    historyLogs: List<EnvHistoryPoint>,
    currentMode: String,
    onRefresh: () -> Unit,
    onAskAI: () -> Unit,
    modifier: Modifier = Modifier
) {
    val isLivestock = currentMode == "livestock"
    val isHot = envData.temp >= (if (isLivestock) 35.0 else 40.0)
    val isHumHigh = envData.hum >= 90.0
    val isSmellBad = if (isLivestock) envData.smell >= 400.0 else envData.smell <= 30.0

    Card(
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
        border = androidx.compose.foundation.BorderStroke(1.dp, FarmCardBorderLight),
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 6.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp)
        ) {
            // Tiêu đề
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .size(36.dp)
                            .clip(CircleShape)
                            .background(FarmPrimary.copy(alpha = 0.12f)),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.Timeline,
                            contentDescription = null,
                            tint = FarmPrimary,
                            modifier = Modifier.size(20.dp)
                        )
                    }

                    Column {
                        Text(
                            text = if (isLivestock) "Môi Trường Chuồng Nuôi" else "Môi Trường Vườn Trồng",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                            color = FarmForegroundLight
                        )
                        Text(
                            text = "Số liệu cảm biến cập nhật liên tục",
                            style = MaterialTheme.typography.labelSmall,
                            color = FarmTextMutedLight
                        )
                    }
                }

                IconButton(
                    onClick = onRefresh,
                    modifier = Modifier
                        .size(36.dp)
                        .clip(CircleShape)
                        .background(FarmMutedLight)
                ) {
                    Icon(
                        imageVector = Icons.Default.Refresh,
                        contentDescription = "Làm mới số liệu",
                        tint = FarmPrimary,
                        modifier = Modifier.size(18.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.height(14.dp))

            // 3 Hộp Chỉ Số Môi Trường
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                // Nhiệt độ
                MetricBox(
                    label = "Nhiệt độ",
                    value = "${envData.temp}°C",
                    status = if (isHot) "Nắng nóng" else "Mát mẻ",
                    isWarning = isHot,
                    icon = Icons.Default.Thermostat,
                    color = if (isHot) FarmDestructive else FarmPrimary,
                    modifier = Modifier.weight(1f)
                )

                // Độ ẩm
                MetricBox(
                    label = "Độ ẩm",
                    value = "${envData.hum.toInt()}%",
                    status = if (isHumHigh) "Ẩm ướt" else "Lý tưởng",
                    isWarning = isHumHigh,
                    icon = Icons.Default.WaterDrop,
                    color = if (isHumHigh) FarmWarning else FarmInfo,
                    modifier = Modifier.weight(1f)
                )

                // Mùi chuồng / Độ ẩm đất
                MetricBox(
                    label = if (isLivestock) "Mùi khí" else "Ẩm đất",
                    value = if (isLivestock) "${envData.smell.toInt()}" else "${envData.smell.toInt()}%",
                    status = if (isSmellBad) (if (isLivestock) "Nồng nặc" else "Khô hạn") else "Thông thoáng",
                    isWarning = isSmellBad,
                    icon = if (isLivestock) Icons.Default.Air else Icons.Default.Grass,
                    color = if (isSmellBad) FarmDestructive else FarmSecondary,
                    modifier = Modifier.weight(1f)
                )
            }

            Spacer(modifier = Modifier.height(14.dp))

            // Biểu Đồ Diễn Biến Theo Giờ
            Text(
                text = "Diễn biến nhiệt độ & độ ẩm gần đây",
                style = MaterialTheme.typography.labelSmall,
                color = FarmTextMutedLight,
                fontWeight = FontWeight.SemiBold
            )

            Spacer(modifier = Modifier.height(6.dp))

            LiveTrendCanvas(
                points = historyLogs,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(90.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .background(FarmMutedLight)
                    .padding(8.dp)
            )

            Spacer(modifier = Modifier.height(8.dp))

            // Chú giải biểu đồ
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.Center,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(modifier = Modifier.size(8.dp).clip(CircleShape).background(FarmPrimary))
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("Nhiệt độ (°C)", fontSize = 10.sp, color = FarmTextMutedLight)
                }
                Spacer(modifier = Modifier.width(16.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(modifier = Modifier.size(8.dp).clip(CircleShape).background(FarmInfo))
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("Độ ẩm (%)", fontSize = 10.sp, color = FarmTextMutedLight)
                }
            }
        }
    }
}

@Composable
fun MetricBox(
    label: String,
    value: String,
    status: String,
    isWarning: Boolean,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    color: Color,
    modifier: Modifier = Modifier
) {
    Surface(
        shape = RoundedCornerShape(14.dp),
        color = Color.White,
        border = androidx.compose.foundation.BorderStroke(1.dp, color.copy(alpha = 0.35f)),
        shadowElevation = 1.dp,
        modifier = modifier
    ) {
        Column(
            modifier = Modifier.padding(10.dp),
            horizontalAlignment = Alignment.Start
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(label, style = MaterialTheme.typography.labelSmall, color = FarmTextMutedLight, fontSize = 10.sp)
                Icon(icon, contentDescription = null, tint = color, modifier = Modifier.size(16.dp))
            }

            Spacer(modifier = Modifier.height(4.dp))

            Text(
                text = value,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = if (isWarning) color else FarmForegroundLight,
                fontSize = 16.sp
            )

            Spacer(modifier = Modifier.height(3.dp))

            Surface(
                shape = RoundedCornerShape(6.dp),
                color = color.copy(alpha = 0.12f)
            ) {
                Text(
                    text = status,
                    style = MaterialTheme.typography.labelSmall,
                    fontSize = 9.sp,
                    color = color,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                )
            }
        }
    }
}

@Composable
fun LiveTrendCanvas(
    points: List<EnvHistoryPoint>,
    modifier: Modifier = Modifier
) {
    Canvas(modifier = modifier) {
        if (points.isEmpty()) return@Canvas

        val w = size.width
        val h = size.height

        val minTemp = 20.0
        val maxTemp = 40.0
        val tempRange = maxTemp - minTemp

        val minHum = 40.0
        val maxHum = 100.0
        val humRange = maxHum - minHum

        val stepX = w / (points.size - 1).coerceAtLeast(1)

        val tempPath = Path()
        val humPath = Path()

        points.forEachIndexed { i, p ->
            val x = i * stepX
            val yTemp = h - ((p.temp - minTemp) / tempRange * h).toFloat()
            val yHum = h - ((p.hum - minHum) / humRange * h).toFloat()

            if (i == 0) {
                tempPath.moveTo(x, yTemp)
                humPath.moveTo(x, yHum)
            } else {
                tempPath.lineTo(x, yTemp)
                humPath.lineTo(x, yHum)
            }

            // Draw point dots
            drawCircle(FarmPrimary, radius = 3.dp.toPx(), center = Offset(x, yTemp))
            drawCircle(FarmInfo, radius = 2.5.dp.toPx(), center = Offset(x, yHum))
        }

        drawPath(tempPath, FarmPrimary, style = Stroke(width = 2.5.dp.toPx(), cap = StrokeCap.Round))
        drawPath(humPath, FarmInfo, style = Stroke(width = 2.dp.toPx(), cap = StrokeCap.Round))
    }
}
