package com.restroqr.owner.ui.qr

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.restroqr.owner.data.repository.ApiException
import com.restroqr.owner.data.repository.MenuRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * UI state for the QR code screen.
 */
sealed class QrCodeUiState {
    data object Loading : QrCodeUiState()
    data class Success(val bitmap: Bitmap, val imageBytes: ByteArray) : QrCodeUiState()
    data class Error(val message: String) : QrCodeUiState()
}

/**
 * ViewModel for the QR code screen.
 * Fetches QR code image bytes from MenuRepository and decodes into a Bitmap.
 * Manages loading/error/success states and provides image bytes for download.
 */
@HiltViewModel
class QrCodeViewModel @Inject constructor(
    private val menuRepository: MenuRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow<QrCodeUiState>(QrCodeUiState.Loading)
    val uiState: StateFlow<QrCodeUiState> = _uiState.asStateFlow()

    init {
        loadQrCode()
    }

    /**
     * Fetch the QR code image from the API and decode it into a Bitmap.
     */
    fun loadQrCode() {
        viewModelScope.launch {
            _uiState.value = QrCodeUiState.Loading

            val result = menuRepository.getQrCode()
            _uiState.value = result.fold(
                onSuccess = { responseBody ->
                    val bytes = responseBody.bytes()
                    val bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
                    if (bitmap != null) {
                        QrCodeUiState.Success(bitmap = bitmap, imageBytes = bytes)
                    } else {
                        QrCodeUiState.Error("Failed to decode QR code image. Please try again.")
                    }
                },
                onFailure = { throwable ->
                    when (throwable) {
                        is ApiException -> {
                            when (throwable.code) {
                                "NOT_FOUND" -> QrCodeUiState.Error(
                                    "Restaurant profile not complete. Please set up your profile first."
                                )
                                else -> QrCodeUiState.Error(throwable.message)
                            }
                        }
                        is java.net.UnknownHostException,
                        is java.net.ConnectException -> {
                            QrCodeUiState.Error("Network error. Please check your connection and try again.")
                        }
                        else -> {
                            QrCodeUiState.Error("Failed to generate QR code. Please try again.")
                        }
                    }
                }
            )
        }
    }
}
