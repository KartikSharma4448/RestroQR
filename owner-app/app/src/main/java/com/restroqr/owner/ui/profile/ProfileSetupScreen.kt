package com.restroqr.owner.ui.profile

import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.AddAPhoto
import androidx.compose.material.icons.filled.Image
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusDirection
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import coil.compose.AsyncImage

/**
 * Profile setup/edit screen allowing the owner to create or update their restaurant profile.
 * Includes fields for name (max 100), address (max 250), phone (max 20),
 * and placeholders for logo/cover image upload.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProfileSetupScreen(
    viewModel: ProfileViewModel = hiltViewModel(),
    onNavigateBack: () -> Unit,
    onProfileSaved: () -> Unit
) {
    val profileState by viewModel.profileState.collectAsState()
    val imageUploadState by viewModel.imageUploadState.collectAsState()
    val existingRestaurant by viewModel.existingRestaurant.collectAsState()
    val focusManager = LocalFocusManager.current

    val isEditMode = existingRestaurant != null

    var name by remember(existingRestaurant) {
        mutableStateOf(existingRestaurant?.name ?: "")
    }
    var address by remember(existingRestaurant) {
        mutableStateOf(existingRestaurant?.address ?: "")
    }
    var phone by remember(existingRestaurant) {
        mutableStateOf(existingRestaurant?.phone ?: "")
    }

    // Field errors from validation
    val fieldErrors = (profileState as? ProfileUiState.Error)?.fieldErrors ?: emptyMap()

    // Navigate on success
    LaunchedEffect(profileState) {
        if (profileState is ProfileUiState.Success) {
            viewModel.resetProfileState()
            onProfileSaved()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(if (isEditMode) "Edit Profile" else "Set Up Restaurant")
                },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Back"
                        )
                    }
                }
            )
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .verticalScroll(rememberScrollState())
                .padding(16.dp)
        ) {
            // Error banner
            if (profileState is ProfileUiState.Error) {
                val errorState = profileState as ProfileUiState.Error
                Card(
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.errorContainer
                    ),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(
                        text = errorState.message,
                        color = MaterialTheme.colorScheme.onErrorContainer,
                        style = MaterialTheme.typography.bodyMedium,
                        modifier = Modifier.padding(12.dp)
                    )
                }
                Spacer(modifier = Modifier.height(16.dp))
            }

            // Image upload section
            ImageUploadSection(
                logoUrl = existingRestaurant?.logoUrl,
                coverImageUrl = existingRestaurant?.coverImageUrl,
                imageUploadState = imageUploadState,
                onLogoClick = {
                    // TODO: Launch image picker for logo
                    // After picking, call viewModel.uploadImages(logoFile = selectedFile)
                },
                onCoverClick = {
                    // TODO: Launch image picker for cover
                    // After picking, call viewModel.uploadImages(coverFile = selectedFile)
                }
            )

            Spacer(modifier = Modifier.height(24.dp))

            // Restaurant name field
            OutlinedTextField(
                value = name,
                onValueChange = { if (it.length <= 100) name = it },
                label = { Text("Restaurant Name *") },
                placeholder = { Text("Enter restaurant name") },
                isError = fieldErrors.containsKey("name"),
                supportingText = {
                    if (fieldErrors.containsKey("name")) {
                        Text(fieldErrors["name"]!!)
                    } else {
                        Text("${name.length}/100")
                    }
                },
                singleLine = true,
                keyboardOptions = KeyboardOptions(
                    imeAction = ImeAction.Next
                ),
                keyboardActions = KeyboardActions(
                    onNext = { focusManager.moveFocus(FocusDirection.Down) }
                ),
                modifier = Modifier.fillMaxWidth()
            )

            Spacer(modifier = Modifier.height(12.dp))

            // Address field
            OutlinedTextField(
                value = address,
                onValueChange = { if (it.length <= 250) address = it },
                label = { Text("Address *") },
                placeholder = { Text("Enter restaurant address") },
                isError = fieldErrors.containsKey("address"),
                supportingText = {
                    if (fieldErrors.containsKey("address")) {
                        Text(fieldErrors["address"]!!)
                    } else {
                        Text("${address.length}/250")
                    }
                },
                maxLines = 3,
                keyboardOptions = KeyboardOptions(
                    imeAction = ImeAction.Next
                ),
                keyboardActions = KeyboardActions(
                    onNext = { focusManager.moveFocus(FocusDirection.Down) }
                ),
                modifier = Modifier.fillMaxWidth()
            )

            Spacer(modifier = Modifier.height(12.dp))

            // Phone field
            OutlinedTextField(
                value = phone,
                onValueChange = { if (it.length <= 20) phone = it },
                label = { Text("Phone *") },
                placeholder = { Text("Enter phone number") },
                isError = fieldErrors.containsKey("phone"),
                supportingText = {
                    if (fieldErrors.containsKey("phone")) {
                        Text(fieldErrors["phone"]!!)
                    } else {
                        Text("${phone.length}/20")
                    }
                },
                singleLine = true,
                keyboardOptions = KeyboardOptions(
                    keyboardType = KeyboardType.Phone,
                    imeAction = ImeAction.Done
                ),
                keyboardActions = KeyboardActions(
                    onDone = { focusManager.clearFocus() }
                ),
                modifier = Modifier.fillMaxWidth()
            )

            Spacer(modifier = Modifier.height(32.dp))

            // Submit button
            Button(
                onClick = {
                    if (isEditMode) {
                        viewModel.updateRestaurant(name, address, phone)
                    } else {
                        viewModel.createRestaurant(name, address, phone)
                    }
                },
                enabled = profileState !is ProfileUiState.Loading,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(50.dp)
            ) {
                if (profileState is ProfileUiState.Loading) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(24.dp),
                        color = MaterialTheme.colorScheme.onPrimary,
                        strokeWidth = 2.dp
                    )
                } else {
                    Text(if (isEditMode) "Save Changes" else "Create Restaurant")
                }
            }
        }
    }
}

/**
 * Section for logo and cover image upload with preview and tap-to-upload placeholders.
 */
