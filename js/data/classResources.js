/**
 * Risorse di classe che scalano con il livello (usi di Ira, punti Ki, dadi
 * dell'Attacco Furtivo...). Ogni builder restituisce coppie { label, value }
 * già pronte da mostrare.
 */

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

const metres = (n) => `${String(n).replace('.', ',')} m`;

const RESOURCE_BUILDERS = {
  barbarian: (lvl) => [
    { label: 'Ire per riposo lungo', value: lvl >= 20 ? 'Illimitate' : String(byLevel(lvl, [[1, 2], [3, 3], [6, 4], [12, 5], [17, 6]])) },
    { label: 'Danni da ira', value: `+${byLevel(lvl, [[1, 2], [9, 3], [16, 4]])}` },
  ],
  bard: (lvl, mods) => [
    {
      label: 'Ispirazione Bardica',
      value: `${Math.max(1, mods.cha)} × ${byLevel(lvl, [[1, 'd6'], [5, 'd8'], [10, 'd10'], [15, 'd12']])}`,
    },
    lvl >= 2 && { label: 'Canto di Riposo', value: byLevel(lvl, [[2, 'd6'], [9, 'd8'], [13, 'd10'], [17, 'd12']]) },
  ],
  cleric: (lvl) => [
    lvl >= 2 && { label: 'Incanalare Divinità', value: `${byLevel(lvl, [[2, 1], [6, 2], [18, 3]])} / riposo` },
    lvl >= 5 && { label: 'Distruggere Non Morti', value: `GS ${byLevel(lvl, [[5, '1/2'], [8, '1'], [11, '2'], [14, '3'], [17, '4']])}` },
  ],
  druid: (lvl) => [
    lvl >= 2 && {
      label: 'Forma Selvatica',
      value: lvl >= 20 ? 'Illimitata' : `2 / riposo · GS max ${byLevel(lvl, [[2, '1/4'], [4, '1/2'], [8, '1']])}`,
    },
  ],
  fighter: (lvl) => [
    { label: 'Recuperare Energie', value: `1d10 + ${lvl}` },
    lvl >= 2 && { label: 'Azione Impetuosa', value: `${lvl >= 17 ? 2 : 1} / riposo` },
    lvl >= 5 && { label: 'Attacchi per azione', value: String(byLevel(lvl, [[5, 2], [11, 3], [20, 4]])) },
    lvl >= 9 && { label: 'Indomito', value: `${byLevel(lvl, [[9, 1], [13, 2], [17, 3]])} / riposo lungo` },
  ],
  monk: (lvl) => [
    { label: 'Dado Arti Marziali', value: byLevel(lvl, [[1, 'd4'], [5, 'd6'], [11, 'd8'], [17, 'd10']]) },
    lvl >= 2 && { label: 'Punti Ki', value: String(lvl) },
    lvl >= 2 && { label: 'Movimento senza Armatura', value: `+${metres(byLevel(lvl, [[2, 3], [6, 4.5], [10, 6], [14, 7.5], [18, 9]]))}` },
  ],
  paladin: (lvl, mods) => [
    { label: 'Imposizione delle Mani', value: `${5 * lvl} PF` },
    { label: 'Percezione del Divino', value: `${Math.max(1, 1 + mods.cha)} / riposo lungo` },
    lvl >= 3 && { label: 'Incanalare Divinità', value: '1 / riposo' },
  ],
  rogue: (lvl) => [{ label: 'Attacco Furtivo', value: `${Math.ceil(lvl / 2)}d6` }],
  sorcerer: (lvl) => [lvl >= 2 && { label: 'Punti Stregoneria', value: String(lvl) }],
  warlock: (lvl) => [
    lvl >= 2 && { label: 'Suppliche Occulte', value: String(byLevel(lvl, [[2, 2], [5, 3], [7, 4], [9, 5], [12, 6], [15, 7], [18, 8]])) },
  ],
  wizard: (lvl) => [{ label: 'Recupero Arcano', value: `${Math.ceil(lvl / 2)} livelli di slot` }],
};

/**
 * @param {string} classId
 * @param {number} level
 * @param {Record<string, number>} mods modificatori di caratteristica
 * @returns {Array<{label: string, value: string}>}
 */
export function getClassResources(classId, level, mods) {
  const builder = RESOURCE_BUILDERS[classId];
  return builder ? builder(level, mods).filter(Boolean) : [];
}
