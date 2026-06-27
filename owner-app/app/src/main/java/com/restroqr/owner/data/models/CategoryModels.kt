package com.restroqr.owner.data.models

import com.google.gson.annotations.SerializedName

// ─── Request DTOs ────────────────────────────────────────────────────────────

data class CreateCategoryRequest(
    @SerializedName("name") val name: String
)

data class UpdateCategoryRequest(
    @SerializedName("name") val name: String
)

data class ReorderCategoriesRequest(
    @SerializedName("categoryIds") val categoryIds: List<String>
)

// ─── Response DTOs ───────────────────────────────────────────────────────────

data class CategoryData(
    @SerializedName("id") val id: String,
    @SerializedName("restaurantId") val restaurantId: String,
    @SerializedName("name") val name: String,
    @SerializedName("displayOrder") val displayOrder: Int,
    @SerializedName("createdAt") val createdAt: String,
    @SerializedName("updatedAt") val updatedAt: String
)

data class CategoriesData(
    @SerializedName("categories") val categories: List<CategoryData>
)
