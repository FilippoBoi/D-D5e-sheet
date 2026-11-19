/**
 * Forma dello stato del personaggio, valori di default e validazione.
 *
 * Ogni valore che entra nel Model (da un input, da localStorage o da un
 * file JSON importato) passa da `sanitizeValue`, quindi lo stato rimane
 * sempre coerente anche con dati vecchi o manomessi.
 */
import { ABILITY_IDS } from '../data/abilities.js';
import { ARMOR_IDS } from '../data/armors.js';
import { CLASS_IDS, DEFAULT_CLASS_ID, getClass } from '../data/classes.js';
import { NO_RACE_ID, RACE_IDS } from '../data/races.js';
import { allowedValuesForKey, defaultChoiceValues, MAX_CHOICE_TEXT } from '../data/classChoices/index.js';
import { BACKGROUND_IDS, NO_BACKGROUND_ID } from '../data/backgrounds.js';
import { SKILLS } from '../data/skills.js';
import { normalizeClassChoices } from './classChoices.js';
import { RESOURCE_IDS } from '../data/classResources.js';
import { RACE_RESOURCE_IDS } from '../data/raceTraits.js';
import { LANGUAGE_IDS, MAX_LANGUAGE_PICKS } from '../data/languages.js';
import { MAX_CANTRIPS, MAX_SPELLS, getSpell } from '../data/spells.js';
const SKILL_IDS = SKILLS.map((s) => s.id);
import { clamp, clampInt, isPlainObject } from '../core/utils.js';

export const SCHEMA_VERSION = 1;
export const MAX_WEAPONS = 30;
const MAX_TEXT_LENGTH = 20_000;
const WEAPON_ABILITIES = ['str', 'dex'];

