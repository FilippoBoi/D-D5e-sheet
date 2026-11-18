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
import { DEFAULT_LANG, LANGUAGES, getLang } from '../i18n/i18n.js';

/**
 * Lingue in cui le descrizioni DEVONO esistere: sono quelle dell'interfaccia (i18n.js). Ogni voce
 * generata ha una chiave per codice lingua (`it`, `en`…); aggiungere una lingua all'app senza i
 * suoi testi fa fallire tests/descriptions.test.js, che elenca cosa manca.
 */
export const DESCRIPTION_LANGS = Object.freeze(LANGUAGES.map((l) => l.code));

/** Lingua in cui mostrare una voce: quella dell'interfaccia, altrimenti l'italiano. */
export const textLang = (entry) => (entry?.[getLang()] ? getLang() : DEFAULT_LANG);

/** @param {string} id @returns {(Description & {page?: number}) | undefined} */
export const getSkillText = (id) => SKILL_TEXT[id];

let spellModule = null;

/** @param {string} id @returns {Promise<SpellDescription | undefined>} */
export async function loadSpellText(id) {
  spellModule ??= import('./generated/spellDescriptions.js').catch((error) => { spellModule = null; throw error; });
  return (await spellModule).SPELL_TEXT[id];
}
