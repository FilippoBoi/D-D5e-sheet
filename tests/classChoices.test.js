import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { CharacterModel } from '../js/model/CharacterModel.js';
import { createDefaultCharacter, normalizeCharacter } from '../js/model/characterSchema.js';
import { CLASS_CHOICES, choiceCount, defaultChoiceValues, isListType } from '../js/data/classChoices/index.js';
import { CLASS_IDS } from '../js/data/classes.js';
import { SKILLS } from '../js/data/skills.js';
import { setLang } from '../js/i18n/i18n.js';
import { computeArmorClass, spellSlotsFor, suggestedMaxHp } from '../js/model/calculations.js';
import { getClassResources } from '../js/data/classResources.js';

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
  assert.equal(new CharacterModel(old).getDerived().classChoices.length, 2, 'Maestria (1°) e Archetipo (3°)');
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

// ------------------------------------------------------------------ fase B: sottoclassi

const subclassDef = (classId) => CLASS_CHOICES[classId].find((d) => d.subclass);

test('sottoclassi: ogni classe ha la sua, al livello giusto, con privilegi a partire da quel livello', () => {
  const expected = {
    barbarian: [3, 2], bard: [3, 2], cleric: [1, 7], druid: [2, 2], fighter: [3, 3], monk: [3, 3],
    paladin: [3, 3], ranger: [3, 2], rogue: [3, 3], sorcerer: [1, 2], warlock: [1, 3], wizard: [2, 8],
  };
  for (const [classId, [minLevel, count]] of Object.entries(expected)) {
    const def = subclassDef(classId);
    assert.ok(def, classId);
    assert.equal(def.minLevel, minLevel, `${classId}: livello`);
    assert.equal(def.options.length, count, `${classId}: numero di sottoclassi`);
    for (const o of def.options) {
      assert.ok(o.features.length >= 3, `${classId}.${o.value}`);
      assert.ok(o.features.every((f) => f.level >= minLevel), `${classId}.${o.value}: privilegio prima della scelta`);
      assert.ok(o.features.some((f) => f.level === minLevel), `${classId}.${o.value}: nessun privilegio al livello di scelta`);
    }
  }
});

