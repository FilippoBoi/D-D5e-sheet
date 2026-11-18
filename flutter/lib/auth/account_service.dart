/// Account del Master: login con email (link magico) su Supabase Auth, solo con HTTP (porting di AccountService.js).
///
///   1. requestLink(email)        → Supabase manda una email con un link
///   2. il link riporta sul sito con la sessione nell'indirizzo (#access_token=…)
///   3. consumeUrlHash(hash)      → la sessione viene letta e salvata
///   4. getAccessToken()          → JWT da mandare con ogni chiamata; si rinnova da solo
///
/// La firma del JWT la verifica il server: qui lo si legge solo per sapere chi è e quando scade.
library;

import 'dart:convert';

import 'package:http/http.dart' as http;

import '../i18n.dart';
import '../services/storage.dart';

/// Rinnova con questo anticipo (secondi) rispetto alla scadenza.
const _refreshMarginS = 60;

const _authErrors = {
  'over_email_send_rate_limit': 'email_rate_limit',
  'over_request_rate_limit': 'email_rate_limit',
  'email_address_not_authorized': 'email_not_authorized',
  'email_address_invalid': 'email_invalid',
  'validation_failed': 'email_invalid',
  'signup_disabled': 'signup_disabled',
  'otp_disabled': 'signup_disabled',
  'otp_expired': 'link_expired',
  'access_denied': 'link_expired',
};

class AccountError implements Exception {
  AccountError(this.code, [String? message]) : message = message ?? code;
  final String code;
  final String message;
  @override
  String toString() => 'AccountError($code)';
}

/// Contenuto (non verificato) di un JWT, o null.
Json? decodeJwt(String token) {
  try {
    final payload = token.split('.')[1];
    final bytes = base64Url.decode(base64Url.normalize(payload));
    final data = jsonDecode(utf8.decode(bytes));
    return data is Map ? data.cast<String, dynamic>() : null;
  } catch (_) {
    return null;
  }
}

class AccountSession {
  AccountSession({required this.accessToken, required this.refreshToken, required this.expiresAt, required this.userId, required this.email});
  final String accessToken;
  final String refreshToken;
  final double expiresAt;
  final String userId;
  final String email;

  Json toJson() => {'accessToken': accessToken, 'refreshToken': refreshToken, 'expiresAt': expiresAt, 'userId': userId, 'email': email};
}

sealed class SignInResult {
  const SignInResult();
}

class SignInNone extends SignInResult {
  const SignInNone();
}

class SignedIn extends SignInResult {
  const SignedIn();
}

class SignInError extends SignInResult {
  const SignInError(this.code);
  final String code;
}

class AccountService {
  AccountService({required String url, required this.anonKey, required this.storage, http.Client? client, double Function()? now, this.key = 'account'})
      : _url = url.replaceAll(RegExp(r'/+$'), ''),
        _client = client ?? http.Client(),
        _now = now ?? (() => DateTime.now().millisecondsSinceEpoch / 1000) {
    _restore();
  }

  final String _url;
  final String anonKey;
  final Storage storage;
  final String key;
  final http.Client _client;
  final double Function() _now; // secondi
  AccountSession? _session;
  Future<String?>? _refreshing;

  bool get isSignedIn => _session != null;
  String get email => _session?.email ?? '';
  String get userId => _session?.userId ?? '';

  /// Chiede a Supabase di mandare il link di accesso (crea l'account se non c'è).
  /// Errori: email_invalid, email_rate_limit, email_not_authorized, signup_disabled, network, unknown.
  Future<void> requestLink(String email, String redirectTo) async {
    final clean = email.trim();
    if (!RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(clean)) throw AccountError('email_invalid');
    await _call('/auth/v1/otp?redirect_to=${Uri.encodeQueryComponent(redirectTo)}', {'email': clean, 'create_user': true});
  }

  /// Legge la sessione dal frammento di un indirizzo ("#access_token=…&refresh_token=…").
  SignInResult consumeUrlHash(String? hash) {
    final params = Uri.splitQueryString((hash ?? '').replaceFirst(RegExp(r'^#'), ''));
    final error = params['error_code'] ?? params['error'];
    if (error != null && error.isNotEmpty) return SignInError(_authErrors[error] ?? 'unknown');
    final access = params['access_token'];
    final refresh = params['refresh_token'];
    if (access == null || refresh == null) return const SignInNone();
    final session = _toSession(access, refresh);
    if (session == null) return const SignInError('unknown');
    _save(session);
    return const SignedIn();
  }

  /// JWT valido da mandare al server, rinnovato se sta per scadere (o se [force]); null se non si è loggati.
  Future<String?> getAccessToken({bool force = false}) async {
    _restore(); // un'altra istanza può aver già rinnovato
    final session = _session;
    if (session == null) return null;
    final expiring = session.expiresAt - _now() < _refreshMarginS;
    if (!force && !expiring) return session.accessToken;
    return (await _refresh()) ?? (expiring ? null : _session?.accessToken);
  }

