import 'package:flutter/services.dart';
import 'package:material_ui/material_ui.dart';

import '../i18n.dart';
import '../model/character_model.dart';
import '../model/utils.dart';
import 'theme.dart';

/// Titoletto di sezione dentro un pannello.
class Subhead extends StatelessWidget {
  const Subhead(this.text, {super.key, this.trailing});
  final String text;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(top: 16, bottom: 6),
        child: Row(children: [
          Expanded(child: Text(text.toUpperCase(), style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, letterSpacing: 1, color: context.colors.muted))),
          ?trailing,
        ]),
      );
}

/// Pannello comprimibile come le sezioni della scheda web (si ricorda aperto/chiuso).
class Panel extends StatelessWidget {
  const Panel({super.key, required this.id, required this.title, required this.open, required this.onToggle, required this.children});
  final String id;
  final String title;
  final bool open;
  final ValueChanged<bool> onToggle;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Card(
      child: Theme(
        data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
        child: ExpansionTile(
          initiallyExpanded: open,
          onExpansionChanged: onToggle,
          shape: const Border(),
          collapsedShape: const Border(),
          title: Text(title, style: displayStyle(context, size: 18)),
          iconColor: c.accentStrong,
          collapsedIconColor: c.accentStrong,
          childrenPadding: const EdgeInsets.fromLTRB(14, 0, 14, 16),
          expandedCrossAxisAlignment: CrossAxisAlignment.start,
          children: children,
        ),
      ),
    );
  }
}

/// Valore grande con etichetta (CA, bonus competenza…).
class StatBox extends StatelessWidget {
  const StatBox({super.key, required this.label, required this.value, this.hint, this.big = false});
  final String label;
  final String value;
  final String? hint;
  final bool big;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(color: c.cardRaised, borderRadius: BorderRadius.circular(8), border: Border.all(color: c.border)),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Text(label, style: TextStyle(fontSize: 12, color: c.muted), textAlign: TextAlign.center),
        const SizedBox(height: 2),
        Text(value, style: TextStyle(fontSize: big ? 32 : 22, fontWeight: FontWeight.w800, color: c.accentStrong)),
        if (hint != null && hint!.isNotEmpty) Text(hint!, style: TextStyle(fontSize: 11, color: c.muted), textAlign: TextAlign.center),
      ]),
    );
  }
}

/// Dispone i figli in colonne che si adattano alla larghezza (come `.grid` della versione web).
class ResponsiveWrap extends StatelessWidget {
  const ResponsiveWrap({super.key, required this.children, this.minWidth = 220, this.spacing = 12});
  final List<Widget> children;
  final double minWidth;
  final double spacing;

  @override
  Widget build(BuildContext context) => LayoutBuilder(builder: (context, box) {
        final cols = (box.maxWidth / (minWidth + spacing)).floor().clamp(1, 6);
        final width = (box.maxWidth - spacing * (cols - 1)) / cols;
        return Wrap(spacing: spacing, runSpacing: spacing, children: [for (final c in children) SizedBox(width: width, child: c)]);
      });
}

/// Campo di testo o numerico legato a un percorso dello stato (come `data-bind`).
/// Mostra il valore del modello e lo riallinea (validato) quando perde il fuoco.
class BoundField extends StatefulWidget {
  const BoundField({super.key, required this.model, required this.path, required this.label, this.number = false, this.decimal = false, this.lines = 1, this.hint, this.maxLength});
  final CharacterModel model;
  final String path;
  final String label;
  final bool number;
  final bool decimal;
  final int lines;
  final String? hint;
  final int? maxLength;

  @override
  State<BoundField> createState() => _BoundFieldState();
}

class _BoundFieldState extends State<BoundField> {
  late final TextEditingController _controller = TextEditingController(text: _modelText());
  final FocusNode _focus = FocusNode();

  String _modelText() {
    final v = getByPath(widget.model.state, widget.path);
    return v is num ? numStr(v) : (v?.toString() ?? '');
  }

  @override
  void initState() {
    super.initState();
    widget.model.addListener(_sync);
    _focus.addListener(() {
      if (!_focus.hasFocus) _sync(force: true);
    });
  }

  void _sync({bool force = false}) {
    if (!mounted) return;
    final text = _modelText();
    if (_controller.text == text) return;
    if (_focus.hasFocus && !force) return; // non muovere il cursore mentre si scrive
    _controller.value = TextEditingValue(text: text, selection: TextSelection.collapsed(offset: text.length));
  }

