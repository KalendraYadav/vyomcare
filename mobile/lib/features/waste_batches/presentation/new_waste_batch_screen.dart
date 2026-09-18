import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:vyomcare_mobile/core/theme/app_colors.dart';
import 'package:vyomcare_mobile/features/waste_batches/providers/waste_batch_provider.dart';
import 'package:uuid/uuid.dart';

class NewWasteBatchScreen extends ConsumerStatefulWidget {
  const NewWasteBatchScreen({super.key});

  @override
  ConsumerState<NewWasteBatchScreen> createState() => _NewWasteBatchScreenState();
}

class _NewWasteBatchScreenState extends ConsumerState<NewWasteBatchScreen> {
  final _formKey = GlobalKey<FormState>();
  String? _selectedCategoryId;
  final _departmentController = TextEditingController();
  final _quantityController = TextEditingController();
  final _photoUrlController = TextEditingController();
  String _selectedUnit = 'KG';
  bool _isSubmitting = false;
  String? _errorMessage;

  final String _idempotencyKey = const Uuid().v4();

  final List<String> _departmentPresets = [
    'ICU - Ward 3',
    'Surgery Suite A',
    'Pathology Lab',
    'Emergency Ward',
    'Maternity Ward',
    'Dialysis Unit',
  ];

  @override
  void dispose() {
    _departmentController.dispose();
    _quantityController.dispose();
    _photoUrlController.dispose();
    super.dispose();
  }

  void _handleSubmit() async {
    if (!_formKey.currentState!.validate()) return;
    if (_selectedCategoryId == null) {
      setState(() => _errorMessage = 'Please select a biomedical waste category.');
      return;
    }

    final quantity = double.tryParse(_quantityController.text.trim());
    if (quantity == null || quantity <= 0) {
      setState(() => _errorMessage = 'Please enter a valid numeric weight/quantity.');
      return;
    }

    setState(() {
      _isSubmitting = true;
      _errorMessage = null;
    });

    try {
      final repo = ref.read(wasteBatchRepositoryProvider);
      final batch = await repo.createBatch(
        categoryId: _selectedCategoryId!,
        department: _departmentController.text.trim(),
        quantity: quantity,
        unit: _selectedUnit,
        photoUrl: _photoUrlController.text.trim().isNotEmpty ? _photoUrlController.text.trim() : null,
        idempotencyKey: _idempotencyKey,
      );

      if (mounted) {
        context.pushReplacement('/waste-batches/${batch.id}/print-qr');
      }
    } catch (e) {
      setState(() {
        _isSubmitting = false;
        _errorMessage = e.toString();
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final categoriesAsync = ref.watch(categoriesFutureProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'Register Waste Batch',
          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Notice Header
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.primarySubtle,
                  borderRadius: BorderRadius.circular(AppRadius.md),
                  border: Border.all(color: AppColors.primary.withOpacity(0.2)),
                ),
                child: const Row(
                  children: [
                    Icon(Icons.inventory_2_outlined, color: AppColors.primary, size: 20),
                    SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Accurately categorize clinical waste according to CPCB Biomedical Waste Management Rules, 2016.',
                        style: TextStyle(fontSize: 12, color: AppColors.textPrimary),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),

              if (_errorMessage != null) ...[
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
                          _errorMessage!,
                          style: const TextStyle(fontSize: 12, color: AppColors.danger),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
              ],

              // Category Selector
              const Text(
                'BIOMEDICAL WASTE STREAM *',
                style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.textMuted, letterSpacing: 0.5),
              ),
              const SizedBox(height: 8),
              categoriesAsync.when(
                data: (categories) {
                  final active = categories.where((c) => c.isActive).toList();
                  return Column(
                    children: active.map((cat) {
                      final isSelected = _selectedCategoryId == cat.id;
                      Color catColor = AppColors.yellowStream;
                      try {
                        catColor = Color(int.parse('FF${cat.colorCode.replaceAll('#', '')}', radix: 16));
                      } catch (_) {}

                      return Padding(
                        padding: const EdgeInsets.only(bottom: 8.0),
                        child: InkWell(
                          onTap: () => setState(() => _selectedCategoryId = cat.id),
                          borderRadius: BorderRadius.circular(AppRadius.md),
                          child: Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: isSelected ? AppColors.primarySubtle : AppColors.surface,
                              borderRadius: BorderRadius.circular(AppRadius.md),
                              border: Border.all(
                                color: isSelected ? AppColors.primary : AppColors.border,
                                width: isSelected ? 2 : 1,
                              ),
                            ),
                            child: Row(
                              children: [
                                Container(
                                  width: 16,
                                  height: 16,
                                  decoration: BoxDecoration(
                                    color: catColor,
                                    shape: BoxShape.circle,
                                  ),
                                ),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        cat.name,
                                        style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
                                      ),
                                      if (cat.description != null)
                                        Text(
                                          cat.description!,
                                          style: const TextStyle(fontSize: 11, color: AppColors.textSecondary),
                                        ),
                                    ],
                                  ),
                                ),
                                if (isSelected)
                                  const Icon(Icons.check_circle, color: AppColors.primary, size: 20),
                              ],
                            ),
                          ),
                        ),
                      );
                    }).toList(),
                  );
                },
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (e, _) => Text('Failed to load categories: $e', style: const TextStyle(color: AppColors.danger)),
              ),

