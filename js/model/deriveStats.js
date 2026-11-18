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
import { getBackground } from '../data/backgrounds.js';
import { getClassFeatures } from '../data/classFeatures.js';
import { getClassResources } from '../data/classResources.js';
import { resolveRaceTraits } from '../data/raceTraits.js';
import { CLASS_LANGUAGES, LANGUAGES, MAX_LANGUAGE_PICKS, parseLanguageText } from '../data/languages.js';
import { SKILLS } from '../data/skills.js';
import { clamp, formatModifier } from '../core/utils.js';
import { loc, pick } from '../i18n/i18n.js';
import { choiceFeatureRows, describeChoiceGroups, resolveClassChoices } from './classChoices.js';
import {
  abilityModifier, attackBonus, averageHpGain, computeArmorClass, proficiencyBonus, skillBonus,
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
export function deriveStats(state, { sources = null } = {}) {
  const cls = getClass(state.info.classId);
  const { level } = state.info;
  const profBonus = proficiencyBonus(level);
  const race = getRace(state.info.raceId);
  const background = getBackground(state.info.backgroundId);
  const classStart = CLASS_STARTING[cls.id];

  // Scelte di razza: caratteristiche (+bonus a due diverse, esclusioni), abilità, opzione singola.
  const raceChoice = race?.abilityChoice ?? null;
  const chosenAbilities = raceChoice
    ? uniqueValid([state.info.raceChoices.ability1, state.info.raceChoices.ability2])
      .filter((id) => !raceChoice.exclude.includes(id))
    : [];
  const racialSkills = new Set([
    ...(race?.skills ?? []),
    ...(background?.skills ?? []),
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
  const casting = cls.spellcasting ?? resolved.effects.spellcasting;
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
  const resources = getClassResources(cls.id, level, mods, { subclass: resolved.subclass?.option.value ?? '', profBonus });

  // Tratti razziali: descrizioni, resistenze, competenze, PF extra e usi limitati.
  const raceOption = race?.option ? state.info.raceChoices.option : '';
  const raceTraits = resolveRaceTraits(race?.id ?? '', {
    level, profBonus, mods, option: raceOption,
    optionLabel: race?.option?.options.find((o) => o.value === raceOption) ? loc(race.option.options.find((o) => o.value === raceOption), 'label') : '',
  });
  const hpPerLevel = (resolved.effects.hpPerLevel ?? 0) + raceTraits.hpPerLevel;

  // Lingue: fisse (razza, background, classe), a scelta (menu) e libere.
  const langName = (id) => loc(LANGUAGES.find((l) => l.id === id));
  const raceLang = parseLanguageText(race?.languages);
  const bgLang = parseLanguageText(background?.languages);
  const fixedIds = uniqueValid([...raceLang.ids, ...bgLang.ids, ...(CLASS_LANGUAGES[cls.id] ? [CLASS_LANGUAGES[cls.id]] : [])]);
  const fixedCustom = uniqueValid([...raceLang.custom, ...bgLang.custom]);
  const slotCount = Math.min(MAX_LANGUAGE_PICKS, raceLang.choices + bgLang.choices);
  const pickedIds = [];
  const languageSlots = Array.from({ length: slotCount }, (_, i) => {
    const key = `pick${i + 1}`;
    const raw = state.languages[key];
    const duplicate = Boolean(raw) && (fixedIds.includes(raw) || pickedIds.includes(raw));
    if (raw && !duplicate) pickedIds.push(raw);
    const taken = new Set([...fixedIds, ...Object.values(state.languages).filter((v, j) => j < slotCount && v && `pick${j + 1}` !== key)]);
    return {
      key, value: raw, duplicate,
      options: LANGUAGES.filter((l) => !l.special && (!taken.has(l.id) || l.id === raw)).map((l) => ({ value: l.id, label: loc(l) })),
    };
  });
  const otherLanguages = state.languages.other.split(/[,;]/).map((x) => x.trim()).filter(Boolean);
  const knownLanguages = uniqueValid([...fixedIds.map(langName), ...fixedCustom, ...pickedIds.map(langName), ...otherLanguages]);

  const usables = [
    ...resources.filter((r) => r.use).map((r) => ({ id: r.use.id, label: r.label, detail: r.value, max: r.use.max, recharge: r.use.recharge })),
    ...raceTraits.uses.map((u) => ({ id: u.id, label: u.label, detail: u.detail ?? '', max: u.max, recharge: u.recharge })),
  ].map((u) => {
    const used = Math.min(state.resourcesUsed[u.id] ?? 0, u.max);
    return { ...u, used, remaining: `${u.max - used}/${u.max}`, path: `resourcesUsed.${u.id}` };
  });

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
  // Le abilità già concesse da razza o background non vanno ripetute: non si offrono (resta quella già scelta,
  // segnalata come doppione) e il regolamento chiede di sceglierne un'altra.
  const classSkillSlots = Array.from({ length: classStart.skillChoice.count }, (_, i) => {
    const value = classSkillIds[i] ?? '';
    return {
      key: `skill${i + 1}`,
      value,
      duplicate: Boolean(value) && racialSkills.has(value),
      options: skillOptions(classStart.skillChoice.from.filter((id) => !racialSkills.has(id) || id === value)),
    };
  });

  const classChoiceGroups = describeChoiceGroups(resolved, level, baseProficient, cls.id, sources);

  return {
    sources: [...(sources ?? [])],
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
      resistances: raceTraits.resistances.join(', '),
      proficiencies: [
        ...(raceTraits.proficiencies.armor.length ? [`${pick('Armature', 'Armor')}: ${raceTraits.proficiencies.armor.join(', ')}`] : []),
        ...(raceTraits.proficiencies.weapons.length ? [`${pick('Armi', 'Weapons')}: ${raceTraits.proficiencies.weapons.join(', ')}`] : []),
        ...(raceTraits.proficiencies.tools.length ? [`${pick('Strumenti', 'Tools')}: ${raceTraits.proficiencies.tools.join(', ')}`] : []),
      ].join(' · '),
    } : null,
    raceTraits: raceTraits.traits,
    hasRaceTraits: raceTraits.traits.length > 0,
    languageInfo: {
      known: knownLanguages.join(', ') || pick('Nessuna', 'None'),
      slots: languageSlots,
      hasSlots: languageSlots.length > 0,
    },
    background: {
      isCustom: !background,
      name: background ? loc(background) : '',
      skills: background ? background.skills.map(skillName).join(', ') : '',
      tools: background ? (loc(background, 'tools') || pick('Nessuno', 'None')) : '',
      languages: background ? (loc(background, 'languages') || pick('Nessuna', 'None')) : '',
      equipment: background ? loc(background, 'equipment') : '',
      feature: background ? loc(background, 'feature') : '',
    },
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
    // Riepilogo in alto: il TpC più alto tra le armi in tabella (assente se non ce ne sono).
    topAttack: state.weapons.length
      ? Math.max(...state.weapons.map((w) => attackBonus({
        abilityMod: mods[w.ability], profBonus, proficient: w.proficient, magicBonus: w.magicBonus,
      })))
      : null,

    spellcasting: {
      isCaster,
      abilityName: casting ? loc(getAbility(casting.ability)) : '',
      dc: spellSaveDC(profBonus, castMod),
      attack: spellAttackBonus(profBonus, castMod),
      isPact: casting?.progression === 'pact',
      slots,
    },

    features,
    // Risorse a usi limitati (con spunte) e risorse solo informative (valori che scalano col livello).
    usables,
    infoResources: resources.filter((r) => !r.use),
    resources,
    hasResources: resources.length > 0,
    hasUsables: usables.length > 0,

    hp: {
      hitDieSides: cls.hitDie,
      conMod: mods.con,
      perLevelBonus: hpPerLevel,
      averageGain: averageHpGain(cls.hitDie, mods.con, hpPerLevel),
      suggested: suggestedMaxHp(cls.hitDie, level, mods.con, hpPerLevel),
      percent: hpPercent,
      level: hpLevel(hpPercent),
      isDown: hpCurrent <= 0,
      summary: `${hpCurrent}/${hpMax}${state.combat.hpTemp ? ` +${state.combat.hpTemp}` : ''}`,
    },
  };
}
