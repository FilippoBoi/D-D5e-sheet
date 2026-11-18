// Ogni testo passato a tr('…') nella UI deve avere la traduzione inglese nel dizionario (assets/data/ui_en.json,
// esportato dalla versione web): altrimenti in inglese resterebbe in italiano.
import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

void main() {
  test('tutti i tr() della UI hanno una traduzione inglese', () {
    final dict = (jsonDecode(File('assets/data/ui_en.json').readAsStringSync()) as Map).keys.map((k) => (k as String).replaceAll(RegExp(r'\s+'), ' ').trim()).toSet();
    final pattern = RegExp(r'''\btr\(\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")''');
    final missing = <String>{};
    for (final file in Directory('lib/ui').listSync(recursive: true).whereType<File>().where((f) => f.path.endsWith('.dart'))) {
      for (final m in pattern.allMatches(file.readAsStringSync())) {
        final text = (m[1] ?? m[2])!.replaceAll(r"\'", "'").replaceAll(r'\"', '"');
        if (!dict.contains(text.replaceAll(RegExp(r'\s+'), ' ').trim())) missing.add('${file.path}: $text');
      }
    }
    expect(missing, isEmpty, reason: 'chiavi senza traduzione: ${missing.length}');
  });
}
