/**
 * Dizionario inglese dell'interfaccia statica (index.html).
 * Chiave = testo italiano dell'HTML, con spazi normalizzati; valore = traduzione.
 * I testi generati da JavaScript (derivati, liste dinamiche) non passano da qui:
 * usano `pick()` / `loc()` di i18n.js.
 */
export const UI_EN = {
  // Pagina e testata
  'Scheda Personaggio D&D 5E': 'D&D 5E Character Sheet',
  'Scheda personaggio interattiva per Dungeons & Dragons 5E: calcoli automatici, salvataggio locale, nessuna dipendenza.':
    'Interactive Dungeons & Dragons 5E character sheet: automatic calculations, local saving, no dependencies.',
  'Vai alla scheda': 'Skip to the sheet',
  'Scheda Personaggio': 'Character Sheet',
  'Azioni sulla scheda': 'Sheet actions',
  'Espandi tutto': 'Expand all',
  'Comprimi tutto': 'Collapse all',
  'Esporta': 'Export',
  'Importa': 'Import',
  'Reset': 'Reset',
  'Lingua': 'Language',

  // Riepilogo
  'Riepilogo del personaggio': 'Character summary',
  'CA': 'AC',
  'PF': 'HP',
  'Iniz.': 'Init.',
  'Comp.': 'Prof.',
  'CD': 'DC',

  // 1. Combattimento
  'Combattimento & Punti Ferita': 'Combat & Hit Points',
  'Scomposizione CA': 'AC breakdown',
  'Classe Armatura': 'Armor Class',
  'Iniziativa': 'Initiative',
  'Mod. Destrezza': 'Dexterity mod.',
  'Velocità (m)': 'Speed (m)',
  'Punti Ferita': 'Hit Points',
  'PF massimi': 'Max HP',
  'PF attuali': 'Current HP',
  'PF temporanei': 'Temporary HP',
  'PF suggeriti per classe e livello:': 'Suggested HP for class and level:',
  'Applica': 'Apply',
  'Quantità': 'Amount',
  'Danno': 'Damage',
  'Cura': 'Heal',
  'Riposo lungo': 'Long rest',
  'Tiri salvezza contro morte': 'Death saving throws',
  'Successi': 'Successes',
  'Fallimenti': 'Failures',
  'Successo': 'Success',
  'Fallimento': 'Failure',

  // 2. Caratteristiche
  'Caratteristiche & Tiri Salvezza': 'Abilities & Saving Throws',
  'Tiri salvezza': 'Saving throws',
  'Le competenze vengono impostate in base alla classe; puoi modificarle liberamente.':
    'Proficiencies are set from your class; you can change them freely.',

  // 3. Abilità
  'Abilità': 'Skills',
  'Competenze di classe': 'Class proficiencies',
  'Maes.': 'Exp.',
  'Bonus': 'Bonus',
  'Saggezza (Percezione) passiva': 'Passive Wisdom (Perception)',

  // 4. Informazioni generali
  'Informazioni Generali & Classe': 'General Information & Class',
  'Nome personaggio': 'Character name',
  'Es. Thalia Corvoscuro': 'E.g. Thalia Ravenshade',
  'Giocatore': 'Player',
  'Razza': 'Race',
  'Background': 'Background',
  'Background personalizzato': 'Custom background',
  'Competenze in abilità': 'Skill proficiencies',
  'Equipaggiamento': 'Equipment',
  'Es. Accolito': 'E.g. Acolyte',
  'Allineamento': 'Alignment',
  'Classe': 'Class',
  'Bonus razziali': 'Racial bonuses',
  'Lingue': 'Languages',
  'Scurovisione': 'Darkvision',
  'Tratti': 'Traits',
  'Armature': 'Armor',
  'Armi': 'Weapons',
  'Strumenti': 'Tools',
  'Abilità di classe': 'Class skills',
  'Livello': 'Level',
  'Bonus competenza': 'Proficiency bonus',
  'Dado vita': 'Hit die',

  // 5. Equipaggiamento
  'Equipaggiamento, Armature & Armi': 'Equipment, Armor & Weapons',
  'Armatura': 'Armor',
  'Armatura indossata': 'Armor worn',
  'Bonus magico CA': 'Magic AC bonus',
  'Scudo': 'Shield',
  '(+2 CA)': '(+2 AC)',
  'Categoria': 'Category',
  'Formula': 'Formula',
  'CA totale': 'Total AC',
  'Forza insufficiente (richiesta': 'Insufficient Strength (required',
  '): la velocità si riduce di 3 metri.': '): speed is reduced by 3 meters.',
  'Questa armatura impone svantaggio alle prove di Furtività.': 'This armor imposes disadvantage on Stealth checks.',
  'Oggetti che modificano la CA': 'Items that modify AC',
  '+ Aggiungi oggetto': '+ Add item',
  'Anelli, mantelli, bracciali o altro che aumenta la CA. Il bonus si somma ad armatura e scudo.':
    'Rings, cloaks, bracers or anything else that raises AC. The bonus adds to armor and shield.',
  'Armi & Attacchi': 'Weapons & Attacks',
  '+ Aggiungi arma': '+ Add weapon',
  'Nessuna arma. Usa “Aggiungi arma” per iniziare.': 'No weapons. Use “Add weapon” to get started.',
  'Monete': 'Coins',
  'MR': 'CP',
  'MA': 'SP',
  'ME': 'EP',
  'MO': 'GP',
  'MP': 'PP',
  'Inventario': 'Inventory',
  'Zaino, corda di canapa (15 m), razioni (5)…': 'Backpack, hempen rope (50 ft), rations (5)…',

  // 6. Incantesimi
  'Incantesimi & Trucchetti': 'Spells & Cantrips',
  'Caratteristica': 'Ability',
  'CD Tiro Salvezza': 'Spell save DC',
  'Attacco incantesimi': 'Spell attack',
  'Slot incantesimo': 'Spell slots',
  '(segna quelli usati)': '(mark the ones used)',
  'Magia del Patto: gli slot si recuperano con un riposo breve.': 'Pact Magic: slots are recovered on a short rest.',
  'Trucchetti': 'Cantrips',
  'Luce, Mano magica…': 'Light, Mage Hand…',
  'Incantesimi conosciuti / preparati': 'Spells known / prepared',
  '1° — Dardo incantato, Scudo…': '1st — Magic Missile, Shield…',

  // 7. Privilegi
  'Privilegi, Tratti & Capacità di Classe': 'Features, Traits & Class Abilities',
  'Risorse di classe': 'Class resources',
  'Tratti razziali & talenti': 'Racial traits & feats',
  'Scurovisione, Ascendenza fatata…': 'Darkvision, Fey Ancestry…',
  'Storia & personalità': 'Backstory & personality',
  'Dati salvati solo nel tuo browser. Progetto non ufficiale basato sulle regole di D&D 5E.':
    'Data is saved only in your browser. Unofficial project based on the D&D 5E rules.',

  // Riga arma
  'Arma': 'Weapon',
  'Spada lunga': 'Longsword',
  'Caratt.': 'Abil.',
  'FOR': 'STR',
  'DES': 'DEX',
  'Magia': 'Magic',
  'Danni': 'Damage',
  'Tipo': 'Type',
  'Tagliente': 'Slashing',
  'Competente': 'Proficient',
  'TpC': 'To hit',
  'Rimuovi arma': 'Remove weapon',
};
