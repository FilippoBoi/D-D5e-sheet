/// Logica delle scelte di classe (porting di js/model/classChoices.js e js/data/classChoices/index.js).
/// Funzioni pure: nessuno stato proprio.
library;

import '../data/catalog.dart';
import '../i18n.dart';

const maxChoiceText = 60;

bool isListType(String type) => type == 'multi' || type == 'skills';

/// Tutte le chiavi e il loro valore di default ('' oppure []), unione di tutte le classi.
Json defaultChoiceValues() {
  final values = <String, dynamic>{};
  for (final defs in Catalog.instance.classChoices.values) {
    for (final def in defs) {
      values[def['key'] as String] = isListType(def['type'] as String) ? <String>[] : '';
    }
  }
  return values;
}

/// Unione dei valori ammessi per una chiave singola, tra tutte le classi.
Set<String> allowedValuesForKey(String key) {
  final out = <String>{};
  for (final defs in Catalog.instance.classChoices.values) {
    for (final def in defs) {
      if (def['key'] == key) {
        for (final o in (def['options'] as List)) {
          out.add(o['value'] as String);
        }
      }
    }
  }
  return out;
}

/// Quantità al livello dato: numero fisso o tabella [[livello, n], ...] (0 se non ancora disponibile).
int choiceCount(Json def, int level) {
  final count = def['count'];
  if (count is num) return level >= (def['minLevel'] as int) ? count.toInt() : 0;
  var n = 0;
  for (final row in (count as List? ?? const [])) {
    if (level >= (row[0] as int)) n = row[1] as int;
  }
  return n;
}

List<Json> _options(Json def) => [for (final o in (def['options'] as List? ?? const [])) o as Json];

/// Valori ammessi per una scelta (opzioni; per le abilità: pool + voci extra).
Set<String> allowedValues(Json def) {
  if (def['type'] == 'skills') {
    final pool = (def['pool'] as List?)?.cast<String>() ?? Catalog.instance.skillIds;
    return {...pool, for (final e in (def['extra'] as List? ?? const [])) e['value'] as String};
  }
  return {for (final o in _options(def)) o['value'] as String};
}

/// La scelta esiste solo se il valore (attivo) di un'altra scelta è tra quelli richiesti.
bool whenMet(Json def, String Function(String) valueOf) {
  final when = def['when'] as Json?;
  return when == null || (when['in'] as List).contains(valueOf(when['key'] as String));
}

bool prereqMet(Json? prereq, int level, String Function(String) valueOf) {
  if (prereq == null) return true;
  if (prereq['level'] != null && level < (prereq['level'] as int)) return false;
  final choice = prereq['choice'] as Json?;
  if (choice != null && valueOf(choice['key'] as String) != choice['value']) return false;
  return true;
}

/// Stato valido delle scelte per una classe (valori fuori elenco scartati, `when` non soddisfatti azzerati).
Json normalizeClassChoices(Object? raw, String classId) {
  final result = defaultChoiceValues();
  final source = raw is Map ? raw : const {};
  final defs = Catalog.instance.getChoiceDefs(classId);
  for (final def in defs) {
    final key = def['key'] as String;
    final type = def['type'] as String;
    final value = source[key];
    if (type == 'text') {
      if (value is String) result[key] = value.length > maxChoiceText ? value.substring(0, maxChoiceText) : value;
    } else if (isListType(type)) {
      final allowed = allowedValues(def);
      if (value is List) {
        final seen = <String>[];
        for (final v in value) {
          if (v is String && allowed.contains(v) && !seen.contains(v)) seen.add(v);
        }
        result[key] = seen.take(allowed.length).toList();
      }
    } else if (value is String && allowedValues(def).contains(value)) {
      result[key] = value;
    }
  }
  for (final def in defs) {
    final key = def['key'] as String;
    String valueOf(String k) => (result[k] is String) ? result[k] as String : '';
    if (!whenMet(def, valueOf)) result[key] = isListType(def['type'] as String) ? <String>[] : '';
    final differs = def['differsFrom'] as String?;
    if (differs != null && result[key] is String && result[key] != '' && result[key] == result[differs]) result[key] = '';
  }
  return result;
}

