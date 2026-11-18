/**
 * Logica delle scelte di classe, in funzioni pure (nessun DOM, nessuno stato proprio).
 *
 * - `normalizeClassChoices`: valida i dati salvati/importati rispetto alla classe attuale.
 * - `resolveClassChoices`: da stato + livello calcola cosa è attivo, cosa conta davvero e gli effetti.
 *
 * Regole su ciò che NON si cancella: scelte sotto `minLevel`, elementi oltre la quantità
 * consentita, elementi con prerequisito non soddisfatto o abilità non più competenti restano
 * memorizzati ma non contano e vengono segnalati (`overflow`, `blocked`).
 * Si azzera invece ciò che dipende da una scelta cambiata (`when`): vedi CharacterModel.
 */
import {
  MAX_CHOICE_TEXT, choiceCount, defaultChoiceValues, getChoiceDefs, isListType,
} from '../data/classChoices/index.js';
import { SKILLS } from '../data/skills.js';
import { loc, pick } from '../i18n/i18n.js';

const SKILL_IDS = SKILLS.map((s) => s.id);
const skillLabel = (id) => { const s = SKILLS.find((x) => x.id === id); return s ? loc(s) : id; };

/** Valori ammessi per una scelta (opzioni; per le abilità: pool + voci extra). */
export function allowedValues(def) {
  if (def.type === 'skills') return new Set([...(def.pool ?? SKILL_IDS), ...(def.extra ?? []).map((e) => e.value)]);
  return new Set(def.options.map((o) => o.value));
}

/** La scelta esiste solo se il valore (attivo) di un'altra scelta è tra quelli richiesti. */
export const whenMet = (def, valueOf) => !def.when || def.when.in.includes(valueOf(def.when.key));

/** Prerequisiti di un'opzione: livello e valore di un'altra scelta. Gli incantesimi noti non si verificano. */
export function prereqMet(prereq, level, valueOf) {
  if (!prereq) return true;
  if (prereq.level && level < prereq.level) return false;
  if (prereq.choice && valueOf(prereq.choice.key) !== prereq.choice.value) return false;
  return true;
}

/**
 * Stato valido delle scelte per una classe: chiavi di altre classi azzerate,
 * valori fuori elenco scartati, elenchi senza duplicati, scelte con `when` non soddisfatto azzerate.
 * Non applica il livello: un calo di livello non cancella nulla.
 * @param {unknown} raw
 * @param {string} classId
 */
export function normalizeClassChoices(raw, classId) {
  const result = defaultChoiceValues();
  const source = raw !== null && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const defs = getChoiceDefs(classId);

  for (const def of defs) {
    const value = source[def.key];
    if (def.type === 'text') {
      if (typeof value === 'string') result[def.key] = value.slice(0, MAX_CHOICE_TEXT);
    } else if (isListType(def.type)) {
      const allowed = allowedValues(def);
      if (Array.isArray(value)) {
        result[def.key] = [...new Set(value.filter((v) => typeof v === 'string' && allowed.has(v)))].slice(0, allowed.size);
      }
    } else if (typeof value === 'string' && allowedValues(def).has(value)) {
      result[def.key] = value;
    }
  }
  // Dipendenze: i genitori vengono prima dei figli nell'ordine delle definizioni.
  for (const def of defs) {
    if (!whenMet(def, (key) => result[key])) result[def.key] = isListType(def.type) ? [] : '';
    if (def.differsFrom && result[def.key] && result[def.key] === result[def.differsFrom]) result[def.key] = '';
  }
  return result;
}

/** Valore valido per una singola scelta di testo/singola della classe corrente, oppure undefined. */
export function validateChoiceValue(classId, key, value) {
  const def = getChoiceDefs(classId).find((d) => d.key === key);
  if (!def || isListType(def.type) || typeof value !== 'string') return undefined;
  if (def.type === 'text') return value.slice(0, MAX_CHOICE_TEXT);
  return value === '' || allowedValues(def).has(value) ? value : undefined;
}

/** Chiavi delle scelte che dipendono (`when`) da `key` nella classe indicata. */
export const dependentKeys = (classId, key) => getChoiceDefs(classId)
  .filter((d) => d.when?.key === key).map((d) => d.key);

/**
 * @param {object} p
 * @param {string} p.classId
 * @param {number} p.level
 * @param {Record<string, string | string[]>} p.choices  info.classChoices
 * @param {(skillId: string) => boolean} p.isProficient competenza di base (manuale, razza, abilità di classe)
 */
