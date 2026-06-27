package com.restroqr.owner.ui.qr

import android.content.ContentValues
import android.content.Context
import android.graphics.Bitmap
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.widget.Toast
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Download
import androidx.compose.material.icons.filled.ErrorOutline
import androidx.compose.material.icons.filled.QrCode
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * QR Code screen displaying the restaurant's QR code image with download functionality.
 * Fetches the QR code PNG from the API and displays it.
 * Provides a download button to save the QR code to the device's Downloads folder.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun QrCodeScreen(
    viewModel: QrCodeViewModel = hiltViewModel(),
    onNavigateBack: () -> Unit
) {
    val uiState by viewModel.uiState.collectAsState()
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    var isDownloading by remember { mutableStateOf(false) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("QR Code") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Back"
                        )
                    }
                }
            )
        }
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            when (val state = uiState) {
                is QrCodeUiState.Loading -> {
                    LoadingContent(
                        modifier = Modifier.align(Alignment.Center)
                    )
                }

                is QrCodeUiState.Success -> {
                    QrCodeContent(
                        bitmap = state.bitmap,
                        isDownloading = isDownloading,
                        onDownloadClick = {
                            coroutineScope.launch {
                                isDownloading = true
                                val success = saveQrCodeToDownloads(context, state.imageBytes)
                                isDownloading = false
                                val message = if (success) {
                                    "QR code saved to Downloads"
                                } else {
                                    "Failed to save QR code"
                                }
                                Toast.makeText(context, message, Toast.LENGTH_SHORT).show()
                            }
                        }
                    )
                }

                is QrCodeUiState.Error -> {
                    ErrorContent(
                        message = state.message,
                        onRetryClick = { viewModel.loadQrCode() },
                        modifier = Modifier.align(Alignment.Center)
                    )
                }
            }
        }
    }
}

/**
 * Loading state with a progress indicator.
 */
@Composable
private fun LoadingContent(modifier: Modifier = Modifier) {
    Column(
        modifier = modifier.padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        CircularProgressIndicator()

        Spacer(modifier = Modifier.height(16.dp))

        Text(
            text = "Loading QR code...",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

/**
 * Success state showing the QR code image and download button.
 */
@Composable
private fun QrCodeContent(
    bitmap: Bitmap,
    isDownloading: Boolean,
    onDownloadClick: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Icon(
            imageVector = Icons.Default.QrCode,
            contentDescription = null,
            modifier = Modifier.size(32.dp),
            tint = MaterialTheme.colorScheme.primary
        )

        Spacer(modifier = Modifier.height(8.dp))

        Text(
            text = "Your Restaurant QR Code",
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Bold,
            textAlign = TextAlign.Center
        )

        Spacer(modifier = Modifier.height(8.dp))

        Text(
            text = "Customers can scan this code to view your menu",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center
        )

        Spacer(modifier = Modifier.height(32.dp))

        // QR Code image
        Card(
            modifier = Modifier.size(280.dp),
            shape = RoundedCornerShape(16.dp),
            elevation = CardDefaults.cardElevation(defaultElevation = 4.dp)
        ) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(16.dp),
                contentAlignment = Alignment.Center
            ) {
                Image(
                    bitmap = bitmap.asImageBitmap(),
                    contentDescription = "Restaurant QR Code",
                    modifier = Modifier.fillMaxSize()
                )
            }
        }

        Spacer(modifier = Modifier.height(32.dp))

        // Download button
        Button(
            onClick = onDownloadClick,
            enabled = !isDownloading,
            modifier = Modifier
                .fillMaxWidth()
                .height(50.dp),
            shape = RoundedCornerShape(12.dp)
        ) {
            if (isDownloading) {
                CircularProgressIndicator(
                    modifier = Modifier.size(20.dp),
                    color = MaterialTheme.colorScheme.onPrimary,
                    strokeWidth = 2.dp
                )
                Spacer(modifier = Modifier.width(12.dp))
                Text("Saving...")
            } else {
                Icon(
                    imageVector = Icons.Default.Download,
                    contentDescription = null,
                    modifier = Modifier.size(20.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text("Download QR Code")
            }
        }
    }
}

/**
 * Error state with message and retry button.
 */
@Composable
private fun ErrorContent(
    message: String,
    onRetryClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier.padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Icon(
            imageVector = Icons.Default.ErrorOutline,
            contentDescription = null,
            modifier = Modifier.size(64.dp),
            tint = MaterialTheme.colorScheme.error
        )

        Spacer(modifier = Modifier.height(16.dp))

        Text(
            text = "QR Code Unavailable",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.SemiBold,
            textAlign = TextAlign.Center
        )

        Spacer(modifier = Modifier.height(8.dp))

        Text(
            text = message,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center
        )

        Spacer(modifier = Modifier.height(24.dp))

        Button(onClick = onRetryClick) {
            Text("Retry")
        }
    }
}

/**
 * Save QR code image bytes to the device's Downloads folder using MediaStore.
 * Returns true on success, false on failure.
 */
private suspend fun saveQrCodeToDownloads(context: Context, imageBytes: ByteArray): Boolean {
    return withContext(Dispatchers.IO) {
        try {
            val filename = "restroqr_qrcode_${System.currentTimeMillis()}.png"
            val contentValues = ContentValues().apply {
                put(MediaStore.Images.Media.DISPLAY_NAME, filename)
                put(MediaStore.Images.Media.MIME_TYPE, "image/png")
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    put(
                        MediaStore.Images.Media.RELATIVE_PATH,
                        Environment.DIRECTORY_DOWNLOADS
                    )
                    put(MediaStore.Images.Media.IS_PENDING, 1)
                }
            }

            val resolver = context.contentResolver
            val uri = resolver.insert(
                MediaStore.Downloads.EXTERNAL_CONTENT_URI,
                contentValues
            ) ?: return@withContext false

            resolver.openOutputStream(uri)?.use { outputStream ->
                outputStream.write(imageBytes)
                outputStream.flush()
            } ?: return@withContext false

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                contentValues.clear()
                contentValues.put(MediaStore.Images.Media.IS_PENDING, 0)
                resolver.update(uri, contentValues, null, null)
            }

            true
        } catch (e: Exception) {
            false
        }
    }
}
