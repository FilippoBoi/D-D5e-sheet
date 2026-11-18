import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { CharacterModel } from '../js/model/CharacterModel.js';
import { normalizeCharacter, createDefaultCharacter } from '../js/model/characterSchema.js';
import { SPELL_LIST, getSpell, onClassList } from '../js/data/spells.js';
import { SPELL_NAMES_IT } from '../js/data/spellNames.js';
import { spellLimits } from '../js/data/spellProgression.js';
import { SOURCE_IDS } from '../js/data/sources.js';
import { CLASS_IDS } from '../js/data/classes.js';
import { buildSpellOptions } from '../js/model/spellPicker.js';
import { castTimeText, durationText, rangeText } from '../js/model/spellText.js';
import { setLang } from '../js/i18n/i18n.js';

afterEach(() => setLang('it'));

const make = (info = {}, extra = {}) => new CharacterModel({ info, ...extra });

// ------------------------------------------------------------------ dati

test('catalogo: id univoci, livelli e fonti validi, classi note', () => {
  assert.ok(SPELL_LIST.length > 400);
  assert.equal(new Set(SPELL_LIST.map((s) => s.id)).size, SPELL_LIST.length);
  assert.equal(new Set(SPELL_LIST.map((s) => s.nameEn)).size, SPELL_LIST.length, 'un solo incantesimo per nome');
  for (const s of SPELL_LIST) {
    assert.ok(s.level >= 0 && s.level <= 9, s.id);
    assert.ok(SOURCE_IDS.includes(s.source), `${s.id}: ${s.source}`);
    assert.ok(s.classes.every((c) => CLASS_IDS.includes(c)), s.id);
    assert.ok((s.ext ?? []).every(([c, src]) => CLASS_IDS.includes(c) && SOURCE_IDS.includes(src)), s.id);
  }
});

test('catalogo: numeri attesi del Manuale del Giocatore', () => {
  const phb = SPELL_LIST.filter((s) => s.source === 'PHB');
  assert.equal(phb.length, 361);
  assert.equal(phb.filter((s) => s.level === 0).length, 27);
  assert.equal(phb.filter((s) => s.level === 9).length, 16);
  const fireball = getSpell('phb-fireball');
  assert.equal(fireball.level, 3);
  assert.deepEqual(fireball.classes, ['sorcerer', 'wizard']);
  assert.equal(getSpell('phb-eldritch-blast').level, 0);
});

test('nomi italiani: ogni id esiste e il nome inglese resta disponibile', () => {
  for (const id of Object.keys(SPELL_NAMES_IT)) assert.ok(getSpell(id), id);
  assert.equal(getSpell('phb-fireball').name, 'Palla di Fuoco');
  assert.equal(getSpell('phb-fireball').nameEn, 'Fireball');
  assert.equal(getSpell('phb-tasha-s-hideous-laughter').name, getSpell('phb-tasha-s-hideous-laughter').nameEn);
});

test('liste di classe: le aggiunte dei supplementi valgono solo con il manuale attivo', () => {
  const colorSpray = getSpell('phb-color-spray');
  assert.equal(onClassList(colorSpray, 'wizard', new Set(['PHB'])), true);
  assert.equal(onClassList(colorSpray, 'bard', new Set(['PHB'])), false);
  assert.equal(onClassList(colorSpray, 'bard', new Set(['PHB', 'TCE'])), true);
});

// ------------------------------------------------------------------ limiti

test('limiti: tabelle del PHB per classi che conoscono gli incantesimi', () => {
  assert.deepEqual(spellLimits('bard', 1, 3), { cantrips: 2, spells: 4, kind: 'known' });
  assert.deepEqual(spellLimits('bard', 10, 3), { cantrips: 4, spells: 14, kind: 'known' });
  assert.deepEqual(spellLimits('sorcerer', 20, 5), { cantrips: 6, spells: 15, kind: 'known' });
  assert.deepEqual(spellLimits('warlock', 5, 3), { cantrips: 3, spells: 6, kind: 'known' });
  assert.deepEqual(spellLimits('ranger', 2, 3), { cantrips: 0, spells: 2, kind: 'known' });
  assert.deepEqual(spellLimits('eldritchKnight', 3, 0), { cantrips: 2, spells: 3, kind: 'known' });
  assert.deepEqual(spellLimits('arcaneTrickster', 10, 0), { cantrips: 3 + 1, spells: 7, kind: 'known' });
});

