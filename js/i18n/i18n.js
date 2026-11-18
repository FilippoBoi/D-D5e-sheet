/**
 * Internazionalizzazione.
 *
 * La lingua di base è l'italiano: i testi italiani vivono nell'HTML e nei dati.
 * Le altre lingue sono "overlay": dizionari chiave → testo (interfaccia) e
 * campi con suffisso (`nameEn`, `descriptionEn`...) nei dati di gioco.
 * Se manca una traduzione si ricade sempre sull'italiano.
 *
 * Il modulo non tocca DOM né localStorage: è usabile anche nei test.
 */
import { UI_EN } from './en.js';

export const DEFAULT_LANG = 'it';

/** Lingue disponibili. Aggiungerne una = voce qui + dizionario UI + campi nei dati. */
export const LANGUAGES = Object.freeze([
  { code: 'it', label: 'Italiano' },
  { code: 'en', label: 'English' },
]);

const UI_DICTIONARIES = { en: UI_EN };

let current = DEFAULT_LANG;

export const isSupportedLang = (code) => LANGUAGES.some((l) => l.code === code);
export const getLang = () => current;

/** @returns {boolean} true se la lingua è cambiata */
export function setLang(code) {
  if (!isSupportedLang(code) || code === current) return false;
  current = code;
  return true;
}

/** Sceglie la lingua dalle preferenze del browser (es. "en-US" → "en"). */
export function detectLang(preferred = []) {
  for (const tag of [].concat(preferred)) {
    const code = String(tag ?? '').toLowerCase().split('-')[0];
    if (isSupportedLang(code)) return code;
  }
  return DEFAULT_LANG;
}

/** Testo dell'interfaccia nella lingua corrente, o undefined se non tradotto. */
export function lookup(key) {
  return UI_DICTIONARIES[current]?.[key];
}

/** Come `lookup`, con ricaduta sul testo italiano e sostituzione dei {segnaposto}. */
export function t(key, fallback = key, params = {}) {
  const text = lookup(key) ?? fallback;
  return text.replace(/\{(\w+)\}/g, (_, name) => String(params[name] ?? `{${name}}`));
}

/** Sceglie tra due varianti già pronte: pick('Danno', 'Damage'). */
export const pick = (it, en) => (current === 'it' ? it : en);

/**
 * Legge un campo localizzato di un oggetto dati: `loc(armor, 'name')`
 * usa `nameEn` se la lingua è l'inglese ed esiste, altrimenti `name`.
 */
export function loc(entry, field = 'name') {
  if (current !== DEFAULT_LANG) {
    const suffix = current[0].toUpperCase() + current.slice(1);
    const value = entry?.[`${field}${suffix}`];
    if (value != null) return value;
  }
  return entry?.[field];
}
