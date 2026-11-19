// Azioni rapide: PF con un tocco, slot, concentrazione e dadi vita (anche nei riposi).
import 'dart:math';

import 'package:dnd5e_sheet/model/character_model.dart';
import 'package:dnd5e_sheet/ui/panels_quick.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';

import 'boot.dart';
import 'test_catalog.dart';

class _FixedRandom implements Random {
  _FixedRandom(this.value);
  final int value;
  @override
  int nextInt(int max) => value % max;
  @override
  bool nextBool() => false;
  @override
  double nextDouble() => 0;
}

Map combat(CharacterModel m) => m.state['combat'] as Map;

void main() {
  group('modello', () {
    setUpAll(loadTestCatalog);

    CharacterModel fighter() => CharacterModel()
      ..set('info.classId', 'fighter') // d10
      ..set('info.level', 5)
      ..set('abilities.con', 14) // +2
      ..set('combat.hpMax', 50)
      ..set('combat.hpCurrent', 10);

    test('dadi vita: uno per livello, spenderlo cura (dado + mod. Cost.)', () {
      final m = fighter();
      expect(m.hitDice, (total: 5, used: 0, remaining: 5));
      final r = m.spendHitDie(_FixedRandom(5))!; // 1 + 5 = 6
      expect(r, (roll: 6, conMod: 2, healed: 8));
      expect(combat(m)['hpCurrent'], 18);
      expect(m.hitDice.remaining, 4);
    });

    test('la cura dei dadi vita non supera i PF massimi e non va sotto zero', () {
      final m = fighter()..set('combat.hpCurrent', 48);
      expect(m.spendHitDie(_FixedRandom(9))!.healed, 2);
      m.set('abilities.con', 1); // −5
      expect(m.spendHitDie(_FixedRandom(0))!.healed, 0); // 1 − 5 → 0
    });

    test('senza dadi vita rimasti non succede nulla; i dadi spesi non superano il livello', () {
      final m = fighter()..set('combat.hitDiceUsed', 99);
      expect(m.hitDice.used, 5);
      expect(m.spendHitDie(), isNull);
    });

    test('riposo breve chiude la concentrazione; il lungo restituisce metà dei dadi vita (min. 1)', () {
      final m = fighter()
        ..set('combat.hitDiceUsed', 5)
        ..set('combat.concentration', 'Benedizione');
      m.shortRest();
      expect(combat(m)['concentration'], '');
      m.longRest();
      expect(m.hitDice.used, 3);
      m.set('info.level', 1);
      m.set('combat.hitDiceUsed', 1);
      m.longRest();
      expect(m.hitDice.used, 0);
    });

    test('CD della concentrazione: 10 o metà del danno', () {
      expect(concentrationDc(4), 10);
      expect(concentrationDc(21), 10);
      expect(concentrationDc(30), 15);
    });
  });

  group('interfaccia', () {
    testWidgets('PF: −5, −1, +1, +5 con un tocco; il danno consuma prima i temporanei', (tester) async {
      final app = await boot(tester, size: tabletLandscape);
      app.model.set('combat.hpMax', 30);
      app.model.set('combat.hpCurrent', 20);
      app.model.set('combat.hpTemp', 3);
      await tester.pump();
      expect(find.byKey(const Key('quick-hp')), findsOneWidget);
      await tester.tap(find.text('−5'));
      await tester.pump();
      expect(combat(app.model), containsPair('hpTemp', 0));
      expect(combat(app.model), containsPair('hpCurrent', 18));
      await tester.tap(find.text('+5'));
      await tester.tap(find.text('+1'));
      await tester.tap(find.text('−1'));
      await tester.pump();
      expect(combat(app.model)['hpCurrent'], 23);
      expect(tester.widget<Text>(find.byKey(const Key('quick-hp'))).data, '23/30');
    });

    testWidgets('slot: un tocco ne segna uno speso, toccare l\'ultimo lo libera', (tester) async {
      final app = await boot(tester, size: tabletLandscape);
      app.model.set('info.classId', 'wizard');
      app.model.set('info.level', 3);
      await tester.pump();
      final first = find.bySemanticsLabel(RegExp(r'Slot di 1° livello usato 1'));
      final handle = tester.ensureSemantics();
      await tester.tap(first);
      await tester.pump();
      expect(((app.model.state['spells'] as Map)['slotsUsed'] as Map)['1'], 1);
      await tester.tap(first);
      await tester.pump();
      expect(((app.model.state['spells'] as Map)['slotsUsed'] as Map)['1'], 0);
      handle.dispose();
    });

    testWidgets('un non incantatore non vede gli slot', (tester) async {
      await boot(tester, size: tabletLandscape);
      expect(find.byKey(const Key('quick-hp')), findsOneWidget);
      expect(find.textContaining('1°'), findsNothing);
    });

    testWidgets('concentrazione: si inizia con un nome, si chiude con un tocco; il danno ricorda la prova', (tester) async {
      final app = await boot(tester, size: tabletLandscape);
      app.model.set('combat.hpMax', 40);
      app.model.set('combat.hpCurrent', 40);
      await tester.tap(find.byKey(const Key('quick-concentration-start')));
      await tester.pumpAndSettle();
      await tester.enterText(find.descendant(of: find.byType(AlertDialog), matching: find.byType(TextField)), 'Benedizione');
      await tester.tap(find.text('Inizia'));
      await tester.pumpAndSettle();
      expect(combat(app.model)['concentration'], 'Benedizione');
      expect(find.text('Concentrazione: Benedizione'), findsOneWidget);

      await tester.tap(find.text('−5'));
      await tester.pump();
      await tester.pump();
      expect(find.text('Concentrazione: TS Costituzione CD 10'), findsOneWidget);

      ScaffoldMessenger.of(tester.element(find.byType(Scaffold))).clearSnackBars();
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('quick-concentration-end')));
      await tester.pump();
      expect(combat(app.model)['concentration'], '');
      await tester.tap(find.text('−5'));
      await tester.pump();
      await tester.pump();
      expect(find.textContaining('TS Costituzione'), findsNothing, reason: 'senza concentrazione nessun promemoria');
    });

    testWidgets('concentrazione senza nome', (tester) async {
      final app = await boot(tester, size: tabletLandscape);
      await tester.tap(find.byKey(const Key('quick-concentration-start')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Inizia'));
      await tester.pumpAndSettle();
      expect(combat(app.model)['concentration'], unnamedConcentration);
      expect(find.text('In concentrazione'), findsOneWidget);
    });

    testWidgets('dadi vita: «Spendi dado» cura e consuma un dado; a zero il pulsante si disattiva', (tester) async {
      final app = await boot(tester, size: tabletLandscape);
      app.model.set('info.level', 2);
      app.model.set('combat.hpMax', 40);
      app.model.set('combat.hpCurrent', 10);
      await tester.pump();
      expect(find.textContaining('2/2 d'), findsOneWidget);
      await tester.tap(find.byKey(const Key('quick-hit-die-spend')));
      await tester.pump();
      expect(find.textContaining('1/2 d'), findsOneWidget);
      expect(combat(app.model)['hpCurrent'], greaterThan(10));
      await tester.pump();
      expect(find.textContaining(' PF (dado '), findsOneWidget);
      await tester.tap(find.byKey(const Key('quick-hit-die-spend')));
      await tester.pump();
      expect(find.textContaining('0/2 d'), findsOneWidget);
      expect(tester.widget<FilledButton>(find.byKey(const Key('quick-hit-die-spend'))).onPressed, isNull);
    });
  });
}
