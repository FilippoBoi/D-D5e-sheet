/**
 * Configurazione del backend (Supabase) per login a token e collaborazione.
 *
 * Lasciando i valori vuoti l'app funziona solo in locale, come prima: i pulsanti
 * di accesso non compaiono. Vedi README → "Collaborazione online" e supabase/schema.sql.
 *
 * Entrambi i valori sono PUBBLICI per progettazione (la chiave "anon" è fatta per
 * stare nel browser): la sicurezza è garantita dalle funzioni del database, che
 * ammettono solo chi presenta un token valido. Non inserire MAI la chiave "service_role".
 */
export const REMOTE_CONFIG = Object.freeze({
  url: 'https://ohrscqkvkfvmewryybra.supabase.co',
  anonKey: 'sb_publishable_HUxzL23o2BxwY10wH907PA_z1YtFMnC', // chiave pubblica (publishable)
});

export const isRemoteConfigured = (config = REMOTE_CONFIG) => Boolean(config.url && config.anonKey);
