package com.smartfarm.app.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable

private val LightColorScheme = lightColorScheme(
    primary = FarmPrimary,
    onPrimary = FarmOnPrimary,
    primaryContainer = FarmCardBorderLight,
    onPrimaryContainer = FarmForegroundLight,
    secondary = FarmSecondary,
    onSecondary = FarmOnSecondary,
    tertiary = FarmAccent,
    onTertiary = FarmOnAccent,
    background = FarmBackgroundLight,
    onBackground = FarmForegroundLight,
    surface = FarmCardLight,
    onSurface = FarmForegroundLight,
    surfaceVariant = FarmMutedLight,
    onSurfaceVariant = FarmTextMutedLight,
    outline = FarmCardBorderLight,
    error = FarmDestructive,
    onError = FarmOnDestructive
)

private val DarkColorScheme = darkColorScheme(
    primary = FarmSecondary,
    onPrimary = FarmOnSecondary,
    primaryContainer = FarmCardBorderDark,
    onPrimaryContainer = FarmForegroundDark,
    secondary = FarmPrimary,
    onSecondary = FarmOnPrimary,
    tertiary = FarmAccent,
    onTertiary = FarmOnAccent,
    background = FarmBackgroundDark,
    onBackground = FarmForegroundDark,
    surface = FarmCardDark,
    onSurface = FarmForegroundDark,
    surfaceVariant = FarmCardBorderDark,
    onSurfaceVariant = FarmTextMutedDark,
    outline = FarmCardBorderDark,
    error = FarmDestructive,
    onError = FarmOnDestructive
)

@Composable
fun SmartFarmTheme(
    darkTheme: Boolean = false, // Ưu tiên giao diện màu trắng sáng tinh tế, sạch đẹp
    content: @Composable () -> Unit
) {
    val colorScheme = if (darkTheme) DarkColorScheme else LightColorScheme

    MaterialTheme(
        colorScheme = colorScheme,
        typography = FarmTypography,
        shapes = FarmShapes,
        content = content
    )
}
