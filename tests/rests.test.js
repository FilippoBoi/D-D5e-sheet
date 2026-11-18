import { test } from 'node:test';
import assert from 'node:assert/strict';

import { CharacterModel } from '../js/model/CharacterModel.js';

const make = (info = {}) => {
  const model = new CharacterModel();
  for (const [key, value] of Object.entries(info)) model.set(`info.${key}`, value);
  return model;
};

test('le risorse a usi limitati si spendono e compaiono tra i derivati', () => {
  const model = make({ classId: 'fighter', level: 17 });
  const ids = model.getDerived().usables.map((u) => u.id);
  assert.deepEqual(ids, ['secondWind', 'actionSurge', 'indomitable']);
  model.set('resourcesUsed.actionSurge', 2);
  const surge = model.getDerived().usables.find((u) => u.id === 'actionSurge');
  assert.equal(surge.max, 2);
  assert.equal(surge.remaining, '0/2');
  model.set('resourcesUsed.actionSurge', 9);
  assert.equal(model.getDerived().usables.find((u) => u.id === 'actionSurge').used, 2, 'gli usi non superano il massimo');
});

test('il riposo breve recupera solo le risorse a riposo breve', () => {
  const model = make({ classId: 'fighter', level: 9 });
  model.set('resourcesUsed.secondWind', 1);
  model.set('resourcesUsed.actionSurge', 1);
  model.set('resourcesUsed.indomitable', 1);
  model.set('combat.hpCurrent', 3);
  model.shortRest();
  assert.equal(model.get('resourcesUsed.secondWind'), 0);
  assert.equal(model.get('resourcesUsed.actionSurge'), 0);
  assert.equal(model.get('resourcesUsed.indomitable'), 1, 'Indomito torna solo col riposo lungo');
  assert.equal(model.get('combat.hpCurrent'), 3, 'il riposo breve non cura da solo');
  model.longRest();
  assert.equal(model.get('resourcesUsed.indomitable'), 0);
});

test('il Bardo recupera Ispirazione col riposo breve solo dal 5° livello', () => {
  const low = make({ classId: 'bard', level: 4 });
  assert.equal(low.getDerived().usables[0].recharge, 'long');
  const high = make({ classId: 'bard', level: 5 });
  assert.equal(high.getDerived().usables[0].recharge, 'short');
});

test('il riposo breve ripristina gli slot del Patto del Warlock, non quelli degli altri incantatori', () => {
  const warlock = make({ classId: 'warlock', level: 3 });
  warlock.set('spells.slotsUsed.2', 2);
  warlock.shortRest();
  assert.equal(warlock.get('spells.slotsUsed.2'), 0);

  const wizard = make({ classId: 'wizard', level: 3 });
  wizard.set('spells.slotsUsed.1', 2);
  wizard.shortRest();
  assert.equal(wizard.get('spells.slotsUsed.1'), 2);
});

test('salendo di livello: media, tiro virtuale e dadi già tirati', () => {
  const model = make({ classId: 'fighter' }); // d10
  model.set('abilities.con', 14); // +2
  model.set('combat.hpMax', 12);
  model.set('combat.hpCurrent', 5);

  assert.deepEqual(model.applyLevelUpHp(1, { mode: 'average' }), { gain: 8, rolls: [] });
  assert.equal(model.get('combat.hpMax'), 20);
  assert.equal(model.get('combat.hpCurrent'), 13, 'anche i PF attuali aumentano');

  const out = model.applyLevelUpHp(2, { mode: 'roll', rng: () => 0.5 }); // d10 → 6 due volte
  assert.deepEqual(out.rolls, [6, 6]);
  assert.equal(out.gain, 16);

  assert.equal(model.applyLevelUpHp(1, { mode: 'manual', total: 99 }).gain, 12, 'il tiro è limitato al dado');
  assert.equal(model.applyLevelUpHp(1, { mode: 'nope' }).gain, 0);
  assert.equal(model.applyLevelUpHp(0, { mode: 'average' }).gain, 0);
});

test('ogni livello dà almeno 1 PF anche con Costituzione molto bassa', () => {
  const model = make({ classId: 'wizard' });
  model.set('abilities.con', 1); // −5
  assert.equal(model.applyLevelUpHp(1, { mode: 'roll', rng: () => 0 }).gain, 1);
});

test('i salvataggi senza resourcesUsed ricevono i valori di default', () => {
  const model = new CharacterModel({ info: { classId: 'monk', level: 5 } });
  assert.equal(model.get('resourcesUsed.ki'), 0);
  model.set('resourcesUsed.ki', 3);
  assert.equal(new CharacterModel(model.toJSON()).get('resourcesUsed.ki'), 3);
});
