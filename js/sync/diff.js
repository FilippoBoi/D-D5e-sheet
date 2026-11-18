/**
 * Confronto e fusione di documenti JSON, ignorando l'ordine delle chiavi
 * (il database le riordina: jsonb non conserva l'ordine di inserimento).
 *
 * Granularità: le *foglie*. Gli oggetti si attraversano; numeri, stringhe,
 * booleani e array (es. l'elenco delle armi) sono foglie e si scambiano interi.
 * Così il Master che cambia i PF e il giocatore che cambia la velocità, pur
 * stando nella stessa sezione "combat", non si sovrascrivono.
 *
 * `deepMerge` ha la stessa semantica di `_jsonb_deep_merge` in supabase/schema.sql.
 */
export const isPlainObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);

export function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const keysA = Object.keys(a);
  if (keysA.length !== Object.keys(b).length) return false;
  return keysA.every((key) => Object.hasOwn(b, key) && deepEqual(a[key], b[key]));
}

/**
 * Cosa serve a `base` per diventare `next`: un oggetto parziale con le sole foglie diverse
 * (stessa forma del documento), oppure `undefined` se sono uguali.
 */
export function diffDeep(base, next) {
  if (isPlainObject(next) && isPlainObject(base)) {
    const changes = {};
    for (const key of Object.keys(next)) {
      const change = diffDeep(base[key], next[key]);
      if (change !== undefined) changes[key] = change;
    }
    return Object.keys(changes).length > 0 ? changes : undefined;
  }
  return deepEqual(base, next) ? undefined : structuredClone(next);
}

/** Applica `patch` a `target` senza modificarlo: gli oggetti si fondono, il resto si sostituisce. */
export function deepMerge(target, patch) {
  if (!isPlainObject(target) || !isPlainObject(patch)) return structuredClone(patch);
  const result = { ...target };
  for (const key of Object.keys(patch)) {
    result[key] = key in target ? deepMerge(target[key], patch[key]) : structuredClone(patch[key]);
  }
  return structuredClone(result);
}

/**
 * Tra le modifiche arrivate dal server, tiene solo quelle applicabili qui:
 * scarta una foglia se è già uguale a quella locale, o se è stata toccata anche
 * qui rispetto a `base` (la modifica locale vince e verrà inviata).
 * @returns {object | undefined} parziale da fondere nello stato locale
 */
export function applicableChanges(change, local, base) {
  if (isPlainObject(change) && isPlainObject(local)) {
    const out = {};
    for (const key of Object.keys(change)) {
      const part = applicableChanges(change[key], local[key], base?.[key]);
      if (part !== undefined) out[key] = part;
    }
    return Object.keys(out).length > 0 ? out : undefined;
  }
  if (deepEqual(change, local)) return undefined;
  if (!deepEqual(local, base)) return undefined;
  return change;
}
