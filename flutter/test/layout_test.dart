// Layout adattivo: navigazione, sezioni, due colonne, testo ingrandito e bersagli di tocco.
import 'package:dnd5e_sheet/data/catalog.dart';
import 'package:dnd5e_sheet/ui/sections.dart';
import 'package:flutter/semantics.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';

import 'boot.dart';

void main() {
  tearDown(() => SemanticsBinding.instance.ensureSemantics().dispose());

  testWidgets('tablet largo: barra laterale; stretto: barra in basso con le stesse sezioni', (tester) async {
    final app = await boot(tester, size: tabletLandscape);
    expect(find.byKey(const Key('nav-rail')), findsOneWidget);
    expect(find.byKey(const Key('nav-bar')), findsNothing);
    // Niente incantesimi per chi non lancia incantesimi.
    expect(find.text('Incantesimi'), findsNothing);
    for (final label in ['Gioco', 'Privilegi e risorse', 'Equipaggiamento', 'Note', 'Informazioni']) {
      expect(find.text(label), findsOneWidget, reason: label);
    }
    app.model.set('info.classId', 'wizard');
    await tester.pump();
    expect(find.text('Incantesimi'), findsOneWidget);

    tester.view.physicalSize = tabletPortrait;
    await tester.pump();
    expect(find.byKey(const Key('nav-rail')), findsNothing);
    expect(find.byKey(const Key('nav-bar')), findsOneWidget);
    for (final label in ['Gioco', 'Incantesimi', 'Privilegi', 'Equip.', 'Note', 'Info']) {
      expect(find.descendant(of: find.byKey(const Key('nav-bar')), matching: find.text(label)), findsOneWidget, reason: label);
    }
  });

  testWidgets('la barra laterale passa da una sezione all\'altra e ricorda l\'ultima aperta', (tester) async {
    final app = await boot(tester, size: tabletLandscape);
    expect(find.text('Classe Armatura'), findsOneWidget);
    await tester.tap(find.text('Equipaggiamento'));
    await tester.pump();
    expect(find.text('Equipaggiamento, Armature & Armi'), findsOneWidget);
    expect(find.text('Classe Armatura'), findsNothing);
    expect(app.section, 'gear');

    // Riavvio: stessa sezione.
    final saved = app.storage.loadUiState();
    expect(saved['@section'], 'gear');
    final again = await boot(tester, size: tabletLandscape, prefs: {'dnd5e-character-sheet:ui': '{"@section":"gear"}'});
    expect(again.section, 'gear');
    expect(find.text('Equipaggiamento, Armature & Armi'), findsOneWidget);
  });

  testWidgets('se la sezione ricordata non esiste più (non lancia incantesimi) si apre Gioco', (tester) async {
    await boot(tester, size: tabletLandscape, prefs: {'dnd5e-character-sheet:ui': '{"@section":"spells"}'});
    expect(find.text('Classe Armatura'), findsOneWidget);
  });

  testWidgets('Gioco: due colonne se c\'è spazio, una sola altrimenti; il riepilogo resta visibile', (tester) async {
    await boot(tester, size: tabletLandscape);
    final combat = tester.getTopLeft(find.text('Combattimento & Punti Ferita'));
    final skills = tester.getTopLeft(find.text('Abilità').first);
    expect(skills.dx, greaterThan(combat.dx + 300), reason: 'Abilità accanto a Combattimento');
    expect((skills.dy - combat.dy).abs(), lessThan(10));
    expect(find.text('CA '), findsOneWidget); // riepilogo

    tester.view.physicalSize = phone;
    await tester.pump();
    final combat1 = tester.getTopLeft(find.text('Combattimento & Punti Ferita'));
    expect(find.text('Abilità'), findsWidgets);
    expect(combat1.dx, lessThan(40));
    // Scorrendo il riepilogo non sparisce.
    await tester.drag(find.byKey(const Key('sheet-list-play')), const Offset(0, -600));
    await tester.pump();
    expect(find.text('CA '), findsOneWidget);
  });

  // Nessun overflow a nessuna combinazione di schermo, sezione e dimensione del testo.
  for (final (name, size) in [('tablet orizzontale', tabletLandscape), ('tablet verticale', tabletPortrait), ('tablet piccolo', smallTablet), ('telefono', phone)]) {
    for (final scale in [1.0, 1.5, 2.0]) {
      for (final language in ['it', 'en']) {
        testWidgets('nessun overflow: $name, testo ×$scale, $language', (tester) async {
          final app = await boot(tester, size: size, textScale: scale);
          app.setLanguage(language);
          app.model.addWeapon();
          app.model.addNote(title: 'Sessione 1', text: 'Taverna e un lungo testo ' * 5);
          app.model.set('info.raceId', Catalog.instance.raceIds.elementAt(3));
          // Classi diverse: incantatori, con risorse a usi limitati, con molte scelte.
          for (final classId in ['wizard', 'barbarian', 'cleric', 'fighter', 'monk']) {
            app.model.set('info.classId', classId);
            app.model.set('info.level', 11);
            for (final section in Section.values) {
              app.setSection(section.name);
              await tester.pump();
              await tester.pump();
              expect(tester.takeException(), isNull, reason: '$classId · ${section.name} · $name · ×$scale · $language');
            }
          }
        });
      }
    }
  }

  // Bersagli di tocco di almeno 48×48 dp (linea guida Android) in ogni sezione, su tablet.
  for (final section in Section.values) {
    testWidgets('bersagli di tocco ≥ 48 px: ${section.name}', (tester) async {
      final handle = tester.ensureSemantics();
      final app = await boot(tester, size: tabletLandscape);
      app.model.set('info.classId', 'wizard');
      app.model.set('info.level', 5);
      app.model.addWeapon();
      app.model.addAcItem();
      app.model.addNote(title: 'Sessione 1');
      app.setSection(section.name);
      await tester.pump();
      await expectLater(tester, meetsGuideline(androidTapTargetGuideline));
      handle.dispose();
    });
  }

  testWidgets('con la tastiera aperta il campo in basso resta visibile e la barra si nasconde', (tester) async {
    final app = await boot(tester, size: tabletPortrait);
    app.setSection('notes');
    await tester.pump();
    await tester.tap(find.byKey(const Key('note-new')));
    await tester.pump();
    await tester.tap(find.widgetWithText(TextField, 'Testo'));
    await tester.pump();
    // Tastiera da 500 px.
    tester.view.viewInsets = const FakeViewPadding(bottom: 500);
    addTearDown(tester.view.resetViewInsets);
    await tester.pump();
    expect(find.byKey(const Key('nav-bar')), findsNothing);
    final field = tester.getRect(find.widgetWithText(TextField, 'Testo'));
    expect(field.bottom, lessThanOrEqualTo(1280 - 500));
    expect(tester.takeException(), isNull);
  });
}
