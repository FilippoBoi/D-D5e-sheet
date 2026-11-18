/// Chi è collegato (porting di js/auth/AuthService.js).
///
///   GIOCATORE  token di una scheda (PG-…). Il dispositivo lo ricorda, così si resta collegati.
///   MASTER     account (login con email, vedi AccountService). Ogni campagna ha un solo proprietario;
///              un Master può avere più campagne. Una campagna creata con la versione precedente si
///              rivendica una sola volta con il suo vecchio token (claimCampaign).
library;

import '../i18n.dart';
import '../net/remote_api.dart';
import '../services/storage.dart';
import 'account_service.dart';

final _tokenPattern = RegExp(r'^(ADM|PG)-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$');
const _urlParam = 't';

/// Accetta un token scritto a mano, con spazi o minuscole, o un intero link di invito; null se non valido.
String? normalizeToken(String? input) {
  var text = (input ?? '').trim();
  final fromLink = RegExp(r'[?&]t=([^&#\s]+)', caseSensitive: false).firstMatch(text);
  if (fromLink != null) text = Uri.decodeComponent(fromLink[1]!);
  final token = text.toUpperCase().replaceAll(RegExp(r'\s+'), '');
  return _tokenPattern.hasMatch(token) ? token : null;
}

/// Token presente nell'indirizzo (?t=...), se valido.
String? readTokenFromUri(Uri uri) => normalizeToken(uri.queryParameters[_urlParam]);

/// Link di invito per un token.
String buildInviteLink(String base, String token) {
  final uri = Uri.parse(base);
  return Uri(scheme: uri.scheme, host: uri.host, port: uri.hasPort ? uri.port : null, path: uri.path, queryParameters: {_urlParam: token}).toString();
}

class Session {
  const Session({required this.role, this.token, this.campaignId, this.campaignName = '', this.characterId});
  final String role; // 'player' | 'admin'
  final String? token;
  final String? campaignId;
  final String campaignName;
  final String? characterId;
  bool get isAdmin => role == 'admin';
}

class Campaign {
  Campaign(this.id, this.name, this.characterCount);
  final String id;
  String name;
  final int characterCount;
}

class _PlayerSession {
  _PlayerSession(this.token, this.campaignId, this.campaignName, this.characterId);
  final String token;
  final String campaignId;
  final String campaignName;
  final String characterId;
  Map<String, dynamic> toJson() => {'token': token, 'campaignId': campaignId, 'campaignName': campaignName, 'characterId': characterId};
}

class AuthService {
  AuthService({required this.api, required this.storage, required this.account, this.key = 'sessions'}) {
    _restore();
  }

  final RemoteApi api;
  final Storage storage;
  final AccountService account;
  final String key;
  List<_PlayerSession> _players = [];
  String? _playerToken;
  String? _campaignId;
  List<Campaign> _campaigns = [];
  final Map<String, ({String id, String label})> _lastOpened = {};

  bool get isMaster => account.isSignedIn;
  String get email => account.email;
  List<Campaign> get campaigns => _campaigns;

  Session? get active {
    final player = _players.where((p) => p.token == _playerToken).firstOrNull;
    if (player != null) {
      return Session(role: 'player', token: player.token, campaignId: player.campaignId, campaignName: player.campaignName, characterId: player.characterId);
    }
    if (!account.isSignedIn) return null;
    final campaign = _campaigns.where((c) => c.id == _campaignId).firstOrNull;
    return Session(role: 'admin', campaignId: campaign?.id, campaignName: campaign?.name ?? '');
  }

  // ------------------------------------------------------------ Giocatore

  /// Verifica un token di giocatore sul server e lo rende la sessione attiva.
  /// Errori: invalid_token (formato o token non valido), legacy_admin_token.
  Future<Session> login(String rawToken) async {
    final token = normalizeToken(rawToken);
    if (token == null) throw RemoteError('invalid_token');
    final rows = (await api.rpc('resolve_token', {'p_token': token})) as List?;
    final row = rows == null || rows.isEmpty ? null : rows.first as Map;
    if (row == null) throw RemoteError('invalid_token');
    _players = [
      ..._players.where((p) => p.token != token),
      _PlayerSession(token, '${row['campaign_id']}', '${row['campaign_name']}', '${row['character_id']}'),
    ];
    _playerToken = token;
    _persist();
    return active!;
  }

  // --------------------------------------------------------------- Master

  Future<void> requestLink(String email, String redirectTo) => account.requestLink(email, redirectTo);

  /// Legge la sessione da un frammento di indirizzo (il link dell'email, o incollato a mano).
  SignInResult completeSignIn(String? hash) {
    final result = account.consumeUrlHash(hash);
    if (result is SignedIn) _playerToken = null; // chi arriva dal link dell'email vuole lavorare da Master
    return result;
  }

