import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { CharacterModel } from '../js/model/CharacterModel.js';
import { createDefaultCharacter, normalizeCharacter } from '../js/model/characterSchema.js';
import { CLASS_CHOICES, choiceCount, defaultChoiceValues, isListType } from '../js/data/classChoices/index.js';
import { CLASS_IDS } from '../js/data/classes.js';
import { SKILLS } from '../js/data/skills.js';
import { setLang } from '../js/i18n/i18n.js';
import { computeArmorClass, suggestedMaxHp } from '../js/model/calculations.js';

afterEach(() => setLang('it'));

const SKILL_IDS = SKILLS.map((s) => s.id);
const make = (info = {}, extra = {}) => new CharacterModel({ info, ...extra });

// ------------------------------------------------------------------ dati

test('dati: ogni classe ha un file, le chiavi hanno lo stesso tipo ovunque e i riferimenti esistono', () => {
  assert.deepEqual(Object.keys(CLASS_CHOICES).sort(), [...CLASS_IDS].sort());
  const types = new Map();
  for (const [classId, defs] of Object.entries(CLASS_CHOICES)) {
    const keys = new Set();
    for (const def of defs) {
      const at = `${classId}.${def.key}`;
      assert.ok(!keys.has(def.key), `${at}: chiave duplicata nella classe`);
      keys.add(def.key);
      assert.ok(['single', 'multi', 'skills', 'text'].includes(def.type), at);
      assert.ok((types.get(def.key) ?? def.type) === def.type, `${at}: tipo diverso in un'altra classe`);
      types.set(def.key, def.type);
      assert.ok(def.minLevel >= 1 && def.minLevel <= 20, at);
      if (isListType(def.type)) assert.ok(choiceCount(def, 20) >= 1, `${at}: quantità`);
      if (def.type === 'skills') {
        for (const id of def.pool ?? []) assert.ok(SKILL_IDS.includes(id), `${at}: abilità ${id}`);
        assert.ok(['expertise', 'proficiency', 'both'].includes(def.mode), at);
      }
      if (def.when) {
        const parent = defs.find((d) => d.key === def.when.key);
        assert.ok(parent, `${at}: when su chiave inesistente`);
        for (const v of def.when.in) assert.ok(parent.options.some((o) => o.value === v), `${at}: when ${v}`);
      }
      const values = def.options.map((o) => o.value);
      assert.equal(new Set(values).size, values.length, `${at}: opzioni duplicate`);
      if (def.type === 'single' || def.type === 'multi') assert.ok(values.length > 0, at);
      for (const o of def.options) {
        for (const f of o.features) assert.ok(f.level >= 1 && f.level <= 20 && f.name && f.description, `${at}.${o.value}`);
      }
    }
  }
});

test('dati: i valori delle sottoclassi sono unici tra le classi (validazione grezza dello schema)', () => {
  const seen = new Map();
  for (const [classId, defs] of Object.entries(CLASS_CHOICES)) {
    for (const def of defs.filter((d) => d.subclass)) {
      for (const o of def.options) {
        assert.ok(!seen.has(o.value) || seen.get(o.value) === classId, `${o.value} in ${seen.get(o.value)} e ${classId}`);
        seen.set(o.value, classId);
      }
    }
  }
});

test('quantità per livello: tabelle e numeri fissi', () => {
  const enemy = CLASS_CHOICES.ranger.find((d) => d.key === 'favoredEnemy');
  assert.deepEqual([1, 5, 6, 13, 14, 20].map((l) => choiceCount(enemy, l)), [1, 1, 2, 2, 3, 3]);
  const terrain = CLASS_CHOICES.ranger.find((d) => d.key === 'favoredTerrain');
  assert.deepEqual([1, 6, 9, 10].map((l) => choiceCount(terrain, l)), [1, 2, 2, 3]);
  const knowledge = CLASS_CHOICES.cleric.find((d) => d.key === 'domainSkills');
  assert.equal(choiceCount(knowledge, 1), 2);
});

