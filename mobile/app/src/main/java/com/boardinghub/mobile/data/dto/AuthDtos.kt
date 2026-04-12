package com.boardinghub.mobile.data.dto

import com.google.gson.annotations.SerializedName

data class RegisterRequest(
    val email: String,
    val password: String,
    val fullName: String,
    val role: String = "TENANT"
)

data class LoginRequest(
    val email: String,
    val password: String
)

data class GoogleAuthRequest(
    val token: String,
    val fullName: String? = null,
    val role: String? = null
)

data class AuthResponse(
    @SerializedName("accessToken") val accessToken: String?,
    @SerializedName("refreshToken") val refreshToken: String?,
    val user: UserDto?
)

data class UserDto(
    val id: Long,
    val email: String,
    val fullName: String,
    val role: String?
)
