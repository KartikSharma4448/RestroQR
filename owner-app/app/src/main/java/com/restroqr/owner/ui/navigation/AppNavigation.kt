package com.restroqr.owner.ui.navigation

import androidx.compose.runtime.Composable
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.restroqr.owner.ui.auth.AuthViewModel
import com.restroqr.owner.ui.auth.LoginScreen
import com.restroqr.owner.ui.auth.RegisterScreen
import com.restroqr.owner.ui.dashboard.DashboardScreen
import com.restroqr.owner.ui.menu.FoodItemFormScreen
import com.restroqr.owner.ui.menu.FoodItemsScreen
import com.restroqr.owner.ui.profile.ProfileSetupScreen
import com.restroqr.owner.ui.qr.QrCodeScreen

/**
 * Route constants for the app navigation graph.
 */
object AppRoutes {
    const val LOGIN = "login"
    const val REGISTER = "register"
    const val DASHBOARD = "dashboard"
    const val PROFILE_SETUP = "profile_setup"
    const val QR_CODE = "qr_code"
    const val FOOD_ITEMS = "food_items/{categoryId}"
    const val FOOD_ITEM_FORM = "food_item_form/{categoryId}?itemId={itemId}"

    fun foodItems(categoryId: String) = "food_items/$categoryId"
    fun foodItemForm(categoryId: String, itemId: String? = null): String {
        return if (itemId != null) {
            "food_item_form/$categoryId?itemId=$itemId"
        } else {
            "food_item_form/$categoryId"
        }
    }
}

/**
 * Main navigation composable for the app.
 * Determines start destination based on login state (token presence).
 * After login/register success, navigates to dashboard and pops auth screens from backstack.
 */
@Composable
fun AppNavigation(
    navController: NavHostController = rememberNavController()
) {
    val authViewModel: AuthViewModel = hiltViewModel()

    val startDestination = if (authViewModel.isLoggedIn()) {
        AppRoutes.DASHBOARD
    } else {
        AppRoutes.LOGIN
    }

    NavHost(
        navController = navController,
        startDestination = startDestination
    ) {
        composable(AppRoutes.LOGIN) {
            LoginScreen(
                authViewModel = authViewModel,
                onNavigateToRegister = {
                    navController.navigate(AppRoutes.REGISTER)
                },
                onLoginSuccess = {
                    navController.navigate(AppRoutes.DASHBOARD) {
                        popUpTo(AppRoutes.LOGIN) { inclusive = true }
                    }
                }
            )
        }

        composable(AppRoutes.REGISTER) {
            RegisterScreen(
                authViewModel = authViewModel,
                onNavigateToLogin = {
                    navController.popBackStack()
                },
                onRegisterSuccess = {
                    navController.navigate(AppRoutes.DASHBOARD) {
                        popUpTo(AppRoutes.LOGIN) { inclusive = true }
                    }
                }
            )
        }

        composable(AppRoutes.DASHBOARD) {
            DashboardScreen(
                onNavigateToProfileSetup = {
                    navController.navigate(AppRoutes.PROFILE_SETUP)
                },
                onNavigateToMenu = {
                    // TODO: Navigate to categories screen (future task)
                },
                onNavigateToQr = {
                    navController.navigate(AppRoutes.QR_CODE)
                }
            )
        }

        composable(AppRoutes.PROFILE_SETUP) {
            ProfileSetupScreen(
                onNavigateBack = {
                    navController.popBackStack()
                },
                onProfileSaved = {
                    // Pop back to dashboard which will reload restaurant data
                    navController.popBackStack()
                }
            )
        }

        composable(AppRoutes.QR_CODE) {
            QrCodeScreen(
                onNavigateBack = {
                    navController.popBackStack()
                }
            )
        }

        composable(
            route = AppRoutes.FOOD_ITEMS,
            arguments = listOf(
                navArgument("categoryId") { type = NavType.StringType }
            )
        ) { backStackEntry ->
            val categoryId = backStackEntry.arguments?.getString("categoryId") ?: return@composable
            FoodItemsScreen(
                categoryId = categoryId,
                onNavigateBack = {
                    navController.popBackStack()
                },
                onNavigateToAddItem = { catId ->
                    navController.navigate(AppRoutes.foodItemForm(catId))
                },
                onNavigateToEditItem = { itemId, catId ->
                    navController.navigate(AppRoutes.foodItemForm(catId, itemId))
                }
            )
        }

        composable(
            route = AppRoutes.FOOD_ITEM_FORM,
            arguments = listOf(
                navArgument("categoryId") { type = NavType.StringType },
                navArgument("itemId") {
                    type = NavType.StringType
                    nullable = true
                    defaultValue = null
                }
            )
        ) { backStackEntry ->
            val categoryId = backStackEntry.arguments?.getString("categoryId") ?: return@composable
            val itemId = backStackEntry.arguments?.getString("itemId")
            FoodItemFormScreen(
                itemId = itemId,
                categoryId = categoryId,
                onNavigateBack = {
                    navController.popBackStack()
                }
            )
        }
    }
}
