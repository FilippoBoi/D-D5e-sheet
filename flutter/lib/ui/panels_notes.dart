/// Sezione Note: più note con titolo, ricerca, riordino e salvataggio automatico.
///
/// Le due note storiche (`notes.traits`, `notes.backstory`) compaiono in cima come note predefinite
/// (non si rinominano, non si eliminano); le altre stanno in `notes.items` e si gestiscono liberamente.
library;

import 'package:material_ui/material_ui.dart';

import '../app_controller.dart';
import '../i18n.dart';
import '../model/schema.dart';
import 'theme.dart';
import 'widgets.dart';

/// Larghezza minima (dell'area della sezione) per mostrare elenco ed editor affiancati.
const notesSplitWidth = 700.0;
const _listWidth = 320.0;
const _maxNoteText = 20000;

/// Una voce dell'elenco: nota predefinita o libera.
class _Entry {
  const _Entry({required this.id, required this.title, required this.text, required this.path, required this.builtin});
  final String id;
  final String title;
  final String text;

  /// Percorso del testo nello stato.
  final String path;
  final bool builtin;
}

/// Toglie maiuscole e accenti per la ricerca («perche» trova «perché»).
String foldForSearch(String s) {
  const from = 'àáâãäåèéêëìíîïòóôõöùúûüçñ';
  const to = 'aaaaaaeeeeiiiiooooouuuucn';
  final b = StringBuffer();
  for (final ch in s.toLowerCase().split('')) {
    final i = from.indexOf(ch);
    b.write(i < 0 ? ch : to[i]);
  }
  return b.toString();
}

class NotesSection extends StatefulWidget {
  const NotesSection({super.key, required this.app});
  final AppController app;

  @override
  State<NotesSection> createState() => _NotesSectionState();
}

class _NotesSectionState extends State<NotesSection> {
  final TextEditingController _search = TextEditingController();
  late String? _selected = widget.app.openNote;

  /// Solo a schermo stretto: l'editor sostituisce l'elenco finché non si torna indietro.
  bool _editorOpen = false;
  String _query = '';

  /// Nota appena creata: il suo titolo prende il fuoco (si scrive subito il nome).
  String? _focusTitleOf;

  AppController get app => widget.app;

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  List<_Entry> _entries() {
    final notes = (app.model.state['notes'] as Map).cast<String, dynamic>();
    return [
      _Entry(id: 'traits', title: tr('Talenti & altri tratti'), text: notes['traits'] as String, path: 'notes.traits', builtin: true),
      _Entry(id: 'backstory', title: tr('Storia & personalità'), text: notes['backstory'] as String, path: 'notes.backstory', builtin: true),
      for (final (i, n) in (notes['items'] as List).cast<Map>().indexed)
        _Entry(id: n['id'] as String, title: n['title'] as String, text: n['text'] as String, path: 'notes.items.$i', builtin: false),
    ];
  }

  void _select(String? id, {bool open = true, bool focusTitle = false}) {
    setState(() {
      _selected = id;
      _focusTitleOf = focusTitle ? id : null;
      if (open) _editorOpen = true;
    });
    app.setOpenNote(id);
  }

  Future<void> _create(String title) async {
    final id = app.model.addNote(title: title);
    if (id == null) {
      app.status.value = pick('Hai raggiunto il massimo di $maxNotes note', 'You have reached the limit of $maxNotes notes');
      return;
    }
    _search.clear();
    _query = '';
    _select(id, focusTitle: true);
  }

  void _delete(_Entry entry) {
    final model = app.model;
    final index = model.noteIndex(entry.id);
    if (index < 0) return;
    final snapshot = (title: entry.title, text: entry.text);
    final items = (model.state['notes'] as Map)['items'] as List;
    final neighbour = items.length > 1 ? items[index == 0 ? 1 : index - 1]['id'] as String : 'traits';
    model.removeNote(entry.id);
    setState(() {
      _selected = neighbour;
      _editorOpen = false;
    });
    app.setOpenNote(neighbour);
    final messenger = ScaffoldMessenger.of(context);
    messenger
      ..clearSnackBars()
      ..showSnackBar(SnackBar(
        content: Text(pick('Nota eliminata', 'Note deleted')),
        duration: const Duration(seconds: 6),
        action: SnackBarAction(
          label: pick('Annulla', 'Undo'),
          onPressed: () {
            final id = model.addNote(title: snapshot.title, text: snapshot.text, at: index);
            if (id != null && mounted) _select(id, open: false);
          },
        ),
      ));
  }

