/**
 * Le 9 razze del Manuale del Giocatore (2014), dati da 5e.tools (sorgente PHB).
 *
 * - speedFt: velocità in piedi (convertita in metri dal Model)
 * - abilityBonuses: bonus fissi alle caratteristiche
 * - skills: competenze in abilità concesse automaticamente
 * - darkvisionFt: scurovisione in piedi, 0 se assente
 * - languages / traits: testo di riepilogo mostrato nella scheda
 *
 * - abilityChoice / skillChoice: scelte del giocatore (menu a tendina)
 * - option: una scelta singola con etichetta e opzioni
 *
 * Non coperte: sottorazze e la lingua extra dell'Umano (testo libero nel riepilogo).
 */
export const RACES = Object.freeze({
  dragonborn: {
    id: 'dragonborn', name: 'Dragonide', nameEn: 'Dragonborn', speedFt: 30, darkvisionFt: 0,
    abilityBonuses: { str: 2, cha: 1 }, skills: [],
    option: { label: 'Ascendenza draconica', labelEn: 'Draconic ancestry', options: [
      { value: 'acid', label: 'Acido', labelEn: 'Acid' }, { value: 'cold', label: 'Freddo', labelEn: 'Cold' },
      { value: 'fire', label: 'Fuoco', labelEn: 'Fire' }, { value: 'lightning', label: 'Fulmine', labelEn: 'Lightning' },
      { value: 'poison', label: 'Veleno', labelEn: 'Poison' },
    ] },
    languages: 'Comune, Draconico',
    languagesEn: 'Common, Draconic',
    traits: 'Ascendenza draconica, Soffio distruttivo, resistenza al tipo di drago scelto',
    traitsEn: 'Draconic Ancestry, Breath Weapon, resistance to the chosen dragon\'s damage type',
  },
  dwarf: {
    id: 'dwarf', name: 'Nano', nameEn: 'Dwarf', speedFt: 25, darkvisionFt: 60,
    abilityBonuses: { con: 2 }, skills: [],
    option: { label: 'Strumento da artigiano', labelEn: 'Artisan\'s tools', options: [
      { value: 'smith', label: 'Attrezzi da fabbro', labelEn: "Smith's tools" },
      { value: 'brewer', label: 'Attrezzi da birraio', labelEn: "Brewer's supplies" },
      { value: 'mason', label: 'Attrezzi da muratore', labelEn: "Mason's tools" },
    ] },
    languages: 'Comune, Nanico',
    languagesEn: 'Common, Dwarvish',
    traits: 'Resistenza al veleno, Addestramento da guerra nanico, Competenza con strumenti da artigiano',
    traitsEn: 'Dwarven Resilience (poison), Dwarven Combat Training, artisan\'s tool proficiency',
  },
  elf: {
    id: 'elf', name: 'Elfo', nameEn: 'Elf', speedFt: 30, darkvisionFt: 60,
    abilityBonuses: { dex: 2 }, skills: ['perception'],
    languages: 'Comune, Elfico',
    languagesEn: 'Common, Elvish',
    traits: 'Sensi affinati (Percezione), Trance, Armi elfiche',
    traitsEn: 'Keen Senses (Perception), Trance, Elf Weapon Training',
  },
  gnome: {
    id: 'gnome', name: 'Gnomo', nameEn: 'Gnome', speedFt: 25, darkvisionFt: 60,
    abilityBonuses: { int: 2 }, skills: [],
    languages: 'Comune, Gnomico',
    languagesEn: 'Common, Gnomish',
    traits: 'Astuzia gnomesca',
    traitsEn: 'Gnome Cunning',
  },
  halfElf: {
    id: 'halfElf', name: 'Mezzelfo', nameEn: 'Half-Elf', speedFt: 30, darkvisionFt: 60,
    abilityBonuses: { cha: 2 }, skills: [],
    // Due caratteristiche diverse (non Carisma) ricevono +1
    abilityChoice: { count: 2, bonus: 1, exclude: ['cha'] },
    // Due abilità a scelta, qualsiasi
    skillChoice: { count: 2 },
    languages: 'Comune, Elfico, una lingua a scelta',
    languagesEn: 'Common, Elvish, one language of your choice',
    traits: 'Ascendenza fatata, Due abilità a scelta, +1 a due caratteristiche a scelta',
    traitsEn: 'Fey Ancestry, Two skills of your choice, +1 to two abilities of your choice',
  },
  halfOrc: {
    id: 'halfOrc', name: 'Mezzorco', nameEn: 'Half-Orc', speedFt: 30, darkvisionFt: 60,
    abilityBonuses: { str: 2, con: 1 }, skills: ['intimidation'],
    languages: 'Comune, Orchesco',
    languagesEn: 'Common, Orc',
    traits: 'Minaccia implacabile, Resistenza implacabile, Attacchi selvaggi',
    traitsEn: 'Menacing, Relentless Endurance, Savage Attacks',
  },
  halfling: {
    id: 'halfling', name: 'Halfling', nameEn: 'Halfling', speedFt: 25, darkvisionFt: 0,
    abilityBonuses: { dex: 2 }, skills: [],
    languages: 'Comune, Halfling',
    languagesEn: 'Common, Halfling',
    traits: 'Fortunato, Agile, Coraggioso',
    traitsEn: 'Lucky, Nimble, Brave',
  },
  human: {
    id: 'human', name: 'Umano', nameEn: 'Human', speedFt: 30, darkvisionFt: 0,
    abilityBonuses: { str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 }, skills: [],
    languages: 'Comune, una lingua a scelta',
    languagesEn: 'Common, one language of your choice',
    traits: 'Versatilità',
    traitsEn: 'Versatility',
  },
  tiefling: {
    id: 'tiefling', name: 'Tiefling', nameEn: 'Tiefling', speedFt: 30, darkvisionFt: 60,
    abilityBonuses: { int: 1, cha: 2 }, skills: [],
    languages: 'Comune, Infernale',
    languagesEn: 'Common, Infernal',
    traits: 'Resistenza infernale (fuoco), Magia infernale',
    traitsEn: 'Hellish Resistance (fire), Infernal Legacy',
  },
});

export const RACE_LIST = Object.freeze(Object.values(RACES));
export const RACE_IDS = Object.freeze(Object.keys(RACES));

/** Nessuna razza scelta: campo vuoto, nessun effetto automatico. */
export const NO_RACE_ID = '';

/** @param {string} id */
export const getRace = (id) => RACES[id] ?? null;

/** Piedi → metri, arrotondati al mezzo metro (come nelle altre velocità della scheda). */
export const feetToMeters = (ft) => Math.round(ft * 0.3 * 2) / 2;
