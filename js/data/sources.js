/**
 * Manuali (fonti) supportati, con le sigle di 5e.tools.
 *
 * Il Manuale del Giocatore (PHB) è sempre attivo. Gli altri si attivano dal pannello
 * "Manuali" della scheda: è una preferenza dell'interfaccia (salvata nel browser), non un dato del personaggio.
 * Un elemento già scelto (razza, background, sottoclasse) resta sempre visibile e valido,
 * anche se il suo manuale viene disattivato.
 *
 * Nomi italiani: solo quelli ufficiali che il progetto conosce con sicurezza; per gli altri
 * si usa il titolo inglese (da verificare e tradurre).
 */
export const CORE_SOURCE = 'PHB';

const s = (id, nameEn, group, name = nameEn) => ({ id, name, nameEn, group });

export const SOURCES = Object.freeze([
  s('PHB', "Player's Handbook", 'core', 'Manuale del Giocatore'),
  s('XGE', "Xanathar's Guide to Everything", 'supplement', 'La Guida di Xanathar a Ogni Cosa'),
  s('TCE', "Tasha's Cauldron of Everything", 'supplement', 'Il Calderone di Tasha per Ogni Cosa'),
  s('VGM', "Volo's Guide to Monsters", 'supplement', 'Guida di Volo ai Mostri'),
  s('MTF', "Mordenkainen's Tome of Foes", 'supplement'),
  s('MPMM', 'Mordenkainen Presents: Monsters of the Multiverse', 'supplement'),
  s('FTD', "Fizban's Treasury of Dragons", 'supplement'),
  s('BGG', 'Bigby Presents: Glory of the Giants', 'supplement'),
  s('BMT', 'The Book of Many Things', 'supplement'),
  s('AI', 'Acquisitions Incorporated', 'supplement'),
  s('EEPC', "Elemental Evil Player's Companion", 'supplement'),
  s('SCAG', "Sword Coast Adventurer's Guide", 'setting', "Guida dell'Avventuriero alla Costa della Spada"),
  s('GGR', "Guildmasters' Guide to Ravnica", 'setting'),
  s('ERLW', 'Eberron: Rising from the Last War', 'setting'),
  s('EGW', "Explorer's Guide to Wildemount", 'setting'),
  s('MOT', 'Mythic Odysseys of Theros', 'setting'),
  s('VRGR', "Van Richten's Guide to Ravenloft", 'setting'),
  s('SCC', 'Strixhaven: A Curriculum of Chaos', 'setting'),
  s('AAG', "Astral Adventurer's Guide", 'setting'),
  s('SatO', 'Sigil and the Outlands', 'setting'),
  s('WBtW', 'The Wild Beyond the Witchlight', 'adventure'),
  s('DSotDQ', 'Dragonlance: Shadow of the Dragon Queen', 'adventure'),
  s('ToA', 'Tomb of Annihilation', 'adventure'),
  s('BGDIA', "Baldur's Gate: Descent into Avernus", 'adventure'),
  s('GoS', 'Ghosts of Saltmarsh', 'adventure'),
]);

export const SOURCE_IDS = Object.freeze(SOURCES.map((x) => x.id));
export const GROUP_LABELS = Object.freeze({
  core: ['Base', 'Core'], supplement: ['Supplementi', 'Supplements'],
  setting: ['Ambientazioni', 'Settings'], adventure: ['Avventure', 'Adventures'],
});

/** @param {string} id */
export const getSource = (id) => SOURCES.find((x) => x.id === id) ?? null;

/** Valida un elenco di manuali attivi: solo sigle note, PHB sempre incluso. */
export function normalizeSources(raw) {
  const set = new Set([CORE_SOURCE]);
  if (Array.isArray(raw)) for (const id of raw) if (SOURCE_IDS.includes(id)) set.add(id);
  return set;
}

/** Un elemento è visibile se il suo manuale è attivo (senza `source` conta come PHB). */
export const isSourceEnabled = (item, enabled) => enabled.has(item?.source ?? CORE_SOURCE);
