/// Barra di sessione, login, creazione campagna e pannello del Master (porting di js/view/AuthView.js).
library;

import 'package:flutter/services.dart';
import 'package:material_ui/material_ui.dart';

import '../auth/account_service.dart' show errorText;
import '../auth/auth_service.dart';
import '../config.dart';
import '../i18n.dart';
import '../session_controller.dart';
import '../sync/character_sync.dart';
import 'theme.dart';
import 'widgets.dart';

/// Mostra le finestre richieste dal controller (login, campagna, pannello) quando serve.
class SessionDialogs extends StatefulWidget {
  const SessionDialogs({super.key, required this.session, required this.child});
  final SessionController session;
  final Widget child;

  @override
  State<SessionDialogs> createState() => _SessionDialogsState();
}

class _SessionDialogsState extends State<SessionDialogs> {
  bool _open = false;

  @override
  void initState() {
    super.initState();
    widget.session.addListener(_check);
    WidgetsBinding.instance.addPostFrameCallback((_) => _check());
  }

  @override
  void dispose() {
    widget.session.removeListener(_check);
    super.dispose();
  }

  void _check() {
    if (_open || !mounted || widget.session.pending == SessionDialog.none) return;
    final which = widget.session.takePending();
    _open = true;
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      if (!mounted) return;
      await (which == SessionDialog.panel ? showAdminPanel(context, widget.session) : showMasterHome(context, widget.session));
      _open = false;
      _check();
    });
  }

  @override
  Widget build(BuildContext context) => widget.child;
}

String _syncText(SyncState s) => switch (s) {
      SyncState.online => pick('sincronizzata', 'synced'),
      SyncState.offline => pick('offline: riprovo…', 'offline: retrying…'),
      SyncState.revoked => pick('accesso revocato', 'access revoked'),
    };

class SessionBar extends StatelessWidget {
  const SessionBar({super.key, required this.session, required this.character});
  final SessionController session;
  final Map<String, dynamic> character;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final s = session.session;
    if (s == null) {
      return Align(
        alignment: Alignment.centerLeft,
        child: OutlinedButton(onPressed: () => showLogin(context, session), child: Text(pick('Accedi / Campagna', 'Sign in / Campaign'))),
      );
    }
    var campaign = s.campaignName.isEmpty ? pick('nessuna campagna', 'no campaign') : s.campaignName;
    final who = [(character['name'] as String).trim(), (character['player'] as String).trim()].where((x) => x.isNotEmpty).join(' - ');
    if (s.role == 'player' && session.isRemote && who.isNotEmpty) campaign += ': $who';
    final state = session.syncState;
    final stateColor = switch (state) { SyncState.online => c.hpHigh, SyncState.offline => c.hpMid, SyncState.revoked => c.hpLow, null => c.muted };
    return Wrap(spacing: 10, runSpacing: 4, crossAxisAlignment: WrapCrossAlignment.center, children: [
      Tag(roleLabel(s)),
      Tooltip(message: session.email, child: Text(campaign, style: const TextStyle(fontWeight: FontWeight.w700))),
      Text('${pick('Scheda', 'Sheet')}: ${session.sheetLabel}', style: TextStyle(color: c.muted, fontSize: 13)),
      if (state != null) Text('● ${_syncText(state)}', style: TextStyle(color: stateColor, fontSize: 13)),
      if (session.canManage) TextButton(onPressed: session.openPanel, child: Text(pick('Pannello campagna', 'Campaign panel'))),
      TextButton(onPressed: session.logout, child: Text(pick('Esci', 'Sign out'))),
    ]);
  }
}

Widget _dialogShell(BuildContext context, String title, List<Widget> children) => Dialog(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 640, maxHeight: 760),
        child: SafeArea(
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 4, 0),
              child: Row(children: [
                Expanded(child: Text(title, style: displayStyle(context, size: 20))),
                IconButton(tooltip: pick('Chiudi', 'Close'), icon: const Icon(Icons.close), onPressed: () => Navigator.pop(context)),
              ]),
            ),
            Flexible(child: ListView(shrinkWrap: true, padding: const EdgeInsets.fromLTRB(16, 4, 16, 16), children: children)),
          ]),
        ),
      ),
    );

