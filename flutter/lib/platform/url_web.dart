import 'dart:js_interop';

import 'package:web/web.dart' as web;

@JS('__launchHref')
external JSString? get _launchHref;

/// Indirizzo di avvio salvato da index.html prima che Flutter (con la strategia a percorsi) riscriva l'URL
/// e perda il frammento del link dell'email. Se manca, si ripiega su Uri.base.
Uri get launchUri {
  final saved = _launchHref?.toDart;
  return saved == null || saved.isEmpty ? Uri.base : Uri.parse(saved);
}

void cleanLaunchUrl() {
  final uri = Uri.base;
  final params = {for (final e in uri.queryParameters.entries) if (e.key != 't') e.key: e.value};
  final clean = Uri(path: uri.path, queryParameters: params.isEmpty ? null : params);
  web.window.history.replaceState(null, '', clean.toString());
}
