import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

class SecureStorageService {
  static const _accessTokenKey = 'vyomcare_access_token';
  static const _userJsonKey = 'vyomcare_user_json';
  static const _customApiUrlKey = 'vyomcare_custom_api_url';

  final FlutterSecureStorage _secureStorage = const FlutterSecureStorage(
    aOptions: AndroidOptions(
      encryptedSharedPreferences: true,
    ),
  );

  // Access Token Management
  Future<void> saveAccessToken(String token) async {
    await _secureStorage.write(key: _accessTokenKey, value: token);
  }

  Future<String?> getAccessToken() async {
    return await _secureStorage.read(key: _accessTokenKey);
  }

  Future<void> clearAccessToken() async {
    await _secureStorage.delete(key: _accessTokenKey);
  }

  // Persisted User Profile JSON
  Future<void> saveUserJson(String userJson) async {
    await _secureStorage.write(key: _userJsonKey, value: userJson);
  }

  Future<String?> getUserJson() async {
    return await _secureStorage.read(key: _userJsonKey);
  }

  Future<void> clearUserJson() async {
    await _secureStorage.delete(key: _userJsonKey);
  }

  // Custom API Base URL override for LAN/Local testing
  Future<void> saveCustomApiUrl(String url) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_customApiUrlKey, url);
  }

  Future<String?> getCustomApiUrl() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_customApiUrlKey);
  }

  Future<void> removeCustomApiUrl() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_customApiUrlKey);
  }

  Future<void> clearAll() async {
    await _secureStorage.deleteAll();
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_customApiUrlKey);
  }
}
