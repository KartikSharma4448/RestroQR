package com.restroqr.owner.ui.menu

import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import com.restroqr.owner.data.models.CategoryData
import com.restroqr.owner.data.repository.MenuRepository
import io.mockk.coEvery
import io.mockk.mockk
import org.junit.Before
import org.junit.Rule
import org.junit.Test

/**
 * Compose UI tests for CategoriesScreen.
 * Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.6
 *
 * Tests verify:
 * - Category list renders correctly
 * - Empty state displays add prompt
 * - Loading state shows progress indicator
 * - Error state shows retry option
 * - Add category dialog renders and validates
 * - Delete confirmation dialog displays
 */
class CategoriesScreenTest {

    @get:Rule
    val composeTestRule = createComposeRule()

    private val mockMenuRepository = mockk<MenuRepository>(relaxed = true)
    private lateinit var viewModel: CategoriesViewModel

    private val sampleCategories = listOf(
        CategoryData(
            id = "cat-1",
            restaurantId = "rest-1",
            name = "Appetizers",
            displayOrder = 0,
            createdAt = "2024-01-01T00:00:00Z",
            updatedAt = "2024-01-01T00:00:00Z"
        ),
        CategoryData(
            id = "cat-2",
            restaurantId = "rest-1",
            name = "Main Course",
            displayOrder = 1,
            createdAt = "2024-01-01T00:00:00Z",
            updatedAt = "2024-01-01T00:00:00Z"
        ),
        CategoryData(
            id = "cat-3",
            restaurantId = "rest-1",
            name = "Desserts",
            displayOrder = 2,
            createdAt = "2024-01-01T00:00:00Z",
            updatedAt = "2024-01-01T00:00:00Z"
        )
    )

    @Before
    fun setUp() {
        coEvery { mockMenuRepository.getCategories() } returns Result.success(sampleCategories)
        viewModel = CategoriesViewModel(mockMenuRepository)
    }

    // ─── Category List Tests ─────────────────────────────────────────────────────

    @Test
    fun categoriesScreen_displaysCategoryList() {
        composeTestRule.setContent {
            CategoriesScreen(
                viewModel = viewModel,
                onNavigateBack = {}
            )
        }

        composeTestRule.waitForIdle()

        // Verify categories are displayed
        composeTestRule.onNodeWithText("Appetizers").assertIsDisplayed()
        composeTestRule.onNodeWithText("Main Course").assertIsDisplayed()
        composeTestRule.onNodeWithText("Desserts").assertIsDisplayed()

        // Verify position indicators
        composeTestRule.onNodeWithText("Position 1").assertIsDisplayed()
        composeTestRule.onNodeWithText("Position 2").assertIsDisplayed()
        composeTestRule.onNodeWithText("Position 3").assertIsDisplayed()
    }

    @Test
    fun categoriesScreen_displaysTopBar() {
        composeTestRule.setContent {
            CategoriesScreen(
                viewModel = viewModel,
                onNavigateBack = {}
            )
        }

        composeTestRule.onNodeWithText("Categories").assertIsDisplayed()
    }

    @Test
    fun categoriesScreen_showsFabButton() {
        composeTestRule.setContent {
            CategoriesScreen(
                viewModel = viewModel,
                onNavigateBack = {}
            )
        }

        composeTestRule.waitForIdle()

        composeTestRule.onNodeWithContentDescription("Add category").assertIsDisplayed()
    }

    // ─── Empty State Tests ───────────────────────────────────────────────────────

    @Test
    fun categoriesScreen_showsEmptyStateWhenNoCategories() {
        coEvery { mockMenuRepository.getCategories() } returns Result.success(emptyList())
        val emptyViewModel = CategoriesViewModel(mockMenuRepository)

        composeTestRule.setContent {
            CategoriesScreen(
                viewModel = emptyViewModel,
                onNavigateBack = {}
            )
        }

        composeTestRule.waitForIdle()

        composeTestRule.onNodeWithText("No Categories Yet").assertIsDisplayed()
        composeTestRule.onNodeWithText("Create your first menu category to start adding food items.")
            .assertIsDisplayed()
        composeTestRule.onNodeWithText("Add Category").assertIsDisplayed()
    }

    // ─── Loading State Tests ─────────────────────────────────────────────────────

    @Test
    fun categoriesScreen_showsLoadingIndicator() {
        coEvery { mockMenuRepository.getCategories() } coAnswers {
            kotlinx.coroutines.delay(5000L)
            Result.success(sampleCategories)
        }
        val loadingViewModel = CategoriesViewModel(mockMenuRepository)

        composeTestRule.setContent {
            CategoriesScreen(
                viewModel = loadingViewModel,
                onNavigateBack = {}
            )
        }

        // During loading, categories should not be visible
        composeTestRule.onNodeWithText("Appetizers").assertDoesNotExist()
    }

    // ─── Error State Tests ───────────────────────────────────────────────────────

