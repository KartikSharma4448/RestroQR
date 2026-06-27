package com.restroqr.owner.ui.menu

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.restroqr.owner.data.models.*
import com.restroqr.owner.data.repository.ApiException
import com.restroqr.owner.data.repository.MenuRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * UI state for the food items list screen.
 */
sealed class FoodItemsUiState {
    data object Loading : FoodItemsUiState()
    data class Success(val items: List<FoodItemData>) : FoodItemsUiState()
    data class Error(val message: String) : FoodItemsUiState()
}

/**
 * UI state for the food item form (create/edit).
 */
data class FoodItemFormState(
    val name: String = "",
    val description: String = "",
    val price: String = "",
    val imageUrl: String = "",
    val badge: String = "", // "veg" or "non_veg"
    val isAvailable: Boolean = true,
    val isLoading: Boolean = false,
    val isSaving: Boolean = false,
    val error: String? = null,
    val nameError: String? = null,
    val priceError: String? = null,
    val badgeError: String? = null,
    val saveSuccess: Boolean = false
)

@HiltViewModel
class FoodItemsViewModel @Inject constructor(
    private val menuRepository: MenuRepository,
    private val savedStateHandle: SavedStateHandle
) : ViewModel() {

    private val _uiState = MutableStateFlow<FoodItemsUiState>(FoodItemsUiState.Loading)
    val uiState: StateFlow<FoodItemsUiState> = _uiState.asStateFlow()

    private val _formState = MutableStateFlow(FoodItemFormState())
    val formState: StateFlow<FoodItemFormState> = _formState.asStateFlow()

    private val _showDeleteDialog = MutableStateFlow<FoodItemData?>(null)
    val showDeleteDialog: StateFlow<FoodItemData?> = _showDeleteDialog.asStateFlow()

    private var currentCategoryId: String = ""

    /**
     * Load food items for the given category.
     */
    fun loadFoodItems(categoryId: String) {
        currentCategoryId = categoryId
        viewModelScope.launch {
            _uiState.value = FoodItemsUiState.Loading
            val result = menuRepository.getFoodItems(categoryId)
            _uiState.value = result.fold(
                onSuccess = { items ->
                    FoodItemsUiState.Success(items)
                },
                onFailure = { throwable ->
                    when (throwable) {
                        is ApiException -> FoodItemsUiState.Error(throwable.message)
                        is java.net.UnknownHostException,
                        is java.net.ConnectException ->
                            FoodItemsUiState.Error("Network error. Please check your connection and try again.")
                        else -> FoodItemsUiState.Error("An unexpected error occurred. Please try again.")
                    }
                }
            )
        }
    }

    /**
     * Toggle availability of a food item.
     */
    fun toggleAvailability(item: FoodItemData) {
        viewModelScope.launch {
            val request = ToggleAvailabilityRequest(isAvailable = !item.isAvailable)
            val result = menuRepository.toggleAvailability(item.id, request)
            result.onSuccess { availabilityData ->
                // Update the item in the list
                val currentState = _uiState.value
                if (currentState is FoodItemsUiState.Success) {
                    val updatedItems = currentState.items.map { existingItem ->
                        if (existingItem.id == availabilityData.id) {
                            existingItem.copy(isAvailable = availabilityData.isAvailable)
                        } else {
                            existingItem
                        }
                    }
                    _uiState.value = FoodItemsUiState.Success(updatedItems)
                }
            }
            result.onFailure { /* Silently fail; user can retry */ }
        }
    }

    /**
     * Show delete confirmation dialog for the given item.
     */
    fun showDeleteConfirmation(item: FoodItemData) {
        _showDeleteDialog.value = item
    }

    /**
     * Dismiss the delete confirmation dialog.
     */
    fun dismissDeleteDialog() {
        _showDeleteDialog.value = null
    }

    /**
     * Delete a food item and refresh the list.
     */
    fun deleteFoodItem(item: FoodItemData) {
        viewModelScope.launch {
            _showDeleteDialog.value = null
            val result = menuRepository.deleteFoodItem(item.id)
            result.onSuccess {
                // Remove the item from the list
                val currentState = _uiState.value
                if (currentState is FoodItemsUiState.Success) {
                    val updatedItems = currentState.items.filter { it.id != item.id }
                    _uiState.value = FoodItemsUiState.Success(updatedItems)
                }
            }
            result.onFailure { throwable ->
                val errorMessage = when (throwable) {
                    is ApiException -> throwable.message
                    else -> "Failed to delete item. Please try again."
                }
                _uiState.value = FoodItemsUiState.Error(errorMessage)
            }
        }
    }

    // ─── Form Methods ────────────────────────────────────────────────────────────

    /**
     * Initialize the form for creating a new food item.
     */
    fun initFormForCreate(categoryId: String) {
        currentCategoryId = categoryId
        _formState.value = FoodItemFormState()
    }

    /**
     * Initialize the form for editing an existing food item.
     */
    fun initFormForEdit(itemId: String, categoryId: String) {
        currentCategoryId = categoryId
        _formState.value = _formState.value.copy(isLoading = true, error = null)
        viewModelScope.launch {
            val result = menuRepository.getFoodItems(categoryId)
            result.fold(
                onSuccess = { items ->
                    val item = items.find { it.id == itemId }
                    if (item != null) {
                        _formState.value = FoodItemFormState(
                            name = item.name,
                            description = item.description ?: "",
                            price = item.price.toBigDecimal().stripTrailingZeros().toPlainString(),
                            imageUrl = item.imageUrl ?: "",
                            badge = item.badge,
                            isAvailable = item.isAvailable,
                            isLoading = false
                        )
                    } else {
                        _formState.value = FoodItemFormState(
                            isLoading = false,
                            error = "Food item not found."
                        )
                    }
                },
                onFailure = { throwable ->
                    val errorMessage = when (throwable) {
                        is ApiException -> throwable.message
                        is java.net.UnknownHostException,
                        is java.net.ConnectException ->
                            "Network error. Please check your connection and try again."
                        else -> "An unexpected error occurred. Please try again."
                    }
                    _formState.value = FoodItemFormState(isLoading = false, error = errorMessage)
                }
            )
        }
    }

    fun updateName(name: String) {
        _formState.value = _formState.value.copy(name = name, nameError = null)
    }

    fun updateDescription(description: String) {
        _formState.value = _formState.value.copy(description = description)
    }

    fun updatePrice(price: String) {
        _formState.value = _formState.value.copy(price = price, priceError = null)
    }

    fun updateImageUrl(imageUrl: String) {
        _formState.value = _formState.value.copy(imageUrl = imageUrl)
    }

    fun updateBadge(badge: String) {
        _formState.value = _formState.value.copy(badge = badge, badgeError = null)
    }

    fun updateAvailability(isAvailable: Boolean) {
        _formState.value = _formState.value.copy(isAvailable = isAvailable)
    }

    /**
     * Validate the form fields.
     * Returns true if valid, false otherwise.
     */
    private fun validateForm(): Boolean {
        val state = _formState.value
        var isValid = true

        // Name validation: 1-100 chars
        val nameError = when {
            state.name.isBlank() -> {
                isValid = false
                "Name is required"
            }
            state.name.length > 100 -> {
                isValid = false
                "Name must be 100 characters or less"
            }
            else -> null
        }

        // Price validation: 0.01-999999.99
        val priceValue = state.price.toDoubleOrNull()
        val priceError = when {
            state.price.isBlank() -> {
                isValid = false
                "Price is required"
            }
            priceValue == null -> {
                isValid = false
                "Invalid price format"
            }
            priceValue < 0.01 -> {
                isValid = false
                "Price must be at least 0.01"
            }
            priceValue > 999999.99 -> {
                isValid = false
                "Price must be at most 999,999.99"
            }
            else -> null
        }

        // Badge validation: must be selected
        val badgeError = when {
            state.badge.isBlank() -> {
                isValid = false
                "Please select Veg or Non-Veg"
            }
            else -> null
        }

        _formState.value = state.copy(
            nameError = nameError,
            priceError = priceError,
            badgeError = badgeError
        )

        return isValid
    }

    /**
     * Save the food item (create or update).
     * @param itemId null for create, non-null for update
     */
    fun saveFoodItem(itemId: String?) {
        if (!validateForm()) return

        val state = _formState.value
        _formState.value = state.copy(isSaving = true, error = null)

        viewModelScope.launch {
            val priceValue = state.price.toDouble()
            val description = state.description.ifBlank { null }
            val imageUrl = state.imageUrl.ifBlank { null }

            val result = if (itemId == null) {
                // Create
                val request = CreateFoodItemRequest(
                    categoryId = currentCategoryId,
                    name = state.name.trim(),
                    description = description,
                    price = priceValue,
                    imageUrl = imageUrl,
                    badge = state.badge,
                    isAvailable = state.isAvailable
                )
                menuRepository.createFoodItem(request)
            } else {
                // Update
                val request = UpdateFoodItemRequest(
                    categoryId = currentCategoryId,
                    name = state.name.trim(),
                    description = description,
                    price = priceValue,
                    imageUrl = imageUrl,
                    badge = state.badge,
                    isAvailable = state.isAvailable
                )
                menuRepository.updateFoodItem(itemId, request)
            }

            result.fold(
                onSuccess = {
                    _formState.value = _formState.value.copy(isSaving = false, saveSuccess = true)
                },
                onFailure = { throwable ->
                    val errorMessage = when (throwable) {
                        is ApiException -> throwable.message
                        is java.net.UnknownHostException,
                        is java.net.ConnectException ->
                            "Network error. Please check your connection and try again."
                        else -> "An unexpected error occurred. Please try again."
                    }
                    _formState.value = _formState.value.copy(isSaving = false, error = errorMessage)
                }
            )
        }
    }

    /**
     * Reset form success state after navigation.
     */
    fun resetSaveSuccess() {
        _formState.value = _formState.value.copy(saveSuccess = false)
    }
}
