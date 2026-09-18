import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:vyomcare_mobile/core/theme/app_colors.dart';
import 'package:vyomcare_mobile/shared/widgets/shared_widgets.dart';
import 'package:vyomcare_mobile/features/waste_batches/providers/waste_batch_provider.dart';

class WasteBatchesListScreen extends ConsumerStatefulWidget {
  const WasteBatchesListScreen({super.key});

  @override
  ConsumerState<WasteBatchesListScreen> createState() => _WasteBatchesListScreenState();
}

class _WasteBatchesListScreenState extends ConsumerState<WasteBatchesListScreen> {
  String? _selectedStatusFilter;

  final List<String> _statusFilters = [
    'ALL',
    'REGISTERED',
    'QR_ASSIGNED',
    'COLLECTED',
    'IN_TRANSIT',
    'RECEIVED',
    'TREATED',
    'VERIFIED_CLOSED',
  ];

  String _formatDate(String isoString) {
    try {
      final dt = DateTime.parse(isoString).toLocal();
      return DateFormat('dd MMM, hh:mm a').format(dt);
    } catch (_) {
      return isoString;
    }
  }

  @override
  Widget build(BuildContext context) {
    final statusQuery = _selectedStatusFilter == 'ALL' ? null : _selectedStatusFilter;
    final batchesAsync = ref.watch(batchesListFutureProvider(statusQuery));

    return Scaffold(
      appBar: AppBar(
        title: const Text('Waste Manifest Registry', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
        actions: [
          IconButton(
            icon: const Icon(Icons.qr_code_scanner),
            onPressed: () => context.push('/scan'),
          ),
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => ref.invalidate(batchesListFutureProvider(statusQuery)),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => context.push('/waste-batches/new'),
        backgroundColor: AppColors.primary,
        icon: const Icon(Icons.add, color: Colors.white),
        label: const Text('New Batch', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
      ),
      body: Column(
        children: [
          // Filter Chips Row
          Container(
            height: 48,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: _statusFilters.length,
              separatorBuilder: (_, __) => const SizedBox(width: 8),
              itemBuilder: (context, index) {
                final status = _statusFilters[index];
                final isSelected = (_selectedStatusFilter == null && status == 'ALL') ||
                    _selectedStatusFilter == status;

                return ChoiceChip(
                  label: Text(status.replaceAll('_', ' '), style: const TextStyle(fontSize: 11)),
                  selected: isSelected,
                  selectedColor: AppColors.primarySubtle,
                  labelStyle: TextStyle(
                    color: isSelected ? AppColors.primary : AppColors.textSecondary,
                    fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                  ),
                  onSelected: (selected) {
                    setState(() {
                      _selectedStatusFilter = status == 'ALL' ? null : status;
                    });
                  },
                );
              },
            ),
          ),
          const Divider(height: 1),

          // List content
          Expanded(
            child: batchesAsync.when(
              data: (batches) {
                if (batches.isEmpty) {
                  return const Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.inventory_2_outlined, size: 48, color: AppColors.textMuted),
                        SizedBox(height: 12),
                        Text('No waste batches found in this view.', style: TextStyle(color: AppColors.textSecondary)),
                      ],
                    ),
                  );
                }

                return ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: batches.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 12),
                  itemBuilder: (context, index) {
                    final batch = batches[index];

                    return Card(
                      child: InkWell(
                        onTap: () => context.push('/waste-batches/${batch.id}'),
                        borderRadius: BorderRadius.circular(AppRadius.lg),
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
                                      fontWeight: FontWeight.bold,
                                      fontSize: 14,
                                    ),
                                  ),
                                  StatusBadge(status: batch.status, isSmall: true),
                                ],
                              ),
                              const SizedBox(height: 8),
                              CategoryBadge(category: batch.category, isSmall: true),
                              const SizedBox(height: 12),
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Text(
                                    '${batch.quantity} ${batch.unit} • ${batch.department}',
                                    style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.textSecondary),
                                  ),
                                  Text(
                                    _formatDate(batch.createdAt),
                                    style: const TextStyle(fontSize: 11, color: AppColors.textMuted),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ),
                    );
                  },
                );
              },
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (e, _) => Center(
                child: Text('Failed to load batches: $e', style: const TextStyle(color: AppColors.danger)),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
