/**
 * VIEW — tutto ciò che riguarda il DOM.
 *
 * La View non conosce le regole di D&D: riceve lo stato e i valori derivati
 * e li riflette nell'HTML tramite attributi dichiarativi:
 *
 *   data-bind="percorso"     input collegato allo stato (bidirezionale via Controller)
 *   data-out="percorso"      testo letto dai valori derivati
 *   data-format="mod"        formatta come modificatore (+2 / −1)
 *   data-show-if="percorso"  visibile solo se il valore derivato è vero ("!" per negare)
 *   data-pips                gruppo di pallini (TS contro morte, slot)
 *   data-action="nome"       pulsante che invia un'azione al Controller
 *
 * Le interazioni dell'utente vengono esposte tramite metodi `on*`
 * che il Controller usa per registrare i propri handler.
 */
import { formatModifier, getByPath } from '../core/utils.js';
import { el, readInputValue, writeInputValue } from './dom.js';

const FORMATTERS = {
  mod: (v) => formatModifier(Number(v)),
};

export class CharacterView {
  #root;
  #lastState = null;
  /** Chiavi dell'ultimo render delle liste, per ricostruirle solo quando cambiano. */
  #listKeys = new Map();

  /** @param {Document | HTMLElement} root */
  constructor(root = document) {
    this.#root = root;
    this.panels = [...root.querySelectorAll('details[data-panel]')];
    this.weaponTemplate = root.querySelector('#tpl-weapon-row');
    this.importInput = root.querySelector('[data-ref="import-input"]');
    this.saveStatus = root.querySelector('[data-ref="save-status"]');
    this.hpBar = root.querySelector('[data-ref="hp-bar"]');
    this.hpDelta = root.querySelector('[data-ref="hp-delta"]');
  }

  #q(selector) { return this.#root.querySelector(selector); }
  #qa(selector) { return [...this.#root.querySelectorAll(selector)]; }

  // ===================================================================
  // Costruzione iniziale (dai cataloghi di regole, una sola volta)
  // ===================================================================

