import 'dart:async';

import 'package:flutter/services.dart';
import 'package:material_ui/material_ui.dart';

import '../app_controller.dart';
import '../i18n.dart';
import '../model/utils.dart';
import '../session_controller.dart';
import 'session_ui.dart';
import 'panels_gear.dart';
import 'panels_info.dart';
import 'panels_lore.dart';
import 'panels_notes.dart';
import 'panels_play.dart';
import 'theme.dart';
import 'widgets.dart';

/// Pausa prima di proporre i PF del nuovo livello (si può ancora ritoccare il numero).
const _levelPromptDelay = Duration(milliseconds: 900);

class SheetPage extends StatefulWidget {
  const SheetPage({super.key, required this.app, this.session});
  final AppController app;

  /// Accesso e collaborazione online; null se il backend non è configurato (l'app resta solo locale).
  final SessionController? session;

  @override
  State<SheetPage> createState() => _SheetPageState();
}

class _SheetPageState extends State<SheetPage> {
  late int _levelBaseline = _level();
  Timer? _levelTimer;

  AppController get app => widget.app;
  int _level() => (app.model.state['info'] as Json)['level'] as int;

  @override
  void initState() {
    super.initState();
    app.model.addListener(_onModel);
    app.status.addListener(_onStatus);
  }

  @override
  void dispose() {
    _levelTimer?.cancel();
    app.model.removeListener(_onModel);
    app.status.removeListener(_onStatus);
    super.dispose();
  }

