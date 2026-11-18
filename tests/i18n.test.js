import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { detectLang, getLang, isSupportedLang, loc, pick, setLang } from '../js/i18n/i18n.js';
import { CLASS_FEATURES, CLASS_FEATURES_EN, getClassFeatures } from '../js/data/classFeatures.js';
import { getClassResources } from '../js/data/classResources.js';
import { ABILITIES, ALIGNMENTS, ALIGNMENTS_EN } from '../js/data/abilities.js';
import { SKILLS } from '../js/data/skills.js';
import { ARMORS } from '../js/data/armors.js';
import { CLASS_LIST, CLASS_STARTING } from '../js/data/classes.js';
import { RACE_LIST } from '../js/data/races.js';
import { CharacterModel } from '../js/model/CharacterModel.js';
import { CLASS_CHOICES } from '../js/data/classChoices/index.js';

afterEach(() => setLang('it'));

test('lingua: valori validi, rilevamento dal browser e ricaduta sull\'italiano', () => {
  assert.equal(getLang(), 'it');
  assert.equal(setLang('xx'), false);
  assert.equal(isSupportedLang('en'), true);
  assert.equal(detectLang(['fr-FR', 'en-US']), 'en');
  assert.equal(detectLang(['it-IT']), 'it');
  assert.equal(detectLang(['fr-FR']), 'it');
  assert.equal(detectLang(), 'it');
});

test('pick e loc seguono la lingua corrente', () => {
  assert.equal(pick('Danno', 'Damage'), 'Danno');
  assert.equal(loc({ name: 'Forza', nameEn: 'Strength' }), 'Forza');
  setLang('en');
  assert.equal(pick('Danno', 'Damage'), 'Damage');
  assert.equal(loc({ name: 'Forza', nameEn: 'Strength' }), 'Strength');
  assert.equal(loc({ name: 'Solo italiano' }), 'Solo italiano');
});

test('ogni dato di gioco ha la traduzione inglese', () => {
  for (const a of ABILITIES) assert.ok(a.nameEn && a.shortEn, a.id);
  for (const s of SKILLS) assert.ok(s.nameEn, s.id);
  for (const a of ARMORS) assert.ok(a.nameEn, a.id);
  for (const c of CLASS_LIST) {
    assert.ok(c.nameEn, c.id);
    const start = CLASS_STARTING[c.id];
    for (const field of ['armor', 'weapons', 'tools']) {
      if (start[field]) assert.ok(start[`${field}En`], `${c.id}.${field}`);
    }
  }
  for (const r of RACE_LIST) {
    assert.ok(r.nameEn && r.languagesEn && r.traitsEn, r.id);
    if (r.option) {
      assert.ok(r.option.labelEn, r.id);
      for (const o of r.option.options) assert.ok(o.labelEn, `${r.id}.${o.value}`);
    }
  }
  for (const a of ALIGNMENTS) assert.ok(ALIGNMENTS_EN[a], a);
});

test('i privilegi inglesi hanno la stessa struttura di quelli italiani', () => {
  assert.deepEqual(Object.keys(CLASS_FEATURES_EN), Object.keys(CLASS_FEATURES));
  for (const [classId, list] of Object.entries(CLASS_FEATURES)) {
    const en = CLASS_FEATURES_EN[classId];
    assert.equal(en.length, list.length, classId);
    list.forEach((feature, i) => {
      assert.equal(en[i].level, feature.level, `${classId}[${i}]`);
      assert.ok(en[i].name && en[i].description, `${classId}[${i}]`);
    });
  }
});

test('getClassFeatures e risorse cambiano lingua', () => {
  assert.equal(getClassFeatures('fighter', 1)[0].name, 'Stile di Combattimento');
  assert.equal(getClassResources('fighter', 2, {})[1].label, 'Azione Impetuosa');
  setLang('en');
  assert.equal(getClassFeatures('fighter', 1)[0].name, 'Fighting Style');
  assert.equal(getClassResources('fighter', 2, {})[1].label, 'Action Surge');
});

test('i valori derivati sono tradotti, lo stato salvato no', () => {
  const model = new CharacterModel({ info: { classId: 'wizard', raceId: 'elf', alignment: 'Legale Buono' } });
  const italian = model.getDerived();
  assert.equal(italian.className, 'Mago');
  assert.equal(italian.race.name, 'Elfo');

  setLang('en');
  const english = model.getDerived();
  assert.equal(english.className, 'Wizard');
  assert.equal(english.race.name, 'Elf');
  assert.equal(english.featuresTitle, 'Wizard features');
  assert.equal(english.classInfo.armor, 'None');
  assert.equal(model.get('info.alignment'), 'Legale Buono'); // valore salvato invariato
  assert.equal(english.ac, italian.ac); // i numeri non dipendono dalla lingua
});

const ITALIAN_WORDS = /\b(del|della|dello|dei|delle|di|il|lo|la|le|sempre|che|con|una?|ai|alla)\b/;

test('scelte di classe: ogni classe, scelta e opzione ha etichetta, descrizione e privilegi in inglese', () => {
  for (const [classId, defs] of Object.entries(CLASS_CHOICES)) {
    for (const def of defs) {
      const at = `${classId}.${def.key}`;
      assert.ok(def.label && def.labelEn, `${at}: etichetta`);
      if (def.hint) assert.ok(def.hintEn, `${at}: hint`);
      for (const e of def.extra ?? []) assert.ok(e.label && e.labelEn, `${at}.${e.value}`);
      for (const o of def.options) {
        assert.ok(o.label && o.labelEn, `${at}.${o.value}: etichetta`);
        if (o.description) assert.ok(o.descriptionEn, `${at}.${o.value}: descrizione`);
        for (const f of o.features) {
          assert.ok(f.name && f.nameEn && f.description && f.descriptionEn, `${at}.${o.value}@${f.level}: privilegio`);
          // Tuple [livello, nome, descrizione, nameEn, descriptionEn]: un campo italiano finito in uno inglese si nota dalle parole.
          assert.doesNotMatch(`${f.nameEn} ${f.descriptionEn}`, ITALIAN_WORDS, `${at}.${o.value}@${f.level}: testo italiano nei campi inglesi`);
          assert.notEqual(f.description, f.nameEn, `${at}.${o.value}@${f.level}: campi scambiati`);
        }
      }
    }
  }
});

test('scelte di classe: gruppi e privilegi cambiano lingua, i valori salvati no', () => {
  const model = new CharacterModel({ info: { classId: 'cleric', level: 8 } });
  model.set('info.classChoices.subclass', 'light');
  const it = model.getDerived();
  assert.equal(it.classChoices[0].label, 'Dominio Divino');
  assert.equal(it.classChoices[0].options[0].label, 'Conoscenza');
  assert.ok(it.features.some((f) => f.name === 'Lampo Difensivo'));

  setLang('en');
  const en = model.getDerived();
  assert.equal(en.classChoices[0].label, 'Divine Domain');
  assert.equal(en.classChoices[0].options[0].label, 'Knowledge');
  assert.ok(en.features.some((f) => f.name === 'Warding Flare'));
  assert.equal(en.features.find((f) => f.name === 'Warding Flare').tag, 'Divine Domain: Light');
  assert.equal(model.get('info.classChoices.subclass'), 'light');
});
