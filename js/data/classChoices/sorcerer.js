/**
 * Scelte dello Stregone: Origine Stregonesca (1° livello), ascendenza draconica e
 * Metamagia (2 opzioni al 3°, +1 al 10°, +1 al 17°).
 *
 * Termini Metamagia da verificare sul PHB italiano: "Incantesimo Accurato/Distante/Potenziato/Esteso/
 * Intensificato/Rapido/Sottile/Gemello".
 *
 * Effetti calcolabili: Resilienza Draconica = +1 PF massimi per livello (PF suggeriti) e,
 * senza armatura, CA 13 + DES (riusa il meccanismo `unarmoredDefense`, base 13, senza caratteristica).
 *
 * Termini italiani da verificare: "Antenato Draconico", "Affinità Elementale", "Ali di Drago",
 * "Presenza Draconica", "Maree del Caos", "Ondata di Magia Selvaggia", "Piegare la Fortuna",
 * "Caos Controllato", "Bombardamento Magico". Confermati dal progetto: "Origine Stregonesca",
 * "Discendenza Draconica", "Magia Selvaggia".
 */
const mm = (value, label, labelEn, description, descriptionEn) => ({ value, label, labelEn, description, descriptionEn });

const dragon = (value, label, labelEn, type, typeEn) => ({
  value, label: `${label} (${type})`, labelEn: `${labelEn} (${typeEn})`,
  description: `Tipo di danno: ${type.toLowerCase()}.`, descriptionEn: `Damage type: ${typeEn.toLowerCase()}.`,
});