Future<void> showLogin(BuildContext context, SessionController session) => showDialog<void>(context: context, builder: (_) => _LoginDialog(session: session));

class _LoginDialog extends StatefulWidget {
  const _LoginDialog({required this.session});
  final SessionController session;

  @override
  State<_LoginDialog> createState() => _LoginDialogState();
}

class _LoginDialogState extends State<_LoginDialog> {
  final _token = TextEditingController();
  final _email = TextEditingController();
  final _link = TextEditingController();
  String _error = '';
  bool _busy = false;
  bool _sent = false;
  String _sentTo = '';

  @override
  void dispose() {
    _token.dispose();
    _email.dispose();
    _link.dispose();
    super.dispose();
  }

  Future<void> _run(Future<String?> Function() action, {void Function()? onOk}) async {
    setState(() {
      _busy = true;
      _error = '';
    });
    final error = await action();
    if (!mounted) return;
    setState(() {
      _busy = false;
      _error = error ?? '';
    });
    if (error == null) onOk?.call();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final hint = TextStyle(color: c.muted, fontSize: 13);
    return _dialogShell(context, pick('Accedi', 'Sign in'), [
      Text(pick('Sei un giocatore? Usa il tuo token', 'Are you a player? Use your token'), style: const TextStyle(fontWeight: FontWeight.w700)),
      const SizedBox(height: 4),
      Text(pick('Incolla il token (o il link) ricevuto dal Master per entrare nella tua scheda.', 'Paste the token (or link) you got from your DM to open your sheet.'), style: hint),
      const SizedBox(height: 8),
      TextField(controller: _token, autocorrect: false, textCapitalization: TextCapitalization.characters, decoration: const InputDecoration(hintText: 'PG-XXXX-XXXX-XXXX')),
      const SizedBox(height: 8),
      FilledButton(
        style: FilledButton.styleFrom(backgroundColor: c.emerald, foregroundColor: Colors.white),
        onPressed: _busy ? null : () => _run(() => widget.session.signInWithToken(_token.text), onOk: () => Navigator.pop(context)),
        child: Text(pick('Entra', 'Enter')),
      ),
      const Divider(height: 28),
      if (_sent) ...[
        Text(pick('Controlla la posta', 'Check your inbox'), style: const TextStyle(fontWeight: FontWeight.w700)),
        const SizedBox(height: 4),
        Text(
          pick(
            "Ti abbiamo scritto a $_sentTo. Apri il link nell'email (controlla anche lo spam): ti porta qui già collegato. Puoi aprirlo anche da un altro dispositivo.",
            'We emailed $_sentTo. Open the link in the email (check spam too): it brings you back here signed in. You can open it on another device too.',
          ),
          style: hint,
        ),
        const SizedBox(height: 12),
        Text(pick("Se hai aperto l'app (non il sito), incolla qui l'indirizzo completo del link:", 'If you are using the app (not the website), paste the full link address here:'), style: hint),
        const SizedBox(height: 6),
        TextField(controller: _link, maxLines: 3, decoration: InputDecoration(hintText: '$siteAddress#access_token=…')),
        const SizedBox(height: 8),
        OutlinedButton(
          onPressed: _busy ? null : () => _run(() => widget.session.signInWithPastedLink(_link.text), onOk: () => Navigator.pop(context)),
          child: Text(pick('Accedi con il link', 'Sign in with the link')),
        ),
      ] else ...[
        Text(pick('Sei il Master? Accedi con la tua email', 'Are you the DM? Sign in with your email'), style: const TextStyle(fontWeight: FontWeight.w700)),
        const SizedBox(height: 4),
        Text(pick('Ti mandiamo un link: aprilo e sei dentro, da qualunque dispositivo. Niente password da ricordare.', 'We email you a link: open it and you are in, from any device. No password to remember.'), style: hint),
        const SizedBox(height: 8),
        TextField(controller: _email, keyboardType: TextInputType.emailAddress, autocorrect: false, decoration: InputDecoration(hintText: pick('La tua email', 'Your email'))),
        const SizedBox(height: 8),
        OutlinedButton(
          onPressed: _busy ? null : () => _run(() => widget.session.sendLink(_email.text), onOk: () => setState(() {
                _sent = true;
                _sentTo = _email.text.trim();
              })),
          child: Text(pick('Inviami il link', 'Email me the link')),
        ),
      ],
      if (_error.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 12), child: Text(_error, style: TextStyle(color: c.vermilion), semanticsLabel: _error)),
    ]);
  }
}

