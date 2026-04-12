package com.boardinghub.mobile.ui.auth

import android.app.Activity
import android.content.Context
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.boardinghub.mobile.BuildConfig
import com.boardinghub.mobile.R
import com.boardinghub.mobile.data.AuthPreferences
import com.boardinghub.mobile.data.GoogleAuthService
import com.boardinghub.mobile.data.GoogleSignInPending
import com.boardinghub.mobile.data.GoogleSignInResult
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.auth.api.signin.GoogleSignInClient
import com.google.android.gms.auth.api.signin.GoogleSignInOptions
import com.google.android.gms.auth.api.signin.GoogleSignInStatusCodes
import com.google.android.gms.common.api.ApiException
import com.google.gson.Gson
import kotlinx.coroutines.launch

@Composable
fun LoginWithGoogleSection(
    snackbarHostState: SnackbarHostState,
    enabled: Boolean,
    onBusyChange: (Boolean) -> Unit,
    onAuthSuccess: () -> Unit,
    onNavigateToCompleteGoogleProfile: () -> Unit,
    modifier: Modifier = Modifier
) {
    val activity = LocalContext.current as Activity
    val scope = rememberCoroutineScope()
    val gson = remember { Gson() }

    val gso = remember {
        GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
            .requestIdToken(BuildConfig.GOOGLE_WEB_CLIENT_ID)
            .requestEmail()
            .requestProfile()
            .build()
    }
    val client = remember(activity) { GoogleSignIn.getClient(activity, gso) }

    val launcher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.StartActivityForResult()
    ) { result ->
        val task = GoogleSignIn.getSignedInAccountFromIntent(result.data)
        try {
            val account = task.getResult(ApiException::class.java)
            val idToken = account?.idToken
            if (idToken.isNullOrBlank()) {
                scope.launch {
                    snackbarHostState.showSnackbar(
                        activity.getString(R.string.google_sign_in_no_token)
                    )
                }
            } else {
                scope.launch {
                    onBusyChange(true)
                    exchangeGoogleForSession(
                        idToken = idToken,
                        fullName = null,
                        role = null,
                        snackbarHostState = snackbarHostState,
                        activity = activity,
                        gson = gson,
                        client = client,
                        onNavigateToCompleteGoogleProfile = onNavigateToCompleteGoogleProfile,
                        onAuthSuccess = onAuthSuccess
                    )
                    onBusyChange(false)
                }
            }
        } catch (e: ApiException) {
            if (e.statusCode != GoogleSignInStatusCodes.SIGN_IN_CANCELLED) {
                scope.launch {
                    snackbarHostState.showSnackbar(googleSignInUserMessage(activity, e))
                }
            }
        }
    }

    Column(modifier = modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
        Text(
            text = stringResource(R.string.login_with_google_label),
            style = MaterialTheme.typography.titleSmall,
            color = MaterialTheme.colorScheme.onBackground,
            textAlign = TextAlign.Center
        )
        Spacer(modifier = Modifier.height(10.dp))
        OutlinedButton(
            onClick = {
                if (!enabled) return@OutlinedButton
                launcher.launch(client.signInIntent)
            },
            enabled = enabled,
            modifier = Modifier
                .width(168.dp)
                .height(52.dp)
        ) {
            Image(
                painter = painterResource(R.drawable.ic_google_logo),
                contentDescription = stringResource(R.string.login_with_google_cd),
                modifier = Modifier.size(28.dp)
            )
        }
    }
}

private fun googleSignInUserMessage(context: Context, e: ApiException): String {
    return when (e.statusCode) {
        GoogleSignInStatusCodes.DEVELOPER_ERROR ->
            context.getString(R.string.google_error_developer)
        GoogleSignInStatusCodes.NETWORK_ERROR ->
            context.getString(R.string.google_error_network)
        GoogleSignInStatusCodes.SIGN_IN_REQUIRED,
        GoogleSignInStatusCodes.INVALID_ACCOUNT ->
            context.getString(R.string.google_sign_in_failed)
        else -> {
            val raw = e.message?.trim().orEmpty()
            if (raw.isNotEmpty() && raw != "${e.statusCode}:" && raw != "${e.statusCode}") {
                raw
            } else {
                context.getString(R.string.google_error_generic, e.statusCode)
            }
        }
    }
}

private suspend fun exchangeGoogleForSession(
    idToken: String,
    fullName: String?,
    role: String?,
    snackbarHostState: SnackbarHostState,
    activity: Activity,
    gson: Gson,
    client: GoogleSignInClient,
    onNavigateToCompleteGoogleProfile: () -> Unit,
    onAuthSuccess: () -> Unit
) {
    when (val result = GoogleAuthService.signInWithGoogle(idToken, fullName, role)) {
        is GoogleSignInResult.Success -> {
            val token = result.auth.accessToken
            val user = result.auth.user
            if (token.isNullOrBlank() || user == null) {
                snackbarHostState.showSnackbar(
                    activity.getString(R.string.google_sign_in_failed)
                )
            } else {
                AuthPreferences.saveSession(token, gson.toJson(user))
                client.signOut()
                onAuthSuccess()
            }
        }

        is GoogleSignInResult.ProfileRequired -> {
            GoogleSignInPending.setForProfileCompletion(
                idToken = idToken,
                email = result.email,
                suggestedFullName = result.suggestedFullName
            )
            onNavigateToCompleteGoogleProfile()
        }

        is GoogleSignInResult.Error -> {
            snackbarHostState.showSnackbar(result.message)
        }
    }
}