  void _onStatus() {
    final message = app.status.value;
    if (message == null || !mounted) return;
    app.status.value = null;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message), duration: const Duration(seconds: 3)));
  }

  void _onModel() {
    final path = app.model.lastPath;
    if (path == '*') {
      _levelTimer?.cancel();
      _levelBaseline = _level();
    } else if (path == 'info.level') {
      _levelTimer?.cancel();
      _levelTimer = Timer(_levelPromptDelay, _offerLevelUp);
    }
  }

  Future<void> _offerLevelUp() async {
    final to = _level();
    final from = _levelBaseline;
    _levelBaseline = to;
    if (to <= from || !mounted) return;
    final levels = to - from;
    final choice = await showDialog<({String mode, int total})>(context: context, builder: (_) => _LevelUpDialog(from: from, to: to, hp: app.model.derived['hp'] as Json));
    if (choice == null) return;
    final result = app.model.applyLevelUpHp(levels, mode: choice.mode, total: choice.total);
    final detail = result.rolls.isEmpty ? '' : ' (${pick('tirato', 'rolled')} ${result.rolls.join(', ')})';
    app.status.value = pick('+${result.gain} PF massimi$detail', '+${result.gain} max HP$detail');
  }

  static const _panelIds = ['info', 'combat', 'abilities', 'skills', 'equipment', 'spells', 'features', 'languages'];

  Future<void> _export() async {
    final json = app.exportJson();
    await showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(tr('Esporta')),
        content: SizedBox(width: 560, child: SingleChildScrollView(child: SelectableText(json, style: const TextStyle(fontFamily: 'monospace', fontSize: 12)))),
        actions: [
          TextButton(
            onPressed: () async {
              await Clipboard.setData(ClipboardData(text: json));
              if (ctx.mounted) Navigator.pop(ctx);
              app.status.value = pick('Copiato negli appunti', 'Copied to clipboard');
            },
            child: Text(pick('Copia', 'Copy')),
          ),
          TextButton(onPressed: () => Navigator.pop(ctx), child: Text(pick('Chiudi', 'Close'))),
        ],
      ),
    );
  }

  Future<void> _import() async {
    final controller = TextEditingController();
    final text = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(tr('Importa')),
        content: SizedBox(
          width: 560,
          child: TextField(controller: controller, maxLines: 12, decoration: InputDecoration(hintText: pick('Incolla qui il JSON del personaggio', 'Paste the character JSON here'))),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: Text(pick('Annulla', 'Cancel'))),
          FilledButton(onPressed: () => Navigator.pop(ctx, controller.text), child: Text(tr('Importa'))),
        ],
      ),
    );
    controller.dispose();
    if (text == null || text.trim().isEmpty) return;
    final ok = app.importJson(text);
    app.status.value = ok ? pick('Personaggio importato', 'Character imported') : pick('File non valido', 'Invalid file');
  }

  Future<void> _reset() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(tr('Reset')),
        content: Text(pick('Vuoi davvero azzerare la scheda? I dati salvati andranno persi.', 'Do you really want to reset the sheet? Saved data will be lost.')),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: Text(pick('Annulla', 'Cancel'))),
          FilledButton(style: FilledButton.styleFrom(backgroundColor: context.colors.vermilion), onPressed: () => Navigator.pop(ctx, true), child: Text(tr('Reset'))),
        ],
      ),
    );
    if (ok == true) app.reset();
  }

  @override
  Widget build(BuildContext context) => ListenableBuilder(
        listenable: Listenable.merge([app, app.model, ?widget.session]),
        builder: (context, _) {
          final d = app.model.derived;
          final c = context.colors;
          final isCaster = (d['spellcasting'] as Json)['isCaster'] == true;
          final platformDark = MediaQuery.platformBrightnessOf(context) == Brightness.dark;
          final sections = [for (final s in Section.values) if (s != Section.spells || isCaster) s];
          final current = sections.firstWhere((s) => s.name == app.section, orElse: () => Section.play);
          final width = MediaQuery.sizeOf(context).width;
          final wide = width >= railBreakpoint;
          final keyboardOpen = MediaQuery.viewInsetsOf(context).bottom > 0;
          // Il riepilogo cresce col testo ingrandito, entro un limite.
          final quickHeight = MediaQuery.textScalerOf(context).scale(56).clamp(56.0, 96.0);

          final content = SafeArea(
            // La barra in basso e quella laterale gestiscono già i propri margini.
            top: false,
            child: _SectionBody(app: app, session: widget.session, section: current, isCaster: isCaster),
          );

          final scaffold = Scaffold(
            appBar: AppBar(
              backgroundColor: Theme.of(context).scaffoldBackgroundColor,
              title: Text(tr('Scheda Personaggio'), maxLines: 1, overflow: TextOverflow.ellipsis, style: displayStyle(context, size: 20)),
              actions: [
                for (final l in supportedLanguages)
                  TextButton(
                    onPressed: () => app.setLanguage(l.code),
                    style: TextButton.styleFrom(minimumSize: const Size(48, 48), padding: const EdgeInsets.symmetric(horizontal: 8), foregroundColor: app.language == l.code ? c.accentStrong : c.muted),
                    child: Text(l.code.toUpperCase(), style: TextStyle(fontWeight: app.language == l.code ? FontWeight.w800 : FontWeight.w500)),
                  ),
                IconButton(tooltip: tr('Cambia tema (chiaro/scuro)'), icon: const Icon(Icons.brightness_6_outlined), onPressed: () => app.toggleTheme(platformDark)),
                PopupMenuButton<String>(
                  tooltip: tr('Azioni sulla scheda'),
                  onSelected: (v) {
                    switch (v) {
                      case 'expand':
                        app.setAllPanels(_panelIds, true);
                      case 'collapse':
                        app.setAllPanels(_panelIds, false);
                      case 'export':
                        _export();
                      case 'import':
                        _import();
                      case 'reset':
                        _reset();
                    }
                  },
                  itemBuilder: (_) => [
                    PopupMenuItem(value: 'expand', child: Text(tr('Espandi tutto'))),
                    PopupMenuItem(value: 'collapse', child: Text(tr('Comprimi tutto'))),
                    const PopupMenuDivider(),
                    PopupMenuItem(value: 'export', child: Text(tr('Esporta'))),
                    PopupMenuItem(value: 'import', child: Text(tr('Importa'))),
                    PopupMenuItem(value: 'reset', child: Text(tr('Reset'))),
                  ],
                ),
              ],
              bottom: PreferredSize(preferredSize: Size.fromHeight(quickHeight), child: _QuickBar(d: d, height: quickHeight)),
            ),
            body: wide
                ? Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                    SafeArea(
                      top: false,
                      right: false,
                      child: NavigationRail(
                        key: const Key('nav-rail'),
                        extended: width >= extendedRailBreakpoint,
                        minExtendedWidth: 224,
                        selectedIndex: sections.indexOf(current),
                        onDestinationSelected: (i) => app.setSection(sections[i].name),
                        labelType: width >= extendedRailBreakpoint ? NavigationRailLabelType.none : NavigationRailLabelType.all,
                        backgroundColor: Colors.transparent,
                        destinations: [
                          for (final s in sections)
                            NavigationRailDestination(icon: Icon(s.icon), selectedIcon: Icon(s.selectedIcon), label: Text(s.label(long: true)), padding: const EdgeInsets.symmetric(vertical: 2)),
                        ],
                      ),
                    ),
                    VerticalDivider(width: 1, color: c.border),
                    Expanded(child: content),
                  ])
                : content,
            // Con la tastiera aperta la barra in basso toglie spazio al testo: si nasconde finché si scrive.
            bottomNavigationBar: wide || keyboardOpen
                ? null
                : NavigationBar(
                    key: const Key('nav-bar'),
                    selectedIndex: sections.indexOf(current),
                    onDestinationSelected: (i) => app.setSection(sections[i].name),
                    backgroundColor: Theme.of(context).scaffoldBackgroundColor,
                    destinations: [
                      for (final s in sections) NavigationDestination(icon: Icon(s.icon), selectedIcon: Icon(s.selectedIcon), label: s.label(), tooltip: s.label(long: true)),
                    ],
                  ),
          );
          return widget.session == null ? scaffold : SessionDialogs(session: widget.session!, child: scaffold);
        },
      );
}

