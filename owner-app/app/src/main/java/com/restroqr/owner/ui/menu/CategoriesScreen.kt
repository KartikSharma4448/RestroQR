package com.restroqr.owner.ui.menu

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.restroqr.owner.data.models.CategoryData

/**
 * Screen displaying categories in owner-defined order with CRUD and reorder capabilities.
 * Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.6
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CategoriesScreen(
    viewModel: CategoriesViewModel = hiltViewModel(),
    onNavigateBack: () -> Unit
) {
    val uiState by viewModel.uiState.collectAsState()

    var showAddDialog by remember { mutableStateOf(false) }
    var editingCategory by remember { mutableStateOf<CategoryData?>(null) }
    var deletingCategory by remember { mutableStateOf<CategoryData?>(null) }

    // Show snackbar for operation errors
    val snackbarHostState = remember { SnackbarHostState() }
    LaunchedEffect(uiState.operationError) {
        uiState.operationError?.let { error ->
            snackbarHostState.showSnackbar(error)
            viewModel.clearOperationError()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Categories") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Back"
                        )
                    }
                }
            )
        },
        floatingActionButton = {
            if (!uiState.isLoading && uiState.error == null) {
                FloatingActionButton(
                    onClick = { showAddDialog = true }
                ) {
                    Icon(
                        imageVector = Icons.Default.Add,
                        contentDescription = "Add category"
                    )
                }
            }
        },
        snackbarHost = { SnackbarHost(hostState = snackbarHostState) }
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            when {
                uiState.isLoading -> {
                    CircularProgressIndicator(
                        modifier = Modifier.align(Alignment.Center)
                    )
                }

                uiState.error != null -> {
                    ErrorContent(
                        message = uiState.error!!,
                        onRetryClick = { viewModel.loadCategories() },
                        modifier = Modifier.align(Alignment.Center)
                    )
                }

                uiState.categories.isEmpty() -> {
                    EmptyContent(
                        onAddClick = { showAddDialog = true },
                        modifier = Modifier.align(Alignment.Center)
                    )
                }

                else -> {
                    CategoriesList(
                        categories = uiState.categories,
                        isOperationInProgress = uiState.isOperationInProgress,
                        onMoveUp = { index -> viewModel.moveCategoryUp(index) },
                        onMoveDown = { index -> viewModel.moveCategoryDown(index) },
                        onEdit = { category -> editingCategory = category },
                        onDelete = { category -> deletingCategory = category }
                    )
                }
            }

            // Loading overlay for operations
            if (uiState.isOperationInProgress) {
                CircularProgressIndicator(
                    modifier = Modifier.align(Alignment.Center)
                )
            }
        }
    }

    // Add category dialog
    if (showAddDialog) {
        CategoryNameDialog(
            title = "Add Category",
            initialName = "",
            onDismiss = { showAddDialog = false },
            onConfirm = { name ->
                viewModel.createCategory(name) {
                    showAddDialog = false
                }
            }
        )
    }

    // Edit category dialog
    editingCategory?.let { category ->
        CategoryNameDialog(
            title = "Edit Category",
            initialName = category.name,
            onDismiss = { editingCategory = null },
            onConfirm = { name ->
                viewModel.updateCategory(category.id, name) {
                    editingCategory = null
                }
            }
        )
    }

    // Delete confirmation dialog
    deletingCategory?.let { category ->
        DeleteCategoryDialog(
            categoryName = category.name,
            onDismiss = { deletingCategory = null },
            onConfirm = {
                viewModel.deleteCategory(category.id)
                deletingCategory = null
            }
        )
    }
}

/**
 * List of categories with reorder (move up/down), edit, and delete actions.
 */
@Composable
private fun CategoriesList(
    categories: List<CategoryData>,
    isOperationInProgress: Boolean,
    onMoveUp: (Int) -> Unit,
    onMoveDown: (Int) -> Unit,
    onEdit: (CategoryData) -> Unit,
    onDelete: (CategoryData) -> Unit
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        itemsIndexed(
            items = categories,
            key = { _, category -> category.id }
        ) { index, category ->
            CategoryCard(
                category = category,
                index = index,
                totalCount = categories.size,
                isOperationInProgress = isOperationInProgress,
                onMoveUp = { onMoveUp(index) },
                onMoveDown = { onMoveDown(index) },
                onEdit = { onEdit(category) },
                onDelete = { onDelete(category) }
            )
        }
    }
}

