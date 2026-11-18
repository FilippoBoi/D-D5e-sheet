/**
 * Scelte di classe del Manuale del Giocatore (2014): un file per classe + questo indice.
 *
 * Una scelta (`choice`) ha:
 *   key        chiave nello stato (info.classChoices[key]); unica per tipo, condivisa tra classi
 *              solo quando ha lo stesso significato (es. `subclass`, `fightingStyle`)
 *   type       'single' (un valore) | 'multi' (N valori distinti) | 'skills' (N abilità) | 'text'
 *   minLevel   livello minimo per cui esiste
 *   count      numero (fisso) o tabella [[livello, quantità], ...] per 'multi' e 'skills'
 *   when       { key, in: [...] }: la scelta esiste solo se un'altra scelta ha uno di quei valori
 *   options    [{ value, label, labelEn, description?, descriptionEn?, prereq?, effects?, features? }]
 *   subclass   true per la scelta che definisce la sottoclasse (Patrono, Dominio, Archetipo...)
 *   mode       solo 'skills': 'expertise' (abilità già competenti), 'proficiency' (concede competenza),
 *              'both' (competenza e Maestria)
 *   pool       solo 'skills': abilità ammesse (default: tutte; per 'expertise' solo le competenti)
 *   extra      solo 'skills': voci non-abilità ammesse (es. arnesi da scasso)
 *   replacesFeature  la riga di privilegi con lo stesso nome della scelta viene sostituita/integrata dalle opzioni scelte
 *   featureName(En)  come replacesFeature, ma per una riga con nome diverso (anche di un privilegio di sottoclasse)
 *   effects    sull'opzione: effetti calcolabili (acWithArmor, hpPerLevel, unarmoredDefense...)
 *   features   sull'opzione: [livello, nome, descrizione, nameEn, descriptionEn] (privilegi della sottoclasse)
 *
 * Le tuple dei privilegi diventano oggetti una sola volta, al caricamento.
 */
import barbarian from './barbarian.js';
import bard from './bard.js';
import cleric from './cleric.js';
import druid from './druid.js';
import fighter from './fighter.js';
import monk from './monk.js';
import paladin from './paladin.js';
import ranger from './ranger.js';
import rogue from './rogue.js';
import sorcerer from './sorcerer.js';
import warlock from './warlock.js';
import wizard from './wizard.js';
import { EXTRA_SUBCLASSES } from '../generated/subclasses.js';

const freezeOption = (option) => Object.freeze({
  ...option,
  features: Object.freeze((option.features ?? []).map(([level, name, description, nameEn, descriptionEn]) =>
    Object.freeze({ level, name, nameEn, description, descriptionEn }))),
});

const freezeChoice = (choice) => Object.freeze({
  ...choice,
  options: Object.freeze((choice.options ?? []).map(freezeOption)),
});

/** Aggiunge alla scelta di sottoclasse quelle degli altri manuali (`source` ≠ PHB). */
const withExtraSubclasses = (choice, classId) => (choice.subclass
  ? { ...choice, options: [...choice.options.map((o) => ({ source: 'PHB', ...o })), ...(EXTRA_SUBCLASSES[classId] ?? [])] }
  : choice);

const build = (definition, classId) => Object.freeze(
  definition.choices.map((choice) => freezeChoice(withExtraSubclasses(choice, classId))),
);

export const CLASS_CHOICES = Object.freeze({
  barbarian: build(barbarian, 'barbarian'), bard: build(bard, 'bard'), cleric: build(cleric, 'cleric'), druid: build(druid, 'druid'),
  fighter: build(fighter, 'fighter'), monk: build(monk, 'monk'), paladin: build(paladin, 'paladin'), ranger: build(ranger, 'ranger'),
  rogue: build(rogue, 'rogue'), sorcerer: build(sorcerer, 'sorcerer'), warlock: build(warlock, 'warlock'), wizard: build(wizard, 'wizard'),
});

/** Scelte di una classe (vuoto se sconosciuta). */
export const getChoiceDefs = (classId) => CLASS_CHOICES[classId] ?? [];

/** Tipi che memorizzano un elenco. */
export const isListType = (type) => type === 'multi' || type === 'skills';

/** Tutte le chiavi e il loro valore di default ('' oppure []), unione di tutte le classi. */
export function defaultChoiceValues() {
  const values = {};
  for (const defs of Object.values(CLASS_CHOICES)) {
    for (const def of defs) values[def.key] = isListType(def.type) ? [] : '';
  }
  return values;
}

/** Unione dei valori ammessi per una chiave singola, tra tutte le classi (validazione grezza dello schema). */
export function allowedValuesForKey(key) {
  const out = new Set();
  for (const defs of Object.values(CLASS_CHOICES)) {
    for (const def of defs) {
      if (def.key === key) for (const o of def.options) out.add(o.value);
    }
  }
  return out;
}

/** Lunghezza massima dei campi di testo libero. */
export const MAX_CHOICE_TEXT = 60;

/** Tabella di quantità [[livello, n], ...] o numero → quantità al livello dato (0 se non ancora disponibile). */
export function choiceCount(def, level) {
  if (typeof def.count === 'number') return level >= def.minLevel ? def.count : 0;
  let n = 0;
  for (const [minLevel, value] of def.count ?? []) if (level >= minLevel) n = value;
  return n;
}
