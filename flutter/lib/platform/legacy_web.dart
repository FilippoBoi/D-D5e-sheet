import 'package:web/web.dart' as web;

/// Legge dal localStorage del browser le voci della versione JS (chiavi che iniziano con [prefix]),
/// così chi passa alla versione Flutter ritrova scheda, lingua, manuali e sessioni.
Map<String, String> readLegacyLocalStorage(String prefix) {
  final out = <String, String>{};
  try {
    final storage = web.window.localStorage;
    for (var i = 0; i < storage.length; i++) {
      final key = storage.key(i);
      if (key != null && key.startsWith(prefix)) {
        final value = storage.getItem(key);
        if (value != null) out[key] = value;
      }
    }
  } catch (_) {
    // storage non accessibile: si riparte da zero
  }
  return out;
}
