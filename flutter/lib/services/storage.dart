import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

/// Persistenza locale (SharedPreferences: localStorage sul web, file/NSUserDefaults sugli altri sistemi).
/// Ogni accesso è protetto: se lo storage non funziona l'app continua, semplicemente senza salvare.
class Storage {
  Storage(this._prefs, {this.key = 'dnd5e-character-sheet'});

  final SharedPreferences? _prefs;
  final String key;

  static Future<Storage> open() async {
    try {
      return Storage(await SharedPreferences.getInstance());
    } catch (_) {
      return Storage(null);
    }
  }

  bool get isAvailable => _prefs != null;

  Object? _read(String k) {
    try {
      final raw = _prefs?.getString(k);
      return raw == null ? null : jsonDecode(raw);
    } catch (_) {
      return null;
    }
  }

  Future<bool> _write(String k, Object? value) async {
    try {
      return await _prefs?.setString(k, jsonEncode(value)) ?? false;
    } catch (_) {
      return false;
    }
  }

  Object? loadCharacter() => _read(key);
  Future<bool> saveCharacter(Object? data) => _write(key, data);
  Future<void> clearCharacter() async {
    try {
      await _prefs?.remove(key);
    } catch (_) {}
  }

  Map<String, dynamic> loadUiState() => (_read('$key:ui') as Map?)?.cast<String, dynamic>() ?? {};
  Future<bool> saveUiState(Object? data) => _write('$key:ui', data);

  String? loadString(String name) {
    final v = _read('$key:$name');
    return v is String ? v : null;
  }

  Future<bool> saveString(String name, String value) => _write('$key:$name', value);

  Object? loadSources() => _read('$key:sources');
  Future<bool> saveSources(Object? data) => _write('$key:sources', data);

  /// Copia nello storage le voci raw della versione JS che qui mancano (il formato JSON è lo stesso).
  /// Restituisce quante ne ha copiate.
  Future<int> adoptRaw(Map<String, String> entries) async {
    var copied = 0;
    for (final e in entries.entries) {
      try {
        if (_prefs == null || _prefs.containsKey(e.key)) continue;
        jsonDecode(e.value); // solo JSON valido
        if (await _prefs.setString(e.key, e.value)) copied++;
      } catch (_) {
        // voce illeggibile: si salta
      }
    }
    return copied;
  }

  /// Oggetti JSON salvati con un nome libero (sessioni, account…).
  Object? loadObject(String name) => _read('$key:$name');
  Future<bool> saveObject(String name, Object? value) => _write('$key:$name', value);
}
