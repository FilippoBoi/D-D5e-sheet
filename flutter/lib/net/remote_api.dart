/// Client minimale per le funzioni RPC del database (PostgREST di Supabase), come js/net/RemoteApi.js.
///
/// Gli errori del database (`raise exception 'invalid_token'`) diventano [RemoteError] con `code`
/// stabile; i problemi di rete hanno code 'network'.
library;

import 'dart:convert';

import 'package:http/http.dart' as http;

const _knownCodes = {
  'invalid_token', 'forbidden', 'not_found', 'invalid_name', 'invalid_code', 'limit_reached', 'invalid_data',
  'auth_required', // serve il login da Master
  'legacy_admin_token', // è un vecchio token admin: va rivendicato, non usato per entrare
};

class RemoteError implements Exception {
  RemoteError(this.code, [String? message]) : message = message ?? code;
  final String code;
  final String message;

  /// L'accesso non vale più (token revocato o ruotato, scheda eliminata, login scaduto): inutile riprovare.
  bool get isAuthFailure => const {'invalid_token', 'forbidden', 'not_found', 'auth_required'}.contains(code);

  @override
  String toString() => 'RemoteError($code)';
}

typedef AccessTokenProvider = Future<String?> Function({bool force});

class RemoteApi {
  RemoteApi({required String url, required this.anonKey, this.getAccessToken, http.Client? client})
      : _url = url.replaceAll(RegExp(r'/+$'), ''),
        _client = client ?? http.Client();

  final String _url;
  final String anonKey;
  final AccessTokenProvider? getAccessToken;
  final http.Client _client;

  /// Chiama la funzione SQL [fn] con gli argomenti (chiavi = nomi dei parametri `p_*`).
  Future<dynamic> rpc(String fn, [Map<String, Object?> args = const {}]) async {
    final body = jsonEncode(args);
    var token = await _accessToken(false);
    var response = await _send(fn, body, token);

    // Login scaduto: si rinnova una volta e si riprova.
    if (response.statusCode == 401 && getAccessToken != null) {
      final fresh = await _accessToken(true);
      if (fresh != null && fresh != token) {
        token = fresh;
        response = await _send(fn, body, token);
      }
    }

    dynamic payload;
    try {
      payload = response.body.isEmpty ? null : jsonDecode(utf8.decode(response.bodyBytes));
    } catch (_) {
      // corpo non JSON
    }
    if (response.statusCode >= 200 && response.statusCode < 300) return payload;

    final message = payload is Map && payload['message'] is String ? payload['message'] as String : '';
    var code = _knownCodes.contains(message) ? message : 'unknown';
    // PostgREST: 42501 = permesso negato (funzione riservata agli account), PGRST30x = JWT scaduto/non valido.
    final pgCode = payload is Map ? payload['code']?.toString() ?? '' : '';
    if (code == 'unknown' && (pgCode == '42501' || RegExp(r'^PGRST30[1-3]$').hasMatch(pgCode) || response.statusCode == 401)) {
      code = 'auth_required';
    }
    throw RemoteError(code, message.isEmpty ? 'HTTP ${response.statusCode}' : message);
  }

  Future<String?> _accessToken(bool force) async {
    if (getAccessToken == null) return null;
    try {
      return await getAccessToken!(force: force);
    } catch (_) {
      return null;
    }
  }

  Future<http.Response> _send(String fn, String body, String? token) async {
    final headers = {'apikey': anonKey, 'Content-Type': 'application/json', if (token != null) 'Authorization': 'Bearer $token'};
    try {
      return await _client.post(Uri.parse('$_url/rest/v1/rpc/$fn'), headers: headers, body: body);
    } catch (_) {
      throw RemoteError('network');
    }
  }
}
