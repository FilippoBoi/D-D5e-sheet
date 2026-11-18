/**
 * I 13 background del Manuale del Giocatore (2014), dati da 5e.tools (sorgente PHB).
 * Le varianti (Spia, Gladiatore, Cavaliere, Pirata…) usano le stesse competenze e restano
 * selezionabili scrivendo il nome come background personalizzato.
 *
 * - skills: competenze in abilità concesse automaticamente (id di data/skills.js)
 * - tools / languages / equipment / feature: testo di riepilogo mostrato nella scheda
 */
export const BACKGROUNDS = Object.freeze({
  acolyte: {
    id: 'acolyte', name: 'Accolito', nameEn: 'Acolyte', skills: ['insight', 'religion'],
    tools: '', toolsEn: '',
    languages: 'Due a scelta', languagesEn: 'Two of your choice',
    equipment: 'Simbolo sacro, libro di preghiere o ruota di preghiera, 5 bastoncini di incenso, paramenti, abiti comuni, borsa con 15 mo',
    equipmentEn: 'Holy symbol, prayer book or prayer wheel, 5 sticks of incense, vestments, common clothes, belt pouch with 15 gp',
    feature: 'Rifugio dei fedeli', featureEn: 'Shelter of the Faithful',
  },
  charlatan: {
    id: 'charlatan', name: 'Ciarlatano', nameEn: 'Charlatan', skills: ['deception', 'sleightOfHand'],
    tools: 'Kit per il camuffamento, kit per la contraffazione', toolsEn: 'Disguise kit, forgery kit',
    languages: '', languagesEn: '',
    equipment: 'Abiti eleganti, kit per il camuffamento, strumenti per la truffa a scelta, borsa con 15 mo',
    equipmentEn: 'Fine clothes, disguise kit, tools of the con of your choice, belt pouch with 15 gp',
    feature: 'Falsa identità', featureEn: 'False Identity',
  },
  criminal: {
    id: 'criminal', name: 'Criminale', nameEn: 'Criminal', skills: ['deception', 'stealth'],
    tools: 'Un set da gioco a scelta, arnesi da scasso', toolsEn: "One type of gaming set, thieves' tools",
    languages: '', languagesEn: '',
    equipment: 'Piede di porco, abiti comuni scuri con cappuccio, borsa con 15 mo',
    equipmentEn: 'Crowbar, dark common clothes with a hood, belt pouch with 15 gp',
    feature: 'Contatto criminale', featureEn: 'Criminal Contact',
  },
  entertainer: {
    id: 'entertainer', name: 'Intrattenitore', nameEn: 'Entertainer', skills: ['acrobatics', 'performance'],
    tools: 'Kit per il camuffamento, uno strumento musicale a scelta', toolsEn: 'Disguise kit, one musical instrument',
    languages: '', languagesEn: '',
    equipment: 'Strumento musicale a scelta, un pegno d\'affetto di un ammiratore, costume, borsa con 15 mo',
    equipmentEn: 'A musical instrument, the favor of an admirer, a costume, belt pouch with 15 gp',
    feature: 'Su richiesta del pubblico', featureEn: 'By Popular Demand',
  },
  folkHero: {
    id: 'folkHero', name: 'Eroe del popolo', nameEn: 'Folk Hero', skills: ['animalHandling', 'survival'],
    tools: 'Un tipo di strumenti da artigiano, veicoli (terrestri)', toolsEn: "One type of artisan's tools, vehicles (land)",
    languages: '', languagesEn: '',
    equipment: 'Strumenti da artigiano a scelta, pala, pentola di ferro, abiti comuni, borsa con 10 mo',
    equipmentEn: "Artisan's tools, shovel, iron pot, common clothes, belt pouch with 10 gp",
    feature: 'Ospitalità rustica', featureEn: 'Rustic Hospitality',
  },
  guildArtisan: {
    id: 'guildArtisan', name: 'Artigiano di gilda', nameEn: 'Guild Artisan', skills: ['insight', 'persuasion'],
    tools: 'Un tipo di strumenti da artigiano', toolsEn: "One type of artisan's tools",
    languages: 'Una a scelta', languagesEn: 'One of your choice',
    equipment: 'Strumenti da artigiano a scelta, lettera di presentazione della gilda, abiti da viaggiatore, borsa con 15 mo',
    equipmentEn: "Artisan's tools, letter of introduction from your guild, traveler's clothes, belt pouch with 15 gp",
    feature: 'Appartenenza a una gilda', featureEn: 'Guild Membership',
  },
  hermit: {
    id: 'hermit', name: 'Eremita', nameEn: 'Hermit', skills: ['medicine', 'religion'],
    tools: 'Kit da erborista', toolsEn: 'Herbalism kit',
    languages: 'Una a scelta', languagesEn: 'One of your choice',
    equipment: 'Custodia di pergamene con appunti, coperta da inverno, abiti comuni, kit da erborista, 5 mo',
    equipmentEn: 'Scroll case of notes, winter blanket, common clothes, herbalism kit, 5 gp',
    feature: 'Scoperta', featureEn: 'Discovery',
  },
  noble: {
    id: 'noble', name: 'Nobile', nameEn: 'Noble', skills: ['history', 'persuasion'],
    tools: 'Un set da gioco a scelta', toolsEn: 'One type of gaming set',
    languages: 'Una a scelta', languagesEn: 'One of your choice',
    equipment: 'Abiti eleganti, anello con sigillo, pergamena con l\'albero genealogico, borsa con 25 mo',
    equipmentEn: 'Fine clothes, signet ring, scroll of pedigree, purse with 25 gp',
    feature: 'Posizione privilegiata', featureEn: 'Position of Privilege',
  },
  outlander: {
    id: 'outlander', name: 'Straniero', nameEn: 'Outlander', skills: ['athletics', 'survival'],
    tools: 'Uno strumento musicale a scelta', toolsEn: 'One musical instrument',
    languages: 'Una a scelta', languagesEn: 'One of your choice',
    equipment: 'Bastone, trappola da caccia, trofeo di un animale, abiti da viaggiatore, borsa con 10 mo',
    equipmentEn: "Staff, hunting trap, trophy from an animal, traveler's clothes, belt pouch with 10 gp",
    feature: 'Vagabondo', featureEn: 'Wanderer',
  },
  sage: {
    id: 'sage', name: 'Saggio', nameEn: 'Sage', skills: ['arcana', 'history'],
    tools: '', toolsEn: '',
    languages: 'Due a scelta', languagesEn: 'Two of your choice',
    equipment: 'Bottiglia d\'inchiostro nero, penna, coltellino, lettera di un collega con una domanda, abiti comuni, borsa con 10 mo',
    equipmentEn: 'Bottle of black ink, quill, small knife, letter from a dead colleague posing a question, common clothes, belt pouch with 10 gp',
    feature: 'Ricercatore', featureEn: 'Researcher',
  },
  sailor: {
    id: 'sailor', name: 'Marinaio', nameEn: 'Sailor', skills: ['athletics', 'perception'],
    tools: 'Strumenti da navigatore, veicoli (acquatici)', toolsEn: "Navigator's tools, vehicles (water)",
    languages: '', languagesEn: '',
    equipment: 'Randello, 15 metri di corda di seta, portafortuna, abiti comuni, borsa con 10 mo',
    equipmentEn: 'Belaying pin (club), 50 feet of silk rope, lucky charm, common clothes, belt pouch with 10 gp',
    feature: 'Passaggio in nave', featureEn: "Ship's Passage",
  },
  soldier: {
    id: 'soldier', name: 'Soldato', nameEn: 'Soldier', skills: ['athletics', 'intimidation'],
    tools: 'Un set da gioco a scelta, veicoli (terrestri)', toolsEn: 'One type of gaming set, vehicles (land)',
    languages: '', languagesEn: '',
    equipment: 'Insegna del grado, trofeo di guerra, set di dadi o mazzo di carte, abiti comuni, borsa con 10 mo',
    equipmentEn: 'Insignia of rank, trophy from a fallen enemy, set of bone dice or deck of cards, common clothes, belt pouch with 10 gp',
    feature: 'Grado militare', featureEn: 'Military Rank',
  },
  urchin: {
    id: 'urchin', name: 'Monello', nameEn: 'Urchin', skills: ['sleightOfHand', 'stealth'],
    tools: 'Kit per il camuffamento, arnesi da scasso', toolsEn: "Disguise kit, thieves' tools",
    languages: '', languagesEn: '',
    equipment: 'Coltellino, mappa della città natale, topolino domestico, ricordo dei genitori, abiti comuni, borsa con 10 mo',
    equipmentEn: 'Small knife, map of the city you grew up in, pet mouse, token to remember your parents, common clothes, belt pouch with 10 gp',
    feature: 'Segreti della città', featureEn: 'City Secrets',
  },
});

export const BACKGROUND_LIST = Object.freeze(Object.values(BACKGROUNDS));
export const BACKGROUND_IDS = Object.freeze(Object.keys(BACKGROUNDS));

/** Nessun background del manuale: si usa il testo libero e non c'è alcun effetto automatico. */
export const NO_BACKGROUND_ID = '';

/** @param {string} id */
export const getBackground = (id) => BACKGROUNDS[id] ?? null;
