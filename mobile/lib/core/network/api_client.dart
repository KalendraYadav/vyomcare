import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:dio/dio.dart';
import '../config/app_config.dart';
import '../storage/secure_storage_service.dart';
import '../errors/api_error.dart';

class ApiClient {
  late final Dio _dio;
  final SecureStorageService _storageService;
  String _baseUrl = AppConfig.defaultBaseUrl;

  ApiClient({SecureStorageService? storageService})
      : _storageService = storageService ?? SecureStorageService() {
    _dio = Dio(
      BaseOptions(
        baseUrl: _baseUrl,
        connectTimeout: AppConfig.connectTimeout,
        receiveTimeout: AppConfig.receiveTimeout,
        sendTimeout: AppConfig.sendTimeout,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      ),
    );

    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final token = await _storageService.getAccessToken();
          if (token != null && token.isNotEmpty) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          return handler.next(options);
        },
        onError: (DioException e, handler) async {
          final statusCode = e.response?.statusCode ?? 0;
          final responseData = e.response?.data;
          final host = e.requestOptions.uri.host;
          final port = e.requestOptions.uri.hasPort ? ':${e.requestOptions.uri.port}' : '';

          String message = 'Network connection failed.';
          ApiError customError;

          if (responseData is Map && responseData.containsKey('message')) {
            final msg = responseData['message'];
            if (msg is List) {
              message = msg.join(', ');
            } else if (msg is String) {
              message = msg;
            }
            customError = ApiError.fromStatusCode(statusCode, message, responseData);
          } else if (e.type == DioExceptionType.connectionTimeout ||
                     e.type == DioExceptionType.receiveTimeout ||
                     e.type == DioExceptionType.sendTimeout) {
            message = 'Connection timed out reaching $host$port. Check IP address & Wi-Fi.';
            customError = ApiError.network(message, code: ApiErrorCode.timeout);
          } else if (e.type == DioExceptionType.connectionError) {
            final errString = e.error?.toString().toLowerCase() ?? '';
            if (errString.contains('refused') || errString.contains('econnrefused')) {
              message = 'Connection refused by $host$port. Ensure NestJS backend is running and listening on 0.0.0.0.';
              customError = ApiError.network(message, code: ApiErrorCode.connectionRefused);
            } else if (errString.contains('unreach') || errString.contains('enetunreach') || errString.contains('no route')) {
              message = 'Host $host unreachable. Ensure phone & laptop are on the same Wi-Fi network.';
              customError = ApiError.network(message, code: ApiErrorCode.unreachable);
            } else if (errString.contains('cleartext')) {
              message = 'Cleartext HTTP communication blocked by Android security policy for $host.';
              customError = ApiError.network(message, code: ApiErrorCode.cleartextBlocked);
            } else {
              message = 'Cannot connect to server at $host$port. Verify LAN IP address.';
              customError = ApiError.network(message, code: ApiErrorCode.networkError);
            }
          } else {
            customError = ApiError.fromStatusCode(
              statusCode,
              message,
              responseData,
            );
          }

          return handler.reject(
            DioException(
              requestOptions: e.requestOptions,
              response: e.response,
              type: e.type,
              error: customError,
            ),
          );
        },
      ),
    );
  }

  Future<void> initBaseUrl() async {
    final customUrl = await _storageService.getCustomApiUrl();
    if (customUrl != null && customUrl.isNotEmpty) {
      final normalized = AppConfig.normalizeApiUrl(customUrl);
      _baseUrl = normalized;
      _dio.options.baseUrl = normalized;
      debugPrint('[API CONFIG] Loaded saved API URL: $normalized');
    }
  }

  void updateBaseUrl(String newUrl) {
    final normalized = AppConfig.normalizeApiUrl(newUrl);
    _baseUrl = normalized;
    _dio.options.baseUrl = normalized;
    debugPrint('[API CONFIG] Updated ApiClient base URL to: $normalized');
  }

  void resetBaseUrl() {
    _baseUrl = AppConfig.defaultBaseUrl;
    _dio.options.baseUrl = AppConfig.defaultBaseUrl;
    debugPrint('[API CONFIG] Reset ApiClient base URL to default: $_baseUrl');
  }

  String get currentBaseUrl => _baseUrl;

  Dio get dio => _dio;

  /// Diagnostic Health Check — tests connectivity to /health with hard timeout
  Future<Map<String, dynamic>> checkHealth({String? testUrl}) async {
    final targetBase = testUrl != null && testUrl.trim().isNotEmpty
        ? AppConfig.normalizeApiUrl(testUrl)
        : _baseUrl;
    final targetUri = '$targetBase/health';
    debugPrint('[API TEST] Starting health check');
    debugPrint('[API TEST] URL: $targetUri');
    debugPrint('[API TEST] Request started');
    final stopwatch = Stopwatch()..start();

    try {
      final tempDio = Dio(
        BaseOptions(
          connectTimeout: AppConfig.healthCheckTimeout,
          receiveTimeout: AppConfig.healthCheckTimeout,
          sendTimeout: AppConfig.healthCheckTimeout,
          validateStatus: (status) => status != null,
        ),
      );
      final response = await tempDio.get(targetUri);
      stopwatch.stop();
      final elapsed = stopwatch.elapsedMilliseconds;
      debugPrint('[API TEST] Response status: ${response.statusCode}');
      debugPrint('[API TEST] Request completed in ${elapsed}ms');

      if (response.statusCode == 200) {
        return {
          'success': true,
          'latencyMs': elapsed,
          'status': response.statusCode,
          'target': targetUri,
          'data': response.data,
        };
      } else if (response.statusCode == 404) {
        return {
          'success': false,
          'latencyMs': elapsed,
          'error': 'Server reachable, but /api/health was not found (HTTP 404).',
          'target': targetUri,
        };
      } else if (response.statusCode == 500) {
        return {
          'success': false,
          'latencyMs': elapsed,
          'error': 'Server reachable, but backend returned HTTP 500 Internal Server Error.',
          'target': targetUri,
        };
      } else {
        return {
          'success': false,
          'latencyMs': elapsed,
          'error': 'Server reachable, but returned HTTP ${response.statusCode}.',
          'target': targetUri,
        };
      }
    } on DioException catch (e) {
      stopwatch.stop();
      final host = e.requestOptions.uri.host;
      final port = e.requestOptions.uri.hasPort ? ':${e.requestOptions.uri.port}' : '';
      final errString = e.error?.toString().toLowerCase() ?? '';
      String diag;

      if (e.type == DioExceptionType.connectionTimeout ||
          e.type == DioExceptionType.receiveTimeout ||
          e.type == DioExceptionType.sendTimeout) {
        debugPrint('[API TEST] Timeout after 5 seconds');
        diag = 'Server did not respond within 5 seconds. Check laptop IP, Wi-Fi & Firewall.';
      } else if (errString.contains('refused') || errString.contains('econnrefused')) {
        debugPrint('[API TEST] Connection refused');
        diag = 'Connection refused. Check that the backend is running on port ${e.requestOptions.uri.port}.';
      } else if (errString.contains('unreach') || errString.contains('enetunreach') || errString.contains('no route')) {
        debugPrint('[API TEST] Host unreachable');
        diag = 'Network/Host unreachable. Verify phone & laptop are connected to the same Wi-Fi.';
      } else if (errString.contains('cleartext')) {
        debugPrint('[API TEST] Cleartext HTTP blocked');
        diag = 'Android blocked the cleartext HTTP connection. Check Android cleartext configuration.';
      } else if (errString.contains('failed host lookup') || errString.contains('unknown host')) {
        debugPrint('[API TEST] DNS/Host resolution failure');
        diag = 'DNS/Host resolution failure for $host. Check IP address.';
      } else if (e.response?.statusCode != null) {
        debugPrint('[API TEST] Server responded with HTTP ${e.response!.statusCode}');
        diag = 'Server responded with HTTP ${e.response!.statusCode} at $targetUri.';
      } else {
        debugPrint('[API TEST] Request failed: ${e.message}');
        diag = 'Failed to reach $host$port: ${e.message ?? 'Unknown network error'}';
      }

      return {
        'success': false,
        'latencyMs': stopwatch.elapsedMilliseconds,
        'error': diag,
        'target': targetUri,
      };
    } catch (e) {
      stopwatch.stop();
      debugPrint('[API TEST] Unexpected error: $e');
      return {
        'success': false,
        'latencyMs': stopwatch.elapsedMilliseconds,
        'error': 'Unexpected error: $e',
        'target': targetUri,
      };
    }
  }

  // Generic request methods
  Future<Response<T>> get<T>(
    String path, {
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) async {
    try {
      return await _dio.get<T>(path, queryParameters: queryParameters, options: options);
    } on DioException catch (e) {
      if (e.error is ApiError) {
        throw e.error as ApiError;
      }
      throw ApiError.fromStatusCode(e.response?.statusCode ?? 0, e.message ?? 'Unknown error');
    }
  }

  Future<Response<T>> post<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) async {
    try {
      return await _dio.post<T>(path, data: data, queryParameters: queryParameters, options: options);
    } on DioException catch (e) {
      if (e.error is ApiError) {
        throw e.error as ApiError;
      }
      throw ApiError.fromStatusCode(e.response?.statusCode ?? 0, e.message ?? 'Unknown error');
    }
  }

  Future<Response<T>> patch<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) async {
    try {
      return await _dio.patch<T>(path, data: data, queryParameters: queryParameters, options: options);
    } on DioException catch (e) {
      if (e.error is ApiError) {
        throw e.error as ApiError;
      }
      throw ApiError.fromStatusCode(e.response?.statusCode ?? 0, e.message ?? 'Unknown error');
    }
  }

  Future<Response<T>> put<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) async {
    try {
      return await _dio.put<T>(path, data: data, queryParameters: queryParameters, options: options);
    } on DioException catch (e) {
      if (e.error is ApiError) {
        throw e.error as ApiError;
      }
      throw ApiError.fromStatusCode(e.response?.statusCode ?? 0, e.message ?? 'Unknown error');
    }
  }

  Future<Response<T>> delete<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) async {
    try {
      return await _dio.delete<T>(path, data: data, queryParameters: queryParameters, options: options);
    } on DioException catch (e) {
      if (e.error is ApiError) {
        throw e.error as ApiError;
      }
      throw ApiError.fromStatusCode(e.response?.statusCode ?? 0, e.message ?? 'Unknown error');
    }
  }
}
