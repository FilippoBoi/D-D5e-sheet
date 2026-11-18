/// Tratti razziali (porting di js/data/raceTraits.js). Testi e dati statici vengono da assets/data/catalog.json;
/// qui restano solo i calcoli che dipendono da livello, caratteristiche e scelte.
library;

import '../data/catalog.dart';
import '../i18n.dart';
import 'class_resources.dart';

const _damage = {
  'acid': ['Acido', 'Acid'], 'cold': ['Freddo', 'Cold'], 'fire': ['Fuoco', 'Fire'],
  'lightning': ['Fulmine', 'Lightning'], 'poison': ['Veleno', 'Poison'],
};
String _dmg(String type) => _damage[type] != null ? pick(_damage[type]![0], _damage[type]![1]) : type;

const _rechargeText = {'short': ['riposo breve', 'short rest'], 'long': ['riposo lungo', 'long rest']};

class RaceTraitsResult {
  final List<Json> traits = [];
  final List<Json> uses = [];
  int hpPerLevel = 0;
  List<String> resistances = [];
  final Map<String, List<String>> proficiencies = {'armor': [], 'weapons': [], 'tools': []};
}

/// Usi limitati di un tratto che dipendono dal contesto.
List<Json> _dynamicUses(String key, int level, int profBonus, Map<String, int> mods, String option) {
  switch (key) {
    case 'breathWeapon':
      return [
        {
          'id': 'breathWeapon', 'max': 1, 'recharge': 'short',
          'detail': '${byLevel<int>(level, [(1, 2), (6, 3), (11, 4), (16, 5)])}d6 ${option.isNotEmpty ? _dmg(option) : '—'} · ${pick('CD', 'DC')} ${8 + profBonus + mods['con']!}',
        },
      ];
    case 'drowMagic':
      return [
        if (level >= 3) {'id': 'drowFaerieFire', 'max': 1, 'recharge': 'long', 'detail': pick('Fuoco fatato', 'Faerie Fire')},
        if (level >= 5) {'id': 'drowDarkness', 'max': 1, 'recharge': 'long', 'detail': pick('Oscurità', 'Darkness')},
      ];
    case 'relentlessEndurance':
      return [
        {'id': 'relentlessEndurance', 'max': 1, 'recharge': 'long'},
      ];
    case 'infernalLegacy':
      return [
        if (level >= 3) {'id': 'tieflingRebuke', 'max': 1, 'recharge': 'long', 'detail': pick('Punizione infernale', 'Hellish Rebuke')},
        if (level >= 5) {'id': 'tieflingDarkness', 'max': 1, 'recharge': 'long', 'detail': pick('Oscurità', 'Darkness')},
      ];
    default:
      return const [];
  }
}

RaceTraitsResult resolveRaceTraits(String raceId, {required int level, required int profBonus, required Map<String, int> mods, String option = '', String optionLabel = ''}) {
  final cat = Catalog.instance;
  final race = cat.getRace(raceId);
  final out = RaceTraitsResult();
  if (race == null) return out;

  final keys = (cat.raceTraitKeys[raceId] as List?)?.cast<String>();
  if (keys == null) {
    // Razze degli altri manuali: solo i nomi, con il rimando al manuale.
    final names = ((race['traitsEn'] ?? race['traits'] ?? '') as String).split(',').map((n) => n.trim()).where((n) => n.isNotEmpty);
    final ref = race['page'] != null ? '${race['source']}, p. ${race['page']}' : '${race['source']}';
    for (final name in names) {
      out.traits.add({'name': name, 'description': pick('Vedi $ref.', 'See $ref.'), 'tag': ''});
    }
    return out;
  }

  final resist = <String>[];
  for (final key in keys) {
    final t = cat.raceTraits[key] as Json;
    final uses = _dynamicUses(key, level, profBonus, mods, option);
    final dyn = (t['dyn'] as List?)?.cast<String>() ?? const [];
    if (key == 'damageResistance') {
      if (option.isNotEmpty && !resist.contains(option)) resist.add(option);
    } else if (t['resist'] != null) {
      for (final r in (t['resist'] as List).cast<String>()) {
        if (!resist.contains(r)) resist.add(r);
      }
    } else if (dyn.contains('resist')) {
      // nessun altro tratto dipende dalla scelta
    }
    out.hpPerLevel += (t['hp'] as int?) ?? 0;
    final prof = t['prof'] as Json?;
    if (prof != null) {
      for (final e in prof.entries) {
        for (final pair in (e.value as List)) {
          out.proficiencies[e.key]!.add(pick(pair[0] as String, pair[1] as String));
        }
      }
    }
    if ((t['dynProf'] as List?)?.contains('tools') == true && optionLabel.isNotEmpty) {
      out.proficiencies['tools']!.add(optionLabel);
    }
    final name = pick(t['it'] as String, t['en'] as String);
    for (final u in uses) {
      out.uses.add({...u, 'label': name});
    }
    final first = uses.isEmpty ? null : uses.first;
    out.traits.add({
      'name': name,
      'description': pick(t['di'] as String, t['de'] as String),
      'tag': first != null && uses.length == 1
          ? '1 / ${pick(_rechargeText[first['recharge']]![0], _rechargeText[first['recharge']]![1])}'
          : '',
    });
  }
  out.resistances = resist.map(_dmg).toList();
  return out;
}
