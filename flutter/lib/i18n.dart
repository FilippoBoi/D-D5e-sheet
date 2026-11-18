/// Internazionalizzazione, come in js/i18n/i18n.js: l'italiano è la lingua di base,
/// le altre sono "overlay" (campi con suffisso `En`, dizionario UI con chiave = testo italiano).
library;

typedef Json = Map<String, dynamic>;

class AppLanguage {
  const AppLanguage(this.code, this.label);
  final String code;
  final String label;
}

const defaultLang = 'it';
const supportedLanguages = [AppLanguage('it', 'Italiano'), AppLanguage('en', 'English')];

String _current = defaultLang;
Map<String, String> _uiEn = {};

String get lang => _current;
bool isSupportedLang(String? code) => supportedLanguages.any((l) => l.code == code);

/// Imposta la lingua; restituisce true se è cambiata.
bool setLang(String code) {
  if (!isSupportedLang(code) || code == _current) return false;
  _current = code;
  return true;
}

void setUiDictionary(Map<String, String> en) => _uiEn = en;

/// Sceglie la lingua dalle preferenze del dispositivo (es. "en-US" → "en").
String detectLang(Iterable<String> preferred) {
  for (final tag in preferred) {
    final code = tag.toLowerCase().split(RegExp('[-_]')).first;
    if (isSupportedLang(code)) return code;
  }
  return defaultLang;
}

/// Sceglie tra due varianti già pronte: pick('Danno', 'Damage').
String pick(String it, String en) => _current == 'it' ? it : en;

String _suffix(String code) => code[0].toUpperCase() + code.substring(1);

/// Legge un campo localizzato: `loc(armor)` usa `nameEn` in inglese, se esiste.
dynamic locRaw(Map? entry, [String field = 'name']) {
  if (entry == null) return null;
  if (_current != defaultLang) {
    final value = entry['$field${_suffix(_current)}'];
    if (value != null) return value;
  }
  return entry[field];
}

String loc(Map? entry, [String field = 'name']) => (locRaw(entry, field) ?? '').toString();

/// Testo dell'interfaccia: la chiave è l'italiano; ricade sull'italiano se manca la traduzione.
String tr(String it, [Map<String, Object?> params = const {}]) {
  final text = _current == defaultLang ? it : (_uiEn[it.replaceAll(RegExp(r'\s+'), ' ').trim()] ?? it);
  if (params.isEmpty) return text;
  return text.replaceAllMapped(RegExp(r'\{(\w+)\}'), (m) => '${params[m[1]] ?? m[0]}');
}
