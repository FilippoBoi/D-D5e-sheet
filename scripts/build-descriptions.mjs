#!/usr/bin/env node
/**
 * Genera i moduli con le descrizioni (italiano + inglese) a partire dai file Markdown in docs/:
 *
 *   docs/skills-description.md   → js/data/generated/skillDescriptions.js   (18 abilità, caricato subito)
 *   docs/cantrips-description.md ┐
 *   docs/spell-descriptions.md   ┴→ js/data/generated/spellDescriptions.js  (caricato solo alla prima apertura)
 *
 * I Markdown restano la fonte da correggere; i moduli generati sono versionati, così l'app e i test
 * non hanno bisogno di build. Ogni titolo viene legato all'elemento del catalogo tramite il nome
 * inglese: se un titolo non corrisponde a nessuna voce lo script si ferma con un errore.
 *
 * Uso: npm run descriptions
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SKILLS } from '../js/data/skills.js';
import { SPELL_LIST } from '../js/data/spells.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFileSync(join(ROOT, 'docs', file), 'utf8');
/** Bandiera che apre il blocco di ogni lingua nei Markdown; per una nuova lingua basta aggiungerla qui (e in i18n.js). */
const FLAGS = { it: '🇮🇹', en: '🇬🇧' };
const LANGS = Object.keys(FLAGS);
const fail = (message) => { throw new Error(message); };

/** Separa il contenuto di un'entry in blocchi di testo, togliendo i separatori `---`. */
const trimBlock = (lines) => lines.join('\n').replace(/\n---\s*$/, '').trim();

/** «Etichetta / Label: it / en» → [it, en]. Il separatore " / " dei valori è l'ultimo della riga. */
function bilingualLine(line) {
  const m = /^- \*\*[^*]+\*\*\s*(.*)$/.exec(line);
  if (!m) return null;
  const parts = m[1].split(' / ');
  if (parts.length === 1) return [parts[0], parts[0]];
  if (parts.length !== 2) fail(`Riga non separabile in due lingue: ${line}`);
  return parts;
}

const LINE_KEYS = { 'Tempo di lancio': 'time', Gittata: 'range', Componenti: 'comp', Durata: 'dur' };

/** Un'entry di incantesimo o trucchetto (da `### Titolo` fino al prossimo titolo). */
function parseSpellEntry(heading, body) {
  const titleParts = heading.split(' / ');
  const nameEn = titleParts[titleParts.length - 1].trim();
  const spell = SPELL_LIST.find((s) => s.nameEn === nameEn) ?? fail(`Nessun incantesimo chiamato «${nameEn}»`);

  const meta = body.find((line) => line.startsWith('*') && !line.startsWith('**')) ?? '';
  const srd = /\*SRD 5\.1\*/.test(meta);
  const lines = {};
  for (const line of body) {
    const key = LINE_KEYS[/^- \*\*([^/*]+?)\s*\//.exec(line)?.[1]];
    if (key) lines[key] = bilingualLine(line);
  }
  const starts = LANGS.map((lang) => body.indexOf(`**${FLAGS[lang]}**`));
  if (starts.some((at, i) => at < 0 || (i && at < starts[i - 1]))) fail(`${nameEn}: blocchi ${LANGS.map((l) => FLAGS[l]).join('/')} mancanti o in ordine diverso`);
  const texts = Object.fromEntries(LANGS.map((lang, i) => [lang, trimBlock(body.slice(starts[i] + 1, starts[i + 1] ?? body.length))]));
  if (LANGS.some((lang) => !texts[lang])) fail(`${nameEn}: testo vuoto`);

  // Si tiene solo ciò che i codici del catalogo non dicono (la condizione di una reazione, i
  // materiali); il resto lo ricava l'app dal catalogo, anche per la concentrazione.
  const out = { ...texts };
  if (!srd) out.sum = 1;
  if (lines.time && (lines.time[0].includes(',') || lines.time[1].includes(','))) out.time = lines.time;
  if (lines.comp && /\(/.test(lines.comp[0])) out.mat = lines.comp[0].replace(/^[^(]*/, '').trim();
  return [spell.id, out];
}

function parseSpells(file) {
  const result = {};
  const sections = read(file).split(/^### /m).slice(1);
  for (const section of sections) {
    const [heading, ...body] = section.split('\n');
    const [id, entry] = parseSpellEntry(heading.trim(), body);
    if (result[id]) fail(`Incantesimo duplicato: ${id}`);
    result[id] = entry;
  }
  return result;
}

function parseSkills() {
  const result = {};
  const sections = read('skills-description.md').split(/^## /m).slice(1);
  for (const section of sections) {
    const [heading, ...body] = section.split('\n');
    const nameEn = heading.split(' / ').pop().trim();
    const skill = SKILLS.find((s) => s.nameEn === nameEn);
    if (!skill) continue; // «Indice / Index»
    const starts = LANGS.map((lang) => body.findIndex((l) => l.startsWith(`### ${FLAGS[lang]}`)));
    if (starts.some((at, i) => at < 0 || (i && at < starts[i - 1]))) fail(`${nameEn}: sezioni mancanti o in ordine diverso`);
    const itAt = starts[0];
    const meta = body.slice(0, itAt).join(' ');
    const page = /PHB p\. (\d+)/.exec(meta)?.[1];
    const out = Object.fromEntries(LANGS.map((lang, i) => [lang, trimBlock(body.slice(starts[i] + 1, starts[i + 1] ?? body.length))]));
    if (page) out.page = Number(page);
    if (!/\*SRD 5\.1\*/.test(meta)) out.sum = 1;
    result[skill.id] = out;
  }
  const missing = SKILLS.filter((s) => !result[s.id]).map((s) => s.id);
  if (missing.length) fail(`Abilità senza descrizione: ${missing.join(', ')}`);
  return result;
}

const stringify = (value) => JSON.stringify(value, null, 1);
const header = (what, source) => `/**
 * ${what}
 * GENERATO da scripts/build-descriptions.mjs (npm run descriptions) a partire da ${source}: non modificare a mano.
 * Testi SRD 5.1 © Wizards of the Coast LLC, CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/legalcode),
 * con traduzione italiana non ufficiale; \`sum: 1\` = riassunto originale (elemento fuori dall'SRD).
 */
`;

const skills = parseSkills();
writeFileSync(join(ROOT, 'js/data/generated/skillDescriptions.js'),
  `${header('Descrizioni delle 18 abilità, per id (vedi data/skills.js).', 'docs/skills-description.md')}export const SKILL_TEXT = ${stringify(skills)};\n`);

const spells = { ...parseSpells('cantrips-description.md'), ...parseSpells('spell-descriptions.md') };
const missing = SPELL_LIST.filter((s) => !spells[s.id]).map((s) => s.id);
if (missing.length) fail(`Incantesimi senza descrizione: ${missing.join(', ')}`);
writeFileSync(join(ROOT, 'js/data/generated/spellDescriptions.js'),
  `${header('Descrizioni di trucchetti e incantesimi, per id (vedi data/spells.js).', 'docs/cantrips-description.md e docs/spell-descriptions.md')}export const SPELL_TEXT = ${stringify(spells)};\n`);

console.log(`Abilità: ${Object.keys(skills).length} · incantesimi e trucchetti: ${Object.keys(spells).length}`);
