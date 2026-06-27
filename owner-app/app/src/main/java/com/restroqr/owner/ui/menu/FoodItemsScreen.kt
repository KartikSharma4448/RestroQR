package com.restroqr.owner.ui.menu

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import coil.compose.AsyncImage
import com.restroqr.owner.data.models.FoodItemData

/**
 * Screen displaying the list of food items in a selected category.
 * Provides add, edit, delete actions and an availability toggle per item.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FoodItemsScreen(
    categoryId: String,
    viewModel: FoodItemsViewModel = hiltViewModel(),
    onNavigateBack: () -> Unit,
    onNavigateToAddItem: (String) -> Unit,
    onNavigateToEditItem: (String, String) -> Unit
) {
    val uiState by viewModel.uiState.collectAsState()
    val itemToDelete by viewModel.showDeleteDialog.collectAsState()

    LaunchedEffect(categoryId) {
        viewModel.loadFoodItems(categoryId)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Food Items") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(
                            imageVector = Icons.Default.ArrowBack,
                            contentDescription = "Back"
                        )
                    }
                }
            )
        },
        floatingActionButton = {
            FloatingActionButton(
                onClick = { onNavigateToAddItem(categoryId) }
            ) {
                Icon(
                    imageVector = Icons.Default.Add,
                    contentDescription = "Add food item"
                )
            }
        }
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            when (val state = uiState) {
                is FoodItemsUiState.Loading -> {
                    CircularProgressIndicator(
                        modifier = Modifier.align(Alignment.Center)
                    )
                }

                is FoodItemsUiState.Success -> {
                    if (state.items.isEmpty()) {
                        EmptyFoodItemsContent(
                            onAddClick = { onNavigateToAddItem(categoryId) },
                            modifier = Modifier.align(Alignment.Center)
                        )
                    } else {
                        FoodItemsList(
                            items = state.items,
                            onEditItem = { item -> onNavigateToEditItem(item.id, categoryId) },
                            onDeleteItem = { item -> viewModel.showDeleteConfirmation(item) },
                            onToggleAvailability = { item -> viewModel.toggleAvailability(item) }
                        )
                    }
                }

                is FoodItemsUiState.Error -> {
                    ErrorContent(
                        message = state.message,
                        onRetryClick = { viewModel.loadFoodItems(categoryId) },
                        modifier = Modifier.align(Alignment.Center)
                    )
                }
            }
        }
    }

    // Delete confirmation dialog
    itemToDelete?.let { item ->
        AlertDialog(
            onDismissRequest = { viewModel.dismissDeleteDialog() },
            title = { Text("Delete Food Item") },
            text = {
                Text("Are you sure you want to delete \"${item.name}\"? This action cannot be undone.")
            },
            confirmButton = {
                TextButton(
                    onClick = { viewModel.deleteFoodItem(item) },
                    colors = ButtonDefaults.textButtonColors(
                        contentColor = MaterialTheme.colorScheme.error
                    )
                ) {
                    Text("Delete")
                }
            },
            dismissButton = {
                TextButton(onClick = { viewModel.dismissDeleteDialog() }) {
                    Text("Cancel")
                }
            }
        )
    }
}

/**
 * Content shown when the category has no food items yet.
 */
@Composable
private fun EmptyFoodItemsContent(
    onAddClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier.padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Icon(
            imageVector = Icons.Default.RestaurantMenu,
            contentDescription = null,
            modifier = Modifier.size(72.dp),
            tint = MaterialTheme.colorScheme.primary
        )

        Spacer(modifier = Modifier.height(16.dp))

        Text(
            text = "No Food Items Yet",
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.Bold,
            textAlign = TextAlign.Center
        )

        Spacer(modifier = Modifier.height(8.dp))

        Text(
            text = "Add your first food item to this category.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center
        )

        Spacer(modifier = Modifier.height(24.dp))

        Button(
            onClick = onAddClick,
            modifier = Modifier
                .fillMaxWidth()
                .height(50.dp)
        ) {
            Icon(Icons.Default.Add, contentDescription = null)
            Spacer(modifier = Modifier.width(8.dp))
            Text("Add Food Item")
        }
    }
}

