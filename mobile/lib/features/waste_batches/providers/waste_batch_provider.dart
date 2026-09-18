import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:vyomcare_mobile/core/network/api_client.dart';
import 'package:vyomcare_mobile/models/domain_models.dart';
import 'package:vyomcare_mobile/features/auth/providers/auth_provider.dart';

class WasteBatchRepository {
  final ApiClient _apiClient;

  WasteBatchRepository(this._apiClient);

  Future<List<WasteCategory>> getCategories() async {
    final response = await _apiClient.get<List<dynamic>>('/waste-categories');
    return (response.data ?? []).map((e) => WasteCategory.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<List<WasteBatch>> getBatches({String? status, String? categoryId, String? hospitalId}) async {
    final Map<String, dynamic> query = {};
    if (status != null && status.isNotEmpty) query['status'] = status;
    if (categoryId != null && categoryId.isNotEmpty) query['categoryId'] = categoryId;
    if (hospitalId != null && hospitalId.isNotEmpty) query['hospitalId'] = hospitalId;

    final response = await _apiClient.get<dynamic>('/waste-batches', queryParameters: query);
    
    if (response.data is Map && response.data.containsKey('items')) {
      final items = response.data['items'] as List<dynamic>;
      return items.map((e) => WasteBatch.fromJson(e as Map<String, dynamic>)).toList();
    } else if (response.data is List) {
      return (response.data as List<dynamic>).map((e) => WasteBatch.fromJson(e as Map<String, dynamic>)).toList();
    }
    return [];
  }

  Future<WasteBatch> getBatchById(String id) async {
    final response = await _apiClient.get<Map<String, dynamic>>('/waste-batches/$id');
    return WasteBatch.fromJson(response.data!);
  }

  Future<List<CustodyEvent>> getBatchHistory(String id) async {
    final response = await _apiClient.get<List<dynamic>>('/waste-batches/$id/history');
    return (response.data ?? []).map((e) => CustodyEvent.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<WasteBatch> createBatch({
    required String categoryId,
    required String department,
    required double quantity,
    required String unit,
    String? photoUrl,
    String? idempotencyKey,
  }) async {
    final response = await _apiClient.post<Map<String, dynamic>>(
      '/waste-batches',
      data: {
        'categoryId': categoryId,
        'department': department,
        'quantity': quantity,
        'unit': unit,
        if (photoUrl != null && photoUrl.isNotEmpty) 'photoUrl': photoUrl,
        if (idempotencyKey != null) 'idempotencyKey': idempotencyKey,
      },
    );
    return WasteBatch.fromJson(response.data!);
  }

  Future<Map<String, dynamic>> generateQr(String batchId) async {
    final response = await _apiClient.post<Map<String, dynamic>>('/waste-batches/$batchId/qr');
    return response.data ?? {};
  }

  Future<Map<String, dynamic>> scanCode(String codeValue) async {
    final response = await _apiClient.post<Map<String, dynamic>>('/scan', data: {'codeValue': codeValue});
    return response.data ?? {};
  }

  Future<WasteBatch> custodyHandover(String batchId, {required String eventType, String? notes, double? latitude, double? longitude}) async {
    final response = await _apiClient.post<Map<String, dynamic>>(
      '/waste-batches/$batchId/custody-events',
      data: {
        'eventType': eventType,
        if (notes != null) 'notes': notes,
        if (latitude != null) 'latitude': latitude,
        if (longitude != null) 'longitude': longitude,
      },
    );
    return WasteBatch.fromJson(response.data!);
  }

  Future<WasteBatch> verifyArrival(String batchId, {required double latitude, required double longitude}) async {
    final response = await _apiClient.post<Map<String, dynamic>>(
      '/waste-batches/$batchId/verify-arrival',
      data: {'latitude': latitude, 'longitude': longitude},
    );
    return WasteBatch.fromJson(response.data!);
  }

  Future<WasteBatch> confirmTreatment(String batchId, {required String photoUrl, double? latitude, double? longitude}) async {
    final response = await _apiClient.post<Map<String, dynamic>>(
      '/waste-batches/$batchId/confirm-treatment',
      data: {
        'photoUrl': photoUrl,
        if (latitude != null) 'latitude': latitude,
        if (longitude != null) 'longitude': longitude,
      },
    );
    return WasteBatch.fromJson(response.data!);
  }
}

final wasteBatchRepositoryProvider = Provider<WasteBatchRepository>((ref) {
  final apiClient = ref.watch(apiClientProvider);
  return WasteBatchRepository(apiClient);
});

// Category List Provider
final categoriesFutureProvider = FutureProvider<List<WasteCategory>>((ref) async {
  return ref.watch(wasteBatchRepositoryProvider).getCategories();
});

// Batches List Provider
final batchesListFutureProvider = FutureProvider.autoDispose.family<List<WasteBatch>, String?>((ref, status) async {
  return ref.watch(wasteBatchRepositoryProvider).getBatches(status: status);
});

// Batch Details Provider
final batchDetailFutureProvider = FutureProvider.autoDispose.family<WasteBatch, String>((ref, id) async {
  return ref.watch(wasteBatchRepositoryProvider).getBatchById(id);
});

// Batch Custody History Provider
final batchHistoryFutureProvider = FutureProvider.autoDispose.family<List<CustodyEvent>, String>((ref, id) async {
  return ref.watch(wasteBatchRepositoryProvider).getBatchHistory(id);
});
