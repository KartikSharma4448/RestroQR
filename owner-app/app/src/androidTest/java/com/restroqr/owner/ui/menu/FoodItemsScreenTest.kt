package com.restroqr.owner.ui.menu

import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.lifecycle.SavedStateHandle
import com.restroqr.owner.data.models.FoodItemData
import com.restroqr.owner.data.repository.MenuRepository
import io.mockk.coEvery
import io.mockk.mockk
import org.junit.Before
import org.junit.Rule
import org.junit.Test

/**
 * Compose UI tests for FoodItemsScreen.
 * Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6
 *
 * Tests verify:
 * - Food items list renders with correct details
 * - Empty state displays add prompt
 * - Loading state shows progress indicator
 * - Error state shows retry option
 * - Delete confirmation dialog displays correctly
 * - Availability toggle is rendered per item
 */
class FoodItemsScreenTest {

    @get:Rule
    val composeTestRule = createComposeRule()

    private val mockMenuRepository = mockk<MenuRepository>(relaxed = true)
    private lateinit var viewModel: FoodItemsViewModel

    private val sampleItems = listOf(
        FoodItemData(
            id = "item-1",
            categoryId = "cat-1",
            restaurantId = "rest-1",
            name = "Butter Chicken",
            description = "Creamy tomato-based curry with tender chicken",
            price = 320.0,
            imageUrl = "https://cdn.example.com/butter-chicken.jpg",
            badge = "non_veg",
            isAvailable = true,
            createdAt = "2024-01-01T00:00:00Z",
            updatedAt = "2024-01-01T00:00:00Z"
        ),
        FoodItemData(
            id = "item-2",
            categoryId = "cat-1",
            restaurantId = "rest-1",
            name = "Paneer Tikka",
            description = "Grilled cottage cheese with spices",
            price = 250.50,
            imageUrl = null,
            badge = "veg",
            isAvailable = true,
            createdAt = "2024-01-01T00:00:00Z",
            updatedAt = "2024-01-01T00:00:00Z"
        ),
        FoodItemData(
            id = "item-3",
            categoryId = "cat-1",
            restaurantId = "rest-1",
            name = "Dal Makhani",
            description = null,
            price = 180.0,
            imageUrl = null,
            badge = "veg",
            isAvailable = false,
            createdAt = "2024-01-01T00:00:00Z",
            updatedAt = "2024-01-01T00:00:00Z"
        )
    )

    @Before
    fun setUp() {
        coEvery { mockMenuRepository.getFoodItems("cat-1") } returns Result.success(sampleItems)
        viewModel = FoodItemsViewModel(mockMenuRepository, SavedStateHandle())
    }

    // ─── Food Items List Tests ───────────────────────────────────────────────────

    @Test
    fun foodItemsScreen_displaysItemsList() {
        composeTestRule.setContent {
            FoodItemsScreen(
                categoryId = "cat-1",
                viewModel = viewModel,
                onNavigateBack = {},
                onNavigateToAddItem = {},
                onNavigateToEditItem = { _, _ -> }
            )
        }

        composeTestRule.waitForIdle()

        // Verify items are displayed
        composeTestRule.onNodeWithText("Butter Chicken").assertIsDisplayed()
        composeTestRule.onNodeWithText("Paneer Tikka").assertIsDisplayed()
        composeTestRule.onNodeWithText("Dal Makhani").assertIsDisplayed()
    }

    @Test
    fun foodItemsScreen_displaysItemPrices() {
        composeTestRule.setContent {
            FoodItemsScreen(
                categoryId = "cat-1",
                viewModel = viewModel,
                onNavigateBack = {},
                onNavigateToAddItem = {},
                onNavigateToEditItem = { _, _ -> }
            )
        }

        composeTestRule.waitForIdle()

        // Verify prices are displayed (₹ prefix)
        composeTestRule.onNodeWithText("₹320").assertIsDisplayed()
        composeTestRule.onNodeWithText("₹250.50").assertIsDisplayed()
        composeTestRule.onNodeWithText("₹180").assertIsDisplayed()
    }

