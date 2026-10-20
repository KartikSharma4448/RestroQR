import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:restroqr_owner/services/qr_save_service.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  testWidgets('native Android save publishes a PNG to the gallery', (
    tester,
  ) async {
    // A valid tiny PNG exercises storage without connecting to any restaurant API.
    final png = base64Decode(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3ioAAAAASUVORK5CYII=',
    );
    final message = await QrSaveService.save(png, 'GallerySmokeTest');
    expect(message, contains('Gallery'));
  });
}
