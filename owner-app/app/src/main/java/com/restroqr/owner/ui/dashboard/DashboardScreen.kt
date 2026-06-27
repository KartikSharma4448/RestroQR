package com.restroqr.owner.ui.dashboard

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.QrCode
import androidx.compose.material.icons.filled.Restaurant
import androidx.compose.material.icons.filled.RestaurantMenu
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import coil.compose.AsyncImage
import com.restroqr.owner.data.models.RestaurantData

/**
 * Dashboard screen displaying the restaurant overview with navigation options.
 * Shows restaurant info (name, logo, address, phone, QR preview) when a profile exists.
 * Shows a setup prompt when no profile is configured.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DashboardScreen(
    viewModel: DashboardViewModel = hiltViewModel(),
    onNavigateToProfileSetup: () -> Unit,
    onNavigateToMenu: () -> Unit,
    onNavigateToQr: () -> Unit
) {
    val uiState by viewModel.uiState.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Dashboard") }
            )
        }
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            when (val state = uiState) {
                is DashboardUiState.Loading -> {
                    CircularProgressIndicator(
                        modifier = Modifier.align(Alignment.Center)
                    )
                }

                is DashboardUiState.NoProfile -> {
                    NoProfileContent(
                        onSetupClick = onNavigateToProfileSetup,
                        modifier = Modifier.align(Alignment.Center)
                    )
                }

                is DashboardUiState.Success -> {
                    RestaurantDashboardContent(
                        restaurant = state.restaurant,
                        onNavigateToProfileSetup = onNavigateToProfileSetup,
                        onNavigateToMenu = onNavigateToMenu,
                        onNavigateToQr = onNavigateToQr
                    )
                }

                is DashboardUiState.Error -> {
                    ErrorContent(
                        message = state.message,
                        onRetryClick = { viewModel.loadRestaurant() },
                        modifier = Modifier.align(Alignment.Center)
                    )
                }
            }
        }
    }
}

/**
 * Content shown when the owner has not set up their restaurant profile yet.
 */
@Composable
private fun NoProfileContent(
    onSetupClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier.padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Icon(
            imageVector = Icons.Default.Restaurant,
            contentDescription = null,
            modifier = Modifier.size(72.dp),
            tint = MaterialTheme.colorScheme.primary
        )

        Spacer(modifier = Modifier.height(16.dp))

        Text(
            text = "Set Up Your Restaurant",
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.Bold,
            textAlign = TextAlign.Center
        )

        Spacer(modifier = Modifier.height(8.dp))

        Text(
            text = "Get started by creating your restaurant profile. Add your restaurant name, address, and contact information.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center
        )

        Spacer(modifier = Modifier.height(24.dp))

        Button(
            onClick = onSetupClick,
            modifier = Modifier
                .fillMaxWidth()
                .height(50.dp)
        ) {
            Text("Set Up Profile")
        }
    }
}

/**
 * Main dashboard content showing restaurant info and navigation cards.
 */
@Composable
private fun RestaurantDashboardContent(
    restaurant: RestaurantData,
    onNavigateToProfileSetup: () -> Unit,
    onNavigateToMenu: () -> Unit,
    onNavigateToQr: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp)
    ) {
        // Restaurant header card
        RestaurantHeaderCard(
            restaurant = restaurant,
            onEditClick = onNavigateToProfileSetup
        )

        Spacer(modifier = Modifier.height(24.dp))

        // QR Code preview card
        QrCodePreviewCard(
            restaurantToken = restaurant.restaurantToken,
            onViewQrClick = onNavigateToQr
        )

        Spacer(modifier = Modifier.height(16.dp))

        // Navigation cards
        Text(
            text = "Manage",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.padding(bottom = 12.dp)
        )

        NavigationCard(
            title = "Menu",
            description = "Manage categories and food items",
            icon = Icons.Default.RestaurantMenu,
            onClick = onNavigateToMenu
        )

        Spacer(modifier = Modifier.height(12.dp))

        NavigationCard(
            title = "Profile",
            description = "Edit restaurant details and images",
            icon = Icons.Default.Person,
            onClick = onNavigateToProfileSetup
        )

        Spacer(modifier = Modifier.height(12.dp))

        NavigationCard(
            title = "QR Code",
            description = "View and download your restaurant QR code",
            icon = Icons.Default.QrCode,
            onClick = onNavigateToQr
        )
    }
}

/**
 * Card displaying restaurant name, logo, address, and phone.
 */
@Composable
private fun RestaurantHeaderCard(
    restaurant: RestaurantData,
    onEditClick: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.primaryContainer
        )
    ) {
        Column(
            modifier = Modifier.padding(16.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Restaurant logo
                if (restaurant.logoUrl != null) {
                    AsyncImage(
                        model = restaurant.logoUrl,
                        contentDescription = "Restaurant logo",
                        modifier = Modifier
                            .size(64.dp)
                            .clip(CircleShape),
                        contentScale = ContentScale.Crop
                    )
                } else {
                    Surface(
                        modifier = Modifier.size(64.dp),
                        shape = CircleShape,
                        color = MaterialTheme.colorScheme.primary
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Icon(
                                imageVector = Icons.Default.Restaurant,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.onPrimary,
                                modifier = Modifier.size(32.dp)
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.width(16.dp))

                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = restaurant.name,
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onPrimaryContainer
                    )
                    if (restaurant.address.isNotBlank()) {
                        Text(
                            text = restaurant.address,
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.7f)
                        )
                    }
                    if (restaurant.phone.isNotBlank()) {
                        Text(
                            text = restaurant.phone,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.7f)
                        )
                    }
                }

                IconButton(onClick = onEditClick) {
                    Icon(
                        imageVector = Icons.Default.Edit,
                        contentDescription = "Edit profile",
                        tint = MaterialTheme.colorScheme.onPrimaryContainer
                    )
                }
            }
        }
    }
}

/**
 * Card showing a QR code preview with a link to the full QR screen.
 */
@Composable
private fun QrCodePreviewCard(
    restaurantToken: String,
    onViewQrClick: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = Icons.Default.QrCode,
                contentDescription = null,
                modifier = Modifier.size(48.dp),
                tint = MaterialTheme.colorScheme.primary
            )

            Spacer(modifier = Modifier.width(16.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = "Your QR Code",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold
                )
                Text(
                    text = "restroqr.com/r/$restaurantToken",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            TextButton(onClick = onViewQrClick) {
                Text("View")
            }
        }
    }
}

/**
 * A navigation card with icon, title, description, and click action.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun NavigationCard(
    title: String,
    description: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    onClick: () -> Unit
) {
    Card(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                modifier = Modifier.size(40.dp),
                tint = MaterialTheme.colorScheme.primary
            )

            Spacer(modifier = Modifier.width(16.dp))

            Column {
                Text(
                    text = title,
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Medium
                )
                Text(
                    text = description,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

/**
 * Error state with retry option.
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
        Text(
            text = message,
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.error,
            textAlign = TextAlign.Center
        )

        Spacer(modifier = Modifier.height(16.dp))

        Button(onClick = onRetryClick) {
            Text("Retry")
        }
    }
}
