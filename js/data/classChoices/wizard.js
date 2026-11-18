/**
 * Scelte del Mago: Tradizione Arcana (2° livello), 8 scuole del PHB (5e.tools).
 *
 * ATTENZIONE termini: il progetto chiama "Evocazione" la scuola Evocation. Nel PHB italiano
 * ufficiale le due scuole Conjuration/Evocation potrebbero essere rese in modo diverso
 * ("Evocazione"/"Invocazione"): qui Conjuration è "Convocazione", provvisorio e da verificare.
 * Da verificare anche: "Studioso di …" (Savant), "Barriera Arcana", "Barriera Proiettata",
 * "Abiurazione Migliorata", "Resistenza agli Incantesimi", "Evocazione Minore", "Trasposizione Benigna",
 * "Evocazione Concentrata", "Evocazioni Durature", "Presagio", "Divinazione Esperta", "Terzo Occhio",
 * "Presagio Superiore", "Sguardo Ipnotico", "Fascino Istintivo", "Ammaliamento Diviso", "Alterare Memorie",
 * "Plasmare Incantesimi", "Trucchetto Potente", "Evocazione Potenziata", "Sovraccarico", "Illusione Minore Migliorata",
 * "Illusioni Malleabili", "Sé Illusorio", "Realtà Illusoria", "Mietitura Macabra", "Servi Non Morti",
 * "Immunizzato alla Non Morte", "Comandare Non Morti", "Alchimia Minore", "Pietra del Trasmutatore",
 * "Mutaforma", "Maestro Trasmutatore".
 */
const savant = (school, schoolEn) => [2, `Studioso di ${school}`, `Dimezzi costo e tempo per copiare nel libro un incantesimo di ${school.toLowerCase()}.`,
  `${schoolEn} Savant`, `Halve the gold and time to copy a ${schoolEn.toLowerCase()} spell into your spellbook.`];

const school = (value, label, labelEn, description, descriptionEn, features) => ({
  value, label, labelEn, description, descriptionEn, features,
});

