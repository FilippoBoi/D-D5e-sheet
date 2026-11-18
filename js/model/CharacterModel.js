/**
 * MODEL — unica fonte di verità sullo stato del personaggio.
 *
 * - Non conosce il DOM né localStorage.
 * - Ogni modifica passa da metodi espliciti che validano i dati.
 * - Dopo ogni modifica emette l'evento 'change'.
 */
import { EventEmitter } from '../core/EventEmitter.js';
import { clampInt, getByPath, setByPath } from '../core/utils.js';
import {
  MAX_AC_ITEMS, MAX_WEAPONS, classSaveProficiencies, createAcItem, createDefaultCharacter, createWeapon,
  normalizeCharacter, sanitizeValue,
} from './characterSchema.js';
import { CORE_SOURCE, normalizeSources } from '../data/sources.js';
import { deriveStats } from './deriveStats.js';
import { feetToMeters, getRace } from '../data/races.js';
import { defaultChoiceValues, getChoiceDefs, isListType } from '../data/classChoices/index.js';
import { averageHpGain, rolledHpGain } from './calculations.js';
import { allowedValues, dependentKeys, validateChoiceValue } from './classChoices.js';

export class CharacterModel extends EventEmitter {
  /** @type {ReturnType<typeof createDefaultCharacter>} */
  #state;

  /** Manuali attivi: preferenza dell'interfaccia, fuori dalla scheda (non viaggia con il personaggio). */
  #sources = new Set([CORE_SOURCE]);

  /**
   * @param {unknown} [initialData] dati salvati in precedenza (opzionali)
   * @param {unknown} [sources] elenco dei manuali attivi (opzionale)
   */
  constructor(initialData = null, sources = null) {
    super();
    this.#state = normalizeCharacter(initialData);
    this.#sources = normalizeSources(sources);
  }

