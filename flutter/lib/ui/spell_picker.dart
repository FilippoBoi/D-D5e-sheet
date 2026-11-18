/// Popup per scegliere trucchetti o incantesimi: ricerca, filtri e un tocco per aggiungere o togliere
/// (porting di CharacterView.openSpellPicker). Le modifiche si applicano subito: non c'è un «Salva».
library;

import 'package:material_ui/material_ui.dart';

import '../app_controller.dart';
import '../i18n.dart';
import 'descriptions.dart';
import 'theme.dart';
import 'widgets.dart';

String _norm(String s) {
  const a = {'à': 'a', 'á': 'a', 'â': 'a', 'è': 'e', 'é': 'e', 'ê': 'e', 'ì': 'i', 'í': 'i', 'î': 'i', 'ò': 'o', 'ó': 'o', 'ô': 'o', 'ù': 'u', 'ú': 'u', 'û': 'u'};
  return s.toLowerCase().split('').map((c) => a[c] ?? c).join();
}

String spellCountText(Json info) {
  final limit = info['limit'] as int;
  final base = limit > 0 ? '${info['count']}/$limit' : '${info['count']}';
  final over = info['over'] as int;
  return over > 0 ? '$base · ${pick('$over in più', '$over over')}' : base;
}

Future<void> showSpellPicker(BuildContext context, AppController app, String kind) => showDialog<void>(
      context: context,
      builder: (_) => _SpellPicker(app: app, kind: kind),
    );

class _SpellPicker extends StatefulWidget {
  const _SpellPicker({required this.app, required this.kind});
  final AppController app;
  final String kind;

  @override
  State<_SpellPicker> createState() => _SpellPickerState();
}

class _SpellPickerState extends State<_SpellPicker> {
  String _query = '';
  Object? _level; // null = tutti, int = livello, 'above' = oltre gli slot
  bool _conc = false, _ritual = false, _chosen = false, _others = false;
  late final List<Json> _options = widget.app.model.getSpellOptions(widget.kind);
  late final List<String> _search = [for (final o in _options) _norm('${o['name']} ${o['altName']}')];

  bool get _isCantrips => widget.kind == 'cantrips';

  @override
  void initState() {
    super.initState();
    widget.app.model.addListener(_refresh);
  }

  void _refresh() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    widget.app.model.removeListener(_refresh);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final model = widget.app.model;
    final sc = model.derived['spellcasting'] as Json;
    final info = sc[widget.kind] as Json;
    final chosenIds = {for (final s in (info['selected'] as List).cast<Json>()) s['id'] as String};
    final maxLevel = sc['maxLevel'] as int;
    final c = context.colors;
    final narrow = MediaQuery.sizeOf(context).width < 700;

    final visible = <Json>[];
    for (var i = 0; i < _options.length; i++) {
      final o = _options[i];
      final tags = (o['tags'] as List).cast<Json>();
      final chosen = chosenIds.contains(o['id']);
      var ok = (_query.isEmpty || _search[i].contains(_query)) &&
          (!_conc || tags.any((t) => t['id'] == 'conc')) &&
          (!_ritual || tags.any((t) => t['id'] == 'ritual')) &&
          (!_chosen || chosen);
      final level = o['level'] as int;
      if (ok && !_isCantrips) {
        if (_level is int) {
          ok = level == _level;
        } else if (_level == 'above') {
          ok = level > maxLevel;
        } else {
          ok = chosen || level <= maxLevel;
        }
      }
      if (ok && !chosen && o['own'] != true && !_others) ok = false;
      if (ok) visible.add(o);
    }

    final limit = info['limit'] as int;
    final hint = [
      '${pick('Lista', 'List')}: ${sc['listClassName']}',
      if (limit > 0) '· ${_isCantrips ? pick('Trucchetti conosciuti', 'Cantrips known') : sc['spellsTitle']}: $limit',
    ].join(' ');

    Widget chip(String label, bool selected, VoidCallback onTap, {String? tooltip}) => Tooltip(
          message: tooltip ?? '',
          child: FilterChip(label: Text(label), selected: selected, onSelected: (_) => onTap(), visualDensity: VisualDensity.compact),
        );

