import '../i18n.dart';

num clampNum(num n, num min, num max) => n < min ? min : (n > max ? max : n);
int clampInt(num n, int min, int max) => clampNum(n.truncate(), min, max).toInt();

/// Come `String(n)` in JavaScript: i numeri interi senza ".0".
String numStr(num n) => n == n.truncate() ? n.truncate().toString() : n.toString();

/// +2, +0, −1 (segno meno tipografico U+2212).
String formatModifier(num n) => n >= 0 ? '+${numStr(n)}' : '−${numStr(n.abs())}';

bool isPlainObject(Object? v) => v is Map;

/// Riporta un double intero a int, così il salvataggio resta identico a quello della versione web.
num cleanNum(num n) => n is double && n.isFinite && n == n.truncate() ? n.toInt() : n;

/// Confronto per nome senza accenti né maiuscole (approssima `localeCompare`).
int compareNames(String a, String b) {
  final x = _fold(a), y = _fold(b);
  final c = x.compareTo(y);
  return c != 0 ? c : a.compareTo(b);
}

const _accents = {
  'à': 'a', 'á': 'a', 'â': 'a', 'ä': 'a', 'è': 'e', 'é': 'e', 'ê': 'e', 'ë': 'e', 'ì': 'i', 'í': 'i', 'î': 'i', 'ï': 'i',
  'ò': 'o', 'ó': 'o', 'ô': 'o', 'ö': 'o', 'ù': 'u', 'ú': 'u', 'û': 'u', 'ü': 'u', 'ñ': 'n', 'ç': 'c',
};
String _fold(String s) => s.toLowerCase().split('').map((c) => _accents[c] ?? c).join();

/// Legge un valore annidato con percorso puntato ("abilities.str", "weapons.0.name").
Object? getByPath(Object? obj, String path) {
  Object? cur = obj;
  for (final key in path.split('.')) {
    if (cur is Map) {
      cur = cur[key];
    } else if (cur is List) {
      final i = int.tryParse(key);
      cur = (i != null && i >= 0 && i < cur.length) ? cur[i] : null;
    } else {
      return null;
    }
    if (cur == null) return null;
  }
  return cur;
}

/// Scrive solo in chiavi già esistenti (un percorso sbagliato non crea nulla).
bool setByPath(Json obj, String path, Object? value) {
  final keys = path.split('.');
  final last = keys.removeLast();
  Object? target = obj;
  for (final key in keys) {
    if (target is Map && target.containsKey(key)) {
      target = target[key];
    } else if (target is List) {
      final i = int.tryParse(key);
      if (i == null || i < 0 || i >= target.length) return false;
      target = target[i];
    } else {
      return false;
    }
  }
  if (target is Map && target.containsKey(last)) {
    target[last] = value;
    return true;
  }
  if (target is List) {
    final i = int.tryParse(last);
    if (i != null && i >= 0 && i < target.length) {
      target[i] = value;
      return true;
    }
  }
  return false;
}

/// Copia profonda di dati JSON.
///
/// Le mappe risultano sempre `Map<String, dynamic>` e le liste `List<dynamic>`: un letterale come
/// `{'a': 1}` avrebbe tipo `Map<String, int>` e rifiuterebbe poi un valore decimale.
T deepCopy<T>(T v) {
  if (v is Map) return <String, dynamic>{for (final e in v.entries) e.key as String: deepCopy<dynamic>(e.value)} as T;
  if (v is List) return <dynamic>[for (final e in v) deepCopy<dynamic>(e)] as T;
  return v;
}
