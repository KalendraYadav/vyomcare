import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:go_router/go_router.dart';
import 'package:vyomcare_mobile/core/theme/app_colors.dart';
import 'package:vyomcare_mobile/models/domain_models.dart';
import 'package:vyomcare_mobile/shared/widgets/shared_widgets.dart';
import 'package:vyomcare_mobile/features/waste_batches/providers/waste_batch_provider.dart';
import 'package:vyomcare_mobile/features/auth/providers/auth_provider.dart';

class UniversalScannerScreen extends ConsumerStatefulWidget {
  const UniversalScannerScreen({super.key});

  @override
  ConsumerState<UniversalScannerScreen> createState() => _UniversalScannerScreenState();
}

class _UniversalScannerScreenState extends ConsumerState<UniversalScannerScreen> {
  final MobileScannerController _scannerController = MobileScannerController(
    detectionSpeed: DetectionSpeed.normal,
    facing: CameraFacing.back,
    torchEnabled: false,
  );

  final TextEditingController _manualInputController = TextEditingController();
  bool _isProcessing = false;
  Map<String, dynamic>? _scanResult;
  String? _errorMessage;
  String? _successMessage;

  @override
  void dispose() {
    _scannerController.dispose();
    _manualInputController.dispose();
    super.dispose();
  }

  void _processScannedBarcode(String codeValue) async {
    if (_isProcessing) return;
    setState(() {
      _isProcessing = true;
      _errorMessage = null;
      _successMessage = null;
      _scanResult = null;
    });

    try {
      final repo = ref.read(wasteBatchRepositoryProvider);
      final result = await repo.scanCode(codeValue);
      setState(() {
        _isProcessing = false;
        _scanResult = result;
      });
    } catch (e) {
      setState(() {
        _isProcessing = false;
        _errorMessage = e.toString();
      });
    }
  }

  void _executeCustodyAction(String batchId, String eventType) async {
    setState(() {
      _isProcessing = true;
      _errorMessage = null;
    });

    try {
      final repo = ref.read(wasteBatchRepositoryProvider);
      final updated = await repo.custodyHandover(batchId, eventType: eventType);

      setState(() {
        _isProcessing = false;
        _scanResult = null;
        _successMessage = 'Custody handover recorded successfully! Batch transitioned to ${updated.status}.';
      });
    } catch (e) {
      setState(() {
        _isProcessing = false;
        _errorMessage = e.toString();
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authStateProvider);
    final user = authState.user;

    final isCollection = user?.role == UserRole.COLLECTION_STAFF || user?.role == UserRole.SUPER_ADMIN;
    final isTransport = user?.role == UserRole.TRANSPORT_PERSONNEL || user?.role == UserRole.SUPER_ADMIN;
    final isTreatment = user?.role == UserRole.TREATMENT_FACILITY_STAFF || user?.role == UserRole.SUPER_ADMIN;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Chain-of-Custody Scanner', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
        actions: [
          IconButton(
            icon: ValueListenableBuilder(
              valueListenable: _scannerController,
              builder: (context, state, child) {
                switch (state.torchState) {
                  case TorchState.off:
                    return const Icon(Icons.flash_off, color: Colors.grey);
                  case TorchState.on:
                    return const Icon(Icons.flash_on, color: Colors.yellow);
                  default:
                    return const Icon(Icons.flash_auto, color: Colors.grey);
                }
              },
            ),
            onPressed: () => _scannerController.toggleTorch(),
          ),
          IconButton(
            icon: const Icon(Icons.flip_camera_android),
            onPressed: () => _scannerController.switchCamera(),
          ),
        ],
      ),
      body: SingleChildScrollView(
        child: Column(
          children: [
            // Optical Viewport
            SizedBox(
              height: 280,
              child: Stack(
                children: [
                  MobileScanner(
                    controller: _scannerController,
                    onDetect: (capture) {
                      final List<Barcode> barcodes = capture.barcodes;
                      for (final barcode in barcodes) {
                        if (barcode.rawValue != null) {
                          _processScannedBarcode(barcode.rawValue!);
                          break;
                        }
                      }
                    },
                  ),
                  // Reticle Overlay
                  Center(
                    child: Container(
                      width: 200,
                      height: 200,
                      decoration: BoxDecoration(
                        border: Border.all(color: AppColors.primary, width: 2),
                        borderRadius: BorderRadius.circular(16),
                      ),
                    ),
                  ),
                  if (_isProcessing)
                    Container(
                      color: Colors.black.withOpacity(0.5),
                      child: const Center(
                        child: CircularProgressIndicator(color: Colors.white),
                      ),
                    ),
                ],
              ),
            ),

            Padding(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Status Messages
                  if (_successMessage != null) ...[
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: AppColors.successBg,
                        borderRadius: BorderRadius.circular(AppRadius.md),
                        border: Border.all(color: AppColors.successBorder),
                      ),
                      child: Text(_successMessage!, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppColors.success)),
                    ),
                    const SizedBox(height: 12),
                  ],

                  if (_errorMessage != null) ...[
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: AppColors.dangerBg,
                        borderRadius: BorderRadius.circular(AppRadius.md),
                        border: Border.all(color: AppColors.dangerBorder),
                      ),
                      child: Text(_errorMessage!, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppColors.danger)),
                    ),
                    const SizedBox(height: 12),
                  ],