Future<void> showMasterHome(BuildContext context, SessionController session) => showDialog<void>(context: context, builder: (_) => _MasterHomeDialog(session: session));

class _MasterHomeDialog extends StatefulWidget {
  const _MasterHomeDialog({required this.session});
  final SessionController session;

  @override
  State<_MasterHomeDialog> createState() => _MasterHomeDialogState();
}

class _MasterHomeDialogState extends State<_MasterHomeDialog> {
  final _name = TextEditingController();
  final _code = TextEditingController();
  final _claim = TextEditingController();
  String _error = '';
  bool _busy = false;
  bool _needsCode = false;

  @override
  void initState() {
    super.initState();
    widget.session.creationRequiresCode().then((v) {
      if (mounted && v) setState(() => _needsCode = true);
    });
  }

  @override
  void dispose() {
    _name.dispose();
    _code.dispose();
    _claim.dispose();
    super.dispose();
  }

  Future<void> _run(Future<String?> Function() action) async {
    setState(() {
      _busy = true;
      _error = '';
    });
    final error = await action();
    if (!mounted) return;
    setState(() {
      _busy = false;
      _error = error ?? '';
      if (error == errorText('invalid_code')) _needsCode = true; // se non lo si sapeva, ora sì
    });
    if (error == null) Navigator.pop(context);
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final hint = TextStyle(color: c.muted, fontSize: 13);
    return _dialogShell(context, pick('La tua campagna', 'Your campaign'), [
      Text('${pick('Collegato come', 'Signed in as')} ${widget.session.email}', style: hint),
      const SizedBox(height: 12),
      Text(pick('Crea una campagna', 'Create a campaign'), style: const TextStyle(fontWeight: FontWeight.w700)),
      const SizedBox(height: 6),
      TextField(controller: _name, decoration: InputDecoration(hintText: pick('Nome della campagna', 'Campaign name'))),
      if (_needsCode) ...[
        const SizedBox(height: 8),
        TextField(controller: _code, decoration: InputDecoration(hintText: pick('Codice di creazione (te lo dà chi gestisce il sito)', 'Creation code (given by whoever runs the site)'))),
      ],
      const SizedBox(height: 8),
      FilledButton(
        style: FilledButton.styleFrom(backgroundColor: c.emerald, foregroundColor: Colors.white),
        onPressed: _busy ? null : () => _run(() => widget.session.createCampaign(_name.text, _code.text)),
        child: Text(pick('Crea campagna', 'Create campaign')),
      ),
      const Divider(height: 28),
      Text(pick('Hai già una campagna con il vecchio token admin?', 'Already have a campaign with the old admin token?'), style: const TextStyle(fontWeight: FontWeight.w700)),
      const SizedBox(height: 6),
      TextField(controller: _claim, autocorrect: false, textCapitalization: TextCapitalization.characters, decoration: const InputDecoration(hintText: 'ADM-XXXX-XXXX-XXXX')),
      const SizedBox(height: 8),
      OutlinedButton(onPressed: _busy ? null : () => _run(() => widget.session.claimCampaign(_claim.text)), child: Text(pick('Rivendica campagna', 'Claim campaign'))),
      if (_error.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 12), child: Text(_error, style: TextStyle(color: c.vermilion))),
      if (widget.session.hasCampaigns)
        Align(
          alignment: Alignment.centerLeft,
          child: TextButton(
            onPressed: () {
              Navigator.pop(context);
              widget.session.openPanel();
            },
            child: Text(pick('← Torna alle mie campagne', '← Back to my campaigns')),
          ),
        ),
    ]);
  }
}