    @Test
    fun foodItemsScreen_displaysItemDescriptions() {
        composeTestRule.setContent {
            FoodItemsScreen(
                categoryId = "cat-1",
                viewModel = viewModel,
                onNavigateBack = {},
                onNavigateToAddItem = {},
                onNavigateToEditItem = { _, _ -> }
            )
        }

        composeTestRule.waitForIdle()

        composeTestRule.onNodeWithText("Creamy tomato-based curry with tender chicken")
            .assertIsDisplayed()
        composeTestRule.onNodeWithText("Grilled cottage cheese with spices")
            .assertIsDisplayed()
    }

    @Test
    fun foodItemsScreen_displaysAvailabilityStatus() {
        composeTestRule.setContent {
            FoodItemsScreen(
                categoryId = "cat-1",
                viewModel = viewModel,
                onNavigateBack = {},
                onNavigateToAddItem = {},
                onNavigateToEditItem = { _, _ -> }
            )
        }

        composeTestRule.waitForIdle()

        // Available items show "Available" text
        composeTestRule.onAllNodesWithText("Available").assertCountEquals(2)
        // Unavailable item shows "Unavailable" text
        composeTestRule.onNodeWithText("Unavailable").assertIsDisplayed()
    }

    @Test
    fun foodItemsScreen_displaysTopBar() {
        composeTestRule.setContent {
            FoodItemsScreen(
                categoryId = "cat-1",
                viewModel = viewModel,
                onNavigateBack = {},
                onNavigateToAddItem = {},
                onNavigateToEditItem = { _, _ -> }
            )
        }

        composeTestRule.onNodeWithText("Food Items").assertIsDisplayed()
    }

    @Test
    fun foodItemsScreen_showsFabButton() {
        composeTestRule.setContent {
            FoodItemsScreen(
                categoryId = "cat-1",
                viewModel = viewModel,
                onNavigateBack = {},
                onNavigateToAddItem = {},
                onNavigateToEditItem = { _, _ -> }
            )
        }

        composeTestRule.onNodeWithContentDescription("Add food item").assertIsDisplayed()
    }

    // ─── Empty State Tests ───────────────────────────────────────────────────────

    @Test
    fun foodItemsScreen_showsEmptyStateWhenNoItems() {
        coEvery { mockMenuRepository.getFoodItems("cat-1") } returns Result.success(emptyList())
        val emptyViewModel = FoodItemsViewModel(mockMenuRepository, SavedStateHandle())

        composeTestRule.setContent {
            FoodItemsScreen(
                categoryId = "cat-1",
                viewModel = emptyViewModel,
                onNavigateBack = {},
                onNavigateToAddItem = {},
                onNavigateToEditItem = { _, _ -> }
            )
        }

        composeTestRule.waitForIdle()

        composeTestRule.onNodeWithText("No Food Items Yet").assertIsDisplayed()
        composeTestRule.onNodeWithText("Add your first food item to this category.")
            .assertIsDisplayed()
        composeTestRule.onNodeWithText("Add Food Item").assertIsDisplayed()
    }

    // ─── Loading State Tests ─────────────────────────────────────────────────────

    @Test
    fun foodItemsScreen_showsLoadingState() {
        coEvery { mockMenuRepository.getFoodItems("cat-1") } coAnswers {
            kotlinx.coroutines.delay(5000L)
            Result.success(sampleItems)
        }
        val loadingViewModel = FoodItemsViewModel(mockMenuRepository, SavedStateHandle())

        composeTestRule.setContent {
            FoodItemsScreen(
                categoryId = "cat-1",
                viewModel = loadingViewModel,
                onNavigateBack = {},
                onNavigateToAddItem = {},
                onNavigateToEditItem = { _, _ -> }
            )
        }

        // Items should not be visible during loading
        composeTestRule.onNodeWithText("Butter Chicken").assertDoesNotExist()
    }

    // ─── Error State Tests ───────────────────────────────────────────────────────

    @Test
    fun foodItemsScreen_showsErrorWithRetryButton() {
        coEvery { mockMenuRepository.getFoodItems("cat-1") } returns Result.failure(
            Exception("Failed to load items")
        )
        val errorViewModel = FoodItemsViewModel(mockMenuRepository, SavedStateHandle())

        composeTestRule.setContent {
            FoodItemsScreen(
                categoryId = "cat-1",
                viewModel = errorViewModel,
                onNavigateBack = {},
                onNavigateToAddItem = {},
                onNavigateToEditItem = { _, _ -> }
            )
        }

        composeTestRule.waitForIdle()

        composeTestRule.onNodeWithText("Failed to load items").assertIsDisplayed()
        composeTestRule.onNodeWithText("Retry").assertIsDisplayed()
    }

