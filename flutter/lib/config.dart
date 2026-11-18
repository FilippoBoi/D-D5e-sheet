/// Configurazione del backend (Supabase) per login a token e collaborazione, come in js/config.js.
///
/// Entrambi i valori sono PUBBLICI per progettazione (la chiave "anon" è fatta per stare nel client):
/// la sicurezza è garantita dalle funzioni del database, che ammettono solo chi presenta un token valido.
/// Non inserire MAI la chiave "service_role".
library;

class RemoteConfig {
  const RemoteConfig({required this.url, required this.anonKey});
  final String url;
  final String anonKey;
  bool get isConfigured => url.isNotEmpty && anonKey.isNotEmpty;
}

const remoteConfig = RemoteConfig(
  url: 'https://ohrscqkvkfvmewryybra.supabase.co',
  anonKey: 'sb_publishable_HUxzL23o2BxwY10wH907PA_z1YtFMnC', // chiave pubblica (publishable)
);

/// Indirizzo pubblico dell'app: base dei link di invito e destinazione del link dell'email del Master.
const siteAddress = 'https://filippoboi.github.io/D-D5e-sheet/';
