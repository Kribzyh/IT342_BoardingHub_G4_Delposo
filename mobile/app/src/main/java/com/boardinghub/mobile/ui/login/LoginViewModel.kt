package com.boardinghub.mobile.ui.login

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.boardinghub.mobile.data.ApiClient
import com.boardinghub.mobile.data.AuthPreferences
import com.boardinghub.mobile.data.dto.LoginRequest
import com.google.gson.Gson
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.launch

class LoginViewModel(application: Application) : AndroidViewModel(application) {

    private val authApi = ApiClient.authApi
    private val gson = Gson()

    private val _events = MutableSharedFlow<LoginUiEvent>(extraBufferCapacity = 1)
    val events = _events.asSharedFlow()

    fun login(email: String, password: String) {
        viewModelScope.launch {
            val emailTrim = email.trim()
            val validation = validate(emailTrim, password)
            if (validation != null) {
                _events.emit(LoginUiEvent.ValidationError(validation))
                return@launch
            }

            _events.emit(LoginUiEvent.Loading(true))
            try {
                val response = authApi.login(LoginRequest(email = emailTrim, password = password))
                if (response.isSuccessful) {
                    val body = response.body()
                    val token = body?.accessToken
                    val user = body?.user
                    if (token.isNullOrBlank() || user == null) {
                        _events.emit(LoginUiEvent.ApiError("Unexpected response from server"))
                    } else {
                        AuthPreferences.saveSession(
                            accessToken = token,
                            userJson = gson.toJson(user)
                        )
                        _events.emit(LoginUiEvent.Success)
                    }
                } else {
                    val message = response.errorBody()?.string()?.trim()?.takeIf { it.isNotEmpty() }
                        ?: "Login failed"
                    _events.emit(LoginUiEvent.ApiError(message))
                }
            } catch (e: Exception) {
                val message = e.message?.takeIf { it.isNotEmpty() } ?: "Could not reach the server"
                _events.emit(LoginUiEvent.ApiError(message))
            } finally {
                _events.emit(LoginUiEvent.Loading(false))
            }
        }
    }

    private fun validate(email: String, password: String): LoginFieldErrors? {
        var emailErr: String? = null
        var passwordErr: String? = null

        if (!android.util.Patterns.EMAIL_ADDRESS.matcher(email).matches()) {
            emailErr = "Enter a valid email address"
        }
        if (password.isBlank()) {
            passwordErr = "Enter your password"
        }

        return if (emailErr == null && passwordErr == null) {
            null
        } else {
            LoginFieldErrors(emailErr, passwordErr)
        }
    }
}

data class LoginFieldErrors(
    val email: String?,
    val password: String?
)

sealed interface LoginUiEvent {
    data class Loading(val isLoading: Boolean) : LoginUiEvent
    data class ValidationError(val errors: LoginFieldErrors) : LoginUiEvent
    data class ApiError(val message: String) : LoginUiEvent
    data object Success : LoginUiEvent
}

class LoginViewModelFactory(
    private val application: Application
) : ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        if (modelClass.isAssignableFrom(LoginViewModel::class.java)) {
            return LoginViewModel(application) as T
        }
        throw IllegalArgumentException("Unknown ViewModel class")
    }
}
