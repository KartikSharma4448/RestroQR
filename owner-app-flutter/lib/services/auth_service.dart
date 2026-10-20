import 'dart:async';
import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import '../models/auth_models.dart';
import 'api_service.dart';
import 'notification_handler.dart';
import 'google_identity_service.dart';

class AuthService extends ChangeNotifier {
  final ApiService _apiService;
  NotificationHandler? _notificationHandler;
  UserData? _currentUser;
  bool _isAuthenticated = false;
  bool _isLoading = false;
  String? _error;
  bool _notificationsStarted = false;
  static const emailSignupEnabled = bool.fromEnvironment(
    'OWNER_EMAIL_SIGNUP_ENABLED',
  );
  String? _signupChallenge;
  String? _onboardingToken;
  bool _googleConnectionRequired = false;
  final Future<String?> Function() _googleTokenProvider;

  AuthService(
    this._apiService, {
    Future<String?> Function()? googleTokenProvider,
  }) : _googleTokenProvider =
           googleTokenProvider ?? GoogleIdentityService.requestToken {
    _apiService.onUnauthorized = _expireSession;
  }

  /// Set the notification handler for FCM token unregistration on logout.
  set notificationHandler(NotificationHandler handler) {
    _notificationHandler = handler;
  }

  UserData? get currentUser => _currentUser;
  bool get isAuthenticated => _isAuthenticated;
  bool get isLoading => _isLoading;
  String? get error => _error;
  bool get hasPendingSignup => _signupChallenge != null;
  bool get googleConnectionRequired => _googleConnectionRequired;