test('limiti: le classi che preparano usano modificatore + livello (Paladino: metà livello)', () => {
  assert.deepEqual(spellLimits('wizard', 5, 3), { cantrips: 4, spells: 8, kind: 'prepared' });
  assert.deepEqual(spellLimits('cleric', 1, -1), { cantrips: 3, spells: 1, kind: 'prepared' }, 'almeno 1');
  assert.deepEqual(spellLimits('paladin', 5, 3), { cantrips: 0, spells: 5, kind: 'prepared' });
});

test('derivati: contatori, stato e lista di riferimento', () => {
  const model = make({ classId: 'wizard', level: 5 }, { abilities: { int: 16 } });
  const sc = model.getDerived().spellcasting;
  assert.equal(sc.maxLevel, 3);
  assert.equal(sc.listClass, 'wizard');
  assert.equal(sc.cantrips.limit, 4);
  assert.equal(sc.spells.limit, 8);
  assert.equal(sc.knowledge, 'prepared');
  assert.equal(sc.cantrips.status, 'open');
  for (const id of ['phb-light', 'phb-mage-hand', 'phb-fire-bolt', 'phb-ray-of-frost']) model.toggleSpell('cantrips', id);
  assert.equal(model.getDerived().spellcasting.cantrips.status, 'full');
  model.toggleSpell('cantrips', 'phb-prestidigitation');
  const over = model.getDerived().spellcasting.cantrips;
  assert.equal(over.status, 'over');
  assert.equal(over.over, 1);
});

test('derivati: il Cavaliere Mistico usa la lista del Mago e i suoi limiti', () => {
  const model = make({ classId: 'fighter', level: 3, classChoices: { subclass: 'eldritchKnight' } });
  const sc = model.getDerived().spellcasting;
  assert.equal(sc.isCaster, true);
  assert.equal(sc.listClass, 'wizard');
  assert.equal(sc.cantrips.limit, 2);
  assert.equal(sc.spells.limit, 3);
  assert.equal(sc.maxLevel, 1);
  assert.equal(sc.listFromSubclass, true);
});

// ------------------------------------------------------------------ modello

test('toggleSpell: aggiunge, toglie e rifiuta id o tipi sbagliati', () => {
  const model = make({ classId: 'wizard' });
  let changes = 0;
  model.on('change', () => { changes += 1; });
  assert.equal(model.toggleSpell('spells', 'phb-shield'), true);
  assert.deepEqual(model.get('spells.spellIds'), ['phb-shield']);
  assert.equal(model.toggleSpell('spells', 'phb-shield'), true);
  assert.deepEqual(model.get('spells.spellIds'), []);
  assert.equal(changes, 2);
  assert.equal(model.toggleSpell('cantrips', 'phb-shield'), false, 'un incantesimo non è un trucchetto');
  assert.equal(model.toggleSpell('spells', 'phb-light'), false, 'un trucchetto non è un incantesimo');
  assert.equal(model.toggleSpell('spells', 'nope'), false);
  assert.equal(model.toggleSpell('spells', { id: 'phb-shield' }), false);
  assert.equal(model.toggleSpell('other', 'phb-shield'), false);
  assert.equal(changes, 2);
});

test('set() non può scrivere gli elenchi direttamente', () => {
  const model = make({ classId: 'wizard' });
  assert.equal(model.set('spells.spellIds', ['phb-shield']), false);
  assert.deepEqual(model.get('spells.spellIds'), []);
});

test('cambiare classe azzera gli incantesimi scelti (appartengono alla vecchia lista)', () => {
  const model = make({ classId: 'wizard' });
  model.toggleSpell('cantrips', 'phb-light');
  model.toggleSpell('spells', 'phb-shield');
  model.set('info.classId', 'cleric');
  assert.deepEqual(model.get('spells.cantripIds'), []);
  assert.deepEqual(model.get('spells.spellIds'), []);
});

