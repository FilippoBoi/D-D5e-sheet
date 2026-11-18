/// Cataloghi di regole, caricati dai JSON esportati da js/data (vedi scripts/export-flutter-data.mjs).
library;

import 'dart:convert';

import '../i18n.dart';

/// Nome dei file in assets/data/ che formano il catalogo.
const catalogFiles = [
  'catalog.json', 'class_features.json', 'class_choices.json', 'spells.json', 'ui_en.json', 'skill_text.json',
];

class Catalog {
  Catalog._(Map<String, String> files) {
    final c = jsonDecode(files['catalog.json']!) as Json;
    abilities = _list(c['abilities']);
    alignments = _list(c['alignments']);
    skills = _list(c['skills']);
    classList = _list(c['classes']);
    classStarting = c['classStarting'] as Json;
    final armorsJson = c['armors'] as Json;
    armors = _list(armorsJson['list']);
    armorCategories = Map<String, String>.from(armorsJson['categories'] as Map);
    armorCategoriesEn = Map<String, String>.from(armorsJson['categoriesEn'] as Map);
    mediumMaxDex = armorsJson['mediumMaxDex'] as int;
    shieldBonus = armorsJson['shieldBonus'] as int;
    final langs = c['languages'] as Json;
    languages = _list(langs['list']);
    classLanguages = Map<String, String>.from(langs['classLanguages'] as Map);
    final src = c['sources'] as Json;
    sources = _list(src['list']);
    sourceGroupLabels = src['groupLabels'] as Json;
    final slots = c['slots'] as Json;
    fullSlots = _slotTable(slots['full']);
    thirdSlots = _slotTable(slots['third']);
    pactTable = [for (final row in slots['pact'] as List) List<int>.from(row as List)];
    spellProgression = c['spellProgression'] as Json;
    races = _list(c['races']);
    backgrounds = _list(c['backgrounds']);
    final rt = c['raceTraits'] as Json;
    raceTraits = rt['traits'] as Json;
    raceTraitKeys = rt['byRace'] as Json;
    raceResourceIds = List<String>.from(rt['resourceIds'] as List);
    resourceIds = List<String>.from(c['resourceIds'] as List);

    final feats = jsonDecode(files['class_features.json']!) as Json;
    classFeatures = {
      'it': feats['it'] as Json,
      'en': feats['en'] as Json,
    };
    final choices = jsonDecode(files['class_choices.json']!) as Json;
    classChoices = {for (final e in choices.entries) e.key: _list(e.value)};
    spells = _list(jsonDecode(files['spells.json']!));
    uiEn = Map<String, String>.from(jsonDecode(files['ui_en.json']!) as Map);
    skillText = jsonDecode(files['skill_text.json']!) as Json;

    _classById = {for (final x in classList) x['id'] as String: x};
    _raceById = {for (final x in races) x['id'] as String: x};
    _bgById = {for (final x in backgrounds) x['id'] as String: x};
    _spellById = {for (final x in spells) x['id'] as String: x};
    _abilityById = {for (final x in abilities) x['id'] as String: x};
    _skillById = {for (final x in skills) x['id'] as String: x};
    _langById = {for (final x in languages) x['id'] as String: x};
    sourceIds = [for (final s in sources) s['id'] as String];
  }

  /// Dai contenuti dei file JSON (test o caricamento da asset).
  factory Catalog.parse(Map<String, String> files) => Catalog._(files);

  static late Catalog instance;

  late final List<Json> abilities, alignments, skills, classList, armors, languages, sources, races, backgrounds, spells;
  late final Json classStarting, sourceGroupLabels, spellProgression, raceTraits, raceTraitKeys, skillText;
  late final Map<String, String> armorCategories, armorCategoriesEn, classLanguages, uiEn;
  late final int mediumMaxDex, shieldBonus;
  late final List<List<int>> pactTable;
  late final List<List<int>?> fullSlots, thirdSlots;
  late final List<String> raceResourceIds, resourceIds, sourceIds;
  late final Map<String, Json> classFeatures;
  late final Map<String, List<Json>> classChoices;
  late final Map<String, Json> _classById, _raceById, _bgById, _spellById, _abilityById, _skillById, _langById;

  static const coreSource = 'PHB';
  static const noRaceId = '';
  static const noBackgroundId = '';
  static const defaultClassId = 'barbarian';
  static const maxLanguagePicks = 4;
  static const maxCantrips = 40;
  static const maxSpells = 200;

  List<String> get abilityIds => [for (final a in abilities) a['id'] as String];
  List<String> get skillIds => [for (final s in skills) s['id'] as String];
  List<String> get classIds => [for (final c in classList) c['id'] as String];
  List<String> get raceIds => [for (final r in races) r['id'] as String];
  List<String> get backgroundIds => [for (final b in backgrounds) b['id'] as String];
  List<String> get armorIds => [for (final a in armors) a['id'] as String];
  List<String> get languageIds => [for (final l in languages) if (l['special'] != true) l['id'] as String];

  Json getClass(String id) => _classById[id] ?? _classById[defaultClassId]!;
  Json? getRace(String id) => _raceById[id];
  Json? getBackground(String id) => _bgById[id];
  Json? getSpell(String id) => _spellById[id];
  Json? getAbility(String id) => _abilityById[id];
  Json? getSkill(String id) => _skillById[id];
  Json? getLanguage(String id) => _langById[id];
  Json getArmor(String id) => armors.firstWhere((a) => a['id'] == id, orElse: () => armors.first);
  List<Json> getChoiceDefs(String classId) => classChoices[classId] ?? const [];
  Json? getSource(String id) {
    for (final s in sources) {
      if (s['id'] == id) return s;
    }
    return null;
  }

  static List<Json> _list(Object? v) => [for (final e in v as List) e as Json];
  static List<List<int>?> _slotTable(Object? v) =>
      [for (final row in v as List) row == null ? null : List<int>.from(row as List)];
}

/// Manuali attivi: solo sigle note, PHB sempre incluso.
Set<String> normalizeSources(Object? raw) {
  final set = <String>{Catalog.coreSource};
  if (raw is List) {
    for (final id in raw) {
      if (id is String && Catalog.instance.sourceIds.contains(id)) set.add(id);
    }
  }
  return set;
}