/// Valore valido per una singola scelta di testo/singola della classe corrente, oppure null.
String? validateChoiceValue(String classId, String key, Object? value) {
  final def = Catalog.instance.getChoiceDefs(classId).where((d) => d['key'] == key).firstOrNull;
  if (def == null || isListType(def['type'] as String) || value is! String) return null;
  if (def['type'] == 'text') return value.length > maxChoiceText ? value.substring(0, maxChoiceText) : value;
  return value.isEmpty || allowedValues(def).contains(value) ? value : null;
}

List<String> dependentKeys(String classId, String key) => [
      for (final d in Catalog.instance.getChoiceDefs(classId))
        if ((d['when'] as Json?)?['key'] == key) d['key'] as String,
    ];

class ChoiceGroup {
  ChoiceGroup(this.def)
      : key = def['key'] as String,
        type = def['type'] as String;
  final Json def;
  final String key;
  final String type;
  int count = 1;
  List<String> effective = [];
  List<String> overflow = [];
  List<({String value, String reason})> blocked = [];
  String value = '';
  Json? option;
}

class ResolvedChoices {
  final List<ChoiceGroup> groups = [];
  ({Json def, Json option})? subclass;
  final List<({String label, int value})> acWithArmor = [];
  int hpPerLevel = 0;
  Json? unarmoredDefense;
  Json? spellcasting;
  final Set<String> grantedSkills = {};
  final Set<String> expertiseSkills = {};
  final Map<String, String> active = {};
  String valueOf(String key) => active[key] ?? '';
}

ResolvedChoices resolveClassChoices({
  required String classId,
  required int level,
  required Json choices,
  required bool Function(String) isProficient,
}) {
  final cat = Catalog.instance;
  final skillIds = cat.skillIds;
  final r = ResolvedChoices();

  void applyEffects(Json? option, String label) {
    final e = option?['effects'] as Json?;
    if (e == null) return;
    if (e['acWithArmor'] != null && e['acWithArmor'] != 0) r.acWithArmor.add((label: label, value: e['acWithArmor'] as int));
    if (e['hpPerLevel'] != null) r.hpPerLevel += e['hpPerLevel'] as int;
    r.unarmoredDefense ??= e['unarmoredDefense'] as Json?;
    r.spellcasting ??= e['spellcasting'] as Json?;
  }

  for (final def in cat.getChoiceDefs(classId)) {
    if (level < (def['minLevel'] as int) || !whenMet(def, r.valueOf)) continue;
    final g = ChoiceGroup(def);
    final stored = choices[g.key];
    final type = g.type;

    if (type == 'single') {
      final option = _options(def).where((o) => o['value'] == stored).firstOrNull;
      g.value = option?['value'] as String? ?? '';
      g.option = option;
      r.active[g.key] = g.value;
      if (option != null) applyEffects(option, loc(option, 'label'));
      if (def['subclass'] == true && option != null) r.subclass = (def: def, option: option);
    } else if (type == 'text') {
      g.value = stored is String ? stored : '';
    } else {
      g.count = choiceCount(def, level);
      final list = stored is List ? stored.cast<String>() : const <String>[];
      final known = allowedValues(def);
      final ok = <String>[];
      for (final value in list) {
        if (!known.contains(value)) continue;
        final option = _options(def).where((o) => o['value'] == value).firstOrNull;
        final isExtra = (def['extra'] as List? ?? const []).any((e) => e['value'] == value);
        String? reason;
        if (option != null && !prereqMet(option['prereq'] as Json?, level, r.valueOf)) {
          reason = 'prereq';
        } else if (type == 'skills' && def['mode'] == 'expertise' && !isExtra && !isProficient(value) && !r.grantedSkills.contains(value)) {
          reason = 'proficiency';
        }
        if (reason != null) {
          g.blocked.add((value: value, reason: reason));
        } else {
          ok.add(value);
        }
      }
      g.effective = ok.take(g.count).toList();
      g.overflow = ok.skip(g.count).toList();
      for (final value in g.effective) {
        applyEffects(_options(def).where((o) => o['value'] == value).firstOrNull, loc(def, 'label'));
        if (type != 'skills' || !skillIds.contains(value)) continue;
        final mode = def['mode'];
        if (mode == 'proficiency' || mode == 'both') r.grantedSkills.add(value);
        if (mode == 'expertise' || mode == 'both') r.expertiseSkills.add(value);
      }
    }
    r.groups.add(g);
  }
  return r;
}

