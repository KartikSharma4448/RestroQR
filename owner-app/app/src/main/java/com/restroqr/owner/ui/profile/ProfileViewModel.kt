package com.restroqr.owner.ui.profile

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.restroqr.owner.data.models.CreateRestaurantRequest
import com.restroqr.owner.data.models.RestaurantData
import com.restroqr.owner.data.models.UpdateRestaurantRequest
import com.restroqr.owner.data.repository.ApiException
import com.restroqr.owner.data.repository.RestaurantRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.io.File
import javax.inject.Inject

/**
 * UI state for restaurant profile operations.
 */
sealed class ProfileUiState {
    data object Idle : ProfileUiState()
    data object Loading : ProfileUiState()
    data class Success(val restaurant: RestaurantData) : ProfileUiState()
    data class Error(val message: String, val fieldErrors: Map<String, String> = emptyMap()) : ProfileUiState()
}

/**
 * UI state for image upload operations.
 */
sealed class ImageUploadUiState {
    data object Idle : ImageUploadUiState()
    data object Uploading : ImageUploadUiState()
    data class Success(val logoUrl: String?, val coverImageUrl: String?) : ImageUploadUiState()
    data class Error(val message: String) : ImageUploadUiState()
}

@HiltViewModel
class ProfileViewModel @Inject constructor(
    private val restaurantRepository: RestaurantRepository
) : ViewModel() {

    private val _profileState = MutableStateFlow<ProfileUiState>(ProfileUiState.Idle)
    val profileState: StateFlow<ProfileUiState> = _profileState.asStateFlow()

    private val _imageUploadState = MutableStateFlow<ImageUploadUiState>(ImageUploadUiState.Idle)
    val imageUploadState: StateFlow<ImageUploadUiState> = _imageUploadState.asStateFlow()

    private val _existingRestaurant = MutableStateFlow<RestaurantData?>(null)
    val existingRestaurant: StateFlow<RestaurantData?> = _existingRestaurant.asStateFlow()

    init {
        loadExistingRestaurant()
    }

    /**
     * Load the existing restaurant profile for edit mode.
     */
    fun loadExistingRestaurant() {
        viewModelScope.launch {
            _profileState.value = ProfileUiState.Loading

            val result = restaurantRepository.getRestaurant()
            result.fold(
                onSuccess = { restaurant ->
                    _existingRestaurant.value = restaurant
                    _profileState.value = ProfileUiState.Idle
                },
                onFailure = { throwable ->
                    // NOT_FOUND means no profile exists yet (create mode)
                    if (throwable is ApiException && throwable.code == "NOT_FOUND") {
                        _existingRestaurant.value = null
                        _profileState.value = ProfileUiState.Idle
                    } else {
                        _profileState.value = ProfileUiState.Idle
                        // Silently continue — user can still fill out the form
                    }
                }
            )
        }
    }

    /**
     * Create a new restaurant profile.
     * Validates fields before submission.
     */
    fun createRestaurant(name: String, address: String, phone: String) {
        val fieldErrors = validateFields(name, address, phone)
        if (fieldErrors.isNotEmpty()) {
            _profileState.value = ProfileUiState.Error(
                message = "Please fix the errors below",
                fieldErrors = fieldErrors
            )
            return
        }

        viewModelScope.launch {
            _profileState.value = ProfileUiState.Loading

            val request = CreateRestaurantRequest(
                name = name.trim(),
                address = address.trim(),
                phone = phone.trim()
            )

            val result = restaurantRepository.createRestaurant(request)
            _profileState.value = result.fold(
                onSuccess = { restaurant ->
                    _existingRestaurant.value = restaurant
                    ProfileUiState.Success(restaurant)
                },
                onFailure = { throwable -> mapErrorToState(throwable) }
            )
        }
    }

    /**
     * Update the existing restaurant profile.
     * Validates fields before submission.
     */
    fun updateRestaurant(name: String, address: String, phone: String) {
        val fieldErrors = validateFields(name, address, phone)
        if (fieldErrors.isNotEmpty()) {
            _profileState.value = ProfileUiState.Error(
                message = "Please fix the errors below",
                fieldErrors = fieldErrors
            )
            return
        }

        viewModelScope.launch {
            _profileState.value = ProfileUiState.Loading

            val request = UpdateRestaurantRequest(
                name = name.trim(),
                address = address.trim(),
                phone = phone.trim()
            )

            val result = restaurantRepository.updateRestaurant(request)
            _profileState.value = result.fold(
                onSuccess = { restaurant ->
                    _existingRestaurant.value = restaurant
                    ProfileUiState.Success(restaurant)
                },
                onFailure = { throwable -> mapErrorToState(throwable) }
            )
        }
    }

    /**
     * Upload restaurant images (logo and/or cover).
     *
     * @param logoFile Logo image file, or null to skip
     * @param coverFile Cover image file, or null to skip
     */
    fun uploadImages(logoFile: File? = null, coverFile: File? = null) {
        if (logoFile == null && coverFile == null) return

        viewModelScope.launch {
            _imageUploadState.value = ImageUploadUiState.Uploading

            val result = restaurantRepository.uploadImages(logoFile, coverFile)
            _imageUploadState.value = result.fold(
                onSuccess = { imageData ->
                    ImageUploadUiState.Success(
                        logoUrl = imageData.logoUrl,
                        coverImageUrl = imageData.coverImageUrl
                    )
                },
                onFailure = { throwable ->
                    when (throwable) {
                        is ApiException -> {
                            val message = when (throwable.code) {
                                "FILE_TOO_LARGE" -> "Image must be under 5MB"
                                "UNSUPPORTED_FORMAT" -> "Only JPEG, PNG, and WebP are supported"
                                else -> throwable.message
                            }
                            ImageUploadUiState.Error(message)
                        }
                        is java.net.UnknownHostException,
                        is java.net.ConnectException -> {
                            ImageUploadUiState.Error("Network error. Please check your connection.")
                        }
                        else -> {
                            ImageUploadUiState.Error("Failed to upload image. Please try again.")
                        }
                    }
                }
            )
        }
    }

    /**
     * Reset the profile state to idle (e.g., after navigating away or dismissing an error).
     */
    fun resetProfileState() {
        _profileState.value = ProfileUiState.Idle
    }

    /**
     * Reset the image upload state to idle.
     */
    fun resetImageUploadState() {
        _imageUploadState.value = ImageUploadUiState.Idle
    }

    /**
     * Validate restaurant profile fields.
     * Returns a map of field names to error messages (empty if valid).
     */
    private fun validateFields(name: String, address: String, phone: String): Map<String, String> {
        val errors = mutableMapOf<String, String>()

        if (name.isBlank()) {
            errors["name"] = "Restaurant name is required"
        } else if (name.trim().length > 100) {
            errors["name"] = "Name must be 100 characters or less"
        }

        if (address.isBlank()) {
            errors["address"] = "Address is required"
        } else if (address.trim().length > 250) {
            errors["address"] = "Address must be 250 characters or less"
        }

        if (phone.isBlank()) {
            errors["phone"] = "Phone number is required"
        } else if (phone.trim().length > 20) {
            errors["phone"] = "Phone must be 20 characters or less"
        }

        return errors
    }

    /**
     * Map API exceptions to user-facing profile error states.
     */
    private fun mapErrorToState(throwable: Throwable): ProfileUiState.Error {
        return when (throwable) {
            is ApiException -> {
                val fieldErrors = throwable.details
                    ?.associate { it.field to it.message }
                    ?: emptyMap()
                ProfileUiState.Error(message = throwable.message, fieldErrors = fieldErrors)
            }
            is java.net.UnknownHostException,
            is java.net.ConnectException -> {
                ProfileUiState.Error(message = "Network error. Please check your connection and try again.")
            }
            else -> {
                ProfileUiState.Error(message = "An unexpected error occurred. Please try again.")
            }
        }
    }
}
