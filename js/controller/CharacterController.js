/**
 * CONTROLLER — collega View e Model.
 *
 *   View  --(eventi utente)-->  Controller  --(comandi)-->  Model
 *   Model --('change')------->  Controller  --(render)--->  View
 *                                    └──(save, debounce)--> Repository
 *
 * Non contiene regole di gioco (stanno nel Model) né manipolazione del DOM
 * (sta nella View): decide solo *chi* deve fare *cosa* e *quando*.
 */
import { detectLang, isSupportedLang, pick, setLang } from '../i18n/i18n.js';
import { deepMerge } from '../sync/diff.js';

const SAVE_DELAY_MS = 400;

export class CharacterController {
  #model;
  #view;
  #repository;
  #catalogs;
  #saveTimer = null;
  /** Sincronizzazione con la scheda condivisa; null = si lavora sulla scheda locale. */
  #remote = null;
  #languageListeners = [];
  #changeListeners = [];

  /**
   * @param {object} deps
   * @param {import('../model/CharacterModel.js').CharacterModel} deps.model
   * @param {import('../view/CharacterView.js').CharacterView} deps.view
   * @param {import('../model/LocalStorageRepository.js').LocalStorageRepository} deps.repository
   * @param {object} deps.catalogs dati statici per costruire la UI
   */
  constructor({ model, view, repository, catalogs }) {
    this.#model = model;
    this.#view = view;
    this.#repository = repository;
    this.#catalogs = catalogs;
  }

