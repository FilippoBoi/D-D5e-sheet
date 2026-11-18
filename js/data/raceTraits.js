/**
 * Tratti razziali del Manuale del Giocatore: descrizione sintetica ed effetti automatici.
 *
 * Ogni tratto della libreria può avere:
 *   - resist: tipi di danno a cui dà resistenza
 *   - hp: PF extra per livello (Robustezza dei Nani delle Colline)
 *   - prof: competenze { armor, weapons, tools } come coppie [italiano, inglese]
 *   - uses: (ctx) => [{ id, max, recharge, detail? }] usi limitati con riposo breve o lungo
 *
 * Le razze degli altri manuali hanno solo i nomi dei tratti e il rimando alla pagina del manuale
 * (non se ne copia il testo): si ricavano dal campo `traits` dei dati generati.
 * Le descrizioni sono riassunti scritti a mano.
 */
import { getRace } from './races.js';
import { byLevel } from './classResources.js';
import { pick } from '../i18n/i18n.js';

const DAMAGE = {
  acid: ['Acido', 'Acid'], cold: ['Freddo', 'Cold'], fire: ['Fuoco', 'Fire'],
  lightning: ['Fulmine', 'Lightning'], poison: ['Veleno', 'Poison'],
};
const dmg = (type) => (DAMAGE[type] ? pick(...DAMAGE[type]) : type);

const T = (it, en, di, de, extra = {}) => ({ it, en, di, de, ...extra });

