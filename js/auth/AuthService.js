/**
 * Chi è collegato.
 *
 *   GIOCATORE  token di una scheda (PG-…). Il dispositivo lo ricorda, così si resta
 *              collegati dopo il ricaricamento della pagina.
 *   MASTER     account (login con email, vedi AccountService). Ogni campagna ha un solo
 *              proprietario; un Master può avere più campagne. Non esistono più token admin:
 *              una campagna creata con la versione precedente si rivendica una sola volta
 *              con il suo vecchio token (claimCampaign).
 *
 * Non tocca il DOM; storage, API e account sono iniettati (testabile).
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
 * @typedef {object} Session
 * @property {'player'|'admin'} role
 * @property {string | null} token       token del giocatore (null per il Master)
 * @property {string | null} campaignId
 * @property {string} campaignName
 * @property {string | null} characterId solo per il giocatore
 */

export class AuthService {
  #api;
  #storage;
  #account;
  #key;
  /** Sessioni di giocatore ricordate su questo dispositivo. @type {Array<{token: string, campaignId: string, campaignName: string, characterId: string}>} */
  #players = [];
  /** Token del giocatore attivo; null = si lavora da Master (se c'è un account). */
  #playerToken = null;
  /** Campagna del Master attualmente selezionata. */
  #campaignId = null;
  /** Campagne del Master (dall'ultimo caricamento dal server). @type {Array<{id: string, name: string, characterCount: number}>} */
  #campaigns = [];
  /** Ultima scheda aperta dal Master, per campagna. @type {Record<string, {id: string, label: string}>} */
  #lastOpened = {};

  /**
   * @param {{rpc: Function}} api
   * @param {Storage | null} storage
   * @param {import('./AccountService.js').AccountService} account
   * @param {string} [key]
   */
  constructor(api, storage, account, key = 'dnd5e-character-sheet:sessions') {
    this.#api = api;
    this.#storage = storage;
    this.#account = account;
    this.#key = key;
    this.#restore();
  }