Future<void> showAdminPanel(BuildContext context, SessionController session) => showDialog<void>(context: context, builder: (_) => _AdminDialog(session: session));

class _AdminDialog extends StatefulWidget {
  const _AdminDialog({required this.session});
  final SessionController session;

  @override
  State<_AdminDialog> createState() => _AdminDialogState();
}

class _AdminDialogState extends State<_AdminDialog> {
  final _label = TextEditingController();

  SessionController get s => widget.session;

  @override
  void initState() {
    super.initState();
    s.addListener(_refresh);
  }

  void _refresh() {
    if (!mounted) return;
    // La scheda aperta (o l'uscita dal ruolo di Master) chiude il pannello.
    if (s.session?.isAdmin != true || (s.isRemote && s.pending == SessionDialog.none && _openedCharacter)) {
      Navigator.of(context).maybePop();
      return;
    }
    setState(() {});
  }

  bool _openedCharacter = false;

  @override
  void dispose() {
    s.removeListener(_refresh);
    _label.dispose();
    super.dispose();
  }

  Future<bool> _confirm(String message) async =>
      await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          content: Text(message),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: Text(pick('Annulla', 'Cancel'))),
            FilledButton(onPressed: () => Navigator.pop(ctx, true), child: Text(pick('Conferma', 'Confirm'))),
          ],
        ),
      ) ??
      false;

  Future<String?> _prompt(String message, String initial) async {
    final controller = TextEditingController(text: initial);
    final result = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(message),
        content: TextField(controller: controller, autofocus: true),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: Text(pick('Annulla', 'Cancel'))),
          FilledButton(onPressed: () => Navigator.pop(ctx, controller.text), child: Text('OK')),
        ],
      ),
    );
    controller.dispose();
    return result;
  }

  Future<void> _copy(String text) async {
    await Clipboard.setData(ClipboardData(text: text));
    s.app.status.value = pick('Copiato ✓', 'Copied ✓');
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final session = s.session;
    if (session == null) return const SizedBox.shrink();
    final campaigns = s.auth.campaigns;
    return _dialogShell(context, pick('La tua campagna', 'Your campaign'), [
      Row(children: [
        if (campaigns.length > 1)
          Expanded(
            child: DropdownButtonFormField<String>(
              initialValue: session.campaignId,
              isExpanded: true,
              decoration: InputDecoration(labelText: pick('Campagna', 'Campaign')),
              items: [for (final camp in campaigns) DropdownMenuItem(value: camp.id, child: Text(camp.name))],
              onChanged: (v) {
                if (v != null) s.selectCampaign(v);
              },
            ),
          )
        else
          Expanded(child: Text(session.campaignName, style: displayStyle(context, size: 18))),
      ]),
      Wrap(spacing: 8, children: [
        TextButton(
          onPressed: () async {
            final name = await _prompt(pick('Nuovo nome della campagna:', 'New campaign name:'), session.campaignName);
            if (name != null) await s.renameCampaign(name);
          },
          child: Text(pick('Rinomina campagna', 'Rename campaign')),
        ),
        TextButton(onPressed: s.openMasterHome, child: Text(pick('+ Altra campagna…', '+ Another campaign…'))),
      ]),
      Text('${pick('Collegato come', 'Signed in as')} ${s.email}', style: TextStyle(color: c.muted, fontSize: 13)),
      Subhead(pick('Schede', 'Sheets')),
      if (s.loading)
        Text(pick('Caricamento…', 'Loading…'), style: TextStyle(color: c.muted))
      else if (s.characters.isEmpty)
        Text(pick('Nessuna scheda: creane una e dai il link al giocatore.', 'No sheets yet: create one and send the link to the player.'), style: TextStyle(color: c.muted))
      else
        for (final ch in s.characters)
          Container(
            margin: const EdgeInsets.only(bottom: 10),
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(color: c.cardRaised, borderRadius: BorderRadius.circular(8), border: Border.all(color: c.border)),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Wrap(spacing: 8, crossAxisAlignment: WrapCrossAlignment.end, children: [
                Text(ch.title, style: const TextStyle(fontWeight: FontWeight.w700)),
                Text(ch.subtitle, style: TextStyle(color: c.muted, fontSize: 12)),
              ]),
              const SizedBox(height: 4),
              Wrap(spacing: 8, crossAxisAlignment: WrapCrossAlignment.center, children: [
                SelectableText(ch.token, style: const TextStyle(fontFamily: 'monospace', fontSize: 12)),
                TextButton(onPressed: () => _copy(buildInviteLink(siteAddress, ch.token)), child: Text(pick('Copia link', 'Copy link'))),
                TextButton(onPressed: () => _copy(ch.token), child: Text(pick('Copia token', 'Copy token'))),
              ]),
              Wrap(spacing: 8, children: [
                FilledButton(
                  style: FilledButton.styleFrom(backgroundColor: c.emerald, foregroundColor: Colors.white),
                  onPressed: () {
                    _openedCharacter = true;
                    s.openCharacter(ch.id);
                  },
                  child: Text(pick('Apri', 'Open')),
                ),
                OutlinedButton(
                  onPressed: () async {
                    final label = await _prompt(pick('Etichetta della scheda:', 'Sheet label:'), ch.label);
                    if (label != null) await s.renameCharacter(ch.id, label);
                  },
                  child: Text(pick('Rinomina', 'Rename')),
                ),
                OutlinedButton(
                  onPressed: () async {
                    if (await _confirm(pick('Generare un nuovo token? Il vecchio smetterà di funzionare subito e il giocatore verrà scollegato.', 'Generate a new token? The old one stops working immediately and the player is signed out.'))) {
                      await s.rotateToken(ch.id);
                    }
                  },
                  child: Text(pick('Nuovo token', 'New token')),
                ),
                FilledButton(
                  style: FilledButton.styleFrom(backgroundColor: c.vermilion, foregroundColor: Colors.white),
                  onPressed: () async {
                    if (await _confirm(pick('Eliminare la scheda "${ch.title}"? Non è reversibile.', 'Delete the sheet "${ch.title}"? This cannot be undone.'))) {
                      await s.removeCharacter(ch.id);
                    }
                  },
                  child: Text(pick('Elimina', 'Delete')),
                ),
              ]),
            ]),
          ),
      Row(children: [
        Expanded(child: TextField(controller: _label, decoration: InputDecoration(hintText: pick('Giocatore o personaggio (es. Mario)', 'Player or character (e.g. Mario)')))),
        const SizedBox(width: 8),
        FilledButton(
          style: FilledButton.styleFrom(backgroundColor: c.emerald, foregroundColor: Colors.white),
          onPressed: () async {
            final label = _label.text.trim();
            _label.clear();
            await s.createCharacter(label);
          },
          child: Text(pick('+ Nuova scheda', '+ New sheet')),
        ),
      ]),
      if (s.error.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 12), child: Text(s.error, style: TextStyle(color: c.vermilion))),
      const Divider(height: 28),
      Align(
        alignment: Alignment.centerLeft,
        child: FilledButton(
          style: FilledButton.styleFrom(backgroundColor: c.vermilion, foregroundColor: Colors.white),
          onPressed: () async {
            if (await _confirm(pick('Eliminare la campagna "${session.campaignName}" e TUTTE le sue schede? Non è reversibile.', 'Delete the campaign "${session.campaignName}" and ALL its sheets? This cannot be undone.'))) {
              await s.deleteCampaign();
            }
          },
          child: Text(pick('Elimina campagna', 'Delete campaign')),
        ),
      ),
    ]);
  }
}
