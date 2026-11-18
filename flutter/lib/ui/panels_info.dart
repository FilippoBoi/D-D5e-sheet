import 'package:material_ui/material_ui.dart';

import '../app_controller.dart';
import '../data/catalog.dart';
import '../i18n.dart';
import '../model/class_choices.dart';
import '../model/utils.dart';
import 'theme.dart';
import 'widgets.dart';

/// Elenco etichetta/valore (come i `<dl>` della versione web).
class DefList extends StatelessWidget {
  const DefList(this.rows, {super.key});
  final List<(String, String)> rows;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final shown = rows.where((r) => r.$2.isNotEmpty).toList();
    return Column(children: [
      for (final (k, v) in shown)
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 2),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            SizedBox(width: 128, child: Text(k, style: TextStyle(color: c.muted, fontSize: 13, fontWeight: FontWeight.w600))),
            Expanded(child: Text(v, style: const TextStyle(fontSize: 13))),
          ]),
        ),
    ]);
  }
}

class OriginBox extends StatelessWidget {
  const OriginBox({super.key, required this.title, required this.children});
  final String title;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Container(
      margin: const EdgeInsets.only(top: 12),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: c.cardRaised, borderRadius: BorderRadius.circular(8), border: Border.all(color: c.border)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(title, style: const TextStyle(fontWeight: FontWeight.w700)),
        const SizedBox(height: 6),
        ...children,
      ]),
    );
  }
}

List<Json> _items(Iterable<Json> list, {bool Function(Json)? where}) => [
      for (final x in list)
        if (where == null || where(x)) {'value': x['id'], 'label': loc(x)},
    ];

class InfoPanel extends StatelessWidget {
  const InfoPanel({super.key, required this.app});
  final AppController app;

  @override
  Widget build(BuildContext context) {
    final model = app.model;
    final cat = Catalog.instance;
    final d = model.derived;
    final info = model.state['info'] as Json;
    final enabled = model.sources;
    final raceId = info['raceId'] as String;
    final bgId = info['backgroundId'] as String;
    bool visible(Json x, String current) => enabled.contains(x['source'] ?? 'PHB') || x['id'] == current;
    final race = d['race'] as Json?;
    final bg = d['background'] as Json;
    final cls = d['classInfo'] as Json;

    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      _SourcesBox(app: app),
      const SizedBox(height: 12),
      ResponsiveWrap(minWidth: 240, children: [
        BoundField(model: model, path: 'info.name', label: tr('Nome personaggio'), hint: tr('Es. Thalia Corvoscuro')),
        BoundField(model: model, path: 'info.player', label: tr('Giocatore')),
        SelectField(
          label: tr('Razza'), value: raceId, emptyLabel: '—',
          options: [{'value': '', 'label': '—'}, ..._items(cat.races, where: (r) => visible(r, raceId))],
          onChanged: (v) => model.set('info.raceId', v),
        ),
        SelectField(
          label: tr('Background'), value: bgId,
          options: [{'value': '', 'label': '—'}, ..._items(cat.backgrounds, where: (b) => visible(b, bgId))],
          onChanged: (v) => model.set('info.backgroundId', v),
        ),
        if (bgId.isEmpty) BoundField(model: model, path: 'info.background', label: tr('Background personalizzato'), hint: tr('Es. Accolito')),
        SelectField(
          label: tr('Allineamento'), value: info['alignment'] as String,
          options: [{'value': '', 'label': '—'}, for (final a in cat.alignments) {'value': a['name'], 'label': loc(a)}],
          onChanged: (v) => model.set('info.alignment', v),
        ),
        SelectField(
          label: tr('Classe'), value: info['classId'] as String,
          options: _items(cat.classList), onChanged: (v) => model.set('info.classId', v),
        ),
      ]),
      if (race != null)
        OriginBox(title: '${race['name']} · ${d['className']}', children: [
          DefList([
            (tr('Bonus razziali'), race['bonuses'] as String),
            (tr('Lingue'), race['languages'] as String),
            (tr('Scurovisione'), race['darkvision'] as String),
            (tr('Tratti'), race['traits'] as String),
            (tr('Resistenze'), race['resistances'] as String),
            (tr('Competenze razziali'), race['proficiencies'] as String),
          ]),
          if ((race['choices'] as List).isNotEmpty) ...[
            const SizedBox(height: 10),
            ResponsiveWrap(minWidth: 200, children: [
              for (final ch in (race['choices'] as List).cast<Json>())
                SelectField(
                  label: ch['label'] as String, value: ch['value'] as String, options: (ch['options'] as List).cast<Json>(),
                  onChanged: (v) => model.set('info.raceChoices.${ch['key']}', v),
                ),
            ]),
          ],
        ]),
      OriginBox(title: '${d['className']}', children: [
        DefList([
          (tr('Armature'), cls['armor'] as String),
          (tr('Armi'), cls['weapons'] as String),
          (tr('Strumenti'), cls['tools'] as String),
          (tr('Abilità di classe'), cls['skillChoice'] as String),
        ]),
      ]),
      if (!(bg['isCustom'] as bool))
        OriginBox(title: '${bg['name']} · ${bg['feature']}', children: [
          DefList([
            (tr('Competenze in abilità'), bg['skills'] as String),
            (tr('Strumenti'), bg['tools'] as String),
            (tr('Lingue'), bg['languages'] as String),
            (tr('Equipaggiamento'), bg['equipment'] as String),
          ]),
        ]),
      const SizedBox(height: 12),
      ResponsiveWrap(minWidth: 150, children: [
        BoundField(model: model, path: 'info.level', label: tr('Livello'), number: true),
        StatBox(label: tr('Bonus competenza'), value: formatModifier(d['profBonus'] as int)),
        StatBox(label: tr('Dado vita'), value: d['hitDie'] as String),
      ]),
      if (d['hasClassChoices'] == true) ...[
        Subhead(tr('Scelte di classe')),
        ClassChoices(app: app),
      ],
    ]);
  }
}

