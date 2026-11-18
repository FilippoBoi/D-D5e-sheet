/**
 * Nomi italiani degli incantesimi del Manuale del Giocatore, per id (vedi generated/spells.js).
 *
 * Solo i nomi ufficiali che il progetto conosce con sicurezza: per gli altri incantesimi
 * (e per i supplementi) si usa il titolo inglese, come per i manuali in data/sources.js.
 * La ricerca nella scheda trova gli incantesimi sia col nome italiano sia con quello inglese.
 */
export const SPELL_NAMES_IT = Object.freeze({
  // Trucchetti
  'phb-acid-splash': 'Spruzzo Acido', 'phb-blade-ward': 'Protezione dalle Lame', 'phb-chill-touch': 'Contatto Gelido',
  'phb-dancing-lights': 'Luci Danzanti', 'phb-druidcraft': 'Druidismo', 'phb-eldritch-blast': 'Esplosione Occulta',
  'phb-fire-bolt': 'Dardo di Fuoco', 'phb-friends': 'Amicizia', 'phb-guidance': 'Guida', 'phb-light': 'Luce',
  'phb-mage-hand': 'Mano Magica', 'phb-mending': 'Riparare', 'phb-message': 'Messaggio',
  'phb-minor-illusion': 'Illusione Minore', 'phb-poison-spray': 'Spruzzo Velenoso', 'phb-prestidigitation': 'Prestidigitazione',
  'phb-produce-flame': 'Produrre Fiamma', 'phb-ray-of-frost': 'Raggio di Gelo', 'phb-resistance': 'Resistenza',
  'phb-sacred-flame': 'Fiamma Sacra', 'phb-shillelagh': 'Randello Magico', 'phb-shocking-grasp': 'Stretta Folgorante',
  'phb-spare-the-dying': 'Risparmiare i Morenti', 'phb-thaumaturgy': 'Taumaturgia', 'phb-thorn-whip': 'Frusta Spinosa',
  'phb-true-strike': 'Colpo Accurato', 'phb-vicious-mockery': 'Scherno Crudele',
  // 1° livello
  'phb-alarm': 'Allarme', 'phb-animal-friendship': 'Amicizia con gli Animali', 'phb-bane': 'Anatema',
  'phb-bless': 'Benedizione', 'phb-burning-hands': 'Mani Brucianti', 'phb-charm-person': 'Charme su Persone',
  'phb-command': 'Comando', 'phb-comprehend-languages': 'Comprensione dei Linguaggi', 'phb-cure-wounds': 'Cura Ferite',
  'phb-detect-magic': 'Individuazione del Magico', 'phb-disguise-self': 'Camuffare Se Stesso',
  'phb-dissonant-whispers': 'Sussurri Dissonanti', 'phb-divine-favor': 'Favore Divino', 'phb-entangle': 'Intralciare',
  'phb-faerie-fire': 'Fuoco Fatato', 'phb-false-life': 'Falsa Vita', 'phb-feather-fall': 'Caduta Morbida',
  'phb-find-familiar': 'Famiglio', 'phb-fog-cloud': 'Nube di Nebbia', 'phb-goodberry': 'Bacche Benefiche',
  'phb-grease': 'Unto', 'phb-guiding-bolt': 'Dardo Guida', 'phb-healing-word': 'Parola Curativa',
  'phb-hellish-rebuke': 'Rimprovero Infernale', 'phb-heroism': 'Eroismo', 'phb-hex': 'Malia',
  'phb-hunter-s-mark': 'Marchio del Cacciatore', 'phb-identify': 'Identificare', 'phb-inflict-wounds': 'Infliggere Ferite',
  'phb-jump': 'Saltare', 'phb-longstrider': 'Passo Lungo', 'phb-mage-armor': 'Armatura Magica',
  'phb-magic-missile': 'Dardo Incantato', 'phb-protection-from-evil-and-good': 'Protezione dal Bene e dal Male',
  'phb-sanctuary': 'Santuario', 'phb-shield': 'Scudo', 'phb-shield-of-faith': 'Scudo della Fede',
  'phb-silent-image': 'Immagine Silenziosa', 'phb-sleep': 'Sonno', 'phb-speak-with-animals': 'Parlare con gli Animali',
  'phb-thunderwave': 'Ondata Tonante', 'phb-unseen-servant': 'Servitore Inosservato', 'phb-witch-bolt': 'Dardo Stregato',
  'phb-arms-of-hadar': 'Braccia di Hadar', 'phb-armor-of-agathys': 'Armatura di Agathys',
  'phb-hail-of-thorns': 'Grandine di Spine', 'phb-ensnaring-strike': 'Colpo Intrappolante',
  // 2° livello
  'phb-aid': 'Aiuto', 'phb-alter-self': 'Alterare Se Stesso', 'phb-animal-messenger': 'Messaggero Animale',
  'phb-arcane-lock': 'Serratura Arcana', 'phb-augury': 'Auspicio', 'phb-calm-emotions': 'Calmare Emozioni',
  'phb-darkness': 'Oscurità', 'phb-darkvision': 'Scurovisione', 'phb-detect-thoughts': 'Individuazione dei Pensieri',
  'phb-enhance-ability': 'Potenziare Caratteristica', 'phb-enlarge-reduce': 'Ingrandire/Ridurre',
  'phb-flaming-sphere': 'Sfera Infuocata', 'phb-gentle-repose': 'Riposo Inviolato', 'phb-hold-person': 'Blocca Persone',
  'phb-invisibility': 'Invisibilità', 'phb-knock': 'Scasso', 'phb-levitate': 'Levitazione',
  'phb-lesser-restoration': 'Ristorare Inferiore', 'phb-locate-object': 'Localizzare Oggetto',
  'phb-magic-weapon': 'Arma Magica', 'phb-mirror-image': 'Immagine Speculare', 'phb-moonbeam': 'Raggio Lunare',
  'phb-pass-without-trace': 'Passare senza Tracce', 'phb-prayer-of-healing': 'Preghiera Curativa',
  'phb-shatter': 'Frantumare', 'phb-silence': 'Silenzio', 'phb-spiritual-weapon': 'Arma Spirituale',
  'phb-suggestion': 'Suggestione', 'phb-web': 'Ragnatela', 'phb-zone-of-truth': 'Zona di Verità',
  // 3° livello
  'phb-animate-dead': 'Animare Morti', 'phb-beacon-of-hope': 'Faro di Speranza', 'phb-blink': 'Intermittenza',
  'phb-call-lightning': 'Invocare Fulmine', 'phb-clairvoyance': 'Chiaroveggenza', 'phb-conjure-animals': 'Evocare Animali',
  'phb-counterspell': 'Controincantesimo', 'phb-create-food-and-water': 'Creare Cibo e Acqua',
  'phb-daylight': 'Luce Diurna', 'phb-dispel-magic': 'Dissolvi Magie', 'phb-fear': 'Paura', 'phb-fireball': 'Palla di Fuoco',
  'phb-fly': 'Volare', 'phb-gaseous-form': 'Forma Gassosa', 'phb-glyph-of-warding': 'Glifo di Interdizione',
  'phb-haste': 'Velocità', 'phb-hypnotic-pattern': 'Motivo Ipnotico', 'phb-lightning-bolt': 'Fulmine',
  'phb-magic-circle': 'Cerchio Magico', 'phb-major-image': 'Immagine Maggiore',
  'phb-mass-healing-word': 'Parola Curativa di Massa', 'phb-plant-growth': 'Crescita Vegetale',
  'phb-protection-from-energy': "Protezione dall'Energia", 'phb-remove-curse': 'Rimuovere Maledizione',
  'phb-revivify': 'Rivivificare', 'phb-sleet-storm': 'Tempesta di Nevischio', 'phb-slow': 'Lentezza',
  'phb-speak-with-dead': 'Parlare con i Morti', 'phb-spirit-guardians': 'Spiriti Guardiani',
  'phb-stinking-cloud': 'Nube Maleodorante', 'phb-tongues': 'Lingue', 'phb-vampiric-touch': 'Tocco Vampirico',
  'phb-water-breathing': 'Respirare Sott\'Acqua', 'phb-wind-wall': 'Muro di Vento',
  // Livelli alti
  'phb-banishment': 'Esilio', 'phb-dimension-door': 'Porta Dimensionale', 'phb-greater-invisibility': 'Invisibilità Superiore',
  'phb-polymorph': 'Metamorfosi', 'phb-wall-of-fire': 'Muro di Fuoco', 'phb-cloudkill': 'Nube Mortale',
  'phb-cone-of-cold': 'Cono di Freddo', 'phb-dominate-person': 'Dominare Persone', 'phb-hold-monster': 'Blocca Mostri',
  'phb-mass-cure-wounds': 'Cura Ferite di Massa', 'phb-wall-of-force': 'Muro di Forza', 'phb-stoneskin': 'Pelle di Pietra',
  'phb-freedom-of-movement': 'Libertà di Movimento', 'phb-ice-storm': 'Tempesta di Ghiaccio',
  'phb-fire-shield': 'Scudo di Fuoco', 'phb-chain-lightning': 'Catena di Fulmini', 'phb-disintegrate': 'Disintegrare',
  'phb-globe-of-invulnerability': 'Globo di Invulnerabilità', 'phb-heal': 'Guarigione', 'phb-teleport': 'Teletrasporto',
  'phb-finger-of-death': 'Dito della Morte', 'phb-fire-storm': 'Tempesta di Fuoco', 'phb-resurrection': 'Resurrezione',
  'phb-meteor-swarm': 'Sciame di Meteore', 'phb-power-word-kill': 'Parola del Potere: Uccidere',
  'phb-time-stop': 'Fermare il Tempo', 'phb-wish': 'Desiderio',
});
