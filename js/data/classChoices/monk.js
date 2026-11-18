/**
 * Scelte del Monaco: Tradizione Monastica (3° livello). Le Discipline Elementali (3°, 6°, 11°, 17°)
 * arrivano nella fase C: qui compaiono come privilegi descrittivi.
 *
 * Da verificare: "Tecnica della Mano Aperta", "Interezza del Corpo", "Tranquillità", "Palmo Tremante",
 * "Arti d'Ombra", "Passo d'Ombra", "Mantello d'Ombra", "Opportunista", "Discepolo degli Elementi",
 * "Disciplina Elementale Extra". Confermati dal progetto: "Mano Aperta", "Ombra", "Quattro Elementi".
 */
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
  ],
};