class _SourcesBox extends StatelessWidget {
  const _SourcesBox({required this.app});
  final AppController app;

  @override
  Widget build(BuildContext context) {
    final cat = Catalog.instance;
    final enabled = app.model.sources;
    final groups = cat.sourceGroupLabels;
    return Theme(
      data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
      child: ExpansionTile(
        tilePadding: EdgeInsets.zero,
        title: Text(tr('Manuali'), style: const TextStyle(fontWeight: FontWeight.w600)),
        subtitle: Text('${enabled.length}/${cat.sources.length}', style: TextStyle(color: context.colors.muted, fontSize: 12)),
        childrenPadding: EdgeInsets.zero,
        expandedCrossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(tr('Il Manuale del Giocatore è sempre attivo. Attiva gli altri per trovare razze, background e sottoclassi nei menu. Ciò che hai già scelto resta sempre visibile.'),
              style: TextStyle(color: context.colors.muted, fontSize: 12)),
          for (final group in groups.keys) ...[
            Subhead(pick((groups[group] as List)[0] as String, (groups[group] as List)[1] as String)),
            Wrap(spacing: 8, runSpacing: 0, children: [
              for (final s in cat.sources.where((s) => s['group'] == group))
                FilterChip(
                  label: Text(loc(s)),
                  selected: enabled.contains(s['id']),
                  onSelected: s['id'] == Catalog.coreSource ? null : (_) => app.model.toggleSource(s['id'] as String),
                ),
            ]),
          ],
        ],
      ),
    );
  }
}

/// Scelte di classe: menu per le scelte singole, elenchi con caselle per quelle multiple, campi di testo.
class ClassChoices extends StatelessWidget {
  const ClassChoices({super.key, required this.app});
  final AppController app;

  @override
  Widget build(BuildContext context) {
    final groups = (app.model.derived['classChoices'] as List).cast<Json>();
    return Column(children: [
      for (final g in groups)
        Padding(padding: const EdgeInsets.only(bottom: 12), child: _ChoiceGroup(app: app, g: g, key: ValueKey('choice-${g['key']}'))),
    ]);
  }
}

