import 'package:material_ui/material_ui.dart';

import 'app_controller.dart';
import 'i18n.dart';
import 'ui/sheet_page.dart';
import 'ui/theme.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final app = await AppController.load();
  runApp(SheetApp(app: app));
}

class SheetApp extends StatelessWidget {
  const SheetApp({super.key, required this.app});
  final AppController app;

  @override
  Widget build(BuildContext context) => ListenableBuilder(
        listenable: app,
        builder: (context, _) => MaterialApp(
          title: tr('Scheda Personaggio D&D 5E'),
          debugShowCheckedModeBanner: false,
          theme: buildTheme(Brightness.light),
          darkTheme: buildTheme(Brightness.dark),
          themeMode: app.themeMode,
          locale: Locale(app.language),
          localizationsDelegates: GlobalMaterialLocalizations.delegates,
          supportedLocales: [for (final l in supportedLanguages) Locale(l.code)],
          home: SheetPage(app: app),
        ),
      );
}
