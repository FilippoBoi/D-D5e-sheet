import { test } from 'node:test';
import assert from 'node:assert/strict';

import { CharacterModel } from '../js/model/CharacterModel.js';
import { createDefaultCharacter, normalizeCharacter } from '../js/model/characterSchema.js';
import { deepMerge, diffDeep } from '../js/sync/diff.js';

/** Scheda con scelte di ogni tipo (singola, multipla, abilità), dal Model come farebbe un giocatore. */
function sampleCharacter() {
  const model = new CharacterModel({ info: { classId: 'ranger', level: 6 }, skills: { stealth: { proficient: true } } });
  model.toggleChoice('favoredEnemy', 'beasts');
  model.toggleChoice('favoredEnemy', 'undead');
  model.toggleChoice('favoredTerrain', 'forest');
  const cleric = new CharacterModel({ info: { classId: 'cleric', level: 3 } });
  cleric.set('info.classChoices.subclass', 'knowledge');
  cleric.toggleChoice('domainSkills', 'arcana');
  return { ranger: model.toJSON(), cleric: cleric.toJSON() };
}

test('normalizeCharacter conserva le scelte e il risultato è stabile (idempotente)', () => {
  const { ranger, cleric } = sampleCharacter();
  for (const doc of [ranger, cleric]) {
    const once = normalizeCharacter(doc);
    assert.deepEqual(once.info.classChoices, doc.info.classChoices);
    assert.deepEqual(normalizeCharacter(once), once);
  }
  assert.deepEqual(ranger.info.classChoices.favoredEnemy, ['beasts', 'undead']);
});

test('esportazione e importazione JSON: nessuna perdita', () => {
  const { ranger } = sampleCharacter();
  const imported = new CharacterModel();
  imported.load(JSON.parse(JSON.stringify(ranger)));
  assert.deepEqual(imported.toJSON(), ranger);
});

test('diffDeep + deepMerge ricostruiscono le scelte senza perdite (le liste si sostituiscono intere)', () => {
  const { ranger, cleric } = sampleCharacter();
  const base = createDefaultCharacter();
  for (const doc of [ranger, cleric]) {
    const patch = diffDeep(base, doc);
    const rebuilt = normalizeCharacter(deepMerge(base, patch));
    assert.deepEqual(rebuilt.info.classChoices, doc.info.classChoices);
  }
});

test('due modifiche a campi diversi si fondono; sulla stessa lista vince l\'ultima', () => {
  const { ranger } = sampleCharacter();
  const mine = structuredClone(ranger);
  mine.info.classChoices.favoredTerrain = ['forest', 'coast'];
  const theirs = structuredClone(ranger);
  theirs.info.classChoices.favoredEnemy = ['beasts', 'giants'];
  // l'altra persona ha cambiato solo i nemici, io solo i terreni
  const merged = normalizeCharacter(deepMerge(deepMerge(ranger, diffDeep(ranger, mine)), diffDeep(ranger, theirs)));
  assert.deepEqual(merged.info.classChoices.favoredEnemy, ['beasts', 'giants']);
  assert.deepEqual(merged.info.classChoices.favoredTerrain, ['forest', 'coast']);

  const a = structuredClone(ranger); a.info.classChoices.favoredEnemy = ['dragons', 'oozes'];
  const winner = deepMerge(deepMerge(ranger, diffDeep(ranger, a)), diffDeep(ranger, theirs));
  assert.deepEqual(winner.info.classChoices.favoredEnemy, ['beasts', 'giants'], 'sostituzione intera, nessuna unione');
});

test('una patch remota con scelte incoerenti viene ripulita al caricamento', () => {
  const { cleric } = sampleCharacter();
  const patch = { info: { classChoices: { subclass: 'life' } } }; // cambia dominio, domainSkills resta nel documento
  const model = new CharacterModel(cleric);
  model.load(deepMerge(model.toJSON(), patch));
  assert.deepEqual(model.get('info.classChoices.domainSkills'), []);
  assert.equal(model.get('info.classChoices.subclass'), 'life');
});