// ------------------------------------------------------------------ stato e validazione

test('stato: default presente e schede vecchie senza classChoices si caricano', () => {
  assert.deepEqual(createDefaultCharacter().info.classChoices, defaultChoiceValues());
  const old = { version: 1, info: { name: 'Vecchio', classId: 'rogue', level: 5 }, abilities: { str: 14 } };
  const state = normalizeCharacter(old);
  assert.equal(state.info.name, 'Vecchio');
  assert.deepEqual(state.info.classChoices, defaultChoiceValues());
  assert.equal(new CharacterModel(old).getDerived().classChoices.length, 1);
});

test('validazione: solo valori della lista, nessun duplicato, scelte di altre classi scartate', () => {
  const state = normalizeCharacter({
    info: {
      classId: 'rogue', level: 6,
      classChoices: {
        expertise: ['stealth', 'stealth', 'nonEsiste', 'thievesTools', 7],
        subclass: 'fiend', fightingStyle: 'defense', favoredEnemy: ['beasts'],
      },
    },
  });
  assert.deepEqual(state.info.classChoices.expertise, ['stealth', 'thievesTools']);
  assert.equal(state.info.classChoices.subclass, '', 'sottoclasse di un\'altra classe');
  assert.equal(state.info.classChoices.fightingStyle, '');
  assert.deepEqual(state.info.classChoices.favoredEnemy, []);
});

test('validazione: il Model rifiuta valori non ammessi e chiavi di altre classi', () => {
  const model = make({ classId: 'cleric' });
  assert.equal(model.set('info.classChoices.subclass', 'fiend'), false);
  assert.equal(model.set('info.classChoices.subclass', 'war'), true);
  assert.equal(model.set('info.classChoices.fightingStyle', 'defense'), false);
  assert.equal(model.get('info.classChoices.subclass'), 'war');
  assert.equal(model.toggleChoice('domainSkills', 'arcana'), false, 'scelta condizionata a un altro dominio');
  assert.equal(model.toggleChoice('nonEsiste', 'x'), false);
});

test('conversione: tipi sbagliati non rompono il caricamento', () => {
  const state = normalizeCharacter({ info: { classId: 'cleric', classChoices: { subclass: 42, domainSkills: 'history' } } });
  assert.equal(state.info.classChoices.subclass, '');
  assert.deepEqual(state.info.classChoices.domainSkills, []);
  assert.deepEqual(normalizeCharacter({ info: { classChoices: 'x' } }).info.classChoices, defaultChoiceValues());
});

// ------------------------------------------------------------------ azzeramenti

test('cambio classe: tutte le scelte si azzerano', () => {
  const model = make({ classId: 'sorcerer' });
  model.set('info.classChoices.subclass', 'draconic');
  model.set('info.classChoices.dragonAncestry', 'red');
  model.set('info.classId', 'cleric');
  assert.deepEqual(model.get('info.classChoices'), defaultChoiceValues());
});

test('cambio sottoclasse: si azzerano le scelte che ne dipendono, non le altre', () => {
  const model = make({ classId: 'sorcerer' });
  model.set('info.classChoices.subclass', 'draconic');
  model.set('info.classChoices.dragonAncestry', 'red');
  model.set('info.classChoices.subclass', 'wild');
  assert.equal(model.get('info.classChoices.dragonAncestry'), '');

  const cleric = make({ classId: 'cleric' });
  cleric.set('info.classChoices.subclass', 'knowledge');
  cleric.toggleChoice('domainSkills', 'arcana');
  cleric.set('info.classChoices.subclass', 'life');
  assert.deepEqual(cleric.get('info.classChoices.domainSkills'), []);
  // un'importazione incoerente (valore dipendente con padre diverso) viene ripulita
  const state = normalizeCharacter({ info: { classId: 'cleric', classChoices: { subclass: 'life', domainSkills: ['arcana'] } } });
  assert.deepEqual(state.info.classChoices.domainSkills, []);
});

