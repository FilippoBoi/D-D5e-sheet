/**
 * Stili di Combattimento del Manuale del Giocatore (2014), da 5e.tools.
 * Condivisi da Guerriero, Paladino e Ranger: ogni classe ne usa un sottoinsieme
 * (Guerriero: tutti; Paladino: difesa, duellare, armi possenti, protezione;
 * Ranger: tiro, difesa, duellare, due armi).
 *
 * `effects.acWithArmor`: bonus alla CA quando si indossa un'armatura (calcolabile).
 * Gli altri stili dipendono dal tipo di arma impugnata e restano descrittivi.
 *
 * Termini italiani: Tiro, Difesa, Duellare, Protezione, Combattere con Due Armi
 * sono quelli già presenti nel progetto. "Combattere con Armi Possenti" è da verificare.
 */
const STYLES = {
  archery: {
    label: 'Tiro', labelEn: 'Archery',
    description: '+2 ai tiri per colpire con armi a distanza.',
    descriptionEn: '+2 bonus to attack rolls with ranged weapons.',
  },
  defense: {
    label: 'Difesa', labelEn: 'Defense',
    description: '+1 alla CA finché indossi un\'armatura.',
    descriptionEn: '+1 bonus to AC while wearing armor.',
    effects: { acWithArmor: 1 },
  },
  dueling: {
    label: 'Duellare', labelEn: 'Dueling',
    description: '+2 ai danni con un\'arma da mischia impugnata a una mano, senza altre armi.',
    descriptionEn: '+2 damage with a melee weapon held in one hand and no other weapons.',
  },
  greatWeapon: {
    label: 'Combattere con Armi Possenti', labelEn: 'Great Weapon Fighting',
    description: 'Ritiri 1 e 2 sui dadi di danno di armi a due mani da mischia.',
    descriptionEn: 'Reroll 1s and 2s on damage dice of two-handed melee weapons.',
  },
  protection: {
    label: 'Protezione', labelEn: 'Protection',
    description: 'Con uno scudo, reazione: svantaggio all\'attacco contro un alleato vicino.',
    descriptionEn: 'With a shield, reaction: impose disadvantage on an attack against a nearby ally.',
  },
  twoWeapon: {
    label: 'Combattere con Due Armi', labelEn: 'Two-Weapon Fighting',
    description: 'Aggiungi il modificatore ai danni dell\'attacco con la seconda arma.',
    descriptionEn: 'Add your ability modifier to the damage of the off-hand attack.',
  },
};

/** @param {string[]} ids */
export const fightingStyleOptions = (ids) => ids.map((id) => ({ value: id, ...STYLES[id] }));
export const ALL_FIGHTING_STYLES = Object.keys(STYLES);
