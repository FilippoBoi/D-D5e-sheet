/**
 * Quanti trucchetti e incantesimi può avere un incantatore, per livello (tabelle del PHB).
 *
 * - `cantrips`: trucchetti conosciuti, a soglie [livello minimo, quantità].
 * - `known`: incantesimi conosciuti, indice = livello di classe (0 non usato). Le classi che
 *   preparano gli incantesimi (Chierico, Druido, Mago, Paladino) usano invece `prepared`.
 *
 * La scheda li usa come indicazione (contatore "3/4"), non come blocco: restano possibili
 * eccezioni (talenti come Iniziato alla Magia, regole della casa, multiclasse).
 */
const steps = (pairs) => (level) => pairs.reduce((n, [min, value]) => (level >= min ? value : n), 0);

const CANTRIPS_PRIEST = steps([[1, 3], [4, 4], [10, 5]]);   // Chierico, Mago
const CANTRIPS_TWO = steps([[1, 2], [4, 3], [10, 4]]);      // Bardo, Druido, Warlock
const CANTRIPS_SORCERER = steps([[1, 4], [4, 5], [10, 6]]);
const CANTRIPS_KNIGHT = steps([[3, 2], [10, 3]]);           // Cavaliere Mistico
const CANTRIPS_TRICKSTER = steps([[3, 3], [10, 4]]);        // Mistificatore Arcano

const THIRD_CASTER_KNOWN = [0, 0, 0, 3, 4, 4, 4, 5, 6, 6, 7, 8, 8, 9, 10, 10, 11, 11, 11, 12, 13];

/** @type {Record<string, {cantrips: (level: number) => number, known?: number[], prepared?: 'full' | 'half'}>} */
export const SPELL_PROGRESSION = Object.freeze({
  bard: { cantrips: CANTRIPS_TWO, known: [0, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 15, 16, 18, 19, 19, 20, 22, 22, 22] },
  cleric: { cantrips: CANTRIPS_PRIEST, prepared: 'full' },
  druid: { cantrips: CANTRIPS_TWO, prepared: 'full' },
  paladin: { cantrips: () => 0, prepared: 'half' },
  ranger: { cantrips: () => 0, known: [0, 0, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11] },
  sorcerer: { cantrips: CANTRIPS_SORCERER, known: [0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 12, 13, 13, 14, 14, 15, 15, 15, 15] },
  warlock: { cantrips: CANTRIPS_TWO, known: [0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 11, 11, 12, 12, 13, 13, 14, 14, 15, 15] },
  wizard: { cantrips: CANTRIPS_PRIEST, prepared: 'full' },
  eldritchKnight: { cantrips: CANTRIPS_KNIGHT, known: THIRD_CASTER_KNOWN },
  arcaneTrickster: { cantrips: CANTRIPS_TRICKSTER, known: THIRD_CASTER_KNOWN },
});

/**
 * @param {string} table chiave di SPELL_PROGRESSION (id di classe, o della sottoclasse per i terzi di incantatore)
 * @param {number} level livello di classe
 * @param {number} castMod modificatore della caratteristica da incantatore
 * @returns {{cantrips: number, spells: number, kind: 'known' | 'prepared'}}
 */
export function spellLimits(table, level, castMod) {
  const row = SPELL_PROGRESSION[table];
  if (!row) return { cantrips: 0, spells: 0, kind: 'known' };
  if (row.prepared) {
    const base = row.prepared === 'half' ? Math.floor(level / 2) : level;
    return { cantrips: row.cantrips(level), spells: Math.max(1, castMod + base), kind: 'prepared' };
  }
  return { cantrips: row.cantrips(level), spells: row.known?.[level] ?? 0, kind: 'known' };
}
