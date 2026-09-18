import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:go_router/go_router.dart';
import 'package:vyomcare_mobile/core/theme/app_colors.dart';
import 'package:vyomcare_mobile/core/network/api_client.dart';
import 'package:vyomcare_mobile/models/domain_models.dart';
import 'package:vyomcare_mobile/shared/widgets/shared_widgets.dart';
import 'package:vyomcare_mobile/features/auth/providers/auth_provider.dart';

class TransportRepository {
  final ApiClient _apiClient;

  TransportRepository(this._apiClient);

  Future<TransportAssignment?> getMyAssignment() async {
    final response = await _apiClient.get<dynamic>('/transport/my-assignment');
    if (response.data == null) return null;
    return TransportAssignment.fromJson(response.data as Map<String, dynamic>);
  }

  Future<List<GpsPing>> getPings(String assignmentId) async {
    final response = await _apiClient.get<List<dynamic>>('/gps-pings/$assignmentId');
    return (response.data ?? []).map((e) => GpsPing.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<void> sendGpsPing(String assignmentId, double lat, double lng) async {
    await _apiClient.post(
      '/gps-pings',
      data: {
        'transportAssignmentId': assignmentId,
        'latitude': lat,
        'longitude': lng,
      },
    );
  }
}

final transportRepositoryProvider = Provider<TransportRepository>((ref) {
  final apiClient = ref.watch(apiClientProvider);
  return TransportRepository(apiClient);
});

final myAssignmentFutureProvider = FutureProvider.autoDispose<TransportAssignment?>((ref) async {
  return ref.watch(transportRepositoryProvider).getMyAssignment();
});

class DriverModeScreen extends ConsumerStatefulWidget {
  const DriverModeScreen({super.key});

  @override
  ConsumerState<DriverModeScreen> createState() => _DriverModeScreenState();
}

class _DriverModeScreenState extends ConsumerState<DriverModeScreen> {
  Position? _currentPosition;
  bool _isGpsActive = false;
  String? _gpsStatusMessage;
  Timer? _telemetryTimer;
  bool _isSendingPing = false;

  @override
  void initState() {
    super.initState();
    _initGeolocation();
  }

  @override
  void dispose() {
    _telemetryTimer?.cancel();
    super.dispose();
  }

  Future<void> _initGeolocation() async {
    bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      setState(() => _gpsStatusMessage = 'Location services are disabled on device.');
      return;
    }

    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) {
        setState(() => _gpsStatusMessage = 'Location permissions are denied.');
        return;
      }
    }

    if (permission == LocationPermission.deniedForever) {
      setState(() => _gpsStatusMessage = 'Location permissions permanently denied.');
      return;
    }

