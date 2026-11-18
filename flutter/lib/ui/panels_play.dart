/// Pannelli di gioco: combattimento e punti ferita, caratteristiche, tiri salvezza e abilità.
library;

import 'package:material_ui/material_ui.dart';

import '../app_controller.dart';
import '../data/catalog.dart';
import '../i18n.dart';
import '../model/utils.dart';
import 'descriptions.dart';
import 'theme.dart';
import 'widgets.dart';

class CombatPanel extends StatefulWidget {
  const CombatPanel({super.key, required this.app});
  final AppController app;

  @override
  State<CombatPanel> createState() => _CombatPanelState();
}

class _CombatPanelState extends State<CombatPanel> {
  final TextEditingController _delta = TextEditingController();

  @override
  void dispose() {
    _delta.dispose();
    super.dispose();
  }

  int _takeDelta() {
    final n = int.tryParse(_delta.text.trim()) ?? 0;
    _delta.clear();
    return n;
  }

  @override
  Widget build(BuildContext context) {
    final model = widget.app.model;
    final d = model.derived;
    final hp = d['hp'] as Json;
    final c = context.colors;
    final combat = model.state['combat'] as Json;
    final barColor = switch (hp['level']) { 'high' => c.hpHigh, 'mid' => c.hpMid, _ => c.hpLow };
    final suggested = hp['suggested'] as num;

    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      ResponsiveWrap(minWidth: 170, children: [
        StatBox(label: tr('Classe Armatura'), value: '${d['ac']}', hint: d['acBreakdown'] as String, big: true),
        StatBox(label: tr('Iniziativa'), value: formatModifier(d['initiative'] as int), hint: tr('Mod. Destrezza'), big: true),
        BoundField(model: model, path: 'combat.speed', label: tr('Velocità (m)'), number: true, decimal: true),
      ]),
      Subhead(tr('Punti Ferita')),
      ClipRRect(
        borderRadius: BorderRadius.circular(6),
        child: LinearProgressIndicator(value: (hp['percent'] as int) / 100, minHeight: 12, color: barColor, backgroundColor: c.cardRaised),
      ),
      const SizedBox(height: 12),
      ResponsiveWrap(minWidth: 140, children: [
        BoundField(model: model, path: 'combat.hpMax', label: tr('PF massimi'), number: true),
        BoundField(model: model, path: 'combat.hpCurrent', label: tr('PF attuali'), number: true),
        BoundField(model: model, path: 'combat.hpTemp', label: tr('PF temporanei'), number: true),
      ]),
      Padding(
        padding: const EdgeInsets.only(top: 6),
        child: Wrap(crossAxisAlignment: WrapCrossAlignment.center, children: [
          Text('${tr('PF suggeriti per classe e livello:')} ', style: TextStyle(color: c.muted, fontSize: 13)),
          Text(numStr(suggested), style: const TextStyle(fontWeight: FontWeight.w700)),
          TextButton(onPressed: model.applySuggestedHp, child: Text(tr('Applica'))),
        ]),
      ),
      Wrap(spacing: 8, runSpacing: 8, crossAxisAlignment: WrapCrossAlignment.center, children: [
        SizedBox(
          width: 110,
          child: TextField(controller: _delta, keyboardType: TextInputType.number, decoration: InputDecoration(labelText: tr('Quantità'), hintText: '0'), onSubmitted: (_) => model.applyDamage(_takeDelta())),
        ),
        FilledButton(style: FilledButton.styleFrom(backgroundColor: c.vermilion, foregroundColor: Colors.white), onPressed: () => model.applyDamage(_takeDelta()), child: Text(tr('Danno'))),
        FilledButton(style: FilledButton.styleFrom(backgroundColor: c.emerald, foregroundColor: Colors.white), onPressed: () => model.heal(_takeDelta()), child: Text(tr('Cura'))),
        Tooltip(message: tr('Recupera le risorse che tornano con un riposo breve'), child: OutlinedButton(onPressed: model.shortRest, child: Text(tr('Riposo breve')))),
        Tooltip(message: tr('Recupera PF, slot e tutte le risorse'), child: OutlinedButton(onPressed: model.longRest, child: Text(tr('Riposo lungo')))),
      ]),
      if (hp['isDown'] == true) ...[
        Subhead(tr('Tiri salvezza contro morte')),
        Row(children: [
          SizedBox(width: 100, child: Text(tr('Successi'))),
          Pips(max: 3, used: combat['deathSuccesses'] as int, semanticLabel: tr('Successo'), onChanged: (v) => model.set('combat.deathSuccesses', v)),
        ]),
        Row(children: [
          SizedBox(width: 100, child: Text(tr('Fallimenti'))),
          Pips(max: 3, used: combat['deathFailures'] as int, semanticLabel: tr('Fallimento'), onChanged: (v) => model.set('combat.deathFailures', v)),
        ]),
      ],
    ]);
  }
}

class AbilitiesPanel extends StatelessWidget {
  const AbilitiesPanel({super.key, required this.app});
  final AppController app;

