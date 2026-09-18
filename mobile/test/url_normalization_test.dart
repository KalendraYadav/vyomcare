import 'package:flutter_test/flutter_test.dart';
import 'package:vyomcare_mobile/core/config/app_config.dart';

void main() {
  group('AppConfig.normalizeApiUrl', () {
    test('normalizes bare LAN IP and port', () {
      expect(
        AppConfig.normalizeApiUrl('192.168.1.35:3001'),
        'http://192.168.1.35:3001/api',
      );
    });

    test('normalizes http URL with port without /api', () {
      expect(
        AppConfig.normalizeApiUrl('http://192.168.1.35:3001'),
        'http://192.168.1.35:3001/api',
      );
    });

    test('normalizes http URL with port and trailing slash', () {
      expect(
        AppConfig.normalizeApiUrl('http://192.168.1.35:3001/'),
        'http://192.168.1.35:3001/api',
      );
    });

    test('preserves already normalized URL', () {
      expect(
        AppConfig.normalizeApiUrl('http://192.168.1.35:3001/api'),
        'http://192.168.1.35:3001/api',
      );
    });

    test('trims trailing slash from /api/', () {
      expect(
        AppConfig.normalizeApiUrl('http://192.168.1.35:3001/api/'),
        'http://192.168.1.35:3001/api',
      );
    });

    test('deduplicates redundant /api/api', () {
      expect(
        AppConfig.normalizeApiUrl('http://192.168.1.35:3001/api/api'),
        'http://192.168.1.35:3001/api',
      );
    });

    test('normalizes redundant slashes //api//', () {
      expect(
        AppConfig.normalizeApiUrl('http://192.168.1.35:3001//api//'),
        'http://192.168.1.35:3001/api',
      );
    });

    test('normalizes Hackathon 10.x.x.x network IP', () {
      expect(
        AppConfig.normalizeApiUrl('10.20.14.88:3001'),
        'http://10.20.14.88:3001/api',
      );
    });

    test('preserves https scheme for Cloudflare or remote domains', () {
      expect(
        AppConfig.normalizeApiUrl('https://vyomcare.trycloudflare.com'),
        'https://vyomcare.trycloudflare.com/api',
      );
      expect(
        AppConfig.normalizeApiUrl('https://vyomcare.trycloudflare.com/api/'),
        'https://vyomcare.trycloudflare.com/api',
      );
    });

    test('normalizes all 192.168.1.20:3001 target variants to canonical endpoint', () {
      expect(AppConfig.normalizeApiUrl('192.168.1.20:3001'), 'http://192.168.1.20:3001/api');
      expect(AppConfig.normalizeApiUrl('http://192.168.1.20:3001'), 'http://192.168.1.20:3001/api');
      expect(AppConfig.normalizeApiUrl('http://192.168.1.20:3001/'), 'http://192.168.1.20:3001/api');
      expect(AppConfig.normalizeApiUrl('http://192.168.1.20:3001/api'), 'http://192.168.1.20:3001/api');
      expect(AppConfig.normalizeApiUrl('http://192.168.1.20:3001/api/'), 'http://192.168.1.20:3001/api');
    });

    test('throws FormatException on malformed URL inputs immediately', () {
      expect(() => AppConfig.normalizeApiUrl('http://:::'), throwsFormatException);
    });

    test('returns defaultBaseUrl on empty or whitespace input', () {
      expect(
        AppConfig.normalizeApiUrl('   '),
        AppConfig.defaultBaseUrl,
      );
    });
  });

  group('AppConfig.deriveSocketUrl', () {
    test('derives base socket URL by stripping /api and keeping host/port', () {
      expect(
        AppConfig.deriveSocketUrl('http://192.168.1.35:3001/api'),
        'http://192.168.1.35:3001',
      );
    });

    test('derives https socket URL from production endpoint', () {
      expect(
        AppConfig.deriveSocketUrl('https://api.vyomcare.in/api'),
        'https://api.vyomcare.in',
      );
    });

    test('derives socket URL for 10.x hackathon address', () {
      expect(
        AppConfig.deriveSocketUrl('http://10.20.5.12:3001/api'),
        'http://10.20.5.12:3001',
      );
    });
  });
}
