/**
 * Confronto di documenti JSON, ignorando l'ordine delle chiavi
 * (il database le riordina: jsonb non conserva l'ordine di inserimento).
 */
export function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const keysA = Object.keys(a);
  if (keysA.length !== Object.keys(b).length) return false;
  return keysA.every((key) => Object.hasOwn(b, key) && deepEqual(a[key], b[key]));
}

/** Sezioni (chiavi di primo livello) di `next` diverse da `base`. */
export function diffSections(base, next) {
  const changes = {};
  for (const key of Object.keys(next ?? {})) {
    if (!deepEqual(base?.[key], next[key])) changes[key] = next[key];
  }
  return changes;
}
