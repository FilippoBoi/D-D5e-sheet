// Parità con l'app web: per ogni personaggio costruito dal Model JS (npm run flutter:parity)
// lo stato normalizzato e i valori derivati, in italiano e in inglese, devono coincidere.
import 'dart:convert';
import 'dart:io';

import 'package:dnd5e_sheet/i18n.dart';
import 'package:dnd5e_sheet/model/derive_stats.dart';
import 'package:dnd5e_sheet/model/schema.dart';
import 'package:flutter_test/flutter_test.dart';

import 'test_catalog.dart';

/// Primo punto in cui due strutture JSON differiscono (null e chiave assente sono equivalenti), o null.
String? firstDiff(Object? a, Object? b, [String path = r'$']) {
  if (a is Map && b is Map) {
    for (final key in {...a.keys, ...b.keys}) {
      final d = firstDiff(a[key], b[key], '$path.$key');
      if (d != null) return d;
    }
    return null;
  }
  if (a is List && b is List) {
    if (a.length != b.length) return '$path: lunghezza ${a.length} ≠ ${b.length}';
    for (var i = 0; i < a.length; i++) {
      final d = firstDiff(a[i], b[i], '$path[$i]');
      if (d != null) return d;
    }
    return null;
  }
  if (a is num && b is num) return a == b ? null : '$path: $a ≠ $b';
  return a == b ? null : '$path: «$a» ≠ «$b»';
}

void main() {
  final file = File('test/fixtures/parity.json');
  if (!file.existsSync()) {
    test('parità con il Model JS', () {}, skip: 'genera i casi con: npm run flutter:parity');
    return;
  }
  loadTestCatalog();
  final cases = (jsonDecode(file.readAsStringSync()) as List).cast<Map<String, dynamic>>();

  for (final c in cases) {
    final name = c['name'] as String;
    test('$name: stato normalizzato', () {
      final normalized = jsonDecode(jsonEncode(normalizeCharacter(c['raw']))) as Map<String, dynamic>;
      // La versione web rigenera l'id degli oggetti CA a ogni caricamento; qui si conserva.
      for (final side in [normalized, c['state'] as Map<String, dynamic>]) {
        for (final item in (side['equipment']['acItems'] as List)) {
          (item as Map).remove('id');
        }
      }
      expect(firstDiff(c['state'], normalized), isNull);
    });
    for (final language in ['it', 'en']) {
      test('$name: derivati ($language)', () {
        setLang(language);
        addTearDown(() => setLang('it'));
        final sources = (c['sources'] as List).cast<String>().toSet();
        final derived = jsonDecode(jsonEncode(deriveStats(normalizeCharacter(c['state']), sources: sources)));
        expect(firstDiff((c['derived'] as Map)[language], derived), isNull);
      });
    }
  }
}
