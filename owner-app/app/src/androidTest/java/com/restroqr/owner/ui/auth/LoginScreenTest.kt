package com.restroqr.owner.ui.auth

import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import com.restroqr.owner.data.repository.ApiException
import com.restroqr.owner.data.repository.AuthRepository
import io.mockk.coEvery
import io.mockk.every
import io.mockk.mockk
import org.junit.Before
import org.junit.Rule
import org.junit.Test

/**
 * Compose UI tests for LoginScreen.
 * Validates: Requirements 3.1, 3.2, 3.3, 3.5
 *
 * Tests verify:
 * - Login form fields render correctly
 * - Client-side validation displays error messages
 * - Loading state shows progress indicator
 * - API error state displays error message
 */
class LoginScreenTest {

    @get:Rule
    val composeTestRule = createComposeRule()

    private lateinit var authViewModel: AuthViewModel

    private val mockAuthRepository = mockk<AuthRepository>(relaxed = true)

    @Before
    fun setUp() {
        every { mockAuthRepository.isLoggedIn() } returns false
        authViewModel = AuthViewModel(mockAuthRepository)
    }

    // ─── Rendering Tests ─────────────────────────────────────────────────────────

    @Test
    fun loginScreen_displaysAllFormElements() {
        composeTestRule.setContent {
            LoginScreen(
                authViewModel = authViewModel,
                onNavigateToRegister = {},
                onLoginSuccess = {}
            )
        }

        // Verify header text
        composeTestRule.onNodeWithText("Welcome Back").assertIsDisplayed()
        composeTestRule.onNodeWithText("Sign in to your RestroQR account").assertIsDisplayed()

        // Verify input fields
        composeTestRule.onNodeWithText("Email or Phone").assertIsDisplayed()
        composeTestRule.onNodeWithText("Password").assertIsDisplayed()

        // Verify button and navigation link
        composeTestRule.onNodeWithText("Sign In").assertIsDisplayed()
        composeTestRule.onNodeWithText("Don't have an account? Register").assertIsDisplayed()
    }

    @Test
    fun loginScreen_emailFieldAcceptsInput() {
        composeTestRule.setContent {
            LoginScreen(
                authViewModel = authViewModel,
                onNavigateToRegister = {},
                onLoginSuccess = {}
            )
        }

        composeTestRule.onNodeWithText("Email or Phone").performTextInput("owner@test.com")
        composeTestRule.onNodeWithText("owner@test.com").assertIsDisplayed()
    }

    @Test
    fun loginScreen_passwordFieldAcceptsInput() {
        composeTestRule.setContent {
            LoginScreen(
                authViewModel = authViewModel,
                onNavigateToRegister = {},
                onLoginSuccess = {}
            )
        }

        composeTestRule.onNodeWithText("Password").performTextInput("mypassword")
        // Password field uses visual transformation, so we check node exists
        composeTestRule.onNodeWithText("Password").assertIsDisplayed()
    }

    // ─── Validation Tests ────────────────────────────────────────────────────────

    @Test
    fun loginScreen_showsErrorWhenIdentifierIsEmpty() {
        composeTestRule.setContent {
            LoginScreen(
                authViewModel = authViewModel,
                onNavigateToRegister = {},
                onLoginSuccess = {}
            )
        }

        // Enter password but leave identifier empty
        composeTestRule.onNodeWithText("Password").performTextInput("password123")
        composeTestRule.onNodeWithText("Sign In").performClick()

        // Verify validation error displayed
        composeTestRule.onNodeWithText("Email or phone is required").assertIsDisplayed()
    }

    @Test
    fun loginScreen_showsErrorWhenPasswordIsEmpty() {
        composeTestRule.setContent {
            LoginScreen(
                authViewModel = authViewModel,
                onNavigateToRegister = {},
                onLoginSuccess = {}
            )
        }

        // Enter identifier but leave password empty
        composeTestRule.onNodeWithText("Email or Phone").performTextInput("owner@test.com")
        composeTestRule.onNodeWithText("Sign In").performClick()

        // Verify validation error displayed
        composeTestRule.onNodeWithText("Password is required").assertIsDisplayed()
    }

