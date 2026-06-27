package com.restroqr.owner.data.models

import com.google.gson.annotations.SerializedName

/**
 * Generic API response wrapper matching the backend's response format.
 * All API responses follow: { success: Boolean, data?: T, error?: ErrorData }
 */
data class ApiResponse<T>(
    @SerializedName("success") val success: Boolean,
    @SerializedName("data") val data: T? = null,
    @SerializedName("error") val error: ErrorData? = null
)

data class ErrorData(
    @SerializedName("code") val code: String,
    @SerializedName("message") val message: String,
    @SerializedName("details") val details: List<FieldError>? = null
)

data class FieldError(
    @SerializedName("field") val field: String,
    @SerializedName("message") val message: String
)

/**
 * Simple wrapper for responses that only contain a message.
 */
data class MessageData(
    @SerializedName("message") val message: String
)
