enum ApiErrorCode {
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  validationError,
  rateLimited,
  serverError,
  networkError,
  timeout,
  unknown,
}

class ApiError implements Exception {
  final int status;
  final String message;
  final ApiErrorCode code;
  final dynamic details;

  ApiError({
    required this.status,
    required this.message,
    required this.code,
    this.details,
  });

  factory ApiError.fromStatusCode(int status, String message, [dynamic details]) {
    ApiErrorCode code;
    switch (status) {
      case 400:
        code = ApiErrorCode.badRequest;
        break;
      case 401:
        code = ApiErrorCode.unauthorized;
        break;
      case 403:
        code = ApiErrorCode.forbidden;
        break;
      case 404:
        code = ApiErrorCode.notFound;
        break;
      case 409:
        code = ApiErrorCode.conflict;
        break;
      case 422:
        code = ApiErrorCode.validationError;
        break;
      case 429:
        code = ApiErrorCode.rateLimited;
        break;
      case 500:
      case 502:
      case 503:
        code = ApiErrorCode.serverError;
        break;
      default:
        code = status == 0 ? ApiErrorCode.networkError : ApiErrorCode.unknown;
    }
    return ApiError(status: status, message: message, code: code, details: details);
  }

  String get userFriendlyMessage {
    switch (code) {
      case ApiErrorCode.unauthorized:
        return 'Invalid credentials or session expired. Please sign in again.';
      case ApiErrorCode.forbidden:
        return 'Access denied. Your role is not authorized to perform this action.';
      case ApiErrorCode.notFound:
        return 'The requested record or resource was not found.';
      case ApiErrorCode.conflict:
        return 'A record with this identifier already exists.';
      case ApiErrorCode.validationError:
      case ApiErrorCode.badRequest:
        return message.isNotEmpty ? message : 'Validation error. Please verify your inputs.';
      case ApiErrorCode.rateLimited:
        return 'Too many requests. Please wait a moment before trying again.';
      case ApiErrorCode.serverError:
        return 'Internal server error. Please try again or contact support.';
      case ApiErrorCode.networkError:
        return 'Cannot connect to VyomCare server. Check network connection.';
      case ApiErrorCode.timeout:
        return 'Request timed out. Please try again.';
      case ApiErrorCode.unknown:
        return message.isNotEmpty ? message : 'An unexpected error occurred.';
    }
  }

  @override
  String toString() => 'ApiError(status: $status, code: $code, message: $message)';
}
