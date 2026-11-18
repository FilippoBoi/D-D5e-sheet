/// Forma dello stato del personaggio, valori di default e validazione (porting di js/model/characterSchema.js).
///
/// Lo stato è JSON puro con le stesse chiavi della versione web: i file esportati da una versione
/// si importano nell'altra. Ogni valore che entra (input, salvataggio, import) passa da `sanitizeValue`.
library;

import 'dart:math' as math;

import '../data/catalog.dart';
import '../i18n.dart';
import 'class_choices.dart';
import 'utils.dart';

const schemaVersion = 1;
const maxWeapons = 30;
const maxAcItems = 10;
const _maxTextLength = 20000;
const _weaponAbilities = ['str', 'dex'];

final _rng = math.Random();

/// Id univoco, nel formato di riserva della versione web.
String createId() => 'w-${DateTime.now().millisecondsSinceEpoch.toRadixString(36)}-${_rng.nextInt(1 << 31).toRadixString(36).padLeft(6, '0').substring(0, 6)}';

/// Competenze nei tiri salvezza concesse da una classe.
Map<String, dynamic> classSaveProficiencies(String classId) {
  final saves = (Catalog.instance.getClass(classId)['saves'] as List).cast<String>();
  return {for (final id in Catalog.instance.abilityIds) id: saves.contains(id)};
}

Json createWeapon() => {
      'id': createId(), 'name': '', 'ability': 'str', 'proficient': true, 'magicBonus': 0, 'damage': '1d8', 'damageType': '',
    };

Json createAcItem() => {'id': createId(), 'name': '', 'bonus': 0};

Json createDefaultCharacter() {
  final cat = Catalog.instance;
  return deepCopy<Json>({
    'version': schemaVersion,
    'info': {
      'name': '', 'player': '', 'raceId': Catalog.noRaceId, 'background': '', 'backgroundId': Catalog.noBackgroundId, 'alignment': '',
      'classId': Catalog.defaultClassId, 'level': 1,
      'raceChoices': {'ability1': '', 'ability2': '', 'skill1': '', 'skill2': '', 'option': ''},
      'classChoices': defaultChoiceValues(),
    },
    'classSkills': {'skill1': '', 'skill2': '', 'skill3': '', 'skill4': ''},
    'abilities': {for (final id in cat.abilityIds) id: 10},
    'saveProficiencies': classSaveProficiencies(Catalog.defaultClassId),
    'skills': {for (final id in cat.skillIds) id: {'proficient': false, 'expertise': false}},
    'combat': {'speed': 9, 'hpMax': 10, 'hpCurrent': 10, 'hpTemp': 0, 'deathSuccesses': 0, 'deathFailures': 0},
    'equipment': {
      'armorId': 'none', 'shield': false, 'magicBonus': 0, 'inventory': '',
      'acItems': <Json>[],
      'coins': {'mr': 0, 'ma': 0, 'me': 0, 'mo': 0, 'mp': 0},
    },
    'weapons': <Json>[],
    // Usi già spesi delle risorse a riposo (Ire, Ki, Azione Impetuosa...): si azzerano coi riposi.
    'resourcesUsed': {for (final id in [...cat.resourceIds, ...cat.raceResourceIds]) id: 0},
    'spells': {
      'cantripIds': <String>[], 'spellIds': <String>[],
      'cantrips': '', 'prepared': '',
      'slotsUsed': {for (var i = 1; i <= 9; i++) '$i': 0},
    },
    // Lingue a scelta (razza, background) e altre conosciute: il resto si ricava da razza, background e classe.
    'languages': {
      for (var i = 1; i <= Catalog.maxLanguagePicks; i++) 'pick$i': '',
      'other': '',
    },
    'notes': {'traits': '', 'backstory': ''},
  });
}

String _cut(String v, int n) => v.length > n ? v.substring(0, n) : v;

typedef _Rule = Object? Function(Object value, String path);

