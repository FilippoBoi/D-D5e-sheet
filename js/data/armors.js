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

export const SHIELD_AC_BONUS = 2;
export const MEDIUM_ARMOR_MAX_DEX = 2;

export const ARMORS = Object.freeze([
  { id: 'none', name: 'Senza armatura', category: 'none', baseAC: 10, strReq: 0, stealthDisadvantage: false },
  // Leggere
  { id: 'padded', name: 'Imbottita', category: 'light', baseAC: 11, strReq: 0, stealthDisadvantage: true },
  { id: 'leather', name: 'Cuoio', category: 'light', baseAC: 11, strReq: 0, stealthDisadvantage: false },
  { id: 'studdedLeather', name: 'Cuoio borchiato', category: 'light', baseAC: 12, strReq: 0, stealthDisadvantage: false },
  // Medie
  { id: 'hide', name: 'Pelle', category: 'medium', baseAC: 12, strReq: 0, stealthDisadvantage: false },
  { id: 'chainShirt', name: 'Giaco di maglia', category: 'medium', baseAC: 13, strReq: 0, stealthDisadvantage: false },
  { id: 'scaleMail', name: 'Corazza di scaglie', category: 'medium', baseAC: 14, strReq: 0, stealthDisadvantage: true },
  { id: 'breastplate', name: 'Corazza di piastre', category: 'medium', baseAC: 14, strReq: 0, stealthDisadvantage: false },
  { id: 'halfPlate', name: 'Mezza armatura', category: 'medium', baseAC: 15, strReq: 0, stealthDisadvantage: true },
  // Pesanti
  { id: 'ringMail', name: 'Corazza ad anelli', category: 'heavy', baseAC: 14, strReq: 0, stealthDisadvantage: true },
  { id: 'chainMail', name: 'Cotta di maglia', category: 'heavy', baseAC: 16, strReq: 13, stealthDisadvantage: true },
  { id: 'splint', name: 'Corazza a strisce', category: 'heavy', baseAC: 17, strReq: 15, stealthDisadvantage: true },
  { id: 'plate', name: 'Armatura completa', category: 'heavy', baseAC: 18, strReq: 15, stealthDisadvantage: true },
]);

export const ARMOR_IDS = Object.freeze(ARMORS.map((a) => a.id));

/** @param {string} id */
export const getArmor = (id) => ARMORS.find((a) => a.id === id) ?? ARMORS[0];