/** Libreria dei tratti, per chiave. */
const TRAITS = {
  draconicAncestry: T('Ascendenza draconica', 'Draconic Ancestry',
    'Scegli un tipo di drago: determina il danno del Soffio e la resistenza.', 'Pick a dragon type: it sets your Breath Weapon damage and resistance.'),
  breathWeapon: T('Soffio distruttivo', 'Breath Weapon',
    'Azione: esala energia distruttiva; chi è nell\'area fa un TS su Destrezza o Costituzione (CD sotto), danni dimezzati se riesce.',
    'Action: exhale destructive energy; creatures in the area make a Dexterity or Constitution save (DC below), half damage on a success.',
    {
      uses: ({ level, profBonus, mods, option }) => [{
        id: 'breathWeapon', max: 1, recharge: 'short',
        detail: `${byLevel(level, [[1, 2], [6, 3], [11, 4], [16, 5]])}d6 ${option ? dmg(option) : '—'} · ${pick('CD', 'DC')} ${8 + profBonus + mods.con}`,
      }],
    }),
  damageResistance: T('Resistenza ai danni', 'Damage Resistance',
    'Resistenza al tipo di danno della tua ascendenza draconica.', 'Resistance to the damage type of your draconic ancestry.',
    { resist: ({ option }) => (option ? [option] : []) }),

  dwarvenResilience: T('Resilienza nanica', 'Dwarven Resilience',
    'Vantaggio ai TS contro il veleno e resistenza ai danni da veleno.', 'Advantage on saves against poison and resistance to poison damage.',
    { resist: () => ['poison'] }),
  dwarvenCombatTraining: T('Addestramento da guerra nanico', 'Dwarven Combat Training',
    'Competenza con ascia da battaglia, ascia, martello leggero e martello da guerra.', 'Proficiency with battleaxe, handaxe, light hammer and warhammer.',
    { prof: { weapons: [['ascia da battaglia, ascia, martello leggero, martello da guerra', 'battleaxe, handaxe, light hammer, warhammer']] } }),
  toolProficiency: T('Competenza negli strumenti', 'Tool Proficiency',
    'Competenza in uno strumento da artigiano a scelta (fabbro, birraio o muratore).', 'Proficiency with one artisan\'s tool of your choice (smith, brewer or mason).',
    { prof: { tools: ({ optionLabel }) => (optionLabel ? [[optionLabel, optionLabel]] : []) } }),
  stonecunning: T('Conoscenza della pietra', 'Stonecunning',
    'Nelle prove di Intelligenza (Storia) sull\'origine di opere in pietra sei competente e aggiungi il doppio della competenza.', 'On Intelligence (History) checks about stonework you are proficient and add double your proficiency bonus.'),
  dwarvenToughness: T('Robustezza nanica', 'Dwarven Toughness',
    '+1 PF massimi per ogni livello (già incluso nei PF suggeriti).', '+1 maximum HP per level (already included in the suggested HP).',
    { hp: 1 }),
  dwarvenArmorTraining: T('Addestramento con le armature nanico', 'Dwarven Armor Training',
    'Competenza con armature leggere e medie.', 'Proficiency with light and medium armor.',
    { prof: { armor: [['leggere, medie', 'light, medium']] } }),

  keenSenses: T('Sensi affinati', 'Keen Senses', 'Competenza in Percezione (già applicata).', 'Proficiency in Perception (already applied).'),
  feyAncestry: T('Ascendenza fatata', 'Fey Ancestry',
    'Vantaggio ai TS contro l\'essere affascinato; la magia non può farti addormentare.', 'Advantage on saves against being charmed; magic can\'t put you to sleep.'),
  trance: T('Trance', 'Trance', 'Meditazione di 4 ore al posto del sonno: vale un riposo lungo di 8 ore.', 'Meditate for 4 hours instead of sleeping: counts as an 8-hour long rest.'),
  elfWeaponTraining: T('Addestramento con le armi elfico', 'Elf Weapon Training',
    'Competenza con spada lunga, spada corta, arco corto e arco lungo.', 'Proficiency with longsword, shortsword, shortbow and longbow.',
    { prof: { weapons: [['spada lunga, spada corta, arco corto, arco lungo', 'longsword, shortsword, shortbow, longbow']] } }),
  highElfCantrip: T('Trucchetto', 'Cantrip', 'Conosci un trucchetto da mago a scelta (Intelligenza).', 'You know one wizard cantrip of your choice (Intelligence).'),
  extraLanguage: T('Lingua extra', 'Extra Language', 'Parli una lingua a tua scelta (vedi Linguaggi).', 'You speak one extra language of your choice (see Languages).'),
  fleetOfFoot: T('Piede veloce', 'Fleet of Foot', 'Velocità base 10,5 m (già applicata).', 'Base speed of 35 ft (already applied).'),
  maskOfTheWild: T('Maschera della natura', 'Mask of the Wild',
    'Puoi nasconderti anche quando sei solo leggermente oscurato da fenomeni naturali.', 'You can hide when only lightly obscured by natural phenomena.'),
  superiorDarkvision: T('Scurovisione superiore', 'Superior Darkvision', 'Scurovisione 36 m (già applicata).', 'Darkvision 120 ft (already applied).'),
  sunlightSensitivity: T('Sensibilità alla luce solare', 'Sunlight Sensitivity',
    'Svantaggio a tiri per colpire e prove di Percezione basate sulla vista in piena luce solare.', 'Disadvantage on attack rolls and sight-based Perception checks in direct sunlight.'),
  drowMagic: T('Magia dei Drow', 'Drow Magic',
    'Trucchetto Luci danzanti; dal 3° livello Fuoco fatato e dal 5° Oscurità, una volta ciascuno per riposo lungo (Carisma).',
    'Dancing Lights cantrip; Faerie Fire at 3rd level and Darkness at 5th, once each per long rest (Charisma).',
    {
      uses: ({ level }) => [
        ...(level >= 3 ? [{ id: 'drowFaerieFire', max: 1, recharge: 'long', detail: pick('Fuoco fatato', 'Faerie Fire') }] : []),
        ...(level >= 5 ? [{ id: 'drowDarkness', max: 1, recharge: 'long', detail: pick('Oscurità', 'Darkness') }] : []),
      ],
    }),
  drowWeaponTraining: T('Addestramento con le armi dei Drow', 'Drow Weapon Training',
    'Competenza con stocco, spada corta e balestra a mano.', 'Proficiency with rapier, shortsword and hand crossbow.',
    { prof: { weapons: [['stocco, spada corta, balestra a mano', 'rapier, shortsword, hand crossbow']] } }),

  gnomeCunning: T('Astuzia gnomesca', 'Gnome Cunning',
    'Vantaggio ai TS su Intelligenza, Saggezza e Carisma contro la magia.', 'Advantage on Intelligence, Wisdom and Charisma saves against magic.'),
  naturalIllusionist: T('Illusionista naturale', 'Natural Illusionist', 'Conosci il trucchetto Illusione minore (Intelligenza).', 'You know the Minor Illusion cantrip (Intelligence).'),
  speakWithSmallBeasts: T('Parlare con le piccole bestie', 'Speak with Small Beasts', 'Comunichi concetti semplici con bestie Piccole o più piccole.', 'You can communicate simple ideas with Small or smaller beasts.'),
  artificersLore: T('Sapienza dell\'artefice', 'Artificer\'s Lore', 'Doppia competenza nelle prove di Intelligenza (Storia) su oggetti magici, alchemici o tecnologici.', 'Double proficiency on Intelligence (History) checks about magic, alchemical or technological items.'),
  tinker: T('Armeggiare', 'Tinker', 'Con strumenti da artigiano costruisci piccoli congegni (giocattolo, accendino, carillon).', 'With artisan\'s tools you can build tiny clockwork devices (toy, fire starter, music box).',
    { prof: { tools: [['attrezzi da artigiano (congegni)', 'artisan\'s tools (clockwork)']] } }),

  lucky: T('Fortunato', 'Lucky', 'Quando ottieni 1 naturale su un d20 (attacco, prova o TS) puoi ritirare il dado e usare il nuovo risultato.', 'When you roll a natural 1 on a d20 (attack, check or save) you can reroll it and must use the new roll.'),
  brave: T('Coraggioso', 'Brave', 'Vantaggio ai TS contro l\'essere spaventato.', 'Advantage on saves against being frightened.'),
  halflingNimbleness: T('Agilità halfling', 'Halfling Nimbleness', 'Puoi muoverti attraverso lo spazio di creature più grandi di te.', 'You can move through the space of any creature larger than you.'),
  naturallyStealthy: T('Furtività naturale', 'Naturally Stealthy', 'Puoi nasconderti dietro una creatura almeno una taglia più grande di te.', 'You can hide behind a creature at least one size larger than you.'),
  stoutResilience: T('Resilienza dei Tozzi', 'Stout Resilience', 'Vantaggio ai TS contro il veleno e resistenza ai danni da veleno.', 'Advantage on saves against poison and resistance to poison damage.',
    { resist: () => ['poison'] }),

  skillVersatility: T('Versatilità nelle abilità', 'Skill Versatility', 'Competenza in due abilità a tua scelta (già nei menu della razza).', 'Proficiency in two skills of your choice (see the race menus).'),
  menacing: T('Minaccioso', 'Menacing', 'Competenza in Intimidire (già applicata).', 'Proficiency in Intimidation (already applied).'),
  relentlessEndurance: T('Resistenza implacabile', 'Relentless Endurance',
    'Se scendi a 0 PF ma non muori sul colpo, scendi invece a 1 PF. Una volta per riposo lungo.', 'When reduced to 0 HP but not killed outright, you drop to 1 HP instead. Once per long rest.',
    { uses: () => [{ id: 'relentlessEndurance', max: 1, recharge: 'long' }] }),
  savageAttacks: T('Attacchi selvaggi', 'Savage Attacks', 'Con un colpo critico in mischia tiri un dado di danno dell\'arma in più.', 'On a melee critical hit, roll one additional weapon damage die.'),
  versatility: T('Versatilità', 'Versatility', '+1 a tutte le caratteristiche e una lingua a scelta.', '+1 to all abilities and one language of your choice.'),
  variantHuman: T('Abilità e talento', 'Skills and Feat', 'Una competenza in abilità e un talento a tua scelta (annotalo nelle note).', 'One skill proficiency and one feat of your choice (note it in your notes).'),
  hellishResistance: T('Resistenza infernale', 'Hellish Resistance', 'Resistenza ai danni da fuoco.', 'Resistance to fire damage.', { resist: () => ['fire'] }),
  infernalLegacy: T('Eredità infernale', 'Infernal Legacy',
    'Trucchetto Taumaturgia; dal 3° livello Punizione infernale e dal 5° Oscurità, una volta ciascuno per riposo lungo (Carisma).',
    'Thaumaturgy cantrip; Hellish Rebuke at 3rd level and Darkness at 5th, once each per long rest (Charisma).',
    {
      uses: ({ level }) => [
        ...(level >= 3 ? [{ id: 'tieflingRebuke', max: 1, recharge: 'long', detail: pick('Punizione infernale', 'Hellish Rebuke') }] : []),
        ...(level >= 5 ? [{ id: 'tieflingDarkness', max: 1, recharge: 'long', detail: pick('Oscurità', 'Darkness') }] : []),
      ],
    }),
};

