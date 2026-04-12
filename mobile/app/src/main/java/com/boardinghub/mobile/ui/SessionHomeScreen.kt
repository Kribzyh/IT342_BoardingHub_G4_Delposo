package com.boardinghub.mobile.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.boardinghub.mobile.R
import com.boardinghub.mobile.data.AuthPreferences
import com.boardinghub.mobile.data.dto.UserDto
import com.boardinghub.mobile.ui.theme.NavyPrimary
import com.google.gson.Gson

@Composable
fun SessionHomeScreen(
    onLoggedOut: () -> Unit,
    modifier: Modifier = Modifier
) {
    val user = remember {
        val json = AuthPreferences.userJson()
        if (json.isNullOrBlank()) null else runCatching {
            Gson().fromJson(json, UserDto::class.java)
        }.getOrNull()
    }

    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(horizontal = 28.dp, vertical = 48.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(
            text = stringResource(R.string.home_signed_in_title),
            style = MaterialTheme.typography.headlineSmall,
            color = NavyPrimary,
            textAlign = TextAlign.Center
        )

        Spacer(modifier = Modifier.height(12.dp))

        Text(
            text = user?.fullName?.takeIf { it.isNotBlank() }
                ?: stringResource(R.string.home_signed_in_fallback_name),
            style = MaterialTheme.typography.titleMedium,
            color = MaterialTheme.colorScheme.onBackground,
            textAlign = TextAlign.Center
        )

        user?.email?.let { email ->
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = email,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.75f),
                textAlign = TextAlign.Center
            )
        }

        Spacer(modifier = Modifier.height(40.dp))

        Button(
            onClick = {
                AuthPreferences.clear()
                onLoggedOut()
            },
            modifier = Modifier
                .fillMaxWidth()
                .height(52.dp),
            shape = RoundedCornerShape(12.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = NavyPrimary,
                contentColor = MaterialTheme.colorScheme.onPrimary
            )
        ) {
            Text(
                text = stringResource(R.string.log_out),
                style = MaterialTheme.typography.labelLarge
            )
        }
    }
}
