/// Orchestra accesso, pannello del Master e scheda condivisa (porting di js/controller/SessionController.js).
///
/// Senza configurazione del backend non fa nulla: l'app resta solo locale.
library;

import 'dart:async';

import 'package:flutter/foundation.dart';

import 'app_controller.dart';
import 'auth/account_service.dart';
import 'auth/auth_service.dart';
import 'config.dart';
import 'i18n.dart';
import 'net/remote_api.dart';
import 'platform/url.dart';
import 'sync/character_sync.dart';

/// Quale finestra il controller vuole mostrare (la UI la presenta e la azzera).
enum SessionDialog { none, masterHome, panel }

class AdminCharacter {
  AdminCharacter(this.raw);
  final Json raw;
  String get id => '${raw['id']}';
  String get label => '${raw['label'] ?? ''}';
  String get charName => '${raw['char_name'] ?? ''}';
  String get token => '${raw['player_token']}';
  String get title => label.isNotEmpty ? label : (charName.isNotEmpty ? charName : pick('Senza nome', 'Unnamed'));
  String get subtitle {
    final revision = raw['revision'];
    final edited = (revision == null || revision == 0)
        ? pick('mai modificata', 'never edited')
        : () {
            final d = DateTime.tryParse('${raw['updated_at']}')?.toLocal();
            final date = d == null ? '' : '${d.day.toString().padLeft(2, '0')}/${d.month.toString().padLeft(2, '0')}/${d.year % 100} ${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}';
            return '${pick('modificata', 'edited')} $date${raw['updated_by'] == 'player' ? ' (${pick('giocatore', 'player')})' : ''}';
          }();
    return [if (charName.isNotEmpty && charName != label) charName, edited].join(' · ');
  }
}

class SessionController extends ChangeNotifier {
  SessionController({required this.app, required this.auth, required this.api, this.askUpload, this.pollEvery = const Duration(seconds: 5)});

  final AppController app;
  final AuthService auth;
  final RemoteApi api;
  final Duration pollEvery;

  /// "La scheda in campagna è vuota: caricare quella locale?" (la UI risponde).
  Future<bool> Function()? askUpload;

  CharacterSync? _sync;
  String _sheetLabel = '';
  SyncState _syncState = SyncState.online;
  StreamSubscription<SyncState>? _stateSub;
  bool _campaignsLoaded = false;
  bool _disposed = false;

  List<AdminCharacter> characters = [];
  bool loading = false;
  String error = '';
  SessionDialog pending = SessionDialog.none;

  Session? get session => auth.active;
  bool get isRemote => _sync != null;
  String get sheetLabel => _sync != null ? _sheetLabel : pick('locale (solo su questo dispositivo)', 'local (this device only)');
  SyncState? get syncState => _sync != null ? _syncState : null;
  String get email => auth.email;
  bool get canManage => session?.isAdmin == true;

  void _status(String message) => app.status.value = message;

  void _changed() {
    if (!_disposed) notifyListeners();
  }

  void _show(SessionDialog d) {
    pending = d;
    _changed();
  }

  /// Consuma la richiesta di mostrare una finestra.
  SessionDialog takePending() {
    final d = pending;
    pending = SessionDialog.none;
    return d;
  }

  Future<void> init() async {
    app.model.addListener(_onModelChange);
    final uri = launchUri;

    // Ritorno dal link dell'email: la sessione del Master è nel frammento (#access_token=…).
    final comingBack = auth.completeSignIn(uri.fragment);
    var cleaned = false;
    if (comingBack is! SignInNone) {
      cleanLaunchUrl();
      cleaned = true;
    }
    if (comingBack is SignInError) _status(errorText(comingBack.code));
    if (comingBack is SignedIn) {
      await auth.rotateSession(); // il refresh token dell'indirizzo non deve restare valido
      if (!auth.isMaster) _status(errorText('link_expired'));
    }

    // Link di invito di un giocatore (?t=TOKEN): entra e ripulisce l'indirizzo.
    final urlToken = readTokenFromUri(uri);
    if (urlToken != null) {
      if (!cleaned) cleanLaunchUrl();
      try {
        await auth.login(urlToken);
      } on RemoteError catch (e) {
        _status(errorText(e.code));
      }
    }

    await _loadCampaigns();
    await _enterActiveSession(autoOpenPanel: comingBack is SignedIn);
  }

  void _onModelChange() {
    // Il livello e le modifiche vengono inviate dal salvataggio dell'AppController; qui basta aggiornare la barra.
    if (session?.role == 'player') _changed();
  }

  // ----------------------------------------------------- Campagne del Master

