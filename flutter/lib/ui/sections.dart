/// Sezioni di navigazione della scheda e composizione dei pannelli in ciascuna.
library;

import 'package:material_ui/material_ui.dart';

import '../app_controller.dart';
import '../i18n.dart';
import '../session_controller.dart';
import 'panels_gear.dart';
import 'panels_info.dart';
import 'panels_lore.dart';
import 'panels_notes.dart';
import 'panels_play.dart';
import 'panels_quick.dart';
import 'session_ui.dart';
import 'theme.dart';
import 'widgets.dart';

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
class SectionBody extends StatelessWidget {
  const SectionBody({super.key, required this.app, required this.session, required this.section});
  final AppController app;
  final SessionController? session;
  final Section section;

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
          TwoColumns(
            left: [
              _panel('quick', pick('Azioni rapide', 'Quick actions'), QuickActionsPanel(app: app)),
              gap,
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
class TwoColumns extends StatelessWidget {
  const TwoColumns({super.key, required this.left, required this.right});
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
