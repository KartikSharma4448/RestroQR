package com.restroqr.owner.data.models

import com.google.gson.annotations.SerializedName

// ─── Request DTOs ────────────────────────────────────────────────────────────

data class RegisterRequest(
    @SerializedName("name") val name: String,
    @SerializedName("email") val email: String? = null,
    @SerializedName("phone") val phone: String? = null,
    @SerializedName("password") val password: String
)

data class LoginRequest(
    @SerializedName("email") val email: String? = null,
    @SerializedName("phone") val phone: String? = null,
    @SerializedName("password") val password: String
)

// ─── Response DTOs ───────────────────────────────────────────────────────────

data class AuthData(
    @SerializedName("token") val token: String,
    @SerializedName("user") val user: UserData
)

data class UserData(
    @SerializedName("id") val id: String,
    @SerializedName("name") val name: String,
    @SerializedName("email") val email: String?,
    @SerializedName("phone") val phone: String?,
    @SerializedName("role") val role: String,
    @SerializedName("status") val status: String
)
