/**
 * Scelte del Monaco: Tradizione Monastica (3° livello) e, per i Quattro Elementi, le Discipline
 * Elementali: 1 al 3°, +1 al 6°, 11° e 17° (Sintonia Elementale è sempre nota e non si sceglie).
 * Le discipline con prerequisito di livello (6°, 11°, 17°) si scelgono solo da quel livello.
 *
 * Da verificare i nomi italiani delle 16 discipline.
 *
 * Da verificare: "Tecnica della Mano Aperta", "Interezza del Corpo", "Tranquillità", "Palmo Tremante",
 * "Arti d'Ombra", "Passo d'Ombra", "Mantello d'Ombra", "Opportunista", "Discepolo degli Elementi",
 * "Disciplina Elementale Extra". Confermati dal progetto: "Mano Aperta", "Ombra", "Quattro Elementi".
 */
const ed = (value, label, labelEn, description, descriptionEn, level) => ({
  value, label, labelEn, description, descriptionEn, ...(level ? { prereq: { level } } : {}),
});

export default {
  choices: [
    {
      key: 'subclass', type: 'single', minLevel: 3, subclass: true,
      label: 'Tradizione Monastica', labelEn: 'Monastic Tradition',
      options: [
        {
          value: 'openHand', label: 'Mano Aperta', labelEn: 'Open Hand',
          description: 'Maestri delle arti marziali, armati o a mani nude.', descriptionEn: 'Masters of martial arts, armed or unarmed.',
          features: [
            [3, 'Tecnica della Mano Aperta', 'Con Raffica di Colpi puoi far cadere a terra, spingere di 4,5 m o impedire reazioni al bersaglio.',
              'Open Hand Technique', 'With Flurry of Blows you can knock prone, push 15 feet or deny reactions.'],
            [6, 'Interezza del Corpo', 'Azione: recuperi PF pari a 3 × livello da monaco, una volta per riposo lungo.', 'Wholeness of Body', 'Action: regain 3 × monk level HP, once per long rest.'],
            [11, 'Tranquillità', 'Ottieni gli effetti di Santuario dopo ogni riposo lungo.', 'Tranquility', 'Gain the effects of Sanctuary after each long rest.'],
            [17, 'Palmo Tremante', 'Con 3 punti ki innesci vibrazioni letali in una creatura colpita a mani nude.', 'Quivering Palm', 'Spend 3 ki to set up lethal vibrations in a creature you hit unarmed.'],
          ],
        },
        {
          value: 'shadow', label: 'Ombra', labelEn: 'Shadow',
          description: 'Furtività e inganno, come ninja.', descriptionEn: 'Stealth and subterfuge, like ninjas.',
          features: [
            [3, 'Arti d\'Ombra', 'Con 2 punti ki duplichi Oscurità, Scurovisione, Passare senza Tracce o Silenzio; ottieni il trucchetto Illusione Minore.',
              'Shadow Arts', 'Spend 2 ki to cast Darkness, Darkvision, Pass without Trace or Silence; gain the Minor Illusion cantrip.'],
            [6, 'Passo d\'Ombra', 'Azione bonus: ti teletrasporti di 18 m da un\'ombra a un\'altra.', 'Shadow Step', 'Bonus action: teleport up to 60 feet between dim or dark areas.'],
            [11, 'Mantello d\'Ombra', 'Con luce fioca o buio ti rendi invisibile finché non attacchi o lanci incantesimi.', 'Cloak of Shadows', 'In dim light or darkness you become invisible until you attack or cast.'],
            [17, 'Opportunista', 'Reazione: attacco in mischia contro una creatura vicina colpita da un alleato.', 'Opportunist', 'Reaction: melee attack against a nearby creature hit by an ally.'],
          ],
        },
        {
          value: 'fourElements', label: 'Quattro Elementi', labelEn: 'Four Elements',
          description: 'Discipline che incanalano gli elementi con i punti ki.', descriptionEn: 'Disciplines that channel the elements with ki.',
          features: [
            [3, 'Discepolo degli Elementi', 'Conosci Sintonia Elementale e una disciplina elementale a tua scelta; le discipline costano punti ki.',
              'Disciple of the Elements', 'You know Elemental Attunement and one elemental discipline of your choice; disciplines cost ki.'],
            [6, 'Disciplina Elementale Extra', 'Impari una disciplina in più.', 'Extra Elemental Discipline', 'Learn one more discipline.'],
            [11, 'Disciplina Elementale Extra', 'Impari una disciplina in più.', 'Extra Elemental Discipline', 'Learn one more discipline.'],
            [17, 'Disciplina Elementale Extra', 'Impari una disciplina in più.', 'Extra Elemental Discipline', 'Learn one more discipline.'],
          ],
        },
      ],
    },
    {
      key: 'disciplines', type: 'multi', minLevel: 3, count: [[3, 1], [6, 2], [11, 3], [17, 4]],
      when: { key: 'subclass', in: ['fourElements'] },
      featureName: 'Discepolo degli Elementi', featureNameEn: 'Disciple of the Elements',
      label: 'Discipline Elementali', labelEn: 'Elemental Disciplines',
      hint: 'Oltre a Sintonia Elementale, sempre nota. Costano punti ki.', hintEn: 'In addition to Elemental Attunement, which you always know. They cost ki.',
      options: [
        ed('fangsFireSnake', 'Zanne del Serpente di Fuoco', 'Fangs of the Fire Snake', 'Il colpo senz\'armi ha portata 3 m e infligge danni da fuoco (1 ki).', 'Unarmed strikes reach 10 feet and deal fire damage (1 ki).'),
        ed('fistFourThunders', 'Pugno dei Quattro Tuoni', 'Fist of Four Thunders', 'Lanci Onda Tonante (2 ki).', 'Cast Thunderwave (2 ki).'),
        ed('fistUnbrokenAir', 'Pugno dell\'Aria Ininterrotta', 'Fist of Unbroken Air', 'Un\'ondata d\'aria colpisce una creatura entro 9 m (2 ki o più).', 'A blast of air hits a creature within 30 feet (2 ki or more).'),
        ed('rushGaleSpirits', 'Impeto degli Spiriti del Vento', 'Rush of the Gale Spirits', 'Lanci Folata di Vento (2 ki).', 'Cast Gust of Wind (2 ki).'),
        ed('shapeFlowingRiver', 'Plasmare il Fiume che Scorre', 'Shape the Flowing River', 'Modelli acqua e ghiaccio in un cubo di 9 m (1 ki).', 'Shape water and ice in a 30-foot cube (1 ki).'),
        ed('sweepingCinderStrike', 'Colpo Spazzante di Cenere', 'Sweeping Cinder Strike', 'Lanci Mani Brucianti (2 ki).', 'Cast Burning Hands (2 ki).'),
        ed('waterWhip', 'Frusta d\'Acqua', 'Water Whip', 'Una frusta d\'acqua trascina o fa cadere un bersaglio entro 9 m (2 ki o più).', 'A water whip pulls or knocks down a target within 30 feet (2 ki or more).'),
        ed('clenchNorthWind', 'Stretta del Vento del Nord', 'Clench of the North Wind', 'Lanci Blocca Persone (3 ki).', 'Cast Hold Person (3 ki).', 6),
        ed('gongSummit', 'Gong della Vetta', 'Gong of the Summit', 'Lanci Frantumare (3 ki).', 'Cast Shatter (3 ki).', 6),
        ed('flamesPhoenix', 'Fiamme della Fenice', 'Flames of the Phoenix', 'Lanci Palla di Fuoco (4 ki).', 'Cast Fireball (4 ki).', 11),
        ed('mistStance', 'Posizione della Nebbia', 'Mist Stance', 'Lanci Forma Gassosa su te stesso (4 ki).', 'Cast Gaseous Form on yourself (4 ki).', 11),
        ed('rideWind', 'Cavalcare il Vento', 'Ride the Wind', 'Lanci Volare su te stesso (4 ki).', 'Cast Fly on yourself (4 ki).', 11),
        ed('breathWinter', 'Soffio dell\'Inverno', 'Breath of Winter', 'Lanci Cono di Freddo (6 ki).', 'Cast Cone of Cold (6 ki).', 17),
        ed('eternalMountainDefense', 'Difesa della Montagna Eterna', 'Eternal Mountain Defense', 'Lanci Pelle di Pietra su te stesso (5 ki).', 'Cast Stoneskin on yourself (5 ki).', 17),
        ed('riverHungryFlame', 'Fiume di Fiamma Affamata', 'River of Hungry Flame', 'Lanci Muro di Fuoco (5 ki).', 'Cast Wall of Fire (5 ki).', 17),
        ed('waveRollingEarth', 'Onda di Terra Rotolante', 'Wave of Rolling Earth', 'Lanci Muro di Pietra (6 ki).', 'Cast Wall of Stone (6 ki).', 17),
      ],
    },
  ],
};