String _skillLabel(String id) {
  final s = Catalog.instance.getSkill(id);
  return s != null ? loc(s) : id;
}

String _sourceTagged(String label, String? source) => (source != null && source != 'PHB') ? '$label [$source]' : label;

/// Nome leggibile di un valore scelto (opzione, abilità o voce extra).
String choiceValueLabel(Json def, String value) {
  final option = _options(def).where((o) => o['value'] == value).firstOrNull;
  if (option != null) return loc(option, 'label');
  final extra = (def['extra'] as List? ?? const []).where((e) => e['value'] == value).firstOrNull as Json?;
  return extra != null ? loc(extra, 'label') : _skillLabel(value);
}

/// Righe da aggiungere o sostituire nell'elenco dei privilegi, nella lingua corrente.
({List<Json>? subclassFeatures, List<Json> picks}) choiceFeatureRows(ResolvedChoices resolved, int level) {
  final sub = resolved.subclass;
  final subclassFeatures = sub == null
      ? null
      : [
          for (final f in (sub.option['features'] as List).cast<Json>())
            if ((f['level'] as int) <= level)
              {
                'level': f['level'],
                'name': loc(f),
                'description': loc(f, 'description'),
                'tag': '${loc(sub.def, 'label')}: ${loc(sub.option, 'label')}',
              },
        ];

  final picks = <Json>[];
  for (final g in resolved.groups) {
    final def = g.def;
    if (def['subclass'] == true) continue;
    final String? replaces = def['featureName'] != null
        ? loc(def, 'featureName')
        : (def['replacesFeature'] == true ? loc(def, 'label') : null);
    final detail = g.option != null ? loc(g.option, 'description') : '';
    if (g.type == 'single' && def['featureName'] != null && g.option != null) {
      picks.add({
        'level': def['minLevel'], 'name': loc(def, 'label'), 'replaces': replaces, 'append': true,
        'description': '${pick('Scelta', 'Chosen')}: ${loc(g.option, 'label')}.${detail.isNotEmpty ? ' $detail' : ''}',
      });
    } else if (g.type == 'text' && def['featureName'] != null && g.value.isNotEmpty) {
      picks.add({
        'level': def['minLevel'], 'name': loc(def, 'label'), 'replaces': replaces, 'append': true,
        'description': '${pick('Scelta', 'Chosen')}: ${g.value}.',
      });
    } else if (g.type == 'single' && g.option != null && detail.isNotEmpty) {
      picks.add({
        'level': def['minLevel'], 'name': '${loc(def, 'label')}: ${loc(g.option, 'label')}',
        'description': detail, 'replaces': replaces,
      });
    } else if (isListType(g.type) && g.effective.isNotEmpty) {
      picks.add({
        'level': def['minLevel'], 'name': loc(def, 'label'), 'replaces': replaces, 'append': true,
        'description': '${pick('Scelte', 'Chosen')}: ${g.effective.map((v) => choiceValueLabel(def, v)).join(', ')}.',
      });
    }
  }
  return (subclassFeatures: subclassFeatures, picks: picks);
}

