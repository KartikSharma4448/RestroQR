import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../services/auth_service.dart';
import '../ui/auth_layout.dart';

class ConnectGoogleScreen extends StatelessWidget {
  const ConnectGoogleScreen({super.key});
  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthService>();
    return Scaffold(
      body: AuthLayout(
        title: 'Connect your Google account',
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (auth.currentUser?.email != null)
              Text(auth.currentUser!.email!, textAlign: TextAlign.center),
            const SizedBox(height: 24),
            OutlinedButton(
              onPressed: auth.isLoading
                  ? null
                  : () async {
                      final success = await auth.signInWithGoogle(link: true);
                      if (context.mounted && success) {
                        context.go('/profile-setup');
                      }
                    },
              child: Text(
                auth.isLoading ? 'Connecting...' : 'Connect Google account',
              ),
            ),
            if (auth.error != null)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 12),
                child: Text(
                  auth.error!,
                  style: TextStyle(color: Theme.of(context).colorScheme.error),
                ),
              ),
            TextButton(
              onPressed: auth.isLoading
                  ? null
                  : () async {
                      await auth.logout();
                      if (context.mounted) context.go('/login');
                    },
              child: const Text('Sign out'),
            ),
          ],
        ),
      ),
    );
  }
}