/**
 * Card displaying a single category with reorder and action buttons.
 */
@Composable
private fun CategoryCard(
    category: CategoryData,
    index: Int,
    totalCount: Int,
    isOperationInProgress: Boolean,
    onMoveUp: () -> Unit,
    onMoveDown: () -> Unit,
    onEdit: () -> Unit,
    onDelete: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Reorder buttons
            Column {
                IconButton(
                    onClick = onMoveUp,
                    enabled = index > 0 && !isOperationInProgress
                ) {
                    Icon(
                        imageVector = Icons.Default.KeyboardArrowUp,
                        contentDescription = "Move up"
                    )
                }
                IconButton(
                    onClick = onMoveDown,
                    enabled = index < totalCount - 1 && !isOperationInProgress
                ) {
                    Icon(
                        imageVector = Icons.Default.KeyboardArrowDown,
                        contentDescription = "Move down"
                    )
                }
            }

            Spacer(modifier = Modifier.width(8.dp))

            // Category name and order indicator
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = category.name,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Medium
                )
                Text(
                    text = "Position ${index + 1}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            // Action buttons
            IconButton(
                onClick = onEdit,
                enabled = !isOperationInProgress
            ) {
                Icon(
                    imageVector = Icons.Default.Edit,
                    contentDescription = "Edit category",
                    tint = MaterialTheme.colorScheme.primary
                )
            }

            IconButton(
                onClick = onDelete,
                enabled = !isOperationInProgress
            ) {
                Icon(
                    imageVector = Icons.Default.Delete,
                    contentDescription = "Delete category",
                    tint = MaterialTheme.colorScheme.error
                )
            }
        }
    }
}

/**
 * Dialog for adding or editing a category name.
 * Enforces 1-50 character limit.
 */
@Composable
private fun CategoryNameDialog(
    title: String,
    initialName: String,
    onDismiss: () -> Unit,
    onConfirm: (String) -> Unit
) {
    var name by remember { mutableStateOf(initialName) }
    var nameError by remember { mutableStateOf<String?>(null) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title) },
        text = {
            Column {
                OutlinedTextField(
                    value = name,
                    onValueChange = { newValue ->
                        if (newValue.length <= 50) {
                            name = newValue
                            nameError = null
                        }
                    },
                    label = { Text("Category Name") },
                    placeholder = { Text("e.g., Appetizers, Main Course") },
                    isError = nameError != null,
                    supportingText = {
                        if (nameError != null) {
                            Text(nameError!!)
                        } else {
                            Text("${name.length}/50 characters")
                        }
                    },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
            }
        },
        confirmButton = {
            TextButton(
                onClick = {
                    val trimmed = name.trim()
                    when {
                        trimmed.isEmpty() -> nameError = "Name is required"
                        trimmed.length > 50 -> nameError = "Name must be 50 characters or less"
                        else -> onConfirm(trimmed)
                    }
                }
            ) {
                Text("Save")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel")
            }
        }
    )
}

/**
 * Delete confirmation dialog with cascade warning about food items.
 */
@Composable
private fun DeleteCategoryDialog(
    categoryName: String,
    onDismiss: () -> Unit,
    onConfirm: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Delete Category") },
        text = {
            Column {
                Text("Are you sure you want to delete \"$categoryName\"?")
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = "⚠️ All food items in this category will also be permanently deleted. This action cannot be undone.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.error
                )
            }
        },
        confirmButton = {
            TextButton(
                onClick = onConfirm,
                colors = ButtonDefaults.textButtonColors(
                    contentColor = MaterialTheme.colorScheme.error
                )
            ) {
                Text("Delete")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel")
            }
        }
    )
}

/**
 * Empty state when no categories exist yet.
 */
@Composable
private fun EmptyContent(
    onAddClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier.padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(
            text = "No Categories Yet",
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.Bold,
            textAlign = TextAlign.Center
        )

        Spacer(modifier = Modifier.height(8.dp))

        Text(
            text = "Create your first menu category to start adding food items.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center
        )

        Spacer(modifier = Modifier.height(24.dp))

        Button(onClick = onAddClick) {
            Icon(
                imageVector = Icons.Default.Add,
                contentDescription = null,
                modifier = Modifier.size(18.dp)
            )
            Spacer(modifier = Modifier.width(8.dp))
            Text("Add Category")
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