test('calo di livello: nulla si cancella, la scelta sotto minLevel è nascosta, gli elementi oltre quota non contano', () => {
  const model = make({ classId: 'ranger', level: 14 });
  for (const e of ['beasts', 'undead', 'dragons']) model.toggleChoice('favoredEnemy', e);
  assert.equal(model.getDerived().classChoices[0].selectedCount, 3);

  model.set('info.level', 6);
  assert.deepEqual(model.get('info.classChoices.favoredEnemy'), ['beasts', 'undead', 'dragons'], 'memorizzati');
  const group = model.getDerived().classChoices.find((g) => g.key === 'favoredEnemy');
  assert.equal(group.selectedCount, 2);
  assert.equal(group.count, 2);
  assert.equal(group.overflow.length, 1, 'segnalati dalla UI');
  assert.equal(model.toggleChoice('favoredEnemy', 'giants'), false, 'quota piena');

  model.set('info.level', 1);
  assert.equal(model.getDerived().classChoices.find((g) => g.key === 'favoredEnemy').selectedCount, 1);
  model.set('info.level', 14);
  assert.equal(model.getDerived().classChoices.find((g) => g.key === 'favoredEnemy').selectedCount, 3, 'tornano a contare');

  const low = make({ classId: 'sorcerer', level: 1 });
  low.set('info.classChoices.subclass', 'draconic');
  low.set('info.level', 1);
  assert.equal(low.getDerived().classChoices.some((g) => g.key === 'dragonAncestry'), true);
});

test('scelte multiple: nessun duplicato, si può togliere sempre, non si supera la quantità', () => {
  const model = make({ classId: 'ranger', level: 1 });
  assert.equal(model.toggleChoice('favoredEnemy', 'beasts'), true);
  assert.equal(model.toggleChoice('favoredEnemy', 'undead'), false, 'quota piena al 1° livello');
  assert.equal(model.toggleChoice('favoredEnemy', 'beasts'), true, 'toggle toglie');
  assert.deepEqual(model.get('info.classChoices.favoredEnemy'), []);
  assert.equal(model.toggleChoice('favoredEnemy', 'xyz'), false);
});

// ------------------------------------------------------------------ effetti

const armorLabels = (model) => model.getDerived().acBreakdown;

test('Stile Difesa: +1 CA solo con armatura, visibile nella scomposizione', () => {
  const model = make({ classId: 'fighter' }, { equipment: { armorId: 'chainMail' } });
  assert.equal(model.getDerived().ac, 16);
  model.set('info.classChoices.fightingStyle', 'defense');
  assert.equal(model.getDerived().ac, 17);
  assert.match(armorLabels(model), /Difesa \+1/);

  model.set('equipment.armorId', 'none');
  assert.equal(model.getDerived().ac, 10, 'senza armatura nessun bonus');

  model.set('info.classChoices.fightingStyle', 'dueling');
  model.set('equipment.armorId', 'chainMail');
  assert.equal(model.getDerived().ac, 16, 'altri stili non cambiano la CA');
});

test('Stile Difesa: calcolo puro della CA', () => {
  const armor = { name: 'Cotta di maglia', category: 'heavy', baseAC: 16 };
  const { total } = computeArmorClass({ armor, hasShield: false, mods: { dex: 3 }, armorBonuses: [{ label: 'Difesa', value: 1 }] });
  assert.equal(total, 17);
});