export function resolveClassChoices({ classId, level, choices, isProficient }) {
  const defs = getChoiceDefs(classId);
  const active = {};   // key → valore singolo attivo (per `when` e prerequisiti)
  const valueOf = (key) => active[key] ?? '';
  const granted = new Set();   // abilità con competenza concessa da una scelta
  const expertise = new Set(); // abilità con Maestria concessa da una scelta
  const effects = { acWithArmor: [], hpPerLevel: 0, unarmoredDefense: null, spellcasting: null };
  const groups = [];
  let subclass = null;

  const applyEffects = (option, label) => {
    const e = option?.effects;
    if (!e) return;
    if (e.acWithArmor) effects.acWithArmor.push({ label, value: e.acWithArmor });
    if (e.hpPerLevel) effects.hpPerLevel += e.hpPerLevel;
    if (e.unarmoredDefense && !effects.unarmoredDefense) effects.unarmoredDefense = e.unarmoredDefense;
    if (e.spellcasting && !effects.spellcasting) effects.spellcasting = e.spellcasting;
  };

  for (const def of defs) {
    if (level < def.minLevel || !whenMet(def, valueOf)) continue;
    const stored = choices[def.key];
    const group = { def, key: def.key, type: def.type, count: 1, effective: [], overflow: [], blocked: [], value: '' };

    if (def.type === 'single') {
      const option = def.options.find((o) => o.value === stored) ?? null;
      group.value = option?.value ?? '';
      group.option = option;
      active[def.key] = group.value;
      if (option) applyEffects(option, loc(option, 'label'));
      if (def.subclass && option) subclass = { def, option };
    } else if (def.type === 'text') {
      group.value = typeof stored === 'string' ? stored : '';
    } else {
      group.count = choiceCount(def, level);
      const list = Array.isArray(stored) ? stored : [];
      const known = allowedValues(def);
      const ok = [];
      for (const value of list) {
        if (!known.has(value)) continue;
        const option = def.options.find((o) => o.value === value);
        const isExtra = (def.extra ?? []).some((e) => e.value === value);
        let reason = null;
        if (option && !prereqMet(option.prereq, level, valueOf)) reason = 'prereq';
        else if (def.type === 'skills' && def.mode === 'expertise' && !isExtra
          && !isProficient(value) && !granted.has(value)) reason = 'proficiency';
        if (reason) group.blocked.push({ value, reason }); else ok.push(value);
      }
      group.effective = ok.slice(0, group.count);
      group.overflow = ok.slice(group.count);
      for (const value of group.effective) {
        applyEffects(def.options.find((o) => o.value === value), loc(def, 'label'));
        if (def.type !== 'skills' || !SKILL_IDS.includes(value)) continue;
        if (def.mode === 'proficiency' || def.mode === 'both') granted.add(value);
        if (def.mode === 'expertise' || def.mode === 'both') expertise.add(value);
      }
    }
    groups.push(group);
  }
  return { groups, subclass, effects, grantedSkills: granted, expertiseSkills: expertise, valueOf };
}

/** "Samurai [XGE]": la sigla del manuale distingue le opzioni che non sono del PHB. */
const sourceTagged = (label, source) => (source && source !== 'PHB' ? `${label} [${source}]` : label);

/** Nome leggibile di un valore scelto (opzione, abilità o voce extra). */
export function choiceValueLabel(def, value) {
  const option = def.options.find((o) => o.value === value);
  if (option) return loc(option, 'label');
  const extra = (def.extra ?? []).find((e) => e.value === value);
  return extra ? loc(extra, 'label') : skillLabel(value);
}

/**
 * Righe da aggiungere o sostituire nell'elenco dei privilegi, nella lingua corrente.
 * @returns {{ subclassFeatures: Array|null, picks: Array }}
 */
export function choiceFeatureRows(resolved, level) {
  const { groups, subclass } = resolved;
  const subclassFeatures = subclass
    ? subclass.option.features.filter((f) => f.level <= level).map((f) => ({
      level: f.level, name: loc(f), description: loc(f, 'description'),
      tag: `${loc(subclass.def, 'label')}: ${loc(subclass.option, 'label')}`,
    }))
    : null;

  const picks = [];
  for (const g of groups) {
    const { def } = g;
    if (def.subclass) continue;
    const replaces = def.featureName ? loc(def, 'featureName') : (def.replacesFeature ? loc(def, 'label') : undefined);
    if (def.type === 'single' && def.featureName && g.option) {
      const detail = loc(g.option, 'description');
      picks.push({
        level: def.minLevel, name: loc(def, 'label'), replaces, append: true,
        description: `${pick('Scelta', 'Chosen')}: ${loc(g.option, 'label')}.${detail ? ` ${detail}` : ''}`,
      });
    } else if (def.type === 'text' && def.featureName && g.value) {
      picks.push({
        level: def.minLevel, name: loc(def, 'label'), replaces, append: true,
        description: `${pick('Scelta', 'Chosen')}: ${g.value}.`,
      });
    } else if (def.type === 'single' && g.option?.description) {
      picks.push({
        level: def.minLevel, name: `${loc(def, 'label')}: ${loc(g.option, 'label')}`, description: loc(g.option, 'description'), replaces,
      });
    } else if (isListType(def.type) && g.effective.length) {
      picks.push({
        level: def.minLevel, name: loc(def, 'label'), replaces, append: true,
        description: `${pick('Scelte', 'Chosen')}: ${g.effective.map((v) => choiceValueLabel(def, v)).join(', ')}.`,
      });
    }
  }
  return { subclassFeatures, picks };
}

