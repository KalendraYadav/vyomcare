import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:vyomcare_mobile/core/theme/app_colors.dart';
import 'package:vyomcare_mobile/core/network/api_client.dart';
import 'package:vyomcare_mobile/models/domain_models.dart';
import 'package:vyomcare_mobile/shared/widgets/shared_widgets.dart';
import 'package:vyomcare_mobile/features/auth/providers/auth_provider.dart';

class DashboardRepository {
  final ApiClient _apiClient;

  DashboardRepository(this._apiClient);

  Future<Map<String, dynamic>> getHospitalDashboard() async {
    final response = await _apiClient.get<Map<String, dynamic>>('/dashboard/hospital');
    return response.data ?? {};
  }

  Future<Map<String, dynamic>> getFacilityDashboard() async {
    final response = await _apiClient.get<Map<String, dynamic>>('/dashboard/facility');
    return response.data ?? {};
  }

  Future<Map<String, dynamic>> getGovernmentDashboard() async {
    final response = await _apiClient.get<Map<String, dynamic>>('/dashboard/government');
    return response.data ?? {};
  }
}

final dashboardRepositoryProvider = Provider<DashboardRepository>((ref) {
  final apiClient = ref.watch(apiClientProvider);
  return DashboardRepository(apiClient);
});

final hospitalDashboardFutureProvider = FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  return ref.watch(dashboardRepositoryProvider).getHospitalDashboard();
});

final facilityDashboardFutureProvider = FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  return ref.watch(dashboardRepositoryProvider).getFacilityDashboard();
});

final governmentDashboardFutureProvider = FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  return ref.watch(dashboardRepositoryProvider).getGovernmentDashboard();
});

