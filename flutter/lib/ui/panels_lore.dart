/// Pannelli di privilegi, risorse e lingue.
library;

import 'package:material_ui/material_ui.dart';

import '../app_controller.dart';
import '../i18n.dart';
import 'theme.dart';
import 'widgets.dart';

const _maxPips = 20;

class FeaturesPanel extends StatelessWidget {
  const FeaturesPanel({super.key, required this.app});
  final AppController app;

  Widget _feature(BuildContext context, String badge, String name, String? tag, String desc) {
    final c = context.colors;
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Container(
          width: 56, padding: const EdgeInsets.symmetric(vertical: 2), alignment: Alignment.center,
          decoration: BoxDecoration(color: c.accentSoft, borderRadius: BorderRadius.circular(6)),
          child: Text(badge, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: c.accentStrong)),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Wrap(spacing: 8, crossAxisAlignment: WrapCrossAlignment.center, children: [
              Text(name, style: const TextStyle(fontWeight: FontWeight.w700)),
              if (tag != null && tag.isNotEmpty) Tag(tag),
            ]),
            Text(desc, style: TextStyle(color: c.muted, fontSize: 13)),
          ]),
        ),
      ]),
    );
  }

  @override
  Widget build(BuildContext context) {
    final model = app.model;
    final d = model.derived;
    final c = context.colors;
    final usables = (d['usables'] as List).cast<Json>();
    final infoResources = (d['infoResources'] as List).cast<Json>();
    final recharge = {'short': pick('Riposo breve', 'Short rest'), 'long': pick('Riposo lungo', 'Long rest')};

    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      if (usables.isNotEmpty) ...[
        Subhead(tr('Abilità a usi limitati')),
        ResponsiveWrap(minWidth: 240, children: [
          for (final u in usables)
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(color: c.cardRaised, borderRadius: BorderRadius.circular(8), border: Border.all(color: c.border)),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Wrap(alignment: WrapAlignment.spaceBetween, crossAxisAlignment: WrapCrossAlignment.center, spacing: 8, children: [
                  Text(u['label'] as String, style: const TextStyle(fontWeight: FontWeight.w700)),
                  Tag(recharge[u['recharge']]!, green: u['recharge'] == 'long'),
                ]),
                Row(children: [
                  if ((u['max'] as int) > _maxPips)
                    SizedBox(width: 110, child: BoundField(model: model, path: u['path'] as String, label: pick('Usati', 'Used'), number: true))
                  else
                    Flexible(
                      child: Pips(
                        max: u['max'] as int, used: u['used'] as int, semanticLabel: '${u['label']}: ${pick('uso speso', 'use spent')}',
                        onChanged: (v) => model.set(u['path'] as String, v),
                      ),
                    ),
                  const SizedBox(width: 8),
                  Text(u['remaining'] as String, style: TextStyle(color: c.muted, fontSize: 12)),
                ]),
                if ((u['detail'] as String).isNotEmpty) Text(u['detail'] as String, style: TextStyle(fontSize: 12, color: c.muted)),
              ]),
            ),
        ]),
      ],
      if (infoResources.isNotEmpty) ...[
        Subhead(tr('Risorse di classe')),
        ResponsiveWrap(minWidth: 160, children: [for (final r in infoResources) StatBox(label: r['label'] as String, value: r['value'] as String)]),
      ],
      Subhead(d['featuresTitle'] as String),
      for (final f in (d['features'] as List).cast<Json>())
        _feature(context, pick('Liv. ${f['level']}', 'Lv. ${f['level']}'), f['name'] as String, f['tag'] as String?, f['description'] as String),
      if (d['hasRaceTraits'] == true) ...[
        Subhead(tr('Tratti razziali')),
        for (final t in (d['raceTraits'] as List).cast<Json>()) _feature(context, pick('Razza', 'Race'), t['name'] as String, t['tag'] as String?, t['description'] as String),
      ],
      const SizedBox(height: 12),
      ResponsiveWrap(minWidth: 280, children: [
        BoundField(model: model, path: 'notes.traits', label: tr('Talenti & altri tratti'), lines: 4, hint: tr('Talenti, tratti di mostruosità, doni…')),
        BoundField(model: model, path: 'notes.backstory', label: tr('Storia & personalità'), lines: 4),
      ]),
    ]);
  }
}

class LanguagesPanel extends StatelessWidget {
  const LanguagesPanel({super.key, required this.app});
  final AppController app;

  @override
  Widget build(BuildContext context) {
    final model = app.model;
    final c = context.colors;
    final li = model.derived['languageInfo'] as Json;
    final slots = (li['slots'] as List).cast<Json>();
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text.rich(TextSpan(children: [TextSpan(text: '${tr('Lingue conosciute:')} ', style: const TextStyle(fontWeight: FontWeight.w700)), TextSpan(text: li['known'] as String)])),
      const SizedBox(height: 6),
      Text(tr('Le lingue di razza, background e classe si aggiungono da sole. Scegli qui sotto quelle a scelta e scrivi le altre apprese durante il gioco.'), style: TextStyle(color: c.muted, fontSize: 12)),
      if (slots.isNotEmpty) ...[
        const SizedBox(height: 12),
        ResponsiveWrap(minWidth: 220, children: [
          for (final (i, slot) in slots.indexed)
            Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              SelectField(
                label: '${pick('Lingua a scelta', 'Language of your choice')} ${i + 1}', value: slot['value'] as String,
                options: [{'value': '', 'label': '—'}, ...(slot['options'] as List).cast<Json>()],
                onChanged: (v) => model.set('languages.${slot['key']}', v),
              ),
              if (slot['duplicate'] == true)
                Padding(padding: const EdgeInsets.only(top: 4), child: Text(pick("Già conosciuta: scegline un'altra.", 'Already known: pick another.'), style: TextStyle(fontSize: 12, color: c.vermilion))),
            ]),
        ]),
      ],
      const SizedBox(height: 12),
      BoundField(model: model, path: 'languages.other', label: tr('Altre lingue (separate da virgola)'), hint: tr('Es. Linguaggio dei segni, Cant dei ladri…'), maxLength: 200),
    ]);
  }
}
