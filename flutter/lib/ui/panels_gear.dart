/// Pannelli di equipaggiamento (armatura, oggetti CA, armi, monete) e incantesimi.
library;

import 'package:material_ui/material_ui.dart';

import '../app_controller.dart';
import '../data/catalog.dart';
import '../i18n.dart';
import '../model/utils.dart';
import 'descriptions.dart';
import 'spell_picker.dart';
import 'theme.dart';
import 'widgets.dart';

class EquipmentPanel extends StatelessWidget {
  const EquipmentPanel({super.key, required this.app});
  final AppController app;

  @override
  Widget build(BuildContext context) {
    final model = app.model;
    final cat = Catalog.instance;
    final d = model.derived;
    final c = context.colors;
    final eq = model.state['equipment'] as Json;
    final armor = d['armor'] as Json;
    final acItems = (eq['acItems'] as List).cast<Json>();
    final weapons = (model.state['weapons'] as List).cast<Json>();
    final weaponOut = (d['weapons'] as List).cast<Json>();
    final categories = lang == 'it' ? cat.armorCategories : cat.armorCategoriesEn;

    // Armature raggruppate per categoria, come gli <optgroup> della versione web.
    final armorOptions = <Json>[
      for (final entry in categories.entries)
        for (final a in cat.armors.where((a) => a['category'] == entry.key))
          {
            'value': a['id'],
            'label': entry.key == 'none' ? loc(a) : '${entry.value}: ${loc(a)} (${pick('CA', 'AC')} ${a['baseAC']})',
          },
    ];

    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Subhead(tr('Armatura')),
      ResponsiveWrap(minWidth: 220, children: [
        SelectField(label: tr('Armatura indossata'), value: eq['armorId'] as String, options: armorOptions, onChanged: (v) => model.set('equipment.armorId', v)),
        BoundField(model: model, path: 'equipment.magicBonus', label: tr('Bonus magico CA'), number: true),
        CheckboxListTile(
          value: eq['shield'] == true, onChanged: (v) => model.set('equipment.shield', v ?? false),
          title: Text('${tr('Scudo')} (+2 ${pick('CA', 'AC')})'), controlAffinity: ListTileControlAffinity.leading, contentPadding: EdgeInsets.zero,
        ),
      ]),
      Container(
        margin: const EdgeInsets.only(top: 10),
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(color: c.cardRaised, borderRadius: BorderRadius.circular(6)),
        child: Wrap(spacing: 24, runSpacing: 4, children: [
          Text.rich(TextSpan(children: [TextSpan(text: '${tr('Categoria')}  ', style: TextStyle(color: c.muted)), TextSpan(text: armor['category'] as String)])),
          Text.rich(TextSpan(children: [TextSpan(text: '${tr('Formula')}  ', style: TextStyle(color: c.muted)), TextSpan(text: armor['formula'] as String)])),
          Text.rich(TextSpan(children: [TextSpan(text: '${tr('CA totale')}  ', style: TextStyle(color: c.muted)), TextSpan(text: '${d['ac']}', style: TextStyle(fontWeight: FontWeight.w800, color: c.vermilion))])),
        ]),
      ),
      if (armor['strengthWarning'] == true)
        Padding(padding: const EdgeInsets.only(top: 8), child: Text(pick('Forza insufficiente (richiesta ${armor['strReq']}): la velocità si riduce di 3 metri.', 'Not enough Strength (${armor['strReq']} required): speed is reduced by 10 ft.'), style: TextStyle(color: c.vermilion))),
      if (armor['stealthDisadvantage'] == true)
        Padding(padding: const EdgeInsets.only(top: 8), child: Text(tr('Questa armatura impone svantaggio alle prove di Furtività.'), style: TextStyle(color: c.muted))),
      Subhead(tr('Oggetti che modificano la CA'), trailing: FilledButton.tonal(onPressed: model.addAcItem, child: Text(tr('+ Aggiungi oggetto')))),
      for (final item in acItems)
        Padding(
          key: ValueKey(item['id']),
          padding: const EdgeInsets.only(bottom: 8),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Expanded(child: BoundField(model: model, path: 'equipment.acItems.${acItems.indexOf(item)}.name', label: pick('Oggetto', 'Item'), hint: pick('Anello di protezione', 'Ring of protection'))),
            const SizedBox(width: 8),
            SizedBox(width: 100, child: BoundField(model: model, path: 'equipment.acItems.${acItems.indexOf(item)}.bonus', label: pick('Bonus CA', 'AC bonus'), number: true)),
            IconButton(tooltip: pick('Rimuovi oggetto', 'Remove item'), icon: Icon(Icons.close, color: c.vermilion), onPressed: () => model.removeAcItem(item['id'] as String)),
          ]),
        ),
      if (acItems.isEmpty) Text(tr('Anelli, mantelli, bracciali o altro che aumenta la CA. Il bonus si somma ad armatura e scudo.'), style: TextStyle(color: c.muted, fontSize: 12)),
      Subhead(tr('Armi & Attacchi'), trailing: FilledButton.tonal(onPressed: model.addWeapon, child: Text(tr('+ Aggiungi arma')))),
      for (final (i, w) in weapons.indexed)
        _WeaponRow(key: ValueKey(w['id']), app: app, index: i, weapon: w, out: weaponOut[i]),
      if (weapons.isEmpty) Text(tr('Nessuna arma. Usa “Aggiungi arma” per iniziare.'), style: TextStyle(color: c.muted, fontSize: 13)),
      Subhead(tr('Monete')),
      ResponsiveWrap(minWidth: 90, children: [
        for (final k in ['mr', 'ma', 'me', 'mo', 'mp'])
          BoundField(model: model, path: 'equipment.coins.$k', label: k.toUpperCase(), number: true),
      ]),
      const SizedBox(height: 12),
      BoundField(model: model, path: 'equipment.inventory', label: tr('Inventario'), lines: 5, hint: tr('Zaino, corda di canapa (15 m), razioni (5)…')),
    ]);
  }
}

