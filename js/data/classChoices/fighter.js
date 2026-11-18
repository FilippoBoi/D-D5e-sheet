/**
 * Scelte del Guerriero. Fase A: Stile di Combattimento (1° livello).
 * Archetipo Marziale, Manovre e stile extra del Campione arrivano nelle fasi B e C.
 */
import { ALL_FIGHTING_STYLES, fightingStyleOptions } from './fightingStyles.js';

export default {
  choices: [
    {
      key: 'fightingStyle', type: 'single', minLevel: 1, replacesFeature: true,
      label: 'Stile di Combattimento', labelEn: 'Fighting Style',
      options: fightingStyleOptions(ALL_FIGHTING_STYLES),
    },
  ],
};
