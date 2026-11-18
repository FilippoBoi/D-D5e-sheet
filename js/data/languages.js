/**
 * Lingue del gioco e lettura dei testi di riepilogo di razze e background
 * ("Comune, Elfico, una lingua a scelta").
 *
 * - `special`: lingue concesse solo da una classe (non si scelgono dai menu)
 */
export const LANGUAGES = Object.freeze([
  { id: 'common', name: 'Comune', nameEn: 'Common' },
  { id: 'dwarvish', name: 'Nanico', nameEn: 'Dwarvish' },
  { id: 'elvish', name: 'Elfico', nameEn: 'Elvish' },
  { id: 'giant', name: 'Gigante', nameEn: 'Giant' },
  { id: 'gnomish', name: 'Gnomico', nameEn: 'Gnomish' },
  { id: 'goblin', name: 'Goblin', nameEn: 'Goblin' },
  { id: 'halfling', name: 'Halfling', nameEn: 'Halfling' },
  { id: 'orc', name: 'Orchesco', nameEn: 'Orc' },
  { id: 'abyssal', name: 'Abissale', nameEn: 'Abyssal' },
  { id: 'celestial', name: 'Celestiale', nameEn: 'Celestial' },
  { id: 'draconic', name: 'Draconico', nameEn: 'Draconic' },
  { id: 'deepSpeech', name: 'Gergo delle Profondità', nameEn: 'Deep Speech' },
  { id: 'infernal', name: 'Infernale', nameEn: 'Infernal' },
  { id: 'primordial', name: 'Primordiale', nameEn: 'Primordial' },
  { id: 'sylvan', name: 'Silvano', nameEn: 'Sylvan' },
  { id: 'undercommon', name: 'Sottocomune', nameEn: 'Undercommon' },
  { id: 'auran', name: 'Aurano', nameEn: 'Auran' },
  { id: 'aquan', name: 'Aquano', nameEn: 'Aquan' },
  { id: 'ignan', name: 'Ignano', nameEn: 'Ignan' },
  { id: 'terran', name: 'Terrano', nameEn: 'Terran' },
  { id: 'druidic', name: 'Druidico', nameEn: 'Druidic', special: true },
  { id: 'thievesCant', name: 'Gergo dei ladri', nameEn: "Thieves' Cant", special: true },
]);

export const LANGUAGE_IDS = Object.freeze(LANGUAGES.filter((l) => !l.special).map((l) => l.id));
export const MAX_LANGUAGE_PICKS = 4;

/** Lingue che una classe concede automaticamente. */
export const CLASS_LANGUAGES = Object.freeze({ druid: 'druidic', rogue: 'thievesCant' });

const BY_NAME = new Map(LANGUAGES.map((l) => [l.name.toLowerCase(), l.id]));
const WORD_COUNT = { una: 1, un: 1, uno: 1, due: 2, tre: 3, quattro: 4 };

/**
 * Legge il testo italiano delle lingue di razza o background.
 * @param {string} text
 * @returns {{ ids: string[], custom: string[], choices: number }}
 *   ids = lingue note, custom = nomi non in elenco, choices = quante lingue a scelta
 */
export function parseLanguageText(text) {
  const out = { ids: [], custom: [], choices: 0 };
  for (const token of String(text ?? '').split(',').map((t) => t.trim()).filter(Boolean)) {
    const id = BY_NAME.get(token.toLowerCase());
    if (id) { out.ids.push(id); continue; }
    if (/scelta/i.test(token)) {
      const first = token.split(/\s+/)[0].toLowerCase();
      out.choices += WORD_COUNT[first] ?? (Number.parseInt(first, 10) || 1);
    } else out.custom.push(token);
  }
  return out;
}