/// Sotto questa larghezza (px logici) la navigazione sta in basso; da qui in su è una barra laterale.
const railBreakpoint = 840.0;

/// Da questa larghezza la barra laterale mostra anche le etichette accanto alle icone.
const extendedRailBreakpoint = 1200.0;

/// Sotto questa larghezza dell'area di contenuto la sezione Gioco sta su una sola colonna.
const twoColumnBreakpoint = 700.0;

/// Sezioni di navigazione. L'id (`name`) si salva come ultima sezione aperta.
enum Section {
  play(Icons.shield_outlined, Icons.shield),
  spells(Icons.auto_awesome_outlined, Icons.auto_awesome),
  features(Icons.military_tech_outlined, Icons.military_tech),
  gear(Icons.backpack_outlined, Icons.backpack),
  notes(Icons.edit_note_outlined, Icons.edit_note),
  info(Icons.person_outline, Icons.person);

  const Section(this.icon, this.selectedIcon);
  final IconData icon;
  final IconData selectedIcon;

  /// Etichetta breve (barra in basso) o completa (barra laterale estesa, tooltip).
  String label({bool long = false}) => switch (this) {
        play => tr('Gioco'),
        spells => tr('Incantesimi'),
        features => long ? tr('Privilegi e risorse') : tr('Privilegi'),
        gear => long ? tr('Equipaggiamento') : tr('Equip.'),
        notes => tr('Note'),
        info => long ? tr('Informazioni') : tr('Info'),
      };
}

/// Contenuto della sezione scelta: i pannelli esistenti, ricomposti.
class _SectionBody extends StatelessWidget {
  const _SectionBody({required this.app, required this.session, required this.section, required this.isCaster});
  final AppController app;
  final SessionController? session;
  final Section section;
  final bool isCaster;