  init() {
    // Lingua: scelta salvata, altrimenti quella del browser.
    const saved = this.#repository.loadLanguage();
    setLang(isSupportedLang(saved) ? saved : detectLang(globalThis.navigator?.languages ?? []));
    this.#view.build(this.#catalogs);
    this.#view.applyLanguage();
    this.#view.setPanelsState(this.#repository.loadUiState());

    this.#view.onFieldChange((path, value) => this.#model.set(path, value));
    this.#view.onAction((action, data) => this.#handleAction(action, data));
    this.#view.onImport((text) => this.#importJson(text));
    this.#view.onPanelToggle((state) => this.#repository.saveUiState(state));

    this.#model.on('change', () => {
      this.#render();
      this.#changeListeners.forEach((listener) => listener());
      this.#scheduleSave();
    });

    // Salvataggio immediato se l'utente chiude la pagina durante il debounce.
    window.addEventListener('pagehide', () => this.#flushSave());

    if (!this.#repository.isAvailable) {
      this.#view.showStatus(pick('Salvataggio locale non disponibile in questo browser.', 'Local saving is not available in this browser.'));
    }

    this.#render();
  }

  /** @returns {boolean} true se si sta modificando una scheda condivisa */
  get isRemote() { return this.#remote !== null; }

  /** @param {() => void} listener chiamato dopo ogni cambio lingua */
  onChange(listener) { this.#changeListeners.push(listener); }
  onLanguageChange(listener) { this.#languageListeners.push(listener); }

  /** Scheda locale salvata, se esiste (serve per proporne il caricamento in campagna). */
  hasLocalCharacter() { return this.#repository.load() !== null; }
  localSnapshot() { return this.#repository.load(); }

  /** Stato attuale della scheda mostrata (locale o condivisa). */
  currentSnapshot() { return this.#model.toJSON(); }

  /**
   * Passa a una scheda condivisa. La scheda locale resta intatta nel browser:
   * finché si è collegati, i salvataggi vanno solo al server.
   *
   * @param {import('../sync/CharacterSync.js').CharacterSync} sync già caricato con `load()`
   * @param {unknown} data documento da mostrare (remoto, oppure la scheda locale da caricare)
   * @param {{upload?: boolean}} [options] upload: `data` è la scheda locale e va inviata al server
   */
  attachRemote(sync, data, { upload = false } = {}) {
    this.detachRemote();
    this.#flushSave();
    this.#remote = sync;
    this.#model.load(data);
    // Con l'upload la base resta vuota: il primo invio manda tutte le sezioni.
    if (!upload) sync.markSynced(this.#model.toJSON());
    else sync.push(); // prima che il salvataggio ritardato confronti qualcosa
    sync.on('remote', ({ changes, updatedBy }) => {
      if (this.#remote !== sync) return;
      this.#model.load(deepMerge(this.#model.toJSON(), changes));
      sync.markSynced(this.#model.toJSON());
      this.#view.showStatus(updatedBy === 'admin'
        ? pick('Aggiornata dal Master', 'Updated by the DM')
        : pick('Aggiornata dal giocatore', 'Updated by the player'));
    });
    sync.start();
  }

  /** Torna alla scheda locale. */
  detachRemote() {
    if (!this.#remote) return;
    this.#flushSave(); // invia ciò che era ancora in attesa del salvataggio ritardato
    this.#remote.stop();
    this.#remote = null;
    this.#model.load(this.#repository.load());
  }

  #render() {
    this.#view.render(this.#model.getSnapshot(), this.#model.getDerived());
  }

  /** Mappa azione → comando. Aggiungere un pulsante = aggiungere una voce qui. */
  #handleAction(action, data) {
    const handlers = {
      'add-weapon': () => this.#model.addWeapon(),
      'toggle-choice': () => this.#model.toggleChoice(data.choiceKey, data.choiceValue),
      'add-ac-item': () => this.#model.addAcItem(),
      'remove-ac-item': () => this.#model.removeAcItem(data.id),
      'remove-weapon': () => this.#model.removeWeapon(data.id),
      'set-pip': () => this.#togglePip(data.path, Number(data.index)),
      'damage': () => this.#model.applyDamage(this.#view.takeHpDelta()),
      'heal': () => this.#model.heal(this.#view.takeHpDelta()),
      'apply-suggested-hp': () => this.#model.applySuggestedHp(),
      'long-rest': () => {
        this.#model.longRest();
        this.#view.showStatus(pick('Riposo lungo completato.', 'Long rest completed.'));
      },
      'expand-all': () => this.#view.setAllPanels(true),
      'collapse-all': () => this.#view.setAllPanels(false),
      'export': () => this.#exportJson(),
      'import': () => this.#view.openImportDialog(),
      'reset': () => this.#reset(),
      'set-lang': () => this.#changeLanguage(data.lang),
    };
    handlers[action]?.();
  }

  /**
   * Cliccare il pallino N lo riempie fino a N; ricliccare l'ultimo pieno lo svuota.
   * @param {string} path
   * @param {number} index
   */
  #togglePip(path, index) {
    const current = this.#model.get(path);
    this.#model.set(path, current === index + 1 ? index : index + 1);
  }

  #exportJson() {
    const data = this.#model.toJSON();
    const slug = (data.info.name || pick('personaggio', 'character'))
      .toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    this.#view.downloadJson(`${slug || pick('personaggio', 'character')}.json`, data);
  }

  #importJson(text) {
    try {
      this.#model.load(JSON.parse(text));
      this.#view.showStatus(pick('Personaggio importato ✓', 'Character imported ✓'));
    } catch {
      this.#view.showStatus(pick('File non valido: deve essere un JSON esportato da questa scheda.', 'Invalid file: it must be a JSON exported from this sheet.'));
    }
  }

  #changeLanguage(code) {
    if (!setLang(code)) return;
    this.#repository.saveLanguage(code);
    this.#view.applyLanguage();
    this.#render();
    this.#languageListeners.forEach((listener) => listener());
  }

  #reset() {
    if (!this.#view.confirm(pick('Cancellare tutti i dati del personaggio? L\'operazione non è reversibile.', 'Delete all character data? This cannot be undone.'))) return;
    this.#model.reset();
    if (!this.#remote) this.#repository.clear(); // la scheda locale non si tocca mentre si è in campagna
  }

  #scheduleSave() {
    clearTimeout(this.#saveTimer);
    this.#saveTimer = setTimeout(() => this.#flushSave(), SAVE_DELAY_MS);
  }

  #flushSave() {
    if (this.#saveTimer === null) return;
    clearTimeout(this.#saveTimer);
    this.#saveTimer = null;
    if (this.#remote) {
      this.#remote.push(this.#model.toJSON()).then(({ pushed }) => {
        if (pushed) this.#view.showStatus(pick('Sincronizzato ✓', 'Synced ✓'));
      });
      return;
    }
    if (this.#repository.save(this.#model.toJSON())) this.#view.showStatus(pick('Salvato ✓', 'Saved ✓'));
  }
}
