import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';
import '../services/api_service.dart';

class ProfileIdentitySection extends StatefulWidget {
  static const enabled = bool.fromEnvironment(
    'OWNER_PROFILE_ACTIVATION_ENABLED',
  );
  final bool canUpload;
  final Future<XFile?> Function()? pickImage;
  const ProfileIdentitySection({
    super.key,
    required this.canUpload,
    this.pickImage,
  });
  @override
  State<ProfileIdentitySection> createState() => _ProfileIdentitySectionState();
}

class _ProfileIdentitySectionState extends State<ProfileIdentitySection> {
  final _upi = TextEditingController();
  Map<String, dynamic>? _setup;
  bool _busy = false;
  bool _upiEdited = false;
  String? _error;
  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void didUpdateWidget(covariant ProfileIdentitySection oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.canUpload && !oldWidget.canUpload) _load();
  }

  @override
  void dispose() {
    _upi.dispose();
    super.dispose();
  }

  Future<void> _run(Future<void> Function() action) async {
    if (_busy) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await action();
    } on DioException catch (e) {
      final payload = e.response?.data;
      final detail = payload is Map ? payload['error'] : null;
      if (mounted) {
        setState(
          () => _error = detail is Map && detail['message'] is String
              ? detail['message'] as String
              : 'Connection failed. Please try again.',
        );
      }
    } catch (_) {
      if (mounted) {
        setState(() => _error = 'Profile update failed. Please try again.');
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _apply(dynamic data, {bool replaceUpi = false}) {
    if (!mounted) return;
    setState(() {
      _setup = Map<String, dynamic>.from(data as Map);
      if (replaceUpi || !_upiEdited) {
        _upi.text = _setup!['businessUpiId'] as String? ?? '';
        _upiEdited = false;
      }
    });
  }

  Future<void> _load() => _run(() async {
    final response = await context.read<ApiService>().get(
      '/owner/restaurant/onboarding',
    );
    _apply(response.data['data']);
  });

  Future<void> _saveUpi() async {
    if (!RegExp(
      r'^[A-Za-z0-9._-]{2,}@[A-Za-z][A-Za-z0-9.-]{1,}$',
    ).hasMatch(_upi.text.trim())) {
      setState(() => _error = 'Enter a valid business UPI ID');
      return;
    }
    await _run(() async {
      final response = await context.read<ApiService>().put(
        '/owner/restaurant/business-upi',
        data: {'businessUpiId': _upi.text.trim()},
      );
      _apply(response.data['data'], replaceUpi: true);
    });
  }

  Future<void> _upload(String field) => _run(() async {
    final api = context.read<ApiService>();
    final image = widget.pickImage != null
        ? await widget.pickImage!()
        : await ImagePicker().pickImage(
            source: ImageSource.gallery,
            maxWidth: 1600,
            imageQuality: 90,
          );
    if (image == null || !mounted) return;
    if (await image.length() > 5 * 1024 * 1024) {
      if (mounted) setState(() => _error = 'Choose an image up to 5MB');
      return;
    }
    final bytes = await image.readAsBytes();
    final subtype = bytes.length >= 3 && bytes[0] == 255 && bytes[1] == 216
        ? 'jpeg'
        : bytes.length >= 8 && bytes[0] == 137 && bytes[1] == 80
        ? 'png'
        : 'webp';
    final response = await api.post(
      '/owner/restaurant/profile-images',
      data: FormData.fromMap({
        field: MultipartFile.fromBytes(
          bytes,
          filename: 'profile.$subtype',
          contentType: DioMediaType('image', subtype),
        ),
      }),
    );
    _apply(response.data['data']);
  });

  Widget _image(String? url, IconData fallback) => url == null
      ? Center(child: Icon(fallback, size: 32))
      : Image.network(
          url,
          fit: BoxFit.cover,
          errorBuilder: (_, error, stack) =>
              Center(child: Icon(fallback, size: 32)),
        );

  @override
  Widget build(BuildContext context) {
    final percent = (_setup?['completionPercent'] as num? ?? 0).toInt();
    final checks = _setup?['required'] as Map? ?? {};
    const labels = {
      'emailVerified': 'Verified email',
      'googleConnected': 'Google connection',
      'ownerPhoto': 'Owner photo',
      'restaurantCover': 'Restaurant cover',
      'restaurantName': 'Restaurant name',
      'restaurantAddress': 'Address',
      'businessUpi': 'Business UPI ID',
    };
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                'Profile $percent%',
                style: Theme.of(context).textTheme.titleMedium,
              ),
            ),
            IconButton(
              tooltip: 'Refresh profile status',
              onPressed: _busy ? null : _load,
              icon: const Icon(Icons.refresh),
            ),
          ],
        ),
        LinearProgressIndicator(value: percent / 100, minHeight: 6),
        const SizedBox(height: 12),
        Text(
          _setup?['orderingEnabled'] == true
              ? 'Ordering active'
              : 'Setup pending',
        ),
        const SizedBox(height: 16),
        ClipRRect(
          borderRadius: BorderRadius.circular(8),
          child: AspectRatio(
            aspectRatio: 16 / 7,
            child: ColoredBox(
              color: Theme.of(context).colorScheme.surfaceContainerHighest,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  _image(
                    _setup?['coverImageUrl'] as String?,
                    Icons.image_outlined,
                  ),
                  Positioned(
                    right: 8,
                    bottom: 8,
                    child: IconButton.filled(
                      tooltip: 'Change restaurant cover',
                      onPressed: _busy || !widget.canUpload
                          ? null
                          : () => _upload('cover'),
                      icon: const Icon(Icons.add_photo_alternate_outlined),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
        const SizedBox(height: 16),
        Row(
          children: [
            SizedBox(
              width: 64,
              height: 64,
              child: ClipOval(
                child: ColoredBox(
                  color: Theme.of(context).colorScheme.surfaceContainerHighest,
                  child: _image(
                    _setup?['ownerPhotoUrl'] as String?,
                    Icons.person_outline,
                  ),
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                'Owner photo',
                style: Theme.of(context).textTheme.titleSmall,
              ),
            ),
            IconButton(
              tooltip: 'Change owner photo',
              onPressed: _busy || !widget.canUpload
                  ? null
                  : () => _upload('ownerPhoto'),
              icon: const Icon(Icons.add_a_photo_outlined),
            ),
          ],
        ),
        const SizedBox(height: 20),
        TextField(
          controller: _upi,
          onChanged: (_) => _upiEdited = true,
          enabled: !_busy && widget.canUpload,
          decoration: const InputDecoration(
            labelText: 'Business UPI ID',
            hintText: 'business@bank',
            prefixIcon: Icon(Icons.account_balance_outlined),
          ),
          autocorrect: false,
          maxLength: 255,
          keyboardType: TextInputType.emailAddress,
        ),
        OutlinedButton.icon(
          onPressed: _busy || !widget.canUpload ? null : _saveUpi,
          icon: const Icon(Icons.save_outlined),
          label: const Text('Save payment details'),
        ),
        if (_busy)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 12),
            child: LinearProgressIndicator(),
          ),
        if (_error != null)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 12),
            child: Text(
              _error!,
              style: TextStyle(color: Theme.of(context).colorScheme.error),
            ),
          ),
        const SizedBox(height: 16),
        ...labels.entries.map(
          (entry) => Padding(
            padding: const EdgeInsets.symmetric(vertical: 5),
            child: Row(
              children: [
                Icon(
                  checks[entry.key] == true
                      ? Icons.check_circle_outline
                      : Icons.radio_button_unchecked,
                  size: 18,
                  color: checks[entry.key] == true
                      ? Colors.green.shade700
                      : Theme.of(context).colorScheme.outline,
                ),
                const SizedBox(width: 10),
                Expanded(child: Text(entry.value)),
              ],
            ),
          ),
        ),
        const SizedBox(height: 24),
        const Divider(),
        const SizedBox(height: 16),
      ],
    );
  }
}
