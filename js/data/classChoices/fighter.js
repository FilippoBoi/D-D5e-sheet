/**
 * Scelte del Guerriero: Stile di Combattimento (1°), Archetipo Marziale (3°), stile extra del Campione (10°),
 * strumento e Manovre del Maestro di Battaglia (3 al 3°, +2 al 7°, 10° e 15°).
 * Lo stile extra deve essere diverso dal primo (`differsFrom`).
 *
 * Da verificare i nomi italiani delle 16 manovre e degli strumenti da artigiano (solo fabbro, birraio e
 * muratore sono già nel progetto, tra le scelte razziali del Nano).
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

const mv = (value, label, labelEn, description, descriptionEn) => ({ value, label, labelEn, description, descriptionEn });
const tool = (value, label, labelEn) => ({ value, label: `Attrezzi da ${label}`, labelEn: `${labelEn}` });

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
    {
      key: 'fightingStyle2', type: 'single', minLevel: 10, differsFrom: 'fightingStyle', replacesFeature: true,
      when: { key: 'subclass', in: ['champion'] },
      featureName: 'Stile di Combattimento Aggiuntivo', featureNameEn: 'Additional Fighting Style',
      label: 'Stile di Combattimento aggiuntivo', labelEn: 'Additional Fighting Style',
      options: fightingStyleOptions(ALL_FIGHTING_STYLES),
    },
    {
      key: 'studentTool', type: 'single', minLevel: 3,
      when: { key: 'subclass', in: ['battleMaster'] },
      featureName: 'Studente della Guerra', featureNameEn: 'Student of War',
      label: 'Studente della Guerra: strumento', labelEn: 'Student of War: tool',
      options: [
        tool('alchemist', 'alchimista', 'Alchemist\'s supplies'), tool('brewer', 'birraio', 'Brewer\'s supplies'),
        tool('calligrapher', 'calligrafo', 'Calligrapher\'s supplies'), tool('carpenter', 'carpentiere', 'Carpenter\'s tools'),
        tool('cartographer', 'cartografo', 'Cartographer\'s tools'), tool('cobbler', 'calzolaio', 'Cobbler\'s tools'),
        tool('cook', 'cuoco', 'Cook\'s utensils'), tool('glassblower', 'soffiatore di vetro', 'Glassblower\'s tools'),
        tool('jeweler', 'gioielliere', 'Jeweler\'s tools'), tool('leatherworker', 'conciatore', 'Leatherworker\'s tools'),
        tool('mason', 'muratore', 'Mason\'s tools'), tool('painter', 'pittore', 'Painter\'s supplies'),
        tool('potter', 'vasaio', 'Potter\'s tools'), tool('smith', 'fabbro', 'Smith\'s tools'),
        tool('tinker', 'stagnino', 'Tinker\'s tools'), tool('weaver', 'tessitore', 'Weaver\'s tools'),
        tool('woodcarver', 'intagliatore', 'Woodcarver\'s tools'),
      ],
    },
    {
      key: 'maneuvers', type: 'multi', minLevel: 3, count: [[3, 3], [7, 5], [10, 7], [15, 9]],
      when: { key: 'subclass', in: ['battleMaster'] },
      featureName: 'Superiorità in Combattimento', featureNameEn: 'Combat Superiority',
      label: 'Manovre', labelEn: 'Maneuvers',
      hint: 'Ogni manovra spende un dado di superiorità; CD e dadi sono in Risorse di classe.',
      hintEn: 'Each maneuver spends a superiority die; DC and dice are under Class resources.',
      options: [
        mv('commandersStrike', 'Colpo del Comandante', 'Commander\'s Strike', 'Rinunci a un attacco: un alleato attacca con la reazione, con il dado ai danni.', 'Forgo an attack: an ally attacks as a reaction, adding the die to damage.'),
        mv('disarmingAttack', 'Attacco Disarmante', 'Disarming Attack', 'Dado ai danni; il bersaglio fa un TS su FOR o lascia cadere un oggetto.', 'Add the die to damage; the target makes a Strength save or drops an item.'),
        mv('distractingStrike', 'Colpo Distraente', 'Distracting Strike', 'Dado ai danni; il prossimo attacco di un alleato contro il bersaglio ha vantaggio.', 'Add the die to damage; an ally\'s next attack against the target has advantage.'),
        mv('evasiveFootwork', 'Gioco di Gambe Evasivo', 'Evasive Footwork', 'Muovendoti aggiungi il dado alla CA.', 'While moving, add the die to your AC.'),
        mv('feintingAttack', 'Attacco Finto', 'Feinting Attack', 'Azione bonus: vantaggio al prossimo attacco, con il dado ai danni.', 'Bonus action: advantage on your next attack, adding the die to damage.'),
        mv('goadingAttack', 'Attacco Provocatorio', 'Goading Attack', 'Dado ai danni; TS su SAG o il bersaglio ha svantaggio ad attaccare altri.', 'Add the die to damage; Wisdom save or the target has disadvantage attacking others.'),
        mv('lungingAttack', 'Attacco in Affondo', 'Lunging Attack', 'Portata di +1,5 m per un attacco, con il dado ai danni.', '+5 feet of reach for one attack, adding the die to damage.'),
        mv('maneuveringAttack', 'Attacco Manovrato', 'Maneuvering Attack', 'Dado ai danni; un alleato si muove con la reazione senza provocare.', 'Add the die to damage; an ally moves as a reaction without provoking.'),
        mv('menacingAttack', 'Attacco Minaccioso', 'Menacing Attack', 'Dado ai danni; TS su SAG o il bersaglio è spaventato.', 'Add the die to damage; Wisdom save or the target is frightened.'),
        mv('parry', 'Parata', 'Parry', 'Reazione: riduci i danni subiti del dado + mod. DES.', 'Reaction: reduce damage taken by the die + Dexterity modifier.'),
        mv('precisionAttack', 'Attacco di Precisione', 'Precision Attack', 'Aggiungi il dado a un tiro per colpire.', 'Add the die to an attack roll.'),
        mv('pushingAttack', 'Attacco Spintonante', 'Pushing Attack', 'Dado ai danni; TS su FOR o il bersaglio è spinto di 4,5 m.', 'Add the die to damage; Strength save or the target is pushed 15 feet.'),
        mv('rally', 'Incitamento', 'Rally', 'Azione bonus: un alleato ottiene PF temporanei pari al dado + mod. CAR.', 'Bonus action: an ally gains temporary HP equal to the die + Charisma modifier.'),
        mv('riposte', 'Risposta', 'Riposte', 'Reazione: se una creatura ti manca, la attacchi con il dado ai danni.', 'Reaction: when a creature misses you, attack it, adding the die to damage.'),
        mv('sweepingAttack', 'Attacco Spazzante', 'Sweeping Attack', 'Se colpisci, una seconda creatura adiacente subisce danni pari al dado.', 'On a hit, a second adjacent creature takes damage equal to the die.'),
        mv('tripAttack', 'Attacco a Sgambetto', 'Trip Attack', 'Dado ai danni; TS su FOR o il bersaglio cade prono.', 'Add the die to damage; Strength save or the target is knocked prone.'),
      ],
    },
  ],
};
