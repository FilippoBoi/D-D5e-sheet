/// Azioni rapide in gioco: PF con un tocco, slot, concentrazione e dadi vita.
library;

import 'package:material_ui/material_ui.dart';

import '../app_controller.dart';
import '../i18n.dart';
import '../model/character_model.dart';
import 'theme.dart';
import 'widgets.dart';

/// Valori dei pulsanti dei PF.
const hpSteps = [1, 5];

/// Segnaposto di «sto concentrandomi» senza nome di incantesimo (la stringa vuota vuol dire nessuna concentrazione).
const unnamedConcentration = '—';

/// Prova di Costituzione per mantenere la concentrazione dopo un danno: CD 10 o metà del danno, il maggiore.
int concentrationDc(int damage) => damage ~/ 2 > 10 ? damage ~/ 2 : 10;

class QuickActionsPanel extends StatelessWidget {
  const QuickActionsPanel({super.key, required this.app});
  final AppController app;

  CharacterModel get model => app.model;

  void _damage(int amount) {
    final hadHp = (model.state['combat'] as Json)['hpCurrent'];
    model.applyDamage(amount);
    final concentrating = ((model.state['combat'] as Json)['concentration'] as String).isNotEmpty;
    if (concentrating && hadHp != 0) {
      final dc = concentrationDc(amount);
      app.status.value = pick('Concentrazione: TS Costituzione CD $dc', 'Concentration: Constitution save DC $dc');
    }
  }

  void _spendHitDie() {
    final r = model.spendHitDie();
    if (r == null) return;
    final mod = r.conMod == 0 ? '' : ' ${r.conMod > 0 ? '+' : '−'}${r.conMod.abs()}';
    app.status.value = pick('+${r.healed} PF (dado ${r.roll}$mod)', '+${r.healed} HP (die ${r.roll}$mod)');
  }

  Future<void> _startConcentration(BuildContext context) async {
    final name = await showDialog<String>(context: context, builder: (_) => const _ConcentrationDialog());
    if (name != null) model.set('combat.concentration', name.isEmpty ? unnamedConcentration : name);
  }

  Widget _hpRow(BuildContext context) {
    final c = context.colors;
    final hp = model.derived['hp'] as Json;
    Widget step(int n, {required bool heal}) => FilledButton(
          style: FilledButton.styleFrom(
            backgroundColor: heal ? c.emerald : c.vermilion, foregroundColor: Colors.white,
            minimumSize: const Size(64, 52), padding: const EdgeInsets.symmetric(horizontal: 12),
          ),
          onPressed: () => heal ? model.heal(n) : _damage(n),
          child: Text('${heal ? '+' : '−'}$n', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
        );
    return Wrap(spacing: 8, runSpacing: 8, crossAxisAlignment: WrapCrossAlignment.center, children: [
      Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
        Text(tr('Punti Ferita'), style: TextStyle(fontSize: 12, color: c.muted)),
        Text(hp['summary'] as String, key: const Key('quick-hp'), style: TextStyle(fontSize: 28, fontWeight: FontWeight.w800, color: c.accentStrong)),
      ]),
      const SizedBox(width: 4),
      for (final n in hpSteps.reversed) step(n, heal: false),
      for (final n in hpSteps) step(n, heal: true),
    ]);
  }

  Widget _slots(BuildContext context) {
    final c = context.colors;
    final slots = (model.derived['spellcasting'] as Json)['slots'] as List;
    return Wrap(spacing: 16, runSpacing: 4, children: [
      for (final slot in slots.cast<Json>())
        Row(mainAxisSize: MainAxisSize.min, children: [
          Text('${slot['level']}°', style: TextStyle(fontWeight: FontWeight.w700, color: c.accentStrong)),
          const SizedBox(width: 4),
          Pips(
            max: slot['max'] as int, used: slot['used'] as int,
            semanticLabel: pick('Slot di ${slot['level']}° livello usato', 'Level ${slot['level']} slot used'),
            onChanged: (v) => model.set('spells.slotsUsed.${slot['level']}', v),
          ),
        ]),
    ]);
  }

  Widget _concentration(BuildContext context) {
    final c = context.colors;
    final name = (model.state['combat'] as Json)['concentration'] as String;
    if (name.isEmpty) {
      return OutlinedButton.icon(
        key: const Key('quick-concentration-start'),
        onPressed: () => _startConcentration(context),
        icon: const Icon(Icons.center_focus_strong_outlined),
        label: Text(pick('Concentrazione', 'Concentration')),
      );
    }
    return FilledButton.icon(
      key: const Key('quick-concentration-end'),
      style: FilledButton.styleFrom(backgroundColor: c.accent, foregroundColor: c.card),
      onPressed: () => model.set('combat.concentration', ''),
      icon: const Icon(Icons.close),
      label: Text(name == unnamedConcentration ? pick('In concentrazione', 'Concentrating') : pick('Concentrazione: $name', 'Concentrating: $name')),
    );
  }

  Widget _hitDice(BuildContext context) {
    final c = context.colors;
    final dice = model.hitDice;
    final sides = (model.derived['hp'] as Json)['hitDieSides'] as int;
    return Wrap(spacing: 8, crossAxisAlignment: WrapCrossAlignment.center, children: [
      Text('${pick('Dadi vita', 'Hit dice')} ', style: TextStyle(color: c.muted)),
      Text('${dice.remaining}/${dice.total} d$sides', key: const Key('quick-hit-dice'), style: TextStyle(fontWeight: FontWeight.w800, color: c.accentStrong)),
      FilledButton.tonal(
        key: const Key('quick-hit-die-spend'),
        onPressed: dice.remaining > 0 ? _spendHitDie : null,
        child: Text(pick('Spendi dado', 'Spend die')),
      ),
    ]);
  }

  @override
  Widget build(BuildContext context) {
    final isCaster = (model.derived['spellcasting'] as Json)['isCaster'] == true;
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      _hpRow(context),
      const SizedBox(height: 12),
      if (isCaster) ...[_slots(context), const SizedBox(height: 8)],
      Wrap(spacing: 12, runSpacing: 8, crossAxisAlignment: WrapCrossAlignment.center, children: [
        _concentration(context),
        _hitDice(context),
      ]),
    ]);
  }
}

/// Chiede il nome (facoltativo) dell'incantesimo che richiede concentrazione.
class _ConcentrationDialog extends StatefulWidget {
  const _ConcentrationDialog();

  @override
  State<_ConcentrationDialog> createState() => _ConcentrationDialogState();
}

class _ConcentrationDialogState extends State<_ConcentrationDialog> {
  final TextEditingController _name = TextEditingController();

  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
        title: Text(pick('Concentrazione', 'Concentration')),
        content: TextField(
          controller: _name,
          autofocus: true,
          maxLength: 80,
          textCapitalization: TextCapitalization.sentences,
          decoration: InputDecoration(labelText: pick('Incantesimo (facoltativo)', 'Spell (optional)'), counterText: ''),
          onSubmitted: (v) => Navigator.pop(context, v.trim()),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: Text(pick('Annulla', 'Cancel'))),
          FilledButton(onPressed: () => Navigator.pop(context, _name.text.trim()), child: Text(pick('Inizia', 'Start'))),
        ],
      );
}