test('Resilienza Draconica: CA 13 + DES senza armatura, scudo consentito, nessun effetto con armatura', () => {
  const model = make({ classId: 'sorcerer' }, { abilities: { dex: 14 } });
  assert.equal(model.getDerived().ac, 12, 'senza sottoclasse: 10 + 2');
  model.set('info.classChoices.subclass', 'draconic');
  assert.equal(model.getDerived().ac, 15, '13 + 2');
  assert.match(model.getDerived().armor.formula, /13/);
  model.set('equipment.shield', true);
  assert.equal(model.getDerived().ac, 17);
  model.set('equipment.armorId', 'leather');
  assert.equal(model.getDerived().ac, 15, '11 + 2 + scudo 2: la base 13 non si applica con armatura');
  model.set('info.classChoices.subclass', 'wild');
  model.set('equipment.armorId', 'none');
  assert.equal(model.getDerived().ac, 14, 'Magia Selvaggia: 10 + 2 + scudo');
});

test('Resilienza Draconica: +1 PF suggeriti per livello', () => {
  const model = make({ classId: 'sorcerer', level: 5 });
  const base = model.getDerived().hp.suggested;
  model.set('info.classChoices.subclass', 'draconic');
  assert.equal(model.getDerived().hp.suggested, base + 5);
  assert.equal(suggestedMaxHp(6, 3, 0, 1), suggestedMaxHp(6, 3, 0) + 3);
  model.set('info.classChoices.subclass', 'wild');
  assert.equal(model.getDerived().hp.suggested, base, 'Magia Selvaggia non dà PF extra');
});

test('Resilienza Draconica non si somma alla Difesa senza Armatura di classe', () => {
  // Con una sola classe per scheda la sorgente è unica: la definizione di classe ha la precedenza.
  const barbarian = make({ classId: 'barbarian' }, { abilities: { dex: 14, con: 14 } });
  barbarian.set('info.classChoices.subclass', 'draconic'); // rifiutata: non è una scelta del Barbaro
  assert.equal(barbarian.getDerived().ac, 14);
});

test('Maestria del Ladro: solo su abilità competenti, entro il numero consentito', () => {
  const model = make({ classId: 'rogue', level: 1 }, { skills: { stealth: { proficient: true }, perception: { proficient: true }, athletics: { proficient: true } } });
  assert.equal(model.toggleChoice('expertise', 'arcana'), false, 'non competente');
  assert.equal(model.toggleChoice('expertise', 'stealth'), true);
  assert.equal(model.toggleChoice('expertise', 'thievesTools'), true, 'arnesi da scasso, nessun effetto numerico');
  assert.equal(model.toggleChoice('expertise', 'perception'), false, 'oltre 2 al 1° livello');
  // DES 10 → mod 0; competenza +2 raddoppiata = +4
  assert.equal(model.getDerived().skills.stealth, 4);
  assert.equal(model.getDerived().skills.perception, 2);
  assert.equal(model.get('skills.stealth.expertise'), false, 'derivata: lo stato manuale non cambia');

  model.set('info.level', 6);
  assert.equal(model.toggleChoice('expertise', 'perception'), true, '4 al 6° livello');
});

test('Maestria: togliere la competenza toglie la maestria (e la scelta resta memorizzata)', () => {
  const model = make({ classId: 'rogue' }, { skills: { stealth: { proficient: true } } });
  model.toggleChoice('expertise', 'stealth');
  assert.equal(model.getDerived().skills.stealth, 4);
  model.set('skills.stealth.proficient', false);
  assert.equal(model.getDerived().skills.stealth, 0);
  assert.deepEqual(model.get('info.classChoices.expertise'), ['stealth']);
  const group = model.getDerived().classChoices.find((g) => g.key === 'expertise');
  assert.equal(group.selectedCount, 0);
  assert.equal(group.blocked.length, 1);
  model.set('skills.stealth.proficient', true);
  assert.equal(model.getDerived().skills.stealth, 4, 'ripristinata');
});

test('Maestria di classe: le abilità competenti per razza o classe contano', () => {
  const model = make({ classId: 'rogue', raceId: 'elf' });
  assert.equal(model.toggleChoice('expertise', 'perception'), true, 'competenza razziale');
});

