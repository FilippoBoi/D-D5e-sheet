/**
 * Scelte del Paladino: Stile di Combattimento (2°) e Giuramento Sacro (3° livello).
 * Gli incantesimi del giuramento sono citati nel testo, non strutturati (fuori ambito).
 *
 * Da verificare: "Arma Sacra", "Scacciare gli Empi", "Aura di Devozione", "Purezza di Spirito",
 * "Aureola Sacra", "Ira della Natura", "Scacciare i Senza Fede", "Aura di Salvaguardia",
 * "Sentinella Immortale", "Campione Anziano", "Abiurare il Nemico", "Voto di Inimicizia",
 * "Vendicatore Implacabile", "Anima della Vendetta", "Angelo Vendicatore", "Incanalare Divinità".
 * Confermati dal progetto: "Devozione", "Antichi", "Vendetta".
 */
import { fightingStyleOptions } from './fightingStyles.js';

const OATH_SPELLS = ['Incantesimi del Giuramento', 'Incantesimi sempre preparati ai livelli 3, 5, 9, 13 e 17.',
  'Oath Spells', 'Always-prepared spells at levels 3, 5, 9, 13 and 17.'];
const CD = 'Incanalare Divinità';
const CD_EN = 'Channel Divinity';

export default {
  choices: [
    {
      key: 'fightingStyle', type: 'single', minLevel: 2, replacesFeature: true,
      label: 'Stile di Combattimento', labelEn: 'Fighting Style',
      options: fightingStyleOptions(['defense', 'dueling', 'greatWeapon', 'protection']),
    },
    {
      key: 'subclass', type: 'single', minLevel: 3, subclass: true,
      label: 'Giuramento Sacro', labelEn: 'Sacred Oath',
      options: [
        {
          value: 'devotion', label: 'Devozione', labelEn: 'Devotion',
          description: 'Giustizia, virtù e ordine.', descriptionEn: 'Justice, virtue and order.',
          features: [
            [3, ...OATH_SPELLS],
            [3, `${CD}: Arma Sacra`, 'Per 1 minuto un\'arma aggiunge il mod. CAR ai tiri per colpire e diventa magica.', `${CD_EN}: Sacred Weapon`, 'For 1 minute a weapon adds your Charisma modifier to attack rolls and is magical.'],
            [3, `${CD}: Scacciare gli Empi`, 'Immondi e non morti vicini che falliscono un TS su SAG sono scacciati per 1 minuto.', `${CD_EN}: Turn the Unholy`, 'Fiends and undead nearby that fail a Wisdom save are turned for 1 minute.'],
            [7, 'Aura di Devozione', 'Tu e gli alleati entro 3 m (9 m dal 18°) non potete essere affascinati.', 'Aura of Devotion', 'You and allies within 10 feet (30 from 18th) can\'t be charmed.'],
            [15, 'Purezza di Spirito', 'Sei sempre sotto l\'effetto di Protezione dal Bene e dal Male.', 'Purity of Spirit', 'You are always under Protection from Evil and Good.'],
            [20, 'Aureola Sacra', 'Azione: aura di luce solare per 1 minuto, con danni radiosi ai nemici e vantaggio ai TS contro incantesimi di immondi e non morti.',
              'Holy Nimbus', 'Action: a 1-minute sunlight aura that damages enemies and grants advantage on saves against fiend and undead spells.'],
          ],
        },
        {
          value: 'ancients', label: 'Antichi', labelEn: 'Ancients',
          description: 'Luce, vita e bellezza del mondo naturale.', descriptionEn: 'Light, life and the beauty of the natural world.',
          features: [
            [3, ...OATH_SPELLS],
            [3, `${CD}: Ira della Natura`, 'Rampicanti spettrali immobilizzano una creatura entro 3 m (TS su FOR o DES).', `${CD_EN}: Nature's Wrath`, 'Spectral vines restrain a creature within 10 feet (Strength or Dexterity save).'],
            [3, `${CD}: Scacciare i Senza Fede`, 'Folletti e immondi vicini che falliscono un TS su SAG sono scacciati per 1 minuto.', `${CD_EN}: Turn the Faithless`, 'Fey and fiends nearby that fail a Wisdom save are turned for 1 minute.'],
            [7, 'Aura di Salvaguardia', 'Tu e gli alleati entro 3 m (9 m dal 18°) avete resistenza ai danni degli incantesimi.', 'Aura of Warding', 'You and allies within 10 feet (30 from 18th) have resistance to spell damage.'],
            [15, 'Sentinella Immortale', 'A 0 PF puoi restare a 1 PF, una volta per riposo lungo; non invecchi.', 'Undying Sentinel', 'At 0 HP you can drop to 1 instead, once per long rest; you don\'t age.'],
            [20, 'Campione Anziano', 'Assumi la forma di una forza primordiale: recuperi PF, lanci incantesimi più in fretta e imponi svantaggio ai TS dei nemici.',
              'Elder Champion', 'Assume the form of a primal force: regain HP, cast faster and impose disadvantage on enemy saves.'],
          ],
        },
        {
          value: 'vengeance', label: 'Vendetta', labelEn: 'Vengeance',
          description: 'Punire chi ha commesso gravi peccati.', descriptionEn: 'Punishing those who have committed grievous sins.',
          features: [
            [3, ...OATH_SPELLS],
            [3, `${CD}: Abiurare il Nemico`, 'Una creatura entro 18 m deve superare un TS su SAG o è spaventata e immobile.', `${CD_EN}: Abjure Enemy`, 'A creature within 60 feet must pass a Wisdom save or be frightened and held.'],
            [3, `${CD}: Voto di Inimicizia`, 'Azione bonus: vantaggio ai tiri per colpire contro una creatura per 1 minuto.', `${CD_EN}: Vow of Enmity`, 'Bonus action: advantage on attack rolls against one creature for 1 minute.'],
            [7, 'Vendicatore Implacabile', 'Dopo un attacco d\'opportunità a segno ti muovi di metà velocità senza provocare.', 'Relentless Avenger', 'After an opportunity attack hits, move up to half your speed without provoking.'],
            [15, 'Anima della Vendetta', 'Quando chi è sotto il tuo Voto attacca, puoi rispondere con un attacco in mischia.', 'Soul of Vengeance', 'When a creature under your Vow attacks, make a melee attack as a reaction.'],
            [20, 'Angelo Vendicatore', 'Per 1 ora: ali, velocità di volo e un\'aura che spaventa i nemici.', 'Avenging Angel', 'For 1 hour: wings, flying speed and a frightening aura.'],
          ],
        },
      ],
    },
  ],
};
