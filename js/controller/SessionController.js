/**
 * Orchestra accesso, pannello del Master e scheda condivisa.
 *
 *   AuthView  <-->  SessionController  --> AuthService   (chi sono: giocatore con token, Master con account)
 *                          |            --> RemoteApi     (pannello del Master)
 *                          └──────────> CharacterController.attachRemote(sync)
 *
 * Senza configurazione del backend non fa nulla: l'app resta solo locale.
 */
import { CharacterSync } from '../sync/CharacterSync.js';
import { buildInviteLink, readTokenFromUrl, stripTokenFromUrl } from '../auth/AuthService.js';
import { siteUrl, stripHash } from '../auth/AccountService.js';
import { errorText } from '../view/AuthView.js';
import { pick } from '../i18n/i18n.js';

export class SessionController {
  #auth;
  #api;
  #view;
  #characters; // CharacterController
  #status;     // (messaggio) => void
  #location;
  #history;

  #sync = null;
  #sheetLabel = '';
  #syncState = 'online';
  /** Le campagne del Master sono state caricate dal server (se no, si è offline e non si apre nulla). */
  #campaignsLoaded = false;
  /** Stato del pannello del Master (si ricostruisce a ogni modifica). */
  #panel = { characters: [], loading: false, error: '' };

  /**
   * @param {object} deps
   * @param {import('../auth/AuthService.js').AuthService} deps.auth
   * @param {{rpc: Function}} deps.api
   * @param {import('../view/AuthView.js').AuthView} deps.view
   * @param {import('./CharacterController.js').CharacterController} deps.characters
   * @param {(message: string) => void} deps.showStatus
   */
  constructor({ auth, api, view, characters, showStatus, location = globalThis.location, history = globalThis.history }) {
    this.#auth = auth;
    this.#api = api;
    this.#view = view;
    this.#characters = characters;
    this.#status = showStatus;
    this.#location = location;
    this.#history = history;
  }

