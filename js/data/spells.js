/**
 * Catalogo degli incantesimi e dei trucchetti.
 *
 * I dati strutturati (livello, scuola, tempo, gittata, componenti, durata, manuale e pagina,
 * classi) sono generati da 5e.tools in generated/spells.js. Il testo delle descrizioni NON è
 * incluso: l'app riporta il rimando "PHB, p. 241" al manuale.
 *
 * Ogni voce: `name` (italiano se noto, altrimenti inglese) e `nameEn`, come negli altri cataloghi.
 */
import { SPELLS } from './generated/spells.js';
import { SPELL_NAMES_IT } from './spellNames.js';

/** @typedef {{id:string,name:string,nameEn:string,level:number,school:string,time:string,range:string,comp:string,dur:string,conc:boolean,ritual:boolean,source:string,page:number|null,classes:string[],ext?:Array<[string,string]>}} Spell */

/** @type {readonly Spell[]} */
export const SPELL_LIST = Object.freeze(SPELLS.map((sp) => Object.freeze({
  ...sp, nameEn: sp.name, name: SPELL_NAMES_IT[sp.id] ?? sp.name,
})));

const BY_ID = new Map(SPELL_LIST.map((sp) => [sp.id, sp]));

/** @param {string} id @returns {Spell | undefined} */
export const getSpell = (id) => BY_ID.get(id);

/** Si possono conservare al massimo questi elementi (limite di sicurezza per i dati importati). */
export const MAX_CANTRIPS = 40;
export const MAX_SPELLS = 200;

/**
 * L'incantesimo è nella lista di una classe? `enabled`: manuali attivi (le aggiunte dei
 * supplementi, come Xanathar o Tasha, valgono solo se quel manuale è attivo).
 * @param {Spell} spell
 * @param {string} listClass id di classe (es. 'wizard')
 * @param {Set<string>} enabled
 */
export const onClassList = (spell, listClass, enabled) => spell.classes.includes(listClass)
  || (spell.ext ?? []).some(([cls, src]) => cls === listClass && enabled.has(src));