  String _newTitle(String kind) => switch (kind) {
        'session' => pick('Sessione', 'Session'),
        'npc' => pick('PNG', 'NPC'),
        'place' => pick('Luogo', 'Place'),
        'todo' => pick('Da fare', 'To-do'),
        _ => '',
      };

  String _snippet(_Entry e) {
    final text = e.text.replaceAll(RegExp(r'\s+'), ' ').trim();
    if (_query.isNotEmpty) {
      final at = foldForSearch(text).indexOf(foldForSearch(_query));
      if (at > 0) {
        final from = (at - 24).clamp(0, text.length);
        return '${from > 0 ? '…' : ''}${text.substring(from)}';
      }
    }
    return text;
  }

  @override
  Widget build(BuildContext context) => ListenableBuilder(
        listenable: app.model,
        builder: (context, _) {
          final all = _entries();
          return LayoutBuilder(builder: (context, box) {
            final split = box.maxWidth >= notesSplitWidth;
            var selectedId = _selected;
            if (all.every((e) => e.id != selectedId)) selectedId = split ? 'traits' : null;
            final selected = all.where((e) => e.id == selectedId).firstOrNull;
            final showEditor = selected != null && (split || _editorOpen);
            final list = _buildList(context, all, selectedId);
            final editor = selected == null ? const SizedBox.shrink() : _buildEditor(context, selected, back: !split);
            final body = split
                ? Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                    SizedBox(width: _listWidth, child: list),
                    VerticalDivider(width: 24, color: context.colors.border),
                    Expanded(child: editor),
                  ])
                : (showEditor ? editor : list);
            return PopScope(
              canPop: split || !showEditor,
              onPopInvokedWithResult: (didPop, _) {
                if (!didPop) setState(() => _editorOpen = false);
              },
              child: Padding(padding: const EdgeInsets.fromLTRB(12, 12, 12, 8), child: body),
            );
          });
        },
      );

  Widget _buildList(BuildContext context, List<_Entry> all, String? selectedId) {
    final c = context.colors;
    final q = foldForSearch(_query.trim());
    final searching = q.isNotEmpty;
    final shown = searching ? all.where((e) => foldForSearch('${e.title}\n${e.text}').contains(q)).toList() : all;
    final builtin = shown.where((e) => e.builtin).toList();
    final custom = shown.where((e) => !e.builtin).toList();

    Widget tile(_Entry e, {Widget? handle}) {
      final selectedTile = e.id == selectedId;
      final title = e.title.trim().isEmpty ? pick('Senza titolo', 'Untitled') : e.title;
      final snippet = _snippet(e);
      return Material(
        key: ValueKey('note-${e.id}'),
        color: selectedTile ? c.accentSoft : Colors.transparent,
        borderRadius: BorderRadius.circular(8),
        child: InkWell(
          borderRadius: BorderRadius.circular(8),
          onTap: () => _select(e.id),
          child: ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 56),
            child: Padding(
              padding: const EdgeInsets.only(left: 12),
              child: Row(children: [
                Icon(e.builtin ? Icons.push_pin_outlined : Icons.sticky_note_2_outlined, size: 20, color: c.accentStrong),
                const SizedBox(width: 12),
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(title, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontWeight: FontWeight.w700, color: e.title.trim().isEmpty && !e.builtin ? c.muted : null)),
                      if (snippet.isNotEmpty) Text(snippet, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 12, color: c.muted)),
                    ]),
                  ),
                ),
                handle ?? const SizedBox(width: 12),
              ]),
            ),
          ),
        ),
      );
    }

    final reorderable = !searching && custom.length > 1;
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      TextField(
        key: const Key('notes-search'),
        controller: _search,
        stylusHandwritingEnabled: true,
        decoration: InputDecoration(
          hintText: pick('Cerca nelle note', 'Search notes'),
          prefixIcon: const Icon(Icons.search),
          suffixIcon: _query.isEmpty
              ? null
              : IconButton(
                  tooltip: pick('Cancella ricerca', 'Clear search'),
                  icon: const Icon(Icons.close),
                  onPressed: () => setState(() {
                    _search.clear();
                    _query = '';
                  }),
                ),
        ),
        onChanged: (v) => setState(() => _query = v),
      ),
      const SizedBox(height: 8),
      Row(children: [
        Expanded(
          child: FilledButton.icon(
            key: const Key('note-new'),
            onPressed: () => _create(''),
            icon: const Icon(Icons.add),
            label: Text(pick('Nuova nota', 'New note')),
          ),
        ),
        const SizedBox(width: 8),
        PopupMenuButton<String>(
          key: const Key('note-templates'),
          tooltip: pick('Nuova nota da modello', 'New note from template'),
          icon: const Icon(Icons.arrow_drop_down_circle_outlined),
          onSelected: (kind) => _create(_newTitle(kind)),
          itemBuilder: (_) => [
            for (final kind in ['session', 'npc', 'place', 'todo']) PopupMenuItem(value: kind, child: Text(_newTitle(kind))),
          ],
        ),
      ]),
      const SizedBox(height: 8),
      Expanded(
        child: shown.isEmpty
            ? Center(child: Text(pick('Nessuna nota trovata', 'No notes found'), style: TextStyle(color: c.muted)))
            : ListView(
                keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
                padding: const EdgeInsets.only(bottom: 24),
                children: [
                  for (final e in builtin) tile(e),
                  if (builtin.isNotEmpty && custom.isNotEmpty) Divider(height: 16, color: c.border),
                  if (reorderable)
                    ReorderableListView(
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      buildDefaultDragHandles: false,
                      onReorderItem: (from, to) => app.model.reorderNote(app.model.noteIndex(custom[from].id), app.model.noteIndex(custom[to].id)),
                      children: [
                        for (final (i, e) in custom.indexed)
                          tile(e,
                              handle: ReorderableDragStartListener(
                                index: i,
                                child: Tooltip(
                                  message: pick('Trascina per riordinare', 'Drag to reorder'),
                                  child: SizedBox(width: 48, height: 48, child: Icon(Icons.drag_handle, color: c.muted)),
                                ),
                              )),
                      ],
                    )
                  else
                    for (final e in custom) tile(e),
                ],
              ),
      ),
    ]);
  }

  Widget _buildEditor(BuildContext context, _Entry e, {required bool back}) {
    final c = context.colors;
    final model = app.model;
    final index = e.builtin ? -1 : model.noteIndex(e.id);
    final count = ((model.state['notes'] as Map)['items'] as List).length;
    return Column(key: ValueKey('editor-${e.id}'), crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Row(children: [
        if (back) IconButton(tooltip: pick('Torna alle note', 'Back to notes'), icon: const Icon(Icons.arrow_back), onPressed: () => setState(() => _editorOpen = false)),
        Expanded(
          child: e.builtin
              ? Padding(padding: const EdgeInsets.symmetric(horizontal: 4), child: Text(e.title, style: displayStyle(context, size: 20)))
              : BoundField(model: model, path: '${e.path}.title', label: pick('Titolo', 'Title'), maxLength: maxNoteTitle, sentences: true, autofocus: _focusTitleOf == e.id),
        ),
        if (!e.builtin)
          PopupMenuButton<String>(
            key: const Key('note-menu'),
            tooltip: pick('Azioni sulla nota', 'Note actions'),
            onSelected: (v) {
              switch (v) {
                case 'up':
                  model.moveNote(e.id, -1);
                case 'down':
                  model.moveNote(e.id, 1);
                case 'delete':
                  _delete(e);
              }
            },
            itemBuilder: (_) => [
              PopupMenuItem(value: 'up', enabled: index > 0, child: Text(pick('Sposta su', 'Move up'))),
              PopupMenuItem(value: 'down', enabled: index < count - 1, child: Text(pick('Sposta giù', 'Move down'))),
              const PopupMenuDivider(),
              PopupMenuItem(value: 'delete', child: Text(pick('Elimina', 'Delete'), style: TextStyle(color: c.vermilion))),
            ],
          ),
      ]),
      const SizedBox(height: 8),
      Expanded(
        child: BoundField(
          model: model,
          path: e.builtin ? e.path : '${e.path}.text',
          label: pick('Testo', 'Text'),
          hint: e.builtin && e.id == 'traits' ? tr('Talenti, tratti di mostruosità, doni…') : pick('Scrivi qui, anche a mano con la penna', 'Write here, pen handwriting works too'),
          expands: true,
          sentences: true,
          maxLength: _maxNoteText,
        ),
      ),
      Padding(
        padding: const EdgeInsets.only(top: 6),
        child: Text(pick('Si salva da solo · ${e.text.length}/$_maxNoteText caratteri', 'Saved automatically · ${e.text.length}/$_maxNoteText characters'), style: TextStyle(fontSize: 12, color: c.muted)),
      ),
    ]);
  }
}