test('Dominio della Conoscenza: competenza e Maestria su due abilità (Arcano, Storia, Natura, Religione)', () => {
  const model = make({ classId: 'cleric' }, { abilities: { int: 14 } });
  model.set('info.classChoices.subclass', 'knowledge');
  assert.equal(model.toggleChoice('domainSkills', 'athletics'), false, 'fuori dall\'elenco');
  model.toggleChoice('domainSkills', 'arcana');
  model.toggleChoice('domainSkills', 'history');
  assert.equal(model.toggleChoice('domainSkills', 'religion'), false, 'solo due');
  // INT 14 → +2; competenza +2 raddoppiata = +4 → +6
  assert.equal(model.getDerived().skills.arcana, 6);
  assert.equal(model.getDerived().skills.nature, 2);
  assert.deepEqual(model.getDerived().expertiseFromChoices.sort(), ['arcana', 'history']);
});

test('Dominio della Natura: competenza in una abilità tra tre', () => {
  const model = make({ classId: 'cleric' });
  model.set('info.classChoices.subclass', 'nature');
  assert.equal(model.toggleChoice('natureSkill', 'survival'), true);
  assert.equal(model.toggleChoice('natureSkill', 'nature'), false);
  assert.equal(model.getDerived().skills.survival, 2);
});

// ------------------------------------------------------------------ privilegi

test('privilegi: la sottoclasse scelta sostituisce i privilegi generici, ai livelli giusti', () => {
  const model = make({ classId: 'warlock', level: 6 });
  let names = model.getDerived().features.map((f) => f.name);
  assert.ok(names.includes('Privilegio del Patrono'));
  model.set('info.classChoices.subclass', 'fiend');
  const features = model.getDerived().features;
  names = features.map((f) => f.name);
  assert.ok(!names.includes('Privilegio del Patrono'));
  assert.ok(names.includes('Benedizione dell\'Oscuro'));
  assert.ok(names.includes('Fortuna dell\'Oscuro'));
  assert.ok(!names.includes('Resilienza Immonda'), 'livello 10 non ancora raggiunto');
  assert.equal(features.find((f) => f.name === 'Benedizione dell\'Oscuro').tag, 'Patrono Ultraterreno: Immondo');
  model.set('info.level', 10);
  assert.ok(model.getDerived().features.some((f) => f.name === 'Resilienza Immonda'));
});

test('privilegi: lo Stile scelto sostituisce la riga generica, la Maestria la integra', () => {
  const model = make({ classId: 'fighter' });
  model.set('info.classChoices.fightingStyle', 'defense');
  const row = model.getDerived().features.find((f) => f.level === 1 && f.name.startsWith('Stile'));
  assert.equal(row.name, 'Stile di Combattimento: Difesa');
  assert.equal(model.getDerived().features.filter((f) => f.name === 'Stile di Combattimento').length, 0);

  const rogue = make({ classId: 'rogue' }, { skills: { stealth: { proficient: true } } });
  rogue.toggleChoice('expertise', 'stealth');
  const exp = rogue.getDerived().features.find((f) => f.name === 'Maestria');
  assert.match(exp.description, /Scelte: Furtività/);
});

test('privilegi: nel cleric con dominio ci sono i privilegi di livello 1', () => {
  const model = make({ classId: 'cleric', level: 1 });
  model.set('info.classChoices.subclass', 'life');
  const names = model.getDerived().features.map((f) => f.name);
  assert.ok(names.includes('Discepolo della Vita'));
  assert.ok(!names.includes('Colpo Divino'));
});

test('privilegi: le abilità scelte si aggiungono al privilegio di dominio, senza righe doppie', () => {
  const model = make({ classId: 'cleric' });
  model.set('info.classChoices.subclass', 'knowledge');
  model.toggleChoice('domainSkills', 'arcana');
  const rows = model.getDerived().features.filter((f) => f.name === 'Benedizioni della Conoscenza');
  assert.equal(rows.length, 1);
  assert.match(rows[0].description, /Scelte: Arcano/);
  assert.equal(model.getDerived().features.some((f) => f.name.includes('abilità')), false);
});
