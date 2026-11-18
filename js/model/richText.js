/**
 * Mini-parser del Markdown usato nelle descrizioni (docs/*.md): paragrafi, elenchi puntati,
 * tabelle e **grassetto** / *corsivo* / ***entrambi***. Funzione pura (niente DOM): la vista
 * costruisce i nodi con `el()`, quindi il testo non passa mai da innerHTML.
 */

/** @typedef {{text: string, bold?: boolean, italic?: boolean}} Inline */
/** @typedef {{type: 'p', inline: Inline[]} | {type: 'ul', items: Inline[][]} | {type: 'table', head: Inline[][], rows: Inline[][][]}} Block */

const INLINE = /(\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|\*[^*]+\*)/;

/** @param {string} text @returns {Inline[]} */
export function parseInline(text) {
  return text.split(INLINE).filter(Boolean).map((part) => {
    if (part.startsWith('***') && part.endsWith('***') && part.length > 6) return { text: part.slice(3, -3), bold: true, italic: true };
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) return { text: part.slice(2, -2), bold: true };
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) return { text: part.slice(1, -1), italic: true };
    return { text: part };
  });
}

const cells = (line) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => parseInline(c.trim()));
const isSeparator = (line) => /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?$/.test(line.trim());

/** @param {string} text @returns {Block[]} */
export function parseRichText(text) {
  /** @type {Block[]} */
  const blocks = [];
  const lines = String(text ?? '').replace(/\r/g, '').split('\n');
  let paragraph = [];
  const flush = () => {
    if (paragraph.length) blocks.push({ type: 'p', inline: parseInline(paragraph.join(' ')) });
    paragraph = [];
  };
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.trim()) { flush(); continue; }
    if (line.trimStart().startsWith('|')) {
      flush();
      const rows = [];
      while (i < lines.length && lines[i].trimStart().startsWith('|')) { rows.push(lines[i]); i += 1; }
      i -= 1;
      const [head, ...rest] = rows;
      blocks.push({ type: 'table', head: cells(head), rows: rest.filter((r) => !isSeparator(r)).map(cells) });
    } else if (/^\s*[-*•] /.test(line)) {
      flush();
      const items = [];
      while (i < lines.length && /^\s*[-*•] /.test(lines[i])) { items.push(parseInline(lines[i].replace(/^\s*[-*•] /, ''))); i += 1; }
      i -= 1;
      blocks.push({ type: 'ul', items });
    } else {
      paragraph.push(line.trim());
    }
  }
  flush();
  return blocks;
}
