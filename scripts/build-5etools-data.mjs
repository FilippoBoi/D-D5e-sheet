#!/usr/bin/env node
/**
 * Genera i dati degli altri manuali a partire da 5e.tools (dati 2014, mirror su GitHub).
 *
 *   node scripts/build-5etools-data.mjs [--src <cartella con i JSON già scaricati>]
 *
 * Scrive js/data/generated/{races,backgrounds,subclasses}.js. Si esegue a mano quando si vuole
 * aggiornare i dati; i file generati sono versionati, quindi l'app e i test non hanno bisogno di rete.
 *
 * Per scelta NON si copia il testo dei manuali: si estraggono solo dati strutturati (velocità,
 * bonus, competenze, nomi dei tratti e dei privilegi, livelli) e, per ogni privilegio, il rimando
 * "Vedi SIGLA, p. N". Le descrizioni sintetiche si scrivono a mano, come per il PHB.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CORE_SOURCE, SOURCE_IDS } from '../js/data/sources.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'js/data/generated');
const BASE = 'https://raw.githubusercontent.com/5etools-mirror-3/5etools-2014-src/main/data';
const srcDir = process.argv.includes('--src') ? process.argv[process.argv.indexOf('--src') + 1] : null;
const CLASSES = ['barbarian', 'bard', 'cleric', 'druid', 'fighter', 'monk', 'paladin', 'ranger', 'rogue', 'sorcerer', 'warlock', 'wizard'];

async function load(file) {
  if (srcDir) return JSON.parse(readFileSync(join(srcDir, file.split('/').pop())));
  const res = await fetch(`${BASE}/${file}`);
  if (!res.ok) throw new Error(`${file}: ${res.status}`);
  return res.json();
}

const allowed = new Set(SOURCE_IDS);
const slug = (text) => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const clean = (text) => String(text).replace(/\{@\w+ ([^}|]*)[^}]*\}/g, '$1').replace(/\s+/g, ' ').trim();
const camel = (text) => text.replace(/ (\w)/g, (_, c) => c.toUpperCase());
const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** Risolve `_copy` in modo semplice: i campi dell'originale, sovrascritti da quelli propri. */
const resolveCopies = (items) => items.map((item) => {
  if (!item._copy) return item;
  const base = items.find((x) => x.name === item._copy.name && x.source === item._copy.source);
  const { _copy, _mod, ...own } = item;
  return { ...(base ?? {}), ...own };
});

// ----------------------------------------------------------------- Razze
const LANG_IT = {
  common: 'Comune', dwarvish: 'Nanico', elvish: 'Elfico', giant: 'Gigante', gnomish: 'Gnomico', goblin: 'Goblin',
  halfling: 'Halfling', orc: 'Orchesco', abyssal: 'Abissale', celestial: 'Celestiale', draconic: 'Draconico',
  'deep speech': 'Gergo delle Profondità', infernal: 'Infernale', primordial: 'Primordiale', sylvan: 'Silvano',
  undercommon: 'Sottocomune', auran: 'Aurano', aquan: 'Aquano', ignan: 'Ignano', terran: 'Terrano',
};
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const NAME_IT = {
  Dwarf: 'Nano', Elf: 'Elfo', Gnome: 'Gnomo', Halfling: 'Halfling', Human: 'Umano', Dragonborn: 'Dragonide',
  'Half-Elf': 'Mezzelfo', 'Half-Orc': 'Mezzorco', Tiefling: 'Tiefling',
  'Hill Dwarf': 'Nano delle Colline', 'Mountain Dwarf': 'Nano delle Montagne', 'High Elf': 'Elfo Alto',
  'Wood Elf': 'Elfo dei Boschi', 'Dark Elf (Drow)': 'Elfo Oscuro (Drow)', Lightfoot: 'Piedelesto', Stout: 'Tozzo',
  'Forest Gnome': 'Gnomo delle Foreste', 'Rock Gnome': 'Gnomo delle Rocce',
};
/** Nomi dei sottotipi del PHB, per id: [italiano, inglese]. */
const PHB_SUBRACES = {
  'phb-dwarf-hill': ['Nano delle Colline', 'Hill Dwarf'], 'phb-dwarf-mountain': ['Nano delle Montagne', 'Mountain Dwarf'],
  'phb-elf-high': ['Elfo Alto', 'High Elf'], 'phb-elf-wood': ['Elfo dei Boschi', 'Wood Elf'],
  'phb-elf-drow': ['Elfo Oscuro (Drow)', 'Dark Elf (Drow)'], 'phb-halfling-lightfoot': ['Halfling Piedelesto', 'Lightfoot Halfling'],
  'phb-halfling-stout': ['Halfling Tozzo', 'Stout Halfling'], 'phb-gnome-forest': ['Gnomo delle Foreste', 'Forest Gnome'],
  'phb-gnome-rock': ['Gnomo delle Rocce', 'Rock Gnome'], 'phb-human-variant': ['Umano Variante', 'Variant Human'],
};
const SKIP_TRAITS = /^(ability score increase|age|alignment|size|speed|languages?|darkvision)$/i;

