import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';
import '../../models/domain_models.dart';

class CategoryBadge extends StatelessWidget {
  final WasteCategory? category;
  final bool isSmall;

  const CategoryBadge({
    super.key,
    this.category,
    this.isSmall = false,
  });

  Color _parseColor(String? colorCode) {
    if (colorCode == null || colorCode.isEmpty) return AppColors.yellowStream;
    try {
      final hex = colorCode.replaceAll('#', '');
      return Color(int.parse('FF$hex', radix: 16));
    } catch (_) {
      return AppColors.yellowStream;
    }
  }

  @override
  Widget build(BuildContext context) {
    final catColor = _parseColor(category?.colorCode);
    final name = category?.name ?? 'Biomedical Waste';
    final code = category?.code ?? 'BMW';

    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: isSmall ? 6 : 10,
        vertical: isSmall ? 2 : 4,
      ),
      decoration: BoxDecoration(
        color: catColor.withOpacity(0.12),
        borderRadius: BorderRadius.circular(AppRadius.full),
        border: Border.all(color: catColor.withOpacity(0.4), width: 1),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: isSmall ? 6 : 8,
            height: isSmall ? 6 : 8,
            decoration: BoxDecoration(
              color: catColor,
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 6),
          Text(
            name,
            style: TextStyle(
              color: AppColors.textPrimary,
              fontSize: isSmall ? 11 : 12,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(width: 4),
          Text(
            '($code)',
            style: TextStyle(
              color: AppColors.textSecondary,
              fontSize: isSmall ? 10 : 11,
              fontFamily: 'monospace',
              fontWeight: FontWeight.bold,
            ),
          ),
        ],
      ),
    );
  }
}

class StatusBadge extends StatelessWidget {
  final String status;
  final bool isSmall;

  const StatusBadge({
    super.key,
    required this.status,
    this.isSmall = false,
  });

  @override
  Widget build(BuildContext context) {
    Color bg = AppColors.infoBg;
    Color border = AppColors.infoBorder;
    Color text = AppColors.info;

    final upper = status.toUpperCase();
    if (upper == 'VERIFIED_CLOSED' || upper == 'TREATED' || upper == 'APPROVED' || upper == 'ACTIVE') {
      bg = AppColors.successBg;
      border = AppColors.successBorder;
      text = AppColors.success;
    } else if (upper == 'VIOLATION' || upper == 'DEACTIVATED' || upper == 'SUSPENDED') {
      bg = AppColors.dangerBg;
      border = AppColors.dangerBorder;
      text = AppColors.danger;
    } else if (upper == 'IN_TRANSIT' || upper == 'COLLECTED' || upper == 'PENDING') {
      bg = AppColors.warningBg;
      border = AppColors.warningBorder;
      text = AppColors.warning;
    }

    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: isSmall ? 6 : 10,
        vertical: isSmall ? 2 : 4,
      ),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(AppRadius.full),
        border: Border.all(color: border, width: 1),
      ),
      child: Text(
        status.replaceAll('_', ' '),
        style: TextStyle(
          color: text,
          fontSize: isSmall ? 10 : 11,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.3,
        ),
      ),
    );
  }
}

class KpiCard extends StatelessWidget {
  final String title;
  final String value;
  final IconData icon;
  final Color iconColor;
  final String? subtitle;

  const KpiCard({
    super.key,
    required this.title,
    required this.value,
    required this.icon,
    this.iconColor = AppColors.primary,
    this.subtitle,
  });

  @override
  Widget build(BuildContext context) {
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
                  title.toUpperCase(),
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                    color: AppColors.textMuted,
                    letterSpacing: 0.5,
                  ),
                ),
                Icon(icon, color: iconColor, size: 20),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              value,
              style: const TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.w800,
                color: AppColors.textPrimary,
                letterSpacing: -0.5,
              ),
            ),
            if (subtitle != null) ...[
              const SizedBox(height: 4),
              Text(
                subtitle!,
                style: const TextStyle(
                  fontSize: 11,
                  color: AppColors.textSecondary,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
