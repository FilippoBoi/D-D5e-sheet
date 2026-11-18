import { test } from 'node:test';
import assert from 'node:assert/strict';

import { CharacterModel } from '../js/model/CharacterModel.js';
import { SOURCE_IDS, normalizeSources } from '../js/data/sources.js';
import { RACE_LIST, getRace } from '../js/data/races.js';
import { BACKGROUND_LIST } from '../js/data/backgrounds.js';
import { CLASS_CHOICES } from '../js/data/classChoices/index.js';
import { SKILLS } from '../js/data/skills.js';

test('manuali: il PHB è sempre attivo, le sigle sconosciute sono scartate', () => {
  assert.deepEqual([...normalizeSources(null)], ['PHB']);
  assert.deepEqual([...normalizeSources(['XGE', 'ZZZ', 42])].sort(), ['PHB', 'XGE']);
});

test('manuali: ogni razza e background generato ha un manuale noto e dati validi', () => {
  const skillIds = SKILLS.map((s) => s.id);
  for (const r of RACE_LIST) {
    assert.ok(SOURCE_IDS.includes(r.source), r.id);
    assert.ok(r.speedFt > 0 && r.name && r.nameEn, r.id);
    if (r.abilityChoice) assert.ok(r.abilityChoice.count >= 1 && Array.isArray(r.abilityChoice.exclude), r.id);
    assert.ok(r.skills.every((s) => skillIds.includes(s)), r.id);
  }
  for (const b of BACKGROUND_LIST) {
    assert.ok(SOURCE_IDS.includes(b.source), b.id);
    assert.ok(b.skills.every((s) => skillIds.includes(s)), b.id);
  }
  assert.equal(new Set(RACE_LIST.map((r) => r.id)).size, RACE_LIST.length);
  assert.ok(RACE_LIST.some((r) => r.source !== 'PHB') && BACKGROUND_LIST.some((b) => b.source !== 'PHB'));
});

test('manuali: una razza di un altro manuale si sceglie e dà i suoi bonus', () => {
  const hill = getRace('phb-dwarf-hill');
  assert.equal(hill.source, 'PHB');
  const model = new CharacterModel();
  model.set('abilities.wis', 10);
  model.set('info.raceId', 'phb-dwarf-hill');
  assert.equal(model.get('info.raceId'), 'phb-dwarf-hill');
  assert.equal(model.getDerived().race.name, 'Nano delle Colline');
  assert.equal(model.getDerived().mods.con, 1); // 10 + 2
});

test('manuali: le sottoclassi degli altri manuali compaiono solo se il manuale è attivo, tranne quella scelta', () => {
  const subclassOptions = (m) => m.getDerived().classChoices.find((g) => g.key === 'subclass').options.map((o) => o.value);
  const model = new CharacterModel({ info: { classId: 'fighter', level: 5 } });
  assert.ok(CLASS_CHOICES.fighter.find((d) => d.subclass).options.some((o) => o.value === 'xge-samurai'));
  assert.equal(subclassOptions(model).includes('xge-samurai'), false);
  assert.equal(model.toggleSource('XGE'), true);
  assert.equal(subclassOptions(model).includes('xge-samurai'), true);
  assert.equal(model.set('info.classChoices.subclass', 'xge-samurai'), true);
  model.toggleSource('XGE');
  assert.equal(subclassOptions(model).includes('xge-samurai'), true, 'quella scelta resta visibile e valida');
  assert.equal(model.toggleSource('PHB'), false, 'il PHB non si può disattivare');
});