    @Test
    fun loginScreen_showsBothErrorsWhenAllFieldsEmpty() {
        composeTestRule.setContent {
            LoginScreen(
                authViewModel = authViewModel,
                onNavigateToRegister = {},
                onLoginSuccess = {}
            )
        }

        composeTestRule.onNodeWithText("Sign In").performClick()

        composeTestRule.onNodeWithText("Email or phone is required").assertIsDisplayed()
        composeTestRule.onNodeWithText("Password is required").assertIsDisplayed()
    }

    @Test
    fun loginScreen_clearsIdentifierErrorOnInput() {
        composeTestRule.setContent {
            LoginScreen(
                authViewModel = authViewModel,
                onNavigateToRegister = {},
                onLoginSuccess = {}
            )
        }

        // Trigger validation error
        composeTestRule.onNodeWithText("Sign In").performClick()
        composeTestRule.onNodeWithText("Email or phone is required").assertIsDisplayed()

        // Type into field to clear error
        composeTestRule.onNodeWithText("Email or Phone").performTextInput("a")
        composeTestRule.onNodeWithText("Email or phone is required").assertDoesNotExist()
    }

    // ─── Loading State Tests ─────────────────────────────────────────────────────

    @Test
    fun loginScreen_showsLoadingIndicatorDuringLogin() {
        // Simulate a login that stays in loading state
        coEvery { mockAuthRepository.login(any()) } coAnswers {
            kotlinx.coroutines.delay(5000L)
            Result.success(Unit)
        }

        composeTestRule.setContent {
            LoginScreen(
                authViewModel = authViewModel,
                onNavigateToRegister = {},
                onLoginSuccess = {}
            )
        }

        composeTestRule.onNodeWithText("Email or Phone").performTextInput("owner@test.com")
        composeTestRule.onNodeWithText("Password").performTextInput("password123")
        composeTestRule.onNodeWithText("Sign In").performClick()

        // Button text should disappear during loading
        composeTestRule.onNodeWithText("Sign In").assertDoesNotExist()
    }

    // ─── Error Display Tests ─────────────────────────────────────────────────────

    @Test
    fun loginScreen_displaysApiErrorMessage() {
        coEvery { mockAuthRepository.login(any()) } returns Result.failure(
            ApiException(
                code = "AUTHENTICATION_FAILED",
                message = "Invalid credentials. Please try again.",
                details = null
            )
        )

        composeTestRule.setContent {
            LoginScreen(
                authViewModel = authViewModel,
                onNavigateToRegister = {},
                onLoginSuccess = {}
            )
        }

        composeTestRule.onNodeWithText("Email or Phone").performTextInput("owner@test.com")
        composeTestRule.onNodeWithText("Password").performTextInput("wrongpassword")
        composeTestRule.onNodeWithText("Sign In").performClick()

        composeTestRule.waitForIdle()
        composeTestRule.onNodeWithText("Invalid credentials. Please try again.").assertIsDisplayed()
    }

    @Test
    fun loginScreen_displaysDisabledAccountError() {
        coEvery { mockAuthRepository.login(any()) } returns Result.failure(
            ApiException(
                code = "ACCOUNT_DISABLED",
                message = "Your account has been disabled. Please contact support.",
                details = null
            )
        )

        composeTestRule.setContent {
            LoginScreen(
                authViewModel = authViewModel,
                onNavigateToRegister = {},
                onLoginSuccess = {}
            )
        }

        composeTestRule.onNodeWithText("Email or Phone").performTextInput("disabled@test.com")
        composeTestRule.onNodeWithText("Password").performTextInput("password123")
        composeTestRule.onNodeWithText("Sign In").performClick()

        composeTestRule.waitForIdle()
        composeTestRule.onNodeWithText("Your account has been disabled. Please contact support.")
            .assertIsDisplayed()
    }

    // ─── Navigation Tests ────────────────────────────────────────────────────────

    @Test
    fun loginScreen_navigatesToRegisterOnLinkClick() {
        var navigatedToRegister = false

        composeTestRule.setContent {
            LoginScreen(
                authViewModel = authViewModel,
                onNavigateToRegister = { navigatedToRegister = true },
                onLoginSuccess = {}
            )
        }

        composeTestRule.onNodeWithText("Don't have an account? Register").performClick()
        assert(navigatedToRegister) { "Expected navigation to register screen" }
    }
}
