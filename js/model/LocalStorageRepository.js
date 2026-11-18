/**
 * Persistenza su localStorage.
 *
 * Ogni accesso è protetto da try/catch: in navigazione privata o con lo
 * storage disabilitato l'app continua a funzionare, semplicemente senza salvare.
 */
export class LocalStorageRepository {
  #key;
  #storage;

  /**
   * @param {string} [key]
   * @param {Storage | null} [storage] iniettabile per i test
   */
  constructor(key = 'dnd5e-character-sheet', storage = LocalStorageRepository.#defaultStorage()) {
    this.#key = key;
    this.#storage = storage;
  }

  static #defaultStorage() {
    try {
      return globalThis.localStorage ?? null;
    } catch {
      return null; // alcuni browser lanciano un'eccezione già in lettura
    }
  }

  get isAvailable() {
    return this.#storage !== null;
  }

  /** @returns {unknown | null} */
  load() {
    return this.#read(this.#key);
  }

  /** @returns {boolean} true se il salvataggio è riuscito */
  save(data) {
    return this.#write(this.#key, data);
  }

  clear() {
    try {
      this.#storage?.removeItem(this.#key);
    } catch { /* ignorato di proposito */ }
  }

  /** Stato dell'interfaccia (sezioni aperte/chiuse), separato dai dati del personaggio. */
  loadUiState() {
    return this.#read(`${this.#key}:ui`) ?? {};
  }

  saveUiState(data) {
    return this.#write(`${this.#key}:ui`, data);
  }

  /** Lingua scelta dall'utente (preferenza dell'interfaccia, non parte del personaggio). */
  loadLanguage() {
    const value = this.#read(`${this.#key}:lang`);
    return typeof value === 'string' ? value : null;
  }

  saveLanguage(code) {
    return this.#write(`${this.#key}:lang`, code);
  }

  #read(key) {
    try {
      const raw = this.#storage?.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  #write(key, data) {
    try {
      if (!this.#storage) return false;
      this.#storage.setItem(key, JSON.stringify(data));
      return true;
    } catch {
      return false; // quota piena o storage bloccato
    }
  }
}
