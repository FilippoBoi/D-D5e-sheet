/**
 * Utilità pure condivise da Model e View (nessun accesso al DOM).
 */

const FORBIDDEN_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

/**
 * Legge un valore annidato tramite percorso puntato ("abilities.str", "weapons.0.name").
 * @param {object} obj
 * @param {string} path
 */
export function getByPath(obj, path) {
  return path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
}

/**
 * Scrive un valore annidato. Accetta solo chiavi già esistenti, così
 * un percorso sbagliato (o malevolo) non può creare proprietà nuove.
 * @returns {boolean} true se il percorso esiste ed è stato scritto
 */
export function setByPath(obj, path, value) {
  const keys = path.split('.');
  if (keys.some((k) => FORBIDDEN_KEYS.has(k))) return false;
  const last = keys.pop();
  let target = obj;
  for (const key of keys) {
    if (target == null || typeof target !== 'object' || !Object.hasOwn(target, key)) return false;
    target = target[key];
  }
  if (target == null || typeof target !== 'object' || !Object.hasOwn(target, last)) return false;
  target[last] = value;
  return true;
}

/** @param {unknown} value */
export const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

export const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

/** Intero limitato all'intervallo [min, max]. */
export const clampInt = (n, min, max) => clamp(Math.trunc(n), min, max);

/**
 * Formatta un modificatore con segno: +2, +0, −1 (segno meno tipografico U+2212).
 * @param {number} n
 */
export const formatModifier = (n) => (n >= 0 ? `+${n}` : `−${Math.abs(n)}`);
