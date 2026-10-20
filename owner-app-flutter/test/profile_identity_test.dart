import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';
import 'package:restroqr_owner/services/api_service.dart';
import 'package:restroqr_owner/ui/app_theme.dart';
import 'package:restroqr_owner/ui/profile_identity_section.dart';
import 'session_recovery_test.dart' show MemoryApi;

class ProfileApi extends MemoryApi {
  String? putPath;
  dynamic putBody;
  String? postPath;
  dynamic postBody;
  int gets = 0;
  bool fail = false;
  Map<String, dynamic> setup = {
    'restaurantId': 'restaurant-id',
    'completionPercent': 57,
    'orderingEnabled': false,
    'businessUpiId': null,
    'ownerPhotoUrl': null,
    'coverImageUrl': null,
    'required': {
      'emailVerified': true,
      'googleConnected': true,
      'ownerPhoto': false,
      'restaurantCover': false,
      'restaurantName': true,
      'restaurantAddress': true,
      'businessUpi': false,
    },
  };
  Response reply(String path) => Response(
    requestOptions: RequestOptions(path: path),
    data: {'success': true, 'data': setup},
  );
  @override
  Future<Response> get(
    String path, {
    Map<String, dynamic>? queryParameters,
  }) async {
    gets++;
    if (fail) throw DioException(requestOptions: RequestOptions(path: path));
    return reply(path);
  }

  @override
  Future<Response> put(String path, {dynamic data}) async {
    putPath = path;
    putBody = data;
    setup = {...setup, 'businessUpiId': data['businessUpiId']};
    return reply(path);
  }

  @override
  Future<Response> post(String path, {dynamic data}) async {
    postPath = path;
    postBody = data;
    return reply(path);
  }
}

