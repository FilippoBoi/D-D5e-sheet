// Prove di interfaccia: l'app parte, si usa come quella web e le descrizioni sono collegate.
import 'package:dnd5e_sheet/app_controller.dart';
import 'package:dnd5e_sheet/auth/account_service.dart';
import 'package:dnd5e_sheet/auth/auth_service.dart';
import 'package:dnd5e_sheet/session_controller.dart';
import 'package:dnd5e_sheet/i18n.dart';
import 'package:dnd5e_sheet/main.dart';
import 'package:material_ui/material_ui.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'fake_backend.dart';

Future<AppController> boot(WidgetTester tester, {Map<String, Object> prefs = const {}}) async {
  // La lingua predefinita dipende dal dispositivo (nei test è l'inglese): si fissa l'italiano.
  SharedPreferences.setMockInitialValues({'dnd5e-character-sheet:lang': '"it"', ...prefs});
  setLang('it');
  final app = (await tester.runAsync(AppController.load))!;
  tester.view.physicalSize = const Size(1000, 9000);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  addTearDown(app.dispose);
  await tester.pumpWidget(SheetApp(app: app, enableRemote: false));
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

  testWidgets('un giocatore entra con il token, vede la scheda condivisa e la barra di sessione', (tester) async {
    final app = await boot(tester);
    final backend = FakeBackend()
      ..doc = {'info': {'name': 'Thalia'}}
      ..revision = 1;
    final api = apiFor(backend);
    final account = AccountService(url: 'https://x.test', anonKey: 'k', storage: app.storage);
    final session = SessionController(app: app, auth: AuthService(api: api, storage: app.storage, account: account), api: api, pollEvery: const Duration(hours: 1));
    addTearDown(session.dispose);
    await tester.pumpWidget(SheetApp(key: UniqueKey(), app: app, session: session, enableRemote: false));
    await tester.pump();

    await tester.tap(find.text('Accedi / Campagna'));
    await tester.pumpAndSettle();
    await tester.enterText(find.widgetWithText(TextField, 'PG-XXXX-XXXX-XXXX'), 'pg-aaaa-bbbb-cccc');
    await tester.tap(find.text('Entra'));
    await tester.pumpAndSettle();

    expect(find.text('Giocatore'), findsWidgets);
    expect(find.text('Thalia'), findsWidgets);
    expect(find.textContaining('sincronizzata'), findsOneWidget);
    expect((app.model.state['info'] as Map)['name'], 'Thalia');
    expect(app.isRemote, isTrue);

    // Una modifica locale arriva al server; uscendo si torna alla scheda locale.
    app.model.set('info.player', 'Mario');
    await app.saveNow();
    expect((backend.doc['info'] as Map)['player'], 'Mario');
    await tester.tap(find.text('Esci'));
    // L'uscita passa da operazioni asincrone reali (salvataggi): si lascia girare il ciclo vero.
    await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 100)));
    await tester.pumpAndSettle();
    expect(app.isRemote, isFalse);
    expect(find.text('Accedi / Campagna'), findsOneWidget);
  });
}