/** Chiavi dei tratti per razza del PHB (id di data/races.js e di generated/races.js). */
const RACE_TRAITS = {
  dragonborn: ['draconicAncestry', 'breathWeapon', 'damageResistance'],
  dwarf: ['dwarvenResilience', 'dwarvenCombatTraining', 'toolProficiency', 'stonecunning'],
  'phb-dwarf-hill': ['dwarvenResilience', 'dwarvenCombatTraining', 'toolProficiency', 'stonecunning', 'dwarvenToughness'],
  'phb-dwarf-mountain': ['dwarvenResilience', 'dwarvenCombatTraining', 'toolProficiency', 'stonecunning', 'dwarvenArmorTraining'],
  elf: ['keenSenses', 'feyAncestry', 'trance', 'elfWeaponTraining'],
  'phb-elf-high': ['keenSenses', 'feyAncestry', 'trance', 'elfWeaponTraining', 'highElfCantrip', 'extraLanguage'],
  'phb-elf-wood': ['keenSenses', 'feyAncestry', 'trance', 'elfWeaponTraining', 'fleetOfFoot', 'maskOfTheWild'],
  'phb-elf-drow': ['keenSenses', 'feyAncestry', 'trance', 'superiorDarkvision', 'sunlightSensitivity', 'drowMagic', 'drowWeaponTraining'],
  gnome: ['gnomeCunning'],
  'phb-gnome-forest': ['gnomeCunning', 'naturalIllusionist', 'speakWithSmallBeasts'],
  'phb-gnome-rock': ['gnomeCunning', 'artificersLore', 'tinker'],
  halfElf: ['feyAncestry', 'skillVersatility'],
  halfOrc: ['menacing', 'relentlessEndurance', 'savageAttacks'],
  halfling: ['lucky', 'brave', 'halflingNimbleness'],
  'phb-halfling-lightfoot': ['lucky', 'brave', 'halflingNimbleness', 'naturallyStealthy'],
  'phb-halfling-stout': ['lucky', 'brave', 'halflingNimbleness', 'stoutResilience'],
  human: ['versatility'],
  'phb-human-variant': ['variantHuman', 'extraLanguage'],
  tiefling: ['hellishResistance', 'infernalLegacy'],
};

