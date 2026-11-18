/**
 * Finestra con la descrizione di un'abilità, di un trucchetto o di un incantesimo.
 * Si apre da qualunque pulsante con `data-info="skill:<id>"` o `data-info="spell:<id>"`
 * (vedi `bindInfoButtons`): la scheda, il selettore di incantesimi e i prossimi elenchi
 * usano lo stesso meccanismo.
 */
import { el } from './dom.js';
import { parseRichText } from '../model/richText.js';
import { getLang, loc, pick } from '../i18n/i18n.js';
import { getAbility } from '../data/abilities.js';
import { SKILLS } from '../data/skills.js';
import { getSpell } from '../data/spells.js';
import { getSkillText, loadSpellText, textLang } from '../data/descriptions.js';
import { castTimeText, durationText, levelLabel, rangeText, schoolName, sourceText } from '../model/spellText.js';

const SRD_URL = 'https://dnd.wizards.com/resources/systems-reference-document';
const LICENSE_URL = 'https://creativecommons.org/licenses/by/4.0/legalcode';

const inline = (parts) => parts.map((p) => {
  if (!p.bold && !p.italic) return p.text;
  const strong = p.bold ? el('strong', { text: p.text }) : null;
  return p.italic ? el('em', {}, [strong ?? p.text]) : strong;
});

/** Nodi DOM per un testo Markdown (paragrafi, elenchi, tabelle). */
export function renderRichText(text) {
  return parseRichText(text).map((block) => {
    if (block.type === 'ul') return el('ul', {}, block.items.map((item) => el('li', {}, inline(item))));
    if (block.type === 'table') {
      return el('div', { class: 'info__table', tabindex: '0', role: 'region', 'aria-label': pick('Tabella', 'Table') }, [
        el('table', {}, [
          el('thead', {}, [el('tr', {}, block.head.map((c) => el('th', { scope: 'col' }, inline(c))))]),
          el('tbody', {}, block.rows.map((row) => el('tr', {}, row.map((c) => el('td', {}, inline(c)))))),
        ]),
      ]);
    }
    return el('p', {}, inline(block.inline));
  });
}

/** Scheda tecnica di un incantesimo, nella lingua corrente (le componenti materiali restano in inglese). */
/** @param {import('../data/descriptions.js').SpellDescription} [extra] */
function spellFacts(spell, extra) {
  const lang = getLang() === 'en' ? 1 : 0;
  const comps = spell.comp.split('').join(', ') || '—';
  const duration = durationText(spell.dur);
  return [
    [pick('Tempo di lancio', 'Casting time'), extra?.time?.[lang] ?? castTimeText(spell.time)],
    [pick('Gittata', 'Range'), rangeText(spell.range)],
    [pick('Componenti', 'Components'), extra?.mat ? `${comps} ${extra.mat}` : comps],
    [pick('Durata', 'Duration'), spell.conc ? `${pick('Concentrazione', 'Concentration')}, ${duration}` : duration],
    [pick('Manuale', 'Source'), sourceText(spell)],
  ];
}

function spellHeader(spell) {
  const school = schoolName(spell.school);
  return {
    title: loc(spell),
    alt: loc(spell) === spell.nameEn ? spell.name : spell.nameEn,
    subtitle: spell.level === 0
      ? `${pick('Trucchetto', 'Cantrip')} · ${school}`
      : `${levelLabel(spell.level)} ${pick('livello', 'level')} · ${school}`,
  };
}

/** Nota su fonte e licenza, che cambia tra testo SRD e riassunto. */
function notice(entry, where) {
  if (entry.sum) {
    return el('p', { class: 'info__note' }, pick(
      `Riassunto originale della meccanica: per il testo ufficiale vedi ${where}.`,
      `Original summary of the mechanics: see ${where} for the official wording.`,
    ));
  }
  return el('p', { class: 'info__note' }, [
    pick('Testo dell’', 'Text from the '),
    el('a', { href: SRD_URL, target: '_blank', rel: 'noopener noreferrer', text: 'SRD 5.1' }),
    pick(' © Wizards of the Coast, ', ' © Wizards of the Coast, '),
    el('a', { href: LICENSE_URL, target: '_blank', rel: 'noopener noreferrer', text: 'CC BY 4.0' }),
    pick('. Traduzione italiana non ufficiale.', '. Italian translation is unofficial.'),
  ]);
}

/**
 * @param {object} p
 * @param {string} p.title
 * @param {string} [p.alt] nome nell'altra lingua
 * @param {string} [p.subtitle]
 * @param {(data?: object) => Array<[string, string]>} [p.facts] scheda tecnica; si rifà a testo caricato
 * @param {Promise<(import('../data/descriptions.js').Description) | undefined>} p.entry
 * @param {string} p.where rimando al manuale per i riassunti ("PHB, p. 241")
 */
