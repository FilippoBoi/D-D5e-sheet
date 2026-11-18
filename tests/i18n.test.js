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