  @override
  void didUpdateWidget(BoundField old) {
    super.didUpdateWidget(old);
    if (old.path != widget.path) _sync(force: true);
  }

  @override
  void dispose() {
    widget.model.removeListener(_sync);
    _controller.dispose();
    _focus.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => TextField(
        controller: _controller,
        focusNode: _focus,
        minLines: widget.lines,
        maxLines: widget.lines == 1 ? 1 : widget.lines + 4,
        maxLength: widget.maxLength,
        keyboardType: widget.number
            ? TextInputType.numberWithOptions(decimal: widget.decimal, signed: true)
            : (widget.lines > 1 ? TextInputType.multiline : TextInputType.text),
        inputFormatters: widget.number ? [FilteringTextInputFormatter.allow(RegExp(r'[0-9,.\-]'))] : null,
        decoration: InputDecoration(labelText: widget.label, hintText: widget.hint, alignLabelWithHint: widget.lines > 1, counterText: ''),
        onChanged: (text) => widget.model.set(widget.path, text),
      );
}

/// Menu a tendina con etichetta; `options` sono {value, label}.
class SelectField extends StatelessWidget {
  const SelectField({super.key, required this.label, required this.value, required this.options, required this.onChanged, this.emptyLabel = '—'});
  final String label;
  final String value;
  final List<Json> options;
  final ValueChanged<String> onChanged;
  final String emptyLabel;

  @override
  Widget build(BuildContext context) {
    final values = {for (final o in options) o['value'] as String};
    final hasEmpty = values.contains('');
    final current = values.contains(value) ? value : (hasEmpty ? '' : null);
    return DropdownButtonFormField<String>(
      key: ValueKey('$label/$current/${options.length}'),
      initialValue: current ?? (value.isEmpty ? '' : value),
      isExpanded: true,
      decoration: InputDecoration(labelText: label),
      items: [
        if (!hasEmpty) DropdownMenuItem(value: '', child: Text(emptyLabel)),
        for (final o in options) DropdownMenuItem(value: o['value'] as String, child: Text(o['label'] as String, overflow: TextOverflow.ellipsis)),
      ],
      onChanged: (v) => onChanged(v ?? ''),
    );
  }
}

/// Riga con casella e testo.
class CheckRow extends StatelessWidget {
  const CheckRow({super.key, required this.value, required this.onChanged, required this.label, this.subtitle, this.enabled = true});
  final bool value;
  final ValueChanged<bool>? onChanged;
  final String label;
  final String? subtitle;
  final bool enabled;

  @override
  Widget build(BuildContext context) => CheckboxListTile(
        value: value,
        onChanged: enabled && onChanged != null ? (v) => onChanged!(v ?? false) : null,
        title: Text(label),
        subtitle: subtitle == null || subtitle!.isEmpty ? null : Text(subtitle!, style: TextStyle(fontSize: 12, color: context.colors.muted)),
        dense: true,
        controlAffinity: ListTileControlAffinity.leading,
        contentPadding: EdgeInsets.zero,
      );
}

/// Pallini da segnare (slot incantesimo, usi di una risorsa): toccare l'ultimo pallino pieno lo libera.
class Pips extends StatelessWidget {
  const Pips({super.key, required this.max, required this.used, required this.onChanged, required this.semanticLabel});
  final int max;
  final int used;
  final ValueChanged<int> onChanged;
  final String semanticLabel;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Wrap(spacing: 4, children: [
      for (var i = 0; i < max; i++)
        Semantics(
          button: true, selected: i < used, label: '$semanticLabel ${i + 1}',
          child: InkResponse(
            onTap: () => onChanged(i < used && i == used - 1 ? i : i + 1),
            radius: 22,
            child: Padding(
              padding: const EdgeInsets.all(8),
              child: Container(
                width: 20, height: 20,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: i < used ? c.vermilion : Colors.transparent,
                  border: Border.all(color: i < used ? c.vermilion : c.borderStrong, width: 2),
                ),
              ),
            ),
          ),
        ),
    ]);
  }
}

class Tag extends StatelessWidget {
  const Tag(this.text, {super.key, this.tooltip, this.green = false, this.muted = false});
  final String text;
  final String? tooltip;
  final bool green;
  final bool muted;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final color = green ? c.emerald : (muted ? c.muted : c.accentStrong);
    final chip = Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
      decoration: BoxDecoration(borderRadius: BorderRadius.circular(99), border: Border.all(color: muted ? c.borderStrong : color)),
      child: Text(text, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: color)),
    );
    return tooltip == null ? chip : Tooltip(message: tooltip!, child: chip);
  }
}
