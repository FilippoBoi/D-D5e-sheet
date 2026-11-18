/**
 * Scelte del Ranger: Nemico Prescelto ed Esploratore Nato (1°), Stile di Combattimento (2°),
 * Archetipo Ranger (3° livello). Livelli dalla fonte: nemici a 1°, 6°, 14°; terreni a 1°, 6°, 10°.
 * Cacciatore: una scelta a 3°, 7°, 11° e 15° livello (descrittive).
 *
 * Da verificare: "Compagno del Ranger", "Addestramento Eccezionale", "Furia Bestiale",
 * "Condivisione degli Incantesimi", "Preda del Cacciatore", "Tattiche Difensive", "Attacco Multiplo",
 * "Difesa Superiore del Cacciatore". Confermati dal progetto: "Cacciatore", "Signore delle Bestie".
 *
 * Termini da verificare: "Mostruosità", "Fanghi", "Folletti", "Sottosuolo" (Underdark),
 * i nomi dei terreni, e le due razze umanoidi a scelta (testo libero non incluso: si sceglie
 * "Umanoidi" e la scelta delle razze va annotata nelle note).
 */
import { fightingStyleOptions } from './fightingStyles.js';

const opt = (value, label, labelEn) => ({ value, label, labelEn });
const feat = (value, label, labelEn, description, descriptionEn) => ({ value, label, labelEn, description, descriptionEn });
const hunter = (key, minLevel, featureName, featureNameEn, label, labelEn, options) => ({
  key, type: 'single', minLevel, when: { key: 'subclass', in: ['hunter'] }, featureName, featureNameEn, label, labelEn, options,
});

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
    {
      key: 'fightingStyle', type: 'single', minLevel: 2, replacesFeature: true,
      label: 'Stile di Combattimento', labelEn: 'Fighting Style',
      options: fightingStyleOptions(['archery', 'defense', 'dueling', 'twoWeapon']),
    },
    {
      key: 'subclass', type: 'single', minLevel: 3, subclass: true,
      label: 'Archetipo Ranger', labelEn: 'Ranger Archetype',
      options: [
        {
          value: 'hunter', label: 'Cacciatore', labelEn: 'Hunter',
          description: 'Baluardo tra la civiltà e i terrori della natura.', descriptionEn: 'A bulwark between civilization and the wild.',
          features: [
            [3, 'Preda del Cacciatore', 'Scegli un privilegio: Assassino di Colossi, Ammazzagiganti o Spezzatore di Orde.', 'Hunter\'s Prey', 'Choose a feature: Colossus Slayer, Giant Killer or Horde Breaker.'],
            [7, 'Tattiche Difensive', 'Scegli un privilegio: Fuga dalla Orda, Difesa Multiattacco o Volontà d\'Acciaio.', 'Defensive Tactics', 'Choose a feature: Escape the Horde, Multiattack Defense or Steel Will.'],
            [11, 'Attacco Multiplo', 'Scegli un privilegio: Raffica o Attacco a Turbine.', 'Multiattack', 'Choose a feature: Volley or Whirlwind Attack.'],
            [15, 'Difesa Superiore del Cacciatore', 'Scegli un privilegio: Elusione, Resistere alla Marea o Schivata Prodigiosa.', 'Superior Hunter\'s Defense', 'Choose a feature: Evasion, Stand Against the Tide or Uncanny Dodge.'],
          ],
        },
        {
          value: 'beastMaster', label: 'Signore delle Bestie', labelEn: 'Beast Master',
          description: 'Amicizia con una bestia compagna.', descriptionEn: 'Friendship with a beast companion.',
          features: [
            [3, 'Compagno del Ranger', 'Una bestia fedele (taglia fino a Media, GS 1/4 o meno) ti accompagna e agisce al tuo comando; usa il tuo bonus di competenza.',
              'Ranger\'s Companion', 'A loyal beast (up to Medium, CR 1/4 or less) accompanies you and acts on your command; it uses your proficiency bonus.'],
            [7, 'Addestramento Eccezionale', 'Se la bestia non attacca, comandale con azione bonus Disimpegno, Scatto, Schivata o Aiuto.',
              'Exceptional Training', 'If the beast doesn\'t attack, command it with a bonus action to Disengage, Dash, Dodge or Help.'],
            [11, 'Furia Bestiale', 'La bestia può attaccare due volte o usare Multiattacco.', 'Bestial Fury', 'The beast can attack twice or use Multiattack.'],
            [15, 'Condivisione degli Incantesimi', 'Un incantesimo su di te può colpire anche la bestia entro 9 m.', 'Share Spells', 'A spell you cast on yourself can also affect the beast within 30 feet.'],
          ],
        },
      ],
    },
    hunter('huntersPrey', 3, 'Preda del Cacciatore', 'Hunter\'s Prey', 'Preda del Cacciatore', 'Hunter\'s Prey', [
      feat('colossusSlayer', 'Assassino di Colossi', 'Colossus Slayer', '+1d8 danni una volta per turno a un bersaglio sotto il massimo dei PF.', '+1d8 damage once per turn to a target below its maximum HP.'),
      feat('giantKiller', 'Ammazzagiganti', 'Giant Killer', 'Reazione: attacchi una creatura Grande o più grande che ti attacca da 1,5 m.', 'Reaction: attack a Large or larger creature within 5 feet that attacks you.'),
      feat('hordeBreaker', 'Spezzatore di Orde', 'Horde Breaker', 'Una volta per turno, un attacco extra con la stessa arma contro un\'altra creatura vicina.', 'Once per turn, make an extra attack with the same weapon against a different nearby creature.'),
    ]),
    hunter('defensiveTactics', 7, 'Tattiche Difensive', 'Defensive Tactics', 'Tattiche Difensive', 'Defensive Tactics', [
      feat('escapeHorde', 'Fuga dalla Orda', 'Escape the Horde', 'Gli attacchi di opportunità contro di te hanno svantaggio.', 'Opportunity attacks against you have disadvantage.'),
      feat('multiattackDefense', 'Difesa Multiattacco', 'Multiattack Defense', 'Dopo essere colpito, +4 alla CA contro gli attacchi successivi di quella creatura nel turno.', 'After being hit, +4 AC against that creature\'s later attacks this turn.'),
      feat('steelWill', 'Volontà d\'Acciaio', 'Steel Will', 'Vantaggio ai TS contro la paura.', 'Advantage on saves against being frightened.'),
    ]),
    hunter('multiattack', 11, 'Attacco Multiplo', 'Multiattack', 'Attacco Multiplo', 'Multiattack', [
      feat('volley', 'Raffica', 'Volley', 'Azione: un attacco a distanza contro ogni creatura entro 3 m da un punto.', 'Action: a ranged attack against every creature within 10 feet of a point.'),
      feat('whirlwindAttack', 'Attacco a Turbine', 'Whirlwind Attack', 'Azione: un attacco in mischia contro ogni creatura entro 1,5 m.', 'Action: a melee attack against every creature within 5 feet.'),
    ]),
    hunter('superiorDefense', 15, 'Difesa Superiore del Cacciatore', 'Superior Hunter\'s Defense', 'Difesa Superiore del Cacciatore', 'Superior Hunter\'s Defense', [
      feat('evasion', 'Elusione', 'Evasion', 'TS su DES riusciti: nessun danno; falliti: metà.', 'Successful Dexterity saves: no damage; failed: half.'),
      feat('standAgainstTide', 'Resistere alla Marea', 'Stand Against the Tide', 'Reazione: un attacco in mischia mancato viene ripetuto contro un\'altra creatura.', 'Reaction: a missed melee attack is repeated against another creature.'),
      feat('uncannyDodge', 'Schivata Prodigiosa', 'Uncanny Dodge', 'Reazione: dimezzi i danni di un attacco che ti colpisce.', 'Reaction: halve the damage of an attack that hits you.'),
    ]),
  ],
};
