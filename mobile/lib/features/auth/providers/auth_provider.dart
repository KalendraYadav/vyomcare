import 'dart:convert';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:vyomcare_mobile/core/network/api_client.dart';
import 'package:vyomcare_mobile/core/storage/secure_storage_service.dart';
import 'package:vyomcare_mobile/core/errors/api_error.dart';
import 'package:vyomcare_mobile/models/domain_models.dart';

// Providers
final secureStorageProvider = Provider<SecureStorageService>((ref) {
  return SecureStorageService();
});

final apiClientProvider = Provider<ApiClient>((ref) {
  final storage = ref.watch(secureStorageProvider);
  return ApiClient(storageService: storage);
});

final serverUrlProvider = StateProvider<String>((ref) {
  final client = ref.watch(apiClientProvider);
  return client.currentBaseUrl;
});

// Authentication State
class AuthState {
  final bool isLoading;
  final AuthUser? user;
  final String? errorMessage;

  const AuthState({
    this.isLoading = false,
    this.user,
    this.errorMessage,
  });

  bool get isAuthenticated => user != null;

  AuthState copyWith({
    bool? isLoading,
    AuthUser? user,
    String? errorMessage,
  }) {
    return AuthState(
      isLoading: isLoading ?? this.isLoading,
      user: user ?? this.user,
      errorMessage: errorMessage,
    );
  }
}

class AuthNotifier extends StateNotifier<AuthState> {
  final ApiClient _apiClient;
  final SecureStorageService _storageService;
  final Ref _ref;

  AuthNotifier(this._apiClient, this._storageService, this._ref) : super(const AuthState(isLoading: true)) {
    checkInitialAuth();
  }

  Future<void> checkInitialAuth() async {
    try {
      await _apiClient.initBaseUrl();
      _ref.read(serverUrlProvider.notifier).state = _apiClient.currentBaseUrl;

      final token = await _storageService.getAccessToken();
      final userJson = await _storageService.getUserJson();

      if (token != null && token.isNotEmpty && userJson != null) {
        try {
          final userMap = jsonDecode(userJson) as Map<String, dynamic>;
          final user = AuthUser.fromJson(userMap);
          state = AuthState(isLoading: false, user: user);
          return;
        } catch (_) {}
      }

      state = const AuthState(isLoading: false, user: null);
    } catch (_) {
      state = const AuthState(isLoading: false, user: null);
    }
  }

  Future<bool> login(String email, String password) async {
    state = state.copyWith(isLoading: true, errorMessage: null);

    try {
      final response = await _apiClient.post<Map<String, dynamic>>(
        '/auth/login',
        data: {'email': email, 'password': password},
      );

      final data = response.data;
      if (data == null || !data.containsKey('accessToken') || !data.containsKey('user')) {
        throw ApiError(
          status: 500,
          message: 'Invalid response from server.',
          code: ApiErrorCode.serverError,
        );
      }

      final accessToken = data['accessToken'] as String;
      final user = AuthUser.fromJson(data['user'] as Map<String, dynamic>);

      await _storageService.saveAccessToken(accessToken);
      await _storageService.saveUserJson(jsonEncode(user.toJson()));

      state = AuthState(isLoading: false, user: user);
      return true;
    } on ApiError catch (e) {
      state = state.copyWith(isLoading: false, errorMessage: e.userFriendlyMessage);
      return false;
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        errorMessage: 'Authentication failed. Please check network connection.',
      );
      return false;
    }
  }

  Future<void> logout() async {
    try {
      await _apiClient.post('/auth/logout');
    } catch (_) {}

    await _storageService.clearAccessToken();
    await _storageService.clearUserJson();
    state = const AuthState(isLoading: false, user: null);
  }
}

final authStateProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  final apiClient = ref.watch(apiClientProvider);
  final storage = ref.watch(secureStorageProvider);
  return AuthNotifier(apiClient, storage, ref);
});
