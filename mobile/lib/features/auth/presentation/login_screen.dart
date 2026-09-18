import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:vyomcare_mobile/core/theme/app_colors.dart';
import 'package:vyomcare_mobile/core/config/app_config.dart';
import 'package:vyomcare_mobile/features/auth/providers/auth_provider.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController(text: 'admin@citygeneral.in');
  final _passwordController = TextEditingController(text: 'BioTrack@2026');
  final _customUrlController = TextEditingController();
  bool _obscurePassword = true;
  bool _showDevSettings = false;
  bool _isTestingConnection = false;
  String? _testResultText;
  bool? _testResultSuccess;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted && _customUrlController.text.isEmpty) {
        _customUrlController.text = ref.read(serverUrlProvider);
      }
    });
  }

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    _customUrlController.dispose();
    super.dispose();
  }

  void _handleLogin() async {
    if (!_formKey.currentState!.validate()) return;

    final email = _emailController.text.trim();
    final password = _passwordController.text.trim();

    final success = await ref.read(authStateProvider.notifier).login(email, password);
    if (success && mounted) {
      context.go('/dashboard');
    }
  }

  void _quickFillRole(String email, String roleTitle) {
    setState(() {
      _emailController.text = email;
      _passwordController.text = 'BioTrack@2026';
    });
  }

  Future<void> _handleTestConnection() async {
    setState(() {
      _isTestingConnection = true;
      _testResultText = null;
      _testResultSuccess = null;
    });

    final targetInput = _customUrlController.text.trim();
    final result = await ref.read(apiClientProvider).checkHealth(
      testUrl: targetInput.isNotEmpty ? targetInput : null,
    );

    if (!mounted) return;

    setState(() {
      _isTestingConnection = false;
      _testResultSuccess = result['success'] == true;
      if (result['success'] == true) {
        _testResultText = '✓ Connected (${result['latencyMs']}ms): Reachable at ${result['target']}';
      } else {
        _testResultText = '✗ ${result['error']}';
      }
    });
  }

  Future<void> _handleApplyCustomUrl() async {
    final rawUrl = _customUrlController.text.trim();
    if (rawUrl.isEmpty) return;

    debugPrint('[API CONFIG] Apply pressed');
    debugPrint('[API CONFIG] Raw URL: $rawUrl');

    try {
      final normalized = AppConfig.normalizeApiUrl(rawUrl);
      debugPrint('[API CONFIG] Normalized URL: $normalized');
      debugPrint('[API CONFIG] Saving URL...');
      await ref.read(secureStorageProvider).saveCustomApiUrl(normalized);
      debugPrint('[API CONFIG] URL saved');
      debugPrint('[API CONFIG] Updating ApiClient...');
      ref.read(apiClientProvider).updateBaseUrl(normalized);
      ref.read(serverUrlProvider.notifier).state = normalized;
      debugPrint('[API CONFIG] ApiClient updated');
      _customUrlController.text = normalized;

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Applied & saved API URL:\n$normalized'),
          backgroundColor: AppColors.success,
          duration: const Duration(seconds: 2),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Invalid URL format: $e'),
          backgroundColor: AppColors.danger,
        ),
      );
    }
  }

  Future<void> _handleResetUrl() async {
    debugPrint('[API CONFIG] Reset to default pressed');
    await ref.read(secureStorageProvider).removeCustomApiUrl();
    ref.read(apiClientProvider).resetBaseUrl();
    final defaultUrl = AppConfig.defaultBaseUrl;
    ref.read(serverUrlProvider.notifier).state = defaultUrl;
    _customUrlController.text = defaultUrl;

    if (!mounted) return;
    setState(() {
      _testResultText = null;
      _testResultSuccess = null;
    });
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Reset to default API URL:\n$defaultUrl'),
        duration: const Duration(seconds: 2),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authStateProvider);
    final currentBaseUrl = ref.watch(serverUrlProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 16.0),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // VyomCare Official Logo / Emblem
                Center(
                  child: Container(
                    width: 64,
                    height: 64,
                    decoration: BoxDecoration(
                      color: AppColors.primary,
                      borderRadius: BorderRadius.circular(AppRadius.lg),
                      boxShadow: [
                        BoxShadow(
                          color: AppColors.primary.withValues(alpha: 0.3),
                          blurRadius: 12,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    child: const Icon(
                      Icons.shield_outlined,
                      color: Colors.white,
                      size: 36,
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                const Text(
                  AppConfig.appName,
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 26,
                    fontWeight: FontWeight.w900,
                    color: AppColors.textPrimary,
                    letterSpacing: -0.5,
                  ),
                ),
                const SizedBox(height: 4),
                const Text(
                  AppConfig.systemSubtitle,
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                    color: AppColors.textSecondary,
                  ),
                ),
                const SizedBox(height: 32),

                // Error Banner
                if (authState.errorMessage != null) ...[
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: AppColors.dangerBg,
                      borderRadius: BorderRadius.circular(AppRadius.md),
                      border: Border.all(color: AppColors.dangerBorder),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.error_outline, color: AppColors.danger, size: 20),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            authState.errorMessage!,
                            style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w500,
                              color: AppColors.danger,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                ],

                // Card Form
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(20.0),
                    child: Form(
                      key: _formKey,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Sign in to your account',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w700,
                              color: AppColors.textPrimary,
                            ),
                          ),
                          const SizedBox(height: 16),
                          const Text(
                            'OFFICIAL EMAIL',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
                              color: AppColors.textMuted,
                              letterSpacing: 0.5,
                            ),
                          ),
                          const SizedBox(height: 6),
                          TextFormField(
                            controller: _emailController,
                            keyboardType: TextInputType.emailAddress,
                            decoration: const InputDecoration(
                              hintText: 'admin@citygeneral.in',
                              prefixIcon: Icon(Icons.email_outlined, size: 20),
                            ),
                            validator: (v) =>
                                (v == null || v.trim().isEmpty) ? 'Email is required' : null,
                          ),
                          const SizedBox(height: 16),
                          const Text(
                            'PASSWORD',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
                              color: AppColors.textMuted,
                              letterSpacing: 0.5,
                            ),
                          ),
                          const SizedBox(height: 6),
                          TextFormField(
                            controller: _passwordController,
                            obscureText: _obscurePassword,
                            decoration: InputDecoration(
                              hintText: 'Enter password',
                              prefixIcon: const Icon(Icons.lock_outline, size: 20),
                              suffixIcon: IconButton(
                                icon: Icon(
                                  _obscurePassword
                                      ? Icons.visibility_outlined
                                      : Icons.visibility_off_outlined,
                                  size: 20,
                                ),
                                onPressed: () {
                                  setState(() => _obscurePassword = !_obscurePassword);
                                },
                              ),
                            ),
                            validator: (v) =>
                                (v == null || v.trim().isEmpty) ? 'Password is required' : null,
                          ),
                          const SizedBox(height: 24),
                          ElevatedButton(
                            onPressed: authState.isLoading ? null : _handleLogin,
                            child: authState.isLoading
                                ? const SizedBox(
                                    width: 20,
                                    height: 20,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                      valueColor: AlwaysStoppedAnimation(Colors.white),
                                    ),
                                  )
                                : const Text('Authorize & Sign In'),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),

                const SizedBox(height: 16),

                // Quick Role Fill Pills for Testing & Demo
                Card(
                  color: AppColors.surface,
                  child: Padding(
                    padding: const EdgeInsets.all(12.0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'DEMO ACCOUNTS (REAL SEEDED ROLES)',
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.bold,
                            color: AppColors.textMuted,
                            letterSpacing: 0.5,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Wrap(
                          spacing: 6,
                          runSpacing: 6,
                          children: [
                            ActionChip(
                              label: const Text('Hospital Admin', style: TextStyle(fontSize: 11)),
                              onPressed: () => _quickFillRole('admin@citygeneral.in', 'Hospital Admin'),
                            ),
                            ActionChip(
                              label: const Text('Hospital Staff', style: TextStyle(fontSize: 11)),
                              onPressed: () => _quickFillRole('staff@citygeneral.in', 'Hospital Staff'),
                            ),
                            ActionChip(
                              label: const Text('Collection Staff', style: TextStyle(fontSize: 11)),
                              onPressed: () => _quickFillRole('collection@biotrack.in', 'Collection'),
                            ),
                            ActionChip(
                              label: const Text('Driver Mode', style: TextStyle(fontSize: 11)),
                              onPressed: () => _quickFillRole('transport@biotrack.in', 'Driver'),
                            ),
                            ActionChip(
                              label: const Text('CBWTF Treatment', style: TextStyle(fontSize: 11)),
                              onPressed: () => _quickFillRole('facility@greendispose.in', 'Treatment'),
                            ),
                            ActionChip(
                              label: const Text('State Pollution Board', style: TextStyle(fontSize: 11)),
                              onPressed: () => _quickFillRole('gov@mpcb.gov.in', 'Government'),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),

                const SizedBox(height: 12),

                // Server Configuration Toggle for Physical Devices
                Center(
                  child: TextButton.icon(
                    onPressed: () {
                      setState(() {
                        _showDevSettings = !_showDevSettings;
                        if (_showDevSettings && _customUrlController.text.isEmpty) {
                          _customUrlController.text = currentBaseUrl;
                        }
                      });
                    },
                    icon: const Icon(Icons.settings_outlined, size: 16),
                    label: Text(
                      _showDevSettings ? 'Hide Network Config' : 'Configure Server API URL',
                      style: const TextStyle(fontSize: 12),
                    ),
                  ),
                ),

                if (_showDevSettings) ...[
                  Card(
                    color: AppColors.surface,
                    child: Padding(
                      padding: const EdgeInsets.all(12.0),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              const Text(
                                'SERVER CONNECTION',
                                style: TextStyle(
                                  fontSize: 10,
                                  fontWeight: FontWeight.bold,
                                  color: AppColors.textMuted,
                                  letterSpacing: 0.5,
                                ),
                              ),
                              TextButton(
                                style: TextButton.styleFrom(
                                  padding: EdgeInsets.zero,
                                  minimumSize: const Size(50, 24),
                                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                                ),
                                onPressed: _handleResetUrl,
                                child: const Text('Reset to Default', style: TextStyle(fontSize: 11)),
                              ),
                            ],
                          ),
                          const SizedBox(height: 4),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                            decoration: BoxDecoration(
                              color: AppColors.background,
                              borderRadius: BorderRadius.circular(AppRadius.sm),
                              border: Border.all(color: AppColors.border),
                            ),
                            child: Row(
                              children: [
                                const Icon(Icons.link, size: 14, color: AppColors.textMuted),
                                const SizedBox(width: 6),
                                Expanded(
                                  child: Text(
                                    currentBaseUrl,
                                    style: const TextStyle(fontSize: 11, fontFamily: 'monospace'),
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 10),
                          TextFormField(
                            controller: _customUrlController,
                            style: const TextStyle(fontSize: 13, fontFamily: 'monospace'),
                            decoration: const InputDecoration(
                              hintText: 'e.g. http://192.168.1.20:3001/api',
                              labelText: 'Custom API Endpoint',
                              helperText: 'Accepts LAN IP with port :3001 (e.g. 192.168.1.20:3001)',
                              helperMaxLines: 2,
                              isDense: true,
                            ),
                          ),
                          const SizedBox(height: 10),

                          // Diagnostic test feedback
                          if (_testResultText != null) ...[
                            Container(
                              padding: const EdgeInsets.all(8),
                              decoration: BoxDecoration(
                                color: _testResultSuccess == true
                                    ? AppColors.successBg
                                    : AppColors.dangerBg,
                                borderRadius: BorderRadius.circular(AppRadius.sm),
                                border: Border.all(
                                  color: _testResultSuccess == true
                                      ? AppColors.successBorder
                                      : AppColors.dangerBorder,
                                ),
                              ),
                              child: Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Icon(
                                    _testResultSuccess == true
                                        ? Icons.check_circle_outline
                                        : Icons.error_outline,
                                    size: 16,
                                    color: _testResultSuccess == true
                                        ? AppColors.success
                                        : AppColors.danger,
                                  ),
                                  const SizedBox(width: 6),
                                  Expanded(
                                    child: Text(
                                      _testResultText!,
                                      style: TextStyle(
                                        fontSize: 11,
                                        fontWeight: FontWeight.w500,
                                        color: _testResultSuccess == true
                                            ? AppColors.success
                                            : AppColors.danger,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(height: 10),
                          ],

                          Row(
                            children: [
                              Expanded(
                                child: OutlinedButton.icon(
                                  icon: _isTestingConnection
                                      ? const SizedBox(
                                          width: 12,
                                          height: 12,
                                          child: CircularProgressIndicator(strokeWidth: 2),
                                        )
                                      : const Icon(Icons.network_check_outlined, size: 14),
                                  label: const Text('Test Connection', style: TextStyle(fontSize: 11)),
                                  onPressed: _isTestingConnection ? null : _handleTestConnection,
                                ),
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: ElevatedButton.icon(
                                  icon: const Icon(Icons.check, size: 14),
                                  label: const Text('Apply Custom URL', style: TextStyle(fontSize: 11)),
                                  onPressed: _handleApplyCustomUrl,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
