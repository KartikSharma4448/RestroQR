package com.restroqr.owner.data.repository

import android.content.SharedPreferences
import com.restroqr.owner.data.api.RestroQrApi
import com.restroqr.owner.data.models.*
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Repository handling authentication operations (register, login, token management).
 */
@Singleton
class AuthRepository @Inject constructor(
    private val api: RestroQrApi,
    private val sharedPreferences: SharedPreferences
) {
    companion object {
        private const val KEY_ACCESS_TOKEN = "access_token"
        private const val KEY_USER_ID = "user_id"
        private const val KEY_USER_NAME = "user_name"
        private const val KEY_USER_EMAIL = "user_email"
        private const val KEY_USER_PHONE = "user_phone"
    }

    /**
     * Register a new owner account.
     */
    suspend fun register(request: RegisterRequest): Result<AuthData> {
        return try {
            val response = api.register(request)
            if (response.isSuccessful && response.body()?.success == true) {
                val authData = response.body()!!.data!!
                saveAuthData(authData)
                Result.success(authData)
            } else {
                val errorBody = response.body()?.error
                Result.failure(
                    ApiException(
                        code = errorBody?.code ?: "UNKNOWN_ERROR",
                        message = errorBody?.message ?: "Registration failed",
                        details = errorBody?.details
                    )
                )
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Login with existing credentials.
     */
    suspend fun login(request: LoginRequest): Result<AuthData> {
        return try {
            val response = api.login(request)
            if (response.isSuccessful && response.body()?.success == true) {
                val authData = response.body()!!.data!!
                saveAuthData(authData)
                Result.success(authData)
            } else {
                val errorBody = response.body()?.error
                Result.failure(
                    ApiException(
                        code = errorBody?.code ?: "UNKNOWN_ERROR",
                        message = errorBody?.message ?: "Login failed",
                        details = errorBody?.details
                    )
                )
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Check if the user is currently logged in (has a stored token).
     */
    fun isLoggedIn(): Boolean {
        return !sharedPreferences.getString(KEY_ACCESS_TOKEN, null).isNullOrBlank()
    }

    /**
     * Get the stored access token.
     */
    fun getAccessToken(): String? {
        return sharedPreferences.getString(KEY_ACCESS_TOKEN, null)
    }

    /**
     * Clear stored auth data (logout).
     */
    fun logout() {
        sharedPreferences.edit()
            .remove(KEY_ACCESS_TOKEN)
            .remove(KEY_USER_ID)
            .remove(KEY_USER_NAME)
            .remove(KEY_USER_EMAIL)
            .remove(KEY_USER_PHONE)
            .apply()
    }

    /**
     * Get stored user name.
     */
    fun getUserName(): String? {
        return sharedPreferences.getString(KEY_USER_NAME, null)
    }

    private fun saveAuthData(authData: AuthData) {
        sharedPreferences.edit()
            .putString(KEY_ACCESS_TOKEN, authData.token)
            .putString(KEY_USER_ID, authData.user.id)
            .putString(KEY_USER_NAME, authData.user.name)
            .putString(KEY_USER_EMAIL, authData.user.email)
            .putString(KEY_USER_PHONE, authData.user.phone)
            .apply()
    }
}

/**
 * Custom exception for API errors with structured error data.
 */
class ApiException(
    val code: String,
    override val message: String,
    val details: List<FieldError>? = null
) : Exception(message)
