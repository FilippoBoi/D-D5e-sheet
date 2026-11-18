/**
 * Scelte del Guerriero: Stile di Combattimento (1°) e Archetipo Marziale (3° livello).
 * Manovre e stile extra del Campione arrivano nella fase C.
 *
 * Effetti calcolabili: Maestro di Battaglia (dadi di superiorità e CD, in classResources.js);
 * Cavaliere Mistico (incantatore "a un terzo", INT, dal 3°).
 *
 * Da verificare: "Critico Migliorato", "Atleta Straordinario", "Stile di Combattimento Aggiuntivo",
 * "Critico Superiore", "Sopravvissuto", "Superiorità in Combattimento", "Studente della Guerra",
 * "Conosci il Tuo Nemico", "Implacabile", "Legame con l'Arma", "Magia da Guerra", "Colpo Occulto",
 * "Carica Arcana". Confermati dal progetto: "Campione", "Maestro di Battaglia", "Cavaliere Mistico".
 */
import { ALL_FIGHTING_STYLES, fightingStyleOptions } from './fightingStyles.js';

export default {
  choices: [
    {
      key: 'fightingStyle', type: 'single', minLevel: 1, replacesFeature: true,
      label: 'Stile di Combattimento', labelEn: 'Fighting Style',
      options: fightingStyleOptions(ALL_FIGHTING_STYLES),
    },
    {
      key: 'subclass', type: 'single', minLevel: 3, subclass: true,
      label: 'Archetipo Marziale', labelEn: 'Martial Archetype',
      options: [
        {
          value: 'champion', label: 'Campione', labelEn: 'Champion',
          description: 'Potenza fisica portata alla perfezione.', descriptionEn: 'Raw physical power honed to perfection.',
          features: [
            [3, 'Critico Migliorato', 'I tuoi attacchi con arma sono colpi critici con 19 o 20.', 'Improved Critical', 'Your weapon attacks score a critical hit on 19 or 20.'],
            [7, 'Atleta Straordinario', 'Aggiungi metà competenza (per eccesso) alle prove di FOR, DES e COS senza competenza; salto in lungo più ampio.',
              'Remarkable Athlete', 'Add half your proficiency (rounded up) to STR, DEX and CON checks you aren\'t proficient in; longer jumps.'],
            [10, 'Stile di Combattimento Aggiuntivo', 'Scegli un secondo Stile di Combattimento.', 'Additional Fighting Style', 'Choose a second Fighting Style.'],
            [15, 'Critico Superiore', 'I tuoi attacchi con arma sono colpi critici con 18-20.', 'Superior Critical', 'Your weapon attacks score a critical hit on 18-20.'],
            [18, 'Sopravvissuto', 'A inizio turno, con meno della metà dei PF, recuperi 5 + mod. COS PF.', 'Survivor', 'At the start of your turn with half HP or less, regain 5 + Constitution modifier HP.'],
          ],
        },
        {
          value: 'battleMaster', label: 'Maestro di Battaglia', labelEn: 'Battle Master',
          description: 'Tecniche marziali alimentate dai dadi di superiorità.', descriptionEn: 'Martial techniques fueled by superiority dice.',
          features: [
            [3, 'Superiorità in Combattimento', 'Impari manovre alimentate dai dadi di superiorità (numero, tipo di dado e CD sono in Risorse di classe). Manovre: 3 al 3°, +2 al 7°, 10° e 15°.',
              'Combat Superiority', 'Learn maneuvers fueled by superiority dice (count, die and DC are under Class resources). Maneuvers: 3 at 3rd, +2 at 7th, 10th and 15th.'],
            [3, 'Studente della Guerra', 'Competenza con un tipo di strumenti da artigiano a tua scelta.', 'Student of War', 'Proficiency with one type of artisan\'s tools.'],
            [7, 'Conosci il Tuo Nemico', 'Osservando una creatura per 1 minuto scopri come si confronta con te in alcune caratteristiche.',
              'Know Your Enemy', 'After 1 minute of observation learn how a creature compares to you in certain traits.'],
            [10, 'Superiorità in Combattimento Migliorata', 'I dadi di superiorità diventano d10.', 'Improved Combat Superiority', 'Superiority dice become d10s.'],
            [15, 'Implacabile', 'Tirando l\'iniziativa senza dadi di superiorità ne recuperi uno.', 'Relentless', 'When you roll initiative with no superiority dice, regain one.'],
            [18, 'Superiorità in Combattimento Migliorata', 'I dadi di superiorità diventano d12.', 'Improved Combat Superiority', 'Superiority dice become d12s.'],
          ],
        },
        {
          value: 'eldritchKnight', label: 'Cavaliere Mistico', labelEn: 'Eldritch Knight',
          description: 'Maestria marziale e magia da mago (Intelligenza).', descriptionEn: 'Martial mastery with wizard magic (Intelligence).',
          effects: { spellcasting: { ability: 'int', progression: 'third', minLevel: 3 } },
          features: [
            [3, 'Incantesimi', 'Lanci incantesimi da mago (soprattutto abiurazione ed evocazione) usando l\'Intelligenza: slot, CD e bonus sono nel pannello Incantesimi.',
              'Spellcasting', 'Cast wizard spells (mostly abjuration and evocation) using Intelligence: slots, DC and bonus are in the Spells panel.'],
            [3, 'Legame con l\'Arma', 'Rituale di un\'ora che ti lega a un\'arma: non può esserti disarmata e la richiami a mano.',
              'Weapon Bond', 'A one-hour ritual bonds you to a weapon: it can\'t be disarmed and you can summon it.'],
            [7, 'Magia da Guerra', 'Dopo aver lanciato un trucchetto con un\'azione, puoi attaccare con un\'arma come azione bonus.', 'War Magic', 'After casting a cantrip with an action, make a weapon attack as a bonus action.'],
            [10, 'Colpo Occulto', 'Chi colpisci con un\'arma ha svantaggio al prossimo TS contro un tuo incantesimo.', 'Eldritch Strike', 'A creature you hit has disadvantage on its next save against your spell.'],
            [15, 'Carica Arcana', 'Con Azione Impetuosa puoi teletrasportarti di 9 m.', 'Arcane Charge', 'When you use Action Surge, you can teleport up to 30 feet.'],
            [18, 'Magia da Guerra Migliorata', 'Dopo aver lanciato un incantesimo con un\'azione, puoi attaccare con un\'arma come azione bonus.', 'Improved War Magic', 'After casting a spell with an action, make a weapon attack as a bonus action.'],
          ],
        },
      ],
    },
  ],
};