  Future<bool> resendSignupCode() async {
    if (_isLoading || _signupChallenge == null) return false;
    _isLoading = true;
    _error = null;
    notifyListeners();
    try {
      final response = await _apiService.post(
        '/auth/register/resend',
        data: {'challengeId': _signupChallenge},
      );
      return response.data['success'] == true;
    } on DioException catch (e) {
      _error = _extractError(e);
      return false;
    } catch (_) {
      _error = 'Code could not be sent. Please try again.';
      return false;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> verifySignupCode(String code) async {
    if (_isLoading || _signupChallenge == null) return false;
    _isLoading = true;
    _error = null;
    notifyListeners();
    try {
      final response = await _apiService.post(
        '/auth/register/verify',
        data: {'challengeId': _signupChallenge, 'code': code},
      );
      if (response.data['success'] != true) {
        _error = 'Email verification failed';
        return false;
      }
      final data = AuthData.fromRegisterJson(response.data['data']);
      await _apiService.setToken(data.token);
      _currentUser = data.user;
      _isAuthenticated = true;
      _googleConnectionRequired = true;
      _onboardingToken = data.token;
      _signupChallenge = null;
      return true;
    } on DioException catch (e) {
      _error = _extractError(e);
      return false;
    } catch (_) {
      _error = 'Email verification could not finish. Please try again.';
      return false;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> signInWithGoogle({bool link = false}) async {
    if (_isLoading) return false;
    final session = await _apiService.getToken();
    if (link && !_isAuthenticated) return false;
    _isLoading = true;
    _error = null;
    notifyListeners();
    try {
      final token = await _googleTokenProvider();
      if (token == null) return false;
      if (await _apiService.getToken() != session) return false;
      final response = await _apiService.post(
        link ? '/auth/google/link' : '/auth/google/login',
        data: {'idToken': token},
      );
      if (await _apiService.getToken() != session) return false;
      if (response.data['success'] != true) {
        _error = response.data['error']?['message'] ?? 'Google sign-in failed';
        return false;
      }
      if (!link) {
        final data = AuthData.fromLoginJson(response.data['data']);
        if (data.user.role != 'owner') {
          _error = 'An owner account is required';
          return false;
        }
        await _apiService.setToken(data.token);
        _currentUser = data.user;
        _isAuthenticated = true;
        _startNotifications();
      } else {
        _googleConnectionRequired = false;
        _onboardingToken = session;
        _startNotifications();
      }
      return true;
    } on DioException catch (e) {
      _error = _extractError(e);
      return false;
    } catch (_) {
      _error = 'Google sign-in could not finish. Please try again.';
      return false;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> checkAuthStatus() async {
    final token = await _apiService.getToken();
    var valid = false;
    try {
      if (token != null && token.split('.').length == 3) {
        // This is a local expiry check; the API still verifies the signature.
        final payload = jsonDecode(
          utf8.decode(
            base64Url.decode(base64Url.normalize(token.split('.')[1])),
          ),
        );
        valid =
            payload is Map &&
            payload['role'] == 'owner' &&
            payload['sub'] is String &&
            payload['exp'] is num &&
            payload['exp'] > DateTime.now().millisecondsSinceEpoch / 1000;
      }
    } catch (_) {}
    if (!valid && token != null) await _apiService.clearToken();
    if (!valid && _notificationsStarted) {
      _notificationsStarted = false;
      _notificationHandler?.stop();
    }
    if (_isAuthenticated != valid) {
      _isAuthenticated = valid;
      if (!valid) _currentUser = null;
      notifyListeners();
    }
    if (!valid) {
      _onboardingToken = null;
      _googleConnectionRequired = false;
    } else if (emailSignupEnabled && _onboardingToken != token) {
      try {
        final response = await _apiService.get('/auth/onboarding');
        if (await _apiService.getToken() != token) return;
        final required =
            response.data['data']['googleConnectionRequired'] == true;
        _onboardingToken = token;
        if (_googleConnectionRequired != required) {
          _googleConnectionRequired = required;
          notifyListeners();
        }
      } catch (_) {
        _googleConnectionRequired = true;
        _onboardingToken = token;
        _error = 'Account setup could not be checked. Please sign in again.';
        notifyListeners();
      }
    }
    if (valid && !_googleConnectionRequired) _startNotifications();
  }

  void _startNotifications() {
    if (_notificationsStarted || _notificationHandler == null) return;
    _notificationsStarted = true;
    unawaited(
      _notificationHandler!.initialize().catchError((Object error) {
        _notificationsStarted = false;
        debugPrint('Notification setup failed: $error');
      }),
    );
  }

  Future<void> _expireSession() async {
    _onboardingToken = null;
    _googleConnectionRequired = false;
    _notificationsStarted = false;
    _notificationHandler?.stop();
    _currentUser = null;
    _isAuthenticated = false;
    _error = 'Your session expired. Please sign in again.';
    notifyListeners();
  }

  @override
  void dispose() {
    _apiService.onUnauthorized = null;
    _notificationHandler?.stop();
    super.dispose();
  }

  Future<bool> login(LoginRequest request) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final response = await _apiService.post(
        '/auth/login',
        data: request.toJson(),
      );

      final data = response.data;
      if (data['success'] == true) {
        final authData = AuthData.fromLoginJson(data['data']);
        await _apiService.setToken(authData.token);
        _currentUser = authData.user;
        _isAuthenticated = true;
        _startNotifications();
        _isLoading = false;
        notifyListeners();
        return true;
      } else {
        _error = data['error']?['message'] ?? 'Login failed';
        _isLoading = false;
        notifyListeners();
        return false;
      }
    } on DioException catch (e) {
      _error = _extractError(e);
      _isLoading = false;
      notifyListeners();
      return false;
    } catch (e) {
      _error = 'Network error. Please check your connection.';
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  Future<bool> register(RegisterRequest request) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final response = await _apiService.post(
        '/auth/register',
        data: request.toJson(),
      );

      final data = response.data;
      if (data['success'] == true) {
        if (data['data']['verificationRequired'] == true) {
          _signupChallenge = data['data']['challengeId'] as String;
          _isLoading = false;
          notifyListeners();
          return true;
        }
        final authData = AuthData.fromRegisterJson(data['data']);
        await _apiService.setToken(authData.token);
        _currentUser = authData.user;
        _isAuthenticated = true;
        _startNotifications();
        _isLoading = false;
        notifyListeners();
        return true;
      } else {
        _error = data['error']?['message'] ?? 'Registration failed';
        _isLoading = false;
        notifyListeners();
        return false;
      }
    } on DioException catch (e) {
      _error = _extractError(e);
      _isLoading = false;
      notifyListeners();
      return false;
    } catch (e) {
      _error = 'Network error. Please check your connection.';
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  Future<void> logout() async {
    _signupChallenge = null;
    _onboardingToken = null;
    _googleConnectionRequired = false;
    // Unregister FCM token before clearing auth state
    if (_notificationHandler != null) {
      await _notificationHandler!.unregister();
    }
    await _apiService.clearToken();
    _currentUser = null;
    _isAuthenticated = false;
    _notificationsStarted = false;
    notifyListeners();
  }

  void clearError() {
    _error = null;
    notifyListeners();
  }

  String _extractError(DioException e) {
    if (e.type == DioExceptionType.connectionTimeout ||
        e.type == DioExceptionType.receiveTimeout ||
        e.type == DioExceptionType.connectionError) {
      return 'Network error. Please check your connection.';
    }
    if (e.response?.data is Map) {
      final data = e.response!.data as Map;
      if (data['error'] != null && data['error']['message'] != null) {
        return data['error']['message'];
      }
    }
    return 'An unexpected error occurred';
  }
}
