/**
 * Orchestra accesso, pannello admin e scheda condivisa.
 *
 *   AuthView  <-->  SessionController  --> AuthService   (chi sono)
 *                          |            --> RemoteApi     (pannello admin)
 *                          └──────────> CharacterController.attachRemote(sync)
 *
 * Senza configurazione del backend non fa nulla: l'app resta solo locale.
 */
import { CharacterSync } from '../sync/CharacterSync.js';
import { buildInviteLink, readTokenFromUrl, stripTokenFromUrl } from '../auth/AuthService.js';
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
  #openCharacterId = null;
  #sheetLabel = '';
  #syncState = 'online';
  /** Stato del pannello admin (si ricostruisce a ogni modifica). */
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

    // Link di invito (?t=TOKEN): entra e ripulisce l'indirizzo.
    const urlToken = readTokenFromUrl(this.#location.href);
    if (urlToken) {
      this.#history.replaceState(null, '', stripTokenFromUrl(this.#location.href));
      try {
        await this.#auth.login(urlToken);
      } catch (error) {
        this.#status(errorText(error));
      }
    }
    await this.#enterActiveSession({ autoOpenPanel: Boolean(urlToken) });
  }

  // -------------------------------------------------------- Ingresso

  async #enterActiveSession({ autoOpenPanel = false } = {}) {
    const session = this.#auth.active;
    if (!session) { this.#leaveRemote(); return this.#refresh(); }

    if (session.role === 'player') {
      await this.#openCharacter(session.token, session.characterId, pick('la mia scheda', 'my sheet'));
    } else {
      this.#leaveRemote();
      this.#refresh();
      if (autoOpenPanel || this.#auth.adminSessions.length) await this.#openPanel();
    }
  }

  /** Collega il Controller alla scheda condivisa indicata. */
  async #openCharacter(token, characterId, label) {
    const sync = new CharacterSync({
      api: this.#api, token, characterId, getLocal: () => this.#characters.currentSnapshot(),
    });
    let remote;
    try {
      remote = await sync.load();
    } catch (error) {
      this.#status(errorText(error));
      if (error?.isAuthFailure) { this.#auth.logout(); this.#leaveRemote(); }
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
    this.#openCharacterId = characterId;
    this.#sheetLabel = label;
    this.#characters.attachRemote(sync, data, { upload });
    this.#view.close();
    this.#refresh();
  }

  #leaveRemote() {
    this.#sync = null;
    this.#openCharacterId = null;
    this.#syncState = 'online';
    this.#characters.detachRemote();
  }

  #onRevoked() {
    this.#leaveRemote();
    if (this.#auth.active?.role === 'admin') {
      // L'admin ha ancora accesso alla campagna: era la scheda a non esistere più.
      this.#status(pick('Scheda non più disponibile.', 'Sheet no longer available.'));
      this.#openPanel();
    } else {
      this.#status(pick('Accesso revocato dal Master.', 'Access revoked by the DM.'));
      this.#auth.logout();
      this.#enterActiveSession();
    }
  }

  // ----------------------------------------------------------- Barra

  #refresh() {
    const session = this.#auth.active;
    this.#view.renderBar({
      session,
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
        const session = await this.#auth.login(token);
        await this.#enterActiveSession({ autoOpenPanel: session.role === 'admin' });
      },
      onCreate: async (name) => {
        await this.#auth.createCampaign(name);
        await this.#enterActiveSession({ autoOpenPanel: true });
      },
    });
  }

  #logout() {
    this.#auth.logout();
    this.#view.close();
    this.#panel = { characters: [], loading: false, error: '' };
    this.#enterActiveSession();
  }

  // -------------------------------------------------- Pannello admin

  async #openPanel() {
    this.#panel = { characters: this.#panel.characters, loading: true, error: '' };
    this.#renderPanel();
    await this.#reloadCharacters();
  }

  async #reloadCharacters() {
    const session = this.#auth.active;
    if (session?.role !== 'admin') return;
    try {
      this.#panel.characters = (await this.#api.rpc('list_characters', { p_admin_token: session.token })) ?? [];
      this.#panel.error = '';
    } catch (error) {
      this.#panel.error = errorText(error);
      if (error?.isAuthFailure) this.#auth.logout();
    }
    this.#panel.loading = false;
    this.#renderPanel();
  }

  /** Esegue un comando admin e ricarica l'elenco; gli errori restano nel pannello. */
  async #adminCall(fn, args) {
    const session = this.#auth.active;
    try {
      const result = await this.#api.rpc(fn, { p_admin_token: session.token, ...args });
      await this.#reloadCharacters();
      return result;
    } catch (error) {
      this.#panel.error = errorText(error);
      this.#renderPanel();
      return undefined;
    }
  }

  #renderPanel() {
    const session = this.#auth.active;
    if (session?.role !== 'admin') return;
    const base = this.#location.href;
    const find = (id) => this.#panel.characters.find((c) => c.id === id);
    const title = (c) => c.label || c.char_name || pick('Senza nome', 'Unnamed');

    this.#view.showAdmin({
      campaignName: session.campaignName,
      adminToken: session.token,
      campaigns: this.#auth.adminSessions.map((s) => ({ token: s.token, name: s.campaignName, active: s.token === session.token })),
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
      switchCampaign: async (token) => { this.#auth.switchTo(token); await this.#enterActiveSession({ autoOpenPanel: true }); },
      newCampaign: () => { this.#view.close(); this.#showLogin(); },
      renameCampaign: async () => {
        const name = this.#view.prompt(pick('Nuovo nome della campagna:', 'New campaign name:'), session.campaignName)?.trim();
        if (!name) return;
        if (await this.#tryRpc('rename_campaign', { p_admin_token: session.token, p_name: name }) !== undefined) {
          this.#auth.updateCampaignName(session.token, name);
          this.#refresh();
          this.#renderPanel();
        }
      },
      deleteCampaign: async () => {
        if (!this.#view.confirm(pick(
          `Eliminare la campagna "${session.campaignName}" e TUTTE le sue schede? Non è reversibile.`,
          `Delete the campaign "${session.campaignName}" and ALL its sheets? This cannot be undone.`))) return;
        if (await this.#tryRpc('delete_campaign', { p_admin_token: session.token }) !== undefined) {
          this.#auth.logout();
          this.#view.close();
          await this.#enterActiveSession();
        }
      },
      createCharacter: (label) => this.#adminCall('create_character', { p_label: label }),
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
        return this.#openCharacter(session.token, id, current ? title(current) : '');
      },
    });
  }

  async #tryRpc(fn, args) {
    try {
      return (await this.#api.rpc(fn, args)) ?? null;
    } catch (error) {
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