export default {
  choices: [
    {
      key: 'subclass', type: 'single', minLevel: 1, subclass: true,
      label: 'Origine Stregonesca', labelEn: 'Sorcerous Origin',
      options: [
        {
          value: 'draconic', label: 'Discendenza Draconica', labelEn: 'Draconic Bloodline',
          description: 'Il tuo potere viene dal sangue di un drago.', descriptionEn: 'Your power comes from dragon blood.',
          effects: { hpPerLevel: 1, unarmoredDefense: { base: 13, ability: null, allowsShield: true } },
          features: [
            [1, 'Antenato Draconico', 'Scegli un tipo di drago come antenato: determina il tipo di danno dei privilegi successivi. Parli e leggi il Draconico e raddoppi la competenza nelle prove di Carisma verso i draghi.',
              'Dragon Ancestor', 'Choose a dragon type as your ancestor: it sets the damage type of later features. You speak and read Draconic and double your proficiency on Charisma checks with dragons.'],
            [1, 'Resilienza Draconica', '+1 PF massimi per ogni livello da stregone. Senza armatura la CA è 13 + mod. DES.',
              'Draconic Resilience', '+1 hit point maximum per sorcerer level. Without armor your AC is 13 + DEX mod.'],
            [6, 'Affinità Elementale', 'Aggiungi il mod. CAR ai danni del tipo dell\'antenato; spendi 1 punto stregoneria per resistenza a quel tipo.',
              'Elemental Affinity', 'Add your Charisma modifier to damage of your ancestry type; spend 1 sorcery point for resistance to it.'],
            [14, 'Ali di Drago', 'Fai spuntare ali: velocità di volo pari alla velocità a terra.', 'Dragon Wings', 'Sprout wings: flying speed equal to your walking speed.'],
            [18, 'Presenza Draconica', 'Spendi 5 punti stregoneria per un\'aura di terrore o charme (concentrazione, 1 minuto).',
              'Draconic Presence', 'Spend 5 sorcery points for an aura of awe or fear (concentration, 1 minute).'],
          ],
        },
        {
          value: 'wild', label: 'Magia Selvaggia', labelEn: 'Wild Magic',
          description: 'Il tuo potere nasce dal caos primordiale.', descriptionEn: 'Your power springs from primal chaos.',
          features: [
            [1, 'Ondata di Magia Selvaggia', 'Dopo un incantesimo di 1° livello o superiore, il DM può farti tirare sulla tabella delle ondate (d20: con 1 scatta).',
              'Wild Magic Surge', 'After casting a 1st-level or higher spell, the DM may have you roll on the surge table (d20: on a 1).'],
            [1, 'Maree del Caos', 'Vantaggio a un tiro per colpire, prova o TS; poi il DM può farti tirare un\'ondata.',
              'Tides of Chaos', 'Gain advantage on one attack roll, check or save; the DM can then trigger a surge.'],
            [6, 'Piegare la Fortuna', 'Reazione, 2 punti stregoneria: ±1d4 al tiro di una creatura vicina.', 'Bend Luck', 'Reaction, 2 sorcery points: ±1d4 to a nearby creature\'s roll.'],
            [14, 'Caos Controllato', 'Tira due volte sulla tabella delle ondate e scegli.', 'Controlled Chaos', 'Roll twice on the surge table and pick one.'],
            [18, 'Bombardamento Magico', 'Se un dado di danno di un incantesimo mostra il valore massimo, tiri un dado extra.',
              'Spell Bombardment', 'When a spell damage die shows its maximum value, roll an extra die.'],
          ],
        },
      ],
    },
    {
      key: 'dragonAncestry', type: 'single', minLevel: 1,
      when: { key: 'subclass', in: ['draconic'] },
      label: 'Antenato draconico', labelEn: 'Dragon ancestor',
      options: [
        dragon('black', 'Nero', 'Black', 'Acido', 'Acid'),
        dragon('blue', 'Blu', 'Blue', 'Fulmine', 'Lightning'),
        dragon('brass', 'Ottone', 'Brass', 'Fuoco', 'Fire'),
        dragon('bronze', 'Bronzo', 'Bronze', 'Fulmine', 'Lightning'),
        dragon('copper', 'Rame', 'Copper', 'Acido', 'Acid'),
        dragon('gold', 'Oro', 'Gold', 'Fuoco', 'Fire'),
        dragon('green', 'Verde', 'Green', 'Veleno', 'Poison'),
        dragon('red', 'Rosso', 'Red', 'Fuoco', 'Fire'),
        dragon('silver', 'Argento', 'Silver', 'Freddo', 'Cold'),
        dragon('white', 'Bianco', 'White', 'Freddo', 'Cold'),
      ],
    },
    {
      key: 'metamagic', type: 'multi', minLevel: 3, replacesFeature: true,
      count: [[3, 2], [10, 3], [17, 4]],
      label: 'Metamagia', labelEn: 'Metamagic',
      hint: 'Opzioni per modificare gli incantesimi spendendo punti stregoneria.',
      hintEn: 'Options to alter your spells by spending sorcery points.',
      options: [
        mm('careful', 'Incantesimo Accurato', 'Careful Spell', '1 punto: fino a CAR creature superano automaticamente il TS contro il tuo incantesimo.', '1 point: up to Charisma-modifier creatures automatically succeed on the save against your spell.'),
        mm('distant', 'Incantesimo Distante', 'Distant Spell', '1 punto: gittata raddoppiata (tocco: 9 m).', '1 point: double the range (touch becomes 30 feet).'),
        mm('empowered', 'Incantesimo Potenziato', 'Empowered Spell', '1 punto: ritiri fino a CAR dadi di danno.', '1 point: reroll up to Charisma-modifier damage dice.'),
        mm('extended', 'Incantesimo Esteso', 'Extended Spell', '1 punto: durata raddoppiata (massimo 24 ore).', '1 point: double the duration (max 24 hours).'),
        mm('heightened', 'Incantesimo Intensificato', 'Heightened Spell', '3 punti: un bersaglio ha svantaggio al primo TS.', '3 points: one target has disadvantage on its first save.'),
        mm('quickened', 'Incantesimo Rapido', 'Quickened Spell', '2 punti: tempo di lancio da azione ad azione bonus.', '2 points: change casting time from an action to a bonus action.'),
        mm('subtle', 'Incantesimo Sottile', 'Subtle Spell', '1 punto: nessuna componente verbale o somatica.', '1 point: no verbal or somatic components.'),
        mm('twinned', 'Incantesimo Gemello', 'Twinned Spell', 'Punti pari al livello dell\'incantesimo (1 per un trucchetto): un secondo bersaglio.', 'Points equal to the spell\'s level (1 for a cantrip): target a second creature.'),
      ],
    },
  ],
};
