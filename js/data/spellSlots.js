/**
 * Slot incantesimo per livello di classe.
 *
 * FULL_CASTER_SLOTS[livello] = [slot di 1°, slot di 2°, ...]
 * I mezzi incantatori (Paladino, Ranger) usano la stessa tabella
 * al livello ceil(livello / 2), a partire dal 2° livello.
 */
export const FULL_CASTER_SLOTS = Object.freeze([
  null,
  [2],
  [3],
  [4, 2],
  [4, 3],
  [4, 3, 2],
  [4, 3, 3],
  [4, 3, 3, 1],
  [4, 3, 3, 2],
  [4, 3, 3, 3, 1],
  [4, 3, 3, 3, 2],
  [4, 3, 3, 3, 2, 1],
  [4, 3, 3, 3, 2, 1],
  [4, 3, 3, 3, 2, 1, 1],
  [4, 3, 3, 3, 2, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 2, 1, 1],
]);

/**
 * Magia del Patto (Warlock): tutti gli slot sono dello stesso livello
 * e si recuperano con un riposo breve.
 * Ogni voce: [livello minimo, numero di slot, livello degli slot].
 */
export const PACT_MAGIC_TABLE = Object.freeze([
  [1, 1, 1],
  [2, 2, 1],
  [3, 2, 2],
  [5, 2, 3],
  [7, 2, 4],
  [9, 2, 5],
  [11, 3, 5],
  [17, 4, 5],
]);