@Composable
private fun ImageUploadSection(
    logoUrl: String?,
    coverImageUrl: String?,
    imageUploadState: ImageUploadUiState,
    onLogoClick: () -> Unit,
    onCoverClick: () -> Unit
) {
    Column {
        Text(
            text = "Images",
            style = MaterialTheme.typography.titleSmall,
            modifier = Modifier.padding(bottom = 8.dp)
        )

        // Cover image
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .height(150.dp)
                .clickable(onClick = onCoverClick),
            shape = RoundedCornerShape(12.dp)
        ) {
            Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center
            ) {
                if (coverImageUrl != null) {
                    AsyncImage(
                        model = coverImageUrl,
                        contentDescription = "Cover image",
                        modifier = Modifier.fillMaxSize(),
                        contentScale = ContentScale.Crop
                    )
                } else {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Icon(
                            imageVector = Icons.Default.Image,
                            contentDescription = null,
                            modifier = Modifier.size(36.dp),
                            tint = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = "Tap to add cover image",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(12.dp))

        // Logo image
        Row(
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(72.dp)
                    .clip(CircleShape)
                    .border(
                        width = 2.dp,
                        color = MaterialTheme.colorScheme.outlineVariant,
                        shape = CircleShape
                    )
                    .clickable(onClick = onLogoClick),
                contentAlignment = Alignment.Center
            ) {
                if (logoUrl != null) {
                    AsyncImage(
                        model = logoUrl,
                        contentDescription = "Restaurant logo",
                        modifier = Modifier
                            .fillMaxSize()
                            .clip(CircleShape),
                        contentScale = ContentScale.Crop
                    )
                } else {
                    Icon(
                        imageVector = Icons.Default.AddAPhoto,
                        contentDescription = "Add logo",
                        modifier = Modifier.size(28.dp),
                        tint = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            Spacer(modifier = Modifier.width(12.dp))

            Text(
                text = "Tap to add restaurant logo",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }

        // Image upload progress/error
        when (imageUploadState) {
            is ImageUploadUiState.Uploading -> {
                Spacer(modifier = Modifier.height(8.dp))
                LinearProgressIndicator(modifier = Modifier.fillMaxWidth())
            }
            is ImageUploadUiState.Error -> {
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = imageUploadState.message,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.error
                )
            }
            else -> { /* No indicator needed */ }
        }
    }
}
