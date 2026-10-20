import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:google_sign_in/google_sign_in.dart';

class GoogleIdentityService {
  static const enabled = bool.fromEnvironment('GOOGLE_OWNER_AUTH_ENABLED');

  static Future<String?> requestToken() async {
    if (Firebase.apps.isEmpty) throw StateError('Firebase is not configured');
    final google = GoogleSignIn(scopes: ['email']);
    final auth = FirebaseAuth.instance;
    try {
      // Always show account selection instead of silently linking a cached account.
      await google.signOut();
      final account = await google.signIn();
      if (account == null) return null;
      final tokens = await account.authentication;
      final result = await auth.signInWithCredential(
        GoogleAuthProvider.credential(
          idToken: tokens.idToken,
          accessToken: tokens.accessToken,
        ),
      );
      final token = await result.user?.getIdToken(true);
      if (token == null) throw StateError('Google verification did not finish');
      return token;
    } finally {
      // Firebase is a short-lived proof; the backend JWT remains the app session.
      try {
        await auth.signOut();
      } catch (_) {}
      try {
        await google.signOut();
      } catch (_) {}
    }
  }
}
