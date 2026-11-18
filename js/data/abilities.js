/**
 * Le sei caratteristiche di D&D 5E.
 * `id` è la chiave stabile usata nello stato del Model; `short` è l'abbreviazione italiana.
 * I campi con suffisso `En` sono la traduzione inglese (vedi i18n/i18n.js).
 */
export const ABILITIES = Object.freeze([
  { id: 'str', name: 'Forza', short: 'FOR', nameEn: 'Strength', shortEn: 'STR' },
  { id: 'dex', name: 'Destrezza', short: 'DES', nameEn: 'Dexterity', shortEn: 'DEX' },
  { id: 'con', name: 'Costituzione', short: 'COS', nameEn: 'Constitution', shortEn: 'CON' },
  { id: 'int', name: 'Intelligenza', short: 'INT', nameEn: 'Intelligence', shortEn: 'INT' },
  { id: 'wis', name: 'Saggezza', short: 'SAG', nameEn: 'Wisdom', shortEn: 'WIS' },
  { id: 'cha', name: 'Carisma', short: 'CAR', nameEn: 'Charisma', shortEn: 'CHA' },
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

/** Traduzioni inglesi degli allineamenti. Il valore salvato resta quello italiano. */
export const ALIGNMENTS_EN = Object.freeze({
  'Legale Buono': 'Lawful Good', 'Neutrale Buono': 'Neutral Good', 'Caotico Buono': 'Chaotic Good',
  'Legale Neutrale': 'Lawful Neutral', 'Neutrale': 'True Neutral', 'Caotico Neutrale': 'Chaotic Neutral',
  'Legale Malvagio': 'Lawful Evil', 'Neutrale Malvagio': 'Neutral Evil', 'Caotico Malvagio': 'Chaotic Evil',
});
