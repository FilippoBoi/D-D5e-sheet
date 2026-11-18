/**
 * Dati per il selettore di incantesimi e trucchetti (popup della scheda).
 * Funzione pura: nessun DOM, nessuno stato.
 */
import { SPELL_LIST, onClassList } from '../data/spells.js';
import { describeSpell } from './spellText.js';
import { getLang } from '../i18n/i18n.js';

/**
 * @param {object} p
 * @param {'cantrips' | 'spells'} p.kind
 * @param {string} p.listClass classe la cui lista è quella "propria" (es. 'wizard')
 * @param {Set<string>} p.enabled manuali attivi
 * @param {Iterable<string>} p.selected id già scelti: restano visibili anche se il manuale è spento
 * @returns {Array<ReturnType<typeof describeSpell> & {own: boolean}>} ordinati per livello e nome
 */
export function buildSpellOptions({ kind, listClass, enabled, selected }) {
  const chosen = new Set(selected);
  const wantCantrips = kind === 'cantrips';
  const collator = new Intl.Collator(getLang(), { sensitivity: 'base' });
  return SPELL_LIST
    .filter((sp) => (sp.level === 0) === wantCantrips && (enabled.has(sp.source) || chosen.has(sp.id)))
    .map((sp) => ({ ...describeSpell(sp), own: onClassList(sp, listClass, enabled) }))
    .sort((a, b) => a.level - b.level || collator.compare(a.name, b.name));
}
