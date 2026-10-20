import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:restroqr_owner/ui/app_theme.dart';
import 'package:restroqr_owner/ui/owner_widgets.dart';

void main() {
  for (final width in [320.0, 390.0]) {
    testWidgets('detail does not shift trailing arrow at ${width}px', (
      tester,
    ) async {
      tester.view.physicalSize = Size(width, 720);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      var taps = 0;
      await tester.pumpWidget(
        MaterialApp(
          theme: ownerTheme(),
          home: Scaffold(
            body: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                children: [
                  ActionRow(
                    icon: Icons.qr_code,
                    title: 'Restaurant QR',
                    onTap: () {},
                  ),
                  ActionRow(
                    icon: Icons.tune,
                    title: 'QR settings',
                    detail: 'Multi-table',
                    onTap: () => taps++,
                  ),
                ],
              ),
            ),
          ),
        ),
      );
      final arrows = find.byIcon(Icons.chevron_right);
      expect(
        tester.getRect(arrows.at(0)).right,
        tester.getRect(arrows.at(1)).right,
      );
      expect(tester.getRect(arrows.at(1)).right, width - 20);
      await tester.tap(find.text('QR settings'));
      expect(taps, 1);
      expect(tester.takeException(), isNull);
    });
  }
}
