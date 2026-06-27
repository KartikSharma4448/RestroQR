package com.restroqr.owner.data.api

import com.restroqr.owner.data.models.*
import okhttp3.MultipartBody
import okhttp3.ResponseBody
import retrofit2.Response
import retrofit2.http.*

/**
 * Retrofit interface defining all owner and auth endpoints for the RestroQR API.
 */
interface RestroQrApi {

    // ─── Authentication ──────────────────────────────────────────────────────────

    @POST("auth/register")
    suspend fun register(
        @Body request: RegisterRequest
    ): Response<ApiResponse<AuthData>>

    @POST("auth/login")
    suspend fun login(
        @Body request: LoginRequest
    ): Response<ApiResponse<AuthData>>

    // ─── Owner Restaurant ────────────────────────────────────────────────────────

    @POST("owner/restaurant")
    suspend fun createRestaurant(
        @Body request: CreateRestaurantRequest
    ): Response<ApiResponse<RestaurantData>>

    @GET("owner/restaurant")
    suspend fun getRestaurant(): Response<ApiResponse<RestaurantData>>

    @PUT("owner/restaurant")
    suspend fun updateRestaurant(
        @Body request: UpdateRestaurantRequest
    ): Response<ApiResponse<RestaurantData>>

    @Multipart
    @POST("owner/restaurant/images")
    suspend fun uploadImages(
        @Part logo: MultipartBody.Part? = null,
        @Part cover: MultipartBody.Part? = null
    ): Response<ApiResponse<ImageUploadData>>

    // ─── Categories ──────────────────────────────────────────────────────────────

    @GET("owner/categories")
    suspend fun getCategories(): Response<ApiResponse<CategoriesData>>

    @POST("owner/categories")
    suspend fun createCategory(
        @Body request: CreateCategoryRequest
    ): Response<ApiResponse<CategoryData>>

    @PUT("owner/categories/{id}")
    suspend fun updateCategory(
        @Path("id") id: String,
        @Body request: UpdateCategoryRequest
    ): Response<ApiResponse<CategoryData>>

    @DELETE("owner/categories/{id}")
    suspend fun deleteCategory(
        @Path("id") id: String
    ): Response<ApiResponse<MessageData>>

    @PUT("owner/categories/reorder")
    suspend fun reorderCategories(
        @Body request: ReorderCategoriesRequest
    ): Response<ApiResponse<CategoriesData>>

    // ─── Food Items ──────────────────────────────────────────────────────────────

    @GET("owner/categories/{id}/items")
    suspend fun getFoodItems(
        @Path("id") categoryId: String
    ): Response<ApiResponse<FoodItemsData>>

    @POST("owner/items")
    suspend fun createFoodItem(
        @Body request: CreateFoodItemRequest
    ): Response<ApiResponse<FoodItemData>>

    @PUT("owner/items/{id}")
    suspend fun updateFoodItem(
        @Path("id") id: String,
        @Body request: UpdateFoodItemRequest
    ): Response<ApiResponse<FoodItemData>>

    @DELETE("owner/items/{id}")
    suspend fun deleteFoodItem(
        @Path("id") id: String
    ): Response<ApiResponse<MessageData>>

    @PATCH("owner/items/{id}/availability")
    suspend fun toggleAvailability(
        @Path("id") id: String,
        @Body request: ToggleAvailabilityRequest
    ): Response<ApiResponse<FoodItemAvailabilityData>>

    // ─── QR Code ─────────────────────────────────────────────────────────────────

    @GET("owner/qr")
    @Streaming
    suspend fun getQrCode(): Response<ResponseBody>
}