final List<(RegExp, _Rule)> _rules = [
  (RegExp(r'^info\.level$'), (v, _) => clampInt(v as num, 1, 20)),
  (RegExp(r'^info\.classId$'), (v, _) => Catalog.instance.classIds.contains(v) ? v : null),
  (RegExp(r'^info\.backgroundId$'), (v, _) => (v == Catalog.noBackgroundId || Catalog.instance.backgroundIds.contains(v)) ? v : null),
  (RegExp(r'^info\.raceId$'), (v, _) => (v == Catalog.noRaceId || Catalog.instance.raceIds.contains(v)) ? v : null),
  (RegExp(r'^info\.raceChoices\.ability\d$'), (v, _) => (v == '' || Catalog.instance.abilityIds.contains(v)) ? v : null),
  (RegExp(r'^(info\.raceChoices|classSkills)\.skill\d$'), (v, _) => (v == '' || Catalog.instance.skillIds.contains(v)) ? v : null),
  (RegExp(r'^info\.raceChoices\.option$'), (v, _) => _cut(v as String, 40)),
  // Scelte di classe singole/di testo: solo valori noti (la coerenza con la classe attuale la verifica il Model).
  (RegExp(r'^info\.classChoices\.(\w+)$'), (v, path) {
    final allowed = allowedValuesForKey(path.split('.').last);
    final s = v as String;
    return allowed.isEmpty ? _cut(s, maxChoiceText) : (s == '' || allowed.contains(s) ? s : null);
  }),
  (RegExp(r'^equipment\.acItems\.\d+\.name$'), (v, _) => _cut(v as String, 80)),
  (RegExp(r'^equipment\.acItems\.\d+\.bonus$'), (v, _) => clampInt(v as num, -5, 10)),
  (RegExp(r'^abilities\.\w+$'), (v, _) => clampInt(v as num, 1, 30)),
  (RegExp(r'^combat\.hpMax$'), (v, _) => clampInt(v as num, 1, 999)),
  (RegExp(r'^combat\.(hpCurrent|hpTemp)$'), (v, _) => clampInt(v as num, 0, 999)),
  (RegExp(r'^combat\.speed$'), (v, _) => cleanNum(clampNum(((v as num) * 2).round() / 2, 0, 99))),
  (RegExp(r'^combat\.death(Successes|Failures)$'), (v, _) => clampInt(v as num, 0, 3)),
  (RegExp(r'^equipment\.armorId$'), (v, _) => Catalog.instance.armorIds.contains(v) ? v : null),
  (RegExp(r'^(equipment|weapons\.\d+)\.magicBonus$'), (v, _) => clampInt(v as num, -5, 10)),
  (RegExp(r'^weapons\.\d+\.ability$'), (v, _) => _weaponAbilities.contains(v) ? v : null),
  (RegExp(r'^weapons\.\d+\.(name|damage|damageType)$'), (v, _) => _cut(v as String, 80)),
  (RegExp(r'^languages\.pick\d$'), (v, _) => (v == '' || Catalog.instance.languageIds.contains(v)) ? v : null),
  (RegExp(r'^languages\.other$'), (v, _) => _cut(v as String, 200)),
  (RegExp(r'^resourcesUsed\.\w+$'), (v, _) => clampInt(v as num, 0, 999)),
  (RegExp(r'^spells\.slotsUsed\.\d$'), (v, _) => clampInt(v as num, 0, 9)),
  (RegExp(r'^equipment\.coins\.\w+$'), (v, _) => clampInt(v as num, 0, 9999999)),
];

/// Converte `raw` nello stesso tipo del valore attuale; null se impossibile.
Object? _coerceToType(Object? raw, Object? current) {
  if (current is num) {
    if (raw is num) return raw.isFinite ? raw : null;
    if (raw is String) {
      final n = num.tryParse(raw.replaceAll(',', '.').trim());
      return n != null && n.isFinite ? n : null;
    }
    return null;
  }
  if (current is bool) return raw is bool ? raw : (raw == 'true' || raw == 1);
  if (current is String) return (raw is String || raw is num) ? _cut(raw is num ? numStr(raw) : raw as String, _maxTextLength) : null;
  return null;
}

