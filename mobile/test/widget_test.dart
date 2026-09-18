import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:vyomcare_mobile/main.dart';

void main() {
  testWidgets('VyomCare app boots with provider scope', (WidgetTester tester) async {
    await tester.pumpWidget(
      const ProviderScope(
        child: VyomCareApp(),
      ),
    );

    // Initial pump
    await tester.pump();
    expect(find.byType(VyomCareApp), findsOneWidget);
  });
}
