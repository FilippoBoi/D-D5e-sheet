/**
 * Scelte del Ladro. Fase A: Maestria (1° livello); la seconda a 6° livello
 * è già prevista dalla tabella delle quantità. L'Archetipo arriva nella fase B.
 *
 * `thievesTools`: la Maestria può cadere sugli arnesi da scasso; conta nel numero
 * di scelte ma non ha effetto sui valori (gli strumenti non sono modellati).
 */
export default {
  choices: [
    {
      key: 'expertise', type: 'skills', mode: 'expertise', minLevel: 1, replacesFeature: true,
      count: [[1, 2], [6, 4]],
      extra: [{ value: 'thievesTools', label: 'Arnesi da scasso', labelEn: 'Thieves\' tools' }],
      label: 'Maestria', labelEn: 'Expertise',
      hint: 'Abilità in cui sei competente (o arnesi da scasso).',
      hintEn: 'Skills you are proficient in (or thieves\' tools).',
    },
  ],
};