export default {
  choices: [
    {
      key: 'subclass', type: 'single', minLevel: 2, subclass: true,
      label: 'Tradizione Arcana', labelEn: 'Arcane Tradition',
      options: [
        school('abjuration', 'Abiurazione', 'Abjuration', 'Magia che blocca, scaccia e protegge.', 'Magic that blocks, banishes and protects.', [
          savant('Abiurazione', 'Abjuration'),
          [2, 'Barriera Arcana', 'Una barriera con PF pari a 2 × livello da mago + mod. INT assorbe i danni al posto tuo; si ricarica con gli incantesimi di abiurazione.',
            'Arcane Ward', 'A ward with 2 × wizard level + Intelligence modifier HP absorbs damage for you; abjuration spells recharge it.'],
          [6, 'Barriera Proiettata', 'Reazione: la barriera assorbe i danni di una creatura entro 9 m.', 'Projected Ward', 'Reaction: the ward absorbs damage to a creature within 30 feet.'],
          [10, 'Abiurazione Migliorata', 'Aggiungi la competenza alle prove richieste dai tuoi incantesimi di abiurazione.', 'Improved Abjuration', 'Add your proficiency bonus to checks required by your abjuration spells.'],
          [14, 'Resistenza agli Incantesimi', 'Vantaggio ai TS contro gli incantesimi e resistenza ai loro danni.', 'Spell Resistance', 'Advantage on saves against spells and resistance to spell damage.'],
        ]),
        school('conjuration', 'Convocazione', 'Conjuration', 'Magia che crea oggetti e creature.', 'Magic that produces objects and creatures.', [
          savant('Convocazione', 'Conjuration'),
          [2, 'Evocazione Minore', 'Azione: crei un oggetto inanimato non magico (fino a 90 cm e 4,5 kg) che dura 1 ora.', 'Minor Conjuration', 'Action: conjure a nonmagical inanimate object (up to 3 feet, 10 lb) for 1 hour.'],
          [6, 'Trasposizione Benigna', 'Azione: ti teletrasporti di 9 m o scambi posto con una creatura volontaria; si ricarica con un incantesimo di convocazione.',
            'Benign Transposition', 'Action: teleport 30 feet or swap places with a willing creature; recharges when you cast a conjuration spell.'],
          [10, 'Evocazione Concentrata', 'La concentrazione su un incantesimo di convocazione non si rompe per i danni.', 'Focused Conjuration', 'Damage can\'t break your concentration on a conjuration spell.'],
          [14, 'Evocazioni Durature', 'Le creature evocate hanno 30 PF temporanei.', 'Durable Summons', 'Creatures you summon have 30 temporary HP.'],
        ]),
        school('divination', 'Divinazione', 'Divination', 'Magia che svela passato, presente e futuro.', 'Magic that reveals past, present and future.', [
          savant('Divinazione', 'Divination'),
          [2, 'Presagio', 'Dopo un riposo lungo tiri due d20: puoi sostituirne uno a un tiro di una creatura che vedi.', 'Portent', 'After a long rest roll two d20s: swap one for a roll made by a creature you can see.'],
          [6, 'Divinazione Esperta', 'Lanciando una divinazione di 2° o più recuperi uno slot inferiore.', 'Expert Divination', 'Casting a 2nd-level or higher divination spell restores a lower slot.'],
          [10, 'Terzo Occhio', 'Azione: scurovisione, vista eterea, lettura di ogni lingua o vista dell\'invisibile.', 'The Third Eye', 'Action: darkvision, ethereal sight, read any language or see invisibility.'],
          [14, 'Presagio Superiore', 'Tiri tre d20 per Presagio.', 'Greater Portent', 'Roll three d20s for Portent.'],
        ]),
        school('enchantment', 'Ammaliamento', 'Enchantment', 'Magia che incanta e seduce.', 'Magic that entrances and beguiles.', [
          savant('Ammaliamento', 'Enchantment'),
          [2, 'Sguardo Ipnotico', 'Azione: una creatura entro 1,5 m resta affascinata e incapacitata finché resti vicino e non attacchi.', 'Hypnotic Gaze', 'Action: a creature within 5 feet is charmed and incapacitated while you stay near and don\'t attack.'],
          [6, 'Fascino Istintivo', 'Reazione: dirotti un attacco contro di te su un\'altra creatura.', 'Instinctive Charm', 'Reaction: redirect an attack against you to another creature.'],
          [10, 'Ammaliamento Diviso', 'Un incantesimo di ammaliamento a bersaglio singolo ne colpisce un secondo.', 'Split Enchantment', 'A single-target enchantment spell can target a second creature.'],
          [14, 'Alterare Memorie', 'Una creatura affascinata non sa di esserlo e puoi cancellarne dei ricordi.', 'Alter Memories', 'A charmed creature is unaware of it and you can erase some of its memory.'],
        ]),
        school('evocation', 'Evocazione', 'Evocation', 'Magia che crea potenti effetti elementali.', 'Magic that creates powerful elemental effects.', [
          savant('Evocazione', 'Evocation'),
          [2, 'Plasmare Incantesimi', 'Le creature che scegli superano automaticamente i TS contro le tue evocazioni e non subiscono danni.', 'Sculpt Spells', 'Chosen creatures automatically save against your evocation spells and take no damage.'],
          [6, 'Trucchetto Potente', 'I trucchetti che infliggono danni fanno metà danni anche a chi supera il TS.', 'Potent Cantrip', 'Damaging cantrips deal half damage even on a successful save.'],
          [10, 'Evocazione Potenziata', 'Aggiungi il mod. INT ai danni di un\'evocazione da mago.', 'Empowered Evocation', 'Add your Intelligence modifier to one damage roll of a wizard evocation spell.'],
          [14, 'Sovraccarico', 'Incantesimi di 1°-5° livello fanno il massimo dei danni; dal secondo uso subisci danni.', 'Overchannel', 'Spells of 1st-5th level deal maximum damage; from the second use you take damage.'],
        ]),
        school('illusion', 'Illusione', 'Illusion', 'Magia che inganna i sensi.', 'Magic that deceives the senses.', [
          savant('Illusione', 'Illusion'),
          [2, 'Illusione Minore Migliorata', 'Impari Illusione Minore e puoi creare insieme suono e immagine.', 'Improved Minor Illusion', 'You learn Minor Illusion and can create both a sound and an image with it.'],
          [6, 'Illusioni Malleabili', 'Con un\'azione modifichi un\'illusione di durata 1 minuto o più.', 'Malleable Illusions', 'Use an action to change an illusion with a duration of 1 minute or longer.'],
          [10, 'Sé Illusorio', 'Reazione: un doppio illusorio fa mancare un attacco, una volta per riposo.', 'Illusory Self', 'Reaction: an illusory duplicate makes an attack miss, once per rest.'],
          [14, 'Realtà Illusoria', 'Un oggetto di un\'illusione diventa reale per 1 minuto.', 'Illusory Reality', 'An object in an illusion becomes real for 1 minute.'],
        ]),
        school('necromancy', 'Necromanzia', 'Necromancy', 'Magia di vita, morte e non morte.', 'Magic of life, death and undeath.', [
          savant('Necromanzia', 'Necromancy'),
          [2, 'Mietitura Macabra', 'Uccidendo con un incantesimo recuperi PF pari a 2 × il livello dell\'incantesimo (3 × se è di necromanzia).', 'Grim Harvest', 'Killing with a spell restores HP equal to 2 × the spell\'s level (3 × for necromancy).'],
          [6, 'Servi Non Morti', 'Animare Morti ha un bersaglio in più e le creature animate hanno PF e danni aumentati.', 'Undead Thralls', 'Animate Dead targets one extra creature; your undead gain extra HP and damage.'],
          [10, 'Immunizzato alla Non Morte', 'Resistenza ai danni necrotici; i tuoi PF massimi non possono essere ridotti.', 'Inured to Undeath', 'Resistance to necrotic damage; your hit point maximum can\'t be reduced.'],
          [14, 'Comandare Non Morti', 'Prendi il controllo di un non morto (TS su CAR).', 'Command Undead', 'Take control of an undead creature (Charisma save).'],
        ]),
        school('transmutation', 'Trasmutazione', 'Transmutation', 'Magia che modifica energia e materia.', 'Magic that modifies energy and matter.', [
          savant('Trasmutazione', 'Transmutation'),
          [2, 'Alchimia Minore', 'Modifichi per 1 ora il materiale di un oggetto non magico.', 'Minor Alchemy', 'Alter a nonmagical object\'s material for 1 hour.'],
          [6, 'Pietra del Trasmutatore', 'Crei una pietra che concede un beneficio a scelta (scurovisione, velocità, competenza COS o resistenza).', 'Transmuter\'s Stone', 'Create a stone that grants a chosen benefit (darkvision, speed, Constitution proficiency or resistance).'],
          [10, 'Mutaforma', 'Hai Metamorfosi nel libro e la lanci senza slot su te stesso.', 'Shapechanger', 'Polymorph is in your spellbook and you can cast it on yourself without a slot.'],
          [14, 'Maestro Trasmutatore', 'Consumi la pietra per un effetto potente (ringiovanire, riportare in vita, trasformare, guarire).', 'Master Transmuter', 'Consume the stone for a powerful effect (rejuvenate, raise dead, transform, heal).'],
        ]),
      ],
    },
  ],
};
