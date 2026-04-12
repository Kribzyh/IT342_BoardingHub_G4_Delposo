package com.boardinghub.mobile.data

import com.boardinghub.mobile.data.dto.AuthResponse
import com.boardinghub.mobile.data.dto.RegisterRequest
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.POST

interface AuthApi {
    @POST("auth/register")
    suspend fun register(@Body body: RegisterRequest): Response<AuthResponse>
}
