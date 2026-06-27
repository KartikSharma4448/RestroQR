package com.restroqr.owner.ui.menu

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Image
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel

/**
 * Form screen for creating or editing a food item.
 * Fields: name, description, price, image (placeholder), veg/non-veg toggle, availability.
 * Includes client-side validation matching backend constraints.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FoodItemFormScreen(
    itemId: String?,
    categoryId: String,
    viewModel: FoodItemsViewModel = hiltViewModel(),
    onNavigateBack: () -> Unit
) {
    val formState by viewModel.formState.collectAsState()
    val isEditing = itemId != null

    LaunchedEffect(itemId, categoryId) {
        if (isEditing) {
            viewModel.initFormForEdit(itemId!!, categoryId)
        } else {
            viewModel.initFormForCreate(categoryId)
        }
    }

    // Navigate back on successful save
    LaunchedEffect(formState.saveSuccess) {
        if (formState.saveSuccess) {
            viewModel.resetSaveSuccess()
            onNavigateBack()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(if (isEditing) "Edit Food Item" else "Add Food Item")
                },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(
                            imageVector = Icons.Default.ArrowBack,
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
            if (formState.isLoading) {
                CircularProgressIndicator(
                    modifier = Modifier.align(Alignment.Center)
                )
            } else {
                FoodItemFormContent(
                    formState = formState,
                    isEditing = isEditing,
                    itemId = itemId,
                    onNameChange = viewModel::updateName,
                    onDescriptionChange = viewModel::updateDescription,
                    onPriceChange = viewModel::updatePrice,
                    onImageUrlChange = viewModel::updateImageUrl,
                    onBadgeChange = viewModel::updateBadge,
                    onAvailabilityChange = viewModel::updateAvailability,
                    onSave = { viewModel.saveFoodItem(itemId) }
                )
            }
        }
    }
}

@Composable
private fun FoodItemFormContent(
    formState: FoodItemFormState,
    isEditing: Boolean,
    itemId: String?,
    onNameChange: (String) -> Unit,
    onDescriptionChange: (String) -> Unit,
    onPriceChange: (String) -> Unit,
    onImageUrlChange: (String) -> Unit,
    onBadgeChange: (String) -> Unit,
    onAvailabilityChange: (Boolean) -> Unit,
    onSave: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Error banner
        formState.error?.let { error ->
            Card(
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.errorContainer
                ),
                shape = RoundedCornerShape(8.dp)
            ) {
                Text(
                    text = error,
                    modifier = Modifier.padding(12.dp),
                    color = MaterialTheme.colorScheme.onErrorContainer,
                    style = MaterialTheme.typography.bodyMedium
                )
            }
        }

        // Name field
        OutlinedTextField(
            value = formState.name,
            onValueChange = onNameChange,
            label = { Text("Name *") },
            placeholder = { Text("e.g., Paneer Tikka") },
            isError = formState.nameError != null,
            supportingText = formState.nameError?.let { { Text(it) } },
            singleLine = true,
            modifier = Modifier.fillMaxWidth()
        )

        // Description field
        OutlinedTextField(
            value = formState.description,
            onValueChange = { if (it.length <= 500) onDescriptionChange(it) },
            label = { Text("Description") },
            placeholder = { Text("Brief description of the item (optional)") },
            maxLines = 3,
            supportingText = {
                Text("${formState.description.length}/500")
            },
            modifier = Modifier.fillMaxWidth()
        )

        // Price field
        OutlinedTextField(
            value = formState.price,
            onValueChange = { value ->
                // Allow only valid decimal input
                if (value.isEmpty() || value.matches(Regex("^\\d*\\.?\\d{0,2}$"))) {
                    onPriceChange(value)
                }
            },
            label = { Text("Price (₹) *") },
            placeholder = { Text("0.00") },
            isError = formState.priceError != null,
            supportingText = formState.priceError?.let { { Text(it) } },
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
            singleLine = true,
            prefix = { Text("₹") },
            modifier = Modifier.fillMaxWidth()
        )

        // Image placeholder
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(12.dp),
            colors = CardDefaults.cardColors(
                containerColor = MaterialTheme.colorScheme.surfaceVariant
            )
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Icon(
                    imageVector = Icons.Default.Image,
                    contentDescription = null,
                    modifier = Modifier.size(48.dp),
                    tint = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = "Image Upload",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Medium
                )
                Text(
                    text = "Image picker coming soon. You can add image URL below.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }

        // Image URL field (temporary until image picker is implemented)
        OutlinedTextField(
            value = formState.imageUrl,
            onValueChange = onImageUrlChange,
            label = { Text("Image URL (optional)") },
            placeholder = { Text("https://example.com/image.jpg") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth()
        )

        // Badge selection (Veg / Non-Veg)
        Column {
            Text(
                text = "Type *",
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.Medium
            )
            Spacer(modifier = Modifier.height(8.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                BadgeOption(
                    label = "Veg",
                    selected = formState.badge == "veg",
                    color = Color(0xFF4CAF50),
                    onClick = { onBadgeChange("veg") },
                    modifier = Modifier.weight(1f)
                )
                BadgeOption(
                    label = "Non-Veg",
                    selected = formState.badge == "non_veg",
                    color = Color(0xFFF44336),
                    onClick = { onBadgeChange("non_veg") },
                    modifier = Modifier.weight(1f)
                )
            }
            if (formState.badgeError != null) {
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = formState.badgeError!!,
                    color = MaterialTheme.colorScheme.error,
                    style = MaterialTheme.typography.bodySmall
                )
            }
        }

        // Availability toggle
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(12.dp)
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Column {
                    Text(
                        text = "Available",
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.Medium
                    )
                    Text(
                        text = if (formState.isAvailable) "Item is visible to customers"
                        else "Item is hidden from customers",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                Switch(
                    checked = formState.isAvailable,
                    onCheckedChange = onAvailabilityChange
                )
            }
        }

        Spacer(modifier = Modifier.height(8.dp))

        // Save button
        Button(
            onClick = onSave,
            enabled = !formState.isSaving,
            modifier = Modifier
                .fillMaxWidth()
                .height(50.dp)
        ) {
            if (formState.isSaving) {
                CircularProgressIndicator(
                    modifier = Modifier.size(20.dp),
                    strokeWidth = 2.dp,
                    color = MaterialTheme.colorScheme.onPrimary
                )
                Spacer(modifier = Modifier.width(8.dp))
            }
            Text(if (isEditing) "Update Item" else "Add Item")
        }

        Spacer(modifier = Modifier.height(16.dp))
    }
}

/**
 * A selectable badge option card (Veg or Non-Veg).
 */
@Composable
private fun BadgeOption(
    label: String,
    selected: Boolean,
    color: Color,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val containerColor = if (selected) {
        color.copy(alpha = 0.12f)
    } else {
        MaterialTheme.colorScheme.surfaceVariant
    }
    val borderColor = if (selected) color else MaterialTheme.colorScheme.outline

    OutlinedCard(
        modifier = modifier.selectable(
            selected = selected,
            onClick = onClick,
            role = Role.RadioButton
        ),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.outlinedCardColors(containerColor = containerColor),
        border = BorderStroke(
            width = if (selected) 2.dp else 1.dp,
            color = borderColor
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.Center
        ) {
            Surface(
                modifier = Modifier.size(12.dp),
                shape = RoundedCornerShape(6.dp),
                color = color
            ) {}
            Spacer(modifier = Modifier.width(8.dp))
            Text(
                text = label,
                style = MaterialTheme.typography.titleSmall,
                fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal,
                color = if (selected) color else MaterialTheme.colorScheme.onSurface
            )
        }
    }
}