  Widget _panel(String id, String title, Widget body) => Panel(
        key: ValueKey('$id-${app.panelsGeneration}'), id: id, title: title,
        open: app.panelOpen(id, defaultOpen: true), onToggle: (v) => app.setPanelOpen(id, v), children: [body],
      );

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    if (section == Section.notes) return NotesSection(app: app);

    final sessionBar = session == null ? <Widget>[] : [SessionBar(session: session!, character: app.model.state['info'] as Json), const SizedBox(height: 8)];
    const gap = SizedBox(height: 12);
    final footer = [
      const SizedBox(height: 20),
      Center(child: Text(tr('Dati salvati solo nel tuo browser. Progetto non ufficiale basato sulle regole di D&D 5E.'), style: TextStyle(fontSize: 12, color: c.muted), textAlign: TextAlign.center)),
    ];
    final List<Widget> children;
    var maxWidth = 980.0;
    switch (section) {
      case Section.play:
        maxWidth = 1280;
        children = [
          _TwoColumns(
            left: [
              _panel('combat', tr('Combattimento & Punti Ferita'), CombatPanel(app: app)),
              gap,
              _panel('abilities', tr('Caratteristiche & Tiri Salvezza'), AbilitiesPanel(app: app)),
            ],
            right: [_panel('skills', tr('Abilità'), SkillsPanel(app: app))],
          ),
        ];
      case Section.spells:
        children = [_panel('spells', tr('Incantesimi & Trucchetti'), SpellsPanel(app: app))];
      case Section.features:
        children = [_panel('features', tr('Privilegi, Tratti & Capacità di Classe'), FeaturesPanel(app: app))];
      case Section.gear:
        children = [_panel('equipment', tr('Equipaggiamento, Armature & Armi'), EquipmentPanel(app: app))];
      case Section.info:
        children = [
          _panel('info', tr('Informazioni Generali & Classe'), InfoPanel(app: app)),
          gap,
          _panel('languages', tr('Linguaggi'), LanguagesPanel(app: app)),
        ];
      case Section.notes:
        children = const [];
    }
    return Align(
      alignment: Alignment.topCenter,
      child: ConstrainedBox(
        constraints: BoxConstraints(maxWidth: maxWidth),
        child: ListView(
          // Una chiave per sezione: ogni sezione ricorda la propria posizione di scorrimento solo finché è aperta.
          key: Key('sheet-list-${section.name}'),
          keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
          padding: const EdgeInsets.fromLTRB(12, 12, 12, 32),
          children: [...sessionBar, ...children, ...footer],
        ),
      ),
    );
  }
}

/// Due colonne affiancate quando c'è spazio, altrimenti una sotto l'altra.
class _TwoColumns extends StatelessWidget {
  const _TwoColumns({required this.left, required this.right});
  final List<Widget> left;
  final List<Widget> right;

  @override
  Widget build(BuildContext context) => LayoutBuilder(builder: (context, box) {
        if (box.maxWidth < twoColumnBreakpoint) {
          return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [...left, const SizedBox(height: 12), ...right]);
        }
        return Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: left)),
          const SizedBox(width: 12),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: right)),
        ]);
      });
}

/// Riepilogo sempre visibile: CA, PF, iniziativa, competenza, TpC e CD.
class _QuickBar extends StatelessWidget {
  const _QuickBar({required this.d, required this.height});
  final Json d;
  final double height;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final items = <(String, String, bool)>[
      (tr('CA'), '${d['ac']}', true),
      (tr('PF'), (d['hp'] as Json)['summary'] as String, false),
      (tr('Iniz.'), formatModifier(d['initiative'] as int), false),
      (tr('Comp.'), formatModifier(d['profBonus'] as int), false),
      if (d['hasWeapons'] == true) (tr('TpC'), formatModifier(d['topAttack'] as int), false),
      if ((d['spellcasting'] as Json)['isCaster'] == true) (tr('CD'), '${(d['spellcasting'] as Json)['dc']}', false),
    ];
    return Container(
      height: height,
      decoration: BoxDecoration(border: Border(top: BorderSide(color: c.border), bottom: BorderSide(color: c.border))),
      child: ListView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        children: [
          for (final (label, value, accent) in items)
            Container(
              margin: const EdgeInsets.only(right: 8),
              padding: const EdgeInsets.symmetric(horizontal: 12),
              decoration: BoxDecoration(color: accent ? c.accentSoft : c.cardRaised, borderRadius: BorderRadius.circular(8), border: Border.all(color: accent ? c.accent : c.border)),
              child: Row(children: [
                Text('$label ', style: TextStyle(fontSize: 12, color: c.muted)),
                Text(value, style: TextStyle(fontWeight: FontWeight.w800, color: c.accentStrong)),
              ]),
            ),
        ],
      ),
    );
  }
}

