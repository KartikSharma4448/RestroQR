package com.restroqr.owner.data.repository

import com.restroqr.owner.data.api.RestroQrApi
import com.restroqr.owner.data.models.*
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.asRequestBody
import java.io.File
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Repository handling restaurant profile operations (create, read, update, image upload).
 */
@Singleton
class RestaurantRepository @Inject constructor(
    private val api: RestroQrApi
) {

    /**
     * Create a new restaurant profile.
     */
    suspend fun createRestaurant(request: CreateRestaurantRequest): Result<RestaurantData> {
        return try {
            val response = api.createRestaurant(request)
            if (response.isSuccessful && response.body()?.success == true) {
                Result.success(response.body()!!.data!!)
            } else {
                val errorBody = response.body()?.error
                Result.failure(
                    ApiException(
                        code = errorBody?.code ?: "UNKNOWN_ERROR",
                        message = errorBody?.message ?: "Failed to create restaurant",
                        details = errorBody?.details
                    )
                )
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Get the current owner's restaurant profile.
     */
    suspend fun getRestaurant(): Result<RestaurantData> {
        return try {
            val response = api.getRestaurant()
            if (response.isSuccessful && response.body()?.success == true) {
                Result.success(response.body()!!.data!!)
            } else {
                val errorBody = response.body()?.error
                Result.failure(
                    ApiException(
                        code = errorBody?.code ?: "UNKNOWN_ERROR",
                        message = errorBody?.message ?: "Failed to get restaurant",
                        details = errorBody?.details
                    )
                )
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Update the restaurant profile.
     */
    suspend fun updateRestaurant(request: UpdateRestaurantRequest): Result<RestaurantData> {
        return try {
            val response = api.updateRestaurant(request)
            if (response.isSuccessful && response.body()?.success == true) {
                Result.success(response.body()!!.data!!)
            } else {
                val errorBody = response.body()?.error
                Result.failure(
                    ApiException(
                        code = errorBody?.code ?: "UNKNOWN_ERROR",
                        message = errorBody?.message ?: "Failed to update restaurant",
                        details = errorBody?.details
                    )
                )
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Upload restaurant logo and/or cover image.
     *
     * @param logoFile Optional logo image file
     * @param coverFile Optional cover image file
     */
    suspend fun uploadImages(
        logoFile: File? = null,
        coverFile: File? = null
    ): Result<ImageUploadData> {
        return try {
            val logoPart = logoFile?.let { file ->
                val mediaType = "image/*".toMediaTypeOrNull()
                val requestBody = file.asRequestBody(mediaType)
                MultipartBody.Part.createFormData("logo", file.name, requestBody)
            }

            val coverPart = coverFile?.let { file ->
                val mediaType = "image/*".toMediaTypeOrNull()
                val requestBody = file.asRequestBody(mediaType)
                MultipartBody.Part.createFormData("cover", file.name, requestBody)
            }

            val response = api.uploadImages(logoPart, coverPart)
            if (response.isSuccessful && response.body()?.success == true) {
                Result.success(response.body()!!.data!!)
            } else {
                val errorBody = response.body()?.error
                Result.failure(
                    ApiException(
                        code = errorBody?.code ?: "UNKNOWN_ERROR",
                        message = errorBody?.message ?: "Failed to upload images",
                        details = errorBody?.details
                    )
                )
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
