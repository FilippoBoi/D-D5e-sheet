import { test } from 'node:test';
import assert from 'node:assert/strict';

import { CharacterModel } from '../js/model/CharacterModel.js';
import { parseLanguageText } from '../js/data/languages.js';
import { RACE_LIST } from '../js/data/races.js';

const make = (info = {}) => {
  const model = new CharacterModel();
  for (const [key, value] of Object.entries(info)) model.set(`info.${key}`, value);
  return model;
};

test('ogni razza mostra i suoi tratti (con rimando al manuale per quelle non PHB)', () => {
  for (const race of RACE_LIST) {
    const d = make({ raceId: race.id }).getDerived();
    assert.equal(d.hasRaceTraits, d.raceTraits.length > 0, race.id);
    if (race.traits) assert.ok(d.raceTraits.length > 0, race.id);
  }
  const mpmm = make({ raceId: 'mpmm-aasimar' }).getDerived();
  assert.match(mpmm.raceTraits[0].description, /MPMM, p\. \d+/);
});

test('Nano delle Colline: +1 PF per livello, nei PF suggeriti e al salto di livello', () => {
  const plain = make({ raceId: 'phb-dwarf-mountain', level: 4 }).getDerived().hp;
  const hill = make({ raceId: 'phb-dwarf-hill', level: 4 }).getDerived().hp;
  assert.equal(hill.perLevelBonus, 1);
  assert.equal(hill.suggested - plain.suggested, 4);
  assert.equal(hill.averageGain - plain.averageGain, 1);
});

test('resistenze e competenze razziali sono automatiche', () => {
  assert.equal(make({ raceId: 'tiefling' }).getDerived().race.resistances, 'Fuoco');
  assert.match(make({ raceId: 'phb-dwarf-mountain' }).getDerived().race.proficiencies, /Armature: leggere, medie/);
  const dragon = make({ raceId: 'dragonborn' });
  assert.equal(dragon.getDerived().race.resistances, '', 'senza ascendenza non c\'è resistenza');
  dragon.set('info.raceChoices.option', 'fire');
  assert.equal(dragon.getDerived().race.resistances, 'Fuoco');
});

test('i tratti a usi limitati compaiono tra le abilità a riposo', () => {
  const dragon = make({ raceId: 'dragonborn', level: 6 });
  dragon.set('info.raceChoices.option', 'cold');
  dragon.set('abilities.con', 14);
  const breath = dragon.getDerived().usables.find((u) => u.id === 'breathWeapon');
  assert.equal(breath.recharge, 'short');
  assert.equal(breath.detail, '3d6 Freddo · CD 13'.replace('13', String(8 + 3 + 2)));
  dragon.set('resourcesUsed.breathWeapon', 1);
  dragon.shortRest();
  assert.equal(dragon.get('resourcesUsed.breathWeapon'), 0);

  const orc = make({ raceId: 'halfOrc' });
  orc.set('resourcesUsed.relentlessEndurance', 1);
  orc.shortRest();
  assert.equal(orc.get('resourcesUsed.relentlessEndurance'), 1, 'torna solo col riposo lungo');
  orc.longRest();
  assert.equal(orc.get('resourcesUsed.relentlessEndurance'), 0);

  const tiefling = make({ raceId: 'tiefling', level: 2 });
  const racial = (m) => m.getDerived().usables.filter((u) => u.id.startsWith('tiefling')).length;
  assert.equal(racial(tiefling), 0);
  assert.equal(racial(make({ raceId: 'tiefling', level: 3 })), 1);
  assert.equal(racial(make({ raceId: 'tiefling', level: 5 })), 2);
});

test('parseLanguageText legge lingue note, scelte e nomi sconosciuti', () => {
  assert.deepEqual(parseLanguageText('Comune, Elfico, una lingua a scelta'), { ids: ['common', 'elvish'], custom: [], choices: 1 });
  assert.equal(parseLanguageText('2 lingue a scelta').choices, 2);
  assert.equal(parseLanguageText('Due a scelta').choices, 2);
  assert.deepEqual(parseLanguageText('Comune, Qualcosa'), { ids: ['common'], custom: ['Qualcosa'], choices: 0 });
  assert.deepEqual(parseLanguageText(''), { ids: [], custom: [], choices: 0 });
});

test('lingue: fisse da razza, background e classe; menu per le scelte, senza doppioni', () => {
  const model = make({ raceId: 'halfElf', classId: 'rogue', backgroundId: 'acolyte' });
  let info = model.getDerived().languageInfo;
  assert.equal(info.known, 'Comune, Elfico, Gergo dei ladri');
  assert.equal(info.slots.length, 3, 'una dal Mezzelfo e due dall\'Accolito');
  assert.ok(!info.slots[0].options.some((o) => o.value === 'common' || o.value === 'elvish'), 'già note: non si ripropongono');

  model.set('languages.pick1', 'dwarvish');
  model.set('languages.pick2', 'dwarvish');
  info = model.getDerived().languageInfo;
  assert.ok(info.known.includes('Nanico'));
  assert.equal(info.slots[1].duplicate, true);
  assert.ok(!info.slots[2].options.some((o) => o.value === 'dwarvish'));

  model.set('languages.other', 'Linguaggio dei segni, Nanico');
  const known = model.getDerived().languageInfo.known.split(', ');
  assert.equal(known.filter((x) => x === 'Nanico').length, 1);
  assert.ok(known.includes('Linguaggio dei segni'));
});

test('lingue: valori non validi e salvataggi vecchi', () => {
  const model = new CharacterModel({ info: { raceId: 'human' } });
  assert.equal(model.set('languages.pick1', 'klingon'), false);
  assert.equal(model.getDerived().languageInfo.slots.length, 1);
  assert.equal(model.getDerived().languageInfo.known, 'Comune');
  assert.equal(make().getDerived().languageInfo.known, 'Nessuna');
});
