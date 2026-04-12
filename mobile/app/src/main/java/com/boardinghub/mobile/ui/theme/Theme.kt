package com.boardinghub.mobile.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val LightColors = lightColorScheme(
    primary = NavyPrimary,
    onPrimary = Color.White,
    primaryContainer = NavyMuted,
    onPrimaryContainer = NavyPrimary,
    secondary = AccentBlue,
    onSecondary = Color.White,
    background = SlateBackground,
    onBackground = NavyPrimary,
    surface = Color.White,
    onSurface = NavyPrimary
)

private val DarkColors = darkColorScheme(
    primary = NavyMuted,
    onPrimary = NavyPrimary,
    secondary = AccentBlue,
    onSecondary = Color.White,
    background = NavyPrimary,
    onBackground = NavyMuted,
    surface = Color(0xFF1E293B),
    onSurface = Color(0xFFF8FAFC)
)

@Composable
fun BoardingHubTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    MaterialTheme(
        colorScheme = if (darkTheme) DarkColors else LightColors,
        typography = Typography,
        content = content
    )
}
