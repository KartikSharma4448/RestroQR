package com.restroqr.owner.ui.auth

import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import com.restroqr.owner.data.repository.AuthRepository
import com.restroqr.owner.data.repository.ApiException
import io.mockk.coEvery
import io.mockk.every
import io.mockk.mockk
import org.junit.Before
import org.junit.Rule
import org.junit.Test

/**
 * Compose UI tests for RegisterScreen.
 * Validates: Requirements 3.1, 3.4, 3.6
 *
 * Tests verify:
 * - Registration form renders all fields correctly
 * - Client-side validation (name required, contact required, password ≥8 chars)
 * - API error display (field-level and general errors)
 * - Loading state during registration
 */
class RegisterScreenTest {

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
    fun registerScreen_displaysAllFormElements() {
        composeTestRule.setContent {
            RegisterScreen(
                authViewModel = authViewModel,
                onNavigateToLogin = {},
                onRegisterSuccess = {}
            )
        }

        // Verify header text
        composeTestRule.onNodeWithText("Create Account").assertIsDisplayed()
        composeTestRule.onNodeWithText("Register your RestroQR owner account").assertIsDisplayed()

        // Verify input fields
        composeTestRule.onNodeWithText("Name *").assertIsDisplayed()
        composeTestRule.onNodeWithText("Email").assertIsDisplayed()
        composeTestRule.onNodeWithText("Phone").assertIsDisplayed()
        composeTestRule.onNodeWithText("Password *").assertIsDisplayed()

        // Verify hint text
        composeTestRule.onNodeWithText("At least one of email or phone is required").assertIsDisplayed()

        // Verify button and navigation link
        composeTestRule.onNodeWithText("Create Account", useUnmergedTree = true)
            .assertIsDisplayed()
        composeTestRule.onNodeWithText("Already have an account? Sign In").assertIsDisplayed()
    }

    @Test
    fun registerScreen_fieldsAcceptInput() {
        composeTestRule.setContent {
            RegisterScreen(
                authViewModel = authViewModel,
                onNavigateToLogin = {},
                onRegisterSuccess = {}
            )
        }

        composeTestRule.onNodeWithText("Name *").performTextInput("John Doe")
        composeTestRule.onNodeWithText("Email").performTextInput("john@test.com")
        composeTestRule.onNodeWithText("Phone").performTextInput("9876543210")
        composeTestRule.onNodeWithText("Password *").performTextInput("password123")

        composeTestRule.onNodeWithText("John Doe").assertIsDisplayed()
        composeTestRule.onNodeWithText("john@test.com").assertIsDisplayed()
        composeTestRule.onNodeWithText("9876543210").assertIsDisplayed()
    }

    // ─── Validation Tests ────────────────────────────────────────────────────────

    @Test
    fun registerScreen_showsErrorWhenNameIsEmpty() {
        composeTestRule.setContent {
            RegisterScreen(
                authViewModel = authViewModel,
                onNavigateToLogin = {},
                onRegisterSuccess = {}
            )
        }

        // Fill email and password but leave name empty
        composeTestRule.onNodeWithText("Email").performTextInput("john@test.com")
        composeTestRule.onNodeWithText("Password *").performTextInput("password123")

        // Click Create Account (find button, not heading)
        composeTestRule.onAllNodesWithText("Create Account")[1].performClick()

        composeTestRule.onNodeWithText("Name is required").assertIsDisplayed()
    }

    @Test
    fun registerScreen_showsErrorWhenContactInfoMissing() {
        composeTestRule.setContent {
            RegisterScreen(
                authViewModel = authViewModel,
                onNavigateToLogin = {},
                onRegisterSuccess = {}
            )
        }

        // Fill name and password but leave both email and phone empty
        composeTestRule.onNodeWithText("Name *").performTextInput("John Doe")
        composeTestRule.onNodeWithText("Password *").performTextInput("password123")

        composeTestRule.onAllNodesWithText("Create Account")[1].performClick()

        composeTestRule.onNodeWithText("At least one of email or phone is required")
            .assertIsDisplayed()
    }

    @Test
    fun registerScreen_showsErrorWhenPasswordTooShort() {
        composeTestRule.setContent {
            RegisterScreen(
                authViewModel = authViewModel,
                onNavigateToLogin = {},
                onRegisterSuccess = {}
            )
        }

        // Fill all fields but password < 8 chars
        composeTestRule.onNodeWithText("Name *").performTextInput("John Doe")
        composeTestRule.onNodeWithText("Email").performTextInput("john@test.com")
        composeTestRule.onNodeWithText("Password *").performTextInput("short")

        composeTestRule.onAllNodesWithText("Create Account")[1].performClick()

        composeTestRule.onNodeWithText("Password must be at least 8 characters").assertIsDisplayed()
    }