/**
 * LazyColumn displaying the food items list.
 */
@Composable
private fun FoodItemsList(
    items: List<FoodItemData>,
    onEditItem: (FoodItemData) -> Unit,
    onDeleteItem: (FoodItemData) -> Unit,
    onToggleAvailability: (FoodItemData) -> Unit
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        items(items, key = { it.id }) { item ->
            FoodItemCard(
                item = item,
                onEditClick = { onEditItem(item) },
                onDeleteClick = { onDeleteItem(item) },
                onToggleAvailability = { onToggleAvailability(item) }
            )
        }
    }
}

/**
 * Card displaying a single food item with its details and actions.
 */
@Composable
private fun FoodItemCard(
    item: FoodItemData,
    onEditClick: () -> Unit,
    onDeleteClick: () -> Unit,
    onToggleAvailability: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp)
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.Top
            ) {
                // Item image or placeholder
                if (item.imageUrl != null) {
                    AsyncImage(
                        model = item.imageUrl,
                        contentDescription = item.name,
                        modifier = Modifier
                            .size(72.dp)
                            .clip(RoundedCornerShape(8.dp)),
                        contentScale = ContentScale.Crop
                    )
                } else {
                    Surface(
                        modifier = Modifier.size(72.dp),
                        shape = RoundedCornerShape(8.dp),
                        color = MaterialTheme.colorScheme.surfaceVariant
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Icon(
                                imageVector = Icons.Default.Fastfood,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.size(32.dp)
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.width(12.dp))

                // Item details
                Column(modifier = Modifier.weight(1f)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        // Badge indicator
                        BadgeIndicator(badge = item.badge)
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = item.name,
                            style = MaterialTheme.typography.titleSmall,
                            fontWeight = FontWeight.SemiBold,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                    }

                    if (!item.description.isNullOrBlank()) {
                        Spacer(modifier = Modifier.height(2.dp))
                        Text(
                            text = item.description,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            maxLines = 2,
                            overflow = TextOverflow.Ellipsis
                        )
                    }

                    Spacer(modifier = Modifier.height(4.dp))

                    Text(
                        text = "₹${formatPrice(item.price)}",
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.primary
                    )
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            // Action row
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                // Availability toggle
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = if (item.isAvailable) "Available" else "Unavailable",
                        style = MaterialTheme.typography.bodySmall,
                        color = if (item.isAvailable)
                            MaterialTheme.colorScheme.primary
                        else
                            MaterialTheme.colorScheme.error
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Switch(
                        checked = item.isAvailable,
                        onCheckedChange = { onToggleAvailability() },
                        modifier = Modifier.height(24.dp)
                    )
                }

                // Edit / Delete buttons
                Row {
                    IconButton(onClick = onEditClick) {
                        Icon(
                            imageVector = Icons.Default.Edit,
                            contentDescription = "Edit",
                            tint = MaterialTheme.colorScheme.primary
                        )
                    }
                    IconButton(onClick = onDeleteClick) {
                        Icon(
                            imageVector = Icons.Default.Delete,
                            contentDescription = "Delete",
                            tint = MaterialTheme.colorScheme.error
                        )
                    }
                }
            }
        }
    }
}

/**
 * Small colored circle indicating Veg (green) or Non-Veg (red).
 */
@Composable
private fun BadgeIndicator(badge: String) {
    val color = when (badge) {
        "veg" -> Color(0xFF4CAF50)
        "non_veg" -> Color(0xFFF44336)
        else -> Color.Gray
    }
    Surface(
        modifier = Modifier.size(14.dp),
        shape = RoundedCornerShape(2.dp),
        color = Color.Transparent,
        border = androidx.compose.foundation.BorderStroke(1.5.dp, color)
    ) {
        Box(contentAlignment = Alignment.Center) {
            Surface(
                modifier = Modifier.size(8.dp),
                shape = RoundedCornerShape(4.dp),
                color = color
            ) {}
        }
    }
}

/**
 * Format price for display (strip unnecessary trailing zeros).
 */
private fun formatPrice(price: Double): String {
    return if (price == price.toLong().toDouble()) {
        price.toLong().toString()
    } else {
        "%.2f".format(price)
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
