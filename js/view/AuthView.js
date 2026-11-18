/**
 * VIEW dell'accesso: barra di sessione nell'intestazione, finestra di login
 * e pannello dell'admin. Come CharacterView non conosce le regole né la rete:
 * mostra ciò che riceve e chiama i callback del SessionController.
 * Il testo passa sempre da textContent (helper `el`).
 */
import { el } from './dom.js';
import { pick } from '../i18n/i18n.js';

const ERRORS = () => ({
  invalid_token: pick('Token non valido o revocato.', 'Invalid or revoked token.'),
  network: pick('Server non raggiungibile. Controlla la connessione.', 'Server unreachable. Check your connection.'),
  invalid_name: pick('Inserisci un nome.', 'Enter a name.'),
  limit_reached: pick('Limite di 50 schede per campagna raggiunto.', 'Limit of 50 sheets per campaign reached.'),
  unknown: pick('Errore imprevisto del server.', 'Unexpected server error.'),
});

export const errorText = (error) => ERRORS()[error?.code] ?? ERRORS().unknown;

export class AuthView {
  #bar;
  #dialog;

  /** @param {Document} root */
  constructor(root = document) {
    this.#bar = root.querySelector('[data-ref="session-bar"]');
    this.#dialog = el('dialog', { class: 'dialog', 'aria-labelledby': 'dialog-title' });
    root.body.append(this.#dialog);
  }

  // ------------------------------------------------------ Barra in testata

  /**
   * @param {{
   *   session: {role: string, campaignName: string} | null,
   *   sheetLabel: string,
   *   syncState: 'online'|'offline'|'revoked'|null,  (null = scheda locale, nulla da sincronizzare)
   *   canManage: boolean,
   * }} vm
   * @param {{onLogin: () => void, onManage: () => void, onLogout: () => void}} on
   */
  renderBar(vm, on) {
    if (!this.#bar) return;
    this.#bar.replaceChildren();
    this.#bar.hidden = false;

    if (!vm.session) {
      this.#bar.append(el('button', { type: 'button', class: 'btn', text: pick('Accedi / Campagna', 'Sign in / Campaign') }));
      this.#bar.firstChild.addEventListener('click', on.onLogin);
      return;
    }

    const role = vm.session.role === 'admin' ? pick('Master', 'DM') : pick('Giocatore', 'Player');
    const stateText = vm.syncState && {
      online: pick('sincronizzata', 'synced'),
      offline: pick('offline: riprovo…', 'offline: retrying…'),
      revoked: pick('accesso revocato', 'access revoked'),
    }[vm.syncState];

    this.#bar.append(
      el('span', { class: 'session-bar__who' }, [
        el('span', { class: 'badge', text: role }),
        el('strong', { text: vm.session.campaignName }),
      ]),
      el('span', { class: 'session-bar__sheet', text: `${pick('Scheda', 'Sheet')}: ${vm.sheetLabel}` }),
      stateText && el('span', { class: `session-bar__state session-bar__state--${vm.syncState}`, role: 'status', text: `● ${stateText}` }),
    );
    if (vm.canManage) {
      const manage = el('button', { type: 'button', class: 'btn btn--ghost', text: pick('Pannello campagna', 'Campaign panel') });
      manage.addEventListener('click', on.onManage);
      this.#bar.append(manage);
    }
    const logout = el('button', { type: 'button', class: 'btn btn--ghost', text: pick('Esci', 'Sign out') });
    logout.addEventListener('click', on.onLogout);
    this.#bar.append(logout);
  }

  hideBar() {
    if (this.#bar) { this.#bar.replaceChildren(); this.#bar.hidden = true; }
  }

  // ------------------------------------------------------------- Login

  /**
   * @param {{onLogin: (token: string) => Promise<void>, onCreate: (name: string) => Promise<void>}} on
   *   i callback lanciano un errore con `code` se qualcosa va storto
   */
  showLogin(on) {
    const error = el('p', { class: 'dialog__error', role: 'alert' });
    const tokenInput = el('input', {
      type: 'text', class: 'input', autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false',
      placeholder: 'PG-XXXX-XXXX-XXXX', 'aria-label': pick('Token di accesso', 'Access token'),
    });
    const nameInput = el('input', {
      type: 'text', class: 'input', maxlength: 80, autocomplete: 'off',
      placeholder: pick('Nome della campagna', 'Campaign name'), 'aria-label': pick('Nome della campagna', 'Campaign name'),
    });

    const submit = (action) => async (event) => {
      event.preventDefault();
      error.textContent = '';
      const buttons = this.#dialog.querySelectorAll('button');
      buttons.forEach((b) => { b.disabled = true; });
      try {
        await action(); // il controller decide cosa mostrare dopo (pannello, scheda...) e chiude se serve
      } catch (e) {
        error.textContent = errorText(e);
        buttons.forEach((b) => { b.disabled = false; });
      }
    };

    this.#open([
      this.#heading(pick('Accedi con un token', 'Sign in with a token')),
      el('form', { class: 'dialog__form' }, [
        el('p', { class: 'dialog__hint', text: pick(
          'Incolla il token (o il link) ricevuto dal Master per entrare nella tua scheda, oppure il tuo token admin.',
          'Paste the token (or link) you got from your DM to open your sheet, or your admin token.') }),
        tokenInput,
        el('button', { type: 'submit', class: 'btn btn--teal', text: pick('Entra', 'Enter') }),
      ]),
      el('hr', { class: 'dialog__sep' }),
      el('form', { class: 'dialog__form' }, [
        el('h3', { text: pick('Sei il Master? Crea una campagna', 'Are you the DM? Create a campaign') }),
        el('p', { class: 'dialog__hint', text: pick(
          'Riceverai un token admin: conservalo, serve per rientrare da un altro dispositivo.',
          'You will get an admin token: keep it, you need it to sign in from another device.') }),
        nameInput,
        el('button', { type: 'submit', class: 'btn', text: pick('Crea campagna', 'Create campaign') }),
      ]),
      error,
    ]);
    const [loginForm, createForm] = this.#dialog.querySelectorAll('form');
    loginForm.addEventListener('submit', submit(() => on.onLogin(tokenInput.value)));
    createForm.addEventListener('submit', submit(() => on.onCreate(nameInput.value)));
    tokenInput.focus();
  }

