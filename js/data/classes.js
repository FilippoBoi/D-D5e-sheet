/**
 * Definizioni delle 12 classi del Manuale del Giocatore.
 *
 * - hitDie: dado vita
 * - saves: competenze nei tiri salvezza concesse dalla classe
 * - spellcasting: null per le classi non incantatrici, altrimenti
 *     { ability, progression: 'full' | 'half' | 'pact', minLevel }
 * - unarmoredDefense: Difesa senza Armatura (Barbaro, Monaco)
 *     { ability, allowsShield }
 */
export const CLASSES = Object.freeze({
  barbarian: {
    id: 'barbarian', name: 'Barbaro', hitDie: 12, saves: ['str', 'con'],
    spellcasting: null,
    unarmoredDefense: { ability: 'con', allowsShield: true },
  },
  bard: {
    id: 'bard', name: 'Bardo', hitDie: 8, saves: ['dex', 'cha'],
    spellcasting: { ability: 'cha', progression: 'full', minLevel: 1 },
  },
  cleric: {
    id: 'cleric', name: 'Chierico', hitDie: 8, saves: ['wis', 'cha'],
    spellcasting: { ability: 'wis', progression: 'full', minLevel: 1 },
  },
  druid: {
    id: 'druid', name: 'Druido', hitDie: 8, saves: ['int', 'wis'],
    spellcasting: { ability: 'wis', progression: 'full', minLevel: 1 },
  },
  fighter: {
    id: 'fighter', name: 'Guerriero', hitDie: 10, saves: ['str', 'con'],
    spellcasting: null,
  },
  rogue: {
    id: 'rogue', name: 'Ladro', hitDie: 8, saves: ['dex', 'int'],
    spellcasting: null,
  },
  wizard: {
    id: 'wizard', name: 'Mago', hitDie: 6, saves: ['int', 'wis'],
    spellcasting: { ability: 'int', progression: 'full', minLevel: 1 },
  },
  monk: {
    id: 'monk', name: 'Monaco', hitDie: 8, saves: ['str', 'dex'],
    spellcasting: null,
    unarmoredDefense: { ability: 'wis', allowsShield: false },
  },
  paladin: {
    id: 'paladin', name: 'Paladino', hitDie: 10, saves: ['wis', 'cha'],
    spellcasting: { ability: 'cha', progression: 'half', minLevel: 2 },
  },
  ranger: {
    id: 'ranger', name: 'Ranger', hitDie: 10, saves: ['str', 'dex'],
    spellcasting: { ability: 'wis', progression: 'half', minLevel: 2 },
  },
  sorcerer: {
    id: 'sorcerer', name: 'Stregone', hitDie: 6, saves: ['con', 'cha'],
    spellcasting: { ability: 'cha', progression: 'full', minLevel: 1 },
  },
  warlock: {
    id: 'warlock', name: 'Warlock', hitDie: 8, saves: ['wis', 'cha'],
    spellcasting: { ability: 'cha', progression: 'pact', minLevel: 1 },
  },
});

export const CLASS_LIST = Object.freeze(Object.values(CLASSES));
export const CLASS_IDS = Object.freeze(Object.keys(CLASSES));
export const DEFAULT_CLASS_ID = 'fighter';

/** @param {string} id */
export const getClass = (id) => CLASSES[id] ?? CLASSES[DEFAULT_CLASS_ID];
