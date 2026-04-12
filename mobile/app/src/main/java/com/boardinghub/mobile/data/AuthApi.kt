package com.boardinghub.mobile.data

import com.boardinghub.mobile.data.dto.AuthResponse
import com.boardinghub.mobile.data.dto.GoogleAuthRequest
import com.boardinghub.mobile.data.dto.LoginRequest
import com.boardinghub.mobile.data.dto.RegisterRequest
import okhttp3.ResponseBody
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.POST

interface AuthApi {
    @POST("auth/register")
    suspend fun register(@Body body: RegisterRequest): Response<AuthResponse>

    @POST("auth/login")
    suspend fun login(@Body body: LoginRequest): Response<AuthResponse>

    @POST("auth/google")
    suspend fun google(@Body body: GoogleAuthRequest): Response<ResponseBody>
}
