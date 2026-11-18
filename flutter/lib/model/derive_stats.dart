/// Calcola tutti i valori derivati della scheda dallo stato grezzo (porting di js/model/deriveStats.js).
///
/// Lo stato contiene solo ciò che il giocatore inserisce; il resto si ricalcola ad ogni modifica.
/// Il risultato è JSON puro, con le stesse chiavi della versione web (la usa il test di parità).
library;

import 'dart:math' as math;

import '../data/catalog.dart';
import '../i18n.dart';
import 'calculations.dart';
import 'class_choices.dart';
import 'class_resources.dart';
import 'languages.dart';
import 'race_traits.dart';
import 'spell_text.dart';
import 'utils.dart';

List<String> _uniqueValid(Iterable<String> values) {
  final out = <String>[];
  for (final v in values) {
    if (v.isNotEmpty && !out.contains(v)) out.add(v);
  }
  return out;
}

List<Json> _abilityOptions([List<String> exclude = const []]) => [
      for (final a in Catalog.instance.abilities)
        if (!exclude.contains(a['id'])) {'value': a['id'], 'label': loc(a)},
    ];

List<Json> _skillOptions([List<String>? ids]) => [
      for (final s in Catalog.instance.skills)
        if (ids == null || ids.contains(s['id'])) {'value': s['id'], 'label': loc(s)},
    ];

String _armorFormula(Json armor, Json? unarmoredDefense) {
  final cat = Catalog.instance;
  final dex = loc(cat.getAbility('dex'), 'short');
  switch (armor['category']) {
    case 'none':
      final base = unarmoredDefense?['base'] ?? 10;
      final ab = unarmoredDefense?['ability'] as String?;
      return ab != null ? '$base + $dex + ${loc(cat.getAbility(ab), 'short')}' : '$base + $dex';
    case 'light':
      return '${armor['baseAC']} + $dex';
    case 'medium':
      return '${armor['baseAC']} + $dex (max +${cat.mediumMaxDex})';
    default:
      return '${armor['baseAC']} (${pick('fissa', 'fixed')})';
  }
}

String _hpLevel(num percent) => percent > 50 ? 'high' : (percent > 20 ? 'mid' : 'low');

/// Privilegi di classe fino al livello, con le righe delle scelte (sottoclasse, stili…) integrate.
List<Json> getClassFeatures(String classId, int level, {List<Json>? subclassFeatures, List<Json> picks = const []}) {
  final source = Catalog.instance.classFeatures[lang == 'en' ? 'en' : 'it']!;
  final rows = <Json>[
    for (final f in ((source[classId] as List?) ?? const []).cast<Json>())
      if ((f['level'] as int) <= level && !(subclassFeatures != null && f['generic'] == true)) {...f},
  ];
  if (subclassFeatures != null) {
    rows.addAll(subclassFeatures.where((f) => (f['level'] as int) <= level).map((f) => {...f}));
  }
  final used = <Json>{};
  for (final p in picks) {
    Json? target;
    if (p['replaces'] != null) {
      for (final r in rows) {
        if (r['level'] == p['level'] && r['name'] == p['replaces'] && !used.contains(r)) {
          target = r;
          break;
        }
      }
    }
    if (target != null) {
      used.add(target);
      if (p['append'] == true) {
        target['description'] = '${target['description']} ${p['description']}';
      } else {
        target['name'] = p['name'];
        target['description'] = p['description'];
      }
    } else {
      rows.add({'level': p['level'], 'name': p['name'], 'description': p['description']});
    }
  }
  // Ordinamento stabile per livello (come Array.sort).
  final indexed = [for (var i = 0; i < rows.length; i++) (i, rows[i])];
  indexed.sort((a, b) {
    final c = (a.$2['level'] as int).compareTo(b.$2['level'] as int);
    return c != 0 ? c : a.$1.compareTo(b.$1);
  });
  return [for (final e in indexed) e.$2];
}