class _WeaponRow extends StatelessWidget {
  const _WeaponRow({super.key, required this.app, required this.index, required this.weapon, required this.out});
  final AppController app;
  final int index;
  final Json weapon;
  final Json out;

  @override
  Widget build(BuildContext context) {
    final model = app.model;
    final c = context.colors;
    final p = 'weapons.$index';
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(color: c.cardRaised, borderRadius: BorderRadius.circular(8), border: Border.all(color: c.border)),
      child: Column(children: [
        ResponsiveWrap(minWidth: 150, spacing: 8, children: [
          BoundField(model: model, path: '$p.name', label: tr('Arma'), hint: tr('Spada lunga')),
          SelectField(
            label: tr('Caratt.'), value: weapon['ability'] as String,
            options: [{'value': 'str', 'label': pick('FOR', 'STR')}, {'value': 'dex', 'label': pick('DES', 'DEX')}],
            onChanged: (v) => model.set('$p.ability', v),
          ),
          BoundField(model: model, path: '$p.magicBonus', label: tr('Magia'), number: true),
          BoundField(model: model, path: '$p.damage', label: tr('Danni'), hint: '1d8'),
          BoundField(model: model, path: '$p.damageType', label: tr('Tipo'), hint: tr('Tagliente')),
        ]),
        Row(children: [
          Expanded(child: CheckRow(value: weapon['proficient'] == true, onChanged: (v) => model.set('$p.proficient', v), label: tr('Competente'))),
          Text('${tr('TpC')} ', style: TextStyle(color: c.muted, fontSize: 12)),
          Text(formatModifier(out['attack'] as int), style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18, color: c.accentStrong)),
          const SizedBox(width: 14),
          Text('${tr('Danni')} ', style: TextStyle(color: c.muted, fontSize: 12)),
          Text(out['damageLabel'] as String, style: TextStyle(fontWeight: FontWeight.w700, color: c.accentStrong)),
          IconButton(tooltip: tr('Rimuovi arma'), icon: Icon(Icons.close, color: c.vermilion), onPressed: () => model.removeWeapon(weapon['id'] as String)),
        ]),
      ]),
    );
  }
}

String _ordinal(int n) {
  final rest = n % 100;
  if (rest >= 11 && rest <= 13) return '${n}th';
  return '$n${{1: 'st', 2: 'nd', 3: 'rd'}[n % 10] ?? 'th'}';
}

class SpellsPanel extends StatelessWidget {
  const SpellsPanel({super.key, required this.app});
  final AppController app;

