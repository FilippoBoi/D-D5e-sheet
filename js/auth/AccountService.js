/**
 * Account del Master: login con email (link magico) su Supabase Auth, solo con fetch.
 *
 *   1. requestLink(email)        → Supabase manda una email con un link
 *   2. il link riporta sul sito con la sessione nell'indirizzo (#access_token=…)
 *   3. consumeUrlHash(hash)      → la sessione viene letta e salvata nel browser
 *   4. getAccessToken()          → JWT da mandare con ogni chiamata; si rinnova da solo
 *
 * Non tocca il DOM; storage, fetch e orologio sono iniettati (testabile).
 * La firma del JWT la verifica il server: qui lo si legge solo per sapere chi è e quando scade.
 */

/** Rinnova con questo anticipo (secondi) rispetto alla scadenza. */
const REFRESH_MARGIN_S = 60;

const AUTH_ERRORS = {
  over_email_send_rate_limit: 'email_rate_limit',
  over_request_rate_limit: 'email_rate_limit',
  email_address_not_authorized: 'email_not_authorized',
  email_address_invalid: 'email_invalid',
  validation_failed: 'email_invalid',
  signup_disabled: 'signup_disabled',
  otp_disabled: 'signup_disabled',
  otp_expired: 'link_expired',
  access_denied: 'link_expired',
};

export class AccountError extends Error {
  /** @param {string} code */
  constructor(code, message = code) {
    super(message);
    this.name = 'AccountError';
    this.code = code;
  }
}

/** Legge il contenuto (non verificato) di un JWT. @returns {Record<string, any> | null} */
export function decodeJwt(token) {
  try {
    const payload = String(token).split('.')[1];
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(payload.length / 4) * 4, '=');
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
}

/** Indirizzo a cui il link dell'email deve riportare: questa pagina, senza parametri né frammento. */
export function siteUrl(href) {
  const url = new URL(href);
  return `${url.origin}${url.pathname}`;
}

/** Toglie il frammento (#access_token=…) dall'indirizzo, tenendo il resto. */
export function stripHash(href) {
  const url = new URL(href);
  return url.pathname + url.search;
}

export class AccountService {
  #url;
  #anonKey;
  #fetch;
  #storage;
  #key;
  #now;
  /** @type {{accessToken: string, refreshToken: string, expiresAt: number, userId: string, email: string} | null} */
  #session = null;
  #refreshing = null;

  /**
   * @param {{url: string, anonKey: string}} config
   * @param {Storage | null} storage
   * @param {{fetchImpl?: typeof fetch, key?: string, now?: () => number}} [options] `now` in millisecondi
   */
  constructor({ url, anonKey }, storage, { fetchImpl = globalThis.fetch?.bind(globalThis), key = 'dnd5e-character-sheet:account', now = () => Date.now() } = {}) {
    this.#url = String(url).replace(/\/+$/, '');
    this.#anonKey = anonKey;
    this.#storage = storage;
    this.#fetch = fetchImpl;
    this.#key = key;
    this.#now = now;
    this.#restore();
  }

