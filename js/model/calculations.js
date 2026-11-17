/**
 * Formule di D&D 5E come funzioni pure: nessuno stato, nessun DOM.
 * Sono il cuore testabile del Model (vedi tests/calculations.test.js).
 */
import { MEDIUM_ARMOR_MAX_DEX, SHIELD_AC_BONUS } from '../data/armors.js';
import { getAbility } from '../data/abilities.js';
import { FULL_CASTER_SLOTS, PACT_MAGIC_TABLE } from '../data/spellSlots.js';
import { clampInt } from '../core/utils.js';

/** Modificatore di caratteristica: floor((punteggio - 10) / 2). */
export const abilityModifier = (score) => Math.floor((Number(score) - 10) / 2);

/** Bonus di competenza: +2 ai livelli 1-4, +3 ai livelli 5-8, ... fino a +6. */
export const proficiencyBonus = (level) => Math.floor((clampInt(level, 1, 20) - 1) / 4) + 2;

/**
 * Quanta Destrezza conta per la CA in base alla categoria dell'armatura.
 * @param {'none'|'light'|'medium'|'heavy'} category
 * @param {number} dexMod
 */
export function armorDexBonus(category, dexMod) {
  switch (category) {
    case 'heavy': return 0;
    case 'medium': return Math.min(dexMod, MEDIUM_ARMOR_MAX_DEX);
    default: return dexMod;
  }
}

/**
 * Calcola la Classe Armatura e la sua scomposizione (utile per la UI).
 *
 * @param {object} p
 * @param {{name: string, category: string, baseAC: number}} p.armor
 * @param {boolean} p.hasShield
 * @param {number} [p.magicBonus]
 * @param {Record<string, number>} p.mods
 * @param {{ability: string, allowsShield: boolean} | null} [p.unarmoredDefense]
 * @returns {{ total: number, parts: Array<{label: string, value: number}> }}
 */
export function computeArmorClass({ armor, hasShield, magicBonus = 0, mods, unarmoredDefense = null }) {
  const parts = [];

  if (armor.category === 'none') {
    parts.push({ label: 'Base', value: 10 }, { label: 'DES', value: mods.dex });
    // Difesa senza Armatura: il Monaco la perde se impugna uno scudo.
    if (unarmoredDefense && (!hasShield || unarmoredDefense.allowsShield)) {
      parts.push({ label: getAbility(unarmoredDefense.ability).short, value: mods[unarmoredDefense.ability] });
    }
  } else {
    parts.push({ label: armor.name, value: armor.baseAC });
    if (armor.category !== 'heavy') {
      parts.push({ label: 'DES', value: armorDexBonus(armor.category, mods.dex) });
    }
  }

  if (hasShield) parts.push({ label: 'Scudo', value: SHIELD_AC_BONUS });
  if (magicBonus) parts.push({ label: 'Magia', value: magicBonus });

  return { total: parts.reduce((sum, p) => sum + p.value, 0), parts };
}

/**
 * Bonus totale di un'abilità.
 * Maestria raddoppia la competenza; Factotum (Bardo) aggiunge metà
 * competenza alle abilità non competenti.
 */
export function skillBonus({ abilityMod, profBonus, proficient, expertise, jackOfAllTrades = 0 }) {
  if (proficient && expertise) return abilityMod + profBonus * 2;
  if (proficient) return abilityMod + profBonus;
  return abilityMod + jackOfAllTrades;
}

/** Tiro per Colpire di un'arma. */
export const attackBonus = ({ abilityMod, profBonus, proficient, magicBonus = 0 }) =>
  abilityMod + (proficient ? profBonus : 0) + magicBonus;

/** CD del Tiro Salvezza degli incantesimi: 8 + competenza + mod. caratteristica. */
export const spellSaveDC = (profBonus, abilityMod) => 8 + profBonus + abilityMod;

/** Bonus di attacco degli incantesimi: competenza + mod. caratteristica. */
export const spellAttackBonus = (profBonus, abilityMod) => profBonus + abilityMod;

/**
 * Slot incantesimo disponibili.
 * @param {'full'|'half'|'pact'|null} progression
 * @param {number} level
 * @returns {Array<{level: number, max: number}>}
 */
export function spellSlotsFor(progression, level) {
  const toSlots = (row) => (row ?? []).map((max, i) => ({ level: i + 1, max }));
  switch (progression) {
    case 'full':
      return toSlots(FULL_CASTER_SLOTS[level]);
    case 'half':
      return level < 2 ? [] : toSlots(FULL_CASTER_SLOTS[Math.ceil(level / 2)]);
    case 'pact': {
      let row = PACT_MAGIC_TABLE[0];
      for (const entry of PACT_MAGIC_TABLE) if (level >= entry[0]) row = entry;
      const [, count, slotLevel] = row;
      return [{ level: slotLevel, max: count }];
    }
    default:
      return [];
  }
}

/**
 * PF massimi suggeriti: massimo del dado al 1° livello, poi la media
 * arrotondata per eccesso (dado/2 + 1) a ogni livello, più il mod. COS.
 * Ogni livello concede almeno 1 PF.
 */
export function suggestedMaxHp(hitDie, level, conMod) {
  const first = Math.max(1, hitDie + conMod);
  const perLevel = Math.max(1, hitDie / 2 + 1 + conMod);
  return first + perLevel * (clampInt(level, 1, 20) - 1);
}