  @override
  Widget build(BuildContext context) {
    final model = app.model;
    final sc = model.derived['spellcasting'] as Json;
    final c = context.colors;
    final slots = (sc['slots'] as List).cast<Json>();

    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      ResponsiveWrap(minWidth: 170, children: [
        StatBox(label: tr('Caratteristica'), value: sc['abilityName'] as String),
        StatBox(label: tr('CD Tiro Salvezza'), value: '${sc['dc']}'),
        StatBox(label: tr('Attacco incantesimi'), value: formatModifier(sc['attack'] as int)),
      ]),
      if (sc['isPact'] == true) Padding(padding: const EdgeInsets.only(top: 8), child: Text(tr('Magia del Patto: gli slot si recuperano con un riposo breve.'), style: TextStyle(color: c.muted, fontSize: 12))),
      Subhead(tr('Slot incantesimo')),
      Text(tr('(segna quelli usati)'), style: TextStyle(color: c.muted, fontSize: 12)),
      Wrap(spacing: 20, runSpacing: 4, children: [
        for (final slot in slots)
          Row(mainAxisSize: MainAxisSize.min, children: [
            SizedBox(width: 34, child: Text(pick('${slot['level']}°', _ordinal(slot['level'] as int)), style: TextStyle(fontWeight: FontWeight.w700, color: c.accentStrong))),
            Pips(
              max: slot['max'] as int, used: slot['used'] as int,
              semanticLabel: pick('Slot di ${slot['level']}° livello usato', '${_ordinal(slot['level'] as int)}-level slot used'),
              onChanged: (v) => model.set('spells.slotsUsed.${slot['level']}', v),
            ),
            Text(slot['remaining'] as String, style: TextStyle(color: c.muted, fontSize: 12)),
          ]),
      ]),
      if (sc['showCantrips'] == true) _SpellSet(app: app, kind: 'cantrips', title: tr('Trucchetti scelti'), pickLabel: tr('+ Scegli trucchetti'), info: sc['cantrips'] as Json),
      _SpellSet(app: app, kind: 'spells', title: sc['spellsTitle'] as String, pickLabel: tr('+ Scegli incantesimi'), info: sc['spells'] as Json),
      const SizedBox(height: 8),
      Theme(
        data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
        child: ExpansionTile(
          tilePadding: EdgeInsets.zero,
          title: Text(tr('Altri incantesimi, a mano'), style: const TextStyle(fontWeight: FontWeight.w600)),
          subtitle: Text(tr('(per ciò che non è in elenco)'), style: TextStyle(color: c.muted, fontSize: 12)),
          childrenPadding: const EdgeInsets.only(bottom: 8),
          children: [
            BoundField(model: model, path: 'spells.cantrips', label: tr('Altri trucchetti'), lines: 3, hint: tr('Un trucchetto di un talento o di una regola della casa…')),
            const SizedBox(height: 10),
            BoundField(model: model, path: 'spells.prepared', label: tr('Altri incantesimi e note'), lines: 3, hint: tr('Incantesimi sempre preparati, del libro degli incantesimi, a scelta del DM…')),
          ],
        ),
      ),
    ]);
  }
}

class _SpellSet extends StatelessWidget {
  const _SpellSet({required this.app, required this.kind, required this.title, required this.pickLabel, required this.info});
  final AppController app;
  final String kind;
  final String title;
  final String pickLabel;
  final Json info;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final selected = (info['selected'] as List).cast<Json>();
    final groups = <int, List<Json>>{};
    for (final s in selected) {
      groups.putIfAbsent(s['level'] as int, () => []).add(s);
    }
    final status = info['status'];
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Subhead(title, trailing: Row(mainAxisSize: MainAxisSize.min, children: [
        Text(spellCountText(info), style: TextStyle(fontWeight: FontWeight.w700, color: status == 'over' ? c.vermilion : c.accentStrong)),
        const SizedBox(width: 8),
        FilledButton.tonal(onPressed: () => showSpellPicker(context, app, kind), child: Text(pickLabel)),
      ])),
      if (selected.isEmpty)
        Text(kind == 'cantrips' ? tr("Nessun trucchetto scelto: usa «Scegli trucchetti» per cercarli nell'elenco.") : tr("Nessun incantesimo scelto: usa «Scegli incantesimi» per cercarli nell'elenco."), style: TextStyle(color: c.muted, fontSize: 13)),
      for (final entry in groups.entries) ...[
        if (kind == 'spells')
          Padding(
            padding: const EdgeInsets.only(top: 8, bottom: 2),
            child: Text(pick('${entry.value.first['levelLabel']} livello', '${entry.value.first['levelLabel']} level').toUpperCase(), style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: 1, color: c.muted)),
          ),
        for (final s in entry.value)
          Container(
            margin: const EdgeInsets.only(bottom: 4),
            padding: const EdgeInsets.fromLTRB(10, 4, 0, 4),
            decoration: BoxDecoration(color: c.cardRaised, borderRadius: BorderRadius.circular(6), border: Border.all(color: c.border)),
            child: Row(children: [
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Wrap(spacing: 6, crossAxisAlignment: WrapCrossAlignment.center, children: [
                    Text(s['name'] as String, style: const TextStyle(fontWeight: FontWeight.w600)),
                    if ((s['altName'] as String).isNotEmpty && s['altName'] != s['name']) Text(s['altName'] as String, style: TextStyle(fontSize: 12, color: c.muted)),
                    for (final t in (s['tags'] as List).cast<Json>()) Tag(t['label'] as String, tooltip: t['title'] as String, green: t['id'] == 'ritual'),
                  ]),
                  Text('${s['school']} · ${s['meta']} · ${s['sourceText']}', style: TextStyle(fontSize: 12, color: c.muted)),
                ]),
              ),
              InfoButton(name: s['name'] as String, onPressed: () => showSpellDescription(context, app, s['id'] as String)),
              IconButton(
                tooltip: '${pick('Rimuovi', 'Remove')} ${s['name']}', icon: const Icon(Icons.close, size: 20),
                onPressed: () => app.model.toggleSpell(kind, s['id'] as String),
              ),
            ]),
          ),
      ],
    ]);
  }
}