  @override
  Widget build(BuildContext context) {
    final model = app.model;
    final cat = Catalog.instance;
    final d = model.derived;
    final c = context.colors;
    final mods = d['mods'] as Json;
    final saves = d['saves'] as Json;
    final saveProf = model.state['saveProficiencies'] as Json;
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      ResponsiveWrap(minWidth: 150, children: [
        for (final a in cat.abilities)
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(color: c.cardRaised, borderRadius: BorderRadius.circular(8), border: Border.all(color: c.border)),
            child: Column(children: [
              Text(loc(a), style: TextStyle(fontWeight: FontWeight.w700, color: c.muted)),
              Text(formatModifier(mods[a['id']] as int), style: TextStyle(fontSize: 28, fontWeight: FontWeight.w800, color: c.accentStrong)),
              const SizedBox(height: 6),
              BoundField(model: model, path: 'abilities.${a['id']}', label: pick('Punteggio', 'Score'), number: true),
            ]),
          ),
      ]),
      Subhead(tr('Tiri salvezza')),
      ResponsiveWrap(minWidth: 240, spacing: 24, children: [
        for (final a in cat.abilities)
          Row(children: [
            Checkbox(value: saveProf[a['id']] == true, onChanged: (v) => model.set('saveProficiencies.${a['id']}', v ?? false)),
            Expanded(child: Text(loc(a))),
            Text(formatModifier(saves[a['id']] as int), style: TextStyle(fontWeight: FontWeight.w700, color: c.accentStrong)),
          ]),
      ]),
    ]);
  }
}

class SkillsPanel extends StatelessWidget {
  const SkillsPanel({super.key, required this.app});
  final AppController app;

  @override
  Widget build(BuildContext context) {
    final model = app.model;
    final cat = Catalog.instance;
    final d = model.derived;
    final c = context.colors;
    final skillsState = model.state['skills'] as Json;
    final bonuses = d['skills'] as Json;
    final fromSources = (d['proficientFromSources'] as List).cast<String>().toSet();
    final fromChoices = (d['expertiseFromChoices'] as List).cast<String>().toSet();
    final slots = ((d['classInfo'] as Json)['skillSlots'] as List).cast<Json>();
    final short = {for (final a in cat.abilities) a['id'] as String: loc(a, 'short')};
    final skills = lang == 'it' ? cat.skills : ([...cat.skills]..sort((a, b) => loc(a).compareTo(loc(b))));

    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      if (slots.isNotEmpty) ...[
        Subhead(tr('Competenze di classe')),
        ResponsiveWrap(minWidth: 220, children: [
          for (final (i, slot) in slots.indexed)
            Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              SelectField(
                label: '${pick('Abilità di classe', 'Class skill')} ${i + 1}', value: slot['value'] as String,
                options: [{'value': '', 'label': '—'}, ...(slot['options'] as List).cast<Json>()],
                onChanged: (v) => model.set('classSkills.${slot['key']}', v),
              ),
              if (slot['duplicate'] == true)
                Padding(
                  padding: const EdgeInsets.only(top: 4),
                  child: Text(pick("Già competente per razza o background: scegline un'altra.", 'Already proficient from race or background: pick another.'), style: TextStyle(fontSize: 12, color: c.vermilion)),
                ),
            ]),
        ]),
        Padding(padding: const EdgeInsets.only(top: 6), child: Text((d['classInfo'] as Json)['skillChoice'] as String, style: TextStyle(fontSize: 12, color: c.muted))),
      ],
      Subhead(tr('Abilità')),
      Padding(
        padding: const EdgeInsets.symmetric(horizontal: 4),
        child: Row(children: [
          SizedBox(width: 48, child: Text(tr('Comp.'), style: TextStyle(fontSize: 11, color: c.muted))),
          SizedBox(width: 48, child: Text(tr('Maes.'), style: TextStyle(fontSize: 11, color: c.muted))),
          Expanded(child: Text(tr('Abilità'), style: TextStyle(fontSize: 11, color: c.muted))),
          Text(tr('Bonus'), style: TextStyle(fontSize: 11, color: c.muted)),
          const SizedBox(width: 44),
        ]),
      ),
      ResponsiveWrap(minWidth: 340, spacing: 24, children: [
        for (final s in skills)
          () {
            final id = s['id'] as String;
            final st = skillsState[id] as Json;
            final lockedProf = fromSources.contains(id);
            return Row(children: [
              SizedBox(
                width: 48,
                child: Checkbox(
                  value: st['proficient'] == true || lockedProf,
                  // Competenza che arriva da razza, background o classe: spuntata e bloccata.
                  onChanged: lockedProf ? null : (v) => model.set('skills.$id.proficient', v ?? false),
                ),
              ),
              SizedBox(
                width: 48,
                child: Checkbox(
                  value: st['expertise'] == true || fromChoices.contains(id),
                  fillColor: WidgetStateProperty.resolveWith((s) => s.contains(WidgetState.selected) ? c.vermilion : null),
                  onChanged: fromChoices.contains(id) ? null : (v) => model.set('skills.$id.expertise', v ?? false),
                ),
              ),
              Expanded(
                child: Text.rich(TextSpan(children: [
                  TextSpan(text: loc(s)),
                  TextSpan(text: '  ${short[s['ability']]}', style: TextStyle(fontSize: 11, color: c.muted)),
                ])),
              ),
              Text(formatModifier(bonuses[id] as int), style: TextStyle(fontWeight: FontWeight.w700, color: c.accentStrong)),
              InfoButton(name: loc(s), onPressed: () => showSkillDescription(context, id)),
            ]);
          }(),
      ]),
      const SizedBox(height: 12),
      Align(alignment: Alignment.centerLeft, child: SizedBox(width: 260, child: StatBox(label: tr('Saggezza (Percezione) passiva'), value: '${d['passivePerception']}'))),
    ]);
  }
}
