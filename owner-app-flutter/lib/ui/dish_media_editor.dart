import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

class DishMediaDraft {
  final Uint8List? bytes;
  final String? emoji;
  final String? subtype;
  const DishMediaDraft({this.bytes, this.emoji, this.subtype});
}

class DishMediaEditor extends StatefulWidget {
  static const enabled = bool.fromEnvironment('MENU_MEDIA_ENABLED');
  final String? imageUrl;
  final String? emoji;
  final bool busy;
  final ValueChanged<DishMediaDraft> onChanged;
  final Future<XFile?> Function()? pickImage;
  const DishMediaEditor({
    super.key,
    this.imageUrl,
    this.emoji,
    required this.busy,
    required this.onChanged,
    this.pickImage,
  });
  @override
  State<DishMediaEditor> createState() => _DishMediaEditorState();
}

class _DishMediaEditorState extends State<DishMediaEditor> {
  late String _mode;
  String? _emoji;
  Uint8List? _bytes;
  String? _error;
  bool _picking = false;
  static const emojis = [
    '\u{1F355}',
    '\u{1F354}',
    '\u{1F35F}',
    '\u{1F32E}',
    '\u{1F35C}',
    '\u{1F35B}',
    '\u{1F957}',
    '\u{1F96A}',
    '\u{1F370}',
    '\u{1F366}',
    '\u{2615}',
    '\u{1F964}',
  ];

  @override
  void initState() {
    super.initState();
    _emoji = widget.emoji;
    _mode = widget.imageUrl != null
        ? 'photo'
        : widget.emoji != null
        ? 'emoji'
        : 'none';
  }

  Future<void> _pick() async {
    setState(() {
      _picking = true;
      _error = null;
    });
    try {
      final image = widget.pickImage != null
          ? await widget.pickImage!()
          : await ImagePicker().pickImage(
              source: ImageSource.gallery,
              maxWidth: 1200,
              imageQuality: 90,
            );
      if (image == null || !mounted) return;
      if (await image.length() > 5 * 1024 * 1024) {
        if (mounted) setState(() => _error = 'Choose an image up to 5MB');
        return;
      }
      final b = await image.readAsBytes();
      if (!mounted) return;
      final jpeg = b.length >= 3 && b[0] == 255 && b[1] == 216 && b[2] == 255;
      final png =
          b.length >= 8 &&
          b[0] == 137 &&
          b[1] == 80 &&
          b[2] == 78 &&
          b[3] == 71;
      final webp =
          b.length >= 12 &&
          String.fromCharCodes(b.take(4)) == 'RIFF' &&
          String.fromCharCodes(b.skip(8).take(4)) == 'WEBP';
      if (!jpeg && !png && !webp) {
        setState(() => _error = 'Choose a JPEG, PNG or WebP image');
        return;
      }
      final subtype = jpeg
          ? 'jpeg'
          : png
          ? 'png'
          : 'webp';
      setState(() {
        _bytes = b;
        _mode = 'photo';
      });
      widget.onChanged(DishMediaDraft(bytes: b, subtype: subtype));
    } catch (_) {
      if (mounted) {
        setState(() => _error = 'Could not open photo. Please try again.');
      }
    } finally {
      if (mounted) setState(() => _picking = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final disabled = widget.busy || _picking;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text('Dish appearance', style: Theme.of(context).textTheme.titleSmall),
        const SizedBox(height: 8),
        SegmentedButton<String>(
          showSelectedIcon: false,
          segments: const [
            ButtonSegment(
              value: 'photo',
              label: Text('Photo'),
              icon: Icon(Icons.photo_outlined),
            ),
            ButtonSegment(
              value: 'emoji',
              label: Text('Emoji'),
              icon: Icon(Icons.emoji_emotions_outlined),
            ),
            ButtonSegment(
              value: 'none',
              label: Text('None'),
              icon: Icon(Icons.hide_image_outlined),
            ),
          ],
          selected: {_mode},
          onSelectionChanged: disabled
              ? null
              : (value) {
                  final mode = value.first;
                  if (mode == 'photo') {
                    _pick();
                    return;
                  }
                  setState(() {
                    _mode = mode;
                    _error = null;
                  });
                  if (mode == 'emoji') {
                    _emoji ??= emojis.first;
                    widget.onChanged(DishMediaDraft(emoji: _emoji));
                  } else {
                    widget.onChanged(const DishMediaDraft());
                  }
                },
        ),
        const SizedBox(height: 12),
        if (_mode == 'photo')
          SizedBox(
            height: 144,
            child: Stack(
              fit: StackFit.expand,
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(8),
                  child: _bytes != null
                      ? Image.memory(
                          _bytes!,
                          fit: BoxFit.cover,
                          errorBuilder: (_, error, stack) =>
                              const Icon(Icons.broken_image_outlined),
                        )
                      : widget.imageUrl != null
                      ? Image.network(
                          widget.imageUrl!,
                          fit: BoxFit.cover,
                          errorBuilder: (_, error, stack) =>
                              const Icon(Icons.broken_image_outlined),
                        )
                      : const Icon(Icons.photo_outlined),
                ),
                Positioned(
                  right: 8,
                  bottom: 8,
                  child: IconButton.filled(
                    tooltip: 'Choose dish photo',
                    onPressed: disabled ? null : _pick,
                    icon: _picking
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.add_photo_alternate_outlined),
                  ),
                ),
              ],
            ),
          ),
        if (_mode == 'emoji')
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final emoji in {...emojis, ?_emoji})
                SizedBox(
                  width: 44,
                  height: 44,
                  child: IconButton(
                    tooltip: 'Use $emoji',
                    isSelected: _emoji == emoji,
                    style: IconButton.styleFrom(
                      backgroundColor: _emoji == emoji
                          ? Theme.of(context).colorScheme.secondaryContainer
                          : null,
                    ),
                    onPressed: disabled
                        ? null
                        : () {
                            setState(() => _emoji = emoji);
                            widget.onChanged(DishMediaDraft(emoji: emoji));
                          },
                    icon: Text(emoji, style: const TextStyle(fontSize: 25)),
                  ),
                ),
            ],
          ),
        if (_error != null)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Text(
              _error!,
              style: TextStyle(color: Theme.of(context).colorScheme.error),
            ),
          ),
        const SizedBox(height: 24),
      ],
    );
  }
}
