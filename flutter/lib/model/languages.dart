import '../data/catalog.dart';
import '../i18n.dart';

const _wordCount = {'una': 1, 'un': 1, 'uno': 1, 'due': 2, 'tre': 3, 'quattro': 4};

/// Legge il testo italiano delle lingue di razza o background ("Comune, Elfico, una lingua a scelta").
({List<String> ids, List<String> custom, int choices}) parseLanguageText(String? text) {
  final byName = {for (final l in Catalog.instance.languages) (l['name'] as String).toLowerCase(): l['id'] as String};
  final ids = <String>[];
  final custom = <String>[];
  var choices = 0;
  for (final token in (text ?? '').split(',').map((t) => t.trim()).where((t) => t.isNotEmpty)) {
    final id = byName[token.toLowerCase()];
    if (id != null) {
      ids.add(id);
      continue;
    }
    if (RegExp('scelta', caseSensitive: false).hasMatch(token)) {
      final first = token.split(RegExp(r'\s+')).first.toLowerCase();
      choices += _wordCount[first] ?? (int.tryParse(first) ?? 1);
    } else {
      custom.add(token);
    }
  }
  return (ids: ids, custom: custom, choices: choices);
}

String languageName(String id) => loc(Catalog.instance.getLanguage(id));
