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

/**
 * Equipaggiamento e competenze iniziali (PHB, da 5e.tools).
 * - armor / weapons / tools: testo di riepilogo
 * - skillChoice: quante abilità scegliere e tra quali (id di SKILLS)
 * Non cambiano lo stato: sono mostrati come promemoria.
 */
export const CLASS_STARTING = Object.freeze({
  barbarian: {
    armor: 'Leggere, medie, scudi', weapons: 'Semplici, da guerra', tools: '',
    skillChoice: { count: 2, from: ['animalHandling', 'athletics', 'intimidation', 'nature', 'perception', 'survival'] },
  },
  bard: {
    armor: 'Leggere', weapons: 'Semplici, balestra a mano, spada lunga, stocco, spada corta',
    tools: 'Tre strumenti musicali a scelta',
    skillChoice: { count: 3, from: ['acrobatics', 'animalHandling', 'arcana', 'athletics', 'deception', 'history', 'insight', 'intimidation', 'investigation', 'medicine', 'nature', 'perception', 'performance', 'persuasion', 'religion', 'sleightOfHand', 'stealth', 'survival'] },
  },
  cleric: {
    armor: 'Leggere, medie, scudi', weapons: 'Semplici', tools: '',
    skillChoice: { count: 2, from: ['history', 'insight', 'medicine', 'persuasion', 'religion'] },
  },
  druid: {
    armor: 'Leggere, medie, scudi (non metallici)', weapons: 'Clava, pugnale, dardo, giavellotto, mazza, bastone, scimitarra, falcetto, fionda, lancia',
    tools: 'Kit da erborista',
    skillChoice: { count: 2, from: ['arcana', 'animalHandling', 'insight', 'medicine', 'nature', 'perception', 'religion', 'survival'] },
  },
  fighter: {
    armor: 'Leggere, medie, pesanti, scudi', weapons: 'Semplici, da guerra', tools: '',
    skillChoice: { count: 2, from: ['acrobatics', 'animalHandling', 'athletics', 'history', 'insight', 'intimidation', 'perception', 'survival'] },
  },
  rogue: {
    armor: 'Leggere', weapons: 'Semplici, balestra a mano, spada lunga, stocco, spada corta',
    tools: 'Arnesi da scasso',
    skillChoice: { count: 4, from: ['acrobatics', 'athletics', 'deception', 'insight', 'intimidation', 'investigation', 'perception', 'performance', 'persuasion', 'sleightOfHand', 'stealth'] },
  },
  wizard: {
    armor: '', weapons: 'Pugnale, dardo, fionda, bastone, balestra leggera', tools: '',
    skillChoice: { count: 2, from: ['arcana', 'history', 'insight', 'investigation', 'medicine', 'religion'] },
  },
  monk: {
    armor: '', weapons: 'Semplici, spada corta', tools: 'Uno strumento da artigiano o musicale a scelta',
    skillChoice: { count: 2, from: ['acrobatics', 'athletics', 'history', 'insight', 'religion', 'stealth'] },
  },
  paladin: {
    armor: 'Leggere, medie, pesanti, scudi', weapons: 'Semplici, da guerra', tools: '',
    skillChoice: { count: 2, from: ['athletics', 'insight', 'intimidation', 'medicine', 'persuasion', 'religion'] },
  },
  ranger: {
    armor: 'Leggere, medie, scudi', weapons: 'Semplici, da guerra', tools: '',
    skillChoice: { count: 3, from: ['animalHandling', 'athletics', 'insight', 'investigation', 'nature', 'perception', 'stealth', 'survival'] },
  },
  sorcerer: {
    armor: '', weapons: 'Pugnale, dardo, fionda, bastone, balestra leggera', tools: '',
    skillChoice: { count: 2, from: ['arcana', 'deception', 'insight', 'intimidation', 'persuasion', 'religion'] },
  },
  warlock: {
    armor: 'Leggere', weapons: 'Semplici', tools: '',
    skillChoice: { count: 2, from: ['arcana', 'deception', 'history', 'intimidation', 'investigation', 'nature', 'religion'] },
  },
});

export const CLASS_LIST = Object.freeze(Object.values(CLASSES));
export const CLASS_IDS = Object.freeze(Object.keys(CLASSES));
export const DEFAULT_CLASS_ID = 'fighter';

/** @param {string} id */
export const getClass = (id) => CLASSES[id] ?? CLASSES[DEFAULT_CLASS_ID];
