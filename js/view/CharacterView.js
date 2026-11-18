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
import { ALIGNMENTS_EN } from '../data/abilities.js';
import { ARMOR_CATEGORIES_EN } from '../data/armors.js';
import { getLang, loc, pick } from '../i18n/i18n.js';
import { translateString, translateTree } from '../i18n/domTranslator.js';

/** 1 → 1st, 2 → 2nd, 3 → 3rd, 4 → 4th... (solo inglese). */
function ordinal(n) {
  const rest = n % 100;
  if (rest >= 11 && rest <= 13) return `${n}th`;
  return `${n}${{ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] ?? 'th'}`;
}

const FORMATTERS = {
  mod: (v) => formatModifier(Number(v)),
};

export class CharacterView {
  #root;
  #lastState = null;
  #catalogs = null;
  /** Testi italiani originali di <title> e meta description, per poter tornare indietro. */
  #headOriginals = null;
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
  build({ abilities, skills, armors, armorCategories, classes, races, alignments }) {
    this.#catalogs = { abilities, skills, armors, armorCategories, classes, races, alignments };
    const shortOf = Object.fromEntries(abilities.map((a) => [a.id, loc(a, 'short')]));
    // In inglese le abilità vanno riordinate alfabeticamente (l'elenco di base è in ordine italiano).
    const sortedSkills = getLang() === 'it'
      ? skills
      : [...skills].sort((a, b) => loc(a).localeCompare(loc(b), getLang()));
    const categoryLabels = getLang() === 'it' ? armorCategories : ARMOR_CATEGORIES_EN;
    const alignmentLabel = (a) => (getLang() === 'it' ? a : (ALIGNMENTS_EN[a] ?? a));

    this.#q('[data-options="races"]').replaceChildren(
      el('option', { value: '', text: '—' }),
      ...races.map((r) => el('option', { value: r.id, text: loc(r) })),
    );
    this.#q('[data-options="classes"]').replaceChildren(
      ...classes.map((c) => el('option', { value: c.id, text: loc(c) })),
    );
    this.#q('[data-options="alignments"]').replaceChildren(
      el('option', { value: '', text: '—' }),
      ...alignments.map((a) => el('option', { value: a, text: alignmentLabel(a) })),
    );

    // Armature raggruppate per categoria con <optgroup>
    const armorSelect = this.#q('[data-options="armors"]');
    armorSelect.replaceChildren();
    for (const [category, label] of Object.entries(categoryLabels)) {
      const items = armors.filter((a) => a.category === category);
      const options = items.map((a) => el('option', {
        value: a.id,
        text: category === 'none' ? loc(a) : `${loc(a)} (${pick('CA', 'AC')} ${a.baseAC})`,
      }));
      armorSelect.append(category === 'none' ? options[0] : el('optgroup', { label }, options));
    }

    this.#q('[data-list="abilities"]').replaceChildren(...abilities.map((a) => el('div', { class: 'ability' }, [
      el('span', { class: 'ability__name', text: loc(a) }),
      el('output', { class: 'ability__mod', dataset: { out: `mods.${a.id}`, format: 'mod' } }),
      el('input', {
        type: 'number', min: 1, max: 30, inputmode: 'numeric',
        'aria-label': `${pick('Punteggio di', 'Score for')} ${loc(a)}`, dataset: { bind: `abilities.${a.id}` },
      }),
    ])));

    this.#q('[data-list="saves"]').replaceChildren(...abilities.map((a) => el('li', { class: 'checklist__row checklist__row--save' }, [
      el('input', { type: 'checkbox', id: `save-${a.id}`, dataset: { bind: `saveProficiencies.${a.id}` } }),
      el('label', { class: 'checklist__name', for: `save-${a.id}`, text: loc(a) }),
      el('output', { class: 'checklist__value', dataset: { out: `saves.${a.id}`, format: 'mod' } }),
    ])));

    this.#q('[data-list="skills"]').replaceChildren(...sortedSkills.map((s) => el('li', { class: 'checklist__row' }, [
      el('input', {
        type: 'checkbox', id: `skill-${s.id}`, title: pick('Competenza', 'Proficiency'),
        dataset: { bind: `skills.${s.id}.proficient` },
      }),
      el('input', {
        type: 'checkbox', class: 'expertise', title: pick('Maestria (doppia competenza)', 'Expertise (double proficiency)'),
        'aria-label': `${pick('Maestria in', 'Expertise in')} ${loc(s)}`, dataset: { bind: `skills.${s.id}.expertise` },
      }),
      el('label', { class: 'checklist__name', for: `skill-${s.id}` }, [
        loc(s), el('small', { text: shortOf[s.ability] }),
      ]),
      el('output', { class: 'checklist__value', dataset: { out: `skills.${s.id}`, format: 'mod' } }),
    ])));
  }

  // ===================================================================
  // Lingua
  // ===================================================================

  /**
   * Applica la lingua corrente (già impostata in i18n.js) a tutta la pagina:
   * testi statici, menu costruiti dai cataloghi e liste dinamiche.
   * Il Controller chiama poi render() per aggiornare i valori derivati.
   */
  applyLanguage() {
    const lang = getLang();
    this.#root.documentElement?.setAttribute('lang', lang);
    this.#headOriginals ??= {
      title: this.#root.title,
      description: this.#q('meta[name="description"]')?.getAttribute('content') ?? '',
    };
    this.#root.title = translateString(this.#headOriginals.title);
    this.#q('meta[name="description"]')?.setAttribute('content', translateString(this.#headOriginals.description));

    translateTree(this.#root.body ?? this.#root);
    if (this.#catalogs) this.build(this.#catalogs);
    this.#listKeys.clear(); // le liste dinamiche vanno ricostruite nella nuova lingua
    this.#qa('[data-lang]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.lang === lang));
    });
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
    this.#renderRaceChoices(derived.race?.choices ?? []);
    this.#renderClassSkills(derived.classInfo.skillSlots);
    this.#renderAcItems(state.equipment.acItems);

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
      translateTree(row);
      row.querySelectorAll('[data-field]').forEach((input) => {
        input.dataset.bind = `weapons.${index}.${input.dataset.field}`;
        input.setAttribute('aria-label', `${input.closest('label')?.textContent.trim() ?? ''} ${pick('arma', 'weapon')} ${index + 1}`);
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
      el('span', { class: 'slot__level', text: pick(`${slot.level}°`, ordinal(slot.level)) }),
      el('div', {
        class: 'pips',
        dataset: { pips: '', path: `spells.slotsUsed.${slot.level}`, max: slot.max, label: pick(`Slot di ${slot.level}° livello usato`, `${ordinal(slot.level)}-level slot used`) },
      }),
      el('span', { class: 'slot__count', dataset: { out: `spellcasting.slots.${i}.remaining` } }),
    ])));
  }

  #renderFeatures(features) {
    const key = features.map((f) => `${f.level}${f.name}`).join('|');
    if (!this.#shouldRebuild('features', key)) return;

    this.#q('[data-list="features"]').replaceChildren(...features.map((f) => el('li', { class: 'feature' }, [
      el('span', { class: 'feature__level', text: pick(`Liv. ${f.level}`, `Lv. ${f.level}`) }),
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

  /** Menu a tendina per le scelte della razza (aumenti, abilità, opzione singola). */
  #renderRaceChoices(choices) {
    const key = choices.map((c) => `${c.key}:${c.label}:${c.options.length}`).join('|');
    if (!this.#shouldRebuild('race-choices', key)) return;

    this.#q('[data-list="race-choices"]').replaceChildren(...choices.map((choice) => el('label', { class: 'field' }, [
      el('span', { class: 'field__label', text: choice.label }),
      el('select', { dataset: { bind: `info.raceChoices.${choice.key}` } }, [
        el('option', { value: '', text: '—' }),
        ...choice.options.map((o) => el('option', { value: o.value, text: o.label })),
      ]),
    ])));
  }

  /** Menu a tendina per le competenze in abilità scelte dalla classe. */
  #renderClassSkills(slots) {
    const key = slots.map((s) => `${s.key}:${s.options.length}`).join('|');
    if (!this.#shouldRebuild('class-skills', key)) return;

    this.#q('[data-list="class-skills"]').replaceChildren(...slots.map((slot, i) => el('label', { class: 'field' }, [
      el('span', { class: 'field__label', text: `${pick('Abilità di classe', 'Class skill')} ${i + 1}` }),
      el('select', { dataset: { bind: `classSkills.${slot.key}` } }, [
        el('option', { value: '', text: '—' }),
        ...slot.options.map((o) => el('option', { value: o.value, text: o.label })),
      ]),
    ])));
  }

  /** Oggetti che modificano la CA: nome e bonus, con rimozione. */
  #renderAcItems(items) {
    const key = items.map((item) => item.id).join('|');
    if (!this.#shouldRebuild('ac-items', key)) return;

    this.#q('[data-list="ac-items"]').replaceChildren(...items.map((item, index) => el('div', { class: 'ac-item' }, [
      el('label', { class: 'field' }, [
        el('span', { class: 'field__label', text: pick('Oggetto', 'Item') }),
        el('input', { type: 'text', autocomplete: 'off', placeholder: pick('Anello di protezione', 'Ring of protection'), dataset: { bind: `equipment.acItems.${index}.name` } }),
      ]),
      el('label', { class: 'field' }, [
        el('span', { class: 'field__label', text: pick('Bonus CA', 'AC bonus') }),
        el('input', { type: 'number', min: '-5', max: '10', inputmode: 'numeric', dataset: { bind: `equipment.acItems.${index}.bonus` } }),
      ]),
      el('button', {
        type: 'button', class: 'btn btn--icon btn--danger', 'aria-label': pick('Rimuovi oggetto', 'Remove item'),
        dataset: { action: 'remove-ac-item', id: item.id }, text: '✕',
      }),
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
          dataset: { action: 'set-pip', path: group.dataset.path, index: i },
        }));
      }
      while (group.children.length > max) group.lastElementChild.remove();
      [...group.children].forEach((pip, i) => {
        pip.setAttribute('aria-label', `${translateString(group.dataset.label)} ${i + 1}`);
        pip.setAttribute('aria-pressed', String(i < value));
      });
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
