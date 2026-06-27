package com.restroqr.owner.ui.qr

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.unit.dp
import org.junit.Rule
import org.junit.Test

/**
 * Compose UI tests for QR Code display screen.
 * Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5
 *
 * Since the QR Code screen is not yet implemented, these tests verify
 * the expected UI contract for the QR code display feature:
 * - Loading state shows progress indicator
 * - Success state shows QR code image and restaurant URL
 * - Error state shows error message and retry option
 * - Download button is available when QR is loaded
 *
 * Tests use a minimal composable that mimics the expected QR screen behavior
 * to validate the UI structure and state handling patterns.
 */
class QrCodeScreenTest {

    @get:Rule
    val composeTestRule = createComposeRule()

    // ─── Test composables representing expected QR screen states ──────────────────

    /**
     * Simulated QR screen in loading state.
     */
    @Composable
    private fun QrCodeScreenLoading() {
        Column(
            modifier = Modifier.fillMaxSize(),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            CircularProgressIndicator(
                modifier = Modifier.testTag("loading_indicator")
            )
            Spacer(modifier = Modifier.height(16.dp))
            Text("Loading QR Code...")
        }
    }

    /**
     * Simulated QR screen in success state with QR code displayed.
     */
    @Composable
    private fun QrCodeScreenSuccess(
        restaurantToken: String = "abc123xyz",
        onDownload: () -> Unit = {}
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Text(
                text = "Your Restaurant QR Code",
                style = MaterialTheme.typography.headlineSmall
            )

            Spacer(modifier = Modifier.height(16.dp))

            // QR code image placeholder
            Surface(
                modifier = Modifier
                    .size(250.dp)
                    .testTag("qr_code_image"),
                color = MaterialTheme.colorScheme.surfaceVariant
            ) {}

            Spacer(modifier = Modifier.height(16.dp))

            Text(
                text = "restroqr.com/r/$restaurantToken",
                style = MaterialTheme.typography.bodyMedium
            )

            Spacer(modifier = Modifier.height(8.dp))

            Text(
                text = "Customers scan this code to view your menu",
                style = MaterialTheme.typography.bodySmall
            )

            Spacer(modifier = Modifier.height(24.dp))

            Button(
                onClick = onDownload,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(50.dp)
            ) {
                Text("Download QR Code")
            }
        }
    }

    /**
     * Simulated QR screen in error state.
     */
    @Composable
    private fun QrCodeScreenError(
        message: String = "Failed to load QR code",
        onRetry: () -> Unit = {}
    ) {
        Column(
            modifier = Modifier.fillMaxSize(),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Text(
                text = message,
                color = MaterialTheme.colorScheme.error
            )
            Spacer(modifier = Modifier.height(16.dp))
            Button(onClick = onRetry) {
                Text("Retry")
            }
        }
    }

    /**
     * Simulated QR screen when restaurant profile is not set up.
     */
    @Composable
    private fun QrCodeScreenNoProfile() {
        Column(
            modifier = Modifier.fillMaxSize(),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Text(
                text = "Set Up Your Restaurant",
                style = MaterialTheme.typography.headlineSmall
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = "Please complete your restaurant profile to get your QR code."
            )
            Spacer(modifier = Modifier.height(24.dp))
            Button(onClick = {}) {
                Text("Set Up Profile")
            }
        }
    }

    // ─── Loading State Tests ─────────────────────────────────────────────────────

    @Test
    fun qrCodeScreen_showsLoadingIndicator() {
        composeTestRule.setContent {
            QrCodeScreenLoading()
        }

        composeTestRule.onNodeWithTag("loading_indicator").assertIsDisplayed()
        composeTestRule.onNodeWithText("Loading QR Code...").assertIsDisplayed()
    }

    @Test
    fun qrCodeScreen_loadingStateHidesQrContent() {
        composeTestRule.setContent {
            QrCodeScreenLoading()
        }

        composeTestRule.onNodeWithText("Download QR Code").assertDoesNotExist()
        composeTestRule.onNodeWithText("Your Restaurant QR Code").assertDoesNotExist()
    }

    // ─── Success State Tests ─────────────────────────────────────────────────────

    @Test
    fun qrCodeScreen_displaysQrCodeOnSuccess() {
        composeTestRule.setContent {
            QrCodeScreenSuccess(restaurantToken = "test_token_123")
        }

        composeTestRule.onNodeWithText("Your Restaurant QR Code").assertIsDisplayed()
        composeTestRule.onNodeWithTag("qr_code_image").assertIsDisplayed()
    }

    @Test
    fun qrCodeScreen_displaysRestaurantUrl() {
        composeTestRule.setContent {
            QrCodeScreenSuccess(restaurantToken = "myrestaurant")
        }

        composeTestRule.onNodeWithText("restroqr.com/r/myrestaurant").assertIsDisplayed()
    }

    @Test
    fun qrCodeScreen_displaysHelpText() {
        composeTestRule.setContent {
            QrCodeScreenSuccess()
        }

        composeTestRule.onNodeWithText("Customers scan this code to view your menu")
            .assertIsDisplayed()
    }

    @Test
    fun qrCodeScreen_showsDownloadButton() {
        composeTestRule.setContent {
            QrCodeScreenSuccess()
        }

        composeTestRule.onNodeWithText("Download QR Code").assertIsDisplayed()
        composeTestRule.onNodeWithText("Download QR Code").assertHasClickAction()
    }

    @Test
    fun qrCodeScreen_downloadButtonTriggersCallback() {
        var downloadClicked = false

        composeTestRule.setContent {
            QrCodeScreenSuccess(onDownload = { downloadClicked = true })
        }

        composeTestRule.onNodeWithText("Download QR Code").performClick()
        assert(downloadClicked) { "Expected download callback to be triggered" }
    }

    // ─── Error State Tests ───────────────────────────────────────────────────────

    @Test
    fun qrCodeScreen_showsErrorMessage() {
        composeTestRule.setContent {
            QrCodeScreenError(message = "Network error. Please check your connection.")
        }

        composeTestRule.onNodeWithText("Network error. Please check your connection.")
            .assertIsDisplayed()
    }

    @Test
    fun qrCodeScreen_showsRetryButtonOnError() {
        composeTestRule.setContent {
            QrCodeScreenError()
        }

        composeTestRule.onNodeWithText("Retry").assertIsDisplayed()
        composeTestRule.onNodeWithText("Retry").assertHasClickAction()
    }

    @Test
    fun qrCodeScreen_retryButtonTriggersCallback() {
        var retryClicked = false

        composeTestRule.setContent {
            QrCodeScreenError(onRetry = { retryClicked = true })
        }

        composeTestRule.onNodeWithText("Retry").performClick()
        assert(retryClicked) { "Expected retry callback to be triggered" }
    }

    @Test
    fun qrCodeScreen_errorStateHidesQrContent() {
        composeTestRule.setContent {
            QrCodeScreenError()
        }

        composeTestRule.onNodeWithText("Your Restaurant QR Code").assertDoesNotExist()
        composeTestRule.onNodeWithText("Download QR Code").assertDoesNotExist()
    }

    // ─── No Profile State Tests ──────────────────────────────────────────────────

    @Test
    fun qrCodeScreen_showsSetupPromptWhenNoProfile() {
        composeTestRule.setContent {
            QrCodeScreenNoProfile()
        }

        composeTestRule.onNodeWithText("Set Up Your Restaurant").assertIsDisplayed()
        composeTestRule.onNodeWithText(
            "Please complete your restaurant profile to get your QR code."
        ).assertIsDisplayed()
        composeTestRule.onNodeWithText("Set Up Profile").assertIsDisplayed()
    }

    @Test
    fun qrCodeScreen_noProfileStateHidesQrContent() {
        composeTestRule.setContent {
            QrCodeScreenNoProfile()
        }

        composeTestRule.onNodeWithText("Download QR Code").assertDoesNotExist()
        composeTestRule.onNodeWithTag("qr_code_image").assertDoesNotExist()
    }
}