  /**
   * @param {object} catalogs
   * @param {Array<{id:string,name:string,short:string}>} catalogs.abilities
   * @param {Array<{id:string,name:string,ability:string}>} catalogs.skills
   * @param {Array<{id:string,name:string,category:string,baseAC:number}>} catalogs.armors
   * @param {Record<string,string>} catalogs.armorCategories
   * @param {Array<{id:string,name:string}>} catalogs.classes
   * @param {string[]} catalogs.alignments
   */
  build({ abilities, skills, armors, armorCategories, classes, alignments }) {
    const shortOf = Object.fromEntries(abilities.map((a) => [a.id, a.short]));

    this.#q('[data-options="classes"]').append(
      ...classes.map((c) => el('option', { value: c.id, text: c.name })),
    );
    this.#q('[data-options="alignments"]').append(
      ...alignments.map((a) => el('option', { value: a, text: a })),
    );

    // Armature raggruppate per categoria con <optgroup>
    const armorSelect = this.#q('[data-options="armors"]');
    for (const [category, label] of Object.entries(armorCategories)) {
      const items = armors.filter((a) => a.category === category);
      const options = items.map((a) => el('option', {
        value: a.id,
        text: category === 'none' ? a.name : `${a.name} (CA ${a.baseAC})`,
      }));
      armorSelect.append(category === 'none' ? options[0] : el('optgroup', { label }, options));
    }

    this.#q('[data-list="abilities"]').append(...abilities.map((a) => el('div', { class: 'ability' }, [
      el('span', { class: 'ability__name', text: a.name }),
      el('output', { class: 'ability__mod', dataset: { out: `mods.${a.id}`, format: 'mod' } }),
      el('input', {
        type: 'number', min: 1, max: 30, inputmode: 'numeric',
        'aria-label': `Punteggio di ${a.name}`, dataset: { bind: `abilities.${a.id}` },
      }),
    ])));

    this.#q('[data-list="saves"]').append(...abilities.map((a) => el('li', { class: 'checklist__row checklist__row--save' }, [
      el('input', { type: 'checkbox', id: `save-${a.id}`, dataset: { bind: `saveProficiencies.${a.id}` } }),
      el('label', { class: 'checklist__name', for: `save-${a.id}`, text: a.name }),
      el('output', { class: 'checklist__value', dataset: { out: `saves.${a.id}`, format: 'mod' } }),
    ])));

    this.#q('[data-list="skills"]').append(...skills.map((s) => el('li', { class: 'checklist__row' }, [
      el('input', {
        type: 'checkbox', id: `skill-${s.id}`, title: 'Competenza',
        dataset: { bind: `skills.${s.id}.proficient` },
      }),
      el('input', {
        type: 'checkbox', class: 'expertise', title: 'Maestria (doppia competenza)',
        'aria-label': `Maestria in ${s.name}`, dataset: { bind: `skills.${s.id}.expertise` },
      }),
      el('label', { class: 'checklist__name', for: `skill-${s.id}` }, [
        s.name, el('small', { text: shortOf[s.ability] }),
      ]),
      el('output', { class: 'checklist__value', dataset: { out: `skills.${s.id}`, format: 'mod' } }),
    ])));
  }

  // ===================================================================
  // Render: stato + derivati → DOM
  // ===================================================================

  /**
   * @param {object} state snapshot dello stato
   * @param {object} derived valori calcolati
   */
  render(state, derived) {
    this.#lastState = state;

    // 1. Liste dinamiche (ricostruite solo se la loro struttura cambia)
    this.#renderWeapons(state.weapons);
    this.#renderSpellSlots(derived.spellcasting.slots);
    this.#renderFeatures(derived.features);
    this.#renderResources(derived.resources);

    // 2. Valori: input, output, pallini, visibilità
    this.#qa('[data-bind]').forEach((input) => this.#syncInput(input));
    this.#qa('[data-out]').forEach((node) => {
      const value = getByPath(derived, node.dataset.out);
      const format = FORMATTERS[node.dataset.format];
      node.textContent = value == null ? '' : format ? format(value) : String(value);
    });
    this.#renderPips(state);
    this.#qa('[data-show-if]').forEach((node) => {
      const expr = node.dataset.showIf;
      const negate = expr.startsWith('!');
      const value = Boolean(getByPath(derived, negate ? expr.slice(1) : expr));
      node.hidden = negate ? value : !value;
    });

    // 3. Barra dei PF
    this.hpBar.style.width = `${derived.hp.percent}%`;
    this.hpBar.dataset.level = derived.hp.level;
  }

  /** Aggiorna un input dallo stato, ma non quello che l'utente sta digitando. */
  #syncInput(input, { force = false } = {}) {
    if (!this.#lastState) return;
    if (!force && input === document.activeElement) return;
    writeInputValue(input, getByPath(this.#lastState, input.dataset.bind));
  }

  /** Ricostruisce una lista solo se la chiave è cambiata. */
  #shouldRebuild(name, key) {
    if (this.#listKeys.get(name) === key) return false;
    this.#listKeys.set(name, key);
    return true;
  }

  #renderWeapons(weapons) {
    const key = weapons.map((w) => w.id).join('|');
    if (!this.#shouldRebuild('weapons', key)) return;

    const container = this.#q('[data-list="weapons"]');
    const rows = weapons.map((weapon, index) => {
      const row = this.weaponTemplate.content.firstElementChild.cloneNode(true);
      row.querySelectorAll('[data-field]').forEach((input) => {
        input.dataset.bind = `weapons.${index}.${input.dataset.field}`;
        input.setAttribute('aria-label', `${input.closest('label')?.textContent.trim() ?? ''} arma ${index + 1}`);
      });
      row.querySelectorAll('[data-field-out]').forEach((out) => {
        out.dataset.out = `weapons.${index}.${out.dataset.fieldOut}`;
      });
      row.querySelector('[data-action="remove-weapon"]').dataset.id = weapon.id;
      return row;
    });
    container.replaceChildren(...rows);
  }

  #renderSpellSlots(slots) {
    const key = slots.map((s) => `${s.level}:${s.max}`).join('|');
    if (!this.#shouldRebuild('slots', key)) return;

    this.#q('[data-list="spell-slots"]').replaceChildren(...slots.map((slot, i) => el('div', { class: 'slot' }, [
      el('span', { class: 'slot__level', text: `${slot.level}°` }),
      el('div', {
        class: 'pips',
        dataset: { pips: '', path: `spells.slotsUsed.${slot.level}`, max: slot.max, label: `Slot di ${slot.level}° livello usato` },
      }),
      el('span', { class: 'slot__count', dataset: { out: `spellcasting.slots.${i}.remaining` } }),
    ])));
  }

  #renderFeatures(features) {
    const key = features.map((f) => `${f.level}${f.name}`).join('|');
    if (!this.#shouldRebuild('features', key)) return;

    this.#q('[data-list="features"]').replaceChildren(...features.map((f) => el('li', { class: 'feature' }, [
      el('span', { class: 'feature__level', text: `Liv. ${f.level}` }),
      el('div', {}, [
        el('div', { class: 'feature__name', text: f.name }),
        el('p', { class: 'feature__desc', text: f.description }),
      ]),
    ])));
  }

  #renderResources(resources) {
    const key = resources.map((r) => `${r.label}=${r.value}`).join('|');
    if (!this.#shouldRebuild('resources', key)) return;

    this.#q('[data-list="resources"]').replaceChildren(...resources.map((r) => el('div', { class: 'stat' }, [
      el('span', { class: 'stat__label', text: r.label }),
      el('span', { class: 'stat__value', text: r.value }),
    ])));
  }

  /** Allinea i pallini al valore nello stato, creando i pulsanti mancanti. */
  #renderPips(state) {
    this.#qa('[data-pips]').forEach((group) => {
      const max = Number(group.dataset.max);
      const value = Number(getByPath(state, group.dataset.path) ?? 0);
      while (group.children.length < max) {
        const i = group.children.length;
        group.append(el('button', {
          type: 'button', class: 'pip',
          'aria-label': `${group.dataset.label} ${i + 1}`,
          dataset: { action: 'set-pip', path: group.dataset.path, index: i },
        }));
      }
      while (group.children.length > max) group.lastElementChild.remove();
      [...group.children].forEach((pip, i) => pip.setAttribute('aria-pressed', String(i < value)));
    });
  }

  // ===================================================================
  // Eventi utente → Controller
  // ===================================================================

  /** @param {(path: string, value: unknown) => void} handler */
  onFieldChange(handler) {
    const listener = (event) => {
      const input = event.target;
      if (input?.dataset?.bind) handler(input.dataset.bind, readInputValue(input));
    };
    this.#root.addEventListener('input', listener);
    this.#root.addEventListener('change', listener);

    // All'uscita dal campo mostra il valore validato (es. 50 → 30 per le caratteristiche).
    this.#root.addEventListener('focusout', (event) => {
      if (event.target?.dataset?.bind) this.#syncInput(event.target, { force: true });
    });
  }

  /** @param {(action: string, data: DOMStringMap) => void} handler */
  onAction(handler) {
    this.#root.addEventListener('click', (event) => {
      const button = event.target.closest?.('[data-action]');
      if (button && !button.disabled) handler(button.dataset.action, { ...button.dataset });
    });
    // Invio nel campo "Quantità" = applica danno
    this.hpDelta.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') { event.preventDefault(); handler('damage', {}); }
    });
  }

  /** @param {(text: string) => void} handler */
  onImport(handler) {
    this.importInput.addEventListener('change', async () => {
      const [file] = this.importInput.files;
      this.importInput.value = ''; // consente di reimportare lo stesso file
      if (file) handler(await file.text());
    });
  }

  /** @param {(state: Record<string, boolean>) => void} handler */
  onPanelToggle(handler) {
    // L'evento 'toggle' non fa bubbling: serve un listener per pannello.
    this.panels.forEach((panel) => panel.addEventListener('toggle', () => handler(this.getPanelsState())));
  }

  // ===================================================================
  // Comandi imperativi richiesti dal Controller
  // ===================================================================

  getPanelsState() {
    return Object.fromEntries(this.panels.map((p) => [p.dataset.panel, p.open]));
  }

  /** @param {Record<string, boolean>} state */
  setPanelsState(state) {
    this.panels.forEach((p) => {
      if (typeof state?.[p.dataset.panel] === 'boolean') p.open = state[p.dataset.panel];
    });
  }

  setAllPanels(open) {
    this.panels.forEach((p) => { p.open = open; });
  }

  /** Legge e svuota il campo "Quantità" per danni/cure. */
  takeHpDelta() {
    const value = Number.parseInt(this.hpDelta.value, 10);
    this.hpDelta.value = '';
    return Number.isFinite(value) ? value : 0;
  }

  openImportDialog() {
    this.importInput.click();
  }

  /** @param {string} message */
  confirm(message) {
    return window.confirm(message);
  }

  /** Mostra un breve messaggio di stato che svanisce dopo qualche secondo. */
  showStatus(message) {
    this.saveStatus.textContent = message;
    clearTimeout(this.statusTimer);
    this.statusTimer = setTimeout(() => { this.saveStatus.textContent = ''; }, 2500);
  }

  /** Scarica un oggetto come file JSON. */
  downloadJson(filename, data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = el('a', { href: url, download: filename });
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000); // alcuni browser avviano il download in modo asincrono
  }
}
