package com.boardinghub.mobile.ui.auth

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.boardinghub.mobile.BuildConfig
import com.boardinghub.mobile.R
import com.boardinghub.mobile.data.AuthPreferences
import com.boardinghub.mobile.data.GoogleAuthService
import com.boardinghub.mobile.data.GoogleSignInPending
import com.boardinghub.mobile.data.GoogleSignInResult
import com.boardinghub.mobile.ui.register.RegisterAccountRole
import com.boardinghub.mobile.ui.theme.NavyPrimary
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.auth.api.signin.GoogleSignInOptions
import com.google.gson.Gson
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun GoogleCompleteProfileScreen(
    onBack: () -> Unit,
    onRegistrationSuccess: () -> Unit,
    modifier: Modifier = Modifier
) {
    val activity = LocalContext.current
    val scope = rememberCoroutineScope()
    val snackbarHostState = remember { SnackbarHostState() }
    val gson = remember { Gson() }

    val gso = remember {
        GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
            .requestIdToken(BuildConfig.GOOGLE_WEB_CLIENT_ID)
            .requestEmail()
            .requestProfile()
            .build()
    }
    val googleClient = remember(activity) { GoogleSignIn.getClient(activity, gso) }

    var fullName by remember { mutableStateOf("") }
    var role by remember { mutableStateOf(RegisterAccountRole.TENANT) }
    var submitting by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        if (!GoogleSignInPending.isReady()) {
            onBack()
            return@LaunchedEffect
        }
        fullName = GoogleSignInPending.suggestedFullName.orEmpty().ifBlank {
            GoogleSignInPending.email!!.substringBefore("@")
        }
    }

    BackHandler(enabled = !submitting) {
        GoogleSignInPending.clear()
        onBack()
    }

    Scaffold(
        modifier = modifier,
        snackbarHost = { SnackbarHost(snackbarHostState) },
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.google_complete_profile_title)) },
                navigationIcon = {
                    IconButton(
                        onClick = {
                            GoogleSignInPending.clear()
                            onBack()
                        },
                        enabled = !submitting
                    ) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = stringResource(R.string.back)
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.primary,
                    titleContentColor = MaterialTheme.colorScheme.onPrimary,
                    navigationIconContentColor = MaterialTheme.colorScheme.onPrimary
                )
            )
        }
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .padding(horizontal = 24.dp, vertical = 16.dp)
                .verticalScroll(rememberScrollState())
        ) {
            Text(
                text = stringResource(R.string.google_complete_profile_body),
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.88f)
            )

            Spacer(modifier = Modifier.height(8.dp))

            Text(
                text = GoogleSignInPending.email.orEmpty(),
                style = MaterialTheme.typography.titleSmall,
                color = NavyPrimary
            )

            Spacer(modifier = Modifier.height(20.dp))

            OutlinedTextField(
                value = fullName,
                onValueChange = { fullName = it },
                label = { Text(stringResource(R.string.field_name)) },
                singleLine = true,
                enabled = !submitting,
                modifier = Modifier.fillMaxWidth()
            )

            Spacer(modifier = Modifier.height(16.dp))

            Text(
                text = stringResource(R.string.field_role),
                style = MaterialTheme.typography.labelLarge
            )
            Spacer(modifier = Modifier.height(6.dp))
            Column(Modifier.selectableGroup()) {
                RegisterAccountRole.entries.forEach { option ->
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        RadioButton(
                            selected = role == option,
                            onClick = { role = option },
                            enabled = !submitting
                        )
                        Text(
                            text = stringResource(option.labelRes),
                            style = MaterialTheme.typography.bodyLarge,
                            modifier = Modifier.padding(start = 4.dp)
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(28.dp))

            Button(
                onClick = {
                    val token = GoogleSignInPending.idToken ?: return@Button
                    val name = fullName.trim()
                    if (name.length < 2) {
                        scope.launch {
                            snackbarHostState.showSnackbar(
                                activity.getString(R.string.google_name_too_short)
                            )
                        }
                        return@Button
                    }
                    scope.launch {
                        submitting = true
                        when (
                            val result = GoogleAuthService.signInWithGoogle(
                                token,
                                name,
                                role.apiValue
                            )
                        ) {
                            is GoogleSignInResult.Success -> {
                                val jwt = result.auth.accessToken
                                val user = result.auth.user
                                if (jwt.isNullOrBlank() || user == null) {
                                    snackbarHostState.showSnackbar(
                                        activity.getString(R.string.google_sign_in_failed)
                                    )
                                } else {
                                    AuthPreferences.saveSession(jwt, gson.toJson(user))
                                    googleClient.signOut()
                                    GoogleSignInPending.clear()
                                    onRegistrationSuccess()
                                }
                            }

                            is GoogleSignInResult.ProfileRequired -> {
                                snackbarHostState.showSnackbar(
                                    activity.getString(R.string.google_still_needs_profile)
                                )
                            }

                            is GoogleSignInResult.Error -> {
                                snackbarHostState.showSnackbar(result.message)
                            }
                        }
                        submitting = false
                    }
                },
                enabled = !submitting && fullName.trim().length >= 2,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(52.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = NavyPrimary,
                    contentColor = MaterialTheme.colorScheme.onPrimary
                )
            ) {
                if (submitting) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(24.dp),
                        strokeWidth = 2.dp,
                        color = MaterialTheme.colorScheme.onPrimary
                    )
                } else {
                    Text(stringResource(R.string.google_finish_registration))
                }
            }
        }
    }
}