class _ChoiceGroup extends StatefulWidget {
  const _ChoiceGroup({super.key, required this.app, required this.g});
  final AppController app;
  final Json g;

  @override
  State<_ChoiceGroup> createState() => _ChoiceGroupState();
}

class _ChoiceGroupState extends State<_ChoiceGroup> {
  String _query = '';
  late final TextEditingController _text = TextEditingController(text: widget.g['type'] == 'text' ? widget.g['value'] as String : '');

  @override
  void dispose() {
    _text.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final g = widget.g;
    final model = widget.app.model;
    final c = context.colors;
    final type = g['type'] as String;
    final key = g['key'] as String;
    final hint = g['hint'] as String;

    if (type == 'single') {
      final options = (g['options'] as List).cast<Json>();
      return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        SelectField(label: g['label'] as String, value: g['value'] as String, options: [{'value': '', 'label': '—'}, ...options], onChanged: (v) => model.set('info.classChoices.$key', v)),
        if (hint.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 4), child: Text(hint, style: TextStyle(fontSize: 12, color: c.muted))),
        if ((g['description'] as String).isNotEmpty) Padding(padding: const EdgeInsets.only(top: 4), child: Text(g['description'] as String, style: TextStyle(fontSize: 12, color: c.muted))),
      ]);
    }
    if (type == 'text') {
      return TextField(
        controller: _text,
        maxLength: maxChoiceText,
        decoration: InputDecoration(labelText: g['label'] as String, helperText: hint.isEmpty ? null : hint, counterText: ''),
        onChanged: (v) => model.set('info.classChoices.$key', v),
      );
    }

    final options = (g['options'] as List).cast<Json>();
    final searchable = g['searchable'] == true;
    final q = _query.toLowerCase();
    final shown = [for (final o in options) if (q.isEmpty || (o['label'] as String).toLowerCase().contains(q)) o];
    final extra = [
      for (final o in (g['overflow'] as List).cast<Json>()) {...o, 'why': pick('oltre il limite', 'over the limit')},
      for (final b in (g['blocked'] as List).cast<Json>()) {...b, 'why': b['reason']},
    ];
    String? lastGroup;
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: c.cardRaised, borderRadius: BorderRadius.circular(8), border: Border.all(color: c.border)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Expanded(child: Text(g['label'] as String, style: const TextStyle(fontWeight: FontWeight.w700))),
          Text('${g['selectedCount']}/${g['count']} ${pick('scelte', 'chosen')}', style: TextStyle(fontWeight: FontWeight.w700, color: c.accentStrong)),
        ]),
        if (hint.isNotEmpty) Text(hint, style: TextStyle(fontSize: 12, color: c.muted)),
        if (searchable)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: TextField(decoration: InputDecoration(prefixIcon: const Icon(Icons.search), hintText: pick('Cerca…', 'Search…')), onChanged: (v) => setState(() => _query = v)),
          ),
        for (final o in shown) ...[
          if ((o['group'] as String).isNotEmpty && o['group'] != lastGroup)
            Builder(builder: (_) {
              lastGroup = o['group'] as String;
              return Subhead(lastGroup!);
            }),
          CheckRow(
            value: o['selected'] == true, enabled: o['disabled'] != true || o['selected'] == true,
            onChanged: (_) => model.toggleChoice(key, o['value'] as String),
            label: o['label'] as String, subtitle: o['note'] as String?,
          ),
        ],
        if (extra.isNotEmpty) ...[
          const SizedBox(height: 6),
          Text('${pick('Memorizzati ma non contano', 'Stored but not counted')}:', style: TextStyle(fontSize: 12, color: c.muted)),
          Wrap(spacing: 6, children: [
            for (final x in extra)
              InputChip(
                label: Text('${x['label']} (${x['why']})'),
                onDeleted: () => model.toggleChoice(key, x['value'] as String),
                deleteButtonTooltipMessage: '${pick('Rimuovi', 'Remove')} ${x['label']}',
              ),
          ]),
        ],
      ]),
    );
  }
}
