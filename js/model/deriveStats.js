/**
 * Calcola tutti i valori derivati della scheda a partire dallo stato grezzo.
 *
 * Lo stato contiene solo ciò che il giocatore inserisce; tutto il resto
 * (modificatori, CA, CD, slot...) viene ricalcolato qui ad ogni modifica.
 * In questo modo non esistono valori "duplicati" che possono andare fuori sincrono.
 */
import { ABILITIES, getAbility } from '../data/abilities.js';
import {
  ARMOR_CATEGORIES, ARMOR_CATEGORIES_EN, MEDIUM_ARMOR_MAX_DEX, getArmor,
} from '../data/armors.js';
import { CLASS_STARTING, getClass } from '../data/classes.js';
import { feetToMeters, getRace } from '../data/races.js';
import { getClassFeatures } from '../data/classFeatures.js';
import { getClassResources } from '../data/classResources.js';
import { SKILLS } from '../data/skills.js';
import { clamp, formatModifier } from '../core/utils.js';
import { loc, pick } from '../i18n/i18n.js';
import { choiceFeatureRows, describeChoiceGroups, resolveClassChoices } from './classChoices.js';
import {
  abilityModifier, attackBonus, computeArmorClass, proficiencyBonus, skillBonus,
  spellAttackBonus, spellSaveDC, spellSlotsFor, suggestedMaxHp,
} from './calculations.js';

const mapAbilities = (fn) => Object.fromEntries(ABILITIES.map((a) => [a.id, fn(a.id)]));

/** Valori non vuoti e senza duplicati, nell'ordine di inserimento. */
const uniqueValid = (values) => [...new Set(values.filter((v) => v))];

/** Opzioni del menu a tendina per una scelta di caratteristica o abilità. */
const abilityOptions = (exclude = []) => ABILITIES
  .filter((a) => !exclude.includes(a.id))
  .map((a) => ({ value: a.id, label: loc(a) }));
const skillOptions = (ids = null) => SKILLS
  .filter((s) => !ids || ids.includes(s.id))
  .map((s) => ({ value: s.id, label: loc(s) }));

