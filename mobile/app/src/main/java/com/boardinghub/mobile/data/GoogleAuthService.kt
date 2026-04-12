package com.boardinghub.mobile.data

import com.boardinghub.mobile.data.dto.AuthResponse
import com.boardinghub.mobile.data.dto.GoogleAuthRequest
import com.google.gson.Gson
import com.google.gson.JsonObject

object GoogleAuthService {
    private val gson = Gson()

    suspend fun signInWithGoogle(
        token: String,
        fullName: String? = null,
        role: String? = null
    ): GoogleSignInResult {
        return try {
            val response = ApiClient.authApi.google(GoogleAuthRequest(token, fullName, role))
            val payload = response.body()?.string().orEmpty().ifBlank {
                response.errorBody()?.string().orEmpty()
            }.trim()
            when (response.code()) {
                200 -> {
                    val auth = gson.fromJson(payload, AuthResponse::class.java)
                    if (!auth.accessToken.isNullOrBlank() && auth.user != null) {
                        GoogleSignInResult.Success(auth)
                    } else {
                        GoogleSignInResult.Error("Invalid server response")
                    }
                }
                428 -> parseProfileRequiredPayload(payload)
                else -> GoogleSignInResult.Error(
                    payload.ifBlank { response.message() }
                        .ifBlank { "Google sign-in failed" }
                )
            }
        } catch (e: Exception) {
            GoogleSignInResult.Error(
                e.message?.takeIf { it.isNotEmpty() } ?: "Google sign-in failed"
            )
        }
    }

    private fun parseProfileRequiredPayload(payload: String): GoogleSignInResult {
        return try {
            val obj = gson.fromJson(payload, JsonObject::class.java)
            val code = obj.get("code")?.asString
            if (code == "FULL_NAME_REQUIRED") {
                GoogleSignInResult.ProfileRequired(
                    email = obj.get("email")?.asString.orEmpty(),
                    suggestedFullName = obj.get("suggestedFullName")?.asString
                )
            } else {
                GoogleSignInResult.Error("Profile completion required")
            }
        } catch (_: Exception) {
            GoogleSignInResult.Error("Profile completion required")
        }
    }
}

sealed interface GoogleSignInResult {
    data class Success(val auth: AuthResponse) : GoogleSignInResult
    data class ProfileRequired(
        val email: String,
        val suggestedFullName: String?
    ) : GoogleSignInResult

    data class Error(val message: String) : GoogleSignInResult
}
