import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:vyomcare_mobile/core/theme/app_colors.dart';
import 'package:vyomcare_mobile/models/domain_models.dart';
import 'package:vyomcare_mobile/shared/widgets/shared_widgets.dart';
import 'package:vyomcare_mobile/shared/widgets/custody_timeline.dart';
import 'package:vyomcare_mobile/features/waste_batches/providers/waste_batch_provider.dart';
import 'package:vyomcare_mobile/features/auth/providers/auth_provider.dart';

class WasteBatchDetailScreen extends ConsumerStatefulWidget {
  final String batchId;

  const WasteBatchDetailScreen({super.key, required this.batchId});

  @override
  ConsumerState<WasteBatchDetailScreen> createState() => _WasteBatchDetailScreenState();
}

class _WasteBatchDetailScreenState extends ConsumerState<WasteBatchDetailScreen> {
  bool _isPerformingAction = false;
  String? _feedbackMessage;

  String _formatDate(String isoString) {
    try {
      final dt = DateTime.parse(isoString).toLocal();
      return DateFormat('dd MMM yyyy, hh:mm a').format(dt);
    } catch (_) {
      return isoString;
    }
  }

  void _executeHandover(String eventType, String note) async {
    setState(() {
      _isPerformingAction = true;
      _feedbackMessage = null;
    });

    try {
      final repo = ref.read(wasteBatchRepositoryProvider);
      final updated = await repo.custodyHandover(
        widget.batchId,
        eventType: eventType,
        notes: note,
      );

      ref.invalidate(batchDetailFutureProvider(widget.batchId));
      ref.invalidate(batchHistoryFutureProvider(widget.batchId));

      setState(() {
        _isPerformingAction = false;
        _feedbackMessage = 'Handshake recorded! Status transitioned to ${updated.status}.';
      });
    } catch (e) {
      setState(() {
        _isPerformingAction = false;
        _feedbackMessage = 'Operation failed: $e';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final batchAsync = ref.watch(batchDetailFutureProvider(widget.batchId));
    final historyAsync = ref.watch(batchHistoryFutureProvider(widget.batchId));
    final authState = ref.watch(authStateProvider);
    final user = authState.user;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Waste Manifest & Custody', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
        actions: [
          IconButton(
            icon: const Icon(Icons.qr_code_2),
            onPressed: () => context.push('/waste-batches/${widget.batchId}/print-qr'),
          ),
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () {
              ref.invalidate(batchDetailFutureProvider(widget.batchId));
              ref.invalidate(batchHistoryFutureProvider(widget.batchId));
            },
          ),
        ],
      ),
      body: batchAsync.when(
        data: (batch) {
          final isCollection = user?.role == UserRole.COLLECTION_STAFF || user?.role == UserRole.SUPER_ADMIN;
          final isTransport = user?.role == UserRole.TRANSPORT_PERSONNEL || user?.role == UserRole.SUPER_ADMIN;

          final canAcceptCollection = isCollection && batch.status == 'QR_ASSIGNED';
          final canStartTransport = isTransport && batch.status == 'COLLECTED';

          return SingleChildScrollView(
            padding: const EdgeInsets.all(16.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (_feedbackMessage != null) ...[
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: AppColors.primarySubtle,
                      borderRadius: BorderRadius.circular(AppRadius.md),
                      border: Border.all(color: AppColors.primary.withOpacity(0.2)),
                    ),
                    child: Text(_feedbackMessage!, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppColors.primary)),
                  ),
                  const SizedBox(height: 16),
                ],

                // Hero Identity Card
                Card(
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
                                fontSize: 18,
                                fontWeight: FontWeight.w900,
                                color: AppColors.textPrimary,
                              ),
                            ),
                            StatusBadge(status: batch.status),
                          ],
                        ),
                        const SizedBox(height: 12),
                        CategoryBadge(category: batch.category),
                        const SizedBox(height: 12),
                        const Divider(),
                        const SizedBox(height: 12),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text('QUANTITY', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: AppColors.textMuted)),
                                Text('${batch.quantity} ${batch.unit}', style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
                              ],
                            ),
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text('WARD / ORIGIN', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: AppColors.textMuted)),
                                Text(batch.department, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                              ],
                            ),
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text('DATE', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: AppColors.textMuted)),
                                Text(_formatDate(batch.createdAt).split(',')[0], style: const TextStyle(fontSize: 12)),
                              ],
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),

                const SizedBox(height: 16),

                // Contextual Actions Bar
                if (canAcceptCollection || canStartTransport) ...[
                  Card(
                    color: AppColors.primarySubtle,
                    child: Padding(
                      padding: const EdgeInsets.all(16.0),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'AUTHORIZED CUSTODY OPERATION',
                            style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.primary, letterSpacing: 0.5),
                          ),
                          const SizedBox(height: 12),
                          if (canAcceptCollection)
                            ElevatedButton.icon(
                              onPressed: _isPerformingAction
                                  ? null
                                  : () => _executeHandover('COLLECTION_ACCEPTED', 'Custody accepted by collection staff.'),
                              icon: const Icon(Icons.check_circle_outline),
                              label: const Text('Accept Custody into Collection'),
                            ),
                          if (canStartTransport)
                            ElevatedButton.icon(
                              onPressed: _isPerformingAction
                                  ? null
                                  : () => _executeHandover('TRANSPORT_STARTED', 'Vehicle transit run commenced.'),
                              icon: const Icon(Icons.local_shipping_outlined),
                              label: const Text('Start Transport Run'),
                            ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                ],

                // Custody Timeline Section
                const Text(
                  'IMMUTABLE CUSTODY TIMELINE',
                  style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.textMuted, letterSpacing: 0.5),
                ),
                const SizedBox(height: 12),
                historyAsync.when(
                  data: (events) => CustodyTimelineWidget(events: events, currentStatus: batch.status),
                  loading: () => const Center(child: CircularProgressIndicator()),
                  error: (e, _) => Text('Error loading history: $e'),
                ),
              ],
            ),
          );
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Error: $e')),
      ),
    );
  }
}