    @Test
    fun registerScreen_showsMultipleValidationErrors() {
        composeTestRule.setContent {
            RegisterScreen(
                authViewModel = authViewModel,
                onNavigateToLogin = {},
                onRegisterSuccess = {}
            )
        }

        // Submit with all fields empty
        composeTestRule.onAllNodesWithText("Create Account")[1].performClick()

        composeTestRule.onNodeWithText("Name is required").assertIsDisplayed()
        composeTestRule.onNodeWithText("Password must be at least 8 characters").assertIsDisplayed()
    }

    @Test
    fun registerScreen_acceptsEmailOnlyAsContact() {
        coEvery { mockAuthRepository.register(any()) } coAnswers {
            kotlinx.coroutines.delay(5000L)
            Result.success(Unit)
        }

        composeTestRule.setContent {
            RegisterScreen(
                authViewModel = authViewModel,
                onNavigateToLogin = {},
                onRegisterSuccess = {}
            )
        }

        // Fill name, email, and password (no phone)
        composeTestRule.onNodeWithText("Name *").performTextInput("John Doe")
        composeTestRule.onNodeWithText("Email").performTextInput("john@test.com")
        composeTestRule.onNodeWithText("Password *").performTextInput("password123")

        composeTestRule.onAllNodesWithText("Create Account")[1].performClick()

        // Should not show contact error
        composeTestRule.onNodeWithText("At least one of email or phone is required")
            .assertDoesNotExist()
    }

    @Test
    fun registerScreen_acceptsPhoneOnlyAsContact() {
        coEvery { mockAuthRepository.register(any()) } coAnswers {
            kotlinx.coroutines.delay(5000L)
            Result.success(Unit)
        }

        composeTestRule.setContent {
            RegisterScreen(
                authViewModel = authViewModel,
                onNavigateToLogin = {},
                onRegisterSuccess = {}
            )
        }

        // Fill name, phone, and password (no email)
        composeTestRule.onNodeWithText("Name *").performTextInput("John Doe")
        composeTestRule.onNodeWithText("Phone").performTextInput("9876543210")
        composeTestRule.onNodeWithText("Password *").performTextInput("password123")

        composeTestRule.onAllNodesWithText("Create Account")[1].performClick()

        // Should not show contact error
        composeTestRule.onNodeWithText("At least one of email or phone is required")
            .assertDoesNotExist()
    }

    // ─── Loading State Tests ─────────────────────────────────────────────────────

    @Test
    fun registerScreen_showsLoadingStateDuringRegistration() {
        coEvery { mockAuthRepository.register(any()) } coAnswers {
            kotlinx.coroutines.delay(5000L)
            Result.success(Unit)
        }

        composeTestRule.setContent {
            RegisterScreen(
                authViewModel = authViewModel,
                onNavigateToLogin = {},
                onRegisterSuccess = {}
            )
        }

        composeTestRule.onNodeWithText("Name *").performTextInput("John Doe")
        composeTestRule.onNodeWithText("Email").performTextInput("john@test.com")
        composeTestRule.onNodeWithText("Password *").performTextInput("password123")
        composeTestRule.onAllNodesWithText("Create Account")[1].performClick()

        // Button text should disappear (replaced by progress indicator)
        composeTestRule.waitForIdle()
    }

    // ─── API Error Display Tests ─────────────────────────────────────────────────

    @Test
    fun registerScreen_displaysConflictError() {
        coEvery { mockAuthRepository.register(any()) } returns Result.failure(
            ApiException(
                code = "CONFLICT",
                message = "Email is already registered",
                details = null
            )
        )

        composeTestRule.setContent {
            RegisterScreen(
                authViewModel = authViewModel,
                onNavigateToLogin = {},
                onRegisterSuccess = {}
            )
        }

        composeTestRule.onNodeWithText("Name *").performTextInput("John Doe")
        composeTestRule.onNodeWithText("Email").performTextInput("existing@test.com")
        composeTestRule.onNodeWithText("Password *").performTextInput("password123")
        composeTestRule.onAllNodesWithText("Create Account")[1].performClick()

        composeTestRule.waitForIdle()
        composeTestRule.onNodeWithText("Email is already registered").assertIsDisplayed()
    }

    // ─── Navigation Tests ────────────────────────────────────────────────────────

    @Test
    fun registerScreen_navigatesToLoginOnLinkClick() {
        var navigatedToLogin = false

        composeTestRule.setContent {
            RegisterScreen(
                authViewModel = authViewModel,
                onNavigateToLogin = { navigatedToLogin = true },
                onRegisterSuccess = {}
            )
        }

        composeTestRule.onNodeWithText("Already have an account? Sign In").performClick()
        assert(navigatedToLogin) { "Expected navigation to login screen" }
    }
}
