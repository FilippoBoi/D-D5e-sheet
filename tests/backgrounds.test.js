import { test } from 'node:test';
import assert from 'node:assert/strict';

import { CharacterModel } from '../js/model/CharacterModel.js';
import { BACKGROUND_LIST } from '../js/data/backgrounds.js';
import { SKILLS } from '../js/data/skills.js';

const SKILL_IDS = SKILLS.map((s) => s.id);

test('ogni background del catalogo ha due competenze valide e testi in italiano e inglese', () => {
  assert.equal(BACKGROUND_LIST.filter((b) => b.source === 'PHB').length, 13);
  for (const b of BACKGROUND_LIST) {
    // Negli altri manuali alcune competenze sono a scelta: qui ne bastano 0-2, tutte valide.
    if (b.source === 'PHB') assert.equal(b.skills.length, 2, b.id); else assert.ok(b.skills.length <= 2, b.id);
    assert.ok(b.skills.every((id) => SKILL_IDS.includes(id)), b.id);
    assert.ok(b.name && b.nameEn && b.featureEn !== undefined && b.equipmentEn !== undefined, b.id);
  }
});

test('scegliere un background aggiunge le sue competenze senza toccare quelle scelte a mano', () => {
  const model = new CharacterModel();
  model.set('skills.arcana.proficient', true);
  model.set('info.backgroundId', 'soldier');
  assert.equal(model.getDerived().background.isCustom, false);
  assert.equal(model.getDerived().skills.athletics, 2); // mod +0 + competenza +2 (livello 1)
  assert.equal(model.getDerived().skills.intimidation, 2);
  assert.equal(model.get('skills.arcana.proficient'), true);

  model.set('info.backgroundId', '');
  assert.equal(model.getDerived().skills.athletics, 0, 'tornando a personalizzato la competenza sparisce');
  assert.equal(model.getDerived().background.isCustom, true);
});

test('background sconosciuto rifiutato; il testo libero resta disponibile', () => {
  const model = new CharacterModel({ info: { background: 'Gladiatore' } });
  assert.equal(model.get('info.background'), 'Gladiatore');
  model.set('info.backgroundId', 'nope');
  assert.equal(model.get('info.backgroundId'), '');
});

test('le competenze del background risultano spuntate (bloccate) nelle abilità', () => {
  const model = new CharacterModel();
  model.set('info.backgroundId', 'soldier');
  const auto = model.getDerived().proficientFromSources;
  assert.ok(auto.includes('athletics') && auto.includes('intimidation'));
  model.set('skills.arcana.proficient', true);
  assert.ok(!model.getDerived().proficientFromSources.includes('arcana'), 'quelle manuali restano modificabili');
});