class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authStateProvider);
    final user = authState.user;

    if (user == null) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    final isHospital = user.role == UserRole.HOSPITAL_ADMIN || user.role == UserRole.HOSPITAL_STAFF;
    final isTreatment = user.role == UserRole.TREATMENT_FACILITY_STAFF;
    final isGovt = user.role == UserRole.GOVERNMENT_AUTHORITY || user.role == UserRole.SUPER_ADMIN;

    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              user.name,
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
            ),
            Text(
              user.role.name.replaceAll('_', ' '),
              style: const TextStyle(fontSize: 11, color: AppColors.textSecondary),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.qr_code_scanner),
            onPressed: () => context.push('/scan'),
          ),
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () async {
              await ref.read(authStateProvider.notifier).logout();
              if (context.mounted) context.go('/login');
            },
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (isHospital) ...[
              _buildHospitalView(context, ref),
            ] else if (isTreatment) ...[
              _buildTreatmentView(context, ref),
            ] else if (isGovt) ...[
              _buildGovtView(context, ref),
            ] else ...[
              _buildGenericRoleView(context, user),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildHospitalView(BuildContext context, WidgetRef ref) {
    final dashAsync = ref.watch(hospitalDashboardFutureProvider);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text('HOSPITAL OVERVIEW', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.textMuted)),
            TextButton.icon(
              onPressed: () => ref.invalidate(hospitalDashboardFutureProvider),
              icon: const Icon(Icons.refresh, size: 14),
              label: const Text('Refresh', style: TextStyle(fontSize: 11)),
            ),
          ],
        ),
        const SizedBox(height: 8),
        dashAsync.when(
          data: (data) {
            final total = (data['totalRegistered'] ?? 0).toString();
            final pending = (data['pendingCollection'] ?? 0).toString();
            final inTransit = (data['inTransit'] ?? 0).toString();
            final compliance = '${data['complianceRate'] ?? 100}%';

            return Column(
              children: [
                Row(
                  children: [
                    Expanded(child: KpiCard(title: 'Total Logged', value: total, icon: Icons.inventory_2_outlined)),
                    const SizedBox(width: 12),
                    Expanded(child: KpiCard(title: 'Pending Pickup', value: pending, icon: Icons.hourglass_top_outlined, iconColor: AppColors.warning)),
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(child: KpiCard(title: 'In Transit', value: inTransit, icon: Icons.local_shipping_outlined, iconColor: AppColors.info)),
                    const SizedBox(width: 12),
                    Expanded(child: KpiCard(title: 'Compliance', value: compliance, icon: Icons.verified_user_outlined, iconColor: AppColors.success)),
                  ],
                ),
              ],
            );
          },
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => Text('Error: $e'),
        ),
        const SizedBox(height: 24),
        ElevatedButton.icon(
          onPressed: () => context.push('/waste-batches/new'),
          icon: const Icon(Icons.add),
          label: const Text('Register New Waste Manifest'),
        ),
        const SizedBox(height: 12),
        OutlinedButton.icon(
          onPressed: () => context.push('/waste-batches'),
          icon: const Icon(Icons.list_alt),
          label: const Text('View All Batches Registry'),
        ),
      ],
    );
  }

  Widget _buildTreatmentView(BuildContext context, WidgetRef ref) {
    final dashAsync = ref.watch(facilityDashboardFutureProvider);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('CBWTF TREATMENT FACILITY HUD', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.textMuted)),
        const SizedBox(height: 12),
        dashAsync.when(
          data: (data) {
            final incoming = (data['incoming'] ?? 0).toString();
            final received = (data['received'] ?? 0).toString();
            final treated = (data['treatedToday'] ?? 0).toString();

            return Column(
              children: [
                Row(
                  children: [
                    Expanded(child: KpiCard(title: 'Incoming Vans', value: incoming, icon: Icons.local_shipping_outlined, iconColor: AppColors.info)),
                    const SizedBox(width: 12),
                    Expanded(child: KpiCard(title: 'Awaiting Treat', value: received, icon: Icons.hourglass_bottom_outlined, iconColor: AppColors.warning)),
                  ],
                ),
                const SizedBox(height: 12),
                KpiCard(title: 'Treated / Closed Today', value: treated, icon: Icons.local_fire_department_outlined, iconColor: AppColors.success),
              ],
            );
          },
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => Text('Error: $e'),
        ),
        const SizedBox(height: 24),
        ElevatedButton.icon(
          onPressed: () => context.push('/scan'),
          icon: const Icon(Icons.qr_code_scanner),
          label: const Text('Scan Incoming Bag Barcode'),
        ),
      ],
    );
  }

  Widget _buildGovtView(BuildContext context, WidgetRef ref) {
    final dashAsync = ref.watch(governmentDashboardFutureProvider);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('STATE POLLUTION CONTROL BOARD (CPCB) OVERVIEW', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.textMuted)),
        const SizedBox(height: 12),
        dashAsync.when(
          data: (data) {
            final facilities = (data['totalFacilities'] ?? 0).toString();
            final inTransit = (data['inTransit'] ?? 0).toString();
            final alerts = (data['openAlerts'] ?? 0).toString();

            return Column(
              children: [
                Row(
                  children: [
                    Expanded(child: KpiCard(title: 'Facilities', value: facilities, icon: Icons.apartment_outlined)),
                    const SizedBox(width: 12),
                    Expanded(child: KpiCard(title: 'Active Runs', value: inTransit, icon: Icons.local_shipping_outlined, iconColor: AppColors.info)),
                  ],
                ),
                const SizedBox(height: 12),
                KpiCard(title: 'Open Statutory Alerts', value: alerts, icon: Icons.warning_amber_outlined, iconColor: AppColors.danger),
              ],
            );
          },
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => Text('Error: $e'),
        ),
        const SizedBox(height: 24),
        ElevatedButton.icon(
          onPressed: () => context.push('/waste-batches'),
          icon: const Icon(Icons.shield_outlined),
          label: const Text('Inspect State Waste Batches'),
        ),
      ],
    );
  }

  Widget _buildGenericRoleView(BuildContext context, AuthUser user) {
    return Column(
      children: [
        Card(
          child: Padding(
            padding: const EdgeInsets.all(20.0),
            child: Column(
              children: [
                const Icon(Icons.account_circle_outlined, size: 48, color: AppColors.primary),
                const SizedBox(height: 12),
                Text(
                  'Welcome, ${user.name}',
                  style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 4),
                Text(
                  user.facility?.name ?? 'VyomCare Platform Member',
                  style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 20),
        ElevatedButton.icon(
          onPressed: () => context.push('/scan'),
          icon: const Icon(Icons.qr_code_scanner),
          label: const Text('Open Universal QR Scanner'),
        ),
      ],
    );
  }
}
