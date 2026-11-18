/// Finestre con la descrizione di abilità, trucchetti e incantesimi, nella lingua dell'interfaccia
/// (con ripiego sull'italiano). Si aprono dal pulsante «i» accanto a ogni voce.
library;

import 'package:material_ui/material_ui.dart';

import '../app_controller.dart';
import '../data/catalog.dart';
import '../i18n.dart';
import '../model/rich_text.dart' as rt;
import '../model/spell_text.dart';
import 'theme.dart';

/// Lingua in cui mostrare una voce: quella dell'interfaccia, altrimenti l'italiano.
String textLang(Json? entry) => (entry?[lang] is String && (entry![lang] as String).isNotEmpty) ? lang : defaultLang;

InlineSpan _span(rt.Inline i, TextStyle base) => TextSpan(
      text: i.text,
      style: base.copyWith(fontWeight: i.bold ? FontWeight.w700 : null, fontStyle: i.italic ? FontStyle.italic : null),
    );

/// Costruisce i widget per un testo Markdown (paragrafi, elenchi, tabelle).
List<Widget> richTextWidgets(BuildContext context, String? text) {
  final base = Theme.of(context).textTheme.bodyMedium!.copyWith(height: 1.5);
  final c = context.colors;
  return [
    for (final block in rt.parseRichText(text))
      switch (block) {
        rt.Paragraph(:final inline) => Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: SelectableText.rich(TextSpan(children: [for (final i in inline) _span(i, base)])),
          ),
        rt.Bullets(:final items) => Padding(
            padding: const EdgeInsets.only(bottom: 10, left: 4),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              for (final item in items)
                Padding(
                  padding: const EdgeInsets.only(bottom: 4),
                  child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('•  ', style: base),
                    Expanded(child: SelectableText.rich(TextSpan(children: [for (final i in item) _span(i, base)]))),
                  ]),
                ),
            ]),
          ),
        rt.Table(:final head, :final rows) => Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: DataTable(
                headingRowHeight: 36, dataRowMinHeight: 32, dataRowMaxHeight: double.infinity, columnSpacing: 18, horizontalMargin: 8,
                border: TableBorder(horizontalInside: BorderSide(color: c.border)),
                columns: [for (final h in head) DataColumn(label: Text.rich(TextSpan(children: [for (final i in h) _span(i, base.copyWith(color: c.muted, fontWeight: FontWeight.w700))])))],
                rows: [
                  for (final r in rows)
                    DataRow(cells: [
                      for (var i = 0; i < head.length; i++)
                        DataCell(ConstrainedBox(
                          constraints: const BoxConstraints(maxWidth: 360),
                          child: Text.rich(TextSpan(children: [for (final x in (i < r.length ? r[i] : const <rt.Inline>[])) _span(x, base)])),
                        )),
                    ]),
                ],
              ),
            ),
          ),
      },
  ];
}

class _InfoDialog extends StatelessWidget {
  const _InfoDialog({required this.title, this.alt, this.subtitle, required this.facts, required this.entry, required this.where});
  final String title;
  final String? alt;
  final String? subtitle;
  final List<(String, String)> Function(Json? data) facts;
  final Future<Json?> entry;
  final String where;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final narrow = MediaQuery.sizeOf(context).width < 600;
    return Dialog(
      insetPadding: narrow ? EdgeInsets.zero : const EdgeInsets.symmetric(horizontal: 24, vertical: 24),
      shape: narrow ? const RoundedRectangleBorder() : null,
      child: ConstrainedBox(
        constraints: BoxConstraints(maxWidth: narrow ? double.infinity : 640, maxHeight: narrow ? double.infinity : 720),
        child: SafeArea(
          child: FutureBuilder<Json?>(
            future: entry,
            builder: (context, snap) {
              final done = snap.connectionState == ConnectionState.done;
              final data = snap.data;
              return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 12, 4, 0),
                  child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(title, style: displayStyle(context, size: 21)),
                        if (alt != null && alt != title) Text(alt!, style: TextStyle(color: c.muted, fontSize: 13)),
                      ]),
                    ),
                    IconButton(tooltip: pick('Chiudi', 'Close'), icon: const Icon(Icons.close), onPressed: () => Navigator.pop(context)),
                  ]),
                ),
                if (subtitle != null)
                  Padding(padding: const EdgeInsets.fromLTRB(16, 4, 16, 8), child: Text(subtitle!, style: TextStyle(color: c.accentStrong, fontWeight: FontWeight.w600))),
                Expanded(
                  child: ListView(padding: const EdgeInsets.fromLTRB(16, 0, 16, 12), children: [
                    _Facts(facts(data)),
                    if (!done) const Padding(padding: EdgeInsets.all(16), child: Center(child: CircularProgressIndicator()))
                    else if (snap.hasError)
                      Text(pick('Impossibile caricare la descrizione. Riprova.', 'Could not load the description. Try again.'), style: TextStyle(color: c.vermilion))
                    else if (data == null)
                      Text(pick('Nessuna descrizione disponibile.', 'No description available.'))
                    else
                      ...richTextWidgets(context, data[textLang(data)] as String?),
                  ]),
                ),
                if (done && data != null) Padding(padding: const EdgeInsets.fromLTRB(16, 0, 16, 4), child: _Notice(data, where)),
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
                  child: Align(alignment: Alignment.centerRight, child: FilledButton(onPressed: () => Navigator.pop(context), child: Text(pick('Chiudi', 'Close')))),
                ),
              ]);
            },
          ),
        ),
      ),
    );
  }
}

