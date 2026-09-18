import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:printing/printing.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:vyomcare_mobile/core/theme/app_colors.dart';
import 'package:vyomcare_mobile/features/waste_batches/providers/waste_batch_provider.dart';

class PrintQrScreen extends ConsumerStatefulWidget {
  final String batchId;

  const PrintQrScreen({super.key, required this.batchId});

  @override
  ConsumerState<PrintQrScreen> createState() => _PrintQrScreenState();
}

class _PrintQrScreenState extends ConsumerState<PrintQrScreen> {
  String? _qrCodeValue;
  bool _isGenerating = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _fetchOrGenerateQr();
  }

  void _fetchOrGenerateQr() async {
    setState(() => _isGenerating = true);
    try {
      final repo = ref.read(wasteBatchRepositoryProvider);
      final batch = await repo.getBatchById(widget.batchId);

      if (batch.qrCode != null && batch.qrCode!.codeValue.isNotEmpty) {
        setState(() {
          _qrCodeValue = batch.qrCode!.codeValue;
          _isGenerating = false;
        });
      } else {
        final res = await repo.generateQr(widget.batchId);
        final qrMap = res['qrCode'] as Map<String, dynamic>?;
        setState(() {
          _qrCodeValue = qrMap?['codeValue'] ?? 'BIOTRACK:${batch.wasteId}';
          _isGenerating = false;
        });
      }
    } catch (e) {
      setState(() {
        _isGenerating = false;
        _errorMessage = 'Failed to generate QR code: $e';
      });
    }
  }

  Future<void> _printLabel(String wasteId, String department, double quantity, String unit, String categoryName) async {
    final pdf = pw.Document();

    pdf.addPage(
      pw.Page(
        pageFormat: const PdfPageFormat(58 * PdfPageFormat.mm, 50 * PdfPageFormat.mm, marginAll: 2 * PdfPageFormat.mm),
        build: (pw.Context context) {
          return pw.Column(
            crossAxisAlignment: pw.CrossAxisAlignment.center,
            mainAxisAlignment: pw.MainAxisAlignment.center,
            children: [
              pw.Text('VYOMCARE BMW MANIFEST', style: pw.TextStyle(fontSize: 8, fontWeight: pw.FontWeight.bold)),
              pw.SizedBox(height: 2),
              pw.BarcodeWidget(
                data: _qrCodeValue ?? wasteId,
                barcode: pw.Barcode.qrCode(),
                width: 70,
                height: 70,
              ),
              pw.SizedBox(height: 2),
              pw.Text(wasteId, style: pw.TextStyle(fontSize: 9, fontWeight: pw.FontWeight.bold)),
              pw.Text('$quantity $unit | $categoryName', style: const pw.TextStyle(fontSize: 7)),
              pw.Text('Ward: $department', style: const pw.TextStyle(fontSize: 7)),
            ],
          );
        },
      ),
    );

    await Printing.layoutPdf(onLayout: (PdfPageFormat format) async => pdf.save());
  }

  @override
  Widget build(BuildContext context) {
    final batchAsync = ref.watch(batchDetailFutureProvider(widget.batchId));

    return Scaffold(
      appBar: AppBar(
        title: const Text('CPCB Adhesive Barcode Label', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.go('/waste-batches'),
        ),
      ),
      body: batchAsync.when(
        data: (batch) {
          return Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(24.0),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  // Adhesive Label Card Mockup
                  Container(
                    width: 280,
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(AppRadius.lg),
                      border: Border.all(color: AppColors.border, width: 2),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withOpacity(0.08),
                          blurRadius: 16,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    child: Column(
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                          decoration: BoxDecoration(
                            color: AppColors.primaryDark,
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: const Text(
                            'CPCB STATUTORY MANIFEST',
                            style: TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.bold, letterSpacing: 0.5),
                          ),
                        ),
                        const SizedBox(height: 12),
                        if (_isGenerating)
                          const SizedBox(
                            height: 160,
                            child: Center(child: CircularProgressIndicator()),
                          )
                        else if (_qrCodeValue != null)
                          QrImageView(
                            data: _qrCodeValue!,
                            version: QrVersions.auto,
                            size: 160.0,
                          )
                        else
                          SizedBox(
                            height: 160,
                            child: Center(
                              child: Text(
                                _errorMessage ?? 'Unable to load barcode',
                                textAlign: TextAlign.center,
                                style: const TextStyle(color: AppColors.danger, fontSize: 12),
                              ),
                            ),
                          ),
                        const SizedBox(height: 12),
                        Text(
                          batch.wasteId,
                          style: const TextStyle(
                            fontFamily: 'monospace',
                            fontSize: 14,
                            fontWeight: FontWeight.w900,
                            color: AppColors.textPrimary,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '${batch.quantity} ${batch.unit} • ${batch.category?.name ?? "BMW"}',
                          style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppColors.textSecondary),
                        ),
                        Text(
                          batch.department,
                          style: const TextStyle(fontSize: 11, color: AppColors.textMuted),
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 24),

                  ElevatedButton.icon(
                    onPressed: _qrCodeValue == null
                        ? null
                        : () => _printLabel(
                              batch.wasteId,
                              batch.department,
                              batch.quantity,
                              batch.unit,
                              batch.category?.name ?? 'Waste',
                            ),
                    icon: const Icon(Icons.print_outlined),
                    label: const Text('Print Sticker Label (Thermal / PDF)'),
                  ),

                  const SizedBox(height: 12),

                  OutlinedButton.icon(
                    onPressed: () => context.push('/waste-batches/${batch.id}'),
                    icon: const Icon(Icons.visibility_outlined),
                    label: const Text('View Immutable Custody Record'),
                  ),
                ],
              ),
            ),
          );
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Error: $e')),
      ),
    );
  }
}
