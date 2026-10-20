import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'app_theme.dart';

class BrandHeading extends StatelessWidget {
  final bool compact;
  const BrandHeading({super.key, this.compact = false});
  @override
  Widget build(BuildContext context) => Row(
    children: [
      Image.asset(
        'assets/brand-mark.png',
        width: compact ? 32 : 44,
        height: compact ? 32 : 44,
      ),
      const SizedBox(width: 12),
      Text(
        'RestroQR',
        style: TextStyle(
          fontSize: compact ? 20 : 24,
          fontWeight: FontWeight.w700,
          letterSpacing: 0,
        ),
      ),
    ],
  );
}

class OwnerNavigation extends StatelessWidget {
  final int selected;
  const OwnerNavigation({super.key, required this.selected});
  @override
  Widget build(BuildContext context) => DecoratedBox(
    decoration: const BoxDecoration(
      border: Border(top: BorderSide(color: AppColors.border)),
    ),
    child: NavigationBar(
      selectedIndex: selected,
      onDestinationSelected: (index) {
        if (index == selected) return;
        context.go(
          ['/dashboard', '/orders', '/categories', '/earnings'][index],
        );
      },
      destinations: const [
        NavigationDestination(
          icon: Icon(Icons.space_dashboard_outlined),
          selectedIcon: Icon(Icons.space_dashboard),
          label: 'Overview',
        ),
        NavigationDestination(
          icon: Icon(Icons.receipt_long_outlined),
          selectedIcon: Icon(Icons.receipt_long),
          label: 'Orders',
        ),
        NavigationDestination(
          icon: Icon(Icons.restaurant_menu_outlined),
          selectedIcon: Icon(Icons.restaurant_menu),
          label: 'Menu',
        ),
        NavigationDestination(
          icon: Icon(Icons.bar_chart_outlined),
          selectedIcon: Icon(Icons.bar_chart),
          label: 'Revenue',
        ),
      ],
    ),
  );
}

class SectionHeading extends StatelessWidget {
  final String title;
  const SectionHeading(this.title, {super.key});
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(top: 28, bottom: 12),
    child: Text(title, style: Theme.of(context).textTheme.titleMedium),
  );
}

class ActionRow extends StatelessWidget {
  final IconData icon;
  final String title;
  final String? detail;
  final VoidCallback onTap;
  const ActionRow({
    super.key,
    required this.icon,
    required this.title,
    required this.onTap,
    this.detail,
  });
  @override
  Widget build(BuildContext context) => Material(
    color: Colors.transparent,
    child: InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 17),
        child: Row(
          children: [
            Icon(icon, size: 22, color: AppColors.muted),
            const SizedBox(width: 14),
            Expanded(
              child: Text(
                title,
                style: Theme.of(
                  context,
                ).textTheme.bodyLarge?.copyWith(fontWeight: FontWeight.w500),
              ),
            ),
            if (detail != null)
              Flexible(
                child: Text(
                  detail!,
                  style: const TextStyle(color: AppColors.muted),
                ),
              ),
            const SizedBox(width: 8),
            const Icon(Icons.chevron_right, size: 20, color: AppColors.muted),
          ],
        ),
      ),
    ),
  );
}

class OwnerEmptyState extends StatelessWidget {
  final IconData icon;
  final String title;
  final String? message;
  final String? action;
  final VoidCallback? onAction;
  const OwnerEmptyState({
    super.key,
    required this.icon,
    required this.title,
    this.message,
    this.action,
    this.onAction,
  });
  @override
  Widget build(BuildContext context) => Center(
    child: SingleChildScrollView(
      padding: const EdgeInsets.all(28),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 380),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, color: AppColors.muted, size: 40),
            const SizedBox(height: 20),
            Text(
              title,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.titleLarge,
            ),
            if (message != null) ...[
              const SizedBox(height: 8),
              Text(
                message!,
                textAlign: TextAlign.center,
                style: const TextStyle(color: AppColors.muted),
              ),
            ],
            if (action != null && onAction != null) ...[
              const SizedBox(height: 24),
              FilledButton(onPressed: onAction, child: Text(action!)),
            ],
          ],
        ),
      ),
    ),
  );
}