  Future<void> _loadCampaigns() async {
    _campaignsLoaded = false;
    if (!auth.isMaster) return;
    try {
      await auth.refreshCampaigns();
      _campaignsLoaded = true;
    } on RemoteError catch (e) {
      _status(errorText(e.code));
      if (e.code == 'auth_required') auth.signOutMaster();
    }
  }

  // -------------------------------------------------------- Ingresso

  Future<void> _enterActiveSession({bool autoOpenPanel = false}) async {
    final s = auth.active;
    if (s == null) {
      await _leaveRemote();
      return _changed();
    }
    if (s.role == 'player') {
      await _openCharacter(s.token, s.characterId!, pick('la mia scheda', 'my sheet'));
      return;
    }
    await _leaveRemote();
    _changed();
    if (!_campaignsLoaded) return; // offline: niente pannello, resta la scheda locale
    if (s.campaignId == null) return openMasterHome();

    // Dopo un riavvio si riprende dalla scheda che si stava modificando.
    final last = autoOpenPanel ? null : auth.lastOpened;
    if (last != null) await _openCharacter(null, last.id, last.label);
    if (_sync == null) await openPanel();
  }

  Future<void> _openCharacter(String? token, String characterId, String label) async {
    final sync = CharacterSync(
      api: api, token: token, characterId: characterId, getLocal: app.model.snapshot, pollEvery: pollEvery, isActive: () => app.isForeground,
    );
    ({Json data, String? updatedBy}) remote;
    try {
      remote = await sync.load();
    } on RemoteError catch (e) {
      _status(errorText(e.code));
      if (auth.active?.isAdmin == true) {
        if (e.code == 'auth_required') {
          auth.signOutMaster();
          await _enterActiveSession();
          return;
        }
        if (e.isAuthFailure) auth.rememberOpened(null); // scheda eliminata: resta l'accesso alla campagna
      } else if (e.isAuthFailure) {
        auth.logout();
        await _leaveRemote();
      }
      return _changed();
    }

    // Scheda in campagna ancora vuota: offri di caricare quella locale.
    var data = remote.data;
    var upload = false;
    if (data.isEmpty && app.hasLocalCharacter && askUpload != null && await askUpload!()) {
      data = app.localCharacter as Json;
      upload = true;
    }

    _syncState = SyncState.online;
    await _stateSub?.cancel();
    _stateSub = sync.onState.listen((state) {
      _syncState = state;
      if (state == SyncState.revoked) _onRevoked();
      _changed();
    });
    _sync = sync;
    _sheetLabel = label;
    app.attachRemote(sync, data, upload: upload);
    if (auth.active?.isAdmin == true) auth.rememberOpened((id: characterId, label: label));
    _changed();
  }

  Future<void> _leaveRemote() async {
    await _stateSub?.cancel();
    _stateSub = null;
    _sync = null;
    _syncState = SyncState.online;
    app.detachRemote();
  }

  /// La sincronizzazione ha perso l'accesso: token ruotato (giocatore), scheda eliminata o login scaduto (Master).
  Future<void> _onRevoked() async {
    await _leaveRemote();
    if (auth.active?.isAdmin != true) {
      _status(pick('Accesso revocato dal Master.', 'Access revoked by the DM.'));
      auth.logout();
      await _enterActiveSession();
      return;
    }
    auth.rememberOpened(null);
    await _loadCampaigns(); // un login scaduto si scopre qui e chiude la sessione
    if (!auth.isMaster) {
      await _enterActiveSession();
      return;
    }
    _status(pick('Scheda non più disponibile.', 'Sheet no longer available.'));
    await _enterActiveSession(autoOpenPanel: true);
  }

  // ----------------------------------------------------------- Accesso

  /// Entra con un token di giocatore. Restituisce il testo dell'errore, o null se è andato a buon fine.
  Future<String?> signInWithToken(String raw) async {
    try {
      await auth.login(raw);
      await _enterActiveSession();
      return null;
    } on RemoteError catch (e) {
      return errorText(e.code);
    }
  }

  /// Manda al Master il link di accesso per email.
  Future<String?> sendLink(String email) async {
    try {
      await auth.requestLink(email, siteAddress);
      return null;
    } on AccountError catch (e) {
      return errorText(e.code);
    }
  }

  /// Sulle app native il link dell'email apre il sito web: si incolla qui l'indirizzo completo (con #access_token=…).
  Future<String?> signInWithPastedLink(String text) async {
    final index = text.indexOf('#');
    final result = auth.completeSignIn(index >= 0 ? text.substring(index + 1) : text.trim());
    if (result is SignInNone) return errorText('link_expired');
    if (result is SignInError) return errorText(result.code);
    await auth.rotateSession();
    if (!auth.isMaster) return errorText('link_expired');
    await _loadCampaigns();
    await _enterActiveSession(autoOpenPanel: true);
    return null;
  }

