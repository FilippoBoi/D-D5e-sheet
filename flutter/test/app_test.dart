// Prove di interfaccia: l'app parte, si usa come quella web e le descrizioni sono collegate.
import 'package:dnd5e_sheet/app_controller.dart';
import 'package:dnd5e_sheet/i18n.dart';
import 'package:dnd5e_sheet/main.dart';
import 'package:material_ui/material_ui.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

Future<AppController> boot(WidgetTester tester, {Map<String, Object> prefs = const {}}) async {
  // La lingua predefinita dipende dal dispositivo (nei test è l'inglese): si fissa l'italiano.
  SharedPreferences.setMockInitialValues({'dnd5e-character-sheet:lang': '"it"', ...prefs});
  setLang('it');
  final app = (await tester.runAsync(AppController.load))!;
  tester.view.physicalSize = const Size(1000, 9000);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  addTearDown(app.dispose);
  await tester.pumpWidget(SheetApp(app: app));
  await tester.pump();
  return app;
}

void main() {
  tearDown(() => setLang('it'));

  testWidgets('parte con la scheda vuota e il riepilogo', (tester) async {
    await boot(tester);
    expect(find.text('Scheda Personaggio'), findsOneWidget);
    expect(find.text('Classe Armatura'), findsOneWidget);
    expect(find.text('Informazioni Generali & Classe'), findsOneWidget);
  });

  testWidgets('cambiare lingua traduce la UI', (tester) async {
    final app = await boot(tester);
    app.setLanguage('en');
    await tester.pump();
    expect(find.text('Character Sheet'), findsOneWidget);
    expect(find.text('Armor Class'), findsOneWidget);
  });

  testWidgets('il pulsante «i» di un\'abilità apre la descrizione', (tester) async {
    await boot(tester);
    await tester.tap(find.byTooltip('Descrizione: Acrobazia'));
    await tester.pumpAndSettle();
    expect(find.textContaining('La tua prova di Destrezza (Acrobazia)', findRichText: true), findsWidgets);
  });

  testWidgets('un mago sceglie un trucchetto dal popup e ne legge la descrizione', (tester) async {
    final app = await boot(tester);
    app.setPanelOpen('spells', true);
    app.model.set('info.classId', 'wizard');
    await tester.pump();
    final pick = find.text('+ Scegli trucchetti');
    await tester.tap(pick);
    await tester.pumpAndSettle();
    await tester.enterText(find.descendant(of: find.byType(Dialog), matching: find.byType(TextField)).first, 'spruzzo');
    await tester.pumpAndSettle();
    expect(find.text('Spruzzo Acido'), findsOneWidget);
    // Il file dei testi si legge da disco: nei test va caricato fuori dal tempo simulato.
    await tester.runAsync(() => app.spellText('phb-acid-splash'));
    await tester.tap(find.byTooltip('Descrizione: Spruzzo Acido'));
    await tester.pumpAndSettle();
    expect(find.textContaining('Scagli una bolla di acido', findRichText: true), findsWidgets);
    await tester.tap(find.text('Chiudi').last);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Spruzzo Acido'));
    await tester.pumpAndSettle();
    expect((app.model.state['spells'] as Map)['cantripIds'], ['phb-acid-splash']);
  });

  testWidgets('il salvataggio ripristina il personaggio', (tester) async {
    final app = await boot(tester);
    app.model.set('info.name', 'Thalia');
    await app.saveNow();
    final saved = app.storage.loadCharacter();
    expect((saved as Map)['info']['name'], 'Thalia');
  });
}
