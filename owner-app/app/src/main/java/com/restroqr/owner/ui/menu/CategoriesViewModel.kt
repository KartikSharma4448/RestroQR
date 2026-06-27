package com.restroqr.owner.ui.menu

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.restroqr.owner.data.models.CategoryData
import com.restroqr.owner.data.models.CreateCategoryRequest
import com.restroqr.owner.data.models.ReorderCategoriesRequest
import com.restroqr.owner.data.models.UpdateCategoryRequest
import com.restroqr.owner.data.repository.ApiException
import com.restroqr.owner.data.repository.MenuRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * UI state for the Categories screen.
 */
data class CategoriesUiState(
    val isLoading: Boolean = true,
    val categories: List<CategoryData> = emptyList(),
    val error: String? = null,
    val isOperationInProgress: Boolean = false,
    val operationError: String? = null
)

/**
 * ViewModel managing categories CRUD and reorder operations.
 * Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.6
 */
@HiltViewModel
class CategoriesViewModel @Inject constructor(
    private val menuRepository: MenuRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(CategoriesUiState())
    val uiState: StateFlow<CategoriesUiState> = _uiState.asStateFlow()

    init {
        loadCategories()
    }

    /**
     * Load all categories from the server.
     */
    fun loadCategories() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }
            menuRepository.getCategories()
                .onSuccess { categories ->
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            categories = categories.sortedBy { cat -> cat.displayOrder },
                            error = null
                        )
                    }
                }
                .onFailure { exception ->
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            error = exception.message ?: "Failed to load categories"
                        )
                    }
                }
        }
    }

    /**
     * Create a new category with the given name.
     * Name must be 1-50 characters.
     */
    fun createCategory(name: String, onSuccess: () -> Unit = {}) {
        val trimmedName = name.trim()
        if (trimmedName.isEmpty() || trimmedName.length > 50) {
            _uiState.update {
                it.copy(operationError = "Category name must be 1-50 characters")
            }
            return
        }

        viewModelScope.launch {
            _uiState.update { it.copy(isOperationInProgress = true, operationError = null) }
            menuRepository.createCategory(CreateCategoryRequest(name = trimmedName))
                .onSuccess {
                    _uiState.update { it.copy(isOperationInProgress = false) }
                    onSuccess()
                    loadCategories()
                }
                .onFailure { exception ->
                    val errorMsg = when {
                        exception is ApiException && exception.code == "CONFLICT" ->
                            "A category with this name already exists"
                        else -> exception.message ?: "Failed to create category"
                    }
                    _uiState.update {
                        it.copy(isOperationInProgress = false, operationError = errorMsg)
                    }
                }
        }
    }

    /**
     * Update an existing category's name.
     * Name must be 1-50 characters.
     */
    fun updateCategory(id: String, name: String, onSuccess: () -> Unit = {}) {
        val trimmedName = name.trim()
        if (trimmedName.isEmpty() || trimmedName.length > 50) {
            _uiState.update {
                it.copy(operationError = "Category name must be 1-50 characters")
            }
            return
        }

        viewModelScope.launch {
            _uiState.update { it.copy(isOperationInProgress = true, operationError = null) }
            menuRepository.updateCategory(id, UpdateCategoryRequest(name = trimmedName))
                .onSuccess {
                    _uiState.update { it.copy(isOperationInProgress = false) }
                    onSuccess()
                    loadCategories()
                }
                .onFailure { exception ->
                    val errorMsg = when {
                        exception is ApiException && exception.code == "CONFLICT" ->
                            "A category with this name already exists"
                        else -> exception.message ?: "Failed to update category"
                    }
                    _uiState.update {
                        it.copy(isOperationInProgress = false, operationError = errorMsg)
                    }
                }
        }
    }

    /**
     * Delete a category by ID. This cascades to all food items in the category.
     */
    fun deleteCategory(id: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(isOperationInProgress = true, operationError = null) }
            menuRepository.deleteCategory(id)
                .onSuccess {
                    _uiState.update { it.copy(isOperationInProgress = false) }
                    loadCategories()
                }
                .onFailure { exception ->
                    _uiState.update {
                        it.copy(
                            isOperationInProgress = false,
                            operationError = exception.message ?: "Failed to delete category"
                        )
                    }
                }
        }
    }

    /**
     * Move a category up in the display order (decrease display_order).
     */
    fun moveCategoryUp(index: Int) {
        if (index <= 0) return
        reorderBySwap(index, index - 1)
    }

    /**
     * Move a category down in the display order (increase display_order).
     */
    fun moveCategoryDown(index: Int) {
        val categories = _uiState.value.categories
        if (index >= categories.size - 1) return
        reorderBySwap(index, index + 1)
    }

    private fun reorderBySwap(fromIndex: Int, toIndex: Int) {
        val categories = _uiState.value.categories.toMutableList()
        val item = categories.removeAt(fromIndex)
        categories.add(toIndex, item)

        // Optimistic update
        _uiState.update { it.copy(categories = categories) }

        val orderedIds = categories.map { it.id }
        viewModelScope.launch {
            _uiState.update { it.copy(isOperationInProgress = true, operationError = null) }
            menuRepository.reorderCategories(ReorderCategoriesRequest(categoryIds = orderedIds))
                .onSuccess { updatedCategories ->
                    _uiState.update {
                        it.copy(
                            isOperationInProgress = false,
                            categories = updatedCategories.sortedBy { cat -> cat.displayOrder }
                        )
                    }
                }
                .onFailure { exception ->
                    // Revert optimistic update on failure
                    _uiState.update {
                        it.copy(
                            isOperationInProgress = false,
                            operationError = exception.message ?: "Failed to reorder categories"
                        )
                    }
                    loadCategories()
                }
        }
    }

    /**
     * Clear operation error message.
     */
    fun clearOperationError() {
        _uiState.update { it.copy(operationError = null) }
    }
}
