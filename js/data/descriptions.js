/**
 * Descrizioni (italiano + inglese) di abilità, trucchetti e incantesimi.
 *
 * Il testo è nei moduli generati da docs/*.md (vedi scripts/build-descriptions.mjs). Quello delle
 * abilità è piccolo e si carica con l'app; quello degli incantesimi pesa circa 700 KB, perciò si
 * importa solo alla prima apertura di una descrizione.
 *
 * @typedef {{it: string, en: string, sum?: 1}} Description  `sum`: riassunto, non testo SRD
 * @typedef {Description & {time?: [string, string], mat?: string}} SpellDescription
 */
import { SKILL_TEXT } from './generated/skillDescriptions.js';

/** @param {string} id @returns {(Description & {page?: number}) | undefined} */
export const getSkillText = (id) => SKILL_TEXT[id];

let spellModule = null;

/** @param {string} id @returns {Promise<SpellDescription | undefined>} */
export async function loadSpellText(id) {
  spellModule ??= import('./generated/spellDescriptions.js').catch((error) => { spellModule = null; throw error; });
  return (await spellModule).SPELL_TEXT[id];
}
