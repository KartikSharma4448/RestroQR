import 'package:flutter/material.dart';
import 'owner_widgets.dart';
import 'app_theme.dart';

class AuthLayout extends StatelessWidget {
  final String title;
  final Widget child;
  const AuthLayout({super.key, required this.title, required this.child});
  @override
  Widget build(BuildContext context) => SafeArea(
    child: Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 420),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const BrandHeading(),
              const SizedBox(height: 32),
              const Divider(color: AppColors.border),
              const SizedBox(height: 24),
              Text(title, style: Theme.of(context).textTheme.headlineSmall),
              const SizedBox(height: 24),
              child,
            ],
          ),
        ),
      ),
    ),
  );
}