    return Dialog(
      insetPadding: narrow ? EdgeInsets.zero : const EdgeInsets.all(24),
      shape: narrow ? const RoundedRectangleBorder() : null,
      child: ConstrainedBox(
        constraints: BoxConstraints(maxWidth: narrow ? double.infinity : 760, maxHeight: narrow ? double.infinity : 760),
        child: SafeArea(
          child: Column(children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 10, 4, 0),
              child: Row(children: [
                Expanded(child: Text(_isCantrips ? pick('Scegli i trucchetti', 'Choose cantrips') : pick('Scegli gli incantesimi', 'Choose spells'), style: displayStyle(context, size: 20))),
                Text(spellCountText(info), style: TextStyle(fontWeight: FontWeight.w700, color: info['status'] == 'over' ? c.vermilion : c.accentStrong)),
                IconButton(tooltip: pick('Chiudi', 'Close'), icon: const Icon(Icons.close), onPressed: () => Navigator.pop(context)),
              ]),
            ),
            Padding(padding: const EdgeInsets.fromLTRB(16, 0, 16, 6), child: Align(alignment: Alignment.centerLeft, child: Text(hint, style: TextStyle(color: c.muted, fontSize: 12)))),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: TextField(
                autofocus: !narrow,
                decoration: InputDecoration(prefixIcon: const Icon(Icons.search), hintText: pick('Cerca per nome (italiano o inglese)…', 'Search by name (Italian or English)…')),
                onChanged: (v) => setState(() => _query = _norm(v.trim())),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
              child: Align(
                alignment: Alignment.centerLeft,
                child: Wrap(spacing: 6, runSpacing: 0, children: [
                  if (!_isCantrips) ...[
                    chip(pick('Tutti', 'All'), _level == null, () => setState(() => _level = null)),
                    for (var l = 1; l <= maxLevel; l++) chip(pick('$l°', '$l'), _level == l, () => setState(() => _level = l)),
                    if (maxLevel < 9)
                      chip(pick('Oltre', 'Higher'), _level == 'above', () => setState(() => _level = 'above'),
                          tooltip: pick('Incantesimi di livello superiore ai tuoi slot', 'Spells above your highest slot level')),
                  ],
                  chip(pick('Scelti', 'Chosen'), _chosen, () => setState(() => _chosen = !_chosen), tooltip: pick('Mostra solo quelli già scelti', 'Show only the ones already chosen')),
                  if (!_isCantrips) chip(pick('Rituali', 'Rituals'), _ritual, () => setState(() => _ritual = !_ritual), tooltip: pick('Solo rituali', 'Rituals only')),
                  chip(pick('Concentrazione', 'Concentration'), _conc, () => setState(() => _conc = !_conc), tooltip: pick('Solo incantesimi a concentrazione', 'Concentration spells only')),
                  chip(pick('Altre classi', 'Other classes'), _others, () => setState(() => _others = !_others),
                      tooltip: pick('Mostra anche quelli fuori dalla lista: ${sc['listClassName']}', 'Also show spells outside the ${sc['listClassName']} list')),
                ]),
              ),
            ),
            const Divider(height: 12),
            Expanded(
              child: visible.isEmpty
                  ? Center(
                      child: Padding(
                        padding: const EdgeInsets.all(24),
                        child: Text(
                          _chosen
                              ? pick('Non hai ancora scelto nulla.', 'You have not chosen anything yet.')
                              : pick('Nessun risultato. Prova a togliere un filtro o attiva «Altre classi».', 'No results. Try removing a filter or turn on “Other classes”.'),
                          textAlign: TextAlign.center,
                        ),
                      ),
                    )
                  : ListView.builder(
                      itemCount: visible.length,
                      itemBuilder: (context, i) => _SpellRow(
                        o: visible[i],
                        selected: chosenIds.contains(visible[i]['id']),
                        showLevel: !_isCantrips,
                        onToggle: () => model.toggleSpell(widget.kind, visible[i]['id'] as String),
                        onInfo: () => showSpellDescription(context, widget.app, visible[i]['id'] as String),
                      ),
                    ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 10),
              child: Row(children: [
                Text(pick('${visible.length} ${visible.length == 1 ? 'risultato' : 'risultati'}', '${visible.length} ${visible.length == 1 ? 'result' : 'results'}'), style: TextStyle(color: c.muted, fontSize: 12)),
                const Spacer(),
                FilledButton(onPressed: () => Navigator.pop(context), child: Text(pick('Fatto', 'Done'))),
              ]),
            ),
          ]),
        ),
      ),
    );
  }
}

class _SpellRow extends StatelessWidget {
  const _SpellRow({required this.o, required this.selected, required this.showLevel, required this.onToggle, required this.onInfo});
  final Json o;
  final bool selected;
  final bool showLevel;
  final VoidCallback onToggle;
  final VoidCallback onInfo;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final tags = (o['tags'] as List).cast<Json>();
    final altName = o['altName'] as String;
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 2),
      decoration: BoxDecoration(
        color: selected ? c.accentSoft : c.cardRaised,
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: selected ? c.accent : c.border),
      ),
      child: Row(children: [
        Expanded(
          child: InkWell(
            borderRadius: BorderRadius.circular(6),
            onTap: onToggle,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
              child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Icon(selected ? Icons.check_box : Icons.check_box_outline_blank, color: selected ? c.accent : c.borderStrong),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Wrap(spacing: 6, crossAxisAlignment: WrapCrossAlignment.center, children: [
                      Text(o['name'] as String, style: const TextStyle(fontWeight: FontWeight.w600)),
                      if (altName.isNotEmpty && altName != o['name']) Text(altName, style: TextStyle(fontSize: 12, color: c.muted)),
                      for (final t in tags) Tag(t['label'] as String, tooltip: t['title'] as String, green: t['id'] == 'ritual'),
                      if (o['own'] != true) Tag(pick('Altra classe', 'Other class'), muted: true),
                    ]),
                    Text('${o['school']} · ${o['meta']} · ${o['sourceText']}', style: TextStyle(fontSize: 12, color: c.muted)),
                  ]),
                ),
                if (showLevel) Padding(padding: const EdgeInsets.only(left: 6), child: Text(o['levelLabel'] as String, style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: c.accentStrong))),
              ]),
            ),
          ),
        ),
        InfoButton(name: o['name'] as String, onPressed: onInfo),
      ]),
    );
  }
}