function open({ title, alt, subtitle, facts = () => [], entry, where }) {
  const dialog = el('dialog', { class: 'dialog dialog--info', 'aria-labelledby': 'info-title' });
  const body = el('div', { class: 'info__text', 'aria-live': 'polite', 'aria-busy': 'true' }, [
    el('p', { class: 'dialog__hint', text: pick('Caricamento…', 'Loading…') }),
  ]);
  const foot = el('div', { class: 'info__foot' });
  const factsList = el('dl', { class: 'info__facts' });
  const fillFacts = (data) => {
    factsList.replaceChildren(...facts(data).flatMap(([k, v]) => [el('dt', { text: k }), el('dd', { text: v })]));
    factsList.hidden = !factsList.childElementCount;
  };
  fillFacts(undefined);
  const closeBtn = el('button', { type: 'button', class: 'btn', text: pick('Chiudi', 'Close') });
  closeBtn.addEventListener('click', () => dialog.close());

  dialog.append(
    el('div', { class: 'dialog__head' }, [
      el('div', { class: 'info__titles' }, [
        el('h2', { id: 'info-title', text: title }),
        alt && alt !== title ? el('small', { class: 'spell__alt', text: alt }) : null,
      ]),
      el('button', { type: 'button', class: 'btn btn--ghost btn--icon', text: '✕', 'aria-label': pick('Chiudi', 'Close'), title: pick('Chiudi', 'Close'), dataset: { close: '' } }),
    ]),
    subtitle ? el('p', { class: 'info__subtitle', text: subtitle }) : null,
    factsList, body, foot,
  );
  dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener('close', () => dialog.remove());
  document.body.append(dialog);
  dialog.showModal();

  entry.then((data) => {
    body.removeAttribute('aria-busy');
    fillFacts(data);
    if (!data) { body.replaceChildren(el('p', { class: 'dialog__hint', text: pick('Nessuna descrizione disponibile.', 'No description available.') })); return; }
    const lang = textLang(data);
    body.lang = lang;
    body.replaceChildren(...renderRichText(data[lang]));
    foot.replaceChildren(notice(data, where), closeBtn);
  }, () => {
    body.removeAttribute('aria-busy');
    body.replaceChildren(el('p', { class: 'dialog__error', role: 'alert', text: pick('Impossibile caricare la descrizione. Controlla la connessione e riprova.', 'Could not load the description. Check your connection and try again.') }));
    foot.replaceChildren(closeBtn);
  });
  if (!foot.childElementCount) foot.append(closeBtn);
}

export function showSkillDescription(id) {
  const skill = SKILLS.find((s) => s.id === id);
  const text = getSkillText(id);
  if (!skill) return;
  const ability = getAbility(skill.ability);
  open({
    title: loc(skill),
    alt: loc(skill) === skill.nameEn ? skill.name : skill.nameEn,
    subtitle: `${pick('Prova di', 'Check:')} ${ability ? loc(ability) : skill.ability}`,
    facts: () => (text?.page ? [[pick('Manuale', 'Source'), `PHB, p. ${text.page}`]] : []),
    entry: Promise.resolve(text),
    where: text?.page ? `PHB, p. ${text.page}` : 'PHB',
  });
}

export function showSpellDescription(id) {
  const spell = getSpell(id);
  if (!spell) return;
  const entry = loadSpellText(id);
  open({
    ...spellHeader(spell),
    // Condizioni di lancio e materiali stanno nel testo: la scheda si completa a caricamento finito.
    facts: (data) => spellFacts(spell, data),
    entry,
    where: sourceText(spell),
  });
}

/**
 * Collega i pulsanti `data-info` (anche quelli dei popup, che stanno fuori dalla scheda).
 * @param {Document | HTMLElement} root
 */
export function bindInfoButtons(root = document) {
  root.addEventListener('click', (event) => {
    const button = event.target.closest?.('[data-info]');
    if (!button) return;
    event.preventDefault();
    const [kind, id] = button.dataset.info.split(':');
    if (kind === 'skill') showSkillDescription(id);
    else if (kind === 'spell') showSpellDescription(id);
  });
}

/** Il pulsante «i» che apre la descrizione. @param {'skill' | 'spell'} kind */
export function infoButton(kind, id, name) {
  return el('button', {
    type: 'button', class: 'btn btn--ghost btn--icon info-btn', text: 'i',
    'aria-label': `${pick('Descrizione:', 'Description:')} ${name}`, title: pick('Descrizione', 'Description'),
    dataset: { info: `${kind}:${id}` },
  });
}