test('sottoclassi: la scelta compare solo dal suo livello e nessun privilegio generico resta a livello 20', () => {
  for (const [classId, defs] of Object.entries(CLASS_CHOICES)) {
    const def = defs.find((d) => d.subclass);
    const model = make({ classId, level: def.minLevel - 1 || 1 });
    if (def.minLevel > 1) assert.equal(model.getDerived().classChoices.some((g) => g.key === 'subclass'), false, `${classId} sotto livello`);
    model.set('info.level', 20);
    for (const o of def.options) {
      model.set('info.classChoices.subclass', o.value);
      const features = model.getDerived().features;
      assert.ok(!features.some((f) => /^Privilegio (del|della|dell')/.test(f.name)), `${classId}.${o.value}: generico rimasto`);
      assert.ok(features.some((f) => f.tag), `${classId}.${o.value}: privilegi della sottoclasse`);
    }
  }
});

test('Stile di Combattimento del Paladino e del Ranger dal 2° livello, con Difesa che dà +1 CA', () => {
  for (const [classId, styles] of [['paladin', ['defense', 'dueling', 'greatWeapon', 'protection']], ['ranger', ['archery', 'defense', 'dueling', 'twoWeapon']]]) {
    const model = make({ classId, level: 1 }, { equipment: { armorId: 'chainMail' } });
    assert.equal(model.getDerived().classChoices.some((g) => g.key === 'fightingStyle'), false);
    model.set('info.level', 2);
    const group = model.getDerived().classChoices.find((g) => g.key === 'fightingStyle');
    assert.deepEqual(group.options.map((o) => o.value), styles);
    const before = model.getDerived().ac;
    model.set('info.classChoices.fightingStyle', 'defense');
    assert.equal(model.getDerived().ac, before + 1, classId);
    assert.equal(model.set('info.classChoices.fightingStyle', styles.includes('archery') ? 'greatWeapon' : 'archery'), false, 'stile non ammesso dalla classe');
  }
});

test('incantatori a un terzo: tabella degli slot del PHB', () => {
  const rows = { 2: [], 3: [2], 4: [3], 6: [3], 7: [4, 2], 9: [4, 2], 10: [4, 3], 13: [4, 3, 2], 16: [4, 3, 3], 19: [4, 3, 3, 1], 20: [4, 3, 3, 1] };
  for (const [level, slots] of Object.entries(rows)) {
    assert.deepEqual(spellSlotsFor('third', Number(level)).map((s) => s.max), slots, `livello ${level}`);
  }
});

test('Cavaliere Mistico e Mistificatore Arcano: incantatori a un terzo con INT dal 3° livello', () => {
  for (const [classId, value] of [['fighter', 'eldritchKnight'], ['rogue', 'arcaneTrickster']]) {
    const model = make({ classId, level: 3 }, { abilities: { int: 16 } });
    assert.equal(model.getDerived().spellcasting.isCaster, false, `${classId} senza sottoclasse`);
    model.set('info.classChoices.subclass', value);
    let sp = model.getDerived().spellcasting;
    assert.equal(sp.isCaster, true);
    assert.equal(sp.abilityName, 'Intelligenza');
    assert.equal(sp.dc, 8 + 2 + 3, 'CD = 8 + competenza + INT');
    assert.equal(sp.attack, 2 + 3);
    assert.deepEqual(sp.slots.map((s) => s.max), [2]);
    model.set('info.level', 7);
    assert.deepEqual(model.getDerived().spellcasting.slots.map((s) => s.max), [4, 2]);
    model.set('info.classChoices.subclass', classId === 'fighter' ? 'champion' : 'thief');
    assert.equal(model.getDerived().spellcasting.isCaster, false, 'altra sottoclasse: nessuna magia');
  }
  const low = make({ classId: 'fighter', level: 2 });
  low.set('info.classChoices.subclass', 'eldritchKnight'); // sotto il 3°: la scelta non esiste ancora, ma il valore è accettato
  assert.equal(low.getDerived().spellcasting.isCaster, false);
});

test('Maestro di Battaglia: dadi di superiorità e CD delle manovre', () => {
  const dice = (level, mods) => {
    const model = make({ classId: 'fighter', level }, { abilities: mods });
    model.set('info.classChoices.subclass', 'battleMaster');
    const r = model.getDerived().resources;
    return [r.find((x) => x.label === 'Dadi di superiorità')?.value, r.find((x) => x.label === 'CD delle manovre')?.value];
  };
  assert.deepEqual(dice(3, { str: 16 }), ['4 × d8', String(8 + 2 + 3)]);
  assert.deepEqual(dice(7, { dex: 18, str: 10 }), ['5 × d8', String(8 + 3 + 4)], 'max(FOR, DES)');
  assert.deepEqual(dice(10, {}), ['5 × d10', String(8 + 4 + 0)]);
  assert.deepEqual(dice(6, {}), ['4 × d8', String(8 + 3)], 'ancora 4 dadi al 6°');
  assert.deepEqual(dice(14, {}), ['5 × d10', String(8 + 5)], 'ancora 5 dadi al 14°');
  assert.deepEqual(dice(15, {}), ['6 × d10', String(8 + 5)]);
  assert.deepEqual(dice(17, {}), ['6 × d10', String(8 + 6)], 'd10 fino al 17°');
  assert.deepEqual(dice(18, {}), ['6 × d12', String(8 + 6)]);
  const champion = make({ classId: 'fighter', level: 10 });
  champion.set('info.classChoices.subclass', 'champion');
  assert.equal(champion.getDerived().resources.some((x) => x.label === 'Dadi di superiorità'), false);
  assert.equal(make({ classId: 'fighter', level: 2 }).getDerived().resources.some((x) => x.label === 'Dadi di superiorità'), false);
  assert.deepEqual(getClassResources('fighter', 3, { str: 0, dex: 0 }).map((r) => r.label).includes('Dadi di superiorità'), false, 'senza contesto non compare');
});

test('Circolo della Luna: GS massimo della Forma Selvatica', () => {
  const cr = (level, subclass) => {
    const model = make({ classId: 'druid', level });
    if (subclass) model.set('info.classChoices.subclass', subclass);
    return model.getDerived().resources.find((r) => r.label === 'Forma Selvatica').value;
  };
  assert.match(cr(2, 'moon'), /GS max 1$/);
  assert.match(cr(5, 'moon'), /GS max 1$/);
  assert.match(cr(6, 'moon'), /GS max 2$/);
  assert.match(cr(11, 'moon'), /GS max 3$/);
  assert.match(cr(18, 'moon'), /GS max 6$/);
  assert.match(cr(8, 'land'), /GS max 1$/, 'Terra: tabella normale');
  assert.match(cr(2, null), /GS max 1\/4$/);
});

test('Sapienza: tre abilità a scelta diventano competenze', () => {
  const model = make({ classId: 'bard', level: 3 });
  assert.equal(model.getDerived().classChoices.some((g) => g.key === 'loreSkills'), false);
  model.set('info.classChoices.subclass', 'lore');
  for (const s of ['arcana', 'history', 'stealth']) assert.equal(model.toggleChoice('loreSkills', s), true);
  assert.equal(model.toggleChoice('loreSkills', 'nature'), false, 'solo tre');
  assert.equal(model.getDerived().skills.stealth, 2, 'competenza +2');
  assert.equal(model.getDerived().skills.nature, 1, 'Factotum: metà competenza');
  model.set('info.classChoices.subclass', 'valor');
  assert.deepEqual(model.get('info.classChoices.loreSkills'), [], 'cambiando collegio si azzerano');
  assert.equal(model.getDerived().skills.stealth, 1);
});

test('Circolo della Terra: il terreno esiste solo per la Terra e si azzera cambiando circolo', () => {
  const model = make({ classId: 'druid', level: 2 });
  assert.equal(model.getDerived().classChoices.some((g) => g.key === 'landTerrain'), false);
  model.set('info.classChoices.subclass', 'land');
  assert.equal(model.set('info.classChoices.landTerrain', 'underdark'), true);
  assert.equal(model.set('info.classChoices.landTerrain', 'volcano'), false);
  const row = model.getDerived().features.find((f) => f.name === 'Incantesimi del Circolo');
  assert.match(row.description, /Scelta: Sottosuolo/);
  model.set('info.classChoices.subclass', 'moon');
  assert.equal(model.get('info.classChoices.landTerrain'), '');
});

test('cambiare sottoclasse non tocca le scelte indipendenti (stile di combattimento)', () => {
  const model = make({ classId: 'fighter', level: 3 });
  model.set('info.classChoices.fightingStyle', 'defense');
  model.set('info.classChoices.subclass', 'battleMaster');
  model.set('info.classChoices.subclass', 'champion');
  assert.equal(model.get('info.classChoices.fightingStyle'), 'defense');
});