  async init() {
    this.#characters.onLanguageChange(() => this.#refresh());

    // Ritorno dal link dell'email: la sessione del Master è nel frammento dell'indirizzo (#access_token=…).
    const comingBack = this.#auth.completeSignInFromUrl(this.#location.hash);
    if (comingBack.status !== 'none') this.#history.replaceState(null, '', stripHash(this.#location.href));
    if (comingBack.status === 'error') this.#status(errorText({ code: comingBack.code }));
    if (comingBack.status === 'signedIn') {
      await this.#auth.rotateSession();                                        // il refresh token dell'indirizzo non deve restare valido
      // Il server ha rifiutato la sessione appena arrivata dal link (già usato altrove, o aperto da un'anteprima dell'email):
      // niente accesso, ma l'utente deve saperlo.
      if (!this.#auth.isMaster) this.#status(errorText({ code: 'link_expired' }));
    }

    // Link di invito di un giocatore (?t=TOKEN): entra e ripulisce l'indirizzo.
    const urlToken = readTokenFromUrl(this.#location.href);
    if (urlToken) {
      this.#history.replaceState(null, '', stripTokenFromUrl(this.#location.href));
      try {
        await this.#auth.login(urlToken);
      } catch (error) {
        this.#status(errorText(error));
      }
    }

    await this.#loadCampaigns();
    await this.#enterActiveSession({ autoOpenPanel: comingBack.status === 'signedIn' });
  }

  // ----------------------------------------------------- Campagne del Master

  /** Carica le campagne dell'account. Un login scaduto o rifiutato chiude la sessione del Master. */
  async #loadCampaigns() {
    this.#campaignsLoaded = false;
    if (!this.#auth.isMaster) return;
    try {
      await this.#auth.refreshCampaigns();
      this.#campaignsLoaded = true;
    } catch (error) {
      if (error?.code === 'auth_required') {
        this.#status(errorText(error));
        this.#signOutMaster();
      } else {
        this.#status(errorText(error)); // rete assente: si resta collegati, la scheda locale si usa lo stesso
      }
    }
  }

  /** Esce dall'account Master (ma non da un'eventuale sessione di giocatore). */
  #signOutMaster() {
    this.#auth.signOutMaster();
  }

  // -------------------------------------------------------- Ingresso

  async #enterActiveSession({ autoOpenPanel = false } = {}) {
    const session = this.#auth.active;
    if (!session) { this.#leaveRemote(); return this.#refresh(); }

    if (session.role === 'player') {
      await this.#openCharacter(session.token, session.characterId, pick('la mia scheda', 'my sheet'));
      return;
    }

    this.#leaveRemote();
    this.#refresh();
    if (!this.#campaignsLoaded) return;            // offline: niente pannello, resta la scheda locale
    if (!session.campaignId) return this.#openMasterHome();

    // Dopo un ricaricamento si riprende dalla scheda che si stava modificando.
    const last = autoOpenPanel ? null : this.#auth.lastOpened;
    if (last) await this.#openCharacter(null, last.id, last.label);
    if (!this.#sync) await this.#openPanel();
  }

  /** Collega il Controller alla scheda condivisa indicata. `token` è nullo per il Master. */
  async #openCharacter(token, characterId, label) {
    const sync = new CharacterSync({
      api: this.#api, token, characterId, getLocal: () => this.#characters.currentSnapshot(),
    });
    let remote;
    try {
      remote = await sync.load();
    } catch (error) {
      this.#status(errorText(error));
      if (this.#auth.active?.role === 'admin') {
        if (error?.code === 'auth_required') { this.#signOutMaster(); await this.#enterActiveSession(); return; }
        if (error?.isAuthFailure) this.#auth.rememberOpened(null); // scheda eliminata: resta l'accesso alla campagna
      } else if (error?.isAuthFailure) {
        this.#auth.logout();
        this.#leaveRemote();
      }
      return this.#refresh();
    }

    // Scheda in campagna ancora vuota: offri di caricare quella locale.
    let data = remote.data;
    let upload = false;
    if (Object.keys(data).length === 0 && this.#characters.hasLocalCharacter()
      && this.#view.confirm(pick(
        'La scheda in campagna è vuota. Vuoi caricarci la tua scheda locale?',
        'The campaign sheet is empty. Do you want to upload your local sheet to it?'))) {
      data = this.#characters.localSnapshot();
      upload = true;
    }

    this.#syncState = 'online';
    sync.on('state', (state) => {
      this.#syncState = state;
      if (state === 'revoked') this.#onRevoked();
      this.#refresh();
    });
    this.#sync = sync;
    this.#sheetLabel = label;
    this.#characters.attachRemote(sync, data, { upload });
    if (this.#auth.active?.role === 'admin') this.#auth.rememberOpened({ id: characterId, label });
    this.#view.close();
    this.#refresh();
  }

  #leaveRemote() {
    this.#sync = null;
    this.#syncState = 'online';
    this.#characters.detachRemote();
  }

  /** La sincronizzazione ha perso l'accesso: token ruotato (giocatore), scheda eliminata o login scaduto (Master). */
  async #onRevoked() {
    this.#leaveRemote();
    if (this.#auth.active?.role !== 'admin') {
      this.#status(pick('Accesso revocato dal Master.', 'Access revoked by the DM.'));
      this.#auth.logout();
      await this.#enterActiveSession();
      return;
    }
    this.#auth.rememberOpened(null);
    await this.#loadCampaigns();                   // un login scaduto si scopre qui e chiude la sessione
    if (!this.#auth.isMaster) { await this.#enterActiveSession(); return; }
    this.#status(pick('Scheda non più disponibile.', 'Sheet no longer available.'));
    await this.#enterActiveSession({ autoOpenPanel: true });
  }

  // ----------------------------------------------------------- Barra

  #refresh() {
    const session = this.#auth.active;
    this.#view.renderBar({
      session,
      email: this.#auth.email,
      sheetLabel: this.#sync ? this.#sheetLabel : pick('locale (solo su questo dispositivo)', 'local (this device only)'),
      syncState: this.#sync ? this.#syncState : null,
      canManage: session?.role === 'admin',
    }, {
      onLogin: () => this.#showLogin(),
      onManage: () => this.#openPanel(),
      onLogout: () => this.#logout(),
    });
  }

  #showLogin() {
    this.#view.showLogin({
      onLogin: async (token) => {
        await this.#auth.login(token);
        await this.#enterActiveSession();
      },
      onSendLink: (email) => this.#auth.requestLink(email, siteUrl(this.#location.href)),
    });
  }

  #logout() {
    this.#auth.logout();
    this.#view.close();
    this.#panel = { characters: [], loading: false, error: '' };
    this.#enterActiveSession();
  }

  // ------------------------------------------- Crea o rivendica una campagna

  #openMasterHome() {
    const hasCampaigns = this.#auth.campaigns.length > 0;
    this.#view.showMasterHome({ email: this.#auth.email, hasCampaigns }, {
      onCreate: async (name, code) => {
        await this.#auth.createCampaign(name, code);
        await this.#enterActiveSession({ autoOpenPanel: true });
      },
      onClaim: async (token) => {
        await this.#auth.claimCampaign(token);
        await this.#enterActiveSession({ autoOpenPanel: true });
      },
      onBack: hasCampaigns ? () => this.#openPanel() : null,
    });
    // La finestra si apre subito; il campo "Codice" compare appena il server dice che serve.
    this.#auth.creationRequiresCode().then((required) => { if (required) this.#view.revealCreationCode(); });
  }

  // -------------------------------------------------- Pannello del Master

  async #openPanel() {
    if (!this.#auth.active?.campaignId) return this.#openMasterHome();
    this.#panel = { characters: this.#panel.characters, loading: true, error: '' };
    this.#renderPanel();
    await this.#reloadCharacters();
  }

  async #reloadCharacters() {
    const session = this.#auth.active;
    if (session?.role !== 'admin' || !session.campaignId) return;
    try {
      this.#panel.characters = (await this.#api.rpc('list_characters', { p_campaign_id: session.campaignId })) ?? [];
      this.#panel.error = '';
    } catch (error) {
      this.#panel.error = errorText(error);
      if (error?.isAuthFailure) { await this.#recoverFromAuthFailure(error); return; }
    }
    this.#panel.loading = false;
    this.#renderPanel();
  }

  /** Login scaduto → si esce da Master; campagna sparita (eliminata altrove) → si ricarica l'elenco. */
  async #recoverFromAuthFailure(error) {
    this.#panel = { characters: [], loading: false, error: '' };
    if (error.code === 'auth_required') {
      this.#status(errorText(error));
      this.#signOutMaster();
    } else {
      await this.#loadCampaigns();
    }
    this.#view.close();
    await this.#enterActiveSession({ autoOpenPanel: true });
  }

  /** Esegue un comando del Master e ricarica l'elenco; gli errori restano nel pannello. */
  async #adminCall(fn, args) {
    try {
      const result = await this.#api.rpc(fn, args);
      await this.#reloadCharacters();
      return result;
    } catch (error) {
      if (error?.isAuthFailure) { await this.#recoverFromAuthFailure(error); return undefined; }
      this.#panel.error = errorText(error);
      this.#renderPanel();
      return undefined;
    }
  }

  #renderPanel() {
    const session = this.#auth.active;
    if (session?.role !== 'admin' || !session.campaignId) return;
    const base = this.#location.href;
    const find = (id) => this.#panel.characters.find((c) => c.id === id);
    const title = (c) => c.label || c.char_name || pick('Senza nome', 'Unnamed');

    this.#view.showAdmin({
      campaignName: session.campaignName,
      email: this.#auth.email,
      campaigns: this.#auth.campaigns.map((c) => ({ id: c.id, name: c.name, active: c.id === session.campaignId })),
      characters: this.#panel.characters.map((c) => ({
        id: c.id,
        title: title(c),
        subtitle: [c.char_name && c.char_name !== c.label ? c.char_name : '', this.#updatedText(c)].filter(Boolean).join(' · '),
        token: c.player_token,
        link: buildInviteLink(base, c.player_token),
      })),
      loading: this.#panel.loading,
      error: this.#panel.error,
    }, {
      copy: async (text) => { if (await this.#view.copy(text)) this.#status(pick('Copiato ✓', 'Copied ✓')); },
      switchCampaign: async (campaignId) => { this.#auth.selectCampaign(campaignId); await this.#enterActiveSession({ autoOpenPanel: true }); },
      newCampaign: () => this.#openMasterHome(),
      renameCampaign: async () => {
        const name = this.#view.prompt(pick('Nuovo nome della campagna:', 'New campaign name:'), session.campaignName)?.trim();
        if (!name) return;
        if (await this.#tryRpc('rename_campaign', { p_campaign_id: session.campaignId, p_name: name }) !== undefined) {
          this.#auth.updateCampaignName(session.campaignId, name);
          this.#refresh();
          this.#renderPanel();
        }
      },
      deleteCampaign: async () => {
        if (!this.#view.confirm(pick(
          `Eliminare la campagna "${session.campaignName}" e TUTTE le sue schede? Non è reversibile.`,
          `Delete the campaign "${session.campaignName}" and ALL its sheets? This cannot be undone.`))) return;
        if (await this.#tryRpc('delete_campaign', { p_campaign_id: session.campaignId }) !== undefined) {
          this.#panel = { characters: [], loading: false, error: '' };
          await this.#loadCampaigns();
          this.#view.close();
          await this.#enterActiveSession();
        }
      },
      createCharacter: (label) => this.#adminCall('create_character', { p_campaign_id: session.campaignId, p_label: label }),
      rename: async (id) => {
        const current = find(id);
        const label = this.#view.prompt(pick('Etichetta della scheda:', 'Sheet label:'), current?.label ?? '');
        if (label !== null) await this.#adminCall('rename_character', { p_character_id: id, p_label: label });
      },
      rotate: async (id) => {
        if (!this.#view.confirm(pick(
          'Generare un nuovo token? Il vecchio smetterà di funzionare subito e il giocatore verrà scollegato.',
          'Generate a new token? The old one stops working immediately and the player is signed out.'))) return;
        await this.#adminCall('rotate_player_token', { p_character_id: id });
      },
      remove: async (id) => {
        const current = find(id);
        if (!this.#view.confirm(pick(
          `Eliminare la scheda "${current ? title(current) : ''}"? Non è reversibile.`,
          `Delete the sheet "${current ? title(current) : ''}"? This cannot be undone.`))) return;
        await this.#adminCall('delete_character', { p_character_id: id });
      },
      open: (id) => {
        const current = find(id);
        return this.#openCharacter(null, id, current ? title(current) : '');
      },
    });
  }

  async #tryRpc(fn, args) {
    try {
      return (await this.#api.rpc(fn, args)) ?? null;
    } catch (error) {
      if (error?.isAuthFailure) { await this.#recoverFromAuthFailure(error); return undefined; }
      this.#panel.error = errorText(error);
      this.#renderPanel();
      return undefined;
    }
  }

  #updatedText(c) {
    if (!c.revision) return pick('mai modificata', 'never edited');
    const date = new Date(c.updated_at).toLocaleString(pick('it-IT', 'en-GB'), { dateStyle: 'short', timeStyle: 'short' });
    return `${pick('modificata', 'edited')} ${date}${c.updated_by === 'player' ? ` (${pick('giocatore', 'player')})` : ''}`;
  }
}
