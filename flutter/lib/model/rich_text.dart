/// Mini-parser del Markdown delle descrizioni (porting di js/model/richText.js): paragrafi, elenchi,
/// tabelle e **grassetto** / *corsivo* / ***entrambi***. Funzione pura: la UI costruisce i widget.
library;

class Inline {
  const Inline(this.text, {this.bold = false, this.italic = false});
  final String text;
  final bool bold;
  final bool italic;
}

sealed class Block {
  const Block();
}

class Paragraph extends Block {
  const Paragraph(this.inline);
  final List<Inline> inline;
}

class Bullets extends Block {
  const Bullets(this.items);
  final List<List<Inline>> items;
}

class Table extends Block {
  const Table(this.head, this.rows);
  final List<List<Inline>> head;
  final List<List<List<Inline>>> rows;
}

final _inline = RegExp(r'(\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|\*[^*]+\*)');

List<Inline> parseInline(String text) {
  final out = <Inline>[];
  var last = 0;
  for (final m in _inline.allMatches(text)) {
    if (m.start > last) out.add(Inline(text.substring(last, m.start)));
    final part = m[0]!;
    if (part.startsWith('***')) {
      out.add(Inline(part.substring(3, part.length - 3), bold: true, italic: true));
    } else if (part.startsWith('**')) {
      out.add(Inline(part.substring(2, part.length - 2), bold: true));
    } else {
      out.add(Inline(part.substring(1, part.length - 1), italic: true));
    }
    last = m.end;
  }
  if (last < text.length) out.add(Inline(text.substring(last)));
  return out;
}

List<List<Inline>> _cells(String line) {
  var t = line.trim();
  if (t.startsWith('|')) t = t.substring(1);
  if (t.endsWith('|')) t = t.substring(0, t.length - 1);
  return [for (final c in t.split('|')) parseInline(c.trim())];
}

bool _isSeparator(String line) => RegExp(r'^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?$').hasMatch(line.trim());
final _bullet = RegExp(r'^\s*[-*•] ');

List<Block> parseRichText(String? text) {
  final blocks = <Block>[];
  final lines = (text ?? '').replaceAll('\r', '').split('\n');
  var paragraph = <String>[];
  void flush() {
    if (paragraph.isNotEmpty) blocks.add(Paragraph(parseInline(paragraph.join(' '))));
    paragraph = [];
  }

  var i = 0;
  while (i < lines.length) {
    final line = lines[i];
    if (line.trim().isEmpty) {
      flush();
      i++;
    } else if (line.trimLeft().startsWith('|')) {
      flush();
      final rows = <String>[];
      while (i < lines.length && lines[i].trimLeft().startsWith('|')) {
        rows.add(lines[i]);
        i++;
      }
      blocks.add(Table(_cells(rows.first), [for (final r in rows.skip(1)) if (!_isSeparator(r)) _cells(r)]));
    } else if (_bullet.hasMatch(line)) {
      flush();
      final items = <List<Inline>>[];
      while (i < lines.length && _bullet.hasMatch(lines[i])) {
        items.add(parseInline(lines[i].replaceFirst(_bullet, '')));
        i++;
      }
      blocks.add(Bullets(items));
    } else {
      paragraph.add(line.trim());
      i++;
    }
  }
  flush();
  return blocks;
}