/** Tutti gli id degli usi limitati che i tratti possono concedere (per lo stato di default). */
export const RACE_RESOURCE_IDS = Object.freeze([
  'breathWeapon', 'relentlessEndurance', 'drowFaerieFire', 'drowDarkness', 'tieflingRebuke', 'tieflingDarkness',
]);

const rechargeText = { short: ['riposo breve', 'short rest'], long: ['riposo lungo', 'long rest'] };

/**
 * @param {string} raceId
 * @param {{ level: number, profBonus: number, mods: Record<string, number>, option?: string, optionLabel?: string }} ctx
 *   option = scelta singola della razza (es. tipo di drago), optionLabel = la sua etichetta
 */
export function resolveRaceTraits(raceId, ctx) {
  const race = getRace(raceId);
  const empty = { traits: [], uses: [], hpPerLevel: 0, resistances: [], proficiencies: { armor: [], weapons: [], tools: [] } };
  if (!race) return empty;

  const keys = RACE_TRAITS[raceId];
  if (!keys) {
    // Razze degli altri manuali: solo i nomi, con il rimando al manuale.
    const names = (race.traitsEn ?? race.traits ?? '').split(',').map((n) => n.trim()).filter(Boolean);
    const ref = race.page ? `${race.source}, p. ${race.page}` : race.source;
    return { ...empty, traits: names.map((name) => ({ name, description: pick(`Vedi ${ref}.`, `See ${ref}.`), tag: '' })) };
  }

  const out = { ...empty, proficiencies: { armor: [], weapons: [], tools: [] } };
  const resist = new Set();
  for (const key of keys) {
    const t = TRAITS[key];
    const uses = t.uses?.(ctx) ?? [];
    for (const r of t.resist?.(ctx) ?? []) resist.add(r);
    out.hpPerLevel += t.hp ?? 0;
    for (const [kind, value] of Object.entries(t.prof ?? {})) {
      const list = typeof value === 'function' ? value(ctx) : value;
      for (const [it, en] of list) out.proficiencies[kind].push(pick(it, en));
    }
    const name = pick(t.it, t.en);
    for (const u of uses) out.uses.push({ ...u, label: name });
    const first = uses[0];
    out.traits.push({
      name,
      description: pick(t.di, t.de),
      tag: first && uses.length === 1 ? `1 / ${pick(...rechargeText[first.recharge])}` : '',
    });
  }
  out.resistances = [...resist].map(dmg);
  return out;
}
