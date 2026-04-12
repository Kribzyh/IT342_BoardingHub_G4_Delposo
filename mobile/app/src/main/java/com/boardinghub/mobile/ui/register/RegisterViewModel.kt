package com.boardinghub.mobile.ui.register

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.boardinghub.mobile.data.ApiClient
import com.boardinghub.mobile.data.dto.RegisterRequest
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.launch

class RegisterViewModel : ViewModel() {

    private val authApi = ApiClient.authApi

    private val _events = MutableSharedFlow<RegisterUiEvent>(extraBufferCapacity = 1)
    val events = _events.asSharedFlow()

    fun register(name: String, email: String, password: String, role: RegisterAccountRole) {
        viewModelScope.launch {
            val nameTrim = name.trim()
            val emailTrim = email.trim()
            val validation = validate(nameTrim, emailTrim, password)
            if (validation != null) {
                _events.emit(RegisterUiEvent.ValidationError(validation))
                return@launch
            }

            _events.emit(RegisterUiEvent.Loading(true))
            try {
                val response = authApi.register(
                    RegisterRequest(
                        email = emailTrim,
                        password = password,
                        fullName = nameTrim,
                        role = role.apiValue
                    )
                )
                if (response.isSuccessful) {
                    _events.emit(RegisterUiEvent.Success)
                } else {
                    val message = response.errorBody()?.string()?.trim()?.takeIf { it.isNotEmpty() }
                        ?: "Registration failed"
                    _events.emit(RegisterUiEvent.ApiError(message))
                }
            } catch (e: Exception) {
                val message = e.message?.takeIf { it.isNotEmpty() } ?: "Could not reach the server"
                _events.emit(RegisterUiEvent.ApiError(message))
            } finally {
                _events.emit(RegisterUiEvent.Loading(false))
            }
        }
    }

    private fun validate(name: String, email: String, password: String): RegisterFieldErrors? {
        var nameErr: String? = null
        var emailErr: String? = null
        var passwordErr: String? = null

        if (name.length < 2) {
            nameErr = "Enter at least 2 characters"
        }
        if (!android.util.Patterns.EMAIL_ADDRESS.matcher(email).matches()) {
            emailErr = "Enter a valid email address"
        }
        if (password.length < 8) {
            passwordErr = "Password must be at least 8 characters"
        }

        return if (nameErr == null && emailErr == null && passwordErr == null) {
            null
        } else {
            RegisterFieldErrors(nameErr, emailErr, passwordErr)
        }
    }
}

data class RegisterFieldErrors(
    val name: String?,
    val email: String?,
    val password: String?
)

sealed interface RegisterUiEvent {
    data class Loading(val isLoading: Boolean) : RegisterUiEvent
    data class ValidationError(val errors: RegisterFieldErrors) : RegisterUiEvent
    data class ApiError(val message: String) : RegisterUiEvent
    data object Success : RegisterUiEvent
}
