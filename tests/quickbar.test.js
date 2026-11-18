import { test } from 'node:test';
import assert from 'node:assert/strict';

import { CharacterModel } from '../js/model/CharacterModel.js';

const weapon = (extra) => ({ name: 'Arma', ability: 'str', proficient: true, magicBonus: 0, damage: '1d8', damageType: '', ...extra });

test('riepilogo: il TpC è il più alto tra le armi in tabella', () => {
  const model = new CharacterModel({ info: { level: 5 }, abilities: { str: 16, dex: 18 }, weapons: [weapon({ name: 'Spada', ability: 'str' }), weapon({ name: 'Arco', ability: 'dex', magicBonus: 1 })] });
  const d = model.getDerived();
  // competenza +3: Spada 3 + 3 = +6, Arco 4 + 3 + 1 = +8
  assert.deepEqual(d.weapons.map((w) => w.attack), [6, 8]);
  assert.equal(d.topAttack, 8);
  assert.equal(d.hasWeapons, true);
});

test('riepilogo: senza armi non c\'è TpC; senza competenza non si somma', () => {
  assert.equal(new CharacterModel().getDerived().topAttack, null);
  const model = new CharacterModel({ abilities: { str: 14 }, weapons: [weapon({ proficient: false })] });
  assert.equal(model.getDerived().topAttack, 2);
  model.set('weapons.0.proficient', true);
  assert.equal(model.getDerived().topAttack, 4);
});
