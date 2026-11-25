package com.smartfarm.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.smartfarm.app.ui.theme.FarmForegroundLight
import com.smartfarm.app.ui.theme.FarmPrimary

@Composable
fun GeminiRichText(
    text: String,
    isUser: Boolean = false,
    isStreaming: Boolean = false,
    fontSize: TextUnit = 13.sp,
    lineHeight: TextUnit = 19.sp,
    modifier: Modifier = Modifier
) {
    val baseColor = if (isUser) Color.White else FarmForegroundLight
    val lines = text.split("\n")

    Column(
        modifier = modifier,
        verticalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        lines.forEachIndexed { idx, line ->
            val trimmed = line.trim()
            val suffix = if (isStreaming && idx == lines.lastIndex) " ▍" else ""

            when {
                trimmed.isEmpty() -> {
                    Spacer(modifier = Modifier.height(2.dp))
                }
                trimmed.matches(Regex("^---+$")) -> {
                    HorizontalDivider(
                        color = if (isUser) Color.White.copy(alpha = 0.25f) else Color(0xFFE2E8F0),
                        modifier = Modifier.padding(vertical = 2.dp)
                    )
                }
                trimmed.startsWith("### ") || trimmed.startsWith("## ") || trimmed.startsWith("# ") -> {
                    val content = trimmed.removePrefix("### ").removePrefix("## ").removePrefix("# ")
                    Text(
                        text = parseInlineMarkdown(content + suffix, isUser, baseColor),
                        fontSize = (fontSize.value + 1.5f).sp,
                        fontWeight = FontWeight.Bold,
                        color = if (isUser) Color.White else FarmPrimary,
                        lineHeight = lineHeight
                    )
                }
                trimmed.startsWith("- ") || trimmed.startsWith("* ") || trimmed.startsWith("• ") -> {
                    val content = trimmed.drop(2)
                    Row(
                        verticalAlignment = Alignment.Top,
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        modifier = Modifier.padding(start = 4.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .padding(top = 7.dp)
                                .size(5.dp)
                                .clip(CircleShape)
                                .background(if (isUser) Color.White.copy(alpha = 0.85f) else FarmPrimary)
                        )
                        Text(
                            text = parseInlineMarkdown(content + suffix, isUser, baseColor),
                            fontSize = fontSize,
                            lineHeight = lineHeight,
                            color = baseColor,
                            modifier = Modifier.weight(1f)
                        )
                    }
                }
                Regex("^\\d+\\.\\s+.*").matches(trimmed) -> {
                    val dotIdx = trimmed.indexOf('.')
                    val numPrefix = trimmed.substring(0, dotIdx + 1)
                    val content = trimmed.substring(dotIdx + 1).trimStart()
                    Row(
                        verticalAlignment = Alignment.Top,
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                        modifier = Modifier.padding(start = 2.dp)
                    ) {
                        Text(
                            text = numPrefix,
                            fontSize = fontSize,
                            fontWeight = FontWeight.Bold,
                            color = if (isUser) Color.White.copy(alpha = 0.9f) else FarmPrimary
                        )
                        Text(
                            text = parseInlineMarkdown(content + suffix, isUser, baseColor),
                            fontSize = fontSize,
                            lineHeight = lineHeight,
                            color = baseColor,
                            modifier = Modifier.weight(1f)
                        )
                    }
                }
                trimmed.startsWith("> ") -> {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(8.dp))
                            .background(if (isUser) Color.White.copy(alpha = 0.12f) else FarmPrimary.copy(alpha = 0.08f))
                            .padding(horizontal = 10.dp, vertical = 6.dp)
                    ) {
                        Text(
                            text = parseInlineMarkdown(trimmed.drop(2) + suffix, isUser, baseColor),
                            fontSize = fontSize,
                            fontStyle = FontStyle.Italic,
                            lineHeight = lineHeight,
                            color = baseColor
                        )
                    }
                }
                else -> {
                    Text(
                        text = parseInlineMarkdown(line + suffix, isUser, baseColor),
                        fontSize = fontSize,
                        lineHeight = lineHeight,
                        color = baseColor
                    )
                }
            }
        }
    }
}

private fun parseInlineMarkdown(
    input: String,
    isUser: Boolean,
    baseColor: Color
): AnnotatedString {
    val pattern = Regex("(\\*\\*[^*]+\\*\\*|`[^`]+`|\\*[^*\\n]+\\*)")
    return buildAnnotatedString {
        var lastIndex = 0
        for (match in pattern.findAll(input)) {
            if (match.range.first > lastIndex) {
                append(input.substring(lastIndex, match.range.first))
            }
            val token = match.value
            when {
                token.startsWith("**") && token.endsWith("**") -> {
                    pushStyle(SpanStyle(fontWeight = FontWeight.Bold, color = baseColor))
                    append(token.substring(2, token.length - 2))
                    pop()
                }
                token.startsWith("`") && token.endsWith("`") -> {
                    pushStyle(
                        SpanStyle(
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.SemiBold,
                            background = if (isUser) Color.White.copy(alpha = 0.2f) else FarmPrimary.copy(alpha = 0.12f),
                            color = if (isUser) Color.White else FarmPrimary
                        )
                    )
                    append(" ${token.substring(1, token.length - 1)} ")
                    pop()
                }
                token.startsWith("*") && token.endsWith("*") -> {
                    pushStyle(SpanStyle(fontStyle = FontStyle.Italic, color = baseColor))
                    append(token.substring(1, token.length - 1))
                    pop()
                }
            }
            lastIndex = match.range.last + 1
        }
        if (lastIndex < input.length) {
            append(input.substring(lastIndex))
        }
    }
}
