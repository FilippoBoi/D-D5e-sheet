import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { CharacterModel } from '../js/model/CharacterModel.js';
import { setLang } from '../js/i18n/i18n.js';

afterEach(() => setLang('it'));

const slots = (model) => model.getDerived().classInfo.skillSlots;
const optionIds = (slot) => slot.options.map((o) => o.value);

test('abilità di classe: quelle già date dal background non vengono offerte', () => {
  const model = new CharacterModel({ info: { classId: 'fighter', backgroundId: 'soldier' } });
  for (const slot of slots(model)) {
    assert.ok(!optionIds(slot).includes('athletics') && !optionIds(slot).includes('intimidation'));
    assert.ok(optionIds(slot).includes('perception'));
    assert.equal(slot.duplicate, false);
  }
  const plain = new CharacterModel({ info: { classId: 'fighter' } });
  assert.ok(optionIds(slots(plain)[0]).includes('athletics'), 'senza background tutte le abilità di classe');
});

test('abilità di classe: valgono anche le competenze razziali e le abilità scelte della razza', () => {
  const elf = new CharacterModel({ info: { classId: 'fighter', raceId: 'elf' } });
  assert.ok(!optionIds(slots(elf)[0]).includes('perception'));
  const halfElf = new CharacterModel({ info: { classId: 'fighter', raceId: 'halfElf', raceChoices: { skill1: 'insight' } } });
  assert.ok(!optionIds(slots(halfElf)[0]).includes('insight'));
});

test('abilità di classe: un doppione già scelto resta, è segnalato e non porta competenza extra', () => {
  const model = new CharacterModel({ info: { classId: 'fighter' }, classSkills: { skill1: 'athletics', skill2: 'perception' } });
  assert.equal(slots(model)[0].duplicate, false);
  model.set('info.backgroundId', 'soldier');
  const [first, second] = slots(model);
  assert.equal(first.duplicate, true);
  assert.equal(first.value, 'athletics', 'non si cancella nulla');
  assert.ok(optionIds(first).includes('athletics'), 'la scelta attuale resta nel menu');
  assert.equal(second.duplicate, false);
  assert.equal(model.getDerived().skills.athletics, 2, 'competenza una volta sola');
  model.set('classSkills.skill1', 'insight');
  assert.equal(slots(model)[0].duplicate, false);
  assert.equal(model.getDerived().skills.insight, 2);
});

test('abilità di classe: la competenza spuntata a mano non esclude nulla', () => {
  const model = new CharacterModel({ info: { classId: 'fighter' }, skills: { athletics: { proficient: true } } });
  assert.ok(optionIds(slots(model)[0]).includes('athletics'));
});
