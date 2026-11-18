/**
 * Client minimale per le funzioni RPC del database (PostgREST di Supabase).
 * Usa solo fetch: nessuna libreria, nessun build step.
 *
 * Gli errori del database (`raise exception 'invalid_token'`) diventano
 * RemoteError con `code` stabile; i problemi di rete hanno code 'network'.
 */
const KNOWN_CODES = new Set(['invalid_token', 'forbidden', 'not_found', 'invalid_name', 'limit_reached', 'invalid_data']);

/** Sotto questa soglia la richiesta può usare keepalive (sopravvive alla chiusura pagina). */
const KEEPALIVE_MAX_BYTES = 60_000;

export class RemoteError extends Error {
  /** @param {string} code */
  constructor(code, message = code) {
    super(message);
    this.name = 'RemoteError';
    this.code = code;
  }

  /** Il token non vale più (revocato, ruotato, scheda eliminata): non ha senso riprovare. */
  get isAuthFailure() {
    return this.code === 'invalid_token' || this.code === 'forbidden' || this.code === 'not_found';
  }
}

export class RemoteApi {
  #url;
  #anonKey;
  #fetch;

  /**
   * @param {{url: string, anonKey: string}} config
   * @param {typeof fetch} [fetchImpl] iniettabile per i test
   */
  constructor({ url, anonKey }, fetchImpl = globalThis.fetch?.bind(globalThis)) {
    this.#url = String(url).replace(/\/+$/, '');
    this.#anonKey = anonKey;
    this.#fetch = fetchImpl;
  }

  /**
   * @param {string} fn nome della funzione SQL
   * @param {Record<string, unknown>} [args] argomenti (chiavi = nomi dei parametri p_*)
   * @returns {Promise<any>}
   */
  async rpc(fn, args = {}) {
    const body = JSON.stringify(args);
    let response;
    try {
      response = await this.#fetch(`${this.#url}/rest/v1/rpc/${fn}`, {
        method: 'POST',
        headers: { apikey: this.#anonKey, 'Content-Type': 'application/json' },
        body,
        keepalive: body.length < KEEPALIVE_MAX_BYTES,
      });
    } catch {
      throw new RemoteError('network');
    }

    const text = await response.text();
    let payload = null;
    try { payload = text ? JSON.parse(text) : null; } catch { /* corpo non JSON */ }

    if (response.ok) return payload;

    const message = typeof payload?.message === 'string' ? payload.message : '';
    throw new RemoteError(KNOWN_CODES.has(message) ? message : 'unknown', message || `HTTP ${response.status}`);
  }
}
