import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:restroqr_owner/ui/dish_options_editor.dart';
import 'package:restroqr_owner/models/order_item_model.dart';
import 'package:restroqr_owner/ui/app_theme.dart';

void main() {
  setUpAll(() async {
    final fonts = FontLoader('Roboto');
    for (final weight in ['regular', 'medium', 'bold']) {
      fonts.addFont(rootBundle.load('assets/fonts/roboto-$weight.ttf'));
    }
    await fonts.load();
    final icons = FontLoader('MaterialIcons')
      ..addFont(rootBundle.load('fonts/MaterialIcons-Regular.otf'));
    await icons.load();
  });
  Future<void> show(
    WidgetTester tester,
    ValueChanged<Map<String, dynamic>> changed, {
    Map<String, dynamic>? initial,
    double width = 390,
  }) async {
    tester.view.physicalSize = Size(width, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.pumpWidget(
      MaterialApp(
        debugShowCheckedModeBanner: false,
        theme: ownerTheme(),
        home: Scaffold(
          body: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Form(
              child: DishOptionsEditor(
                initial: initial,
                busy: false,
                onChanged: changed,
              ),
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
  }

  testWidgets('adds sizes and free add-ons and preserves stable existing IDs', (
    tester,
  ) async {
    Map<String, dynamic>? changed;
    await show(
      tester,
      (value) => changed = value,
      initial: {
        'variants': [
          {'id': 'size-id', 'name': 'Small', 'price': '100.00'},
        ],
        'addOns': [],
      },
    );
    await tester.enterText(find.byType(TextFormField).at(1), '120');
    expect(changed!['variants'][0]['id'], 'size-id');
    await tester.tap(find.text('Add add-on'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextFormField).at(2), 'No spice');
    await tester.enterText(find.byType(TextFormField).at(3), '0');
    expect(changed!['addOns'][0], containsPair('price', '0'));
    expect(tester.state<FormState>(find.byType(Form)).validate(), isTrue);
  });
  testWidgets('invalid names and fractional prices cannot save', (
    tester,
  ) async {
    await show(tester, (_) {});
    await tester.tap(find.text('Add size'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextFormField).at(1), '1.001');
    expect(tester.state<FormState>(find.byType(Form)).validate(), isFalse);
    await tester.pumpAndSettle();
    expect(find.text('Name is required'), findsOneWidget);
    expect(find.text('Invalid price'), findsOneWidget);
  });
  testWidgets('availability and removal update options on a small screen', (
    tester,
  ) async {
    Map<String, dynamic>? changed;
    await show(
      tester,
      (value) => changed = value,
      width: 320,
      initial: {
        'variants': [
          {'id': 'size-id', 'name': 'Large', 'price': '200.00'},
        ],
        'addOns': [],
      },
    );
    await tester.tap(find.byType(Switch));
    await tester.pumpAndSettle();
    expect(changed!['variants'][0]['isAvailable'], isFalse);
    await tester.tap(find.byTooltip('Remove size'));
    await tester.pumpAndSettle();
    expect(changed!['variants'], isEmpty);
    expect(tester.takeException(), isNull);
  });
  test('owner order details preserve selected option names and line price', () {
    final item = OrderItemData.fromJson({
      'itemName': 'Pizza',
      'itemPrice': '200.50',
      'quantity': 2,
      'optionSummary': 'Large, + Cheese',
    });
    expect(item.optionSummary, 'Large, + Cheese');
    expect(item.itemPrice * item.quantity, 401);
    expect(
      OrderItemData.fromJson(item.toJson()).optionSummary,
      item.optionSummary,
    );
  });
  testWidgets('sizes and add-ons have a mobile visual baseline', (
    tester,
  ) async {
    await show(
      tester,
      (_) {},
      initial: {
        'variants': [
          {'id': 'small', 'name': 'Small', 'price': '100.00'},
          {'id': 'large', 'name': 'Large', 'price': '180.00'},
        ],
        'addOns': [
          {'id': 'cheese', 'name': 'Extra cheese', 'price': '20.00'},
        ],
      },
    );
    await expectLater(
      find.byType(MaterialApp),
      matchesGoldenFile('goldens/dish_options.png'),
    );
  });
}
