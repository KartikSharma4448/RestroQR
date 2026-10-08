import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:restroqr_owner/services/qr_save_service.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  final messenger =
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger;
  final png = Uint8List.fromList([137, 80, 78, 71, 13, 10, 26, 10]);
  tearDown(
    () => messenger.setMockMethodCallHandler(QrSaveService.channel, null),
  );

  test(
    'saves PNG bytes with a safe unique filename and reports gallery success',
    () async {
      messenger.setMockMethodCallHandler(QrSaveService.channel, (call) async {
        expect(call.method, 'saveQr');
        expect(call.arguments['bytes'], png);
        expect(
          call.arguments['fileName'],
          matches(r'^RestroQR_[A-Za-z0-9_-]+_\d+\.png$'),
        );
        return {
          'uri': 'content://media/external/images/media/1',
          'gallery': true,
        };
      });
      expect(
        await QrSaveService.save(png, '../Table / 1'),
        contains('Gallery'),
      );
    },
  );
  test('cancelled save does not report success', () async {
    messenger.setMockMethodCallHandler(
      QrSaveService.channel,
      (_) async => null,
    );
    expect(await QrSaveService.save(png, 'Table'), isNull);
  });
  test(
    'legacy system picker reports the selected folder, not gallery',
    () async {
      messenger.setMockMethodCallHandler(
        QrSaveService.channel,
        (_) async => {'uri': 'content://documents/1', 'gallery': false},
      );
      expect(
        await QrSaveService.save(png, 'Table'),
        contains('selected folder'),
      );
    },
  );
  test('invalid image never reaches native save', () async {
    messenger.setMockMethodCallHandler(
      QrSaveService.channel,
      (_) async => fail('Must not save invalid bytes'),
    );
    await expectLater(
      QrSaveService.save(Uint8List.fromList([1, 2, 3]), 'Table'),
      throwsFormatException,
    );
  });
  test('native failures are propagated instead of reporting success', () async {
    messenger.setMockMethodCallHandler(
      QrSaveService.channel,
      (_) async => throw PlatformException(code: 'SAVE_FAILED'),
    );
    await expectLater(
      QrSaveService.save(png, 'Table'),
      throwsA(isA<PlatformException>()),
    );
  });
}