function armorFormula(armor, unarmoredDefense) {
  const dex = loc(getAbility('dex'), 'short');
  switch (armor.category) {
    case 'none': {
      const base = unarmoredDefense?.base ?? 10;
      return unarmoredDefense?.ability
        ? `${base} + ${dex} + ${loc(getAbility(unarmoredDefense.ability), 'short')}`
        : `${base} + ${dex}`;
    }
    case 'light': return `${armor.baseAC} + ${dex}`;
    case 'medium': return `${armor.baseAC} + ${dex} (max +${MEDIUM_ARMOR_MAX_DEX})`;
    default: return `${armor.baseAC} (${pick('fissa', 'fixed')})`;
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
  const race = getRace(state.info.raceId);
  const classStart = CLASS_STARTING[cls.id];

  // Scelte di razza: caratteristiche (+bonus a due diverse, esclusioni), abilità, opzione singola.
  const raceChoice = race?.abilityChoice ?? null;
  const chosenAbilities = raceChoice
    ? uniqueValid([state.info.raceChoices.ability1, state.info.raceChoices.ability2])
      .filter((id) => !raceChoice.exclude.includes(id))
    : [];
  const racialSkills = new Set([
    ...(race?.skills ?? []),
    ...(race?.skillChoice ? uniqueValid([state.info.raceChoices.skill1, state.info.raceChoices.skill2]) : []),
  ]);

  // Competenze di classe: solo tra quelle previste, nel numero consentito.
  const classSkillIds = uniqueValid(Object.values(state.classSkills))
    .filter((id) => classStart.skillChoice.from.includes(id))
    .slice(0, classStart.skillChoice.count);
  const classSkillSet = new Set(classSkillIds);
  const baseProficient = (id) => state.skills[id].proficient || racialSkills.has(id) || classSkillSet.has(id);

  // Scelte di classe: abilità concesse, Maestria ed effetti calcolabili (CA, PF).
  const resolved = resolveClassChoices({
    classId: cls.id, level, choices: state.info.classChoices, isProficient: baseProficient,
  });
  const skillProficient = (id) => baseProficient(id) || resolved.grantedSkills.has(id);

  // Punteggio finale = valore inserito + bonus razziali (fissi e scelti).
  const racialBonus = (id) => (race?.abilityBonuses[id] ?? 0)
    + (chosenAbilities.includes(id) ? raceChoice.bonus : 0);
  const scores = mapAbilities((id) => state.abilities[id] + racialBonus(id));
  const mods = mapAbilities((id) => abilityModifier(scores[id]));

  // Factotum del Bardo (dal 2° livello): metà competenza alle prove non competenti.
  const jackOfAllTrades = cls.id === 'bard' && level >= 2 ? Math.floor(profBonus / 2) : 0;

  const saves = mapAbilities((id) => mods[id] + (state.saveProficiencies[id] ? profBonus : 0));
  const skills = Object.fromEntries(SKILLS.map((s) => [s.id, skillBonus({
    abilityMod: mods[s.ability],
    profBonus,
    proficient: skillProficient(s.id),
    expertise: state.skills[s.id].expertise || resolved.expertiseSkills.has(s.id),
    jackOfAllTrades,
  })]));

  // --- Armatura e CA ---
  const armor = getArmor(state.equipment.armorId);
  const unarmoredDefense = cls.unarmoredDefense ?? resolved.effects.unarmoredDefense;
  const ac = computeArmorClass({
    armor,
    hasShield: state.equipment.shield,
    magicBonus: state.equipment.magicBonus,
    mods,
    unarmoredDefense,
    armorBonuses: resolved.effects.acWithArmor,
    extraItems: state.equipment.acItems.map((item) => ({ label: item.name || pick('Oggetto', 'Item'), value: item.bonus })),
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

  const features = getClassFeatures(cls.id, level, choiceFeatureRows(resolved, level));
  const resources = getClassResources(cls.id, level, mods);

  const skillName = (id) => (SKILLS.find((s) => s.id === id) ? loc(SKILLS.find((s) => s.id === id)) : id);

  // Menu a tendina per le scelte di razza (vuoto se la razza non ne ha)
  const raceChoices = [];
  if (raceChoice) {
    raceChoices.push(
      { key: 'ability1', label: pick('Aumento caratteristica 1', 'Ability increase 1'), options: abilityOptions(raceChoice.exclude), value: state.info.raceChoices.ability1 },
      { key: 'ability2', label: pick('Aumento caratteristica 2', 'Ability increase 2'), options: abilityOptions(raceChoice.exclude), value: state.info.raceChoices.ability2 },
    );
  }
  if (race?.skillChoice) {
    raceChoices.push(
      { key: 'skill1', label: pick('Abilità 1', 'Skill 1'), options: skillOptions(), value: state.info.raceChoices.skill1 },
      { key: 'skill2', label: pick('Abilità 2', 'Skill 2'), options: skillOptions(), value: state.info.raceChoices.skill2 },
    );
  }
  if (race?.option) {
    raceChoices.push({ key: 'option', label: loc(race.option, 'label'), options: race.option.options.map((o) => ({ value: o.value, label: loc(o, 'label') })), value: state.info.raceChoices.option });
  }

  // Menu a tendina per le competenze di classe (una per scelta consentita)
  const classSkillSlots = Array.from({ length: classStart.skillChoice.count }, (_, i) => ({
    key: `skill${i + 1}`,
    value: classSkillIds[i] ?? '',
    options: skillOptions(classStart.skillChoice.from),
  }));

  const classChoiceGroups = describeChoiceGroups(resolved, level, baseProficient);

  return {
    race: race ? {
      name: loc(race),
      languages: loc(race, 'languages'),
      traits: loc(race, 'traits'),
      bonuses: [
        ...Object.entries(race.abilityBonuses).map(([id, v]) => `${loc(getAbility(id), 'short')} +${v}`),
        ...(raceChoice ? [pick(`${raceChoice.count} caratteristiche a scelta +${raceChoice.bonus}`, `${raceChoice.count} abilities of your choice +${raceChoice.bonus}`)] : []),
      ].join(', '),
      darkvision: race.darkvisionFt ? `${feetToMeters(race.darkvisionFt)} m` : pick('Nessuna', 'None'),
      choices: raceChoices,
    } : null,
    classInfo: {
      armor: loc(classStart, 'armor') || pick('Nessuna', 'None'),
      weapons: loc(classStart, 'weapons'),
      tools: loc(classStart, 'tools') || pick('Nessuno', 'None'),
      skillChoice: `${pick('Scegli', 'Choose')} ${classStart.skillChoice.count}: ${classStart.skillChoice.from.map(skillName).join(', ')}`,
      skillSlots: classSkillSlots,
    },
    classChoices: classChoiceGroups,
    hasClassChoices: classChoiceGroups.length > 0,
    expertiseFromChoices: [...resolved.expertiseSkills],
    hasAcItems: state.equipment.acItems.length > 0,
    className: loc(cls),
    featuresTitle: pick(`Privilegi di ${loc(cls)}`, `${loc(cls)} features`),
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
      category: pick(ARMOR_CATEGORIES, ARMOR_CATEGORIES_EN)[armor.category],
      formula: armorFormula(armor, armor.category === 'none' ? unarmoredDefense : null),
      strReq: armor.strReq,
      strengthWarning: armor.strReq > 0 && scores.str < armor.strReq,
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
      abilityName: casting ? loc(getAbility(casting.ability)) : '',
      dc: spellSaveDC(profBonus, castMod),
      attack: spellAttackBonus(profBonus, castMod),
      isPact: casting?.progression === 'pact',
      slots,
    },

    features,
    resources,
    hasResources: resources.length > 0,

    hp: {
      suggested: suggestedMaxHp(cls.hitDie, level, mods.con, resolved.effects.hpPerLevel),
      percent: hpPercent,
      level: hpLevel(hpPercent),
      isDown: hpCurrent <= 0,
      summary: `${hpCurrent}/${hpMax}${state.combat.hpTemp ? ` +${state.combat.hpTemp}` : ''}`,
    },
  };
}
