package com.restroqr.owner.data.models

import com.google.gson.annotations.SerializedName

// ─── Request DTOs ────────────────────────────────────────────────────────────

data class CreateRestaurantRequest(
    @SerializedName("name") val name: String,
    @SerializedName("address") val address: String,
    @SerializedName("phone") val phone: String
)

data class UpdateRestaurantRequest(
    @SerializedName("name") val name: String? = null,
    @SerializedName("address") val address: String? = null,
    @SerializedName("phone") val phone: String? = null
)

// ─── Response DTOs ───────────────────────────────────────────────────────────

data class RestaurantData(
    @SerializedName("id") val id: String,
    @SerializedName("ownerId") val ownerId: String,
    @SerializedName("name") val name: String,
    @SerializedName("address") val address: String,
    @SerializedName("phone") val phone: String,
    @SerializedName("logoUrl") val logoUrl: String?,
    @SerializedName("coverImageUrl") val coverImageUrl: String?,
    @SerializedName("restaurantToken") val restaurantToken: String,
    @SerializedName("status") val status: String,
    @SerializedName("createdAt") val createdAt: String,
    @SerializedName("updatedAt") val updatedAt: String
)

data class ImageUploadData(
    @SerializedName("logoUrl") val logoUrl: String?,
    @SerializedName("coverImageUrl") val coverImageUrl: String?
)