  // ------------------------------------------------------- Pannello admin

  /**
   * @param {{
   *   campaignName: string, adminToken: string,
   *   campaigns: Array<{token: string, name: string, active: boolean}>,
   *   characters: Array<{id: string, title: string, subtitle: string, token: string, link: string}>,
   *   loading: boolean, error: string,
   * }} vm
   * @param {object} on callback: switchCampaign, newCampaign, renameCampaign, deleteCampaign,
   *   createCharacter, open, rename, rotate, remove, copy
   */
  showAdmin(vm, on) {
    const rows = vm.characters.map((c) => el('li', { class: 'char-row' }, [
      el('div', { class: 'char-row__title' }, [el('strong', { text: c.title }), el('span', { class: 'char-row__sub', text: c.subtitle })]),
      el('div', { class: 'char-row__token' }, [
        el('code', { text: c.token }),
        this.#btn(pick('Copia link', 'Copy link'), () => on.copy(c.link), 'btn btn--ghost'),
        this.#btn(pick('Copia token', 'Copy token'), () => on.copy(c.token), 'btn btn--ghost'),
      ]),
      el('div', { class: 'char-row__actions' }, [
        this.#btn(pick('Apri', 'Open'), () => on.open(c.id), 'btn btn--teal'),
        this.#btn(pick('Rinomina', 'Rename'), () => on.rename(c.id), 'btn btn--ghost'),
        this.#btn(pick('Nuovo token', 'New token'), () => on.rotate(c.id), 'btn btn--ghost'),
        this.#btn(pick('Elimina', 'Delete'), () => on.remove(c.id), 'btn btn--danger'),
      ]),
    ]));

    const labelInput = el('input', {
      type: 'text', class: 'input', maxlength: 80, autocomplete: 'off',
      placeholder: pick('Giocatore o personaggio (es. Mario)', 'Player or character (e.g. Mario)'),
      'aria-label': pick('Etichetta della nuova scheda', 'Label of the new sheet'),
    });
    const addForm = el('form', { class: 'dialog__inline' }, [
      labelInput,
      el('button', { type: 'submit', class: 'btn btn--teal', text: pick('+ Nuova scheda', '+ New sheet') }),
    ]);
    addForm.addEventListener('submit', (event) => { event.preventDefault(); on.createCharacter(labelInput.value); });

    const switcher = vm.campaigns.length > 1
      ? el('select', { class: 'input', 'aria-label': pick('Campagna', 'Campaign') },
        vm.campaigns.map((c) => el('option', { value: c.token, text: c.name, selected: c.active })))
      : null;
    switcher?.addEventListener('change', () => on.switchCampaign(switcher.value));

    this.#open([
      this.#heading(vm.campaignName),
      el('div', { class: 'dialog__inline' }, [
        switcher,
        this.#btn(pick('Rinomina campagna', 'Rename campaign'), on.renameCampaign, 'btn btn--ghost'),
        this.#btn(pick('+ Altra campagna', '+ Another campaign'), on.newCampaign, 'btn btn--ghost'),
      ]),
      el('p', { class: 'dialog__hint' }, [
        `${pick('Il tuo token admin', 'Your admin token')}: `,
        el('code', { text: vm.adminToken }), ' ',
        this.#btn(pick('Copia', 'Copy'), () => on.copy(vm.adminToken), 'btn btn--ghost'),
      ]),
      el('h3', { text: pick('Schede', 'Sheets') }),
      vm.loading
        ? el('p', { class: 'dialog__hint', text: pick('Caricamento…', 'Loading…') })
        : (rows.length
          ? el('ul', { class: 'char-list' }, rows)
          : el('p', { class: 'dialog__hint', text: pick('Nessuna scheda: creane una e dai il link al giocatore.', 'No sheets yet: create one and send the link to the player.') })),
      addForm,
      el('p', { class: 'dialog__error', role: 'alert', text: vm.error }),
      el('hr', { class: 'dialog__sep' }),
      this.#btn(pick('Elimina campagna', 'Delete campaign'), on.deleteCampaign, 'btn btn--danger'),
    ]);
  }

  close() {
    if (this.#dialog.open) this.#dialog.close();
  }

  get isOpen() { return this.#dialog.open; }

  // ---------------------------------------------------------- Utilità

  /** Copia negli appunti; se il browser non lo permette mostra il testo da copiare a mano. */
  async copy(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      window.prompt(pick('Copia con Ctrl+C:', 'Copy with Ctrl+C:'), text);
      return false;
    }
  }

  prompt(message, value = '') { return window.prompt(message, value); }
  confirm(message) { return window.confirm(message); }

  #heading(text) {
    const close = this.#btn('✕', () => this.close(), 'btn btn--icon btn--ghost');
    close.setAttribute('aria-label', pick('Chiudi', 'Close'));
    return el('div', { class: 'dialog__head' }, [el('h2', { id: 'dialog-title', text }), close]);
  }

  #btn(text, handler, cls = 'btn') {
    const button = el('button', { type: 'button', class: cls, text });
    button.addEventListener('click', handler);
    return button;
  }

  #open(children) {
    this.#dialog.replaceChildren(...children.filter(Boolean));
    if (!this.#dialog.open) this.#dialog.showModal();
  }
}
