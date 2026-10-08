import 'package:flutter/services.dart';

class QrSaveService {
  static const channel = MethodChannel('restroqr/qr_storage');

  static Future<String?> save(Uint8List bytes, String name) async {
    const signature = [137, 80, 78, 71, 13, 10, 26, 10];
    if (bytes.length < signature.length ||
        !List.generate(
          signature.length,
          (i) => bytes[i] == signature[i],
        ).every((matches) => matches)) {
      throw const FormatException(
        'The server did not return a valid QR image.',
      );
    }
    final cleaned = name.replaceAll(RegExp(r'[^a-zA-Z0-9_-]'), '_');
    final safeName = cleaned.isEmpty
        ? 'QR'
        : cleaned.substring(0, cleaned.length > 60 ? 60 : cleaned.length);
    final result = await channel.invokeMapMethod<String, dynamic>('saveQr', {
      'bytes': bytes,
      'fileName':
          'RestroQR_${safeName}_${DateTime.now().millisecondsSinceEpoch}.png',
    });
    if (result == null) return null; // User cancelled the system save dialog.
    if (result['uri'] is! String || (result['uri'] as String).isEmpty) {
      throw const FormatException('Could not confirm the saved QR image.');
    }
    return result['gallery'] == true
        ? 'QR saved to Gallery / Pictures / RestroQR'
        : 'QR saved to your selected folder';
  }
}