  /** @returns {Set<string>} copia dei manuali attivi */
  getSources() { return new Set(this.#sources); }

  /** Attiva o disattiva un manuale (il PHB resta sempre attivo). @returns {boolean} true se è cambiato */
  toggleSource(id) {
    const next = new Set(this.#sources);
    if (!next.delete(id)) next.add(id);
    const valid = normalizeSources([...next]);
    if (valid.size === this.#sources.size && [...valid].every((x) => this.#sources.has(x))) return false;
    this.#sources = valid;
    this.#emitChange('sources');
    return true;
  }

  // ---------------------------------------------------------------- Letture

  /** Copia profonda dello stato: chi la riceve non può modificarlo per errore. */
  getSnapshot() {
    return structuredClone(this.#state);
  }

  /** Valori calcolati (modificatori, CA, CD...). */
  getDerived() {
    return deriveStats(this.#state, { sources: this.#sources });
  }

  /** @param {string} path */
  get(path) {
    return structuredClone(getByPath(this.#state, path));
  }

  toJSON() {
    return this.getSnapshot();
  }

  // ------------------------------------------------------------- Scritture

  /**
   * Aggiorna un singolo campo tramite percorso puntato.
   * @param {string} path es. "abilities.str" o "weapons.0.name"
   * @param {unknown} rawValue
   * @returns {boolean} true se lo stato è cambiato
   */
  set(path, rawValue) {
    if (path.startsWith('info.classChoices.')) return this.#setClassChoice(path.slice('info.classChoices.'.length), rawValue);
    const current = getByPath(this.#state, path);
    if (current === undefined || (typeof current === 'object' && current !== null)) {
      console.warn(`[CharacterModel] percorso non valido: ${path}`);
      return false;
    }
    const value = sanitizeValue(path, rawValue, current);
    if (Object.is(value, current)) return false;

    setByPath(this.#state, path, value);

    // Regola di dominio: cambiando classe si applicano i suoi tiri salvezza.
    if (path === 'info.classId') {
      this.#state.saveProficiencies = classSaveProficiencies(value);
      // Le scelte di abilità dipendono dalla classe: si ripartono da vuote.
      this.#state.classSkills = createDefaultCharacter().classSkills;
      // Le scelte di classe dipendono dalla classe: tutte da capo.
      this.#state.info.classChoices = defaultChoiceValues();
    }
    // Regola di dominio: cambiando razza si impostano velocità e abilità fisse.
    if (path === 'info.raceId') {
      this.#applyRace(value);
      // Le scelte dipendono dalla razza: si ripartono da vuote.
      this.#state.info.raceChoices = createDefaultCharacter().info.raceChoices;
    }

    this.#emitChange(path);
    return true;
  }

  /**
   * Aggiunge o toglie un valore da una scelta multipla o di abilità.
   * Si aggiunge solo ciò che è ammesso ora (quantità, prerequisiti, competenza); si toglie sempre.
   * @param {string} key
   * @param {string} value
   * @returns {boolean} true se lo stato è cambiato
   */
  toggleChoice(key, value) {
    const { classId } = this.#state.info;
    const def = getChoiceDefs(classId).find((d) => d.key === key);
    if (!def || !isListType(def.type) || typeof value !== 'string' || !allowedValues(def).has(value)) return false;
    const list = this.#state.info.classChoices[key];
    if (list.includes(value)) {
      this.#state.info.classChoices[key] = list.filter((v) => v !== value);
    } else {
      const group = this.getDerived().classChoices.find((g) => g.key === key);
      const option = group?.options.find((o) => o.value === value);
      if (!group || !option || option.disabled) return false;
      this.#state.info.classChoices[key] = [...list, value];
    }
    this.#emitChange(`info.classChoices.${key}`);
    return true;
  }

  addAcItem() {
    if (this.#state.equipment.acItems.length >= MAX_AC_ITEMS) return;
    this.#state.equipment.acItems.push(createAcItem());
    this.#emitChange('equipment.acItems');
  }

  /** @param {string} id */
  removeAcItem(id) {
    const before = this.#state.equipment.acItems.length;
    this.#state.equipment.acItems = this.#state.equipment.acItems.filter((item) => item.id !== id);
    if (this.#state.equipment.acItems.length !== before) this.#emitChange('equipment.acItems');
  }

  addWeapon() {
    if (this.#state.weapons.length >= MAX_WEAPONS) return;
    this.#state.weapons.push(createWeapon());
    this.#emitChange('weapons');
  }

  /** @param {string} id */
  removeWeapon(id) {
    const before = this.#state.weapons.length;
    this.#state.weapons = this.#state.weapons.filter((w) => w.id !== id);
    if (this.#state.weapons.length !== before) this.#emitChange('weapons');
  }

  /** I danni consumano prima i PF temporanei, poi quelli attuali. */
  applyDamage(amount) {
    const n = Math.trunc(Number(amount));
    if (!Number.isFinite(n) || n <= 0) return;
    const c = this.#state.combat;
    const absorbed = Math.min(c.hpTemp, n);
    c.hpTemp -= absorbed;
    c.hpCurrent = Math.max(0, c.hpCurrent - (n - absorbed));
    this.#emitChange('combat');
  }

  /** La cura non supera i PF massimi; tornare sopra 0 azzera i TS contro morte. */
  heal(amount) {
    const n = Math.trunc(Number(amount));
    if (!Number.isFinite(n) || n <= 0) return;
    const c = this.#state.combat;
    c.hpCurrent = Math.min(c.hpMax, c.hpCurrent + n);
    c.deathSuccesses = 0;
    c.deathFailures = 0;
    this.#emitChange('combat');
  }

  applySuggestedHp() {
    const { suggested } = this.getDerived().hp;
    this.#state.combat.hpMax = suggested;
    this.#state.combat.hpCurrent = suggested;
    this.#emitChange('combat');
  }

  /** Riposo breve: tornano le risorse "a riposo breve" e, per il Warlock, gli slot del Patto. */
  shortRest() {
    const derived = this.getDerived();
    for (const use of derived.usables) {
      if (use.recharge === 'short') this.#state.resourcesUsed[use.id] = 0;
    }
    if (derived.spellcasting.isPact) {
      for (const key of Object.keys(this.#state.spells.slotsUsed)) this.#state.spells.slotsUsed[key] = 0;
    }
    this.#emitChange('rest');
  }

  /** Riposo lungo: PF al massimo, slot e tutte le risorse recuperati, TS contro morte azzerati. */
  longRest() {
    const c = this.#state.combat;
    c.hpCurrent = c.hpMax;
    c.hpTemp = 0;
    c.deathSuccesses = 0;
    c.deathFailures = 0;
    for (const key of Object.keys(this.#state.spells.slotsUsed)) this.#state.spells.slotsUsed[key] = 0;
    for (const key of Object.keys(this.#state.resourcesUsed)) this.#state.resourcesUsed[key] = 0;
    this.#emitChange('rest');
  }

  /**
   * PF guadagnati salendo di `levels` livelli: media del dado vita, tiro virtuale o somma dei dadi già tirati.
   * Aumenta PF massimi e attuali (senza superare 999).
   * @param {number} levels livelli guadagnati
   * @param {{mode: 'average'|'roll'|'manual', total?: number, rng?: () => number}} choice
   * @returns {{gain: number, rolls: number[]}} PF aggiunti e dadi tirati (vuoto con la media)
   */
  applyLevelUpHp(levels, { mode, total = 0, rng = Math.random }) {
    const n = Math.trunc(levels);
    if (!(n > 0)) return { gain: 0, rolls: [] };
    const { hitDieSides: die, conMod, perLevelBonus } = this.getDerived().hp;
    let gain = 0;
    let rolls = [];
    if (mode === 'average') {
      gain = averageHpGain(die, conMod, perLevelBonus) * n;
    } else if (mode === 'roll') {
      rolls = Array.from({ length: n }, () => 1 + Math.floor(rng() * die));
      gain = rolls.reduce((sum, roll) => sum + rolledHpGain(roll, conMod, perLevelBonus), 0);
    } else if (mode === 'manual') {
      const rolled = clampInt(total, n, n * die);
      gain = Math.max(n, rolled + n * conMod) + n * perLevelBonus;
    } else {
      return { gain: 0, rolls: [] };
    }
    const c = this.#state.combat;
    const hpMax = Math.min(999, c.hpMax + gain);
    c.hpCurrent = Math.min(hpMax, c.hpCurrent + (hpMax - c.hpMax));
    c.hpMax = hpMax;
    this.#emitChange('combat');
    return { gain, rolls };
  }

  /** Sostituisce l'intero personaggio (import JSON). I dati vengono validati. */
  load(data) {
    this.#state = normalizeCharacter(data);
    this.#emitChange('*');
  }

  reset() {
    this.#state = createDefaultCharacter();
    this.#emitChange('*');
  }

  // --------------------------------------------------------------- Interni

  /** Scelta singola o di testo di classe: valida per la classe attuale; azzera ciò che ne dipende. */
  #setClassChoice(key, rawValue) {
    const { classId } = this.#state.info;
    const value = validateChoiceValue(classId, key, rawValue);
    const choices = this.#state.info.classChoices;
    if (value === undefined || Object.is(value, choices[key])) return false;
    const defs = getChoiceDefs(classId);
    const own = defs.find((d) => d.key === key);
    if (value && own?.differsFrom && value === choices[own.differsFrom]) return false; // deve differire dall'altra scelta
    choices[key] = value;
    // Chi deve differire da questa scelta e ora è uguale si azzera (es. secondo stile uguale al primo).
    for (const d of defs) if (d.differsFrom === key && value && choices[d.key] === value) choices[d.key] = '';
    const reset = (parent) => {
      for (const child of dependentKeys(classId, parent)) {
        const def = getChoiceDefs(classId).find((d) => d.key === child);
        choices[child] = isListType(def.type) ? [] : '';
        reset(child);
      }
    };
    reset(key);
    this.#emitChange(`info.classChoices.${key}`);
    return true;
  }

  /**
   * Applica i valori automatici della razza: velocità e abilità con competenza fissa.
   * Le competenze già attive restano tali; nessuna razza azzera ciò che l'utente ha scelto.
   * @param {string} raceId
   */
  #applyRace(raceId) {
    const race = getRace(raceId);
    if (!race) return;
    this.#state.combat.speed = feetToMeters(race.speedFt);
    for (const skillId of race.skills) {
      this.#state.skills[skillId].proficient = true;
    }
  }

  #emitChange(path) {
    this.emit('change', { path });
  }
}