  get isMaster() { return this.#account.isSignedIn; }
  get email() { return this.#account.email; }

  /** Campagne del Master. */
  get campaigns() { return this.#campaigns; }

  /** @returns {Session | null} */
  get active() {
    const player = this.#players.find((p) => p.token === this.#playerToken);
    if (player) {
      return { role: 'player', token: player.token, campaignId: player.campaignId, campaignName: player.campaignName, characterId: player.characterId };
    }
    if (!this.#account.isSignedIn) return null;
    const campaign = this.#campaigns.find((c) => c.id === this.#campaignId) ?? null;
    return { role: 'admin', token: null, campaignId: campaign?.id ?? null, campaignName: campaign?.name ?? '', characterId: null };
  }

  // ------------------------------------------------------------ Giocatore

  /**
   * Verifica un token di giocatore sul server e lo rende la sessione attiva.
   * @param {string} rawToken
   * @returns {Promise<Session>}
   * @throws invalid_token (formato o token non valido), legacy_admin_token (è un vecchio token admin)
   */
  async login(rawToken) {
    const token = normalizeToken(rawToken);
    if (!token) throw Object.assign(new Error('invalid_token'), { code: 'invalid_token' });

    const [row] = (await this.#api.rpc('resolve_token', { p_token: token })) ?? [];
    if (!row) throw Object.assign(new Error('invalid_token'), { code: 'invalid_token' });

    this.#players = [...this.#players.filter((p) => p.token !== token), {
      token, campaignId: row.campaign_id, campaignName: row.campaign_name, characterId: row.character_id,
    }];
    this.#playerToken = token;
    this.#persist();
    return /** @type {Session} */ (this.active);
  }

  // --------------------------------------------------------------- Master

  /** Manda al Master il link di accesso per email. @throws {AccountError} */
  requestLink(email, redirectTo) {
    return this.#account.requestLink(email, redirectTo);
  }

  /** Legge la sessione dall'indirizzo, se il link dell'email ha riportato qui. */
  completeSignInFromUrl(hash) {
    const result = this.#account.consumeUrlHash(hash);
    if (result.status === 'signedIn') this.#playerToken = null; // chi arriva dal link dell'email vuole lavorare da Master
    return result;
  }

  /**
   * Subito dopo il ritorno dall'email: scambia il refresh token che era nell'indirizzo con uno nuovo.
   * Quello vecchio resta nella cronologia del browser, ma non vale più (si usa una volta sola).
   * Senza rete non fa nulla: si riprova al primo rinnovo.
   */
  async rotateSession() {
    try { await this.#account.getAccessToken({ force: true }); } catch { /* ignorato di proposito */ }
  }

  /** Ricarica le campagne del Master dal server e tiene valida la selezione. */
  async refreshCampaigns() {
    if (!this.#account.isSignedIn) { this.#campaigns = []; return this.#campaigns; }
    const rows = (await this.#api.rpc('list_campaigns')) ?? [];
    this.#campaigns = rows.map((r) => ({ id: r.campaign_id, name: r.campaign_name, characterCount: Number(r.character_count) || 0 }));
    if (!this.#campaigns.some((c) => c.id === this.#campaignId)) this.#campaignId = this.#campaigns[0]?.id ?? null;
    this.#persist();
    return this.#campaigns;
  }

  /** Il progetto richiede un codice per creare campagne? (false se non si riesce a chiederlo) */
  async creationRequiresCode() {
    try {
      return (await this.#api.rpc('creation_requires_code')) === true;
    } catch {
      return false;
    }
  }

  /**
   * Crea una campagna (il Master ne diventa l'unico proprietario) e la seleziona.
   * @param {string} name
   * @param {string} [code] codice di creazione, se il progetto lo richiede
   */
  async createCampaign(name, code = '') {
    const [row] = (await this.#api.rpc('create_campaign', { p_name: name, p_code: code.trim() || null })) ?? [];
    return this.#adopt(row);
  }

  /**
   * Rivendica una campagna creata con la versione precedente, con il suo vecchio token admin.
   * Funziona una volta sola: poi la campagna è dell'account e il token non vale più.
   * @throws invalid_token
   */
  async claimCampaign(rawToken) {
    const token = normalizeToken(rawToken);
    if (!token) throw Object.assign(new Error('invalid_token'), { code: 'invalid_token' });
    const [row] = (await this.#api.rpc('claim_campaign', { p_admin_token: token })) ?? [];
    return this.#adopt(row);
  }

  async #adopt(row) {
    this.#playerToken = null;
    this.#campaignId = row.campaign_id;
    await this.refreshCampaigns();
    this.#campaignId = row.campaign_id;
    this.#persist();
    return this.active;
  }

  /** Passa a un'altra campagna del Master. */
  selectCampaign(campaignId) {
    if (this.#campaigns.some((c) => c.id === campaignId)) {
      this.#playerToken = null;
      this.#campaignId = campaignId;
      this.#persist();
    }
  }

  /** Aggiorna il nome di una campagna (dopo una rinomina). */
  updateCampaignName(campaignId, name) {
    const campaign = this.#campaigns.find((c) => c.id === campaignId);
    if (campaign) campaign.name = name;
  }

  /** Ultima scheda aperta dal Master in questa campagna, per riaprirla dopo il ricaricamento. */
  get lastOpened() {
    return this.#campaignId ? (this.#lastOpened[this.#campaignId] ?? null) : null;
  }

  /** @param {{id: string, label: string} | null} entry */
  rememberOpened(entry) {
    if (!this.#campaignId || this.active?.role !== 'admin') return;
    if (entry) this.#lastOpened[this.#campaignId] = { id: String(entry.id), label: String(entry.label ?? '') };
    else delete this.#lastOpened[this.#campaignId];
    this.#persist();
  }

  // ----------------------------------------------------------------- Uscita

  /**
   * Esce. Giocatore: dimentica quel token (e, se questo dispositivo ha anche un account Master, si torna a lavorare da Master).
   * Master: chiude l'account su questo dispositivo.
   */
  logout() {
    if (this.active?.role === 'player') {
      this.#players = this.#players.filter((p) => p.token !== this.#playerToken);
      this.#playerToken = null;
    } else {
      this.signOutMaster();
      return;
    }
    this.#persist();
  }

  /** Chiude solo l'account del Master su questo dispositivo: i token dei giocatori restano. */
  signOutMaster() {
    this.#account.signOut();
    this.#campaigns = [];
    this.#campaignId = null;
    this.#lastOpened = {};
    this.#persist();
  }

  #restore() {
    try {
      const saved = JSON.parse(this.#storage?.getItem(this.#key) ?? 'null');
      if (!saved || typeof saved !== 'object') return;
      // Formato precedente: { sessions: [{role, token, ...}], active }. Si tengono solo i giocatori.
      const legacy = Array.isArray(saved.sessions) ? saved.sessions.filter((p) => p?.role === 'player') : [];
      this.#players = (Array.isArray(saved.players) ? saved.players : legacy)
        .filter((p) => normalizeToken(p?.token) === p?.token && p.token.startsWith('PG-') && typeof p.characterId === 'string')
        .map((p) => ({ token: p.token, campaignId: String(p.campaignId ?? ''), campaignName: String(p.campaignName ?? ''), characterId: p.characterId }));
      const wanted = saved.playerToken ?? saved.active;
      this.#playerToken = this.#players.some((p) => p.token === wanted) ? wanted : null;
      this.#campaignId = typeof saved.campaignId === 'string' ? saved.campaignId : null;
      if (saved.lastOpened && typeof saved.lastOpened === 'object') {
        for (const [campaignId, e] of Object.entries(saved.lastOpened)) {
          if (typeof e?.id === 'string') this.#lastOpened[campaignId] = { id: e.id, label: String(e.label ?? '') };
        }
      }
    } catch { /* storage non disponibile o corrotto: si riparte senza sessioni */ }
  }

  #persist() {
    try {
      this.#storage?.setItem(this.#key, JSON.stringify({
        players: this.#players, playerToken: this.#playerToken, campaignId: this.#campaignId, lastOpened: this.#lastOpened,
      }));
    } catch { /* ignorato di proposito */ }
  }
}
