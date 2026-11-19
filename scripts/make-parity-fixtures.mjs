#!/usr/bin/env node
/**
 * Genera i casi di prova per il test di parità dell'app Flutter: personaggi costruiti con il Model JS
 * (operazioni casuali ma deterministiche) con stato e valori derivati nelle due lingue.
 * Il test Dart (flutter/test/parity_test.dart) ricalcola tutto e confronta.
 *
 * Uso: npm run flutter:parity
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { normalizeCharacter } from '../js/model/characterSchema.js';
import { CharacterModel } from '../js/model/CharacterModel.js';
import { CLASS_IDS } from '../js/data/classes.js';
import { RACE_IDS } from '../js/data/races.js';
import { BACKGROUND_IDS } from '../js/data/backgrounds.js';
import { ARMOR_IDS } from '../js/data/armors.js';
import { SKILLS } from '../js/data/skills.js';
import { SOURCE_IDS } from '../js/data/sources.js';
import { SPELL_LIST } from '../js/data/spells.js';
import { LANGUAGE_IDS } from '../js/data/languages.js';
import { getChoiceDefs, isListType } from '../js/data/classChoices/index.js';
import { setLang } from '../js/i18n/i18n.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'flutter/test/fixtures');
mkdirSync(OUT, { recursive: true });

const mulberry32 = (seed) => () => {
  let t = (seed += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const rnd = mulberry32(20261118);
const pickOne = (list) => list[Math.floor(rnd() * list.length)];
const int = (min, max) => min + Math.floor(rnd() * (max - min + 1));

const cases = [];
const PER_CLASS = 8;
for (const classId of CLASS_IDS) {
  for (let n = 0; n < PER_CLASS; n += 1) {
    const sources = n % 2 === 0 ? ['PHB'] : ['PHB', ...SOURCE_IDS.filter(() => rnd() < 0.6)];
    const model = new CharacterModel(null, sources);
    const level = [1, 3, 5, 9, 11, 14, 17, 20][n];
    model.set('info.classId', classId);
    model.set('info.level', level);
    model.set('info.raceId', n === 0 ? '' : pickOne(RACE_IDS));
    model.set('info.backgroundId', n < 2 ? '' : pickOne(BACKGROUND_IDS));
    for (const id of ['str', 'dex', 'con', 'int', 'wis', 'cha']) model.set(`abilities.${id}`, int(6, 20));
    model.set('equipment.armorId', pickOne(ARMOR_IDS));
    model.set('equipment.shield', rnd() < 0.4);
    model.set('equipment.magicBonus', int(-1, 3));
    if (rnd() < 0.5) { model.addAcItem(); model.set('equipment.acItems.0.name', 'Anello'); model.set('equipment.acItems.0.bonus', int(1, 3)); }
    if (rnd() < 0.7) { model.addWeapon(); model.set('weapons.0.ability', pickOne(['str', 'dex'])); model.set('weapons.0.magicBonus', int(0, 2)); model.set('weapons.0.damage', '1d8'); }
    for (const s of SKILLS) if (rnd() < 0.25) { model.set(`skills.${s.id}.proficient`, true); if (rnd() < 0.4) model.set(`skills.${s.id}.expertise`, true); }
    for (const key of ['skill1', 'skill2', 'skill3', 'skill4']) model.set(`classSkills.${key}`, pickOne(SKILLS).id);
    for (const key of ['ability1', 'ability2', 'skill1', 'skill2']) model.set(`info.raceChoices.${key}`, key.startsWith('ability') ? pickOne(['str', 'dex', 'con', 'int', 'wis', 'cha']) : pickOne(SKILLS).id);
    const raceDerived = model.getDerived().race;
    const option = raceDerived?.choices.find((c) => c.key === 'option');
    if (option) model.set('info.raceChoices.option', pickOne(option.options).value);
    for (let i = 1; i <= 4; i += 1) if (rnd() < 0.6) model.set(`languages.pick${i}`, pickOne(LANGUAGE_IDS));
    model.set('languages.other', 'Sottocomune; Gnomico');
    // Scelte di classe: prima le singole (sottoclasse), poi gli elenchi.
    for (let pass = 0; pass < 2; pass += 1) {
      for (const def of getChoiceDefs(classId)) {
        if (def.type === 'text') { model.set(`info.classChoices.${def.key}`, 'Nota'); continue; }
        if (isListType(def.type)) {
          if (pass === 0) continue;
          for (let k = 0; k < 6; k += 1) {
            const values = def.type === 'skills' ? (def.pool ?? SKILLS.map((s) => s.id)) : def.options.map((o) => o.value);
            model.toggleChoice(def.key, pickOne(values));
          }
        } else if (pass === 0 && def.options.length) {
          model.set(`info.classChoices.${def.key}`, pickOne(def.options).value);
        }
      }
    }
    // Incantesimi
    for (let k = 0; k < 6; k += 1) model.toggleSpell('cantrips', pickOne(SPELL_LIST.filter((s) => s.level === 0)).id);
    for (let k = 0; k < 10; k += 1) model.toggleSpell('spells', pickOne(SPELL_LIST.filter((s) => s.level > 0)).id);
    model.set('combat.hpMax', int(5, 200));
    model.set('combat.hpCurrent', int(0, 150));
    model.set('combat.hpTemp', int(0, 10));
    model.set('combat.hitDiceUsed', int(0, 4));
    if (n % 3 === 0) model.set('combat.concentration', 'Benedizione');
    model.set('spells.slotsUsed.1', int(0, 4));
    model.set('resourcesUsed.rage', 1);
    model.set('resourcesUsed.breathWeapon', 1);
    model.set('resourcesUsed.ki', int(0, 3));

    const raw = model.getSnapshot();
    // Note libere: alcune pulite, una sporca (titolo lungo, id doppio, spazzatura) per provare la normalizzazione.
    if (n % 2 === 1) {
      raw.notes.items = [
        { id: 'n-1', title: 'Sessione 1', text: 'Taverna\nPNG: Elminster' },
        { id: 'n-2', title: 'x'.repeat(120), text: 42 },
        { id: 'n-1', title: 'Doppia', text: '' },
        'spazzatura',
      ];
    }
    const state = normalizeCharacter(raw);
    const derived = {};
    for (const lang of ['it', 'en']) {
      setLang(lang);
      const m = new CharacterModel(state, sources);
      derived[lang] = m.getDerived();
    }
    setLang('it');
    cases.push({ name: `${classId}-${level}-${n}`, sources, raw, state, derived });
  }
}
writeFileSync(join(OUT, 'parity.json'), JSON.stringify(cases));
console.log(`${cases.length} casi`);