                  // Manual Barcode Entry Fallback
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(12.0),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              const Text(
                                'MANUAL BARCODE ENTRY (FALLBACK)',
                                style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: AppColors.textMuted),
                              ),
                              GestureDetector(
                                onTap: () => _manualInputController.text = 'BIOTRACK:WASTE-1001:TEST',
                                child: const Text(
                                  'Sample Code',
                                  style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: AppColors.primary),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          Row(
                            children: [
                              Expanded(
                                child: TextFormField(
                                  controller: _manualInputController,
                                  decoration: const InputDecoration(
                                    hintText: 'BIOTRACK:WASTE-1001:ABC123',
                                    contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                                  ),
                                  style: const TextStyle(fontSize: 12, fontFamily: 'monospace'),
                                ),
                              ),
                              const SizedBox(width: 8),
                              ElevatedButton(
                                onPressed: () {
                                  final code = _manualInputController.text.trim();
                                  if (code.isNotEmpty) _processScannedBarcode(code);
                                },
                                style: ElevatedButton.styleFrom(minimumSize: const Size(80, 42)),
                                child: const Text('Verify'),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),

                  const SizedBox(height: 16),

                  // Scanned Resolution Card
                  if (_scanResult != null && _scanResult!.containsKey('batch')) ...[
                    Builder(
                      builder: (context) {
                        final batchMap = _scanResult!['batch'] as Map<String, dynamic>;
                        final batch = WasteBatch.fromJson(batchMap);

                        final canAccept = isCollection && batch.status == 'QR_ASSIGNED';
                        final canTransport = isTransport && batch.status == 'COLLECTED';
                        final canArrival = isTreatment && batch.status == 'IN_TRANSIT';
                        final canTreatment = isTreatment && batch.status == 'RECEIVED';

                        return Card(
                          child: Padding(
                            padding: const EdgeInsets.all(16.0),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    Text(
                                      batch.wasteId,
                                      style: const TextStyle(
                                        fontFamily: 'monospace',
                                        fontSize: 16,
                                        fontWeight: FontWeight.w900,
                                      ),
                                    ),
                                    StatusBadge(status: batch.status),
                                  ],
                                ),
                                const SizedBox(height: 8),
                                CategoryBadge(category: batch.category),
                                const SizedBox(height: 12),
                                Text(
                                  'Quantity: ${batch.quantity} ${batch.unit} • Ward: ${batch.department}',
                                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                                ),
                                const SizedBox(height: 16),

                                if (canAccept)
                                  ElevatedButton.icon(
                                    onPressed: _isProcessing ? null : () => _executeCustodyAction(batch.id, 'COLLECTION_ACCEPTED'),
                                    icon: const Icon(Icons.check_circle_outline),
                                    label: const Text('Accept Ward Custody'),
                                  ),

                                if (canTransport)
                                  ElevatedButton.icon(
                                    onPressed: _isProcessing ? null : () => _executeCustodyAction(batch.id, 'TRANSPORT_STARTED'),
                                    icon: const Icon(Icons.local_shipping_outlined),
                                    label: const Text('Load Onto Van & Start Transit'),
                                  ),

                                if (canArrival)
                                  ElevatedButton.icon(
                                    onPressed: () => context.push('/treatment/arrival?batchId=${batch.id}'),
                                    icon: const Icon(Icons.verified_user_outlined),
                                    label: const Text('5-Step CBWTF Gate Arrival Check'),
                                  ),

                                if (canTreatment)
                                  ElevatedButton.icon(
                                    onPressed: () => context.push('/treatment/confirm?batchId=${batch.id}'),
                                    icon: const Icon(Icons.local_fire_department_outlined),
                                    style: ElevatedButton.styleFrom(backgroundColor: AppColors.danger),
                                    label: const Text('Confirm Destruction & Close'),
                                  ),

                                const SizedBox(height: 8),
                                OutlinedButton(
                                  onPressed: () => setState(() => _scanResult = null),
                                  child: const Text('Scan Another Bag'),
                                ),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
