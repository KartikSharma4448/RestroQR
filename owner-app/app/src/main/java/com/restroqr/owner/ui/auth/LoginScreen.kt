package com.restroqr.owner.ui.auth

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
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
 * Login screen composable with email/phone and password fields.
 * Performs client-side validation before triggering the API call.
 */
@Composable
fun LoginScreen(
    authViewModel: AuthViewModel,
    onNavigateToRegister: () -> Unit,
    onLoginSuccess: () -> Unit
) {
    val loginState by authViewModel.loginState.collectAsState()
    val focusManager = LocalFocusManager.current

    var identifier by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var identifierError by remember { mutableStateOf<String?>(null) }
    var passwordError by remember { mutableStateOf<String?>(null) }

    // Navigate on success
    LaunchedEffect(loginState) {
        if (loginState is AuthUiState.Success) {
            authViewModel.resetLoginState()
            onLoginSuccess()
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text(
            text = "Welcome Back",
            style = MaterialTheme.typography.headlineMedium,
            color = MaterialTheme.colorScheme.onSurface
        )

        Spacer(modifier = Modifier.height(8.dp))

        Text(
            text = "Sign in to your RestroQR account",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )

        Spacer(modifier = Modifier.height(32.dp))

        // Error message from API
        if (loginState is AuthUiState.Error) {
            val errorState = loginState as AuthUiState.Error
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

        // Email/Phone field
        OutlinedTextField(
            value = identifier,
            onValueChange = {
                identifier = it
                identifierError = null
            },
            label = { Text("Email or Phone") },
            placeholder = { Text("Enter email or phone number") },
            isError = identifierError != null,
            supportingText = identifierError?.let { error -> { Text(error) } },
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

        // Password field
        OutlinedTextField(
            value = password,
            onValueChange = {
                password = it
                passwordError = null
            },
            label = { Text("Password") },
            placeholder = { Text("Enter your password") },
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

        // Login button
        Button(
            onClick = {
                // Client-side validation
                var hasError = false

                if (identifier.isBlank()) {
                    identifierError = "Email or phone is required"
                    hasError = true
                }
                if (password.isBlank()) {
                    passwordError = "Password is required"
                    hasError = true
                }

                if (!hasError) {
                    authViewModel.login(identifier.trim(), password)
                }
            },
            enabled = loginState !is AuthUiState.Loading,
            modifier = Modifier
                .fillMaxWidth()
                .height(50.dp)
        ) {
            if (loginState is AuthUiState.Loading) {
                CircularProgressIndicator(
                    modifier = Modifier.size(24.dp),
                    color = MaterialTheme.colorScheme.onPrimary,
                    strokeWidth = 2.dp
                )
            } else {
                Text("Sign In")
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Navigate to register
        TextButton(onClick = onNavigateToRegister) {
            Text("Don't have an account? Register")
        }
    }
}
