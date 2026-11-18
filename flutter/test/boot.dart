// Avvio dell'app nei test di interfaccia, con dimensione dello schermo e testo scelti.
import 'package:dnd5e_sheet/app_controller.dart';
import 'package:dnd5e_sheet/i18n.dart';
import 'package:dnd5e_sheet/main.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Schermi di riferimento (px logici): tablet in orizzontale e in verticale, tablet piccolo, telefono.
const tabletLandscape = Size(1280, 800);
const tabletPortrait = Size(800, 1280);
const smallTablet = Size(600, 960);
const phone = Size(360, 740);

Future<AppController> boot(WidgetTester tester, {Map<String, Object> prefs = const {}, Size size = const Size(1000, 9000), double textScale = 1}) async {
  // La lingua predefinita dipende dal dispositivo (nei test è l'inglese): si fissa l'italiano.
  SharedPreferences.setMockInitialValues({'dnd5e-character-sheet:lang': '"it"', ...prefs});
  setLang('it');
  final app = (await tester.runAsync(AppController.load))!;
  tester.view.physicalSize = size;
  tester.view.devicePixelRatio = 1;
  tester.platformDispatcher.textScaleFactorTestValue = textScale;
  addTearDown(tester.view.reset);
  addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
  addTearDown(app.dispose);
  await tester.pumpWidget(SheetApp(app: app, enableRemote: false));
  await tester.pump();
  return app;
}
