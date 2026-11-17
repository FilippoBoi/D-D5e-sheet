/**
 * Le sei caratteristiche di D&D 5E.
 * `id` è la chiave stabile usata nello stato del Model; `short` è l'abbreviazione italiana.
 */
export const ABILITIES = Object.freeze([
  { id: 'str', name: 'Forza', short: 'FOR' },
  { id: 'dex', name: 'Destrezza', short: 'DES' },
  { id: 'con', name: 'Costituzione', short: 'COS' },
  { id: 'int', name: 'Intelligenza', short: 'INT' },
  { id: 'wis', name: 'Saggezza', short: 'SAG' },
  { id: 'cha', name: 'Carisma', short: 'CAR' },
]);

export const ABILITY_IDS = Object.freeze(ABILITIES.map((a) => a.id));

/** @param {string} id */
export const getAbility = (id) => ABILITIES.find((a) => a.id === id);

/** I nove allineamenti ufficiali. */
export const ALIGNMENTS = Object.freeze([
  'Legale Buono', 'Neutrale Buono', 'Caotico Buono',
  'Legale Neutrale', 'Neutrale', 'Caotico Neutrale',
  'Legale Malvagio', 'Neutrale Malvagio', 'Caotico Malvagio',
]);
