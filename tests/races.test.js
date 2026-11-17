import { test } from 'node:test';
import assert from 'node:assert/strict';

import { CharacterModel } from '../js/model/CharacterModel.js';
import { feetToMeters } from '../js/data/races.js';

test('scegliere una razza imposta velocità e competenze fisse', () => {
  const model = new CharacterModel();
  model.set('info.raceId', 'elf');
  assert.equal(model.get('combat.speed'), 9);
  assert.equal(model.get('skills.perception.proficient'), true);

  model.set('info.raceId', 'dwarf');
  assert.equal(model.get('combat.speed'), 7.5);
  assert.equal(model.get('skills.perception.proficient'), true, 'una competenza già attiva non viene tolta');
});

test('i bonus razziali entrano nei modificatori senza toccare i punteggi inseriti', () => {
  const model = new CharacterModel();
  model.set('abilities.dex', 14);
  model.set('info.raceId', 'elf');
  assert.equal(model.get('abilities.dex'), 14);
  // 14 base + 2 razza = 16 → modificatore +3
  assert.equal(model.getDerived().mods.dex, 3);
});

test('razza sconosciuta o vuota viene rifiutata o azzerata senza effetti', () => {
  const model = new CharacterModel();
  model.set('info.raceId', 'not-a-race');
  assert.equal(model.get('info.raceId'), '');
  assert.equal(model.getDerived().race, null);
});

test('conversione piedi→metri', () => {
  assert.equal(feetToMeters(30), 9);
  assert.equal(feetToMeters(25), 7.5);
});

test('Mezzelfo: due caratteristiche a scelta ricevono +1, il Carisma escluso', () => {
  const model = new CharacterModel();
  model.set('info.raceId', 'halfElf');
  model.set('info.raceChoices.ability1', 'str');
  model.set('info.raceChoices.ability2', 'cha');
  // Forza +1 (10 → 11 → mod 0); Carisma escluso dalla scelta, ma +2 fisso della razza (10 → 12 → mod +1)
  assert.equal(model.getDerived().mods.str, 0);
  assert.equal(model.getDerived().mods.cha, 1);
});

test('Mezzelfo: scegliere due abilità le segna come competenti', () => {
  const model = new CharacterModel();
  model.set('info.raceId', 'halfElf');
  model.set('info.raceChoices.skill1', 'stealth');
  model.set('info.raceChoices.skill2', 'history');
  // Furtività (DES 10 → mod 0) con competenza +2 al livello 1
  assert.equal(model.getDerived().skills.stealth, 2);
  // La competenza è derivata: lo stato manuale non viene modificato
  assert.equal(model.get('skills.stealth.proficient'), false);
});

test('Competenze di classe: le scelte consentite diventano competenze', () => {
  const model = new CharacterModel();
  model.set('info.classId', 'rogue');
  model.set('classSkills.skill1', 'stealth');
  model.set('classSkills.skill2', 'athletics');
  const derived = model.getDerived();
  // Ladro: Furtività con Destrezza 10 (mod 0) e competenza +2; Atletica è tra le scelte del Ladro
  assert.equal(derived.skills.stealth, 2);
  assert.equal(derived.skills.athletics, 2);
  assert.equal(derived.classInfo.skillSlots.length, 4);
});

test('Competenze di classe: una scelta fuori lista del Ladro non ha effetto', () => {
  const model = new CharacterModel();
  model.set('info.classId', 'rogue');
  model.set('classSkills.skill1', 'arcana'); // Arcano non è tra le abilità del Ladro
  assert.equal(model.getDerived().skills.arcana, 0);
});

test('Cambiare classe azzera le scelte di abilità', () => {
  const model = new CharacterModel();
  model.set('info.classId', 'rogue');
  model.set('classSkills.skill1', 'stealth');
  model.set('info.classId', 'wizard');
  assert.equal(model.get('classSkills.skill1'), '');
});

test('Oggetti che modificano la CA si sommano alla CA', () => {
  const model = new CharacterModel();
  const before = model.getDerived().ac;
  model.addAcItem();
  const id = model.getSnapshot().equipment.acItems[0].id;
  model.set('equipment.acItems.0.name', 'Anello di protezione');
  model.set('equipment.acItems.0.bonus', 1);
  assert.equal(model.getDerived().ac, before + 1);
  model.removeAcItem(id);
  assert.equal(model.getDerived().ac, before);
});