Json deriveStats(Json state, {Set<String>? sources}) {
  final cat = Catalog.instance;
  final info = state['info'] as Json;
  final cls = cat.getClass(info['classId'] as String);
  final level = info['level'] as int;
  final profBonus = proficiencyBonus(level);
  final race = cat.getRace(info['raceId'] as String);
  final background = cat.getBackground(info['backgroundId'] as String);
  final classStart = cat.classStarting[cls['id']] as Json;
  final raceChoicesState = info['raceChoices'] as Json;
  final skillsState = state['skills'] as Json;

  // Scelte di razza: caratteristiche (+bonus a due diverse, esclusioni), abilità, opzione singola.
  final raceChoice = race?['abilityChoice'] as Json?;
  final chosenAbilities = raceChoice != null
      ? _uniqueValid([raceChoicesState['ability1'] as String, raceChoicesState['ability2'] as String])
          .where((id) => !(raceChoice['exclude'] as List).contains(id))
          .toList()
      : <String>[];
  final racialSkills = <String>{
    ...((race?['skills'] as List?)?.cast<String>() ?? const []),
    ...((background?['skills'] as List?)?.cast<String>() ?? const []),
    if (race?['skillChoice'] != null) ..._uniqueValid([raceChoicesState['skill1'] as String, raceChoicesState['skill2'] as String]),
  };

  // Competenze di classe: solo tra quelle previste, nel numero consentito.
  final skillChoice = classStart['skillChoice'] as Json;
  final classSkillIds = _uniqueValid((state['classSkills'] as Json).values.cast<String>())
      .where((id) => (skillChoice['from'] as List).contains(id))
      .take(skillChoice['count'] as int)
      .toList();
  final classSkillSet = classSkillIds.toSet();
  bool baseProficient(String id) =>
      (skillsState[id] as Json)['proficient'] == true || racialSkills.contains(id) || classSkillSet.contains(id);

  // Scelte di classe: abilità concesse, Maestria ed effetti calcolabili (CA, PF).
  final resolved = resolveClassChoices(
    classId: cls['id'] as String, level: level, choices: info['classChoices'] as Json, isProficient: baseProficient,
  );
  bool skillProficient(String id) => baseProficient(id) || resolved.grantedSkills.contains(id);

  // Punteggio finale = valore inserito + bonus razziali (fissi e scelti).
  int racialBonus(String id) =>
      (((race?['abilityBonuses'] as Json?)?[id]) as int? ?? 0) + (chosenAbilities.contains(id) ? raceChoice!['bonus'] as int : 0);
  final abilityIds = cat.abilityIds;
  final scores = {for (final id in abilityIds) id: ((state['abilities'] as Json)[id] as int) + racialBonus(id)};
  final mods = {for (final id in abilityIds) id: abilityModifier(scores[id]!)};

  // Factotum del Bardo (dal 2° livello): metà competenza alle prove non competenti.
  final jackOfAllTrades = cls['id'] == 'bard' && level >= 2 ? (profBonus / 2).floor() : 0;

  final saveProf = state['saveProficiencies'] as Json;
  final saves = {for (final id in abilityIds) id: mods[id]! + (saveProf[id] == true ? profBonus : 0)};
  final skills = {
    for (final s in cat.skills)
      s['id'] as String: skillBonus(
        abilityMod: mods[s['ability']]!,
        profBonus: profBonus,
        proficient: skillProficient(s['id'] as String),
        expertise: (skillsState[s['id']] as Json)['expertise'] == true || resolved.expertiseSkills.contains(s['id']),
        jackOfAllTrades: jackOfAllTrades,
      ),
  };

  // --- Armatura e CA ---
  final equipment = state['equipment'] as Json;
  final armor = cat.getArmor(equipment['armorId'] as String);
  final unarmoredDefense = (cls['unarmoredDefense'] as Json?) ?? resolved.unarmoredDefense;
  final acItems = (equipment['acItems'] as List).cast<Json>();
  final ac = computeArmorClass(
    armor: armor,
    hasShield: equipment['shield'] == true,
    magicBonus: equipment['magicBonus'] as int,
    mods: mods,
    unarmoredDefense: unarmoredDefense,
    armorBonuses: [for (final b in resolved.acWithArmor) AcPart(b.label, b.value)],
    extraItems: [
      for (final item in acItems)
        AcPart((item['name'] as String).isEmpty ? pick('Oggetto', 'Item') : item['name'] as String, item['bonus'] as int),
    ],
  );

  // --- Incantesimi ---
  final casting = (cls['spellcasting'] as Json?) ?? resolved.spellcasting;
  final isCaster = casting != null && level >= (casting['minLevel'] as int);
  final castMod = casting != null ? mods[casting['ability']]! : 0;
  final slotsUsed = (state['spells'] as Json)['slotsUsed'] as Json;
  final slots = isCaster
      ? [
          for (final slot in spellSlotsFor(casting['progression'] as String?, level))
            () {
              final used = math.min((slotsUsed['${slot.level}'] as int?) ?? 0, slot.max);
              return {'level': slot.level, 'max': slot.max, 'used': used, 'remaining': '${slot.max - used}/${slot.max}'};
            }(),
        ]
      : <Json>[];

  // Incantesimi scelti: lista di riferimento, tetto di livello e limiti indicativi.
  final listClass = (casting?['list'] as String?) ?? cls['id'] as String;
  final limits = isCaster
      ? spellLimits((casting['table'] as String?) ?? cls['id'] as String, level, castMod)
      : (cantrips: 0, spells: 0, kind: 'known');
  List<Json> chosenSpells(List ids) {
    final list = [for (final id in ids) if (cat.getSpell(id as String) != null) describeSpell(cat.getSpell(id)!)];
    list.sort((a, b) {
      final c = (a['level'] as int).compareTo(b['level'] as int);
      return c != 0 ? c : compareNames(a['name'] as String, b['name'] as String);
    });
    return list;
  }

  Json spellPick(List ids, int limit) => {
        'limit': limit, 'count': ids.length, 'over': math.max(0, ids.length - limit), 'selected': chosenSpells(ids),
        'status': ids.length > limit ? 'over' : (ids.length == limit ? 'full' : 'open'),
      };
  final spellsState = state['spells'] as Json;
  final cantripPick = spellPick(spellsState['cantripIds'] as List, limits.cantrips);
  final spellsPick = spellPick(spellsState['spellIds'] as List, limits.spells);

  // --- Punti ferita ---
  final combat = state['combat'] as Json;
  final hpMax = combat['hpMax'] as int;
  final hpCurrent = combat['hpCurrent'] as int;
  final hpPercent = clampNum((hpCurrent / hpMax * 100).round(), 0, 100).toInt();

  final rows = choiceFeatureRows(resolved, level);
  final features = getClassFeatures(cls['id'] as String, level, subclassFeatures: rows.subclassFeatures, picks: rows.picks);
  final resources = getClassResources(cls['id'] as String, level, mods,
      subclass: (resolved.subclass?.option['value'] as String?) ?? '', profBonus: profBonus);

  // Tratti razziali: descrizioni, resistenze, competenze, PF extra e usi limitati.
  final raceOption = race?['option'] != null ? raceChoicesState['option'] as String : '';
  final raceOptionEntry = race?['option'] != null
      ? ((race!['option'] as Json)['options'] as List).cast<Json>().where((o) => o['value'] == raceOption).firstOrNull
      : null;
  final raceTraits = resolveRaceTraits(
    (race?['id'] as String?) ?? '',
    level: level, profBonus: profBonus, mods: mods, option: raceOption,
    optionLabel: raceOptionEntry != null ? loc(raceOptionEntry, 'label') : '',
  );
  final hpPerLevel = resolved.hpPerLevel + raceTraits.hpPerLevel;

  // Lingue: fisse (razza, background, classe), a scelta (menu) e libere.
  final raceLang = parseLanguageText(race?['languages'] as String?);
  final bgLang = parseLanguageText(background?['languages'] as String?);
  final classLang = cat.classLanguages[cls['id']];
  final fixedIds = _uniqueValid([...raceLang.ids, ...bgLang.ids, ?classLang]);
  final fixedCustom = _uniqueValid([...raceLang.custom, ...bgLang.custom]);
  final slotCount = math.min(Catalog.maxLanguagePicks, raceLang.choices + bgLang.choices);
  final pickedIds = <String>[];
  final langState = state['languages'] as Json;
  final langValues = langState.entries.toList();
  final languageSlots = [
    for (var i = 0; i < slotCount; i++)
      () {
        final key = 'pick${i + 1}';
        final raw = langState[key] as String;
        final duplicate = raw.isNotEmpty && (fixedIds.contains(raw) || pickedIds.contains(raw));
        if (raw.isNotEmpty && !duplicate) pickedIds.add(raw);
        final taken = <String>{
          ...fixedIds,
          for (var j = 0; j < langValues.length; j++)
            if (j < slotCount && (langValues[j].value as String).isNotEmpty && 'pick${j + 1}' != key) langValues[j].value as String,
        };
        return <String, dynamic>{
          'key': key, 'value': raw, 'duplicate': duplicate,
          'options': [
            for (final l in cat.languages)
              if (l['special'] != true && (!taken.contains(l['id']) || l['id'] == raw)) {'value': l['id'], 'label': loc(l)},
          ],
        };
      }(),
  ];
  final otherLanguages = (langState['other'] as String).split(RegExp(r'[,;]')).map((x) => x.trim()).where((x) => x.isNotEmpty);
  final knownLanguages = _uniqueValid([
    ...fixedIds.map(languageName), ...fixedCustom, ...pickedIds.map(languageName), ...otherLanguages,
  ]);

  final resourcesUsed = state['resourcesUsed'] as Json;
  final usables = [
    for (final r in resources)
      if (r['use'] != null)
        {'id': (r['use'] as Json)['id'], 'label': r['label'], 'detail': r['value'], 'max': (r['use'] as Json)['max'], 'recharge': (r['use'] as Json)['recharge']},
    for (final u in raceTraits.uses) {'id': u['id'], 'label': u['label'], 'detail': u['detail'] ?? '', 'max': u['max'], 'recharge': u['recharge']},
  ].map((u) {
    final used = math.min((resourcesUsed[u['id']] as int?) ?? 0, u['max'] as int);
    return <String, dynamic>{...u, 'used': used, 'remaining': '${(u['max'] as int) - used}/${u['max']}', 'path': 'resourcesUsed.${u['id']}'};
  }).toList();

  String skillName(String id) => cat.getSkill(id) != null ? loc(cat.getSkill(id)) : id;

  // Menu a tendina per le scelte di razza (vuoto se la razza non ne ha).
  final raceChoices = <Json>[];
  if (raceChoice != null) {
    final exclude = (raceChoice['exclude'] as List).cast<String>();
    raceChoices.addAll([
      {'key': 'ability1', 'label': pick('Aumento caratteristica 1', 'Ability increase 1'), 'options': _abilityOptions(exclude), 'value': raceChoicesState['ability1']},
      {'key': 'ability2', 'label': pick('Aumento caratteristica 2', 'Ability increase 2'), 'options': _abilityOptions(exclude), 'value': raceChoicesState['ability2']},
    ]);
  }
  if (race?['skillChoice'] != null) {
    raceChoices.addAll([
      {'key': 'skill1', 'label': pick('Abilità 1', 'Skill 1'), 'options': _skillOptions(), 'value': raceChoicesState['skill1']},
      {'key': 'skill2', 'label': pick('Abilità 2', 'Skill 2'), 'options': _skillOptions(), 'value': raceChoicesState['skill2']},
    ]);
  }
  if (race?['option'] != null) {
    final opt = race!['option'] as Json;
    raceChoices.add({
      'key': 'option', 'label': loc(opt, 'label'),
      'options': [for (final o in (opt['options'] as List).cast<Json>()) {'value': o['value'], 'label': loc(o, 'label')}],
      'value': raceChoicesState['option'],
    });
  }

  // Competenze di classe: le abilità già concesse da razza o background non si ripetono.
  final fromList = (skillChoice['from'] as List).cast<String>();
  final classSkillSlots = [
    for (var i = 0; i < (skillChoice['count'] as int); i++)
      () {
        final value = i < classSkillIds.length ? classSkillIds[i] : '';
        return <String, dynamic>{
          'key': 'skill${i + 1}', 'value': value,
          'duplicate': value.isNotEmpty && racialSkills.contains(value),
          'options': _skillOptions(fromList.where((id) => !racialSkills.contains(id) || id == value).toList()),
        };
      }(),
  ];

  final classChoiceGroups = describeChoiceGroups(resolved, level, baseProficient, cls['id'] as String, sources);

  final weapons = (state['weapons'] as List).cast<Json>();
  int weaponAttack(Json w) => attackBonus(
      abilityMod: mods[w['ability']]!, profBonus: profBonus, proficient: w['proficient'] == true, magicBonus: w['magicBonus'] as int);

  final hitDie = cls['hitDie'] as int;
  final armorCategory = armor['category'] as String;
  final darkvisionFt = race?['darkvisionFt'] as num?;

  return {
    'sources': [...?sources],
    'race': race != null
        ? {
            'name': loc(race),
            'languages': loc(race, 'languages'),
            'traits': loc(race, 'traits'),
            'bonuses': [
              for (final e in (race['abilityBonuses'] as Json).entries) '${loc(cat.getAbility(e.key), 'short')} +${e.value}',
              if (raceChoice != null)
                pick('${raceChoice['count']} caratteristiche a scelta +${raceChoice['bonus']}', '${raceChoice['count']} abilities of your choice +${raceChoice['bonus']}'),
            ].join(', '),
            'darkvision': (darkvisionFt != null && darkvisionFt != 0) ? '${numStr(feetToMeters(darkvisionFt))} m' : pick('Nessuna', 'None'),
            'choices': raceChoices,
            'resistances': raceTraits.resistances.join(', '),
            'proficiencies': [
              if (raceTraits.proficiencies['armor']!.isNotEmpty) '${pick('Armature', 'Armor')}: ${raceTraits.proficiencies['armor']!.join(', ')}',
              if (raceTraits.proficiencies['weapons']!.isNotEmpty) '${pick('Armi', 'Weapons')}: ${raceTraits.proficiencies['weapons']!.join(', ')}',
              if (raceTraits.proficiencies['tools']!.isNotEmpty) '${pick('Strumenti', 'Tools')}: ${raceTraits.proficiencies['tools']!.join(', ')}',
            ].join(' · '),
          }
        : null,
    'raceTraits': raceTraits.traits,
    'hasRaceTraits': raceTraits.traits.isNotEmpty,
    'languageInfo': {
      'known': knownLanguages.isEmpty ? pick('Nessuna', 'None') : knownLanguages.join(', '),
      'slots': languageSlots,
      'hasSlots': languageSlots.isNotEmpty,
    },
    'background': {
      'isCustom': background == null,
      'name': background != null ? loc(background) : '',
      'skills': background != null ? (background['skills'] as List).cast<String>().map(skillName).join(', ') : '',
      'tools': background != null ? (loc(background, 'tools').isEmpty ? pick('Nessuno', 'None') : loc(background, 'tools')) : '',
      'languages': background != null ? (loc(background, 'languages').isEmpty ? pick('Nessuna', 'None') : loc(background, 'languages')) : '',
      'equipment': background != null ? loc(background, 'equipment') : '',
      'feature': background != null ? loc(background, 'feature') : '',
    },
    'classInfo': {
      'armor': loc(classStart, 'armor').isEmpty ? pick('Nessuna', 'None') : loc(classStart, 'armor'),
      'weapons': loc(classStart, 'weapons'),
      'tools': loc(classStart, 'tools').isEmpty ? pick('Nessuno', 'None') : loc(classStart, 'tools'),
      'skillChoice': '${pick('Scegli', 'Choose')} ${skillChoice['count']}: ${fromList.map(skillName).join(', ')}',
      'skillSlots': classSkillSlots,
    },
    'classChoices': classChoiceGroups,
    'hasClassChoices': classChoiceGroups.isNotEmpty,
    'expertiseFromChoices': resolved.expertiseSkills.toList(),
    // Abilità la cui competenza arriva da razza, background, classe o scelte: spuntate e bloccate nella scheda.
    'proficientFromSources': [
      for (final id in cat.skillIds)
        if (skillProficient(id) && (skillsState[id] as Json)['proficient'] != true) id,
    ],
    'hasAcItems': acItems.isNotEmpty,
    'className': loc(cls),
    'featuresTitle': pick('Privilegi di ${loc(cls)}', '${loc(cls)} features'),
    'hitDie': 'd$hitDie',
    'profBonus': profBonus,
    'mods': mods,
    'saves': saves,
    'skills': skills,
    'passivePerception': 10 + skills['perception']!,
    'initiative': mods['dex']! + jackOfAllTrades,
    'ac': ac.total,
    'acBreakdown': [
      for (var i = 0; i < ac.parts.length; i++) i == 0 ? '${ac.parts[i].label} ${ac.parts[i].value}' : '${ac.parts[i].label} ${formatModifier(ac.parts[i].value)}',
    ].join(' · '),
    'armor': {
      'category': (lang == 'it' ? cat.armorCategories : cat.armorCategoriesEn)[armorCategory],
      'formula': _armorFormula(armor, armorCategory == 'none' ? unarmoredDefense : null),
      'strReq': armor['strReq'],
      'strengthWarning': (armor['strReq'] as int) > 0 && scores['str']! < (armor['strReq'] as int),
      'stealthDisadvantage': armor['stealthDisadvantage'],
    },
    'weapons': [
      for (final w in weapons)
        {
          'attack': weaponAttack(w),
          'damageLabel': '${(w['damage'] as String).isEmpty ? '—' : w['damage']} ${formatModifier(mods[w['ability']]! + (w['magicBonus'] as int))}'.trim(),
        },
    ],
    'hasWeapons': weapons.isNotEmpty,
    // Riepilogo in alto: il TpC più alto tra le armi in tabella (assente se non ce ne sono).
    'topAttack': weapons.isEmpty ? null : weapons.map(weaponAttack).reduce(math.max),
    'spellcasting': {
      'isCaster': isCaster,
      'abilityName': casting != null ? loc(cat.getAbility(casting['ability'] as String)) : '',
      'dc': spellSaveDC(profBonus, castMod),
      'attack': spellAttackBonus(profBonus, castMod),
      'isPact': casting?['progression'] == 'pact',
      'slots': slots,
      'listClass': listClass,
      'listClassName': loc(cat.getClass(listClass)),
      'maxLevel': slots.fold<int>(0, (max, slot) => math.max(max, slot['level'] as int)),
      'knowledge': limits.kind,
      'spellsTitle': limits.kind == 'prepared' ? pick('Incantesimi preparati', 'Spells prepared') : pick('Incantesimi conosciuti', 'Spells known'),
      'listFromSubclass': casting?['table'] != null,
      'showCantrips': (cantripPick['limit'] as int) > 0 || (cantripPick['count'] as int) > 0,
      'cantrips': cantripPick,
      'spells': spellsPick,
    },
    'features': features,
    // Risorse a usi limitati (con spunte) e risorse solo informative (valori che scalano col livello).
    'usables': usables,
    'infoResources': [for (final r in resources) if (r['use'] == null) r],
    'resources': resources,
    'hasResources': resources.isNotEmpty,
    'hasUsables': usables.isNotEmpty,
    'hp': {
      'hitDieSides': hitDie,
      'conMod': mods['con'],
      'perLevelBonus': hpPerLevel,
      'averageGain': averageHpGain(hitDie, mods['con']!, hpPerLevel),
      'suggested': suggestedMaxHp(hitDie, level, mods['con']!, hpPerLevel),
      'percent': hpPercent,
      'level': _hpLevel(hpPercent),
      'isDown': hpCurrent <= 0,
      'summary': '$hpCurrent/$hpMax${(combat['hpTemp'] as int) != 0 ? ' +${combat['hpTemp']}' : ''}',
    },
  };
}
