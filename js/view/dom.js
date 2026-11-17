/**
 * Piccolo helper per creare elementi DOM in modo sicuro.
 * Il testo passa sempre da textContent: niente innerHTML, niente XSS.
 *
 * @param {string} tag
 * @param {Record<string, any>} [props] attributi; chiavi speciali: class, text, dataset
 * @param {Array<Node|string|null|false> | Node | string} [children]
 * @returns {HTMLElement}
 */
export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value == null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else node.setAttribute(key, value === true ? '' : String(value));
  }
  for (const child of [].concat(children)) {
    if (child == null || child === false) continue;
    node.append(child instanceof Node ? child : String(child));
  }
  return node;
}

/**
 * Legge il valore "naturale" di un controllo di form.
 * @param {HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement} input
 */
export function readInputValue(input) {
  return input.type === 'checkbox' ? input.checked : input.value;
}

/**
 * Scrive un valore in un controllo solo se diverso, per non muovere il cursore.
 * @param {HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement} input
 * @param {unknown} value
 */
export function writeInputValue(input, value) {
  if (value === undefined) return;
  if (input.type === 'checkbox') {
    input.checked = Boolean(value);
  } else if (input.value !== String(value)) {
    input.value = String(value);
  }
}
