/**
 * MODEL — unica fonte di verità sullo stato del personaggio.
 *
 * - Non conosce il DOM né localStorage.
 * - Ogni modifica passa da metodi espliciti che validano i dati.
 * - Dopo ogni modifica emette l'evento 'change'.
 */
import { EventEmitter } from '../core/EventEmitter.js';
import { getByPath, setByPath } from '../core/utils.js';
import {
  MAX_WEAPONS, classSaveProficiencies, createDefaultCharacter, createWeapon,
  normalizeCharacter, sanitizeValue,
} from './characterSchema.js';
import { deriveStats } from './deriveStats.js';

export class CharacterModel extends EventEmitter {
  /** @type {ReturnType<typeof createDefaultCharacter>} */
  #state;

  /** @param {unknown} [initialData] dati salvati in precedenza (opzionali) */
  constructor(initialData = null) {
    super();
    this.#state = normalizeCharacter(initialData);
  }

  // ---------------------------------------------------------------- Letture

  /** Copia profonda dello stato: chi la riceve non può modificarlo per errore. */
  getSnapshot() {
    return structuredClone(this.#state);
  }

  /** Valori calcolati (modificatori, CA, CD...). */
  getDerived() {
    return deriveStats(this.#state);
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
    }

    this.#emitChange(path);
    return true;
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

  /** Riposo lungo: PF al massimo, slot recuperati, TS contro morte azzerati. */
  longRest() {
    const c = this.#state.combat;
    c.hpCurrent = c.hpMax;
    c.hpTemp = 0;
    c.deathSuccesses = 0;
    c.deathFailures = 0;
    for (const key of Object.keys(this.#state.spells.slotsUsed)) this.#state.spells.slotsUsed[key] = 0;
    this.#emitChange('rest');
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

  #emitChange(path) {
    this.emit('change', { path });
  }
}
