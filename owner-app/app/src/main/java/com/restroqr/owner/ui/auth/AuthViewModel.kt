package com.restroqr.owner.ui.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.restroqr.owner.data.models.LoginRequest
import com.restroqr.owner.data.models.RegisterRequest
import com.restroqr.owner.data.repository.ApiException
import com.restroqr.owner.data.repository.AuthRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * Represents the state of an authentication operation (login or register).
 */
sealed class AuthUiState {
    data object Idle : AuthUiState()
    data object Loading : AuthUiState()
    data object Success : AuthUiState()
    data class Error(val message: String, val fieldErrors: Map<String, String> = emptyMap()) : AuthUiState()
}

@HiltViewModel
class AuthViewModel @Inject constructor(
    private val authRepository: AuthRepository
) : ViewModel() {

    private val _loginState = MutableStateFlow<AuthUiState>(AuthUiState.Idle)
    val loginState: StateFlow<AuthUiState> = _loginState.asStateFlow()

    private val _registerState = MutableStateFlow<AuthUiState>(AuthUiState.Idle)
    val registerState: StateFlow<AuthUiState> = _registerState.asStateFlow()

    /**
     * Check if user is already logged in (has stored token).
     */
    fun isLoggedIn(): Boolean = authRepository.isLoggedIn()

    /**
     * Login with email/phone identifier and password.
     * Determines whether the identifier is an email or phone number
     * and constructs the appropriate request.
     */
    fun login(identifier: String, password: String) {
        viewModelScope.launch {
            _loginState.value = AuthUiState.Loading

            val isEmail = identifier.contains("@")
            val request = if (isEmail) {
                LoginRequest(email = identifier.trim(), password = password)
            } else {
                LoginRequest(phone = identifier.trim(), password = password)
            }

            val result = authRepository.login(request)
            _loginState.value = result.fold(
                onSuccess = { AuthUiState.Success },
                onFailure = { throwable -> mapErrorToState(throwable) }
            )
        }
    }

    /**
     * Register a new owner account.
     */
    fun register(email: String?, phone: String?, password: String, name: String) {
        viewModelScope.launch {
            _registerState.value = AuthUiState.Loading

            val request = RegisterRequest(
                name = name.trim(),
                email = email?.trim()?.ifBlank { null },
                phone = phone?.trim()?.ifBlank { null },
                password = password
            )

            val result = authRepository.register(request)
            _registerState.value = result.fold(
                onSuccess = { AuthUiState.Success },
                onFailure = { throwable -> mapErrorToState(throwable) }
            )
        }
    }

    /**
     * Reset login state to idle (e.g., after navigation or dismissing error).
     */
    fun resetLoginState() {
        _loginState.value = AuthUiState.Idle
    }

    /**
     * Reset register state to idle.
     */
    fun resetRegisterState() {
        _registerState.value = AuthUiState.Idle
    }

    /**
     * Map API exceptions to user-facing error states.
     */
    private fun mapErrorToState(throwable: Throwable): AuthUiState.Error {
        return when (throwable) {
            is ApiException -> {
                val fieldErrors = throwable.details
                    ?.associate { it.field to it.message }
                    ?: emptyMap()

                val message = when (throwable.code) {
                    "ACCOUNT_DISABLED" -> "Your account has been disabled. Please contact support."
                    "AUTHENTICATION_FAILED" -> "Invalid credentials. Please try again."
                    "CONFLICT" -> throwable.message
                    "VALIDATION_ERROR" -> throwable.message
                    else -> throwable.message
                }

                AuthUiState.Error(message = message, fieldErrors = fieldErrors)
            }
            is java.net.UnknownHostException,
            is java.net.ConnectException -> {
                AuthUiState.Error(message = "Network error. Please check your connection and try again.")
            }
            else -> {
                AuthUiState.Error(message = "An unexpected error occurred. Please try again.")
            }
        }
    }
}
