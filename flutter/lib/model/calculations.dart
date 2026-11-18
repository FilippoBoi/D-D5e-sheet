/// Formule di D&D 5E come funzioni pure (porting di js/model/calculations.js).
library;

import 'dart:math' as math;

import '../data/catalog.dart';
import '../i18n.dart';
import 'utils.dart';

int abilityModifier(num score) => ((score - 10) / 2).floor();

int proficiencyBonus(num level) => ((clampInt(level, 1, 20) - 1) / 4).floor() + 2;

int armorDexBonus(String category, int dexMod) {
  switch (category) {
    case 'heavy':
      return 0;
    case 'medium':
      return math.min(dexMod, Catalog.instance.mediumMaxDex);
    default:
      return dexMod;
  }
}

class AcPart {
  const AcPart(this.label, this.value);
  final String label;
  final int value;
}

class ArmorClass {
  const ArmorClass(this.total, this.parts);
  final int total;
  final List<AcPart> parts;
}

ArmorClass computeArmorClass({
  required Json armor,
  required bool hasShield,
  int magicBonus = 0,
  required Map<String, int> mods,
  Json? unarmoredDefense,
  List<AcPart> extraItems = const [],
  List<AcPart> armorBonuses = const [],
}) {
  final cat = Catalog.instance;
  final parts = <AcPart>[];
  final category = armor['category'] as String;
  if (category == 'none') {
    // Difesa senza Armatura: il Monaco la perde se impugna uno scudo.
    final applies = unarmoredDefense != null && (!hasShield || unarmoredDefense['allowsShield'] == true);
    parts.add(AcPart(pick('Base', 'Base'), applies ? (unarmoredDefense['base'] as int? ?? 10) : 10));
    parts.add(AcPart(loc(cat.getAbility('dex'), 'short'), mods['dex']!));
    if (applies && unarmoredDefense['ability'] != null) {
      final id = unarmoredDefense['ability'] as String;
      parts.add(AcPart(loc(cat.getAbility(id), 'short'), mods[id]!));
    }
  } else {
    parts.add(AcPart(loc(armor), armor['baseAC'] as int));
    if (category != 'heavy') parts.add(AcPart(loc(cat.getAbility('dex'), 'short'), armorDexBonus(category, mods['dex']!)));
    parts.addAll(armorBonuses);
  }
  if (hasShield) parts.add(AcPart(pick('Scudo', 'Shield'), cat.shieldBonus));
  if (magicBonus != 0) parts.add(AcPart(pick('Magia', 'Magic'), magicBonus));
  for (final item in extraItems) {
    if (item.value != 0) parts.add(item);
  }
  return ArmorClass(parts.fold(0, (sum, p) => sum + p.value), parts);
}

int skillBonus({required int abilityMod, required int profBonus, required bool proficient, required bool expertise, int jackOfAllTrades = 0}) {
  if (proficient && expertise) return abilityMod + profBonus * 2;
  if (proficient) return abilityMod + profBonus;
  return abilityMod + jackOfAllTrades;
}

int attackBonus({required int abilityMod, required int profBonus, required bool proficient, int magicBonus = 0}) =>
    abilityMod + (proficient ? profBonus : 0) + magicBonus;

int spellSaveDC(int profBonus, int abilityMod) => 8 + profBonus + abilityMod;
int spellAttackBonus(int profBonus, int abilityMod) => profBonus + abilityMod;

class SlotMax {
  const SlotMax(this.level, this.max);
  final int level;
  final int max;
}

List<SlotMax> spellSlotsFor(String? progression, int level) {
  final cat = Catalog.instance;
  List<SlotMax> toSlots(List<int>? row) => [for (var i = 0; i < (row?.length ?? 0); i++) SlotMax(i + 1, row![i])];
  List<int>? at(List<List<int>?> table, int l) => l >= 0 && l < table.length ? table[l] : null;
  switch (progression) {
    case 'full':
      return toSlots(at(cat.fullSlots, level));
    case 'half':
      return level < 2 ? [] : toSlots(at(cat.fullSlots, (level / 2).ceil()));
    case 'third':
      return toSlots(at(cat.thirdSlots, clampInt(level, 1, 20)));
    case 'pact':
      var row = cat.pactTable.first;
      for (final entry in cat.pactTable) {
        if (level >= entry[0]) row = entry;
      }
      return [SlotMax(row[2], row[1])];
    default:
      return [];
  }
}

num suggestedMaxHp(int hitDie, int level, int conMod, [int bonusPerLevel = 0]) {
  final lvl = clampInt(level, 1, 20);
  final first = math.max(1, hitDie + conMod);
  final perLevel = math.max(1, hitDie / 2 + 1 + conMod);
  return cleanNum(first + perLevel * (lvl - 1) + bonusPerLevel * lvl);
}

num averageHpGain(int hitDie, int conMod, [int bonusPerLevel = 0]) =>
    cleanNum(math.max(1, hitDie / 2 + 1 + conMod) + bonusPerLevel);

int rolledHpGain(int roll, int conMod, [int bonusPerLevel = 0]) => math.max(1, roll + conMod) + bonusPerLevel;