  /// Scambia il refresh token che era nell'indirizzo con uno nuovo (quello vecchio non vale più).
  Future<void> rotateSession() async {
    try {
      await account.getAccessToken(force: true);
    } catch (_) {
      // si riprova al primo rinnovo
    }
  }

  Future<List<Campaign>> refreshCampaigns() async {
    if (!account.isSignedIn) {
      _campaigns = [];
      return _campaigns;
    }
    final rows = ((await api.rpc('list_campaigns')) as List?) ?? const [];
    _campaigns = [
      for (final r in rows.cast<Map>())
        Campaign('${r['campaign_id']}', '${r['campaign_name']}', int.tryParse('${r['character_count']}') ?? 0),
    ];
    if (!_campaigns.any((c) => c.id == _campaignId)) _campaignId = _campaigns.firstOrNull?.id;
    _persist();
    return _campaigns;
  }

  /// Il progetto richiede un codice per creare campagne? (false se non si riesce a chiederlo)
  Future<bool> creationRequiresCode() async {
    try {
      return (await api.rpc('creation_requires_code')) == true;
    } catch (_) {
      return false;
    }
  }

  Future<Session?> createCampaign(String name, [String code = '']) async {
    final rows = (await api.rpc('create_campaign', {'p_name': name, 'p_code': code.trim().isEmpty ? null : code.trim()})) as List?;
    return _adopt(rows?.firstOrNull as Map?);
  }

  /// Rivendica una campagna creata con la versione precedente, con il suo vecchio token admin.
  Future<Session?> claimCampaign(String rawToken) async {
    final token = normalizeToken(rawToken);
    if (token == null) throw RemoteError('invalid_token');
    final rows = (await api.rpc('claim_campaign', {'p_admin_token': token})) as List?;
    return _adopt(rows?.firstOrNull as Map?);
  }

  Future<Session?> _adopt(Map? row) async {
    if (row == null) throw RemoteError('unknown');
    _playerToken = null;
    final id = '${row['campaign_id']}';
    _campaignId = id;
    await refreshCampaigns();
    _campaignId = id;
    _persist();
    return active;
  }

  void selectCampaign(String campaignId) {
    if (_campaigns.any((c) => c.id == campaignId)) {
      _playerToken = null;
      _campaignId = campaignId;
      _persist();
    }
  }

  void updateCampaignName(String campaignId, String name) {
    _campaigns.where((c) => c.id == campaignId).firstOrNull?.name = name;
  }

  /// Ultima scheda aperta dal Master in questa campagna, per riaprirla dopo il riavvio.
  ({String id, String label})? get lastOpened => _campaignId == null ? null : _lastOpened[_campaignId];

  void rememberOpened(({String id, String label})? entry) {
    if (_campaignId == null || active?.role != 'admin') return;
    if (entry != null) {
      _lastOpened[_campaignId!] = entry;
    } else {
      _lastOpened.remove(_campaignId);
    }
    _persist();
  }

  // ----------------------------------------------------------------- Uscita

  /// Esce. Giocatore: dimentica quel token (e se c'è un account Master si torna a lavorare da Master). Master: chiude l'account.
  void logout() {
    if (active?.role == 'player') {
      _players = _players.where((p) => p.token != _playerToken).toList();
      _playerToken = null;
      _persist();
    } else {
      signOutMaster();
    }
  }

  void signOutMaster() {
    account.signOut();
    _campaigns = [];
    _campaignId = null;
    _lastOpened.clear();
    _persist();
  }

  void _restore() {
    final saved = storage.loadObject(key);
    if (saved is! Map) return;
    _players = [
      for (final p in ((saved['players'] as List?) ?? const []).whereType<Map>())
        if (p['token'] is String && normalizeToken(p['token'] as String) == p['token'] && (p['token'] as String).startsWith('PG-') && p['characterId'] is String)
          _PlayerSession(p['token'] as String, '${p['campaignId'] ?? ''}', '${p['campaignName'] ?? ''}', p['characterId'] as String),
    ];
    final wanted = saved['playerToken'];
    _playerToken = _players.any((p) => p.token == wanted) ? wanted as String : null;
    _campaignId = saved['campaignId'] is String ? saved['campaignId'] as String : null;
    final opened = saved['lastOpened'];
    if (opened is Map) {
      for (final e in opened.entries) {
        if (e.value is Map && (e.value as Map)['id'] is String) {
          _lastOpened['${e.key}'] = (id: (e.value as Map)['id'] as String, label: '${(e.value as Map)['label'] ?? ''}');
        }
      }
    }
  }

  void _persist() => storage.saveObject(key, {
        'players': [for (final p in _players) p.toJson()],
        'playerToken': _playerToken,
        'campaignId': _campaignId,
        'lastOpened': {for (final e in _lastOpened.entries) e.key: {'id': e.value.id, 'label': e.value.label}},
      });
}

/// Etichetta di ruolo mostrata nella barra.
String roleLabel(Session s) => s.isAdmin ? pick('Master', 'DM') : pick('Giocatore', 'Player');
