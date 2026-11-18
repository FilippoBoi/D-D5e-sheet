import { test } from 'node:test';
import assert from 'node:assert/strict';

import { CharacterModel } from '../js/model/CharacterModel.js';
import { LocalStorageRepository } from '../js/model/LocalStorageRepository.js';

test('set() valida e limita i valori', () => {
  const model = new CharacterModel();
  model.set('abilities.str', '50');
  assert.equal(model.get('abilities.str'), 30);
  model.set('info.level', 0);
  assert.equal(model.get('info.level'), 1);
  model.set('info.classId', 'not-a-class');
  assert.equal(model.get('info.classId'), 'fighter');
  model.set('abilities.dex', '');
  assert.equal(model.get('abilities.dex'), 10, 'un campo vuoto non cambia il valore');
});

test('set() ignora percorsi inesistenti o pericolosi', () => {
  const model = new CharacterModel();
  assert.equal(model.set('info.doesNotExist', 'x'), false);
  assert.equal(model.set('__proto__.polluted', true), false);
  assert.equal(({}).polluted, undefined);
});

test('set() emette "change" solo quando lo stato cambia davvero', () => {
  const model = new CharacterModel();
  let count = 0;
  model.on('change', () => { count += 1; });
  model.set('info.name', 'Thalia');
  model.set('info.name', 'Thalia');
  assert.equal(count, 1);
});

test('cambiare classe applica le competenze nei tiri salvezza', () => {
  const model = new CharacterModel();
  model.set('info.classId', 'wizard');
  assert.deepEqual(model.get('saveProficiencies'), {
    str: false, dex: false, con: false, int: true, wis: true, cha: false,
  });
});

test('i danni consumano prima i PF temporanei', () => {
  const model = new CharacterModel();
  model.set('combat.hpMax', 20);
  model.set('combat.hpCurrent', 20);
  model.set('combat.hpTemp', 5);
  model.applyDamage(8);
  assert.equal(model.get('combat.hpTemp'), 0);
  assert.equal(model.get('combat.hpCurrent'), 17);
  model.applyDamage(100);
  assert.equal(model.get('combat.hpCurrent'), 0);
  model.heal(100);
  assert.equal(model.get('combat.hpCurrent'), 20);
});

test('armi: aggiunta, modifica e rimozione', () => {
  const model = new CharacterModel();
  model.addWeapon();
  model.set('weapons.0.ability', 'dex');
  model.set('weapons.0.ability', 'int'); // non consentita per le armi
  assert.equal(model.get('weapons.0.ability'), 'dex');
  model.removeWeapon(model.get('weapons.0.id'));
  assert.deepEqual(model.get('weapons'), []);
});

test('load() accetta dati parziali o sporchi senza rompere lo stato', () => {
  const model = new CharacterModel();
  model.load({
    info: { name: 'Bruenor', level: 99, classId: 'barbarian', extra: 'ignorato' },
    abilities: { str: '18' },
    weapons: [{ name: 'Ascia', ability: 'str', magicBonus: 1 }, 'spazzatura'],
    unknownRoot: true,
  });
  const state = model.getSnapshot();
  assert.equal(state.info.name, 'Bruenor');
  assert.equal(state.info.level, 20);
  assert.equal(state.abilities.str, 18);
  assert.equal(state.info.extra, undefined);
  assert.equal(state.unknownRoot, undefined);
  assert.equal(state.weapons.length, 2);
  assert.equal(state.weapons[0].magicBonus, 1);
});

test('valori derivati: CA, iniziativa e incantesimi', () => {
  const model = new CharacterModel();
  model.set('info.classId', 'wizard');
  model.set('info.level', 5);
  model.set('abilities.int', 18);
  model.set('abilities.dex', 14);
  model.set('equipment.armorId', 'leather');
  const d = model.getDerived();
  assert.equal(d.ac, 13);
  assert.equal(d.initiative, 2);
  assert.equal(d.spellcasting.isCaster, true);
  assert.equal(d.spellcasting.dc, 15); // 8 + 3 + 4
  assert.equal(d.spellcasting.attack, 7);
});

test('il Paladino diventa incantatore solo dal 2° livello', () => {
  const model = new CharacterModel();
  model.set('info.classId', 'paladin');
  assert.equal(model.getDerived().spellcasting.isCaster, false);
  model.set('info.level', 2);
  assert.equal(model.getDerived().spellcasting.isCaster, true);
});

test('il repository tollera storage assente o corrotto', () => {
  const noStorage = new LocalStorageRepository('k', null);
  assert.equal(noStorage.load(), null);
  assert.equal(noStorage.save({ a: 1 }), false);

  const corrupted = new LocalStorageRepository('k', { getItem: () => '{not json', setItem() {}, removeItem() {} });
  assert.equal(corrupted.load(), null);
});

test('note libere: normalizzate, con id unici e limiti; le note predefinite restano dove sono', () => {
  const model = new CharacterModel();
  model.load({
    notes: {
      traits: 'Tratti', backstory: 'Storia',
      items: [
        { id: 'a', title: 'Sessione 1', text: 'Testo' },
        { id: 'a', title: 'x'.repeat(200), text: 5 },
        'spazzatura',
      ],
    },
  });
  const { notes } = model.getSnapshot();
  assert.equal(notes.traits, 'Tratti');
  assert.equal(notes.backstory, 'Storia');
  assert.equal(notes.items.length, 3);
  assert.equal(notes.items[0].id, 'a');
  assert.notEqual(notes.items[1].id, 'a'); // id doppio: se ne genera uno nuovo
  assert.equal(notes.items[1].title.length, 80);
  assert.equal(notes.items[1].text, '5');
  assert.equal(notes.items[2].title, '');
  // Un salvataggio vecchio senza l'elenco riceve un elenco vuoto.
  model.load({ notes: { traits: 'x' } });
  assert.deepEqual(model.getSnapshot().notes.items, []);
});