function languages(profs) {
  const out = []; const outEn = [];
  for (const p of profs ?? []) {
    for (const [key, value] of Object.entries(p)) {
      if (value === true && LANG_IT[key]) { out.push(LANG_IT[key]); outEn.push(cap(key)); }
      else if (key === 'anyStandard' || key === 'any') {
        out.push(value === 1 ? 'una lingua a scelta' : `${value} lingue a scelta`);
        outEn.push(value === 1 ? 'one language of your choice' : `${value} languages of your choice`);
      } else if (key === 'other' || key === 'choose') { out.push('una lingua a scelta'); outEn.push('one language of your choice'); }
    }
  }
  return { it: out.join(', '), en: outEn.join(', ') };
}

function abilityData(list) {
  const bonuses = {}; let choice = null;
  for (const entry of list ?? []) {
    for (const [key, value] of Object.entries(entry)) {
      if (ABILITIES.includes(key)) bonuses[key] = (bonuses[key] ?? 0) + value;
      else if (key === 'choose' && value.from && !choice) {
        choice = { count: value.count ?? 1, bonus: value.amount ?? 1, exclude: ABILITIES.filter((a) => !value.from.includes(a)) };
      }
      // `choose.weighted` (MPMM): bonus liberi non rappresentabili → nessun effetto automatico
    }
    break; // si usa solo la prima alternativa
  }
  return { bonuses, choice };
}

const skillsOf = (profs) => Object.entries(profs?.[0] ?? {}).filter(([, v]) => v === true).map(([k]) => camel(k));

function buildRace(race, sub) {
  const merged = { ...race, ...(sub ?? {}) };
  const ab = abilityData(sub?.ability ? [...race.ability ?? [], ...sub.ability].reduce((acc, e) => [{ ...(acc[0] ?? {}), ...e }], []) : race.ability);
  if (sub?.ability && race.ability) {
    // somma delle alternative fisse di razza e sottorazza
    const total = {};
    for (const e of [race.ability[0] ?? {}, sub.ability[0] ?? {}]) for (const [k, v] of Object.entries(e)) if (ABILITIES.includes(k)) total[k] = (total[k] ?? 0) + v;
    ab.bonuses = total;
    ab.choice = abilityData(sub.ability).choice ?? abilityData(race.ability).choice;
  }
  const speed = typeof merged.speed === 'number' ? merged.speed : merged.speed?.walk ?? 30;
  const langs = languages(sub?.languageProficiencies ?? race.languageProficiencies);
  const names = new Map();
  for (const e of [...(race.entries ?? []), ...(sub?.entries ?? [])]) {
    const n = e?.name && clean(e.name);
    if (n && e.type === 'entries' && !SKIP_TRAITS.test(n)) names.set(n, true);
  }
  const traits = [...names.keys()].join(', ');
  const full = sub && sub.name.includes(race.name);
  const nameEn = !sub ? race.name : full ? sub.name : `${race.name} (${sub.name})`;
  const nameIt = !sub ? (NAME_IT[race.name] ?? race.name)
    : NAME_IT[sub.name] ?? (full ? sub.name : `${NAME_IT[race.name] ?? race.name} (${sub.name})`);
  const out = {
    id: `${(sub ?? race).source.toLowerCase()}-${slug(nameEn)}`,
    name: nameIt, nameEn,
    source: (sub ?? race).source, page: (sub ?? race).page ?? race.page ?? null,
    speedFt: speed, darkvisionFt: typeof merged.darkvision === 'number' ? merged.darkvision : 0,
    abilityBonuses: ab.bonuses, skills: skillsOf(sub?.skillProficiencies ?? race.skillProficiencies),
    languages: langs.it, languagesEn: langs.en, traits, traitsEn: traits,
  };
  if (ab.choice) out.abilityChoice = ab.choice;
  const known = PHB_SUBRACES[out.id];
  if (known) [out.name, out.nameEn] = known;
  return out;
}

