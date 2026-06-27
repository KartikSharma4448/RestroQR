package com.restroqr.owner.data.repository

import com.restroqr.owner.data.api.RestroQrApi
import com.restroqr.owner.data.models.*
import okhttp3.ResponseBody
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Repository handling menu operations (categories and food items CRUD, QR code).
 */
@Singleton
class MenuRepository @Inject constructor(
    private val api: RestroQrApi
) {

    // ─── Categories ──────────────────────────────────────────────────────────────

    /**
     * Get all categories for the owner's restaurant, ordered by display_order.
     */
    suspend fun getCategories(): Result<List<CategoryData>> {
        return try {
            val response = api.getCategories()
            if (response.isSuccessful && response.body()?.success == true) {
                Result.success(response.body()!!.data!!.categories)
            } else {
                val errorBody = response.body()?.error
                Result.failure(
                    ApiException(
                        code = errorBody?.code ?: "UNKNOWN_ERROR",
                        message = errorBody?.message ?: "Failed to get categories",
                        details = errorBody?.details
                    )
                )
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Create a new category.
     */
    suspend fun createCategory(request: CreateCategoryRequest): Result<CategoryData> {
        return try {
            val response = api.createCategory(request)
            if (response.isSuccessful && response.body()?.success == true) {
                Result.success(response.body()!!.data!!)
            } else {
                val errorBody = response.body()?.error
                Result.failure(
                    ApiException(
                        code = errorBody?.code ?: "UNKNOWN_ERROR",
                        message = errorBody?.message ?: "Failed to create category",
                        details = errorBody?.details
                    )
                )
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Update an existing category.
     */
    suspend fun updateCategory(id: String, request: UpdateCategoryRequest): Result<CategoryData> {
        return try {
            val response = api.updateCategory(id, request)
            if (response.isSuccessful && response.body()?.success == true) {
                Result.success(response.body()!!.data!!)
            } else {
                val errorBody = response.body()?.error
                Result.failure(
                    ApiException(
                        code = errorBody?.code ?: "UNKNOWN_ERROR",
                        message = errorBody?.message ?: "Failed to update category",
                        details = errorBody?.details
                    )
                )
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Delete a category (cascades to food items).
     */
    suspend fun deleteCategory(id: String): Result<String> {
        return try {
            val response = api.deleteCategory(id)
            if (response.isSuccessful && response.body()?.success == true) {
                Result.success(response.body()!!.data!!.message)
            } else {
                val errorBody = response.body()?.error
                Result.failure(
                    ApiException(
                        code = errorBody?.code ?: "UNKNOWN_ERROR",
                        message = errorBody?.message ?: "Failed to delete category",
                        details = errorBody?.details
                    )
                )
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Reorder categories by submitting the desired order of category IDs.
     */
    suspend fun reorderCategories(request: ReorderCategoriesRequest): Result<List<CategoryData>> {
        return try {
            val response = api.reorderCategories(request)
            if (response.isSuccessful && response.body()?.success == true) {
                Result.success(response.body()!!.data!!.categories)
            } else {
                val errorBody = response.body()?.error
                Result.failure(
                    ApiException(
                        code = errorBody?.code ?: "UNKNOWN_ERROR",
                        message = errorBody?.message ?: "Failed to reorder categories",
                        details = errorBody?.details
                    )
                )
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    // ─── Food Items ──────────────────────────────────────────────────────────────

    /**
     * Get all food items for a specific category.
     */
    suspend fun getFoodItems(categoryId: String): Result<List<FoodItemData>> {
        return try {
            val response = api.getFoodItems(categoryId)
            if (response.isSuccessful && response.body()?.success == true) {
                Result.success(response.body()!!.data!!.items)
            } else {
                val errorBody = response.body()?.error
                Result.failure(
                    ApiException(
                        code = errorBody?.code ?: "UNKNOWN_ERROR",
                        message = errorBody?.message ?: "Failed to get food items",
                        details = errorBody?.details
                    )
                )
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Create a new food item.
     */
    suspend fun createFoodItem(request: CreateFoodItemRequest): Result<FoodItemData> {
        return try {
            val response = api.createFoodItem(request)
            if (response.isSuccessful && response.body()?.success == true) {
                Result.success(response.body()!!.data!!)
            } else {
                val errorBody = response.body()?.error
                Result.failure(
                    ApiException(
                        code = errorBody?.code ?: "UNKNOWN_ERROR",
                        message = errorBody?.message ?: "Failed to create food item",
                        details = errorBody?.details
                    )
                )
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Update an existing food item.
     */
    suspend fun updateFoodItem(id: String, request: UpdateFoodItemRequest): Result<FoodItemData> {
        return try {
            val response = api.updateFoodItem(id, request)
            if (response.isSuccessful && response.body()?.success == true) {
                Result.success(response.body()!!.data!!)
            } else {
                val errorBody = response.body()?.error
                Result.failure(
                    ApiException(
                        code = errorBody?.code ?: "UNKNOWN_ERROR",
                        message = errorBody?.message ?: "Failed to update food item",
                        details = errorBody?.details
                    )
                )
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Delete a food item.
     */
    suspend fun deleteFoodItem(id: String): Result<String> {
        return try {
            val response = api.deleteFoodItem(id)
            if (response.isSuccessful && response.body()?.success == true) {
                Result.success(response.body()!!.data!!.message)
            } else {
                val errorBody = response.body()?.error
                Result.failure(
                    ApiException(
                        code = errorBody?.code ?: "UNKNOWN_ERROR",
                        message = errorBody?.message ?: "Failed to delete food item",
                        details = errorBody?.details
                    )
                )
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Toggle food item availability.
     */
    suspend fun toggleAvailability(
        id: String,
        request: ToggleAvailabilityRequest
    ): Result<FoodItemAvailabilityData> {
        return try {
            val response = api.toggleAvailability(id, request)
            if (response.isSuccessful && response.body()?.success == true) {
                Result.success(response.body()!!.data!!)
            } else {
                val errorBody = response.body()?.error
                Result.failure(
                    ApiException(
                        code = errorBody?.code ?: "UNKNOWN_ERROR",
                        message = errorBody?.message ?: "Failed to toggle availability",
                        details = errorBody?.details
                    )
                )
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    // ─── QR Code ─────────────────────────────────────────────────────────────────

    /**
     * Download the QR code image as raw bytes.
     */
    suspend fun getQrCode(): Result<ResponseBody> {
        return try {
            val response = api.getQrCode()
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.failure(
                    ApiException(
                        code = "QR_DOWNLOAD_FAILED",
                        message = "Failed to download QR code"
                    )
                )
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
