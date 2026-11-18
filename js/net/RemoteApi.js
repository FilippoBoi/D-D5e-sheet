/**
 * Client minimale per le funzioni RPC del database (PostgREST di Supabase).
 * Usa solo fetch: nessuna libreria, nessun build step.
 *
 * Gli errori del database (`raise exception 'invalid_token'`) diventano
 * RemoteError con `code` stabile; i problemi di rete hanno code 'network'.
 */
const KNOWN_CODES = new Set([
  'invalid_token', 'forbidden', 'not_found', 'invalid_name', 'invalid_code', 'limit_reached', 'invalid_data',
  'auth_required',        // serve il login da Master
  'legacy_admin_token',   // è un vecchio token admin: va rivendicato, non usato per entrare
]);

/** Sotto questa soglia la richiesta può usare keepalive (sopravvive alla chiusura pagina). */
const KEEPALIVE_MAX_BYTES = 60_000;

export class RemoteError extends Error {
  /** @param {string} code */
  constructor(code, message = code) {
    super(message);
    this.name = 'RemoteError';
    this.code = code;
  }

  /** L'accesso non vale più (token revocato o ruotato, scheda eliminata, login scaduto): non ha senso riprovare. */
  get isAuthFailure() {
    return this.code === 'invalid_token' || this.code === 'forbidden' || this.code === 'not_found' || this.code === 'auth_required';
  }
}

export class RemoteApi {
  #url;
  #anonKey;
  #fetch;
  #getAccessToken;

  /**
   * @param {{url: string, anonKey: string, getAccessToken?: (opts?: {force?: boolean}) => Promise<string | null>}} config
   *   getAccessToken: il JWT del Master loggato (se c'è); con `force` lo rinnova
   * @param {typeof fetch} [fetchImpl] iniettabile per i test
   */
  constructor({ url, anonKey, getAccessToken = null }, fetchImpl = globalThis.fetch?.bind(globalThis)) {
    this.#url = String(url).replace(/\/+$/, '');
    this.#anonKey = anonKey;
    this.#fetch = fetchImpl;
    this.#getAccessToken = getAccessToken;
  }

  /**
   * @param {string} fn nome della funzione SQL
   * @param {Record<string, unknown>} [args] argomenti (chiavi = nomi dei parametri p_*)
   * @returns {Promise<any>}
   */
  async rpc(fn, args = {}) {
    const body = JSON.stringify(args);
    let token = await this.#accessToken(false);
    let response = await this.#send(fn, body, token);

    // Login scaduto: si rinnova una volta e si riprova.
    if (response.status === 401 && this.#getAccessToken) {
      const fresh = await this.#accessToken(true);
      if (fresh && fresh !== token) {
        token = fresh;
        response = await this.#send(fn, body, token);
      }
    }

    const text = await response.text();
    let payload = null;
    try { payload = text ? JSON.parse(text) : null; } catch { /* corpo non JSON */ }

    if (response.ok) return payload;

    const message = typeof payload?.message === 'string' ? payload.message : '';
    let code = KNOWN_CODES.has(message) ? message : 'unknown';
    // PostgREST: 42501 = permesso negato (funzione riservata agli account), PGRST30x = JWT scaduto/non valido.
    if (code === 'unknown' && (payload?.code === '42501' || /^PGRST30[1-3]$/.test(payload?.code ?? '') || response.status === 401)) code = 'auth_required';
    throw new RemoteError(code, message || `HTTP ${response.status}`);
  }

  async #accessToken(force) {
    if (!this.#getAccessToken) return null;
    try { return (await this.#getAccessToken({ force })) ?? null; } catch { return null; }
  }

  async #send(fn, body, token) {
    const headers = { apikey: this.#anonKey, 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    try {
      return await this.#fetch(`${this.#url}/rest/v1/rpc/${fn}`, {
        method: 'POST', headers, body, keepalive: body.length < KEEPALIVE_MAX_BYTES,
      });
    } catch {
      throw new RemoteError('network');
    }
  }
}
