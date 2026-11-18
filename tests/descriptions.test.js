import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { SKILLS } from '../js/data/skills.js';
import { SPELL_LIST } from '../js/data/spells.js';
import { getSkillText, loadSpellText } from '../js/data/descriptions.js';
import { SPELL_TEXT } from '../js/data/generated/spellDescriptions.js';
import { parseInline, parseRichText } from '../js/model/richText.js';

// ------------------------------------------------------------------ copertura

test('ogni abilità ha una descrizione italiana e inglese', () => {
  for (const skill of SKILLS) {
    const text = getSkillText(skill.id);
    assert.ok(text?.it?.length > 40, `${skill.id}: italiano`);
    assert.ok(text?.en?.length > 40, `${skill.id}: inglese`);
    assert.ok(text.page > 0, `${skill.id}: pagina`);
  }
});

test('ogni trucchetto e incantesimo del catalogo ha una descrizione in entrambe le lingue', async () => {
  for (const spell of SPELL_LIST) {
    const text = await loadSpellText(spell.id);
    assert.ok(text?.it?.length > 20, `${spell.id}: italiano`);
    assert.ok(text?.en?.length > 20, `${spell.id}: inglese`);
  }
  assert.equal(Object.keys(SPELL_TEXT).length, SPELL_LIST.length, 'nessuna descrizione orfana');
  assert.equal(await loadSpellText('inesistente'), undefined);
});

test('le descrizioni generate coincidono con i file in docs/ (rilancia npm run descriptions se fallisce)', () => {
  const docs = readFileSync(new URL('../docs/spell-descriptions.md', import.meta.url), 'utf8');
  assert.ok(docs.includes(SPELL_TEXT['phb-fireball'].en.split('\n')[0]));
  assert.ok(docs.includes(SPELL_TEXT['phb-fireball'].it.split('\n')[0]));
});

test('i riassunti sono segnati e la condizione di lancio compare dove serve', () => {
  assert.equal(SPELL_TEXT['xge-absorb-elements'].sum, 1);
  assert.equal(SPELL_TEXT['phb-alarm'].sum, undefined);
  assert.match(SPELL_TEXT['xge-absorb-elements'].time[0], /reazione/);
  assert.match(SPELL_TEXT['phb-alarm'].mat, /tiny bell/);
});

// ------------------------------------------------------------------ Markdown

test('parseInline: grassetto, corsivo e entrambi', () => {
  assert.deepEqual(parseInline('a **b** *c* ***d*** e'), [
    { text: 'a ' }, { text: 'b', bold: true }, { text: ' ' }, { text: 'c', italic: true },
    { text: ' ' }, { text: 'd', bold: true, italic: true }, { text: ' e' },
  ]);
});

test('parseRichText: paragrafi, elenchi e tabelle', () => {
  const blocks = parseRichText('Uno\ncontinua\n\n- a\n- b\n\n| d10 | Esito |\n|---|---|\n| 1 | Fuoco |\n');
  assert.deepEqual(blocks.map((b) => b.type), ['p', 'ul', 'table']);
  assert.equal(blocks[0].inline[0].text, 'Uno continua');
  assert.equal(blocks[1].items.length, 2);
  assert.equal(blocks[2].rows.length, 1);
  assert.equal(blocks[2].head[1][0].text, 'Esito');
});

test('nessun testo conserva asterischi o barre del Markdown', async () => {
  for (const spell of SPELL_LIST) {
    const text = await loadSpellText(spell.id);
    for (const lang of ['it', 'en']) {
      for (const block of parseRichText(text[lang])) {
        const flat = JSON.stringify(block);
        assert.ok(!flat.includes('*'), `${spell.id}/${lang}: asterischi residui`);
      }
    }
  }
});