Future<void> showProfile(
  WidgetTester tester,
  ProfileApi api, {
  bool canUpload = true,
  Future<XFile?> Function()? pick,
  double scale = 1,
}) async {
  await tester.pumpWidget(
    Provider<ApiService>.value(
      value: api,
      child: MaterialApp(
        debugShowCheckedModeBanner: false,
        theme: ownerTheme(),
        builder: (context, child) => MediaQuery(
          data: MediaQuery.of(
            context,
          ).copyWith(textScaler: TextScaler.linear(scale)),
          child: child!,
        ),
        home: Scaffold(
          appBar: AppBar(title: const Text('Restaurant identity')),
          body: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ProfileIdentitySection(
              canUpload: canUpload,
              pickImage: pick,
            ),
          ),
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUpAll(() async {
    final fonts = FontLoader('Roboto');
    for (final name in ['regular', 'medium', 'bold']) {
      fonts.addFont(rootBundle.load('assets/fonts/roboto-$name.ttf'));
    }
    await fonts.load();
    final icons = FontLoader('MaterialIcons')
      ..addFont(rootBundle.load('fonts/MaterialIcons-Regular.otf'));
    await icons.load();
  });
  testWidgets('shows server completion and saves a valid business UPI', (
    tester,
  ) async {
    final api = ProfileApi();
    await showProfile(tester, api);
    expect(find.text('Profile 57%'), findsOneWidget);
    await tester.enterText(find.byType(TextField), 'cafe@bank');
    await tester.ensureVisible(find.text('Save payment details'));
    await tester.tap(find.text('Save payment details'));
    await tester.pumpAndSettle();
    expect(api.putPath, '/owner/restaurant/business-upi');
    expect(api.putBody, {'businessUpiId': 'cafe@bank'});
  });
  testWidgets('rejects a UPI URL without sending it', (tester) async {
    final api = ProfileApi();
    await showProfile(tester, api);
    await tester.enterText(find.byType(TextField), 'upi://pay?pa=cafe@bank');
    await tester.ensureVisible(find.text('Save payment details'));
    await tester.tap(find.text('Save payment details'));
    await tester.pumpAndSettle();
    expect(api.putPath, isNull);
    expect(find.text('Enter a valid business UPI ID'), findsOneWidget);
  });
  testWidgets('uploads the selected owner image as multipart, not a path', (
    tester,
  ) async {
    final api = ProfileApi();
    await showProfile(
      tester,
      api,
      pick: () async => XFile.fromData(
        Uint8List.fromList([255, 216, 255, 224, 0, 0, 0, 0, 0, 0, 0, 0]),
        name: 'owner.jpg',
      ),
    );
    await tester.tap(find.byTooltip('Change owner photo'));
    await tester.pumpAndSettle();
    expect(api.postPath, '/owner/restaurant/profile-images');
    expect((api.postBody as FormData).files.single.key, 'ownerPhoto');
  });
  testWidgets('picker cancellation performs no upload', (tester) async {
    final api = ProfileApi();
    await showProfile(tester, api, pick: () async => null);
    await tester.tap(find.byTooltip('Change restaurant cover'));
    await tester.pumpAndSettle();
    expect(api.postPath, isNull);
  });
  testWidgets('uploads the selected restaurant cover using the cover field', (
    tester,
  ) async {
    final api = ProfileApi();
    await showProfile(
      tester,
      api,
      pick: () async => XFile.fromData(
        Uint8List.fromList([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]),
        name: 'cover.png',
      ),
    );
    await tester.tap(find.byTooltip('Change restaurant cover'));
    await tester.pumpAndSettle();
    final file = (api.postBody as FormData).files.single;
    expect(file.key, 'cover');
    expect(file.value.contentType.toString(), 'image/png');
    expect(api.postPath, '/owner/restaurant/profile-images');
  });
  testWidgets('oversized photo is rejected without an API upload', (
    tester,
  ) async {
    final api = ProfileApi();
    await showProfile(
      tester,
      api,
      pick: () async => XFile.fromData(
        Uint8List(5 * 1024 * 1024 + 1),
        name: 'large.png',
      ),
    );
    await tester.tap(find.byTooltip('Change owner photo'));
    await tester.pumpAndSettle();
    expect(api.postPath, isNull);
    expect(find.text('Choose an image up to 5MB'), findsOneWidget);
  });
  testWidgets('image upload preserves unsaved payment details', (tester) async {
    final api = ProfileApi();
    await showProfile(
      tester,
      api,
      pick: () async => XFile.fromData(
        Uint8List.fromList([255, 216, 255, 224, 0, 0, 0, 0, 0, 0, 0, 0]),
        name: 'owner.jpg',
      ),
    );
    await tester.enterText(find.byType(TextField), 'draft@bank');
    await tester.tap(find.byTooltip('Change owner photo'));
    await tester.pumpAndSettle();
    expect(
      tester.widget<TextField>(find.byType(TextField)).controller!.text,
      'draft@bank',
    );
  });
  testWidgets('unsaved restaurant cannot upload images', (tester) async {
    await showProfile(tester, ProfileApi(), canUpload: false);
    expect(
      tester
          .widget<IconButton>(
            find.byWidgetPredicate(
              (widget) =>
                  widget is IconButton &&
                  widget.tooltip == 'Change owner photo',
            ),
          )
          .onPressed,
      isNull,
    );
  });
  testWidgets('profile load error can be retried', (tester) async {
    final api = ProfileApi()..fail = true;
    await showProfile(tester, api);
    expect(find.text('Connection failed. Please try again.'), findsOneWidget);
    api.fail = false;
    await tester.tap(find.byTooltip('Refresh profile status'));
    await tester.pumpAndSettle();
    expect(find.text('Profile 57%'), findsOneWidget);
  });
  testWidgets('identity layout has a mobile visual baseline', (tester) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await showProfile(tester, ProfileApi());
    expect(tester.takeException(), isNull);
    await expectLater(
      find.byType(MaterialApp),
      matchesGoldenFile('goldens/profile_identity.png'),
    );
  });
  testWidgets('identity layout fits a small phone with enlarged text', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(320, 640);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await showProfile(tester, ProfileApi(), scale: 1.5);
    expect(tester.takeException(), isNull);
  });
}