              const SizedBox(height: 16),

              // Ward / Department
              const Text(
                'WARD / ORIGIN DEPARTMENT *',
                style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.textMuted, letterSpacing: 0.5),
              ),
              const SizedBox(height: 6),
              TextFormField(
                controller: _departmentController,
                decoration: const InputDecoration(
                  hintText: 'e.g. ICU - Ward 3, Pathology Lab',
                  prefixIcon: Icon(Icons.local_hospital_outlined, size: 20),
                ),
                validator: (v) => (v == null || v.trim().isEmpty) ? 'Ward name is required' : null,
              ),
              const SizedBox(height: 6),
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: _departmentPresets.map((dept) {
                  return ActionChip(
                    label: Text(dept, style: const TextStyle(fontSize: 11)),
                    onPressed: () => setState(() => _departmentController.text = dept),
                  );
                }).toList(),
              ),

              const SizedBox(height: 16),

              // Quantity and Unit
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    flex: 3,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'NET QUANTITY *',
                          style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.textMuted, letterSpacing: 0.5),
                        ),
                        const SizedBox(height: 6),
                        TextFormField(
                          controller: _quantityController,
                          keyboardType: const TextInputType.numberWithOptions(decimal: true),
                          decoration: const InputDecoration(
                            hintText: 'e.g. 14.50',
                            prefixIcon: Icon(Icons.scale_outlined, size: 20),
                          ),
                          validator: (v) => (v == null || v.trim().isEmpty) ? 'Quantity required' : null,
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    flex: 2,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'UNIT *',
                          style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.textMuted, letterSpacing: 0.5),
                        ),
                        const SizedBox(height: 6),
                        DropdownButtonFormField<String>(
                          value: _selectedUnit,
                          decoration: const InputDecoration(contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 12)),
                          items: const [
                            DropdownMenuItem(value: 'KG', child: Text('KG (Weight)')),
                            DropdownMenuItem(value: 'COUNT', child: Text('COUNT')),
                          ],
                          onChanged: (v) => setState(() => _selectedUnit = v ?? 'KG'),
                        ),
                      ],
                    ),
                  ),
                ],
              ),

              const SizedBox(height: 16),

              // Photo URL Proof (Optional)
              const Text(
                'PHOTO URL PROOF (OPTIONAL)',
                style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.textMuted, letterSpacing: 0.5),
              ),
              const SizedBox(height: 6),
              TextFormField(
                controller: _photoUrlController,
                decoration: const InputDecoration(
                  hintText: 'https://storage.vyomcare.in/bag-photo.jpg',
                  prefixIcon: Icon(Icons.camera_alt_outlined, size: 20),
                ),
              ),

              const SizedBox(height: 32),

              ElevatedButton.icon(
                onPressed: _isSubmitting ? null : _handleSubmit,
                icon: const Icon(Icons.qr_code_2_outlined),
                label: _isSubmitting
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2, valueColor: AlwaysStoppedAnimation(Colors.white)),
                      )
                    : const Text('Register & Generate QR Barcode'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
