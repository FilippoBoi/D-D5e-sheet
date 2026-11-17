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
    id: 'dragonborn', name: 'Dragonide', speedFt: 30, darkvisionFt: 0,
    abilityBonuses: { str: 2, cha: 1 }, skills: [],
    option: { label: 'Ascendenza draconica', options: [
      { value: 'acid', label: 'Acido' }, { value: 'cold', label: 'Freddo' },
      { value: 'fire', label: 'Fuoco' }, { value: 'lightning', label: 'Fulmine' },
      { value: 'poison', label: 'Veleno' },
    ] },
    languages: 'Comune, Draconico',
    traits: 'Ascendenza draconica, Soffio distruttivo, resistenza al tipo di drago scelto',
  },
  dwarf: {
    id: 'dwarf', name: 'Nano', speedFt: 25, darkvisionFt: 60,
    abilityBonuses: { con: 2 }, skills: [],
    option: { label: 'Strumento da artigiano', options: [
      { value: 'smith', label: 'Attrezzi da fabbro' },
      { value: 'brewer', label: 'Attrezzi da birraio' },
      { value: 'mason', label: 'Attrezzi da muratore' },
    ] },
    languages: 'Comune, Nanico',
    traits: 'Resistenza al veleno, Addestramento da guerra nanico, Competenza con strumenti da artigiano',
  },
  elf: {
    id: 'elf', name: 'Elfo', speedFt: 30, darkvisionFt: 60,
    abilityBonuses: { dex: 2 }, skills: ['perception'],
    languages: 'Comune, Elfico',
    traits: 'Sensi affinati (Percezione), Trance, Armi elfiche',
  },
  gnome: {
    id: 'gnome', name: 'Gnomo', speedFt: 25, darkvisionFt: 60,
    abilityBonuses: { int: 2 }, skills: [],
    languages: 'Comune, Gnomico',
    traits: 'Astuzia gnomesca',
  },
  halfElf: {
    id: 'halfElf', name: 'Mezzelfo', speedFt: 30, darkvisionFt: 60,
    abilityBonuses: { cha: 2 }, skills: [],
    // Due caratteristiche diverse (non Carisma) ricevono +1
    abilityChoice: { count: 2, bonus: 1, exclude: ['cha'] },
    // Due abilità a scelta, qualsiasi
    skillChoice: { count: 2 },
    languages: 'Comune, Elfico, una lingua a scelta',
    traits: 'Ascendenza fatata, Due abilità a scelta, +1 a due caratteristiche a scelta',
  },
  halfOrc: {
    id: 'halfOrc', name: 'Mezzorco', speedFt: 30, darkvisionFt: 60,
    abilityBonuses: { str: 2, con: 1 }, skills: ['intimidation'],
    languages: 'Comune, Orchesco',
    traits: 'Minaccia implacabile, Resistenza implacabile, Attacchi selvaggi',
  },
  halfling: {
    id: 'halfling', name: 'Halfling', speedFt: 25, darkvisionFt: 0,
    abilityBonuses: { dex: 2 }, skills: [],
    languages: 'Comune, Halfling',
    traits: 'Fortunato, Agile, Coraggioso',
  },
  human: {
    id: 'human', name: 'Umano', speedFt: 30, darkvisionFt: 0,
    abilityBonuses: { str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 }, skills: [],
    languages: 'Comune, una lingua a scelta',
    traits: 'Versatilità',
  },
  tiefling: {
    id: 'tiefling', name: 'Tiefling', speedFt: 30, darkvisionFt: 60,
    abilityBonuses: { int: 1, cha: 2 }, skills: [],
    languages: 'Comune, Infernale',
    traits: 'Resistenza infernale (fuoco), Magia infernale',
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
