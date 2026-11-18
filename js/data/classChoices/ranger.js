/**
 * Scelte del Ranger. Fase A: Nemico Prescelto ed Esploratore Nato (1° livello).
 * Livelli dalla fonte: nemici a 1°, 6°, 14°; terreni a 1°, 6°, 10°.
 * Stile di Combattimento (2°) e Archetipo (3°) arrivano nelle fasi B e C.
 *
 * Termini da verificare: "Mostruosità", "Fanghi", "Folletti", "Sottosuolo" (Underdark),
 * i nomi dei terreni, e le due razze umanoidi a scelta (testo libero non incluso: si sceglie
 * "Umanoidi" e la scelta delle razze va annotata nelle note).
 */
const opt = (value, label, labelEn) => ({ value, label, labelEn });

export default {
  choices: [
    {
      key: 'favoredEnemy', type: 'multi', minLevel: 1, replacesFeature: true,
      count: [[1, 1], [6, 2], [14, 3]],
      label: 'Nemico Prescelto', labelEn: 'Favored Enemy',
      hint: 'Un tipo di nemico (e una lingua associata) per ogni scelta.',
      hintEn: 'One enemy type (and an associated language) per choice.',
      options: [
        opt('aberrations', 'Aberrazioni', 'Aberrations'), opt('beasts', 'Bestie', 'Beasts'),
        opt('celestials', 'Celestiali', 'Celestials'), opt('constructs', 'Costrutti', 'Constructs'),
        opt('dragons', 'Draghi', 'Dragons'), opt('elementals', 'Elementali', 'Elementals'),
        opt('fey', 'Folletti', 'Fey'), opt('fiends', 'Immondi', 'Fiends'),
        opt('giants', 'Giganti', 'Giants'), opt('monstrosities', 'Mostruosità', 'Monstrosities'),
        opt('oozes', 'Fanghi', 'Oozes'), opt('plants', 'Vegetali', 'Plants'),
        opt('undead', 'Non Morti', 'Undead'), opt('humanoids', 'Umanoidi (due razze)', 'Humanoids (two races)'),
      ],
    },
    {
      key: 'favoredTerrain', type: 'multi', minLevel: 1, replacesFeature: true,
      count: [[1, 1], [6, 2], [10, 3]],
      label: 'Esploratore Nato', labelEn: 'Natural Explorer',
      hint: 'Un terreno prescelto per ogni scelta.', hintEn: 'One favored terrain per choice.',
      options: [
        opt('arctic', 'Artico', 'Arctic'), opt('coast', 'Costa', 'Coast'),
        opt('desert', 'Deserto', 'Desert'), opt('forest', 'Foresta', 'Forest'),
        opt('grassland', 'Prateria', 'Grassland'), opt('mountain', 'Montagna', 'Mountain'),
        opt('swamp', 'Palude', 'Swamp'), opt('underdark', 'Sottosuolo (Underdark)', 'Underdark'),
      ],
    },
  ],
};
