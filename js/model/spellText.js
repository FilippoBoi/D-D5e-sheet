/**
 * Testi degli incantesimi nella lingua corrente, in funzioni pure.
 * I dati compatti (vedi data/generated/spells.js) diventano etichette leggibili.
 */
import { feetToMeters } from '../data/races.js';
import { loc, pick } from '../i18n/i18n.js';

const SCHOOLS = {
  A: ['Abiurazione', 'Abjuration'], C: ['Invocazione', 'Conjuration'], D: ['Divinazione', 'Divination'],
  E: ['Ammaliamento', 'Enchantment'], V: ['Evocazione', 'Evocation'], I: ['Illusione', 'Illusion'],
  N: ['Necromanzia', 'Necromancy'], T: ['Trasmutazione', 'Transmutation'],
};

export const schoolName = (code) => (SCHOOLS[code] ? pick(...SCHOOLS[code]) : code);

/** 1 → "1°" (it) / "1st" (en); 0 → trucchetto. */
export function levelLabel(level) {
  if (level === 0) return pick('Trucchetto', 'Cantrip');
  const rest = level % 100;
  const suffix = rest >= 11 && rest <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[level % 10] ?? 'th');
  return pick(`${level}°`, `${level}${suffix}`);
}

export function castTimeText(code) {
  const m = /^(\d+)([abrmh])$/.exec(code);
  if (!m) return pick('Speciale', 'Special');
  const n = Number(m[1]);
  switch (m[2]) {
    case 'a': return pick(`${n} azione`, `${n} action`);
    case 'b': return pick(`${n} az. bonus`, `${n} bonus action`);
    case 'r': return pick(`${n} reazione`, `${n} reaction`);
    case 'm': return pick(`${n} min`, `${n} min`);
    default: return pick(`${n} ${n === 1 ? 'ora' : 'ore'}`, `${n} hr`);
  }
}

export function rangeText(code) {
  switch (code) {
    case 'self': return pick('Su di sé', 'Self');
    case 'touch': return pick('Contatto', 'Touch');
    case 'sight': return pick('Vista', 'Sight');
    case 'unl': return pick('Illimitata', 'Unlimited');
    default: break;
  }
  const m = /^(\d+)(ft|mi)$/.exec(code);
  if (!m) return pick('Speciale', 'Special');
  const n = Number(m[1]);
  if (m[2] === 'mi') return pick(`${n * 1.5} km`.replace('.', ','), `${n} mi`);
  return pick(`${String(feetToMeters(n)).replace('.', ',')} m`, `${n} ft`);
}

export function durationText(code) {
  if (code === 'inst') return pick('Istantanea', 'Instantaneous');
  if (code === 'perm') return pick('Finché non dissolto', 'Until dispelled');
  const m = /^(\d+)([rmhd])$/.exec(code);
  if (!m) return pick('Speciale', 'Special');
  const n = Number(m[1]);
  switch (m[2]) {
    case 'r': return pick(`${n} round`, `${n} round${n === 1 ? '' : 's'}`);
    case 'm': return pick(`${n} min`, `${n} min`);
    case 'h': return pick(`${n} ${n === 1 ? 'ora' : 'ore'}`, `${n} hr`);
    default: return pick(`${n} ${n === 1 ? 'giorno' : 'giorni'}`, `${n} day${n === 1 ? '' : 's'}`);
  }
}

/** Una riga di riepilogo: "1 azione · 45 m · V S M · Istantanea". */
export function metaText(spell) {
  return [
    castTimeText(spell.time), rangeText(spell.range),
    spell.comp.split('').join(' ') || '—', durationText(spell.dur),
  ].join(' · ');
}

/** Etichette brevi con significato: concentrazione e rituale. */
export function spellTags(spell) {
  return [
    ...(spell.conc ? [{ id: 'conc', label: pick('Conc.', 'Conc.'), title: pick('Concentrazione', 'Concentration') }] : []),
    ...(spell.ritual ? [{ id: 'ritual', label: pick('Rit.', 'Rit.'), title: pick('Rituale', 'Ritual') }] : []),
  ];
}

/** Rimando al manuale: "PHB, p. 241". */
export const sourceText = (spell) => (spell.page ? `${spell.source}, p. ${spell.page}` : spell.source);

/** Voce pronta da mostrare (sulla scheda e nel selettore). */
export function describeSpell(spell) {
  return {
    id: spell.id,
    name: loc(spell),
    // Il nome nell'altra lingua, per la ricerca (e per riconoscere l'originale).
    altName: loc(spell) === spell.nameEn ? spell.name : spell.nameEn,
    level: spell.level,
    levelLabel: levelLabel(spell.level),
    school: schoolName(spell.school),
    meta: metaText(spell),
    tags: spellTags(spell),
    source: spell.source,
    sourceText: sourceText(spell),
  };
}