class _LevelUpDialog extends StatefulWidget {
  const _LevelUpDialog({required this.from, required this.to, required this.hp});
  final int from, to;
  final Json hp;

  @override
  State<_LevelUpDialog> createState() => _LevelUpDialogState();
}

class _LevelUpDialogState extends State<_LevelUpDialog> {
  final TextEditingController _total = TextEditingController();

  @override
  void dispose() {
    _total.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final hp = widget.hp;
    final levels = widget.to - widget.from;
    final die = hp['hitDieSides'] as int;
    final conMod = hp['conMod'] as int;
    final extra = hp['perLevelBonus'] as int;
    final avg = ((hp['averageGain'] as num) * levels);
    return AlertDialog(
      title: Text(pick('Livello ${widget.to}!', 'Level ${widget.to}!'), style: displayStyle(context, size: 20)),
      content: SingleChildScrollView(
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(pick('Sali da ${widget.from} a ${widget.to}: come vuoi aumentare i PF massimi?', 'Going from ${widget.from} to ${widget.to}: how do you want to raise your maximum HP?')),
          const SizedBox(height: 8),
          Text(
            pick(
              'Dado vita d$die · mod. Costituzione ${formatModifier(conMod)}${extra != 0 ? ' · +$extra per livello' : ''}. Ogni livello dà almeno 1 PF.',
              'Hit die d$die · Constitution modifier ${formatModifier(conMod)}${extra != 0 ? ' · +$extra per level' : ''}. Each level gives at least 1 HP.',
            ),
            style: TextStyle(fontSize: 12, color: context.colors.muted),
          ),
          const SizedBox(height: 12),
          Wrap(spacing: 8, runSpacing: 8, children: [
            FilledButton(onPressed: () => Navigator.pop(context, (mode: 'average', total: 0)), child: Text(pick('Media: +${numStr(avg)} PF', 'Average: +${numStr(avg)} HP'))),
            FilledButton.tonal(onPressed: () => Navigator.pop(context, (mode: 'roll', total: 0)), child: Text(pick('Tira ${levels > 1 ? levels : ''}d$die', 'Roll ${levels > 1 ? levels : ''}d$die'))),
          ]),
          const SizedBox(height: 14),
          Text(pick('Hai già tirato fisicamente?', 'Already rolled physical dice?'), style: TextStyle(fontSize: 12, color: context.colors.muted)),
          const SizedBox(height: 6),
          Row(children: [
            Expanded(
              child: TextField(
                controller: _total, keyboardType: TextInputType.number,
                decoration: InputDecoration(labelText: pick('Somma dei dadi tirati (${levels}d$die)', 'Sum of the dice rolled (${levels}d$die)')),
              ),
            ),
            const SizedBox(width: 8),
            OutlinedButton(
              onPressed: () {
                final n = int.tryParse(_total.text.trim());
                if (n != null) Navigator.pop(context, (mode: 'manual', total: n));
              },
              child: Text(pick('Applica', 'Apply')),
            ),
          ]),
        ]),
      ),
      actions: [TextButton(onPressed: () => Navigator.pop(context), child: Text(pick('Non ora', 'Not now')))],
    );
  }
}
