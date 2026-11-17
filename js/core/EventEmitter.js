/**
 * Pub/sub minimale: permette al Model di notificare i cambiamenti
 * senza conoscere chi li ascolta (Controller, test, ...).
 */
export class EventEmitter {
  /** @type {Map<string, Set<Function>>} */
  #listeners = new Map();

  /**
   * @param {string} event
   * @param {(payload: any) => void} listener
   * @returns {() => void} funzione per annullare l'iscrizione
   */
  on(event, listener) {
    if (!this.#listeners.has(event)) this.#listeners.set(event, new Set());
    this.#listeners.get(event).add(listener);
    return () => this.off(event, listener);
  }

  off(event, listener) {
    this.#listeners.get(event)?.delete(listener);
  }

  emit(event, payload) {
    this.#listeners.get(event)?.forEach((listener) => listener(payload));
  }
}
