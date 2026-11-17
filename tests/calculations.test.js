import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  abilityModifier, attackBonus, computeArmorClass, proficiencyBonus,
  skillBonus, spellSaveDC, spellSlotsFor, suggestedMaxHp,
} from '../js/model/calculations.js';
import { getArmor } from '../js/data/armors.js';
import { CLASSES } from '../js/data/classes.js';
import { getClassFeatures } from '../js/data/classFeatures.js';

const mods = (overrides = {}) => ({ str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0, ...overrides });

test('modificatore di caratteristica: floor((punteggio - 10) / 2)', () => {
  assert.equal(abilityModifier(1), -5);
  assert.equal(abilityModifier(8), -1);
  assert.equal(abilityModifier(9), -1);
  assert.equal(abilityModifier(10), 0);
  assert.equal(abilityModifier(11), 0);
  assert.equal(abilityModifier(15), 2);
  assert.equal(abilityModifier(20), 5);
  assert.equal(abilityModifier(30), 10);
});

test('bonus di competenza per livello', () => {
  const expected = { 1: 2, 4: 2, 5: 3, 8: 3, 9: 4, 13: 5, 16: 5, 17: 6, 20: 6 };
  for (const [level, bonus] of Object.entries(expected)) {
    assert.equal(proficiencyBonus(Number(level)), bonus, `livello ${level}`);
  }
});

test('CA senza armatura = 10 + DES', () => {
  const ac = computeArmorClass({ armor: getArmor('none'), hasShield: false, mods: mods({ dex: 3 }) });
  assert.equal(ac.total, 13);
});

test('armatura leggera: DES senza limite', () => {
  const ac = computeArmorClass({ armor: getArmor('studdedLeather'), hasShield: false, mods: mods({ dex: 5 }) });
  assert.equal(ac.total, 17);
});

test('armatura media: DES al massimo +2, ma un malus si applica', () => {
  const high = computeArmorClass({ armor: getArmor('halfPlate'), hasShield: false, mods: mods({ dex: 4 }) });
  assert.equal(high.total, 17);
  const low = computeArmorClass({ armor: getArmor('halfPlate'), hasShield: false, mods: mods({ dex: -1 }) });
  assert.equal(low.total, 14);
});

test('armatura pesante: valore fisso, ignora anche la DES negativa', () => {
  const ac = computeArmorClass({ armor: getArmor('plate'), hasShield: false, mods: mods({ dex: -2 }) });
  assert.equal(ac.total, 18);
});

test('scudo e bonus magico si sommano', () => {
  const ac = computeArmorClass({ armor: getArmor('chainMail'), hasShield: true, magicBonus: 1, mods: mods() });
  assert.equal(ac.total, 19);
  assert.deepEqual(ac.parts.map((p) => p.label), ['Cotta di maglia', 'Scudo', 'Magia']);
});

test('Difesa senza Armatura del Barbaro funziona con lo scudo', () => {
  const ac = computeArmorClass({
    armor: getArmor('none'), hasShield: true, mods: mods({ dex: 2, con: 3 }),
    unarmoredDefense: CLASSES.barbarian.unarmoredDefense,
  });
  assert.equal(ac.total, 17); // 10 + 2 + 3 + 2
});

test('Difesa senza Armatura del Monaco si perde con lo scudo', () => {
  const unarmoredDefense = CLASSES.monk.unarmoredDefense;
  const noShield = computeArmorClass({ armor: getArmor('none'), hasShield: false, mods: mods({ dex: 3, wis: 2 }), unarmoredDefense });
  const shield = computeArmorClass({ armor: getArmor('none'), hasShield: true, mods: mods({ dex: 3, wis: 2 }), unarmoredDefense });
  assert.equal(noShield.total, 15);
  assert.equal(shield.total, 15); // 10 + 3 + scudo 2, senza SAG
});

test('abilità: competenza, maestria e Factotum', () => {
  assert.equal(skillBonus({ abilityMod: 2, profBonus: 3, proficient: false, expertise: false }), 2);
  assert.equal(skillBonus({ abilityMod: 2, profBonus: 3, proficient: true, expertise: false }), 5);
  assert.equal(skillBonus({ abilityMod: 2, profBonus: 3, proficient: true, expertise: true }), 8);
  assert.equal(skillBonus({ abilityMod: 2, profBonus: 3, proficient: false, expertise: false, jackOfAllTrades: 1 }), 3);
});

test('tiro per colpire e CD incantesimi', () => {
  assert.equal(attackBonus({ abilityMod: 3, profBonus: 2, proficient: true, magicBonus: 1 }), 6);
  assert.equal(attackBonus({ abilityMod: 3, profBonus: 2, proficient: false }), 3);
  assert.equal(spellSaveDC(3, 4), 15);
});

test('slot incantesimo: incantatori completi, mezzi incantatori e patto', () => {
  const maxes = (slots) => slots.map((s) => s.max);
  assert.deepEqual(maxes(spellSlotsFor('full', 1)), [2]);
  assert.deepEqual(maxes(spellSlotsFor('full', 5)), [4, 3, 2]);
  assert.deepEqual(maxes(spellSlotsFor('full', 20)), [4, 3, 3, 3, 3, 2, 2, 1, 1]);
  assert.deepEqual(spellSlotsFor('half', 1), []);
  assert.deepEqual(maxes(spellSlotsFor('half', 2)), [2]);
  assert.deepEqual(maxes(spellSlotsFor('half', 5)), [4, 2]);
  assert.deepEqual(maxes(spellSlotsFor('half', 20)), [4, 3, 3, 3, 2]);
  assert.deepEqual(spellSlotsFor('pact', 1), [{ level: 1, max: 1 }]);
  assert.deepEqual(spellSlotsFor('pact', 11), [{ level: 5, max: 3 }]);
  assert.deepEqual(spellSlotsFor(null, 10), []);
});

test('PF suggeriti: massimo al 1° livello, poi media', () => {
  assert.equal(suggestedMaxHp(10, 1, 2), 12);
  assert.equal(suggestedMaxHp(10, 3, 2), 12 + 8 + 8);
  assert.equal(suggestedMaxHp(6, 2, -3), 3 + 1); // minimo 1 PF per livello
});

test('Guerriero di 3° livello sblocca i privilegi attesi', () => {
  const names = getClassFeatures('fighter', 3).map((f) => f.name);
  assert.deepEqual(names, ['Stile di Combattimento', 'Recuperare Energie', 'Azione Impetuosa', 'Archetipo Marziale']);
});

test('ogni classe ha privilegi definiti al 1° livello', () => {
  for (const id of Object.keys(CLASSES)) {
    assert.ok(getClassFeatures(id, 1).length > 0, id);
  }
});
