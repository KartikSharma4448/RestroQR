package com.restroqr.owner.ui.dashboard

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.restroqr.owner.data.models.RestaurantData
import com.restroqr.owner.data.repository.ApiException
import com.restroqr.owner.data.repository.RestaurantRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * UI state for the dashboard screen.
 */
sealed class DashboardUiState {
    data object Loading : DashboardUiState()
    data class Success(val restaurant: RestaurantData) : DashboardUiState()
    data object NoProfile : DashboardUiState()
    data class Error(val message: String) : DashboardUiState()
}

@HiltViewModel
class DashboardViewModel @Inject constructor(
    private val restaurantRepository: RestaurantRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow<DashboardUiState>(DashboardUiState.Loading)
    val uiState: StateFlow<DashboardUiState> = _uiState.asStateFlow()

    init {
        loadRestaurant()
    }

    /**
     * Fetch the owner's restaurant profile from the API.
     * If no profile exists (NOT_FOUND), show the setup prompt.
     */
    fun loadRestaurant() {
        viewModelScope.launch {
            _uiState.value = DashboardUiState.Loading

            val result = restaurantRepository.getRestaurant()
            _uiState.value = result.fold(
                onSuccess = { restaurant ->
                    DashboardUiState.Success(restaurant)
                },
                onFailure = { throwable ->
                    when (throwable) {
                        is ApiException -> {
                            if (throwable.code == "NOT_FOUND") {
                                DashboardUiState.NoProfile
                            } else {
                                DashboardUiState.Error(throwable.message)
                            }
                        }
                        is java.net.UnknownHostException,
                        is java.net.ConnectException -> {
                            DashboardUiState.Error("Network error. Please check your connection and try again.")
                        }
                        else -> {
                            DashboardUiState.Error("An unexpected error occurred. Please try again.")
                        }
                    }
                }
            )
        }
    }
}
