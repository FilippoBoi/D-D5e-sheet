#!/usr/bin/env node
/**
 * Esporta i cataloghi dell'app web in JSON per l'app Flutter (flutter/assets/data/).
 * La fonte di verità dei dati resta js/data: l'app Flutter li legge, non li duplica a mano.
 *
 * Uso: npm run flutter:data
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ABILITIES, ALIGNMENTS, ALIGNMENTS_EN } from '../js/data/abilities.js';
import { ARMORS, ARMOR_CATEGORIES, ARMOR_CATEGORIES_EN, MEDIUM_ARMOR_MAX_DEX, SHIELD_AC_BONUS } from '../js/data/armors.js';
import { BACKGROUND_LIST } from '../js/data/backgrounds.js';
import { CLASSES, CLASS_STARTING } from '../js/data/classes.js';
import { RAW_FEATURES } from '../js/data/classFeatures.js';
import { RAW_FEATURES_EN } from '../js/data/classFeatures.en.js';
import { CLASS_CHOICES } from '../js/data/classChoices/index.js';
import { CLASS_LANGUAGES, LANGUAGES } from '../js/data/languages.js';
import { RACE_RESOURCE_IDS, RACE_TRAITS, TRAITS } from '../js/data/raceTraits.js';
import { RESOURCE_IDS } from '../js/data/classResources.js';
import { RACE_LIST } from '../js/data/races.js';
import { SKILLS } from '../js/data/skills.js';
import { GROUP_LABELS, SOURCES } from '../js/data/sources.js';
import { FULL_CASTER_SLOTS, PACT_MAGIC_TABLE, THIRD_CASTER_SLOTS } from '../js/data/spellSlots.js';
import { SPELL_PROGRESSION } from '../js/data/spellProgression.js';
import { SPELL_LIST } from '../js/data/spells.js';
import { SKILL_TEXT } from '../js/data/generated/skillDescriptions.js';
import { SPELL_TEXT } from '../js/data/generated/spellDescriptions.js';
import { UI_EN } from '../js/i18n/en.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'flutter/assets/data');
mkdirSync(OUT, { recursive: true });

const write = (name, value) => {
  const text = JSON.stringify(value);
  writeFileSync(join(OUT, name), `${text}\n`);
  console.log(`${name}: ${(text.length / 1024).toFixed(0)} KB`);
};

/** Le tabelle di progressione sono funzioni: si valutano per i livelli 1-20. */
const progression = Object.fromEntries(Object.entries(SPELL_PROGRESSION).map(([key, row]) => [key, {
  cantrips: Array.from({ length: 21 }, (_, level) => (level === 0 ? 0 : row.cantrips(level))),
  known: row.known ?? null,
  prepared: row.prepared ?? null,
}]));

// Privilegi di classe: righe [livello, nome, descrizione, generic?] nelle due lingue.
const features = (raw) => Object.fromEntries(Object.entries(raw).map(([id, rows]) => [id,
  rows.map(([level, name, description, tag]) => ({ level, name, description, ...(tag === 'sub' && { generic: true }) }))]));

// Tratti razziali: i campi che sono funzioni (usi, resistenze o competenze dipendenti dalla scelta)
// non si esportano; restano elencati in `dyn` e li calcola il codice Dart.
const traits = Object.fromEntries(Object.entries(TRAITS).map(([key, t]) => {
  const dyn = ['uses', 'resist', 'prof'].filter((f) => typeof t[f] === 'function');
  const prof = t.prof && typeof t.prof === 'object'
    ? Object.fromEntries(Object.entries(t.prof).filter(([, v]) => typeof v !== 'function')) : undefined;
  const dynProf = t.prof && typeof t.prof === 'object' ? Object.entries(t.prof).filter(([, v]) => typeof v === 'function').map(([k]) => k) : [];
  return [key, { it: t.it, en: t.en, di: t.di, de: t.de, ...(t.hp && { hp: t.hp }), ...(Array.isArray(t.resist) && { resist: t.resist }),
    ...(prof && Object.keys(prof).length && { prof }), ...(dynProf.length && { dynProf }), ...(dyn.length && { dyn }) }];
}));
// resist statico: sono funzioni `() => ['poison']`; si valutano senza contesto.
for (const [key, t] of Object.entries(TRAITS)) {
  if (typeof t.resist === 'function') {
    try { const value = t.resist({}); if (Array.isArray(value) && value.length && key !== 'damageResistance') traits[key].resist = value; } catch { /* dipende dal contesto */ }
  }
}

write('catalog.json', {
  raceTraits: { traits, byRace: RACE_TRAITS, resourceIds: RACE_RESOURCE_IDS },
  resourceIds: RESOURCE_IDS,
  abilities: ABILITIES,
  alignments: ALIGNMENTS.map((name) => ({ name, nameEn: ALIGNMENTS_EN[name] })),
  skills: SKILLS,
  classes: Object.values(CLASSES),
  classStarting: CLASS_STARTING,
  armors: { list: ARMORS, categories: ARMOR_CATEGORIES, categoriesEn: ARMOR_CATEGORIES_EN, mediumMaxDex: MEDIUM_ARMOR_MAX_DEX, shieldBonus: SHIELD_AC_BONUS },
  languages: { list: LANGUAGES, classLanguages: CLASS_LANGUAGES },
  sources: { list: SOURCES, groupLabels: GROUP_LABELS },
  slots: { full: FULL_CASTER_SLOTS, pact: PACT_MAGIC_TABLE, third: THIRD_CASTER_SLOTS },
  spellProgression: progression,
  races: RACE_LIST,
  backgrounds: BACKGROUND_LIST,
});
write('class_features.json', { it: features(RAW_FEATURES), en: features(RAW_FEATURES_EN) });
write('class_choices.json', CLASS_CHOICES);
write('spells.json', SPELL_LIST);
write('ui_en.json', UI_EN);
write('skill_text.json', SKILL_TEXT);
write('spell_text.json', SPELL_TEXT);