async function races() {
  const data = await load('races.json');
  const baseRaces = resolveCopies(data.race);
  const out = [];
  for (const race of baseRaces) {
    if (race.source !== CORE_SOURCE && allowed.has(race.source) && !race.name.startsWith('Custom')) out.push(buildRace(race));
  }
  for (const sub of data.subrace ?? []) {
    if (!sub.name || sub.name.includes(';') || !allowed.has(sub.source)) continue; // «Variant; …»: varianti che duplicano i bonus della razza
    const race = baseRaces.find((r) => r.name === sub.raceName && r.source === sub.raceSource);
    if (race) out.push(buildRace(race, sub));
  }
  return dedupe(out);
}

/** Ids unici e nessun duplicato identico. */
function dedupe(list) {
  const seen = new Set();
  return list.filter((x) => (seen.has(x.id) ? false : seen.add(x.id)));
}

// ----------------------------------------------------------- Background
const listText = (obj) => Object.entries(obj ?? {}).filter(([, v]) => v === true || typeof v === 'number')
  .map(([k, v]) => (typeof v === 'number' ? `${v} ${k}` : cap(k))).join(', ');

async function backgrounds() {
  const data = await load('backgrounds.json');
  const out = [];
  for (const bg of resolveCopies(data.background)) {
    if (bg.source === CORE_SOURCE || !allowed.has(bg.source)) continue;
    const list = bg.entries?.find((e) => e.type === 'list')?.items ?? [];
    const equipment = clean(list.find((i) => /^Equipment/i.test(i.name ?? ''))?.entry ?? '');
    const feature = bg.entries?.find((e) => /^Feature:/i.test(e.name ?? ''))?.name?.replace(/^Feature:\s*/i, '') ?? '';
    const langs = languages(bg.languageProficiencies);
    const tools = listText(bg.toolProficiencies?.[0]);
    out.push({
      id: `${bg.source.toLowerCase()}-${slug(bg.name)}`, name: bg.name, nameEn: bg.name,
      source: bg.source, page: bg.page ?? null, skills: skillsOf(bg.skillProficiencies),
      tools, toolsEn: tools, languages: langs.it, languagesEn: langs.en,
      equipment, equipmentEn: equipment, feature: clean(feature), featureEn: clean(feature),
    });
  }
  return dedupe(out);
}

// ----------------------------------------------------------- Sottoclassi
async function subclasses() {
  const out = {};
  for (const classId of CLASSES) {
    const data = await load(`class/class-${classId}.json`);
    const pages = new Map(data.subclassFeature.map((f) => [`${f.name}|${f.subclassShortName}|${f.level}`, f.page]));
    out[classId] = data.subclass.filter((s) => s.source !== CORE_SOURCE && allowed.has(s.source)).map((s) => {
      const seen = new Set();
      const features = [];
      for (const ref of s.subclassFeatures ?? []) {
        const [name, , , , , level] = ref.split('|');
        const key = `${level}|${name}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const page = pages.get(`${name}|${s.shortName}|${level}`) ?? s.page;
        const cleanName = clean(name);
        features.push([Number(level), cleanName, `Vedi ${s.source}, p. ${page}.`, cleanName, `See ${s.source}, p. ${page}.`]);
      }
      features.sort((a, b) => a[0] - b[0]);
      return {
        value: `${s.source.toLowerCase()}-${slug(s.shortName ?? s.name)}`, label: s.name, labelEn: s.name,
        source: s.source, description: `Fonte: ${s.source}, p. ${s.page}.`, descriptionEn: `Source: ${s.source}, p. ${s.page}.`, features,
      };
    });
  }
  return out;
}

const write = (file, doc, name, value) => {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, file), `/**\n * ${doc}\n * GENERATO da scripts/build-5etools-data.mjs (dati 5e.tools): non modificare a mano.\n */\nexport const ${name} = ${JSON.stringify(value, null, 1)};\n`);
};

write('races.js', 'Razze e sottorazze degli altri manuali.', 'EXTRA_RACES', await races());
write('backgrounds.js', 'Background degli altri manuali.', 'EXTRA_BACKGROUNDS', await backgrounds());
write('subclasses.js', 'Sottoclassi degli altri manuali, per classe.', 'EXTRA_SUBCLASSES', await subclasses());
console.log('ok');