/** Id univoco: randomUUID dove disponibile (contesti sicuri), altrimenti fallback. */
function createId() {
  return globalThis.crypto?.randomUUID?.()
    ?? `w-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Competenze nei tiri salvezza concesse da una classe. */
export function classSaveProficiencies(classId) {
  const { saves } = getClass(classId);
  return Object.fromEntries(ABILITY_IDS.map((id) => [id, saves.includes(id)]));
}

export function createWeapon() {
  return {
    id: createId(),
    name: '',
    ability: 'str',
    proficient: true,
    magicBonus: 0,
    damage: '1d8',
    damageType: '',
  };
}

export const MAX_AC_ITEMS = 10;
export const MAX_NOTES = 100;
const MAX_NOTE_TITLE = 80;

/** Nota libera con titolo (sessioni, PNG, luoghi, to-do…). Le note predefinite restano in notes.traits e notes.backstory. */
export function createNote() {
  return { id: createId(), title: '', text: '' };
}

function normalizeNote(raw, index, usedIds) {
  const note = createNote();
  if (!isPlainObject(raw)) return note;
  note.title = sanitizeValue(`notes.items.${index}.title`, raw.title, note.title);
  note.text = sanitizeValue(`notes.items.${index}.text`, raw.text, note.text);
  if (typeof raw.id === 'string' && raw.id.length > 0 && raw.id.length <= 64 && !usedIds.has(raw.id)) note.id = raw.id;
  usedIds.add(note.id);
  return note;
}

export function createAcItem() {
  return { id: createId(), name: '', bonus: 0 };
}

/** Un oggetto che modifica la CA: nome e bonus, validati come gli altri campi. */
function normalizeAcItem(raw, index) {
  const item = createAcItem();
  if (!isPlainObject(raw)) return item;
  item.name = sanitizeValue(`equipment.acItems.${index}.name`, raw.name, item.name);
  item.bonus = sanitizeValue(`equipment.acItems.${index}.bonus`, raw.bonus, item.bonus);
  return item;
}

export function createDefaultCharacter() {
  return {
    version: SCHEMA_VERSION,
    info: {
      name: '', player: '', raceId: NO_RACE_ID, background: '', backgroundId: NO_BACKGROUND_ID, alignment: '',
      classId: DEFAULT_CLASS_ID, level: 1,
      raceChoices: { ability1: '', ability2: '', skill1: '', skill2: '', option: '' },
      classChoices: defaultChoiceValues(),
    },
    classSkills: { skill1: '', skill2: '', skill3: '', skill4: '' },
    abilities: Object.fromEntries(ABILITY_IDS.map((id) => [id, 10])),
    saveProficiencies: classSaveProficiencies(DEFAULT_CLASS_ID),
    skills: Object.fromEntries(SKILLS.map((s) => [s.id, { proficient: false, expertise: false }])),
    combat: {
      speed: 9, hpMax: 10, hpCurrent: 10, hpTemp: 0,
      deathSuccesses: 0, deathFailures: 0,
      // Dadi vita spesi (tornano per metà, minimo 1, col riposo lungo) e incantesimo in concentrazione ('' = nessuno).
      hitDiceUsed: 0, concentration: '',
    },
    equipment: {
      armorId: 'none', shield: false, magicBonus: 0, inventory: '',
      acItems: [],
      coins: { mr: 0, ma: 0, me: 0, mo: 0, mp: 0 },
    },
    weapons: [],
    // Usi già spesi delle risorse a riposo (Ire, Ki, Azione Impetuosa...): si azzerano coi riposi.
    resourcesUsed: Object.fromEntries([...RESOURCE_IDS, ...RACE_RESOURCE_IDS].map((id) => [id, 0])),
    spells: {
      // Elenchi scelti dal catalogo (id di data/spells.js); i due testi liberi restano per ciò che non è in elenco.
      cantripIds: [], spellIds: [],
      cantrips: '', prepared: '',
      slotsUsed: Object.fromEntries(Array.from({ length: 9 }, (_, i) => [String(i + 1), 0])),
    },
    // Lingue a scelta (razza, background) e altre conosciute: il resto si ricava da razza, background e classe.
    languages: {
      ...Object.fromEntries(Array.from({ length: MAX_LANGUAGE_PICKS }, (_, i) => [`pick${i + 1}`, ''])),
      other: '',
    },
    notes: { traits: '', backstory: '', items: [] },
  };
}

/**
 * Regole specifiche per percorso, applicate dopo la conversione di tipo.
 * Una regola che restituisce `undefined` rifiuta il valore.
 */
const RULES = [
  [/^info\.level$/, (v) => clampInt(v, 1, 20)],
  [/^info\.classId$/, (v) => (CLASS_IDS.includes(v) ? v : undefined)],
  [/^info\.backgroundId$/, (v) => (v === NO_BACKGROUND_ID || BACKGROUND_IDS.includes(v) ? v : undefined)],
  [/^info\.raceId$/, (v) => (v === NO_RACE_ID || RACE_IDS.includes(v) ? v : undefined)],
  [/^info\.raceChoices\.ability\d$/, (v) => (v === '' || ABILITY_IDS.includes(v) ? v : undefined)],
  [/^(info\.raceChoices|classSkills)\.skill\d$/, (v) => (v === '' || SKILL_IDS.includes(v) ? v : undefined)],
  [/^info\.raceChoices\.option$/, (v) => v.slice(0, 40)],
  // Scelte di classe singole/di testo: solo valori noti (la coerenza con la classe attuale la verifica il Model).
  [/^info\.classChoices\.(\w+)$/, (v, path) => {
    const allowed = allowedValuesForKey(path.split('.').pop());
    return allowed.size === 0 ? v.slice(0, MAX_CHOICE_TEXT) : (v === '' || allowed.has(v) ? v : undefined);
  }],
  [/^equipment\.acItems\.\d+\.name$/, (v) => v.slice(0, 80)],
  [/^equipment\.acItems\.\d+\.bonus$/, (v) => clampInt(v, -5, 10)],
  [/^notes\.items\.\d+\.title$/, (v) => v.slice(0, MAX_NOTE_TITLE)],
  [/^abilities\.\w+$/, (v) => clampInt(v, 1, 30)],
  [/^combat\.hpMax$/, (v) => clampInt(v, 1, 999)],
  [/^combat\.(hpCurrent|hpTemp)$/, (v) => clampInt(v, 0, 999)],
  [/^combat\.speed$/, (v) => clamp(Math.round(v * 2) / 2, 0, 99)],
  [/^combat\.death(Successes|Failures)$/, (v) => clampInt(v, 0, 3)],
  [/^combat\.hitDiceUsed$/, (v) => clampInt(v, 0, 20)],
  [/^combat\.concentration$/, (v) => v.slice(0, 80)],
  [/^equipment\.armorId$/, (v) => (ARMOR_IDS.includes(v) ? v : undefined)],
  [/^(equipment|weapons\.\d+)\.magicBonus$/, (v) => clampInt(v, -5, 10)],
  [/^weapons\.\d+\.ability$/, (v) => (WEAPON_ABILITIES.includes(v) ? v : undefined)],
  [/^weapons\.\d+\.(name|damage|damageType)$/, (v) => v.slice(0, 80)],
  [/^languages\.pick\d$/, (v) => (v === '' || LANGUAGE_IDS.includes(v) ? v : undefined)],
  [/^languages\.other$/, (v) => v.slice(0, 200)],
  [/^resourcesUsed\.\w+$/, (v) => clampInt(v, 0, 999)],
  [/^spells\.slotsUsed\.\d$/, (v) => clampInt(v, 0, 9)],
  [/^equipment\.coins\.\w+$/, (v) => clampInt(v, 0, 9_999_999)],
];

/** Converte `raw` nello stesso tipo del valore attuale; undefined se impossibile. */
function coerceToType(raw, current) {
  switch (typeof current) {
    case 'number': {
      const n = typeof raw === 'number' ? raw : Number.parseFloat(String(raw).replace(',', '.'));
      return Number.isFinite(n) ? n : undefined;
    }
    case 'boolean':
      return typeof raw === 'boolean' ? raw : raw === 'true' || raw === 1;
    case 'string':
      return typeof raw === 'string' || typeof raw === 'number'
        ? String(raw).slice(0, MAX_TEXT_LENGTH)
        : undefined;
    default:
      return undefined;
  }
}

/**
 * Restituisce un valore valido per `path`, oppure `current` se `raw` non è accettabile.
 * @param {string} path
 * @param {unknown} raw
 * @param {unknown} current
 */
export function sanitizeValue(path, raw, current) {
  const value = coerceToType(raw, current);
  if (value === undefined) return current;
  const rule = RULES.find(([pattern]) => pattern.test(path));
  if (!rule) return value;
  const result = rule[1](value, path);
  return result === undefined ? current : result;
}

/** Copia nel target solo le chiavi che esistono già nei default (niente chiavi estranee). */
function mergeKnownKeys(target, source, prefix = '') {
  for (const key of Object.keys(target)) {
    if (!Object.hasOwn(source, key)) continue;
    const path = prefix ? `${prefix}.${key}` : key;
    const current = target[key];
    if (Array.isArray(current)) continue; // gli array sono gestiti a parte
    if (isPlainObject(current)) {
      if (isPlainObject(source[key])) mergeKnownKeys(current, source[key], path);
      continue;
    }
    target[key] = sanitizeValue(path, source[key], current);
  }
  return target;
}

function normalizeWeapon(raw, index, usedIds) {
  const weapon = createWeapon();
  if (!isPlainObject(raw)) return weapon;
  for (const key of Object.keys(weapon)) {
    if (key === 'id' || !Object.hasOwn(raw, key)) continue;
    weapon[key] = sanitizeValue(`weapons.${index}.${key}`, raw[key], weapon[key]);
  }
  if (typeof raw.id === 'string' && raw.id.length <= 64 && !usedIds.has(raw.id)) weapon.id = raw.id;
  usedIds.add(weapon.id);
  return weapon;
}

/** Id di incantesimi validi: noti, del livello giusto (trucchetto o no), senza duplicati. */
function normalizeSpellIds(raw, cantrips) {
  if (!Array.isArray(raw)) return [];
  const valid = raw.filter((id) => {
    const spell = typeof id === 'string' ? getSpell(id) : undefined;
    return spell && (spell.level === 0) === cantrips;
  });
  return [...new Set(valid)].slice(0, cantrips ? MAX_CANTRIPS : MAX_SPELLS);
}

/**
 * Costruisce uno stato completo e valido a partire da dati qualsiasi
 * (salvataggio precedente, JSON importato, null).
 * @param {unknown} raw
 */
export function normalizeCharacter(raw) {
  const state = createDefaultCharacter();
  if (!isPlainObject(raw)) return state;

  mergeKnownKeys(state, raw);

  const usedIds = new Set();
  state.weapons = Array.isArray(raw.weapons)
    ? raw.weapons.slice(0, MAX_WEAPONS).map((w, i) => normalizeWeapon(w, i, usedIds))
    : [];
  state.equipment.acItems = Array.isArray(raw.equipment?.acItems)
    ? raw.equipment.acItems.slice(0, MAX_AC_ITEMS).map((item, i) => normalizeAcItem(item, i))
    : [];
  const noteIds = new Set();
  state.notes.items = Array.isArray(raw.notes?.items)
    ? raw.notes.items.slice(0, MAX_NOTES).map((n, i) => normalizeNote(n, i, noteIds))
    : [];
  state.spells.cantripIds = normalizeSpellIds(raw.spells?.cantripIds, true);
  state.spells.spellIds = normalizeSpellIds(raw.spells?.spellIds, false);
  // Scelte di classe: valide per la classe attuale; salvataggi vecchi senza il campo ricevono i default.
  state.info.classChoices = normalizeClassChoices(raw.info?.classChoices, state.info.classId);
  state.version = SCHEMA_VERSION;
  return state;
}
