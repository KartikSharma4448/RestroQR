import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:image_picker/image_picker.dart';
import 'package:restroqr_owner/ui/dish_media_editor.dart';

void main() {
  Future<void> show(
    WidgetTester tester, {
    String? emoji,
    Future<XFile?> Function()? pick,
    required ValueChanged<DishMediaDraft> onChanged,
    double width = 390,
  }) async {
    tester.view.physicalSize = Size(width, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: DishMediaEditor(
              emoji: emoji,
              busy: false,
              pickImage: pick,
              onChanged: onChanged,
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
  }

  testWidgets('selects emoji and removes media without requiring a photo', (
    tester,
  ) async {
    DishMediaDraft? draft;
    await show(tester, onChanged: (value) => draft = value);
    await tester.tap(find.text('Emoji'));
    await tester.pumpAndSettle();
    expect(draft?.emoji, '\u{1F355}');
    await tester.tap(find.byTooltip('Use \u{2615}'));
    expect(draft?.emoji, '\u{2615}');
    await tester.tap(find.text('None'));
    expect(draft?.emoji, isNull);
    expect(draft?.bytes, isNull);
  });
  testWidgets('cancelled photo selection preserves the previous emoji', (
    tester,
  ) async {
    DishMediaDraft? draft;
    await show(
      tester,
      emoji: '\u{1F355}',
      pick: () async => null,
      onChanged: (value) => draft = value,
    );
    await tester.tap(find.text('Photo'));
    await tester.pumpAndSettle();
    expect(draft, isNull);
    expect(find.byTooltip('Use \u{1F355}'), findsOneWidget);
  });
  testWidgets('rejects oversized files before save', (
    tester,
  ) async {
    var calls = 0;
    await show(
      tester,
      pick: () async => XFile.fromData(Uint8List(5 * 1024 * 1024 + 1)),
      onChanged: (_) => calls++,
    );
    await tester.tap(find.text('Photo'));
    await tester.pumpAndSettle();
    expect(find.text('Choose an image up to 5MB'), findsOneWidget);
    expect(calls, 0);
  });
  testWidgets('small phone emoji picker does not overflow', (tester) async {
    await show(tester, width: 320, emoji: '\u{1F355}', onChanged: (_) {});
    expect(tester.takeException(), isNull);
  });
}
