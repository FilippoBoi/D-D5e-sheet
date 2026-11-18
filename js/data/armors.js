/**
 * Tabella armature del Manuale del Giocatore (5E).
 *
 * La regola della Destrezza dipende solo dalla categoria:
 *  - none / light → mod. DES pieno
 *  - medium       → mod. DES fino a +2
 *  - heavy        → nessun mod. DES (neanche negativo)
 */
export const ARMOR_CATEGORIES = Object.freeze({
  none: 'Nessuna',
  light: 'Armatura leggera',
  medium: 'Armatura media',
  heavy: 'Armatura pesante',
});

export const ARMOR_CATEGORIES_EN = Object.freeze({
  none: 'None',
  light: 'Light armor',
  medium: 'Medium armor',
  heavy: 'Heavy armor',
});

export const SHIELD_AC_BONUS = 2;
export const MEDIUM_ARMOR_MAX_DEX = 2;

export const ARMORS = Object.freeze([
  { id: 'none', name: 'Senza armatura', nameEn: 'No armor', category: 'none', baseAC: 10, strReq: 0, stealthDisadvantage: false },
  // Leggere
  { id: 'padded', name: 'Imbottita', nameEn: 'Padded', category: 'light', baseAC: 11, strReq: 0, stealthDisadvantage: true },
  { id: 'leather', name: 'Cuoio', nameEn: 'Leather', category: 'light', baseAC: 11, strReq: 0, stealthDisadvantage: false },
  { id: 'studdedLeather', name: 'Cuoio borchiato', nameEn: 'Studded leather', category: 'light', baseAC: 12, strReq: 0, stealthDisadvantage: false },
  // Medie
  { id: 'hide', name: 'Pelle', nameEn: 'Hide', category: 'medium', baseAC: 12, strReq: 0, stealthDisadvantage: false },
  { id: 'chainShirt', name: 'Giaco di maglia', nameEn: 'Chain shirt', category: 'medium', baseAC: 13, strReq: 0, stealthDisadvantage: false },
  { id: 'scaleMail', name: 'Corazza di scaglie', nameEn: 'Scale mail', category: 'medium', baseAC: 14, strReq: 0, stealthDisadvantage: true },
  { id: 'breastplate', name: 'Corazza di piastre', nameEn: 'Breastplate', category: 'medium', baseAC: 14, strReq: 0, stealthDisadvantage: false },
  { id: 'halfPlate', name: 'Mezza armatura', nameEn: 'Half plate', category: 'medium', baseAC: 15, strReq: 0, stealthDisadvantage: true },
  // Pesanti
  { id: 'ringMail', name: 'Corazza ad anelli', nameEn: 'Ring mail', category: 'heavy', baseAC: 14, strReq: 0, stealthDisadvantage: true },
  { id: 'chainMail', name: 'Cotta di maglia', nameEn: 'Chain mail', category: 'heavy', baseAC: 16, strReq: 13, stealthDisadvantage: true },
  { id: 'splint', name: 'Corazza a strisce', nameEn: 'Splint', category: 'heavy', baseAC: 17, strReq: 15, stealthDisadvantage: true },
  { id: 'plate', name: 'Armatura completa', nameEn: 'Plate', category: 'heavy', baseAC: 18, strReq: 15, stealthDisadvantage: true },
]);

export const ARMOR_IDS = Object.freeze(ARMORS.map((a) => a.id));

/** @param {string} id */
export const getArmor = (id) => ARMORS.find((a) => a.id === id) ?? ARMORS[0];