  Future<void> logout() async {
    auth.logout();
    characters = [];
    loading = false;
    error = '';
    await _enterActiveSession();
  }

  // ------------------------------------------- Crea o rivendica una campagna

  Future<void> openMasterHome() async => _show(SessionDialog.masterHome);

  bool get hasCampaigns => auth.campaigns.isNotEmpty;

  Future<bool> creationRequiresCode() => auth.creationRequiresCode();

  Future<String?> createCampaign(String name, String code) async {
    try {
      await auth.createCampaign(name, code);
      await _enterActiveSession(autoOpenPanel: true);
      return null;
    } on RemoteError catch (e) {
      return errorText(e.code);
    }
  }

  Future<String?> claimCampaign(String token) async {
    try {
      await auth.claimCampaign(token);
      await _enterActiveSession(autoOpenPanel: true);
      return null;
    } on RemoteError catch (e) {
      return errorText(e.code);
    }
  }

  // -------------------------------------------------- Pannello del Master

  Future<void> openPanel() async {
    if (auth.active?.campaignId == null) return openMasterHome();
    loading = true;
    error = '';
    _show(SessionDialog.panel);
    await reloadCharacters();
  }

  Future<void> reloadCharacters() async {
    final s = auth.active;
    if (s == null || !s.isAdmin || s.campaignId == null) return;
    try {
      final rows = ((await api.rpc('list_characters', {'p_campaign_id': s.campaignId})) as List?) ?? const [];
      characters = [for (final r in rows.cast<Map>()) AdminCharacter(r.cast<String, dynamic>())];
      error = '';
    } on RemoteError catch (e) {
      error = errorText(e.code);
      if (e.isAuthFailure) return _recoverFromAuthFailure(e);
    }
    loading = false;
    _changed();
  }

  /// Login scaduto → si esce da Master; campagna sparita (eliminata altrove) → si ricarica l'elenco.
  Future<void> _recoverFromAuthFailure(RemoteError e) async {
    characters = [];
    loading = false;
    error = '';
    if (e.code == 'auth_required') {
      _status(errorText(e.code));
      auth.signOutMaster();
    } else {
      await _loadCampaigns();
    }
    await _enterActiveSession(autoOpenPanel: true);
  }

  /// Esegue un comando del Master e ricarica l'elenco; gli errori restano nel pannello.
  Future<Object?> _call(String fn, Map<String, Object?> args, {bool reload = true}) async {
    try {
      final result = await api.rpc(fn, args);
      if (reload) await reloadCharacters();
      return result ?? true;
    } on RemoteError catch (e) {
      if (e.isAuthFailure) {
        await _recoverFromAuthFailure(e);
        return null;
      }
      error = errorText(e.code);
      _changed();
      return null;
    }
  }

  void selectCampaign(String id) {
    auth.selectCampaign(id);
    _enterActiveSession(autoOpenPanel: true);
  }

  Future<void> renameCampaign(String name) async {
    final s = auth.active;
    if (s?.campaignId == null || name.trim().isEmpty) return;
    if (await _call('rename_campaign', {'p_campaign_id': s!.campaignId, 'p_name': name.trim()}, reload: false) != null) {
      auth.updateCampaignName(s.campaignId!, name.trim());
      _changed();
    }
  }

  Future<void> deleteCampaign() async {
    final s = auth.active;
    if (s?.campaignId == null) return;
    if (await _call('delete_campaign', {'p_campaign_id': s!.campaignId}, reload: false) != null) {
      characters = [];
      await _loadCampaigns();
      await _enterActiveSession();
    }
  }

  Future<void> createCharacter(String label) async {
    final id = auth.active?.campaignId;
    if (id != null) await _call('create_character', {'p_campaign_id': id, 'p_label': label});
  }

  Future<void> renameCharacter(String id, String label) => _call('rename_character', {'p_character_id': id, 'p_label': label});
  Future<void> rotateToken(String id) => _call('rotate_player_token', {'p_character_id': id});
  Future<void> removeCharacter(String id) => _call('delete_character', {'p_character_id': id});

  Future<void> openCharacter(String id) {
    final current = characters.where((c) => c.id == id).firstOrNull;
    return _openCharacter(null, id, current?.title ?? '');
  }

  @override
  void dispose() {
    _disposed = true;
    app.model.removeListener(_onModelChange);
    _stateSub?.cancel();
    super.dispose();
  }
}
