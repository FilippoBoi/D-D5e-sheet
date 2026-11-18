/**
 * Sincronizzazione di UNA scheda con il database condiviso.
 *
 * Strategia: si scambiano solo i *campi* (foglie del documento) cambiati e il
 * server li fonde in profondità. Due persone che toccano campi diversi non si
 * pestano i piedi, nemmeno dentro la stessa sezione (PF del Master + velocità del
 * giocatore); se toccano lo stesso campo vince l'ultimo che salva.
 *
 * Tre fotografie del documento:
 *   base       — ultimo stato locale concordato col server
 *   remoteDoc  — ultimo documento visto sul server
 *   (locale)   — quello che l'utente ha adesso, letto con getLocal()
 *
 * Ogni ciclo di polling prima invia le modifiche locali (così riprova da sola
 * dopo un errore di rete) e poi legge quelle degli altri. I campi cambiati
 * altrove si applicano solo se localmente non sono stati toccati.
 *
 * Eventi:  'remote' ({changes, updatedBy})  parziale del documento da fondere nel Model
 *          'state'  ('online' | 'offline' | 'revoked')
 */
import { EventEmitter } from '../core/EventEmitter.js';
import { applicableChanges, deepMerge, diffDeep } from './diff.js';

export class CharacterSync extends EventEmitter {
  #api;
  #token;
  #characterId;
  #getLocal;
  #pollMs;
  #base = {};
  #remoteDoc = {};
  #revision = -1;
  #queue = Promise.resolve();
  #timer = null;
  #state = 'online';
  #onVisibility = () => { if (!document.hidden) this.tick(); };

  /**
   * @param {object} deps
   * @param {{rpc: Function}} deps.api
   * @param {string} deps.token
   * @param {string | null} [deps.characterId] obbligatorio per l'admin
   * @param {() => object} deps.getLocal stato attuale della scheda (snapshot)
   * @param {number} [deps.pollMs]
   */
  constructor({ api, token, characterId = null, getLocal, pollMs = 5000 }) {
    super();
    this.#api = api;
    this.#token = token;
    this.#characterId = characterId;
    this.#getLocal = getLocal;
    this.#pollMs = pollMs;
  }

  get state() { return this.#state; }

  /** Prima lettura: restituisce il documento remoto (può essere vuoto per una scheda nuova). */
  async load() {
    const row = await this.#fetch();
    this.#remoteDoc = row.data ?? {};
    this.#revision = row.revision;
    return { data: this.#remoteDoc, updatedBy: row.updated_by };
  }

  /** Da chiamare dopo aver caricato il documento nel Model: da qui in poi si confronta con questo. */
  markSynced(snapshot) {
    this.#base = structuredClone(snapshot);
  }

  /** Invia le sezioni cambiate. @returns {Promise<{pushed: boolean}>} */
  push(snapshot = this.#getLocal()) {
    return this.#enqueue(() => this.#push(snapshot));
  }

  /** Legge le novità degli altri. */
  pull() {
    return this.#enqueue(() => this.#pull());
  }

  /** Un ciclo completo: invia, poi legge. Mai in parallelo con altre operazioni. */
  tick() {
    return this.#enqueue(async () => {
      await this.#push(this.#getLocal());
      await this.#pull();
    });
  }

  start() {
    this.stop();
    this.#timer = setInterval(() => { if (!globalThis.document?.hidden) this.tick(); }, this.#pollMs);
    globalThis.document?.addEventListener('visibilitychange', this.#onVisibility);
  }

  stop() {
    clearInterval(this.#timer);
    this.#timer = null;
    globalThis.document?.removeEventListener('visibilitychange', this.#onVisibility);
  }

  // ------------------------------------------------------------ Interni

  /** Serializza le operazioni e non lascia mai che un errore blocchi la coda. */
  #enqueue(task) {
    const run = this.#queue.then(task).catch((error) => this.#fail(error));
    this.#queue = run;
    return run;
  }

  #fail(error) {
    if (error?.isAuthFailure) {
      this.stop();
      this.#setState('revoked');
    } else {
      this.#setState('offline');
    }
    return { pushed: false };
  }

  #setState(state) {
    if (state === this.#state) return;
    this.#state = state;
    this.emit('state', state);
  }

  async #fetch() {
    const [row] = (await this.#api.rpc('get_character', { p_token: this.#token, p_character_id: this.#characterId })) ?? [];
    if (!row) throw Object.assign(new Error('not_found'), { isAuthFailure: true });
    return row;
  }

  async #push(snapshot) {
    const changes = diffDeep(this.#base, snapshot);
    if (changes === undefined) return { pushed: false };

    const [row] = (await this.#api.rpc('save_character', {
      p_token: this.#token,
      p_character_id: this.#characterId,
      p_changes: changes,
    })) ?? [];
    if (!row) throw new Error('empty response');

    this.#base = deepMerge(this.#base, changes);
    this.#setState('online');
    this.#integrate(row);
    return { pushed: true };
  }

  /** Chiede solo il numero di revisione (pochi byte) e scarica la scheda se è cambiato. */
  async #pull() {
    const revision = await this.#api.rpc('character_revision', { p_token: this.#token, p_character_id: this.#characterId });
    this.#setState('online');
    if (revision === this.#revision) return;
    this.#integrate(await this.#fetch());
  }

  /** Applica al Model i campi cambiati dagli altri e non toccati qui. */
  #integrate(row) {
    const remote = row.data ?? {};
    const changes = applicableChanges(diffDeep(this.#remoteDoc, remote), this.#getLocal(), this.#base);
    this.#remoteDoc = remote;
    this.#revision = row.revision;
    if (changes === undefined) return;
    this.#base = deepMerge(this.#base, changes);
    this.emit('remote', { changes, updatedBy: row.updated_by });
  }
}
