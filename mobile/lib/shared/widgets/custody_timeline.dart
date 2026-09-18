import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../core/theme/app_colors.dart';
import '../../models/domain_models.dart';

class CustodyTimelineWidget extends StatelessWidget {
  final List<CustodyEvent> events;
  final String currentStatus;

  const CustodyTimelineWidget({
    super.key,
    required this.events,
    required this.currentStatus,
  });

  String _formatDate(String isoString) {
    try {
      final dt = DateTime.parse(isoString).toLocal();
      return DateFormat('dd MMM yyyy, hh:mm a').format(dt);
    } catch (_) {
      return isoString;
    }
  }

  IconData _getEventIcon(String eventType) {
    switch (eventType) {
      case 'REGISTERED':
        return Icons.add_circle_outline;
      case 'QR_ASSIGNED':
        return Icons.qr_code_2;
      case 'COLLECTION_ACCEPTED':
        return Icons.check_circle_outline;
      case 'TRANSPORT_STARTED':
      case 'TRANSPORT_UPDATED':
        return Icons.local_shipping_outlined;
      case 'ARRIVAL_VERIFIED':
        return Icons.verified_user_outlined;
      case 'TREATMENT_CONFIRMED':
      case 'VERIFIED_CLOSED':
        return Icons.local_fire_department_outlined;
      default:
        return Icons.circle_outlined;
    }
  }

  @override
  Widget build(BuildContext context) {
    if (events.isEmpty) {
      return const Padding(
        padding: EdgeInsets.all(24.0),
        child: Center(
          child: Text(
            'No physical custody transfers logged yet.',
            style: TextStyle(fontSize: 13, color: AppColors.textMuted),
          ),
        ),
      );
    }

    return ListView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: events.length,
      itemBuilder: (context, index) {
        final event = events[index];
        final isLast = index == events.length - 1;
        final icon = _getEventIcon(event.eventType);

        return IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Timeline Column (Node + Line)
              Column(
                children: [
                  Container(
                    width: 32,
                    height: 32,
                    decoration: BoxDecoration(
                      color: AppColors.primarySubtle,
                      shape: BoxShape.circle,
                      border: Border.all(color: AppColors.primary, width: 2),
                    ),
                    child: Icon(icon, size: 16, color: AppColors.primary),
                  ),
                  if (!isLast)
                    Expanded(
                      child: Container(
                        width: 2,
                        color: AppColors.border,
                        margin: const EdgeInsets.symmetric(vertical: 4),
                      ),
                    ),
                ],
              ),
              const SizedBox(width: 12),
              // Content Column
              Expanded(
                child: Padding(
                  padding: EdgeInsets.only(bottom: isLast ? 0 : 20.0),
                  child: Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: AppColors.surface,
                      borderRadius: BorderRadius.circular(AppRadius.md),
                      border: Border.all(color: AppColors.border),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              event.eventType.replaceAll('_', ' '),
                              style: const TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.bold,
                                color: AppColors.textPrimary,
                              ),
                            ),
                            Text(
                              _formatDate(event.occurredAt),
                              style: const TextStyle(
                                fontSize: 11,
                                color: AppColors.textMuted,
                              ),
                            ),
                          ],
                        ),
                        if (event.notes != null && event.notes!.isNotEmpty) ...[
                          const SizedBox(height: 4),
                          Text(
                            event.notes!,
                            style: const TextStyle(
                              fontSize: 12,
                              color: AppColors.textSecondary,
                            ),
                          ),
                        ],
                        if (event.fromUser != null || event.toUser != null) ...[
                          const SizedBox(height: 6),
                          Row(
                            children: [
                              if (event.fromUser != null)
                                Text(
                                  'From: ${event.fromUser!['name'] ?? 'Staff'}',
                                  style: const TextStyle(fontSize: 11, color: AppColors.textMuted),
                                ),
                              if (event.fromUser != null && event.toUser != null)
                                const Text(' → ', style: TextStyle(fontSize: 11, color: AppColors.textMuted)),
                              if (event.toUser != null)
                                Text(
                                  'To: ${event.toUser!['name'] ?? 'Staff'}',
                                  style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
                                ),
                            ],
                          ),
                        ],
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