/// Valore valido per `path`, oppure `current` se `raw` non è accettabile.
Object? sanitizeValue(String path, Object? raw, Object? current) {
  final value = _coerceToType(raw, current);
  if (value == null) return current;
  for (final (pattern, rule) in _rules) {
    if (pattern.hasMatch(path)) {
      final result = rule(value, path);
      return result ?? current;
    }
  }
  return value is num ? cleanNum(value) : value;
}

void _mergeKnownKeys(Json target, Map source, [String prefix = '']) {
  for (final key in target.keys.toList()) {
    if (!source.containsKey(key)) continue;
    final path = prefix.isEmpty ? key : '$prefix.$key';
    final current = target[key];
    if (current is List) continue; // gli array sono gestiti a parte
    if (current is Map) {
      if (source[key] is Map) _mergeKnownKeys(current as Json, source[key] as Map, path);
      continue;
    }
    target[key] = sanitizeValue(path, source[key], current);
  }
}

Json _normalizeWeapon(Object? raw, int index, Set<String> usedIds) {
  final weapon = createWeapon();
  if (raw is! Map) return weapon;
  for (final key in weapon.keys.toList()) {
    if (key == 'id' || !raw.containsKey(key)) continue;
    weapon[key] = sanitizeValue('weapons.$index.$key', raw[key], weapon[key]);
  }
  final id = raw['id'];
  if (id is String && id.length <= 64 && !usedIds.contains(id)) weapon['id'] = id;
  usedIds.add(weapon['id'] as String);
  return weapon;
}

Json _normalizeAcItem(Object? raw, int index) {
  final item = createAcItem();
  if (raw is! Map) return item;
  item['name'] = sanitizeValue('equipment.acItems.$index.name', raw['name'], item['name']);
  item['bonus'] = sanitizeValue('equipment.acItems.$index.bonus', raw['bonus'], item['bonus']);
  // A differenza della versione web (che rigenera l'id a ogni caricamento) l'id valido si conserva.
  final id = raw['id'];
  if (id is String && id.isNotEmpty && id.length <= 64) item['id'] = id;
  return item;
}

List<String> _normalizeSpellIds(Object? raw, bool cantrips) {
  if (raw is! List) return [];
  final out = <String>[];
  for (final id in raw) {
    final spell = id is String ? Catalog.instance.getSpell(id) : null;
    if (spell != null && (spell['level'] == 0) == cantrips && !out.contains(id)) out.add(id as String);
  }
  return out.take(cantrips ? Catalog.maxCantrips : Catalog.maxSpells).toList();
}

/// Stato completo e valido a partire da dati qualsiasi (salvataggio, JSON importato, null).
Json normalizeCharacter(Object? raw) {
  final state = createDefaultCharacter();
  if (raw is! Map) return state;
  _mergeKnownKeys(state, raw);

  final usedIds = <String>{};
  state['weapons'] = raw['weapons'] is List
      ? [for (final (i, w) in (raw['weapons'] as List).take(maxWeapons).indexed) _normalizeWeapon(w, i, usedIds)]
      : <Json>[];
  final rawAc = raw['equipment'] is Map ? (raw['equipment'] as Map)['acItems'] : null;
  (state['equipment'] as Json)['acItems'] =
      rawAc is List ? [for (final (i, item) in rawAc.take(maxAcItems).indexed) _normalizeAcItem(item, i)] : <Json>[];
  final rawSpells = raw['spells'] is Map ? raw['spells'] as Map : const {};
  (state['spells'] as Json)['cantripIds'] = _normalizeSpellIds(rawSpells['cantripIds'], true);
  (state['spells'] as Json)['spellIds'] = _normalizeSpellIds(rawSpells['spellIds'], false);
  final info = state['info'] as Json;
  final rawInfo = raw['info'] is Map ? raw['info'] as Map : const {};
  info['classChoices'] = normalizeClassChoices(rawInfo['classChoices'], info['classId'] as String);
  state['version'] = schemaVersion;
  return state;
}
