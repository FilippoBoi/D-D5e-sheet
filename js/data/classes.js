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
    id: 'barbarian', name: 'Barbaro', nameEn: 'Barbarian', hitDie: 12, saves: ['str', 'con'],
    spellcasting: null,
    unarmoredDefense: { ability: 'con', allowsShield: true },
  },
  bard: {
    id: 'bard', name: 'Bardo', nameEn: 'Bard', hitDie: 8, saves: ['dex', 'cha'],
    spellcasting: { ability: 'cha', progression: 'full', minLevel: 1 },
  },
  cleric: {
    id: 'cleric', name: 'Chierico', nameEn: 'Cleric', hitDie: 8, saves: ['wis', 'cha'],
    spellcasting: { ability: 'wis', progression: 'full', minLevel: 1 },
  },
  druid: {
    id: 'druid', name: 'Druido', nameEn: 'Druid', hitDie: 8, saves: ['int', 'wis'],
    spellcasting: { ability: 'wis', progression: 'full', minLevel: 1 },
  },
  fighter: {
    id: 'fighter', name: 'Guerriero', nameEn: 'Fighter', hitDie: 10, saves: ['str', 'con'],
    spellcasting: null,
  },
  rogue: {
    id: 'rogue', name: 'Ladro', nameEn: 'Rogue', hitDie: 8, saves: ['dex', 'int'],
    spellcasting: null,
  },
  wizard: {
    id: 'wizard', name: 'Mago', nameEn: 'Wizard', hitDie: 6, saves: ['int', 'wis'],
    spellcasting: { ability: 'int', progression: 'full', minLevel: 1 },
  },
  monk: {
    id: 'monk', name: 'Monaco', nameEn: 'Monk', hitDie: 8, saves: ['str', 'dex'],
    spellcasting: null,
    unarmoredDefense: { ability: 'wis', allowsShield: false },
  },
  paladin: {
    id: 'paladin', name: 'Paladino', nameEn: 'Paladin', hitDie: 10, saves: ['wis', 'cha'],
    spellcasting: { ability: 'cha', progression: 'half', minLevel: 2 },
  },
  ranger: {
    id: 'ranger', name: 'Ranger', nameEn: 'Ranger', hitDie: 10, saves: ['str', 'dex'],
    spellcasting: { ability: 'wis', progression: 'half', minLevel: 2 },
  },
  sorcerer: {
    id: 'sorcerer', name: 'Stregone', nameEn: 'Sorcerer', hitDie: 6, saves: ['con', 'cha'],
    spellcasting: { ability: 'cha', progression: 'full', minLevel: 1 },
  },
  warlock: {
    id: 'warlock', name: 'Warlock', nameEn: 'Warlock', hitDie: 8, saves: ['wis', 'cha'],
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
    armor: 'Leggere, medie, scudi', armorEn: 'Light, medium, shields', weapons: 'Semplici, da guerra', weaponsEn: 'Simple, martial', tools: '',
    skillChoice: { count: 2, from: ['animalHandling', 'athletics', 'intimidation', 'nature', 'perception', 'survival'] },
  },
  bard: {
    armor: 'Leggere', armorEn: 'Light', weapons: 'Semplici, balestra a mano, spada lunga, stocco, spada corta', weaponsEn: 'Simple, hand crossbows, longswords, rapiers, shortswords',
    tools: 'Tre strumenti musicali a scelta', toolsEn: 'Three musical instruments of your choice',
    skillChoice: { count: 3, from: ['acrobatics', 'animalHandling', 'arcana', 'athletics', 'deception', 'history', 'insight', 'intimidation', 'investigation', 'medicine', 'nature', 'perception', 'performance', 'persuasion', 'religion', 'sleightOfHand', 'stealth', 'survival'] },
  },
  cleric: {
    armor: 'Leggere, medie, scudi', armorEn: 'Light, medium, shields', weapons: 'Semplici', weaponsEn: 'Simple', tools: '',
    skillChoice: { count: 2, from: ['history', 'insight', 'medicine', 'persuasion', 'religion'] },
  },
  druid: {
    armor: 'Leggere, medie, scudi (non metallici)', armorEn: 'Light, medium, shields (non-metal)', weapons: 'Clava, pugnale, dardo, giavellotto, mazza, bastone, scimitarra, falcetto, fionda, lancia', weaponsEn: 'Clubs, daggers, darts, javelins, maces, quarterstaffs, scimitars, sickles, slings, spears',
    tools: 'Kit da erborista', toolsEn: 'Herbalism kit',
    skillChoice: { count: 2, from: ['arcana', 'animalHandling', 'insight', 'medicine', 'nature', 'perception', 'religion', 'survival'] },
  },
  fighter: {
    armor: 'Leggere, medie, pesanti, scudi', armorEn: 'Light, medium, heavy, shields', weapons: 'Semplici, da guerra', weaponsEn: 'Simple, martial', tools: '',
    skillChoice: { count: 2, from: ['acrobatics', 'animalHandling', 'athletics', 'history', 'insight', 'intimidation', 'perception', 'survival'] },
  },
  rogue: {
    armor: 'Leggere', armorEn: 'Light', weapons: 'Semplici, balestra a mano, spada lunga, stocco, spada corta', weaponsEn: 'Simple, hand crossbows, longswords, rapiers, shortswords',
    tools: 'Arnesi da scasso', toolsEn: 'Thieves\' tools',
    skillChoice: { count: 4, from: ['acrobatics', 'athletics', 'deception', 'insight', 'intimidation', 'investigation', 'perception', 'performance', 'persuasion', 'sleightOfHand', 'stealth'] },
  },
  wizard: {
    armor: '', weapons: 'Pugnale, dardo, fionda, bastone, balestra leggera', weaponsEn: 'Daggers, darts, slings, quarterstaffs, light crossbows', tools: '',
    skillChoice: { count: 2, from: ['arcana', 'history', 'insight', 'investigation', 'medicine', 'religion'] },
  },
  monk: {
    armor: '', weapons: 'Semplici, spada corta', weaponsEn: 'Simple, shortswords', tools: 'Uno strumento da artigiano o musicale a scelta', toolsEn: 'One artisan\'s tool or musical instrument of your choice',
    skillChoice: { count: 2, from: ['acrobatics', 'athletics', 'history', 'insight', 'religion', 'stealth'] },
  },
  paladin: {
    armor: 'Leggere, medie, pesanti, scudi', armorEn: 'Light, medium, heavy, shields', weapons: 'Semplici, da guerra', weaponsEn: 'Simple, martial', tools: '',
    skillChoice: { count: 2, from: ['athletics', 'insight', 'intimidation', 'medicine', 'persuasion', 'religion'] },
  },
  ranger: {
    armor: 'Leggere, medie, scudi', armorEn: 'Light, medium, shields', weapons: 'Semplici, da guerra', weaponsEn: 'Simple, martial', tools: '',
    skillChoice: { count: 3, from: ['animalHandling', 'athletics', 'insight', 'investigation', 'nature', 'perception', 'stealth', 'survival'] },
  },
  sorcerer: {
    armor: '', weapons: 'Pugnale, dardo, fionda, bastone, balestra leggera', weaponsEn: 'Daggers, darts, slings, quarterstaffs, light crossbows', tools: '',
    skillChoice: { count: 2, from: ['arcana', 'deception', 'insight', 'intimidation', 'persuasion', 'religion'] },
  },
  warlock: {
    armor: 'Leggere', armorEn: 'Light', weapons: 'Semplici', weaponsEn: 'Simple', tools: '',
    skillChoice: { count: 2, from: ['arcana', 'deception', 'history', 'intimidation', 'investigation', 'nature', 'religion'] },
  },
});

export const CLASS_LIST = Object.freeze(Object.values(CLASSES));
export const CLASS_IDS = Object.freeze(Object.keys(CLASSES));
export const DEFAULT_CLASS_ID = 'fighter';

/** @param {string} id */
export const getClass = (id) => CLASSES[id] ?? CLASSES[DEFAULT_CLASS_ID];
