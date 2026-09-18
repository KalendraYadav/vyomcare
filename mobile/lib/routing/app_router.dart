import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../features/auth/presentation/login_screen.dart';
import '../features/dashboard/presentation/dashboard_screen.dart';
import '../features/waste_batches/presentation/waste_batches_list_screen.dart';
import '../features/waste_batches/presentation/new_waste_batch_screen.dart';
import '../features/waste_batches/presentation/waste_batch_detail_screen.dart';
import '../features/waste_batches/presentation/print_qr_screen.dart';
import '../features/scanner/presentation/universal_scanner_screen.dart';
import '../features/transport/presentation/driver_mode_screen.dart';
import '../features/auth/providers/auth_provider.dart';

final appRouterProvider = Provider<GoRouter>((ref) {
  final authState = ref.watch(authStateProvider);

  return GoRouter(
    initialLocation: '/dashboard',
    redirect: (context, state) {
      final isLoggingIn = state.uri.path == '/login';

      if (authState.isLoading) return null;

      if (!authState.isAuthenticated) {
        return isLoggingIn ? null : '/login';
      }

      if (isLoggingIn) {
        return '/dashboard';
      }

      return null;
    },
    routes: [
      GoRoute(
        path: '/login',
        builder: (context, state) => const LoginScreen(),
      ),
      GoRoute(
        path: '/dashboard',
        builder: (context, state) => const DashboardScreen(),
      ),
      GoRoute(
        path: '/waste-batches',
        builder: (context, state) => const WasteBatchesListScreen(),
      ),
      GoRoute(
        path: '/waste-batches/new',
        builder: (context, state) => const NewWasteBatchScreen(),
      ),
      GoRoute(
        path: '/waste-batches/:id',
        builder: (context, state) {
          final id = state.pathParameters['id'] ?? '';
          return WasteBatchDetailScreen(batchId: id);
        },
      ),
      GoRoute(
        path: '/waste-batches/:id/print-qr',
        builder: (context, state) {
          final id = state.pathParameters['id'] ?? '';
          return PrintQrScreen(batchId: id);
        },
      ),
      GoRoute(
        path: '/scan',
        builder: (context, state) => const UniversalScannerScreen(),
      ),
      GoRoute(
        path: '/transport/driver-mode',
        builder: (context, state) => const DriverModeScreen(),
      ),
    ],
  );
});
