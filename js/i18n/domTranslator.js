/**
 * Traduce l'HTML statico della pagina senza modificarlo.
 *
 * Il markup resta in italiano (lingua di base, utile anche senza JavaScript).
 * Il traduttore cerca ogni frammento di testo e certi attributi nel dizionario
 * inglese (chiave = testo italiano con spazi normalizzati) e ricorda l'originale
 * per poter tornare all'italiano.
 *
 * Restano esclusi i nodi riempiti dall'app (data-out, liste dinamiche, pallini):
 * quelli sono già generati nella lingua corrente.
 */
import { getLang, lookup } from './i18n.js';

const TRANSLATED_ATTRIBUTES = ['placeholder', 'aria-label', 'title', 'data-label'];
const SKIP = 'script, style, noscript, [data-no-i18n], [data-out], [data-list], [data-pips], output';

/** Originale italiano di ogni nodo di testo / attributo già visto. */
const originalText = new WeakMap();
const originalAttrs = new WeakMap();

const normalize = (text) => text.replace(/\s+/g, ' ').trim();

/** Mantiene gli spazi di bordo del testo originale, sostituendo solo il contenuto. */
function translateText(original) {
  const key = normalize(original);
  if (!key) return original;
  const translated = getLang() === 'it' ? undefined : lookup(key);
  if (translated === undefined) return original;
  const lead = original.match(/^\s*/)[0];
  const trail = original.match(/\s*$/)[0];
  return `${lead}${translated}${trail}`;
}

/**
 * @param {ParentNode} root
 */
export function translateTree(root) {
  const doc = root.ownerDocument ?? root;
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => (node.nodeType === Node.ELEMENT_NODE && node.matches(SKIP)
      ? NodeFilter.FILTER_REJECT
      : NodeFilter.FILTER_ACCEPT),
  });

  let node = walker.nextNode();
  while (node) {
    if (node.nodeType === Node.TEXT_NODE) {
      if (!originalText.has(node)) originalText.set(node, node.nodeValue);
      const next = translateText(originalText.get(node));
      if (node.nodeValue !== next) node.nodeValue = next;
    } else {
      translateAttributes(node);
    }
    node = walker.nextNode();
  }
}

function translateAttributes(element) {
  for (const attr of TRANSLATED_ATTRIBUTES) {
    if (!element.hasAttribute(attr)) continue;
    let store = originalAttrs.get(element);
    if (!store) originalAttrs.set(element, (store = {}));
    if (!(attr in store)) store[attr] = element.getAttribute(attr);
    const next = translateText(store[attr]);
    if (element.getAttribute(attr) !== next) element.setAttribute(attr, next);
  }
}

/** Traduce un singolo testo (titolo pagina, meta description...). */
export function translateString(original) {
  return translateText(original);
}