/** "Richiede: Patto della Lama, livello 5": prerequisiti strutturati più la nota sul trucchetto (non verificabile). */
function requirementText(option, defs) {
  const parts = [];
  const { prereq } = option;
  if (prereq?.choice) {
    const target = defs.find((d) => d.key === prereq.choice.key)?.options.find((o) => o.value === prereq.choice.value);
    if (target) parts.push(loc(target, 'label'));
  }
  if (prereq?.level) parts.push(pick(`livello ${prereq.level}`, `level ${prereq.level}`));
  const note = loc(option, 'prereqNote');
  if (note) parts.push(note.replace(/^(Richiede|Requires) /, ''));
  return parts.length ? `${pick('Richiede', 'Requires')}: ${parts.join(', ')}` : '';
}

/**
 * Modello per la UI: una voce per ogni scelta attiva (menu, elenco con caselle o campo di testo).
 * @param {ReturnType<typeof resolveClassChoices>} resolved
 * @param {number} level
 * @param {(skillId: string) => boolean} isProficient competenza di base
 * @param {string} classId
 * @param {Set<string> | null} [enabledSources] manuali attivi: le opzioni degli altri sono nascoste, tranne quella già scelta
 */
export function describeChoiceGroups(resolved, level, isProficient, classId, enabledSources = null) {
  const defs = getChoiceDefs(classId);
  const reasonText = {
    prereq: pick('prerequisito non soddisfatto', 'prerequisite not met'),
    proficiency: pick('non più competente', 'no longer proficient'),
  };
  return resolved.groups.map((g) => {
    const { def } = g;
    const base = {
      key: g.key, type: g.type, label: loc(def, 'label'), hint: loc(def, 'hint') ?? '',
      count: g.count, selectedCount: g.effective.length, value: g.value, values: g.effective,
      description: g.option ? (loc(g.option, 'description') ?? '') : '',
      overflow: g.overflow.map((v) => ({ value: v, label: choiceValueLabel(def, v) })),
      blocked: g.blocked.map((b) => ({ value: b.value, label: choiceValueLabel(def, b.value), reason: reasonText[b.reason] })),
    };
    if (def.type === 'single') {
      const taken = def.differsFrom ? resolved.valueOf(def.differsFrom) : '';
      return {
        ...base, searchable: false,
        options: def.options
          .filter((o) => (!taken || o.value !== taken)
            && (!enabledSources || o.value === g.value || enabledSources.has(o.source ?? 'PHB')))
          .map((o) => ({ value: o.value, label: sourceTagged(loc(o, 'label'), o.source) })),
      };
    }
    if (def.type === 'text') return { ...base, options: [], searchable: false };

    const full = g.effective.length >= g.count;
    const values = def.type === 'skills'
      ? [...(def.pool ?? SKILL_IDS), ...(def.extra ?? []).map((e) => e.value)]
      : def.options.map((o) => o.value);
    const options = values.map((value) => {
      const option = def.options.find((o) => o.value === value);
      const selected = g.effective.includes(value);
      const isSkill = SKILL_IDS.includes(value);
      let note = option ? [loc(option, 'description'), requirementText(option, defs)].filter(Boolean).join(' · ') : '';
      let disabled = false;
      if (!selected) {
        if (full) disabled = true;
        if (option?.prereq && !prereqMet(option.prereq, level, resolved.valueOf)) disabled = true;
        if (def.type === 'skills' && def.mode === 'expertise' && isSkill
          && !isProficient(value) && !resolved.grantedSkills.has(value)) {
          disabled = true; note = pick('Non competente', 'Not proficient');
        }
      }
      return { value, label: choiceValueLabel(def, value), note, selected, disabled, group: option ? (loc(option, 'group') ?? '') : '' };
    });
    return { ...base, options, searchable: options.length > 12 };
  });
}