test('normalizzazione: scarta ignoti, duplicati e livelli sbagliati; i vecchi salvataggi ricevono elenchi vuoti', () => {
  const state = normalizeCharacter({
    spells: {
      cantripIds: ['phb-light', 'phb-light', 'phb-shield', 'zzz', 5, null],
      spellIds: ['phb-shield', 'phb-shield', 'phb-light', 'phb-wish'],
      cantrips: 'Luce', prepared: 'Scudo',
    },
  });
  assert.deepEqual(state.spells.cantripIds, ['phb-light']);
  assert.deepEqual(state.spells.spellIds, ['phb-shield', 'phb-wish']);
  assert.equal(state.spells.cantrips, 'Luce', 'il testo libero resta');
  const legacy = normalizeCharacter({ spells: { cantrips: 'Luce', prepared: '', slotsUsed: { 1: 2 } } });
  assert.deepEqual(legacy.spells.cantripIds, []);
  assert.deepEqual(legacy.spells.spellIds, []);
  assert.equal(legacy.spells.slotsUsed['1'], 2);
  assert.deepEqual(normalizeCharacter({ spells: { cantripIds: 'phb-light' } }).spells.cantripIds, []);
  assert.deepEqual(createDefaultCharacter().spells.cantripIds, []);
});

// ------------------------------------------------------------------ selettore

test('selettore: solo i manuali attivi, con gli incantesimi già scelti sempre presenti', () => {
  const opts = (selected = [], enabled = ['PHB']) => buildSpellOptions({ kind: 'spells', listClass: 'wizard', enabled: new Set(enabled), selected });
  const base = opts();
  assert.ok(base.every((o) => o.level >= 1));
  assert.ok(base.every((o) => o.source === 'PHB'));
  assert.ok(opts([], ['PHB', 'XGE']).some((o) => o.source === 'XGE'));
  assert.ok(opts(['xge-absorb-elements']).some((o) => o.id === 'xge-absorb-elements'), 'la scelta resta visibile con XGE spento');
  assert.ok(base.every((o, i) => i === 0 || base[i - 1].level <= o.level), 'ordinati per livello');
  const fireball = base.find((o) => o.id === 'phb-fireball');
  assert.equal(fireball.own, true);
  assert.equal(base.find((o) => o.id === 'phb-cure-wounds').own, false);
  const cantrips = buildSpellOptions({ kind: 'cantrips', listClass: 'wizard', enabled: new Set(['PHB']), selected: [] });
  assert.ok(cantrips.length > 0 && cantrips.every((o) => o.level === 0));
});

test('selettore: getSpellOptions usa la lista della classe e i manuali attivi del modello', () => {
  const model = make({ classId: 'cleric' });
  const own = model.getSpellOptions('spells').filter((o) => o.own).map((o) => o.id);
  assert.ok(own.includes('phb-bless'));
  assert.ok(!own.includes('phb-fireball'));
  assert.ok(!model.getSpellOptions('spells').some((o) => o.source === 'XGE'));
  model.toggleSource('XGE');
  assert.ok(model.getSpellOptions('spells').some((o) => o.source === 'XGE'));
});

// ------------------------------------------------------------------ testi

test('testi: tempo, gittata e durata in italiano e in inglese', () => {
  assert.equal(castTimeText('1a'), '1 azione');
  assert.equal(castTimeText('1b'), '1 az. bonus');
  assert.equal(rangeText('150ft'), '45 m');
  assert.equal(rangeText('self'), 'Su di sé');
  assert.equal(durationText('inst'), 'Istantanea');
  assert.equal(durationText('1h'), '1 ora');
  assert.equal(durationText('8h'), '8 ore');
  setLang('en');
  assert.equal(castTimeText('1b'), '1 bonus action');
  assert.equal(rangeText('150ft'), '150 ft');
  assert.equal(durationText('6r'), '6 rounds');
});

test('lingua: i derivati seguono la lingua corrente', () => {
  const model = make({ classId: 'wizard' });
  model.toggleSpell('spells', 'phb-fireball');
  assert.equal(model.getDerived().spellcasting.spells.selected[0].name, 'Palla di Fuoco');
  assert.equal(model.getDerived().spellcasting.spells.selected[0].altName, 'Fireball');
  setLang('en');
  assert.equal(model.getDerived().spellcasting.spells.selected[0].name, 'Fireball');
  assert.equal(model.getDerived().spellcasting.spellsTitle, 'Spells prepared');
});
