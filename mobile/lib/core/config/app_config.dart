import 'package:flutter/foundation.dart';

enum Environment {
  development,
  staging,
  production,
}

class AppConfig {
  static Environment environment = kReleaseMode 
      ? Environment.production 
      : Environment.development;

  /// Default API base URL for Android Emulator / Physical Device / Production
  /// In Android emulator: 10.0.2.2 accesses host localhost:3001
  /// In physical device: configure LAN IP or Cloudflare tunnel
  static String get defaultBaseUrl {
    switch (environment) {
      case Environment.development:
        return 'http://10.0.2.2:3001/api';
      case Environment.staging:
        return 'https://staging-api.vyomcare.in/api';
      case Environment.production:
        return 'https://api.vyomcare.in/api';
    }
  }

  static String get defaultSocketUrl {
    switch (environment) {
      case Environment.development:
        return 'http://10.0.2.2:3001';
      case Environment.staging:
        return 'https://staging-api.vyomcare.in';
      case Environment.production:
        return 'https://api.vyomcare.in';
    }
  }

  static const String appName = 'VyomCare';
  static const String appVersion = '1.0.0';
  static const String systemSubtitle = 'National Biomedical Waste Oversight Platform';

  // Centralized network timeouts (5s connect, 10s receive, 10s send)
  static const Duration connectTimeout = Duration(seconds: 5);
  static const Duration receiveTimeout = Duration(seconds: 10);
  static const Duration sendTimeout = Duration(seconds: 10);
  static const Duration healthCheckTimeout = Duration(seconds: 5);

  /// Safely normalizes user-entered API URLs for local development and production.
  /// Handles inputs such as:
  ///   "192.168.1.35:3001"         -> "http://192.168.1.35:3001/api"
  ///   "http://192.168.1.35:3001"  -> "http://192.168.1.35:3001/api"
  ///   "http://192.168.1.35:3001/" -> "http://192.168.1.35:3001/api"
  ///   "http://192.168.1.35:3001/api" -> "http://192.168.1.35:3001/api"
  ///   "http://192.168.1.35:3001/api/" -> "http://192.168.1.35:3001/api"
  ///   "http://192.168.1.35:3001/api/api" -> "http://192.168.1.35:3001/api"
  ///   "http://192.168.1.35:3001//api//"  -> "http://192.168.1.35:3001/api"
  static String normalizeApiUrl(String raw) {
    var input = raw.trim();
    if (input.isEmpty) return defaultBaseUrl;

    // Prepend http:// scheme if user enters raw host[:port]
    if (!input.startsWith('http://') && !input.startsWith('https://')) {
      input = 'http://$input';
    }

    final uri = Uri.tryParse(input);
    if (uri == null || uri.host.isEmpty) {
      throw FormatException('Invalid URL format: "$raw"');
    }

    // Clean multiple slashes in path
    var path = uri.path.replaceAll(RegExp(r'/+'), '/').trim();

    // Strip trailing slashes
    while (path.endsWith('/')) {
      path = path.substring(0, path.length - 1);
    }

    // Deduplicate any redundant /api repetitions (e.g. /api/api)
    while (path.endsWith('/api/api')) {
      path = path.substring(0, path.length - 4);
    }

    // Ensure it ends with /api
    if (!path.endsWith('/api')) {
      if (path.isEmpty || path == '/') {
        path = '/api';
      } else {
        path = '$path/api';
      }
    }

    return Uri(
      scheme: uri.scheme,
      userInfo: uri.userInfo.isNotEmpty ? uri.userInfo : null,
      host: uri.host,
      port: uri.hasPort ? uri.port : null,
      path: path,
    ).toString();
  }

  /// Derives the Socket.IO base URL from any normalized API base URL
  /// (e.g. "http://192.168.1.35:3001/api" -> "http://192.168.1.35:3001")
  static String deriveSocketUrl(String apiUrl) {
    try {
      final uri = Uri.parse(apiUrl);
      return Uri(
        scheme: uri.scheme,
        host: uri.host,
        port: uri.hasPort ? uri.port : null,
      ).toString();
    } catch (_) {
      return defaultSocketUrl;
    }
  }
}
