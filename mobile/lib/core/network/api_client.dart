import 'dart:async';
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
        connectTimeout: const Duration(seconds: 15),
        receiveTimeout: const Duration(seconds: 15),
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
          
          String message = 'Network connection failed.';
          if (responseData is Map && responseData.containsKey('message')) {
            final msg = responseData['message'];
            if (msg is List) {
              message = msg.join(', ');
            } else if (msg is String) {
              message = msg;
            }
          } else if (e.type == DioExceptionType.connectionTimeout ||
                     e.type == DioExceptionType.receiveTimeout) {
            message = 'Connection timed out.';
          }

          final customError = ApiError.fromStatusCode(
            statusCode,
            message,
            responseData,
          );

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
      _baseUrl = customUrl;
      _dio.options.baseUrl = customUrl;
    }
  }

  void updateBaseUrl(String newUrl) {
    _baseUrl = newUrl;
    _dio.options.baseUrl = newUrl;
  }

  String get currentBaseUrl => _baseUrl;

  Dio get dio => _dio;

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
