// Note: modello (elenco in notes.items, note predefinite intatte), sincronizzazione e sezione Note.
import 'dart:io';

import 'package:dnd5e_sheet/model/character_model.dart';
import 'package:dnd5e_sheet/model/schema.dart';
import 'package:dnd5e_sheet/sync/diff.dart';
import 'package:dnd5e_sheet/ui/panels_notes.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';

import 'boot.dart';
import 'test_catalog.dart';

List<Map> items(CharacterModel m) => ((m.state['notes'] as Map)['items'] as List).cast<Map>();

void main() {
  group('modello', () {
    setUpAll(loadTestCatalog);

    test('un personaggio nuovo ha le note predefinite e l\'elenco vuoto', () {
      final notes = createDefaultCharacter()['notes'] as Map;
      expect(notes, {'traits': '', 'backstory': '', 'items': []});
    });

    test('un salvataggio vecchio senza elenco non perde le due note storiche', () {
      final m = CharacterModel({'notes': {'traits': 'Allerta', 'backstory': 'Orfano'}});
      expect((m.state['notes'] as Map)['traits'], 'Allerta');
      expect((m.state['notes'] as Map)['backstory'], 'Orfano');
      expect(items(m), isEmpty);
    });

    test('aggiungere, rinominare, scrivere, spostare, eliminare', () {
      final m = CharacterModel();
      final a = m.addNote(title: 'Sessione 1')!;
      final b = m.addNote(title: 'PNG')!;
      final c = m.addNote(title: 'Luoghi')!;
      expect(items(m).map((n) => n['title']), ['Sessione 1', 'PNG', 'Luoghi']);
      m.set('notes.items.1.title', 'PNG importanti');
      m.set('notes.items.1.text', 'Elminster\nVolo');
      m.moveNote(b, -1);
      expect(items(m).map((n) => n['title']), ['PNG importanti', 'Sessione 1', 'Luoghi']);
      m.moveNote(b, -1); // già in cima: nulla
      expect(m.noteIndex(b), 0);
      m.reorderNote(0, 2);
      expect(items(m).map((n) => n['id']), [a, c, b]);
      m.removeNote(c);
      expect(items(m).map((n) => n['id']), [a, b]);
      expect(items(m).last['text'], 'Elminster\nVolo');
    });

    test('limiti: titolo di 80 caratteri, massimo di note', () {
      final m = CharacterModel();
      m.addNote(title: 'x' * 200);
      expect(items(m).first['title'], hasLength(maxNoteTitle));
      for (var i = 0; i < maxNotes + 5; i++) {
        m.addNote();
      }
      expect(items(m), hasLength(maxNotes));
      expect(m.addNote(), isNull);
    });

    test('normalizzazione: id conservati e unici, dati sporchi ripuliti', () {
      final state = normalizeCharacter({
        'notes': {
          'items': [
            {'id': 'a', 'title': 'Uno', 'text': 'testo'},
            {'id': 'a', 'title': 'Doppia', 'text': 7},
            'spazzatura',
            {'title': 'Senza id'},
          ],
        },
      });
      final list = ((state['notes'] as Map)['items'] as List).cast<Map>();
      expect(list, hasLength(4));
      expect(list[0]['id'], 'a');
      expect({for (final n in list) n['id']}, hasLength(4));
      expect(list[1]['text'], '7');
      expect(list[2]['title'], '');
      expect(list[3]['title'], 'Senza id');
    });

    test('sincronizzazione: l\'elenco delle note si scambia intero, le predefinite restano per campo', () {
      final base = normalizeCharacter({'notes': {'traits': 'A', 'items': [{'id': 'n1', 'title': 'x', 'text': 'y'}]}});
      final next = normalizeCharacter({'notes': {'traits': 'A', 'backstory': 'Nuova', 'items': [{'id': 'n1', 'title': 'x', 'text': 'y2'}]}});
      expect(diffDeep(base, next), {
        'notes': {
          'backstory': 'Nuova',
          'items': [{'id': 'n1', 'title': 'x', 'text': 'y2'}],
        },
      });
    });
  });

  group('sezione Note', () {
    Future<dynamic> open(WidgetTester tester, {Size size = tabletLandscape}) async {
      final app = await boot(tester, size: size);
      app.setSection('notes');
      await tester.pump();
      return app;
    }

    Finder editorField(String label) => find.widgetWithText(TextField, label);

    testWidgets('le note storiche compaiono come predefinite e si scrivono come prima', (tester) async {
      final app = await open(tester);
      expect(find.byKey(const ValueKey('note-traits')), findsOneWidget);
      expect(find.byKey(const ValueKey('note-backstory')), findsOneWidget);
      await tester.enterText(editorField('Testo'), 'Allerta, Fortunato');
      expect((app.model.state['notes'] as Map)['traits'], 'Allerta, Fortunato');
      await tester.tap(find.byKey(const ValueKey('note-backstory')));
      await tester.pump();
      await tester.enterText(editorField('Testo'), 'Cresciuto in un faro');
      expect((app.model.state['notes'] as Map)['backstory'], 'Cresciuto in un faro');
      expect((app.model.state['notes'] as Map)['traits'], 'Allerta, Fortunato');
    });

    testWidgets('crea, titola, scrive; si salva da solo e la nota è ancora lì dopo il riavvio', (tester) async {
      final app = await open(tester);
      await tester.tap(find.byKey(const Key('note-new')));
      await tester.pump();
      await tester.enterText(editorField('Titolo'), 'Sessione 1');
      await tester.enterText(editorField('Testo'), 'Il drago è nella cripta');
      expect(items(app.model).single, containsPair('title', 'Sessione 1'));
      expect(find.text('Sessione 1'), findsWidgets);

      // Salvataggio automatico (ritardato di 400 ms).
      await tester.pump(const Duration(milliseconds: 500));
      final saved = app.storage.loadCharacter() as Map;
      expect(((saved['notes'] as Map)['items'] as List).single['text'], 'Il drago è nella cripta');
    });

    testWidgets('modelli rapidi: Sessione, PNG, Luogo, Da fare', (tester) async {
      final app = await open(tester);
      await tester.tap(find.byKey(const Key('note-templates')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('PNG').last);
      await tester.pumpAndSettle();
      expect(items(app.model).single['title'], 'PNG');
    });

    testWidgets('ricerca nel testo (senza maiuscole né accenti)', (tester) async {
      final app = await open(tester);
      app.model.addNote(title: 'Taverna', text: 'Il fabbro vende spade, perché è nano');
      app.model.addNote(title: 'Cripta', text: 'Trappola con dardi');
      await tester.pump();
      expect(find.byKey(const Key('notes-search')), findsOneWidget);
      await tester.enterText(find.byKey(const Key('notes-search')), 'PERCHE');
      await tester.pump();
      expect(find.text('Taverna'), findsOneWidget);
      expect(find.text('Cripta'), findsNothing);
      expect(find.text('Talenti & altri tratti'), findsWidgets); // il titolo dell'editor; l'elenco è filtrato
      await tester.enterText(find.byKey(const Key('notes-search')), 'zzz');
      await tester.pump();
      expect(find.text('Nessuna nota trovata'), findsOneWidget);
      await tester.tap(find.byTooltip('Cancella ricerca'));
      await tester.pump();
      expect(find.text('Cripta'), findsOneWidget);
    });

    testWidgets('sposta con il menu ed elimina con possibilità di annullare', (tester) async {
      final app = await open(tester);
      app.model.addNote(title: 'Prima', text: 'uno');
      final second = app.model.addNote(title: 'Seconda', text: 'due');
      await tester.pump();
      await tester.tap(find.byKey(ValueKey('note-$second')));
      await tester.pump();
      await tester.tap(find.byKey(const Key('note-menu')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Sposta su'));
      await tester.pumpAndSettle();
      expect(items(app.model).map((n) => n['title']), ['Seconda', 'Prima']);

      await tester.tap(find.byKey(const Key('note-menu')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Elimina'));
      await tester.pumpAndSettle();
      expect(items(app.model).map((n) => n['title']), ['Prima']);
      await tester.tap(find.text('Annulla'));
      await tester.pumpAndSettle();
      expect(items(app.model).map((n) => n['title']), ['Seconda', 'Prima']);
      expect(items(app.model).first['text'], 'due');
    });

    testWidgets('trascinando la maniglia si riordina', (tester) async {
      final app = await open(tester);
      app.model.addNote(title: 'Prima');
      app.model.addNote(title: 'Seconda');
      await tester.pump();
      final handles = find.byIcon(Icons.drag_handle);
      expect(handles, findsNWidgets(2));
      await tester.drag(handles.first, const Offset(0, 120));
      await tester.pumpAndSettle();
      expect(items(app.model).map((n) => n['title']), ['Seconda', 'Prima']);
    });

    testWidgets('schermo stretto: prima l\'elenco, toccando una nota si apre l\'editor, «indietro» torna all\'elenco', (tester) async {
      final app = await open(tester, size: phone);
      app.model.addNote(title: 'Sessione 1', text: 'ciao');
      await tester.pump();
      expect(find.byKey(const Key('note-new')), findsOneWidget);
      expect(editorField('Testo'), findsNothing);
      await tester.tap(find.text('Sessione 1'));
      await tester.pump();
      expect(editorField('Testo'), findsOneWidget);
      expect(find.byKey(const Key('note-new')), findsNothing);
      await tester.tap(find.byTooltip('Torna alle note'));
      await tester.pump();
      expect(find.byKey(const Key('note-new')), findsOneWidget);
    });

    testWidgets('in inglese i testi della sezione sono tradotti', (tester) async {
      final app = await open(tester);
      app.setLanguage('en');
      await tester.pump();
      expect(find.text('New note'), findsOneWidget);
      expect(find.text('Features & resources'), findsWidgets);
      expect(find.text('Notes'), findsWidgets);
      expect(find.text('Search notes'), findsOneWidget);
    });

    testWidgets('la scrittura a mano con la penna è attiva su tutti i campi di testo della sezione', (tester) async {
      final app = await open(tester);
      app.model.addNote(title: 'Una');
      await tester.pump();
      await tester.tap(find.text('Una'));
      await tester.pump();
      final fields = tester.widgetList<TextField>(find.byType(TextField)).toList();
      expect(fields.length, greaterThanOrEqualTo(3)); // ricerca, titolo, testo
      for (final f in fields) {
        expect(f.stylusHandwritingEnabled, isTrue);
      }
    });
  });

  test('nessun campo di testo del codice disattiva la scrittura a mano (S Pen)', () {
    final offenders = [
      for (final file in Directory('lib').listSync(recursive: true).whereType<File>().where((f) => f.path.endsWith('.dart')))
        if (RegExp(r'stylusHandwritingEnabled:\s*false|scribbleEnabled:\s*false').hasMatch(file.readAsStringSync())) file.path,
    ];
    expect(offenders, isEmpty);
  });

  test('foldForSearch toglie maiuscole e accenti', () {
    expect(foldForSearch('Perché È già'), 'perche e gia');
  });
}
