/**
 * Sessioni a token.
 *
 * Un token identifica chi sei: admin di una campagna (ADM-…) oppure giocatore
 * di una scheda (PG-…). Il dispositivo ricorda i token usati, così si resta
 * collegati dopo il ricaricamento della pagina; un admin può avere più campagne.
 *
 * Non tocca il DOM; lo storage e l'API sono iniettati (testabile).
 */

const TOKEN_PATTERN = /^(ADM|PG)-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/;
const URL_PARAM = 't';

/**
 * Accetta un token scritto a mano, con spazi o minuscole, o un intero link di invito.
 * @returns {string | null} il token normalizzato, o null se non ha il formato giusto
 */
export function normalizeToken(input) {
  let text = String(input ?? '').trim();
  const fromLink = text.match(/[?&]t=([^&#\s]+)/i);
  if (fromLink) text = decodeURIComponent(fromLink[1]);
  const token = text.toUpperCase().replace(/\s+/g, '');
  return TOKEN_PATTERN.test(token) ? token : null;
}

/** Token presente nell'indirizzo (?t=...), se valido. */
export function readTokenFromUrl(href) {
  try {
    return normalizeToken(new URL(href).searchParams.get(URL_PARAM));
  } catch {
    return null;
  }
}

/** Stesso indirizzo senza il token: va in cronologia e nella barra, meglio non lasciarlo. */
export function stripTokenFromUrl(href) {
  const url = new URL(href);
  url.searchParams.delete(URL_PARAM);
  return url.pathname + url.search + url.hash;
}

/** Link di invito per un token. */
export function buildInviteLink(href, token) {
  const url = new URL(href);
  url.search = '';
  url.hash = '';
  url.searchParams.set(URL_PARAM, token);
  return url.toString();
}

/**
 * @typedef {{token: string, role: 'admin'|'player', campaignId: string, campaignName: string, characterId: string|null}} Session
 */

export class AuthService {
  #api;
  #storage;
  #key;
  /** @type {Session[]} */
  #sessions = [];
  #activeToken = null;
  /** @type {Record<string, {id: string, label: string}>} */
  #lastOpened = {};

  /**
   * @param {{rpc: Function}} api
   * @param {Storage | null} storage
   * @param {string} [key]
   */
  constructor(api, storage, key = 'dnd5e-character-sheet:sessions') {
    this.#api = api;
    this.#storage = storage;
    this.#key = key;
    this.#restore();
  }

  /** @returns {Session | null} */
  get active() {
    return this.#sessions.find((s) => s.token === this.#activeToken) ?? null;
  }

  /** @returns {Session[]} le campagne gestite da questo dispositivo */
  get adminSessions() {
    return this.#sessions.filter((s) => s.role === 'admin');
  }

  /**
   * Verifica il token sul server e lo rende la sessione attiva.
   * @param {string} rawToken
   * @returns {Promise<Session>}
   * @throws {RemoteError} invalid_token se il formato o il token non sono validi
   */
  async login(rawToken) {
    const token = normalizeToken(rawToken);
    if (!token) throw Object.assign(new Error('invalid_token'), { code: 'invalid_token' });

    const [row] = (await this.#api.rpc('resolve_token', { p_token: token })) ?? [];
    if (!row) throw Object.assign(new Error('invalid_token'), { code: 'invalid_token' });

    return this.#store({
      token,
      role: row.role,
      campaignId: row.campaign_id,
      campaignName: row.campaign_name,
      characterId: row.character_id ?? null,
    });
  }

  /** Crea una campagna e ne diventa admin. @returns {Promise<Session>} */
  async createCampaign(name) {
    const [row] = (await this.#api.rpc('create_campaign', { p_name: name })) ?? [];
    return this.#store({
      token: row.admin_token,
      role: 'admin',
      campaignId: row.campaign_id,
      campaignName: row.campaign_name,
      characterId: null,
    });
  }

  /** Passa a un'altra campagna già nota a questo dispositivo. */
  switchTo(token) {
    if (this.#sessions.some((s) => s.token === token)) {
      this.#activeToken = token;
      this.#persist();
    }
  }

  /** Dimentica la sessione attiva (non revoca il token: resta valido sul server). */
  logout() {
    delete this.#lastOpened[this.#activeToken];
    this.#sessions = this.#sessions.filter((s) => s.token !== this.#activeToken);
    this.#activeToken = this.#sessions[0]?.token ?? null;
    this.#persist();
  }

  /** Ultima scheda aperta da un admin in questa campagna, per riaprirla dopo il ricaricamento. */
  get lastOpened() { return this.active ? (this.#lastOpened[this.active.token] ?? null) : null; }

  /** @param {{id: string, label: string} | null} entry */
  rememberOpened(entry) {
    if (!this.active) return;
    if (entry) this.#lastOpened[this.active.token] = { id: String(entry.id), label: String(entry.label ?? '') };
    else delete this.#lastOpened[this.active.token];
    this.#persist();
  }

  /** Aggiorna il nome di una campagna ricordata (dopo una rinomina). */
  updateCampaignName(token, name) {
    const session = this.#sessions.find((s) => s.token === token);
    if (session) { session.campaignName = name; this.#persist(); }
  }

  #store(session) {
    this.#sessions = [...this.#sessions.filter((s) => s.token !== session.token), session];
    this.#activeToken = session.token;
    this.#persist();
    return session;
  }

  #restore() {
    try {
      const saved = JSON.parse(this.#storage?.getItem(this.#key) ?? 'null');
      if (Array.isArray(saved?.sessions)) {
        this.#sessions = saved.sessions.filter((s) => normalizeToken(s?.token) === s?.token && (s.role === 'admin' || s.role === 'player'));
        this.#activeToken = saved.active ?? null;
        const last = saved.lastOpened;
        if (last && typeof last === 'object') {
          for (const [token, e] of Object.entries(last)) {
            if (this.#sessions.some((s) => s.token === token) && typeof e?.id === 'string') this.#lastOpened[token] = { id: e.id, label: String(e.label ?? '') };
          }
        }
      }
    } catch { /* storage non disponibile o corrotto: si riparte senza sessioni */ }
  }

  #persist() {
    try {
      this.#storage?.setItem(this.#key, JSON.stringify({ sessions: this.#sessions, active: this.#activeToken, lastOpened: this.#lastOpened }));
    } catch { /* ignorato di proposito */ }
  }
}