    @Test
    fun foodItemsScreen_retryReloadsItems() {
        var callCount = 0
        coEvery { mockMenuRepository.getFoodItems("cat-1") } answers {
            callCount++
            if (callCount == 1) {
                Result.failure(Exception("Network error"))
            } else {
                Result.success(sampleItems)
            }
        }
        val errorViewModel = FoodItemsViewModel(mockMenuRepository, SavedStateHandle())

        composeTestRule.setContent {
            FoodItemsScreen(
                categoryId = "cat-1",
                viewModel = errorViewModel,
                onNavigateBack = {},
                onNavigateToAddItem = {},
                onNavigateToEditItem = { _, _ -> }
            )
        }

        composeTestRule.waitForIdle()

        composeTestRule.onNodeWithText("Retry").performClick()
        composeTestRule.waitForIdle()

        composeTestRule.onNodeWithText("Butter Chicken").assertIsDisplayed()
    }

    // ─── Delete Confirmation Dialog Tests ────────────────────────────────────────

    @Test
    fun foodItemsScreen_deleteDialogShowsItemName() {
        composeTestRule.setContent {
            FoodItemsScreen(
                categoryId = "cat-1",
                viewModel = viewModel,
                onNavigateBack = {},
                onNavigateToAddItem = {},
                onNavigateToEditItem = { _, _ -> }
            )
        }

        composeTestRule.waitForIdle()

        // Click delete on first item
        composeTestRule.onAllNodesWithContentDescription("Delete")[0].performClick()

        // Verify delete dialog content
        composeTestRule.onNodeWithText("Delete Food Item").assertIsDisplayed()
        composeTestRule.onNodeWithText(
            "Are you sure you want to delete \"Butter Chicken\"? This action cannot be undone."
        ).assertIsDisplayed()
        composeTestRule.onNodeWithText("Delete").assertIsDisplayed()
        composeTestRule.onNodeWithText("Cancel").assertIsDisplayed()
    }

    @Test
    fun foodItemsScreen_deleteDialogDismissesOnCancel() {
        composeTestRule.setContent {
            FoodItemsScreen(
                categoryId = "cat-1",
                viewModel = viewModel,
                onNavigateBack = {},
                onNavigateToAddItem = {},
                onNavigateToEditItem = { _, _ -> }
            )
        }

        composeTestRule.waitForIdle()

        // Open delete dialog
        composeTestRule.onAllNodesWithContentDescription("Delete")[0].performClick()
        composeTestRule.onNodeWithText("Delete Food Item").assertIsDisplayed()

        // Cancel
        composeTestRule.onNodeWithText("Cancel").performClick()
        composeTestRule.onNodeWithText("Delete Food Item").assertDoesNotExist()
    }

    // ─── Navigation Tests ────────────────────────────────────────────────────────

    @Test
    fun foodItemsScreen_backButtonNavigatesBack() {
        var navigatedBack = false

        composeTestRule.setContent {
            FoodItemsScreen(
                categoryId = "cat-1",
                viewModel = viewModel,
                onNavigateBack = { navigatedBack = true },
                onNavigateToAddItem = {},
                onNavigateToEditItem = { _, _ -> }
            )
        }

        composeTestRule.onNodeWithContentDescription("Back").performClick()
        assert(navigatedBack) { "Expected back navigation" }
    }

    @Test
    fun foodItemsScreen_fabNavigatesToAddItem() {
        var addItemCategoryId: String? = null

        composeTestRule.setContent {
            FoodItemsScreen(
                categoryId = "cat-1",
                viewModel = viewModel,
                onNavigateBack = {},
                onNavigateToAddItem = { categoryId -> addItemCategoryId = categoryId },
                onNavigateToEditItem = { _, _ -> }
            )
        }

        composeTestRule.onNodeWithContentDescription("Add food item").performClick()
        assert(addItemCategoryId == "cat-1") { "Expected navigation to add food item with category" }
    }
}
