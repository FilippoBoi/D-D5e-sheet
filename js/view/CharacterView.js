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
import { GROUP_LABELS } from '../data/sources.js';
import { translateString, translateTree } from '../i18n/domTranslator.js';

/** 1 → 1st, 2 → 2nd, 3 → 3rd, 4 → 4th... (solo inglese). */
function ordinal(n) {
  const rest = n % 100;
  if (rest >= 11 && rest <= 13) return `${n}th`;
  return `${n}${{ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] ?? 'th'}`;
}

/** Oltre questo numero di usi si mostra un contatore al posto dei pallini (es. Imposizione delle Mani). */
const MAX_PIPS = 20;

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
  /** Nodi delle scelte di classe già costruiti, per aggiornarli senza ricrearli. */
  #choiceNodes = null;
  /** Selettore di incantesimi aperto (popup): `sync(spellcasting)` ne aggiorna spunte e contatore. */
  #spellPicker = null;

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
  build({ abilities, skills, armors, armorCategories, classes, races, backgrounds, alignments, sources = [] }) {
    this.#catalogs = { abilities, skills, armors, armorCategories, classes, races, backgrounds, alignments, sources };
    const shortOf = Object.fromEntries(abilities.map((a) => [a.id, loc(a, 'short')]));
    // In inglese le abilità vanno riordinate alfabeticamente (l'elenco di base è in ordine italiano).
    const sortedSkills = getLang() === 'it'
      ? skills
      : [...skills].sort((a, b) => loc(a).localeCompare(loc(b), getLang()));
    const categoryLabels = getLang() === 'it' ? armorCategories : ARMOR_CATEGORIES_EN;
    const alignmentLabel = (a) => (getLang() === 'it' ? a : (ALIGNMENTS_EN[a] ?? a));

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
    this.#choiceNodes?.forEach((entry) => entry.node.remove());
    this.#choiceNodes = null;
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
    this.#renderRaceTraits(derived.raceTraits);
    this.#renderLanguageSlots(derived.languageInfo.slots);
    this.#renderResources(derived.infoResources);
    this.#renderUsables(derived.usables);
    this.#renderOrigins(state, derived.sources);
    this.#renderRaceChoices(derived.race?.choices ?? []);
    this.#renderClassSkills(derived.classInfo.skillSlots);
    this.#renderClassChoices(derived.classChoices);
    this.#renderAcItems(state.equipment.acItems);
    this.#renderSpellSets(state, derived.spellcasting);
    this.#spellPicker?.sync(derived.spellcasting);

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
    // Competenza concessa da razza, background o classe: spuntata e bloccata.
    const autoProf = new Set(derived.proficientFromSources);
    this.#qa('input[data-bind$=".proficient"]').forEach((box) => {
      const m = /^skills\.([^.]+)\.proficient$/.exec(box.dataset.bind);
      if (!m) return;
      const locked = autoProf.has(m[1]);
      box.disabled = locked;
      if (locked) box.checked = true;
      box.title = locked
        ? pick('Competenza concessa da razza, background o classe', 'Proficiency granted by race, background or class')
        : pick('Competenza', 'Proficiency');
    });
    // Maestria concessa da una scelta di classe: spuntata e bloccata, per non confonderla con quella manuale.
    const fromChoices = new Set(derived.expertiseFromChoices);
    this.#qa('input.expertise').forEach((box) => {
      const id = box.dataset.bind.split('.')[1];
      const locked = fromChoices.has(id);
      box.disabled = locked;
      if (locked) box.checked = true;
      box.title = locked
        ? pick('Maestria concessa da una scelta di classe', 'Expertise granted by a class choice')
        : pick('Maestria (doppia competenza)', 'Expertise (double proficiency)');
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
    const key = features.map((f) => `${f.level}${f.name}${f.tag ?? ''}${f.description}`).join('|');
    if (!this.#shouldRebuild('features', key)) return;

    this.#q('[data-list="features"]').replaceChildren(...features.map((f) => el('li', { class: 'feature' }, [
      el('span', { class: 'feature__level', text: pick(`Liv. ${f.level}`, `Lv. ${f.level}`) }),
      el('div', {}, [
        el('div', { class: 'feature__name' }, [f.name, f.tag ? el('span', { class: 'feature__tag', text: f.tag }) : null]),
        el('p', { class: 'feature__desc', text: f.description }),
      ]),
    ])));
  }

  #renderRaceTraits(traits) {
    const key = traits.map((t) => `${t.name}${t.tag}${t.description}`).join('|');
    if (!this.#shouldRebuild('race-traits', key)) return;

    this.#q('[data-list="race-traits"]').replaceChildren(...traits.map((t) => el('li', { class: 'feature feature--race' }, [
      el('span', { class: 'feature__level', text: pick('Razza', 'Race') }),
      el('div', {}, [
        el('div', { class: 'feature__name' }, [t.name, t.tag ? el('span', { class: 'feature__tag', text: t.tag }) : null]),
        el('p', { class: 'feature__desc', text: t.description }),
      ]),
    ])));
  }

  /** Menu per le lingue a scelta (razza e background); quelle già note non si ripropongono. */
  #renderLanguageSlots(slots) {
    const key = slots.map((s) => `${s.key}:${s.duplicate}:${s.options.map((o) => o.value).join(',')}`).join('|');
    if (!this.#shouldRebuild('language-slots', key)) return;

    this.#q('[data-list="language-slots"]').replaceChildren(...slots.map((slot, i) => el('label', { class: 'field' }, [
      el('span', { class: 'field__label', text: `${pick('Lingua a scelta', 'Language of your choice')} ${i + 1}` }),
      el('select', { 'aria-invalid': slot.duplicate ? 'true' : null, dataset: { bind: `languages.${slot.key}` } }, [
        el('option', { value: '', text: '—' }),
        ...slot.options.map((o) => el('option', { value: o.value, text: o.label })),
      ]),
      slot.duplicate ? el('small', {
        class: 'field__error', role: 'status',
        text: pick('Già conosciuta: scegline un\'altra.', 'Already known: pick another.'),
      }) : null,
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

  /**
   * Risorse a usi limitati: pallini da spuntare (un contatore se sono tanti) e il riposo che le ricarica.
   * Si ricostruiscono solo se cambiano massimo o etichetta; le spunte seguono lo stato (vedi #renderPips).
   */
  #renderUsables(usables) {
    const key = usables.map((u) => `${u.id}:${u.label}:${u.detail}:${u.max}:${u.recharge}`).join('|');
    if (!this.#shouldRebuild('usables', key)) return;

    const recharge = { short: pick('Riposo breve', 'Short rest'), long: pick('Riposo lungo', 'Long rest') };
    this.#q('[data-list="usables"]').replaceChildren(...usables.map((u, i) => el('div', { class: 'usable' }, [
      el('div', { class: 'usable__head' }, [
        el('span', { class: 'usable__name', text: u.label }),
        el('span', { class: `usable__tag usable__tag--${u.recharge}`, text: recharge[u.recharge] }),
      ]),
      el('div', { class: 'usable__body' }, [
        u.max > MAX_PIPS
          ? el('label', { class: 'usable__counter' }, [
            el('span', { text: pick('Usati', 'Used') }),
            el('input', { type: 'number', min: 0, max: u.max, inputmode: 'numeric', dataset: { bind: u.path } }),
          ])
          : el('div', { class: 'pips', dataset: { pips: '', path: u.path, max: u.max, label: `${u.label}: ${pick('uso speso', 'use spent')}` } }),
        el('span', { class: 'usable__count', dataset: { out: `usables.${i}.remaining` } }),
      ]),
      u.detail ? el('small', { class: 'usable__detail', text: u.detail }) : null,
    ])));
  }

  /**
   * Propone come assegnare i PF salendo di livello: media, tiro del dado vita o dadi già tirati.
   * @returns {Promise<{mode: 'average'|'roll'|'manual', total?: number} | null>} null se si rimanda
   */
  promptLevelUp({ from, to, levels, hp }) {
    const die = hp.hitDieSides;
    const sign = (n) => (n >= 0 ? `+${n}` : `−${Math.abs(n)}`);
    const average = hp.averageGain * levels;
    const dialog = el('dialog', { class: 'dialog dialog--levelup', 'aria-labelledby': 'levelup-title' });
    let result = null;
    const done = (value) => { result = value; dialog.close(); };

    const manual = el('input', {
      type: 'number', class: 'input', min: levels, max: levels * die, inputmode: 'numeric',
      'aria-label': pick(`Somma dei dadi tirati (${levels}d${die})`, `Sum of the dice rolled (${levels}d${die})`),
      placeholder: `${levels}–${levels * die}`,
    });
    const manualBtn = el('button', { type: 'button', class: 'btn' }, pick('Applica', 'Apply'));
    manualBtn.addEventListener('click', () => {
      const total = Number.parseInt(manual.value, 10);
      if (Number.isFinite(total)) done({ mode: 'manual', total });
      else manual.focus();
    });

    const averageBtn = el('button', { type: 'button', class: 'btn btn--teal' },
      pick(`Media: +${average} PF`, `Average: +${average} HP`));
    averageBtn.addEventListener('click', () => done({ mode: 'average' }));
    const rollBtn = el('button', { type: 'button', class: 'btn' },
      pick(`Tira ${levels > 1 ? levels : ''}d${die}`, `Roll ${levels > 1 ? levels : ''}d${die}`));
    rollBtn.addEventListener('click', () => done({ mode: 'roll' }));
    const laterBtn = el('button', { type: 'button', class: 'btn btn--ghost' }, pick('Non ora', 'Not now'));
    laterBtn.addEventListener('click', () => done(null));

    dialog.append(
      el('div', { class: 'dialog__head' }, [
        el('h2', { id: 'levelup-title', text: pick(`Livello ${to}!`, `Level ${to}!`) }),
      ]),
      el('p', { class: 'dialog__hint', text: pick(
        `Sali da ${from} a ${to}: come vuoi aumentare i PF massimi?`,
        `Going from ${from} to ${to}: how do you want to raise your maximum HP?`,
      ) }),
      el('p', { class: 'dialog__hint', text: pick(
        `Dado vita d${die} · mod. Costituzione ${sign(hp.conMod)}${hp.perLevelBonus ? ` · +${hp.perLevelBonus} per livello` : ''}. Ogni livello dà almeno 1 PF.`,
        `Hit die d${die} · Constitution modifier ${sign(hp.conMod)}${hp.perLevelBonus ? ` · +${hp.perLevelBonus} per level` : ''}. Each level gives at least 1 HP.`,
      ) }),
      el('div', { class: 'dialog__inline' }, [averageBtn, rollBtn]),
      el('div', { class: 'dialog__inline' }, [
        el('span', { class: 'dialog__hint', text: pick('Hai già tirato fisicamente?', 'Already rolled physical dice?') }),
        manual, manualBtn,
      ]),
      el('div', { class: 'dialog__inline' }, [laterBtn]),
    );
    document.body.append(dialog);
    return new Promise((resolve) => {
      dialog.addEventListener('close', () => { dialog.remove(); resolve(result); });
      dialog.showModal();
      averageBtn.focus();
    });
  }

  /**
   * Manuali (caselle) e menu di razza e background, raggruppati per manuale.
   * Si vedono solo i manuali attivi, più l'elemento già scelto anche se il suo manuale è spento.
   */
  #renderOrigins(state, enabledList) {
    const { sources = [], races, backgrounds } = this.#catalogs;
    const enabled = new Set(enabledList);
    const sourceKey = [...enabled].sort().join(',');

    if (this.#shouldRebuild('sources', `${sourceKey}`)) {
      const rows = [];
      for (const [group, [labelIt, labelEn]] of Object.entries(GROUP_LABELS)) {
        const items = sources.filter((x) => x.group === group);
        if (!items.length) continue;
        rows.push(el('p', { class: 'sources__group', text: pick(labelIt, labelEn) }));
        for (const x of items) {
          const locked = x.id === 'PHB';
          rows.push(el('label', { class: 'sources__item' }, [
            el('input', { type: 'checkbox', checked: enabled.has(x.id), disabled: locked, dataset: { action: 'toggle-source', sourceId: x.id } }),
            el('span', { text: loc(x) }), el('small', { text: x.id }),
          ]));
        }
      }
      this.#q('[data-list="sources"]').replaceChildren(...rows);
    }

    const fill = (name, items, current, first) => {
      const key = `${sourceKey}|${current}`;
      if (!this.#shouldRebuild(name, key)) return;
      const visible = items.filter((x) => enabled.has(x.source ?? 'PHB') || x.id === current);
      const byId = (id) => visible.filter((x) => (x.source ?? 'PHB') === id);
      const options = [first];
      for (const src of sources) {
        const list = byId(src.id);
        if (!list.length) continue;
        const opts = list.map((x) => el('option', { value: x.id, text: loc(x) }));
        if (src.id === 'PHB' && enabled.size === 1) options.push(...opts);
        else options.push(el('optgroup', { label: loc(src) }, opts));
      }
      this.#q(`[data-options="${name}"]`).replaceChildren(...options);
      this.#qa(`[data-options="${name}"]`).forEach((select) => { select.value = current; });
    };
    fill('races', races, state.info.raceId, el('option', { value: '', text: '—' }));
    fill('backgrounds', backgrounds, state.info.backgroundId, el('option', { value: '', text: pick('Personalizzato', 'Custom') }));
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
    const key = slots.map((s) => `${s.key}:${s.duplicate}:${s.options.map((o) => o.value).join(',')}`).join('|');
    if (!this.#shouldRebuild('class-skills', key)) return;

    this.#q('[data-list="class-skills"]').replaceChildren(...slots.map((slot, i) => el('label', { class: 'field' }, [
      el('span', { class: 'field__label', text: `${pick('Abilità di classe', 'Class skill')} ${i + 1}` }),
      el('select', {
        'aria-invalid': slot.duplicate ? 'true' : null,
        'aria-describedby': slot.duplicate ? `class-skill-dup-${slot.key}` : null,
        dataset: { bind: `classSkills.${slot.key}` },
      }, [
        el('option', { value: '', text: '—' }),
        ...slot.options.map((o) => el('option', { value: o.value, text: o.label })),
      ]),
      slot.duplicate ? el('small', {
        class: 'field__error', id: `class-skill-dup-${slot.key}`, role: 'status',
        text: pick('Già competente per razza o background: scegline un\'altra.', 'Already proficient from race or background: pick another.'),
      }) : null,
    ])));
  }


  /**
   * Scelte di classe: menu per le singole, elenco con caselle (e ricerca se lungo) per le multiple.
   * La struttura si ricostruisce solo se cambia; i nodi invariati restano al loro posto, così
   * scegliere un'opzione non fa perdere il focus. I valori si aggiornano sul posto a ogni render.
   */
  #renderClassChoices(groups) {
    const container = this.#q('[data-list="class-choices"]');
    if (!container) return;
    this.#choiceNodes ??= new Map();
    const wanted = new Map();
    for (const g of groups) {
      const signature = `${g.type}|${g.label}|${g.hint}|${g.options.map((o) => `${o.value}=${o.label}`).join(',')}`;
      const previous = this.#choiceNodes.get(g.key);
      wanted.set(g.key, previous?.signature === signature ? previous : { signature, node: this.#buildChoice(g) });
    }
    // Via i nodi che non servono più: scelte sparite o ricostruite (stessa chiave, struttura diversa).
    for (const [key, entry] of this.#choiceNodes) if (wanted.get(key)?.node !== entry.node) entry.node.remove();
    this.#choiceNodes = wanted;
    let cursor = container.firstChild;
    for (const { node } of wanted.values()) {
      if (node === cursor) cursor = cursor.nextSibling;
      else container.insertBefore(node, cursor);
    }

    for (const g of groups) this.#syncChoice(wanted.get(g.key).node, g);
  }

  #buildChoice(g) {
    const bind = `info.classChoices.${g.key}`;
    if (g.type === 'single' || g.type === 'text') {
      const control = g.type === 'text'
        ? el('input', { type: 'text', autocomplete: 'off', maxlength: '60', 'aria-describedby': `choice-${g.key}-desc`, dataset: { bind } })
        : el('select', { 'aria-describedby': `choice-${g.key}-desc`, dataset: { bind } }, [
          el('option', { value: '', text: '—' }),
          ...g.options.map((o) => el('option', { value: o.value, text: o.label })),
        ]);
      return el('label', { class: 'field choice', dataset: { choice: g.key } }, [
        el('span', { class: 'field__label', text: g.label }),
        control,
        el('small', { class: 'choice__desc', id: `choice-${g.key}-desc`, dataset: { role: 'desc' } }),
      ]);
    }

    const rows = [];
    let lastGroup = null;
    for (const o of g.options) {
      if (o.group && o.group !== lastGroup) {
        rows.push(el('p', { class: 'choice__group', dataset: { group: o.group } }, o.group));
        lastGroup = o.group;
      }
      rows.push(el('label', { class: 'choice__opt', dataset: { search: `${o.label} ${o.note}`.toLowerCase(), group: o.group } }, [
        el('input', { type: 'checkbox', 'aria-describedby': `choice-${g.key}-${o.value}-note`, dataset: { action: 'toggle-choice', choiceKey: g.key, choiceValue: o.value } }),
        el('span', { class: 'choice__text' }, [
          el('span', { class: 'choice__name', text: o.label }),
          el('small', { class: 'choice__note', id: `choice-${g.key}-${o.value}-note`, dataset: { role: 'note' } }),
        ]),
      ]));
    }
    const list = el('div', { class: 'choice__list' }, rows);
    const fieldset = el('fieldset', {
      class: `choice choice--multi${g.searchable ? ' choice--long' : ''}`, dataset: { choice: g.key },
      'aria-describedby': g.hint ? `choice-${g.key}-hint` : null,
    }, [
      el('legend', { class: 'field__label', text: g.label }),
      g.hint ? el('p', { class: 'hint', id: `choice-${g.key}-hint`, text: g.hint }) : null,
      el('p', { class: 'choice__count', 'aria-live': 'polite', dataset: { role: 'count' } }),
    ]);
    if (g.searchable) {
      const search = el('input', {
        type: 'search', class: 'choice__search', autocomplete: 'off',
        placeholder: pick('Cerca…', 'Search…'), 'aria-label': `${pick('Cerca in', 'Search in')} ${g.label}`,
      });
      search.addEventListener('input', () => {
        const query = search.value.trim().toLowerCase();
        list.querySelectorAll('.choice__opt').forEach((row) => { row.hidden = Boolean(query) && !row.dataset.search.includes(query); });
        // Un titolo di gruppo resta visibile solo se ha almeno una voce visibile.
        list.querySelectorAll('.choice__group').forEach((title) => {
          title.hidden = ![...list.querySelectorAll('.choice__opt')].some((row) => row.dataset.group === title.dataset.group && !row.hidden);
        });
      });
      fieldset.append(search);
    }
    fieldset.append(list, el('p', { class: 'choice__warn', role: 'status', hidden: true, dataset: { role: 'warn' } }));
    return fieldset;
  }

  #syncChoice(node, g) {
    const part = (role) => node.querySelector(`[data-role="${role}"]`);
    if (g.type === 'single') { part('desc').textContent = g.description; return; }
    if (g.type === 'text') return;

    node.querySelectorAll('.choice__opt').forEach((row, i) => {
      const o = g.options[i];
      const box = row.querySelector('input');
      box.checked = o.selected;
      box.disabled = o.disabled;
      row.classList.toggle('choice__opt--disabled', o.disabled);
      row.querySelector('[data-role="note"]').textContent = o.note;
    });
    part('count').textContent = `${g.selectedCount}/${g.count} ${pick('scelte', 'chosen')}`;
    // Elementi memorizzati ma che non contano: si segnalano e si possono togliere (le caselle sono bloccate).
    const stale = [
      ...g.overflow.map((o) => ({ ...o, why: pick('oltre il limite', 'over the limit') })),
      ...g.blocked.map((b) => ({ ...b, why: b.reason })),
    ];
    const warn = part('warn');
    const signature = stale.map((x) => `${x.value}:${x.why}`).join('|');
    if (warn.dataset.signature === signature) return;
    warn.dataset.signature = signature;
    warn.hidden = stale.length === 0;
    warn.replaceChildren(...(stale.length ? [
      el('span', { text: `${pick('Memorizzati ma non contano', 'Stored but not counted')}: ` }),
      ...stale.map((x) => el('button', {
        type: 'button', class: 'choice__chip', 'aria-label': `${pick('Rimuovi', 'Remove')} ${x.label}`,
        title: x.why, dataset: { action: 'toggle-choice', choiceKey: g.key, choiceValue: x.value },
      }, `${x.label} (${x.why}) ✕`)),
    ] : []));
  }

  // ===================================================================
  // Incantesimi e trucchetti
  // ===================================================================

  /** Testo del contatore ("3/4", "5/4 · 1 in più") e il suo stato. */
  #spellCountText(info) {
    const base = info.limit > 0 ? `${info.count}/${info.limit}` : String(info.count);
    return info.over > 0 ? `${base} · ${pick(`${info.over} in più`, `${info.over} over`)}` : base;
  }

  /** Elenchi scelti nel pannello: raggruppati per livello, con rimozione e rimando al manuale. */
  #renderSpellSets(state, sc) {
    for (const kind of ['cantrips', 'spells']) {
      const info = sc[kind];
      const count = this.#q(`[data-spell-count="${kind}"]`);
      if (count) {
        count.textContent = this.#spellCountText(info);
        count.dataset.status = info.status;
        count.setAttribute('aria-label', info.limit > 0
          ? pick(`${info.count} scelti su ${info.limit}`, `${info.count} chosen of ${info.limit}`)
          : pick(`${info.count} scelti`, `${info.count} chosen`));
      }
      this.#q(`[data-spell-empty="${kind}"]`).hidden = info.count > 0;

      const key = `${getLang()}|${info.selected.map((x) => x.id).join(',')}`;
      if (!this.#shouldRebuild(`spell-list-${kind}`, key)) continue;
      const groups = new Map();
      for (const spell of info.selected) groups.set(spell.level, [...(groups.get(spell.level) ?? []), spell]);
      this.#q(`[data-list="spell-list-${kind}"]`).replaceChildren(...[...groups].map(([level, list]) => el('section', { class: 'spellgroup' }, [
        kind === 'spells' ? el('h4', { class: 'spellgroup__title', text: pick(`${list[0].levelLabel} livello`, `${list[0].levelLabel} level`) }) : null,
        el('ul', { class: 'spelllist' }, list.map((spell) => this.#spellRow(kind, spell))),
      ])));
    }

    // Se c'è già del testo nei campi a mano (salvataggi precedenti) il riquadro si apre da solo, una volta.
    const notes = this.#q('[data-ref="spell-notes"]');
    if (notes && notes.dataset.autoOpened !== '1' && (state.spells.cantrips || state.spells.prepared)) {
      notes.open = true;
      notes.dataset.autoOpened = '1';
    }
  }

  #spellRow(kind, spell) {
    return el('li', { class: 'spell' }, [
      el('div', { class: 'spell__body' }, [
        el('div', { class: 'spell__name' }, [
          spell.name,
          spell.altName && spell.altName !== spell.name ? el('small', { class: 'spell__alt', text: spell.altName }) : null,
          ...spell.tags.map((tag) => el('span', { class: `spell__tag spell__tag--${tag.id}`, title: tag.title, text: tag.label })),
        ]),
        el('div', { class: 'spell__meta', text: `${spell.school} · ${spell.meta} · ${spell.sourceText}` }),
      ]),
      el('button', {
        type: 'button', class: 'btn btn--ghost btn--icon', text: '✕',
        'aria-label': `${pick('Rimuovi', 'Remove')} ${spell.name}`, title: pick('Rimuovi', 'Remove'),
        dataset: { action: 'toggle-spell', kind, spellId: spell.id },
      }),
    ]);
  }

  /**
   * Popup per scegliere trucchetti o incantesimi: ricerca, filtri e un tocco per aggiungere o togliere.
   * Le modifiche si applicano subito (come ovunque nella scheda): non c'è un "Salva".
   * Su telefono occupa tutto lo schermo, con la barra dei filtri e il tasto «Fatto» sempre raggiungibili.
   *
   * @param {'cantrips' | 'spells'} kind
   * @param {Array<object>} options vedi model/spellPicker.js
   * @param {object} sc derived.spellcasting al momento dell'apertura
   */
  openSpellPicker(kind, options, sc) {
    if (this.#spellPicker) return;
    const isCantrips = kind === 'cantrips';
    const maxLevel = sc.maxLevel;
    const norm = (text) => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const filters = { query: '', level: null, conc: false, ritual: false, chosen: false, others: false };

    const dialog = el('dialog', { class: 'dialog dialog--spells', 'aria-labelledby': 'spellpick-title' });
    const title = isCantrips
      ? pick('Scegli i trucchetti', 'Choose cantrips')
      : pick('Scegli gli incantesimi', 'Choose spells');
    const count = el('output', { class: 'spellset__count', 'aria-live': 'polite' });
    const close = el('button', { type: 'button', class: 'btn btn--ghost btn--icon', 'aria-label': pick('Chiudi', 'Close'), text: '✕' });
    close.addEventListener('click', () => dialog.close());

    const search = el('input', {
      type: 'search', class: 'spellpick__search', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', enterkeyhint: 'search',
      placeholder: pick('Cerca per nome (italiano o inglese)…', 'Search by name (Italian or English)…'),
      'aria-label': pick('Cerca un incantesimo', 'Search for a spell'),
    });
    search.addEventListener('input', () => { filters.query = norm(search.value.trim()); apply(); });

    // Chip dei livelli (solo incantesimi): "Tutti" mostra quelli che puoi lanciare, "Oltre" gli altri.
    const levelChips = [];
    const levelGroup = el('div', { class: 'chips', role: 'group', 'aria-label': pick('Filtra per livello', 'Filter by level') });
    if (!isCantrips) {
      const levels = [
        [null, pick('Tutti', 'All')],
        ...Array.from({ length: maxLevel }, (_, i) => [i + 1, pick(`${i + 1}°`, `${i + 1}`)]),
        ...(maxLevel < 9 ? [['above', pick('Oltre', 'Higher')]] : []),
      ];
      for (const [value, label] of levels) {
        const chip = el('button', {
          type: 'button', class: 'chip', text: label, 'aria-pressed': String(value === null),
          title: value === 'above' ? pick('Incantesimi di livello superiore ai tuoi slot', 'Spells above your highest slot level') : null,
        });
        chip.addEventListener('click', () => {
          filters.level = value;
          levelChips.forEach(([c, v]) => c.setAttribute('aria-pressed', String(v === value)));
          apply();
        });
        levelChips.push([chip, value]);
        levelGroup.append(chip);
      }
    }

    const toggle = (label, key, titleText) => {
      const chip = el('button', { type: 'button', class: 'chip chip--toggle', text: label, title: titleText, 'aria-pressed': 'false' });
      chip.addEventListener('click', () => {
        filters[key] = !filters[key];
        chip.setAttribute('aria-pressed', String(filters[key]));
        apply();
      });
      return chip;
    };
    const toggles = el('div', { class: 'chips', role: 'group', 'aria-label': pick('Altri filtri', 'More filters') }, [
      toggle(pick('Scelti', 'Chosen'), 'chosen', pick('Mostra solo quelli già scelti', 'Show only the ones already chosen')),
      ...(isCantrips ? [] : [toggle(pick('Rituali', 'Rituals'), 'ritual', pick('Solo rituali', 'Rituals only'))]),
      toggle(pick('Concentrazione', 'Concentration'), 'conc', pick('Solo incantesimi a concentrazione', 'Concentration spells only')),
      toggle(pick('Altre classi', 'Other classes'), 'others', pick(`Mostra anche quelli fuori dalla lista: ${sc.listClassName}`, `Also show spells outside the ${sc.listClassName} list`)),
    ]);

    const rows = options.map((o) => {
      const button = el('button', {
        type: 'button', class: `spellrow${o.own ? '' : ' spellrow--other'}`, 'aria-pressed': 'false',
        dataset: { action: 'toggle-spell', kind, spellId: o.id },
      }, [
        el('span', { class: 'spellrow__box', 'aria-hidden': 'true' }),
        el('span', { class: 'spellrow__text' }, [
          el('span', { class: 'spellrow__name' }, [
            o.name,
            o.altName && o.altName !== o.name ? el('small', { class: 'spell__alt', text: o.altName }) : null,
            ...o.tags.map((tag) => el('span', { class: `spell__tag spell__tag--${tag.id}`, title: tag.title, text: tag.label })),
            o.own ? null : el('span', { class: 'spell__tag spell__tag--other', text: pick('Altra classe', 'Other class') }),
          ]),
          el('span', { class: 'spell__meta', text: `${o.school} · ${o.meta} · ${o.sourceText}` }),
        ]),
        isCantrips ? null : el('span', { class: 'spellrow__level', text: o.levelLabel }),
      ]);
      const item = el('li', {}, [button]);
      return { o, item, button, search: norm(`${o.name} ${o.altName}`) };
    });
    const list = el('ul', { class: 'spellpick__list' }, rows.map((r) => r.item));
    const empty = el('p', { class: 'spellpick__empty', hidden: true, role: 'status' });
    const result = el('span', { class: 'spellpick__result', 'aria-live': 'polite' });

    const apply = () => {
      let shown = 0;
      for (const { o, item, button, search: text } of rows) {
        const chosen = button.getAttribute('aria-pressed') === 'true';
        let visible = (!filters.query || text.includes(filters.query)) && (!filters.conc || o.tags.some((t) => t.id === 'conc'))
          && (!filters.ritual || o.tags.some((t) => t.id === 'ritual')) && (!filters.chosen || chosen);
        // Livello: "Tutti" mostra ciò che hai gli slot per lanciare (e sempre ciò che hai già scelto).
        if (visible && !isCantrips) {
          if (typeof filters.level === 'number') visible = o.level === filters.level;
          else if (filters.level === 'above') visible = o.level > maxLevel;
          else visible = chosen || o.level <= maxLevel;
        }
        // Lista: di norma solo quella della classe; "Altre classi" allarga (le scelte già fatte restano sempre visibili).
        if (visible && !chosen && !o.own && !filters.others) visible = false;
        item.hidden = !visible;
        if (visible) shown += 1;
      }
      result.textContent = pick(`${shown} ${shown === 1 ? 'risultato' : 'risultati'}`, `${shown} ${shown === 1 ? 'result' : 'results'}`);
      empty.hidden = shown > 0;
      if (!shown) {
        empty.textContent = filters.chosen
          ? pick('Non hai ancora scelto nulla.', 'You have not chosen anything yet.')
          : pick('Nessun risultato. Prova a togliere un filtro o attiva «Altre classi».', 'No results. Try removing a filter or turn on “Other classes”.');
      }
    };

    const sync = (spellcasting) => {
      const info = spellcasting[kind];
      const ids = new Set(info.selected.map((x) => x.id));
      for (const { o, button } of rows) {
        const on = ids.has(o.id);
        if (button.getAttribute('aria-pressed') !== String(on)) button.setAttribute('aria-pressed', String(on));
      }
      count.textContent = this.#spellCountText(info);
      count.dataset.status = info.status;
    };

    dialog.append(
      el('div', { class: 'spellpick' }, [
        el('div', { class: 'spellpick__head' }, [
          el('h2', { id: 'spellpick-title', text: title }),
          count, close,
        ]),
        el('p', { class: 'dialog__hint spellpick__hint', text: [
          `${pick('Lista', 'List')}: ${sc.listClassName}`,
          sc.listFromSubclass ? pick('(Cavaliere Mistico: soprattutto Abiurazione ed Evocazione · Mistificatore Arcano: Ammaliamento e Illusione)', '(Eldritch Knight: mostly Abjuration and Evocation · Arcane Trickster: Enchantment and Illusion)') : '',
          sc[kind].limit > 0 ? `· ${isCantrips ? pick('Trucchetti conosciuti', 'Cantrips known') : sc.spellsTitle}: ${sc[kind].limit}` : '',
        ].filter(Boolean).join(' ') }),
        el('div', { class: 'spellpick__tools' }, [search, levelGroup.childElementCount ? levelGroup : null, toggles]),
        el('div', { class: 'spellpick__scroll' }, [list, empty]),
        el('div', { class: 'spellpick__foot' }, [
          result,
          el('span', { class: 'spellpick__tip', text: pick('Ne manca qualcuno? Attiva altri manuali in «Manuali».', 'Missing one? Turn on more sourcebooks in “Sourcebooks”.') }),
          (() => { const done = el('button', { type: 'button', class: 'btn btn--teal', text: pick('Fatto', 'Done') }); done.addEventListener('click', () => dialog.close()); return done; })(),
        ]),
      ]),
    );
    // Un clic sullo sfondo (fuori dal riquadro) chiude, come ci si aspetta da un popup.
    dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
    dialog.addEventListener('close', () => { dialog.remove(); this.#spellPicker = null; });

    this.#spellPicker = { sync };
    document.body.append(dialog);
    sync(sc);
    apply();
    dialog.showModal();
    // Su telefono, mettere subito il focus sulla ricerca aprirebbe la tastiera e coprirebbe l'elenco.
    if (!globalThis.matchMedia?.('(pointer: coarse)').matches) search.focus();
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