class _Facts extends StatelessWidget {
  const _Facts(this.facts);
  final List<(String, String)> facts;

  @override
  Widget build(BuildContext context) {
    if (facts.isEmpty) return const SizedBox.shrink();
    final c = context.colors;
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(color: c.cardRaised, borderRadius: BorderRadius.circular(6)),
      child: Column(children: [
        for (final (k, v) in facts)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 2),
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              SizedBox(width: 110, child: Text(k, style: TextStyle(color: c.muted, fontWeight: FontWeight.w600, fontSize: 13))),
              Expanded(child: Text(v, style: const TextStyle(fontSize: 13))),
            ]),
          ),
      ]),
    );
  }
}

class _Notice extends StatelessWidget {
  const _Notice(this.data, this.where);
  final Json data;
  final String where;

  @override
  Widget build(BuildContext context) {
    final style = TextStyle(fontSize: 11, color: context.colors.muted);
    return Text(
      data['sum'] == 1
          ? pick('Riassunto originale della meccanica: per il testo ufficiale vedi $where.', 'Original summary of the mechanics: see $where for the official wording.')
          : pick('Testo dell’SRD 5.1 © Wizards of the Coast, CC BY 4.0. Traduzione italiana non ufficiale.', 'Text from the SRD 5.1 © Wizards of the Coast, CC BY 4.0. Italian translation is unofficial.'),
      style: style,
    );
  }
}

void showSkillDescription(BuildContext context, String id) {
  final cat = Catalog.instance;
  final skill = cat.getSkill(id);
  if (skill == null) return;
  final text = cat.skillText[id] as Json?;
  final ability = cat.getAbility(skill['ability'] as String);
  final page = text?['page'];
  showDialog<void>(
    context: context,
    builder: (_) => _InfoDialog(
      title: loc(skill),
      alt: loc(skill) == skill['nameEn'] ? skill['name'] as String : skill['nameEn'] as String,
      subtitle: '${pick('Prova di', 'Check:')} ${ability != null ? loc(ability) : skill['ability']}',
      facts: (_) => [if (page != null) (pick('Manuale', 'Source'), 'PHB, p. $page')],
      entry: Future.value(text),
      where: page != null ? 'PHB, p. $page' : 'PHB',
    ),
  );
}

void showSpellDescription(BuildContext context, AppController app, String id) {
  final spell = Catalog.instance.getSpell(id);
  if (spell == null) return;
  final school = schoolName(spell['school'] as String);
  final level = spell['level'] as int;
  showDialog<void>(
    context: context,
    builder: (_) => _InfoDialog(
      title: loc(spell),
      alt: loc(spell) == spell['nameEn'] ? spell['name'] as String : spell['nameEn'] as String,
      subtitle: level == 0 ? '${pick('Trucchetto', 'Cantrip')} · $school' : '${levelLabel(level)} ${pick('livello', 'level')} · $school',
      facts: (data) {
        final comps = (spell['comp'] as String).split('').join(', ');
        final duration = durationText(spell['dur'] as String);
        final i = lang == 'en' ? 1 : 0;
        return [
          (pick('Tempo di lancio', 'Casting time'), (data?['time'] as List?)?[i] as String? ?? castTimeText(spell['time'] as String)),
          (pick('Gittata', 'Range'), rangeText(spell['range'] as String)),
          (pick('Componenti', 'Components'), data?['mat'] != null ? '${comps.isEmpty ? '—' : comps} ${data!['mat']}' : (comps.isEmpty ? '—' : comps)),
          (pick('Durata', 'Duration'), spell['conc'] == true ? '${pick('Concentrazione', 'Concentration')}, $duration' : duration),
          (pick('Manuale', 'Source'), sourceText(spell)),
        ];
      },
      entry: app.spellText(id),
      where: sourceText(spell),
    ),
  );
}

/// Il pulsante «i» che apre la descrizione.
class InfoButton extends StatelessWidget {
  const InfoButton({super.key, required this.name, required this.onPressed});
  final String name;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) => IconButton(
        tooltip: '${pick('Descrizione', 'Description')}: $name',
        onPressed: onPressed,
        icon: Icon(Icons.info_outline, size: 20, color: context.colors.accentStrong),
        visualDensity: VisualDensity.compact,
      );
}