String _requirementText(Json option, List<Json> defs) {
  final parts = <String>[];
  final prereq = option['prereq'] as Json?;
  final choice = prereq?['choice'] as Json?;
  if (choice != null) {
    final target = defs.where((d) => d['key'] == choice['key']).firstOrNull;
    final opt = target == null ? null : _options(target).where((o) => o['value'] == choice['value']).firstOrNull;
    if (opt != null) parts.add(loc(opt, 'label'));
  }
  if (prereq?['level'] != null) parts.add(pick('livello ${prereq!['level']}', 'level ${prereq['level']}'));
  final note = loc(option, 'prereqNote');
  if (note.isNotEmpty) parts.add(note.replaceFirst(RegExp(r'^(Richiede|Requires) '), ''));
  return parts.isEmpty ? '' : '${pick('Richiede', 'Requires')}: ${parts.join(', ')}';
}

/// Modello per la UI: una voce per ogni scelta attiva (menu, elenco con caselle o campo di testo).
List<Json> describeChoiceGroups(ResolvedChoices resolved, int level, bool Function(String) isProficient, String classId, Set<String>? enabledSources) {
  final cat = Catalog.instance;
  final defs = cat.getChoiceDefs(classId);
  final reasonText = {
    'prereq': pick('prerequisito non soddisfatto', 'prerequisite not met'),
    'proficiency': pick('non più competente', 'no longer proficient'),
  };
  final skillIds = cat.skillIds;
  return [
    for (final g in resolved.groups)
      () {
        final def = g.def;
        final base = <String, dynamic>{
          'key': g.key, 'type': g.type, 'label': loc(def, 'label'), 'hint': loc(def, 'hint'),
          'count': g.count, 'selectedCount': g.effective.length, 'value': g.value, 'values': g.effective,
          'description': g.option != null ? loc(g.option, 'description') : '',
          'overflow': [for (final v in g.overflow) {'value': v, 'label': choiceValueLabel(def, v)}],
          'blocked': [for (final b in g.blocked) {'value': b.value, 'label': choiceValueLabel(def, b.value), 'reason': reasonText[b.reason]}],
        };
        if (g.type == 'single') {
          final differs = def['differsFrom'] as String?;
          final taken = differs != null ? resolved.valueOf(differs) : '';
          return <String, dynamic>{
            ...base, 'searchable': false,
            'options': [
              for (final o in _options(def))
                if ((taken.isEmpty || o['value'] != taken) &&
                    (enabledSources == null || o['value'] == g.value || enabledSources.contains(o['source'] ?? 'PHB')))
                  {'value': o['value'], 'label': _sourceTagged(loc(o, 'label'), o['source'] as String?)},
            ],
          };
        }
        if (g.type == 'text') return <String, dynamic>{...base, 'options': <Json>[], 'searchable': false};

        final full = g.effective.length >= g.count;
        final values = g.type == 'skills'
            ? [...((def['pool'] as List?)?.cast<String>() ?? skillIds), for (final e in (def['extra'] as List? ?? const [])) e['value'] as String]
            : [for (final o in _options(def)) o['value'] as String];
        final options = [
          for (final value in values)
            () {
              final option = _options(def).where((o) => o['value'] == value).firstOrNull;
              final selected = g.effective.contains(value);
              final isSkill = skillIds.contains(value);
              var note = option != null ? [loc(option, 'description'), _requirementText(option, defs)].where((s) => s.isNotEmpty).join(' · ') : '';
              var disabled = false;
              if (!selected) {
                if (full) disabled = true;
                if (option?['prereq'] != null && !prereqMet(option!['prereq'] as Json?, level, resolved.valueOf)) disabled = true;
                if (g.type == 'skills' && def['mode'] == 'expertise' && isSkill && !isProficient(value) && !resolved.grantedSkills.contains(value)) {
                  disabled = true;
                  note = pick('Non competente', 'Not proficient');
                }
              }
              return <String, dynamic>{
                'value': value, 'label': choiceValueLabel(def, value), 'note': note, 'selected': selected, 'disabled': disabled,
                'group': option != null ? loc(option, 'group') : '',
              };
            }(),
        ];
        return <String, dynamic>{...base, 'options': options, 'searchable': options.length > 12};
      }(),
  ];
}
