package com.restroqr.owner.ui.auth

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusDirection
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp

/**
 * Registration screen composable with name, email, phone, and password fields.
 * Validates: at least one of email/phone required, password ≥8 chars, name not empty.
 */
@Composable
fun RegisterScreen(
    authViewModel: AuthViewModel,
    onNavigateToLogin: () -> Unit,
    onRegisterSuccess: () -> Unit
) {
    val registerState by authViewModel.registerState.collectAsState()
    val focusManager = LocalFocusManager.current
    val scrollState = rememberScrollState()

    var name by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var phone by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }

    var nameError by remember { mutableStateOf<String?>(null) }
    var emailError by remember { mutableStateOf<String?>(null) }
    var phoneError by remember { mutableStateOf<String?>(null) }
    var passwordError by remember { mutableStateOf<String?>(null) }
    var contactError by remember { mutableStateOf<String?>(null) }

    // Map API field errors to local state
    LaunchedEffect(registerState) {
        if (registerState is AuthUiState.Error) {
            val fieldErrors = (registerState as AuthUiState.Error).fieldErrors
            fieldErrors["name"]?.let { nameError = it }
            fieldErrors["email"]?.let { emailError = it }
            fieldErrors["phone"]?.let { phoneError = it }
            fieldErrors["password"]?.let { passwordError = it }
        }
    }

    // Navigate on success
    LaunchedEffect(registerState) {
        if (registerState is AuthUiState.Success) {
            authViewModel.resetRegisterState()
            onRegisterSuccess()
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(scrollState)
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Spacer(modifier = Modifier.height(48.dp))

        Text(
            text = "Create Account",
            style = MaterialTheme.typography.headlineMedium,
            color = MaterialTheme.colorScheme.onSurface
        )

        Spacer(modifier = Modifier.height(8.dp))

        Text(
            text = "Register your RestroQR owner account",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )

        Spacer(modifier = Modifier.height(32.dp))

        // General error message from API
        if (registerState is AuthUiState.Error) {
            val errorState = registerState as AuthUiState.Error
            if (errorState.fieldErrors.isEmpty()) {
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
        }

        // Name field
        OutlinedTextField(
            value = name,
            onValueChange = {
                name = it
                nameError = null
            },
            label = { Text("Name *") },
            placeholder = { Text("Enter your full name") },
            isError = nameError != null,
            supportingText = nameError?.let { error -> { Text(error) } },
            singleLine = true,
            keyboardOptions = KeyboardOptions(
                keyboardType = KeyboardType.Text,
                imeAction = ImeAction.Next
            ),
            keyboardActions = KeyboardActions(
                onNext = { focusManager.moveFocus(FocusDirection.Down) }
            ),
            modifier = Modifier.fillMaxWidth()
        )

        Spacer(modifier = Modifier.height(12.dp))

        // Email field
        OutlinedTextField(
            value = email,
            onValueChange = {
                email = it
                emailError = null
                contactError = null
            },
            label = { Text("Email") },
            placeholder = { Text("Enter email address") },
            isError = emailError != null || contactError != null,
            supportingText = (emailError ?: contactError)?.let { error -> { Text(error) } },
            singleLine = true,
            keyboardOptions = KeyboardOptions(
                keyboardType = KeyboardType.Email,
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
            onValueChange = {
                phone = it
                phoneError = null
                contactError = null
            },
            label = { Text("Phone") },
            placeholder = { Text("Enter phone number") },
            isError = phoneError != null || (contactError != null && email.isBlank()),
            supportingText = phoneError?.let { error -> { Text(error) } },
            singleLine = true,
            keyboardOptions = KeyboardOptions(
                keyboardType = KeyboardType.Phone,
                imeAction = ImeAction.Next
            ),
            keyboardActions = KeyboardActions(
                onNext = { focusManager.moveFocus(FocusDirection.Down) }
            ),
            modifier = Modifier.fillMaxWidth()
        )

        // Contact info hint
        if (contactError == null) {
            Text(
                text = "At least one of email or phone is required",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(start = 16.dp, top = 4.dp)
            )
        }

        Spacer(modifier = Modifier.height(12.dp))

        // Password field
        OutlinedTextField(
            value = password,
            onValueChange = {
                password = it
                passwordError = null
            },
            label = { Text("Password *") },
            placeholder = { Text("Minimum 8 characters") },
            isError = passwordError != null,
            supportingText = passwordError?.let { error -> { Text(error) } },
            singleLine = true,
            visualTransformation = PasswordVisualTransformation(),
            keyboardOptions = KeyboardOptions(
                keyboardType = KeyboardType.Password,
                imeAction = ImeAction.Done
            ),
            keyboardActions = KeyboardActions(
                onDone = { focusManager.clearFocus() }
            ),
            modifier = Modifier.fillMaxWidth()
        )

        Spacer(modifier = Modifier.height(24.dp))

        // Register button
        Button(
            onClick = {
                // Client-side validation
                var hasError = false

                if (name.isBlank()) {
                    nameError = "Name is required"
                    hasError = true
                }
                if (email.isBlank() && phone.isBlank()) {
                    contactError = "At least one of email or phone is required"
                    hasError = true
                }
                if (password.length < 8) {
                    passwordError = "Password must be at least 8 characters"
                    hasError = true
                }

                if (!hasError) {
                    authViewModel.register(
                        email = email.ifBlank { null },
                        phone = phone.ifBlank { null },
                        password = password,
                        name = name
                    )
                }
            },
            enabled = registerState !is AuthUiState.Loading,
            modifier = Modifier
                .fillMaxWidth()
                .height(50.dp)
        ) {
            if (registerState is AuthUiState.Loading) {
                CircularProgressIndicator(
                    modifier = Modifier.size(24.dp),
                    color = MaterialTheme.colorScheme.onPrimary,
                    strokeWidth = 2.dp
                )
            } else {
                Text("Create Account")
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Navigate to login
        TextButton(onClick = onNavigateToLogin) {
            Text("Already have an account? Sign In")
        }

        Spacer(modifier = Modifier.height(24.dp))
    }
}