    try {
      final pos = await Geolocator.getCurrentPosition(desiredAccuracy: LocationAccuracy.high);
      setState(() {
        _currentPosition = pos;
        _isGpsActive = true;
        _gpsStatusMessage = 'GPS Lock Active';
      });

      // 30s automated telemetry interval
      _telemetryTimer = Timer.periodic(const Duration(seconds: 30), (_) {
        _sendAutomatedPing();
      });
    } catch (e) {
      setState(() => _gpsStatusMessage = 'Acquiring GPS lock failed: $e');
    }
  }

  void _sendAutomatedPing() async {
    final assignmentAsync = ref.read(myAssignmentFutureProvider);
    final assignment = assignmentAsync.value;
    if (assignment == null || assignment.status != 'IN_PROGRESS') return;

    try {
      final pos = await Geolocator.getCurrentPosition(desiredAccuracy: LocationAccuracy.high);
      setState(() => _currentPosition = pos);
      await ref.read(transportRepositoryProvider).sendGpsPing(assignment.id, pos.latitude, pos.longitude);
    } catch (_) {}
  }

  void _manualPing(String assignmentId) async {
    if (_isSendingPing) return;
    setState(() => _isSendingPing = true);

    try {
      final pos = await Geolocator.getCurrentPosition(desiredAccuracy: LocationAccuracy.high);
      setState(() => _currentPosition = pos);
      await ref.read(transportRepositoryProvider).sendGpsPing(assignmentId, pos.latitude, pos.longitude);
      ref.invalidate(myAssignmentFutureProvider);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('GPS ping successfully dispatched to control room.')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Ping failed: $e')),
        );
      }
    } finally {
      setState(() => _isSendingPing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final assignmentAsync = ref.watch(myAssignmentFutureProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Driver Mode & In-Cabin HUD', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => ref.invalidate(myAssignmentFutureProvider),
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          children: [
            // Top HUD Bar
            Card(
              color: AppColors.surface,
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Row(
                  children: [
                    Container(
                      width: 48,
                      height: 48,
                      decoration: BoxDecoration(
                        color: AppColors.successBg,
                        borderRadius: BorderRadius.circular(AppRadius.md),
                      ),
                      child: const Icon(Icons.local_shipping, color: AppColors.success, size: 28),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('ASSIGNED VEHICLE', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: AppColors.textMuted)),
                          assignmentAsync.when(
                            data: (a) => Text(
                              a?.vehicle?.registrationNumber ?? 'No Vehicle Assigned',
                              style: const TextStyle(fontFamily: 'monospace', fontSize: 15, fontWeight: FontWeight.w900),
                            ),
                            loading: () => const Text('Loading...', style: TextStyle(fontSize: 12)),
                            error: (_, __) => const Text('Error', style: TextStyle(fontSize: 12)),
                          ),
                        ],
                      ),
                    ),
                    // GPS status pill
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: _isGpsActive ? AppColors.successBg : AppColors.warningBg,
                        borderRadius: BorderRadius.circular(AppRadius.full),
                        border: Border.all(color: _isGpsActive ? AppColors.successBorder : AppColors.warningBorder),
                      ),
                      child: Row(
                        children: [
                          Icon(Icons.radio_button_checked, size: 12, color: _isGpsActive ? AppColors.success : AppColors.warning),
                          const SizedBox(width: 4),
                          Text(
                            _gpsStatusMessage ?? (_isGpsActive ? 'GPS Lock' : 'Acquiring...'),
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
                              color: _isGpsActive ? AppColors.success : AppColors.warning,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),

            const SizedBox(height: 16),

            assignmentAsync.when(
              data: (assignment) {
                if (assignment == null) {
                  return const Card(
                    child: Padding(
                      padding: EdgeInsets.all(32.0),
                      child: Column(
                        children: [
                          Icon(Icons.inventory_2_outlined, size: 48, color: AppColors.textMuted),
                          SizedBox(height: 12),
                          Text(
                            'No active transport assignment.',
                            style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
                          ),
                          SizedBox(height: 4),
                          Text(
                            'Stand by for vehicle dispatch from CBWTF logistics manager.',
                            textAlign: TextAlign.center,
                            style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
                          ),
                        ],
                      ),
                    ),
                  );
                }

                return Column(
                  children: [
                    // Active Mission Card
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(16.0),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                const Text(
                                  'ACTIVE TRANSIT RUN',
                                  style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.primary, letterSpacing: 0.5),
                                ),
                                StatusBadge(status: assignment.status, isSmall: true),
                              ],
                            ),
                            const SizedBox(height: 12),
                            const Text(
                              'Destination Facility',
                              style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.textMuted),
                            ),
                            Text(
                              assignment.expectedFacility?.name ?? 'Designated Treatment Facility',
                              style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
                            ),
                            Text(
                              assignment.expectedFacility?.address ?? 'CBWTF Industrial Zone',
                              style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                            ),
                            const SizedBox(height: 16),

                            if (assignment.wasteBatch != null) ...[
                              Container(
                                padding: const EdgeInsets.all(12),
                                decoration: BoxDecoration(
                                  color: AppColors.surface,
                                  borderRadius: BorderRadius.circular(AppRadius.md),
                                  border: Border.all(color: AppColors.border),
                                ),
                                child: Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        const Text('MANIFEST BAG ON BOARD', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: AppColors.textMuted)),
                                        Text(assignment.wasteBatch!.wasteId, style: const TextStyle(fontFamily: 'monospace', fontWeight: FontWeight.bold)),
                                      ],
                                    ),
                                    Text(
                                      '${assignment.wasteBatch!.quantity} ${assignment.wasteBatch!.unit}',
                                      style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w900),
                                    ),
                                  ],
                                ),
                              ),
                              const SizedBox(height: 16),
                            ],

                            // High-Friction 56px Driver Touch Targets
                            ElevatedButton.icon(
                              onPressed: () => context.push('/scan'),
                              style: ElevatedButton.styleFrom(minimumSize: const Size.fromHeight(54)),
                              icon: const Icon(Icons.qr_code_scanner),
                              label: const Text('Scan Waste Bag Onto Van', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
                            ),
                            const SizedBox(height: 10),
                            OutlinedButton.icon(
                              onPressed: () => context.push('/scan'),
                              style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(54)),
                              icon: const Icon(Icons.verified_user_outlined, color: AppColors.success),
                              label: const Text('Report Arrival at Gate', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
                            ),
                          ],
                        ),
                      ),
                    ),

                    const SizedBox(height: 16),

                    // Coordinates & Live Telemetry
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(16.0),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                const Text('GPS TELEMETRY & WAYPOINTS', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.textMuted)),
                                TextButton.icon(
                                  onPressed: _isSendingPing ? null : () => _manualPing(assignment.id),
                                  icon: const Icon(Icons.send, size: 14),
                                  label: const Text('Ping Now', style: TextStyle(fontSize: 11)),
                                ),
                              ],
                            ),
                            if (_currentPosition != null) ...[
                              Text(
                                'Current: ${_currentPosition!.latitude.toStringAsFixed(5)}°N, ${_currentPosition!.longitude.toStringAsFixed(5)}°E',
                                style: const TextStyle(fontFamily: 'monospace', fontSize: 12, fontWeight: FontWeight.bold),
                              ),
                            ],
                          ],
                        ),
                      ),
                    ),
                  ],
                );
              },
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (e, _) => Center(child: Text('Error: $e')),
            ),
          ],
        ),
      ),
    );
  }
}
