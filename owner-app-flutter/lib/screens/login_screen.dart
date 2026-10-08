import 'package:flutter/material.dart';
import '../ui/auth_layout.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../models/auth_models.dart';
import '../services/auth_service.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _identifierController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _obscurePassword = true;

  @override
  void dispose() {
    _identifierController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _handleLogin() async {
    if (!_formKey.currentState!.validate()) return;

    final identifier = _identifierController.text.trim();
    final password = _passwordController.text;

    final isEmail = identifier.contains('@');
    final request = LoginRequest(
      email: isEmail ? identifier : null,
      phone: isEmail ? null : identifier,
      password: password,
    );

    final authService = context.read<AuthService>();
    final success = await authService.login(request);

    if (success && mounted) {
      context.go('/dashboard');
    } else if (mounted && authService.error != null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(authService.error!),
          backgroundColor: Colors.red.shade700,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final authService = context.watch<AuthService>();
    return Scaffold(
      body: AuthLayout(
        title: 'Sign in to your restaurant',
        child: AutofillGroup(
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                TextFormField(
                  controller: _identifierController,
                  decoration: const InputDecoration(
                    labelText: 'Email or phone',
                    prefixIcon: Icon(Icons.person_outline),
                  ),
                  keyboardType: TextInputType.emailAddress,
                  autofillHints: const [AutofillHints.username],
                  textInputAction: TextInputAction.next,
                  validator: (value) => value == null || value.trim().isEmpty
                      ? 'Enter your email or phone'
                      : null,
                ),
                const SizedBox(height: 20),
                TextFormField(
                  controller: _passwordController,
                  decoration: InputDecoration(
                    labelText: 'Password',
                    prefixIcon: const Icon(Icons.lock_outline),
                    suffixIcon: IconButton(
                      tooltip: _obscurePassword
                          ? 'Show password'
                          : 'Hide password',
                      icon: Icon(
                        _obscurePassword
                            ? Icons.visibility_off_outlined
                            : Icons.visibility_outlined,
                      ),
                      onPressed: () =>
                          setState(() => _obscurePassword = !_obscurePassword),
                    ),
                  ),
                  obscureText: _obscurePassword,
                  autofillHints: const [AutofillHints.password],
                  textInputAction: TextInputAction.done,
                  onFieldSubmitted: (_) {
                    if (!authService.isLoading) _handleLogin();
                  },
                  validator: (value) => value == null || value.isEmpty
                      ? 'Enter your password'
                      : null,
                ),
                const SizedBox(height: 28),
                FilledButton(
                  onPressed: authService.isLoading ? null : _handleLogin,
                  child: authService.isLoading
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : const Text('Sign in'),
                ),
                const SizedBox(height: 16),
                TextButton(
                  onPressed: authService.isLoading
                      ? null
                      : () => context.go('/register'),
                  child: const Text('Create an owner account'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