    @Test
    fun categoriesScreen_showsErrorWithRetryButton() {
        coEvery { mockMenuRepository.getCategories() } returns Result.failure(
            Exception("Network error. Please check your connection and try again.")
        )
        val errorViewModel = CategoriesViewModel(mockMenuRepository)

        composeTestRule.setContent {
            CategoriesScreen(
                viewModel = errorViewModel,
                onNavigateBack = {}
            )
        }

        composeTestRule.waitForIdle()

        composeTestRule.onNodeWithText("Network error. Please check your connection and try again.")
            .assertIsDisplayed()
        composeTestRule.onNodeWithText("Retry").assertIsDisplayed()
    }

    @Test
    fun categoriesScreen_retryButtonReloadsCategories() {
        var callCount = 0
        coEvery { mockMenuRepository.getCategories() } answers {
            callCount++
            if (callCount == 1) {
                Result.failure(Exception("Network error"))
            } else {
                Result.success(sampleCategories)
            }
        }
        val errorViewModel = CategoriesViewModel(mockMenuRepository)

        composeTestRule.setContent {
            CategoriesScreen(
                viewModel = errorViewModel,
                onNavigateBack = {}
            )
        }

        composeTestRule.waitForIdle()

        // Click retry
        composeTestRule.onNodeWithText("Retry").performClick()
        composeTestRule.waitForIdle()

        // Categories should now be displayed
        composeTestRule.onNodeWithText("Appetizers").assertIsDisplayed()
    }

    // ─── Add Category Dialog Tests ───────────────────────────────────────────────

    @Test
    fun categoriesScreen_addDialogOpensOnFabClick() {
        composeTestRule.setContent {
            CategoriesScreen(
                viewModel = viewModel,
                onNavigateBack = {}
            )
        }

        composeTestRule.waitForIdle()

        composeTestRule.onNodeWithContentDescription("Add category").performClick()

        // Dialog should appear
        composeTestRule.onNodeWithText("Add Category").assertIsDisplayed()
        composeTestRule.onNodeWithText("Category Name").assertIsDisplayed()
        composeTestRule.onNodeWithText("Save").assertIsDisplayed()
        composeTestRule.onNodeWithText("Cancel").assertIsDisplayed()
    }

    @Test
    fun categoriesScreen_addDialogShowsCharacterCount() {
        composeTestRule.setContent {
            CategoriesScreen(
                viewModel = viewModel,
                onNavigateBack = {}
            )
        }

        composeTestRule.waitForIdle()
        composeTestRule.onNodeWithContentDescription("Add category").performClick()

        composeTestRule.onNodeWithText("0/50 characters").assertIsDisplayed()

        composeTestRule.onNodeWithText("Category Name").performTextInput("Starters")
        composeTestRule.onNodeWithText("8/50 characters").assertIsDisplayed()
    }

    @Test
    fun categoriesScreen_addDialogValidatesEmptyName() {
        composeTestRule.setContent {
            CategoriesScreen(
                viewModel = viewModel,
                onNavigateBack = {}
            )
        }

        composeTestRule.waitForIdle()
        composeTestRule.onNodeWithContentDescription("Add category").performClick()

        // Click save without entering a name
        composeTestRule.onNodeWithText("Save").performClick()

        composeTestRule.onNodeWithText("Name is required").assertIsDisplayed()
    }

    @Test
    fun categoriesScreen_addDialogDismissesOnCancel() {
        composeTestRule.setContent {
            CategoriesScreen(
                viewModel = viewModel,
                onNavigateBack = {}
            )
        }

        composeTestRule.waitForIdle()
        composeTestRule.onNodeWithContentDescription("Add category").performClick()
        composeTestRule.onNodeWithText("Add Category").assertIsDisplayed()

        composeTestRule.onNodeWithText("Cancel").performClick()

        // Dialog should be dismissed (Category Name field no longer visible)
        composeTestRule.onNodeWithText("Category Name").assertDoesNotExist()
    }

    // ─── Delete Confirmation Dialog Tests ────────────────────────────────────────

    @Test
    fun categoriesScreen_deleteDialogShowsCascadeWarning() {
        composeTestRule.setContent {
            CategoriesScreen(
                viewModel = viewModel,
                onNavigateBack = {}
            )
        }

        composeTestRule.waitForIdle()

        // Click delete on first category
        composeTestRule.onAllNodesWithContentDescription("Delete category")[0].performClick()

        // Verify delete confirmation dialog
        composeTestRule.onNodeWithText("Delete Category").assertIsDisplayed()
        composeTestRule.onNodeWithText("Are you sure you want to delete \"Appetizers\"?")
            .assertIsDisplayed()
        composeTestRule.onNodeWithText(
            "⚠️ All food items in this category will also be permanently deleted. This action cannot be undone.",
            substring = true
        ).assertIsDisplayed()
        composeTestRule.onNodeWithText("Delete").assertIsDisplayed()
        composeTestRule.onNodeWithText("Cancel").assertIsDisplayed()
    }

    // ─── Navigation Tests ────────────────────────────────────────────────────────

    @Test
    fun categoriesScreen_backButtonNavigatesBack() {
        var navigatedBack = false

        composeTestRule.setContent {
            CategoriesScreen(
                viewModel = viewModel,
                onNavigateBack = { navigatedBack = true }
            )
        }

        composeTestRule.onNodeWithContentDescription("Back").performClick()
        assert(navigatedBack) { "Expected back navigation" }
    }
}
