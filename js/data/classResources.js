/**
 * Risorse di classe che scalano con il livello (usi di Ira, punti Ki, dadi
 * dell'Attacco Furtivo...). Ogni builder restituisce coppie { label, value }
 * già pronte da mostrare (nella lingua corrente, vedi i18n/i18n.js).
 */
import { pick } from '../i18n/i18n.js';

/**
 * Trova il valore della riga più alta con livello minimo <= level.
 * @template T
 * @param {number} level
 * @param {Array<[number, T]>} table
 * @returns {T | null}
 */
export function byLevel(level, table) {
  let value = null;
  for (const [minLevel, v] of table) {
    if (level >= minLevel) value = v;
  }
  return value;
}

/** GS massimo della Forma Selvatica; Circolo della Luna: 1 fino al 5°, poi livello ÷ 3 (per difetto). */
const wildShapeMaxCr = (lvl, subclass) => (subclass === 'moon'
  ? String(lvl < 6 ? 1 : Math.floor(lvl / 3))
  : byLevel(lvl, [[2, '1/4'], [4, '1/2'], [8, '1']]));

const metres = (n) => `${pick(String(n).replace('.', ','), String(n))} m`;

const RESOURCE_BUILDERS = {
  barbarian: (lvl) => [
    { label: pick('Ire per riposo lungo', 'Rages per long rest'), value: lvl >= 20 ? pick('Illimitate', 'Unlimited') : String(byLevel(lvl, [[1, 2], [3, 3], [6, 4], [12, 5], [17, 6]])) },
    { label: pick('Danni da ira', 'Rage damage'), value: `+${byLevel(lvl, [[1, 2], [9, 3], [16, 4]])}` },
  ],
  bard: (lvl, mods) => [
    {
      label: pick('Ispirazione Bardica', 'Bardic Inspiration'),
      value: `${Math.max(1, mods.cha)} × ${byLevel(lvl, [[1, 'd6'], [5, 'd8'], [10, 'd10'], [15, 'd12']])}`,
    },
    lvl >= 2 && { label: pick('Canto di Riposo', 'Song of Rest'), value: byLevel(lvl, [[2, 'd6'], [9, 'd8'], [13, 'd10'], [17, 'd12']]) },
  ],
  cleric: (lvl) => [
    lvl >= 2 && { label: pick('Incanalare Divinità', 'Channel Divinity'), value: `${byLevel(lvl, [[2, 1], [6, 2], [18, 3]])} ${pick('/ riposo', '/ rest')}` },
    lvl >= 5 && { label: pick('Distruggere Non Morti', 'Destroy Undead'), value: `${pick('GS', 'CR')} ${byLevel(lvl, [[5, '1/2'], [8, '1'], [11, '2'], [14, '3'], [17, '4']])}` },
  ],
  druid: (lvl, mods, ctx) => [
    lvl >= 2 && {
      label: pick('Forma Selvatica', 'Wild Shape'),
      value: lvl >= 20 ? pick('Illimitata', 'Unlimited') : `${pick('2 / riposo · GS max', '2 / rest · max CR')} ${wildShapeMaxCr(lvl, ctx.subclass)}`,
    },
  ],
  fighter: (lvl, mods, ctx) => [
    { label: pick('Recuperare Energie', 'Second Wind'), value: `1d10 + ${lvl}` },
    // Maestro di Battaglia: dadi di superiorità (4/5/6 a 3°/7°/15°; d8, d10 dal 10°, d12 dal 18°) e CD delle manovre.
    ...(ctx.subclass === 'battleMaster' && lvl >= 3 ? [
      { label: pick('Dadi di superiorità', 'Superiority dice'), value: `${byLevel(lvl, [[3, 4], [7, 5], [15, 6]])} × ${byLevel(lvl, [[3, 'd8'], [10, 'd10'], [18, 'd12']])}` },
      { label: pick('CD delle manovre', 'Maneuver save DC'), value: String(8 + ctx.profBonus + Math.max(mods.str, mods.dex)) },
    ] : []),
    lvl >= 2 && { label: pick('Azione Impetuosa', 'Action Surge'), value: `${lvl >= 17 ? 2 : 1} ${pick('/ riposo', '/ rest')}` },
    lvl >= 5 && { label: pick('Attacchi per azione', 'Attacks per action'), value: String(byLevel(lvl, [[5, 2], [11, 3], [20, 4]])) },
    lvl >= 9 && { label: pick('Indomito', 'Indomitable'), value: `${byLevel(lvl, [[9, 1], [13, 2], [17, 3]])} ${pick('/ riposo lungo', '/ long rest')}` },
  ],
  monk: (lvl) => [
    { label: pick('Dado Arti Marziali', 'Martial Arts die'), value: byLevel(lvl, [[1, 'd4'], [5, 'd6'], [11, 'd8'], [17, 'd10']]) },
    lvl >= 2 && { label: pick('Punti Ki', 'Ki points'), value: String(lvl) },
    lvl >= 2 && { label: pick('Movimento senza Armatura', 'Unarmored Movement'), value: `+${metres(byLevel(lvl, [[2, 3], [6, 4.5], [10, 6], [14, 7.5], [18, 9]]))}` },
  ],
  paladin: (lvl, mods) => [
    { label: pick('Imposizione delle Mani', 'Lay on Hands'), value: `${5 * lvl} ${pick('PF', 'HP')}` },
    { label: pick('Percezione del Divino', 'Divine Sense'), value: `${Math.max(1, 1 + mods.cha)} ${pick('/ riposo lungo', '/ long rest')}` },
    lvl >= 3 && { label: pick('Incanalare Divinità', 'Channel Divinity'), value: pick('1 / riposo', '1 / rest') },
  ],
  rogue: (lvl) => [{ label: pick('Attacco Furtivo', 'Sneak Attack'), value: `${Math.ceil(lvl / 2)}d6` }],
  sorcerer: (lvl) => [lvl >= 2 && { label: pick('Punti Stregoneria', 'Sorcery points'), value: String(lvl) }],
  warlock: (lvl) => [
    lvl >= 2 && { label: pick('Suppliche Occulte', 'Eldritch Invocations'), value: String(byLevel(lvl, [[2, 2], [5, 3], [7, 4], [9, 5], [12, 6], [15, 7], [18, 8]])) },
  ],
  wizard: (lvl) => [{ label: pick('Recupero Arcano', 'Arcane Recovery'), value: `${Math.ceil(lvl / 2)} ${pick('livelli di slot', 'slot levels')}` }],
};

/**
 * @param {string} classId
 * @param {number} level
 * @param {Record<string, number>} mods modificatori di caratteristica
 * @param {{ subclass?: string, profBonus?: number }} [ctx] sottoclasse scelta e bonus di competenza
 * @returns {Array<{label: string, value: string}>}
 */
export function getClassResources(classId, level, mods, ctx = {}) {
  const builder = RESOURCE_BUILDERS[classId];
  return builder ? builder(level, mods, ctx).filter(Boolean) : [];
}
