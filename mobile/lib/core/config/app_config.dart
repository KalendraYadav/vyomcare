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
}
