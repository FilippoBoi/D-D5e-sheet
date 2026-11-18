/// Testi degli incantesimi nella lingua corrente (porting di js/model/spellText.js).
library;

import '../data/catalog.dart';
import '../i18n.dart';
import 'utils.dart';

const _schools = {
  'A': ['Abiurazione', 'Abjuration'], 'C': ['Invocazione', 'Conjuration'], 'D': ['Divinazione', 'Divination'],
  'E': ['Ammaliamento', 'Enchantment'], 'V': ['Evocazione', 'Evocation'], 'I': ['Illusione', 'Illusion'],
  'N': ['Necromanzia', 'Necromancy'], 'T': ['Trasmutazione', 'Transmutation'],
};

String schoolName(String code) => _schools[code] != null ? pick(_schools[code]![0], _schools[code]![1]) : code;

String levelLabel(int level) {
  if (level == 0) return pick('Trucchetto', 'Cantrip');
  final rest = level % 100;
  final suffix = rest >= 11 && rest <= 13 ? 'th' : ({1: 'st', 2: 'nd', 3: 'rd'}[level % 10] ?? 'th');
  return pick('$level°', '$level$suffix');
}

String castTimeText(String code) {
  final m = RegExp(r'^(\d+)([abrmh])$').firstMatch(code);
  if (m == null) return pick('Speciale', 'Special');
  final n = int.parse(m[1]!);
  switch (m[2]) {
    case 'a':
      return pick('$n azione', '$n action');
    case 'b':
      return pick('$n az. bonus', '$n bonus action');
    case 'r':
      return pick('$n reazione', '$n reaction');
    case 'm':
      return '$n min';
    default:
      return pick('$n ${n == 1 ? 'ora' : 'ore'}', '$n hr');
  }
}

/// Piedi → metri, arrotondati al mezzo metro (5 ft = 1,5 m).
num feetToMeters(num ft) => cleanNum((ft * 0.3 * 2).round() / 2);

String rangeText(String code) {
  switch (code) {
    case 'self':
      return pick('Su di sé', 'Self');
    case 'touch':
      return pick('Contatto', 'Touch');
    case 'sight':
      return pick('Vista', 'Sight');
    case 'unl':
      return pick('Illimitata', 'Unlimited');
  }
  final m = RegExp(r'^(\d+)(ft|mi)$').firstMatch(code);
  if (m == null) return pick('Speciale', 'Special');
  final n = int.parse(m[1]!);
  if (m[2] == 'mi') return pick('${numStr(n * 1.5).replaceAll('.', ',')} km', '$n mi');
  return pick('${numStr(feetToMeters(n)).replaceAll('.', ',')} m', '$n ft');
}

String durationText(String code) {
  if (code == 'inst') return pick('Istantanea', 'Instantaneous');
  if (code == 'perm') return pick('Finché non dissolto', 'Until dispelled');
  final m = RegExp(r'^(\d+)([rmhd])$').firstMatch(code);
  if (m == null) return pick('Speciale', 'Special');
  final n = int.parse(m[1]!);
  switch (m[2]) {
    case 'r':
      return pick('$n round', '$n round${n == 1 ? '' : 's'}');
    case 'm':
      return '$n min';
    case 'h':
      return pick('$n ${n == 1 ? 'ora' : 'ore'}', '$n hr');
    default:
      return pick('$n ${n == 1 ? 'giorno' : 'giorni'}', '$n day${n == 1 ? '' : 's'}');
  }
}

String metaText(Json spell) {
  final comp = (spell['comp'] as String).split('').join(' ');
  return [
    castTimeText(spell['time'] as String), rangeText(spell['range'] as String),
    comp.isEmpty ? '—' : comp, durationText(spell['dur'] as String),
  ].join(' · ');
}

List<Json> spellTags(Json spell) => [
      if (spell['conc'] == true) {'id': 'conc', 'label': 'Conc.', 'title': pick('Concentrazione', 'Concentration')},
      if (spell['ritual'] == true) {'id': 'ritual', 'label': 'Rit.', 'title': pick('Rituale', 'Ritual')},
    ];

String sourceText(Json spell) => spell['page'] != null ? '${spell['source']}, p. ${spell['page']}' : '${spell['source']}';

/// Voce pronta da mostrare (sulla scheda e nel selettore).
Json describeSpell(Json spell) => {
      'id': spell['id'],
      'name': loc(spell),
      // Il nome nell'altra lingua, per la ricerca (e per riconoscere l'originale).
      'altName': loc(spell) == spell['nameEn'] ? spell['name'] : spell['nameEn'],
      'level': spell['level'],
      'levelLabel': levelLabel(spell['level'] as int),
      'school': schoolName(spell['school'] as String),
      'meta': metaText(spell),
      'tags': spellTags(spell),
      'source': spell['source'],
      'sourceText': sourceText(spell),
    };

/// Una voce è visibile per la lista di una classe: propria o aggiunta da un manuale attivo.
bool onClassList(Json spell, String listClass, Set<String> enabled) {
  if ((spell['classes'] as List).contains(listClass)) return true;
  final ext = spell['ext'] as List?;
  return ext != null && ext.any((e) => e[0] == listClass && enabled.contains(e[1]));
}

({int cantrips, int spells, String kind}) spellLimits(String table, int level, int castMod) {
  final row = Catalog.instance.spellProgression[table] as Json?;
  if (row == null) return (cantrips: 0, spells: 0, kind: 'known');
  final cantrips = (row['cantrips'] as List)[level] as int;
  final prepared = row['prepared'] as String?;
  if (prepared != null) {
    final base = prepared == 'half' ? (level / 2).floor() : level;
    return (cantrips: cantrips, spells: (castMod + base) < 1 ? 1 : castMod + base, kind: 'prepared');
  }
  final known = row['known'] as List?;
  return (cantrips: cantrips, spells: known != null ? known[level] as int : 0, kind: 'known');
}
