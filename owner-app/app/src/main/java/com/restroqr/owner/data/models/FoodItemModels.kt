package com.restroqr.owner.data.models

import com.google.gson.annotations.SerializedName

// ─── Request DTOs ────────────────────────────────────────────────────────────

data class CreateFoodItemRequest(
    @SerializedName("categoryId") val categoryId: String,
    @SerializedName("name") val name: String,
    @SerializedName("description") val description: String? = null,
    @SerializedName("price") val price: Double,
    @SerializedName("imageUrl") val imageUrl: String? = null,
    @SerializedName("badge") val badge: String,
    @SerializedName("isAvailable") val isAvailable: Boolean = true
)

data class UpdateFoodItemRequest(
    @SerializedName("categoryId") val categoryId: String? = null,
    @SerializedName("name") val name: String? = null,
    @SerializedName("description") val description: String? = null,
    @SerializedName("price") val price: Double? = null,
    @SerializedName("imageUrl") val imageUrl: String? = null,
    @SerializedName("badge") val badge: String? = null,
    @SerializedName("isAvailable") val isAvailable: Boolean? = null
)

data class ToggleAvailabilityRequest(
    @SerializedName("isAvailable") val isAvailable: Boolean
)

// ─── Response DTOs ───────────────────────────────────────────────────────────

data class FoodItemData(
    @SerializedName("id") val id: String,
    @SerializedName("categoryId") val categoryId: String,
    @SerializedName("restaurantId") val restaurantId: String,
    @SerializedName("name") val name: String,
    @SerializedName("description") val description: String?,
    @SerializedName("price") val price: Double,
    @SerializedName("imageUrl") val imageUrl: String?,
    @SerializedName("badge") val badge: String,
    @SerializedName("isAvailable") val isAvailable: Boolean,
    @SerializedName("createdAt") val createdAt: String,
    @SerializedName("updatedAt") val updatedAt: String
)

data class FoodItemsData(
    @SerializedName("items") val items: List<FoodItemData>
)

data class FoodItemAvailabilityData(
    @SerializedName("id") val id: String,
    @SerializedName("isAvailable") val isAvailable: Boolean
)
