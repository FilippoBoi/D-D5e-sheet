/**
 * Calcola tutti i valori derivati della scheda a partire dallo stato grezzo.
 *
 * Lo stato contiene solo ciò che il giocatore inserisce; tutto il resto
 * (modificatori, CA, CD, slot...) viene ricalcolato qui ad ogni modifica.
 * In questo modo non esistono valori "duplicati" che possono andare fuori sincrono.
 */
import { ABILITIES, getAbility } from '../data/abilities.js';
import { ARMOR_CATEGORIES, MEDIUM_ARMOR_MAX_DEX, getArmor } from '../data/armors.js';
import { getClass } from '../data/classes.js';
import { getClassFeatures } from '../data/classFeatures.js';
import { getClassResources } from '../data/classResources.js';
import { SKILLS } from '../data/skills.js';
import { clamp, formatModifier } from '../core/utils.js';
import {
  abilityModifier, attackBonus, computeArmorClass, proficiencyBonus, skillBonus,
  spellAttackBonus, spellSaveDC, spellSlotsFor, suggestedMaxHp,
} from './calculations.js';

const mapAbilities = (fn) => Object.fromEntries(ABILITIES.map((a) => [a.id, fn(a.id)]));

function armorFormula(armor, unarmoredDefense) {
  switch (armor.category) {
    case 'none':
      return unarmoredDefense
        ? `10 + DES + ${getAbility(unarmoredDefense.ability).short}`
        : '10 + DES';
    case 'light': return `${armor.baseAC} + DES`;
    case 'medium': return `${armor.baseAC} + DES (max +${MEDIUM_ARMOR_MAX_DEX})`;
    default: return `${armor.baseAC} (fissa)`;
  }
}

function hpLevel(percent) {
  if (percent > 50) return 'high';
  if (percent > 20) return 'mid';
  return 'low';
}

/** @param {ReturnType<import('./characterSchema.js').createDefaultCharacter>} state */
export function deriveStats(state) {
  const cls = getClass(state.info.classId);
  const { level } = state.info;
  const profBonus = proficiencyBonus(level);
  const mods = mapAbilities((id) => abilityModifier(state.abilities[id]));

  // Factotum del Bardo (dal 2° livello): metà competenza alle prove non competenti.
  const jackOfAllTrades = cls.id === 'bard' && level >= 2 ? Math.floor(profBonus / 2) : 0;

  const saves = mapAbilities((id) => mods[id] + (state.saveProficiencies[id] ? profBonus : 0));
  const skills = Object.fromEntries(SKILLS.map((s) => [s.id, skillBonus({
    abilityMod: mods[s.ability],
    profBonus,
    proficient: state.skills[s.id].proficient,
    expertise: state.skills[s.id].expertise,
    jackOfAllTrades,
  })]));

  // --- Armatura e CA ---
  const armor = getArmor(state.equipment.armorId);
  const unarmoredDefense = cls.unarmoredDefense ?? null;
  const ac = computeArmorClass({
    armor,
    hasShield: state.equipment.shield,
    magicBonus: state.equipment.magicBonus,
    mods,
    unarmoredDefense,
  });

  // --- Incantesimi ---
  const casting = cls.spellcasting;
  const isCaster = Boolean(casting) && level >= casting.minLevel;
  const castMod = casting ? mods[casting.ability] : 0;
  const slots = isCaster
    ? spellSlotsFor(casting.progression, level).map((slot) => {
      const used = Math.min(state.spells.slotsUsed[slot.level] ?? 0, slot.max);
      return { ...slot, used, remaining: `${slot.max - used}/${slot.max}` };
    })
    : [];

  // --- Punti ferita ---
  const { hpMax, hpCurrent } = state.combat;
  const hpPercent = clamp(Math.round((hpCurrent / hpMax) * 100), 0, 100);

  const features = getClassFeatures(cls.id, level);
  const resources = getClassResources(cls.id, level, mods);

  return {
    className: cls.name,
    hitDie: `d${cls.hitDie}`,
    profBonus,
    mods,
    saves,
    skills,
    passivePerception: 10 + skills.perception,
    initiative: mods.dex + jackOfAllTrades,

    ac: ac.total,
    acBreakdown: ac.parts
      .map((p, i) => (i === 0 ? `${p.label} ${p.value}` : `${p.label} ${formatModifier(p.value)}`))
      .join(' · '),

    armor: {
      category: ARMOR_CATEGORIES[armor.category],
      formula: armorFormula(armor, armor.category === 'none' ? unarmoredDefense : null),
      strReq: armor.strReq,
      strengthWarning: armor.strReq > 0 && state.abilities.str < armor.strReq,
      stealthDisadvantage: armor.stealthDisadvantage,
    },

    weapons: state.weapons.map((w) => {
      const abilityMod = mods[w.ability];
      const damageBonus = abilityMod + w.magicBonus;
      return {
        attack: attackBonus({ abilityMod, profBonus, proficient: w.proficient, magicBonus: w.magicBonus }),
        damageLabel: `${w.damage || '—'} ${formatModifier(damageBonus)}`.trim(),
      };
    }),
    hasWeapons: state.weapons.length > 0,

    spellcasting: {
      isCaster,
      abilityName: casting ? getAbility(casting.ability).name : '',
      dc: spellSaveDC(profBonus, castMod),
      attack: spellAttackBonus(profBonus, castMod),
      isPact: casting?.progression === 'pact',
      slots,
    },

    features,
    resources,
    hasResources: resources.length > 0,

    hp: {
      suggested: suggestedMaxHp(cls.hitDie, level, mods.con),
      percent: hpPercent,
      level: hpLevel(hpPercent),
      isDown: hpCurrent <= 0,
      summary: `${hpCurrent}/${hpMax}${state.combat.hpTemp ? ` +${state.combat.hpTemp}` : ''}`,
    },
  };
}
