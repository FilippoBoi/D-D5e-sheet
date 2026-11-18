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
  legacy_admin_token: pick(
    'Questo è un vecchio token admin: non serve più per entrare. Accedi come Master con la tua email e rivendica la campagna.',
    'This is an old admin token: it no longer signs you in. Sign in as DM with your email and claim the campaign.'),
  auth_required: pick('Accesso da Master scaduto: accedi di nuovo.', 'DM sign-in expired: please sign in again.'),
  email_invalid: pick('Controlla l\'indirizzo email.', 'Check the email address.'),
  email_rate_limit: pick('Troppi invii di email: aspetta un minuto (o più) e riprova.', 'Too many emails sent: wait a minute (or more) and try again.'),
  email_not_authorized: pick(
    'Questo indirizzo non può ricevere email dal servizio gratuito del progetto: serve un invio email configurato (vedi README).',
    'This address cannot get emails from the project\'s free email service: a configured email provider is needed (see README).'),
  signup_disabled: pick('Le nuove registrazioni sono disattivate: usa l\'email con cui hai già un account.', 'New sign-ups are disabled: use the email you already have an account with.'),
  link_expired: pick('Il link è scaduto o già usato: richiedine uno nuovo.', 'The link has expired or was already used: request a new one.'),
  network: pick('Server non raggiungibile. Controlla la connessione.', 'Server unreachable. Check your connection.'),
  invalid_name: pick('Inserisci un nome.', 'Enter a name.'),
  invalid_code: pick('Codice di creazione non valido.', 'Invalid creation code.'),
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
   *   email: string,
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
        el('strong', { text: vm.session.campaignName || pick('nessuna campagna', 'no campaign'), title: vm.email ?? '' }),
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
   * Due strade: il giocatore incolla il suo token, il Master riceve un link per email.
   * @param {{onLogin: (token: string) => Promise<void>, onSendLink: (email: string) => Promise<void>}} on
   *   i callback lanciano un errore con `code` se qualcosa va storto
   */
  showLogin(on) {
    const error = el('p', { class: 'dialog__error', role: 'alert' });
    const tokenInput = el('input', {
      type: 'text', class: 'input', autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false',
      placeholder: 'PG-XXXX-XXXX-XXXX', 'aria-label': pick('Token di accesso', 'Access token'),
    });
    const emailInput = el('input', {
      type: 'email', class: 'input', autocomplete: 'email', placeholder: pick('La tua email', 'Your email'),
      'aria-label': pick('Email del Master', 'DM email'),
    });
    // novalidate: l'errore sull'email lo scriviamo noi, nella lingua dell'app (non quella del browser).
    const masterForm = el('form', { class: 'dialog__form', novalidate: true }, [
      el('h3', { text: pick('Sei il Master? Accedi con la tua email', 'Are you the DM? Sign in with your email') }),
      el('p', { class: 'dialog__hint', text: pick(
        'Ti mandiamo un link: aprilo e sei dentro, da qualunque dispositivo. Niente password da ricordare.',
        'We email you a link: open it and you are in, from any device. No password to remember.') }),
      emailInput,
      el('button', { type: 'submit', class: 'btn', text: pick('Inviami il link', 'Email me the link') }),
    ]);

    const run = (form, action, onDone) => async (event) => {
      event.preventDefault();
      error.textContent = '';
      const buttons = form.querySelectorAll('button');
      buttons.forEach((b) => { b.disabled = true; });
      try {
        await action(); // il controller decide cosa mostrare dopo (pannello, scheda...) e chiude se serve
        onDone?.();
      } catch (e) {
        error.textContent = errorText(e);
        buttons.forEach((b) => { b.disabled = false; });
      }
    };

    this.#open([
      this.#heading(pick('Accedi', 'Sign in')),
      el('form', { class: 'dialog__form' }, [
        el('h3', { text: pick('Sei un giocatore? Usa il tuo token', 'Are you a player? Use your token') }),
        el('p', { class: 'dialog__hint', text: pick(
          'Incolla il token (o il link) ricevuto dal Master per entrare nella tua scheda.',
          'Paste the token (or link) you got from your DM to open your sheet.') }),
        tokenInput,
        el('button', { type: 'submit', class: 'btn btn--teal', text: pick('Entra', 'Enter') }),
      ]),
      el('hr', { class: 'dialog__sep' }),
      masterForm,
      error,
    ]);
    const [playerForm] = this.#dialog.querySelectorAll('form');
    playerForm.addEventListener('submit', run(playerForm, () => on.onLogin(tokenInput.value)));
    masterForm.addEventListener('submit', run(masterForm, () => on.onSendLink(emailInput.value), () => {
      masterForm.replaceChildren(
        el('h3', { text: pick('Controlla la posta', 'Check your inbox') }),
        el('p', { class: 'dialog__hint', role: 'status', text: pick(
          `Ti abbiamo scritto a ${emailInput.value.trim()}. Apri il link nell'email (controlla anche lo spam): ti porta qui già collegato. Puoi aprirlo anche da un altro dispositivo.`,
          `We emailed ${emailInput.value.trim()}. Open the link in the email (check spam too): it brings you back here signed in. You can open it on another device too.`) }),
      );
    }));
    tokenInput.focus();
  }

  // ---------------------------------------------- Crea o rivendica una campagna

  /**
   * Schermata del Master senza campagna selezionata, o che ne vuole un'altra.
   * @param {{email: string, hasCampaigns: boolean}} vm
   * @param {{onCreate: (name: string, code: string) => Promise<void>, onClaim: (token: string) => Promise<void>, onBack: (() => void) | null}} on
   */
  showMasterHome(vm, on) {
    const error = el('p', { class: 'dialog__error', role: 'alert' });
    const nameInput = el('input', {
      type: 'text', class: 'input', maxlength: 80, autocomplete: 'off',
      placeholder: pick('Nome della campagna', 'Campaign name'), 'aria-label': pick('Nome della campagna', 'Campaign name'),
    });
    const codeInput = el('input', {
      type: 'password', class: 'input', autocomplete: 'off', hidden: true, 'data-ref': 'creation-code',
      placeholder: pick('Codice di creazione (te lo dà chi gestisce il sito)', 'Creation code (given by whoever runs the site)'),
      'aria-label': pick('Codice di creazione', 'Creation code'),
    });
    const claimInput = el('input', {
      type: 'text', class: 'input', autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false',
      placeholder: 'ADM-XXXX-XXXX-XXXX', 'aria-label': pick('Vecchio token admin', 'Old admin token'),
    });
    const createForm = el('form', { class: 'dialog__form' }, [
      el('h3', { text: pick('Crea una campagna', 'Create a campaign') }),
      nameInput,
      codeInput,
      el('button', { type: 'submit', class: 'btn btn--teal', text: pick('Crea campagna', 'Create campaign') }),
    ]);
    const claimForm = el('form', { class: 'dialog__form' }, [
      el('h3', { text: pick('Hai già una campagna con il vecchio token admin?', 'Already have a campaign with the old admin token?') }),
      el('p', { class: 'dialog__hint', text: pick(
        'Incolla il vecchio token una sola volta: la campagna diventa tua, legata a questo account, e il vecchio token smette di valere. I token dei giocatori non cambiano.',
        'Paste the old token once: the campaign becomes yours, tied to this account, and the old token stops working. Player tokens do not change.') }),
      claimInput,
      el('button', { type: 'submit', class: 'btn', text: pick('Rivendica campagna', 'Claim campaign') }),
    ]);

    const run = (form, action) => async (event) => {
      event.preventDefault();
      error.textContent = '';
      const buttons = form.querySelectorAll('button');
      buttons.forEach((b) => { b.disabled = true; });
      try {
        await action();
      } catch (e) {
        error.textContent = errorText(e);
        if (e?.code === 'invalid_code') { codeInput.hidden = false; codeInput.focus(); } // se non lo si sapeva, ora sì
        buttons.forEach((b) => { b.disabled = false; });
      }
    };

    this.#open([
      this.#heading(pick('La tua campagna', 'Your campaign')),
      el('p', { class: 'dialog__hint', text: `${pick('Collegato come', 'Signed in as')} ${vm.email}` }),
      createForm,
      el('hr', { class: 'dialog__sep' }),
      claimForm,
      error,
      on.onBack ? this.#btn(pick('← Torna alle mie campagne', '← Back to my campaigns'), on.onBack, 'btn btn--ghost') : null,
    ]);
    createForm.addEventListener('submit', run(createForm, () => on.onCreate(nameInput.value, codeInput.value)));
    claimForm.addEventListener('submit', run(claimForm, () => on.onClaim(claimInput.value)));
    nameInput.focus();
  }

  /** Mostra il campo "Codice di creazione" (se la finestra di login è aperta). */
  revealCreationCode() {
    const input = this.#dialog.querySelector('[data-ref="creation-code"]');
    if (input) input.hidden = false;
  }

  // ------------------------------------------------------- Pannello admin

  /**
   * @param {{
   *   campaignName: string, email: string,
   *   campaigns: Array<{id: string, name: string, active: boolean}>,
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

    // Il pannello si ridisegna a ogni aggiornamento: testo e focus del campo "nuova scheda" vanno conservati.
    const previous = this.#dialog.querySelector('[data-ref="label-input"]');
    const hadFocus = previous !== null && previous === this.#dialog.ownerDocument.activeElement;
    const labelInput = el('input', {
      type: 'text', class: 'input', maxlength: 80, autocomplete: 'off', 'data-ref': 'label-input',
      placeholder: pick('Giocatore o personaggio (es. Mario)', 'Player or character (e.g. Mario)'),
      'aria-label': pick('Etichetta della nuova scheda', 'Label of the new sheet'),
    });
    const addForm = el('form', { class: 'dialog__inline' }, [
      labelInput,
      el('button', { type: 'submit', class: 'btn btn--teal', text: pick('+ Nuova scheda', '+ New sheet') }),
    ]);
    labelInput.value = previous?.value ?? '';
    addForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const label = labelInput.value;
      labelInput.value = '';
      on.createCharacter(label);
    });

    const switcher = vm.campaigns.length > 1
      ? el('select', { class: 'input', 'aria-label': pick('Campagna', 'Campaign') },
        vm.campaigns.map((c) => el('option', { value: c.id, text: c.name, selected: c.active })))
      : null;
    switcher?.addEventListener('change', () => on.switchCampaign(switcher.value));

    this.#open([
      this.#heading(vm.campaignName),
      el('div', { class: 'dialog__inline' }, [
        switcher,
        this.#btn(pick('Rinomina campagna', 'Rename campaign'), on.renameCampaign, 'btn btn--ghost'),
        this.#btn(pick('+ Altra campagna…', '+ Another campaign…'), on.newCampaign, 'btn btn--ghost'),
      ]),
      el('p', { class: 'dialog__hint', text: `${pick('Collegato come', 'Signed in as')} ${vm.email}` }),
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
    if (hadFocus) labelInput.focus();
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