  /// Esce: chiude la sessione sul server (se raggiungibile) e dimentica tutto qui.
  Future<void> signOut() async {
    final token = _session?.accessToken;
    _save(null);
    if (token == null) return;
    try {
      await _client.post(Uri.parse('$_url/auth/v1/logout'), headers: {'apikey': anonKey, 'Authorization': 'Bearer $token'});
    } catch (_) {
      // comunque scollegati
    }
  }

  // ------------------------------------------------------------ Interni

  Future<String?> _refresh() => _refreshing ??= _doRefresh().whenComplete(() => _refreshing = null);

  Future<String?> _doRefresh() async {
    final current = _session;
    if (current == null) return null;
    try {
      final data = await _call('/auth/v1/token?grant_type=refresh_token', {'refresh_token': current.refreshToken});
      final map = data is Map ? data : const {};
      final session = _toSession(map['access_token'] as String?, map['refresh_token'] as String?);
      if (session == null) throw AccountError('unknown');
      _save(session);
      return session.accessToken;
    } on AccountError catch (e) {
      // Rete assente: si resta collegati e si riprova. Sessione rifiutata dal server: si è scollegati.
      if (e.code != 'network') _save(null);
      return null;
    }
  }

  Future<dynamic> _call(String path, Json body) async {
    http.Response response;
    try {
      response = await _client.post(
        Uri.parse('$_url$path'),
        headers: {'apikey': anonKey, 'Content-Type': 'application/json'},
        body: jsonEncode(body),
      );
    } catch (_) {
      throw AccountError('network');
    }
    dynamic payload;
    try {
      payload = response.body.isEmpty ? null : jsonDecode(utf8.decode(response.bodyBytes));
    } catch (_) {
      // non JSON
    }
    if (response.statusCode >= 200 && response.statusCode < 300) return payload;
    final map = payload is Map ? payload : const {};
    final reason = (map['error_code'] ?? map['code'])?.toString();
    throw AccountError(
      _authErrors[reason] ?? (response.statusCode == 429 ? 'email_rate_limit' : 'unknown'),
      (map['msg'] ?? map['message'] ?? 'HTTP ${response.statusCode}').toString(),
    );
  }

  AccountSession? _toSession(String? accessToken, String? refreshToken) {
    if (accessToken == null || refreshToken == null || refreshToken.isEmpty) return null;
    final claims = decodeJwt(accessToken);
    if (claims == null || claims['sub'] == null) return null;
    return AccountSession(
      accessToken: accessToken,
      refreshToken: refreshToken,
      expiresAt: (claims['exp'] as num?)?.toDouble() ?? _now() + 3600,
      userId: claims['sub'].toString(),
      email: (claims['email'] ?? '').toString(),
    );
  }

  void _restore() {
    final saved = storage.loadObject(key);
    if (saved is Map && saved['accessToken'] is String && saved['refreshToken'] is String && saved['userId'] is String) {
      _session = AccountSession(
        accessToken: saved['accessToken'] as String,
        refreshToken: saved['refreshToken'] as String,
        expiresAt: (saved['expiresAt'] as num?)?.toDouble() ?? 0,
        userId: saved['userId'] as String,
        email: (saved['email'] ?? '').toString(),
      );
    } else {
      _session = null;
    }
  }

  void _save(AccountSession? session) {
    _session = session;
    storage.saveObject(key, session?.toJson());
  }
}

/// Testo mostrato all'utente per un errore di account, di rete o del database.
String errorText(String? code) {
  final map = {
    'invalid_token': pick('Token non valido o revocato.', 'Invalid or revoked token.'),
    'legacy_admin_token': pick(
        'Questo è un vecchio token admin: non serve più per entrare. Accedi come Master con la tua email e rivendica la campagna.',
        'This is an old admin token: it no longer signs you in. Sign in as DM with your email and claim the campaign.'),
    'auth_required': pick('Accesso da Master scaduto: accedi di nuovo.', 'DM sign-in expired: please sign in again.'),
    'email_invalid': pick("Controlla l'indirizzo email.", 'Check the email address.'),
    'email_rate_limit': pick('Troppi invii di email: aspetta un minuto (o più) e riprova.', 'Too many emails sent: wait a minute (or more) and try again.'),
    'email_not_authorized': pick(
        'Questo indirizzo non può ricevere email dal servizio gratuito del progetto: serve un invio email configurato (vedi README).',
        "This address cannot get emails from the project's free email service: a configured email provider is needed (see README)."),
    'signup_disabled': pick("Le nuove registrazioni sono disattivate: usa l'email con cui hai già un account.", 'New sign-ups are disabled: use the email you already have an account with.'),
    'link_expired': pick('Il link è scaduto o già usato: richiedine uno nuovo.', 'The link has expired or was already used: request a new one.'),
    'network': pick('Server non raggiungibile. Controlla la connessione.', 'Server unreachable. Check your connection.'),
    'invalid_name': pick('Inserisci un nome.', 'Enter a name.'),
    'invalid_code': pick('Codice di creazione non valido.', 'Invalid creation code.'),
    'limit_reached': pick('Limite di 50 schede per campagna raggiunto.', 'Limit of 50 sheets per campaign reached.'),
    'unknown': pick('Errore imprevisto del server.', 'Unexpected server error.'),
  };
  return map[code] ?? map['unknown']!;
}