  get isSignedIn() { return this.#session !== null; }
  get email() { return this.#session?.email ?? ''; }
  get userId() { return this.#session?.userId ?? ''; }

  /**
   * Chiede a Supabase di mandare il link di accesso (crea l'account se non c'è).
   * @param {string} email
   * @param {string} redirectTo dove deve riportare il link (deve essere tra i "Redirect URLs" del progetto)
   * @throws {AccountError} email_invalid, email_rate_limit, email_not_authorized, signup_disabled, network, unknown
   */
  async requestLink(email, redirectTo) {
    const clean = String(email ?? '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) throw new AccountError('email_invalid');
    await this.#call(`/auth/v1/otp?redirect_to=${encodeURIComponent(redirectTo)}`, { email: clean, create_user: true });
  }

  /**
   * Legge la sessione dal frammento dell'indirizzo, se il link dell'email ha riportato qui.
   * @param {string} hash es. location.hash
   * @returns {{status: 'none'} | {status: 'signedIn'} | {status: 'error', code: string}}
   */
  consumeUrlHash(hash) {
    const params = new URLSearchParams(String(hash ?? '').replace(/^#/, ''));
    const error = params.get('error_code') ?? params.get('error');
    if (error) return { status: 'error', code: AUTH_ERRORS[error] ?? 'unknown' };

    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    if (!accessToken || !refreshToken) return { status: 'none' };

    const session = this.#toSession(accessToken, refreshToken);
    if (!session) return { status: 'error', code: 'unknown' };
    this.#save(session);
    return { status: 'signedIn' };
  }

  /**
   * JWT valido da mandare al server, rinnovato se sta per scadere (o se `force`).
   * @returns {Promise<string | null>} null se non si è loggati
   */
  async getAccessToken({ force = false } = {}) {
    this.#restore(); // un'altra scheda del browser può aver già rinnovato
    if (!this.#session) return null;
    const expiring = this.#session.expiresAt - this.#now() / 1000 < REFRESH_MARGIN_S;
    if (!force && !expiring) return this.#session.accessToken;
    return (await this.#refresh()) ?? (expiring ? null : this.#session?.accessToken ?? null);
  }

  /** Esce: chiude la sessione sul server (se raggiungibile) e dimentica tutto qui. */
  async signOut() {
    const token = this.#session?.accessToken;
    this.#save(null);
    if (!token) return;
    try {
      await this.#fetch(`${this.#url}/auth/v1/logout`, { method: 'POST', headers: { apikey: this.#anonKey, Authorization: `Bearer ${token}` } });
    } catch { /* il browser è comunque scollegato */ }
  }

  // ------------------------------------------------------------ Interni

  /** Rinnovo condiviso: più richieste insieme fanno un solo giro. @returns {Promise<string | null>} */
  #refresh() {
    if (!this.#refreshing) {
      this.#refreshing = this.#doRefresh().finally(() => { this.#refreshing = null; });
    }
    return this.#refreshing;
  }

  async #doRefresh() {
    const current = this.#session;
    if (!current) return null;
    try {
      const data = await this.#call('/auth/v1/token?grant_type=refresh_token', { refresh_token: current.refreshToken });
      const session = this.#toSession(data?.access_token, data?.refresh_token);
      if (!session) throw new AccountError('unknown');
      this.#save(session);
      return session.accessToken;
    } catch (error) {
      // Rete assente: si resta collegati e si riprova. Sessione rifiutata dal server: si è scollegati.
      if (error?.code !== 'network') this.#save(null);
      return null;
    }
  }

  async #call(path, body) {
    let response;
    try {
      response = await this.#fetch(`${this.#url}${path}`, {
        method: 'POST',
        headers: { apikey: this.#anonKey, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch {
      throw new AccountError('network');
    }
    const text = await response.text();
    let payload = null;
    try { payload = text ? JSON.parse(text) : null; } catch { /* non JSON */ }
    if (response.ok) return payload;

    const reason = payload?.error_code ?? payload?.code;
    throw new AccountError(AUTH_ERRORS[reason] ?? (response.status === 429 ? 'email_rate_limit' : 'unknown'), payload?.msg ?? payload?.message ?? `HTTP ${response.status}`);
  }

  #toSession(accessToken, refreshToken) {
    const claims = decodeJwt(accessToken);
    if (!claims?.sub || !refreshToken) return null;
    return {
      accessToken,
      refreshToken,
      expiresAt: Number(claims.exp) || this.#now() / 1000 + 3600,
      userId: String(claims.sub),
      email: String(claims.email ?? ''),
    };
  }

  #restore() {
    try {
      const saved = JSON.parse(this.#storage?.getItem(this.#key) ?? 'null');
      this.#session = saved?.accessToken && saved?.refreshToken && saved?.userId ? saved : null;
    } catch {
      this.#session = null;
    }
  }

  #save(session) {
    this.#session = session;
    try {
      this.#storage?.setItem(this.#key, JSON.stringify(session)); // null → "null": al ricaricamento si legge come "nessuna sessione"
    } catch { /* ignorato di proposito */ }
  }
}
