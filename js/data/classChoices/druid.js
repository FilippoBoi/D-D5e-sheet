/**
 * Scelte del Druido: Circolo Druidico (2° livello). Circolo della Terra: terreno a scelta.
 * Gli incantesimi del circolo sono citati nel testo, non strutturati (fuori ambito).
 *
 * Effetto calcolabile: Circolo della Luna, GS massimo della Forma Selvatica (vedi classResources.js).
 *
 * Da verificare: "Trucchetto Bonus", "Incantesimi del Circolo", "Recupero Naturale", "Passo della Terra",
 * "Protezione della Natura", "Santuario della Natura", "Forme del Circolo", "Forma Selvatica da Combattimento",
 * "Colpo Primordiale", "Forma Selvatica Elementale", "Mille Forme", "Sottosuolo (Underdark)".
 */
const opt = (value, label, labelEn) => ({
  value, label, labelEn,
  description: 'Incantesimi del circolo legati a questo terreno (3°, 5°, 7° e 9° livello).',
  descriptionEn: 'Circle spells tied to this land (3rd, 5th, 7th and 9th level).',
});

export default {
  choices: [
    {
      key: 'subclass', type: 'single', minLevel: 2, subclass: true,
      label: 'Circolo Druidico', labelEn: 'Druid Circle',
      options: [
        {
          value: 'land', label: 'Terra', labelEn: 'Land',
          description: 'Mistici custodi dei riti e del sapere antico.', descriptionEn: 'Mystics who guard ancient rites and lore.',
          features: [
            [2, 'Trucchetto Bonus', 'Impari un trucchetto da druido in più.', 'Bonus Cantrip', 'Learn one extra druid cantrip.'],
            [2, 'Recupero Naturale', 'Durante un riposo breve recuperi slot spesi per un totale pari a metà livello da druido (arrotondato per eccesso, massimo 5° livello), una volta per riposo lungo.',
              'Natural Recovery', 'During a short rest recover expended slots totaling half your druid level (rounded up, none above 5th), once per long rest.'],
            [2, 'Incantesimi del Circolo', 'Il terreno scelto ti dà incantesimi sempre preparati a 3°, 5°, 7° e 9° livello.',
              'Circle Spells', 'Your chosen land gives you always-prepared spells at 3rd, 5th, 7th and 9th level.'],
            [6, 'Passo della Terra', 'Muoverti nel terreno difficile non magico non costa movimento extra; le piante non magiche non ti rallentano.',
              'Land\'s Stride', 'Nonmagical difficult terrain costs no extra movement; nonmagical plants don\'t slow you.'],
            [10, 'Protezione della Natura', 'Immune a veleno e malattie; non puoi essere affascinato né spaventato da elementali e folletti.',
              'Nature\'s Ward', 'Immune to poison and disease; can\'t be charmed or frightened by elementals and fey.'],
            [14, 'Santuario della Natura', 'Bestie e vegetali che ti attaccano devono superare un TS su SAG o scegliere un altro bersaglio.',
              'Nature\'s Sanctuary', 'Beasts and plants that attack you must pass a Wisdom save or pick another target.'],
          ],
        },
        {
          value: 'moon', label: 'Luna', labelEn: 'Moon',
          description: 'Feroci guardiani che si trasformano in bestie temibili.', descriptionEn: 'Fierce guardians who take dangerous beast forms.',
          features: [
            [2, 'Forme del Circolo', 'Forma Selvatica in bestie con GS fino a 1 (poi livello ÷ 3 dal 6°), ignorando la colonna GS massimo; restano i limiti di nuoto e volo.',
              'Circle Forms', 'Wild Shape into beasts up to CR 1 (then level ÷ 3 from 6th), ignoring the Max. CR column; swim and fly limits still apply.'],
            [2, 'Forma Selvatica da Combattimento', 'Forma Selvatica come azione bonus; mentre sei trasformato puoi spendere uno slot per recuperare 1d8 PF per livello dello slot.',
              'Combat Wild Shape', 'Wild Shape as a bonus action; while transformed spend a slot to heal 1d8 per slot level.'],
            [6, 'Colpo Primordiale', 'I tuoi attacchi in forma di bestia contano come magici.', 'Primal Strike', 'Your beast-form attacks count as magical.'],
            [10, 'Forma Selvatica Elementale', 'Spendi due usi di Forma Selvatica per trasformarti in un elementale.', 'Elemental Wild Shape', 'Spend two Wild Shape uses to become an elemental.'],
            [14, 'Mille Forme', 'Puoi lanciare Alterare Se Stesso a volontà.', 'Thousand Forms', 'You can cast Alter Self at will.'],
          ],
        },
      ],
    },
    {
      key: 'landTerrain', type: 'single', minLevel: 2,
      when: { key: 'subclass', in: ['land'] },
      featureName: 'Incantesimi del Circolo', featureNameEn: 'Circle Spells',
      label: 'Terreno del Circolo', labelEn: 'Circle land',
      options: [
        opt('arctic', 'Artico', 'Arctic'), opt('coast', 'Costa', 'Coast'), opt('desert', 'Deserto', 'Desert'),
        opt('forest', 'Foresta', 'Forest'), opt('grassland', 'Prateria', 'Grassland'),
        opt('mountain', 'Montagna', 'Mountain'), opt('swamp', 'Palude', 'Swamp'),
        opt('underdark', 'Sottosuolo (Underdark)', 'Underdark'),
      ],
    },
  ],
};
