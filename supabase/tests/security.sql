-- Test di sicurezza e di comportamento del backend. Eseguirli DOPO schema.sql:
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/prepare.sql -f supabase/schema.sql -f supabase/tests/security.sql
-- Ogni controllo che fallisce interrompe lo script con un errore "FAIL: ...".
-- Tutto gira come ruolo `anon` (la chiave pubblica del browser) dentro una transazione annullata.

begin;

create function pg_temp.fails_with(p_sql text, p_expected text) returns void language plpgsql as $$
begin
  execute p_sql;
  raise exception 'FAIL: doveva dare errore "%": %', p_expected, p_sql;
exception when others then
  if sqlerrm like 'FAIL:%' then raise; end if;
  if sqlerrm <> p_expected then raise exception 'FAIL: errore "%" invece di "%": %', sqlerrm, p_expected, p_sql; end if;
end $$;

create function pg_temp.check(p_ok boolean, p_what text) returns void language plpgsql as $$
begin
  if p_ok is not true then raise exception 'FAIL: %', p_what; end if;
end $$;

do $$
declare
  a record; b record; p1 record; p2 record; x record;
  d jsonb; rev bigint; t text; n int;
begin
  set local role anon;

  -- ------------------------------------------------ 1. Accesso diretto negato
  perform pg_temp.fails_with('select * from campaigns', 'permission denied for table campaigns');
  perform pg_temp.fails_with('select * from characters', 'permission denied for table characters');
  perform pg_temp.fails_with($q$insert into campaigns (name, admin_token_hash) values ('x','y')$q$, 'permission denied for table campaigns');
  perform pg_temp.fails_with($q$select public._hash('x')$q$, 'permission denied for function _hash');
  perform pg_temp.fails_with($q$select public._resolve_character('x', null)$q$, 'permission denied for function _resolve_character');
  perform pg_temp.fails_with($q$select public._jsonb_deep_merge('{}', '{}')$q$, 'permission denied for function _jsonb_deep_merge');

  -- ------------------------------------------------ 2. Creazione e formato token
  select * into a from create_campaign('Curse of Strahd');
  select * into b from create_campaign('Altra campagna');
  perform pg_temp.check(a.admin_token ~ '^ADM-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$', 'formato token admin');
  perform pg_temp.fails_with($q$select * from create_campaign('   ')$q$, 'invalid_name');

  select * into p1 from create_character(a.admin_token, 'Mario');
  select * into p2 from create_character(a.admin_token, 'Luigi');
  select * into x  from create_character(b.admin_token, 'Estraneo');
  perform pg_temp.check(p1.player_token ~ '^PG-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$', 'formato token giocatore');
  perform pg_temp.check(p1.player_token <> p2.player_token, 'token diversi');

  -- ------------------------------------------------ 2b. Codice di creazione
  perform pg_temp.check(creation_requires_code() = false, 'senza codice impostato: nessun obbligo');
  perform pg_temp.fails_with($q$select set_creation_code('hack')$q$, 'permission denied for function set_creation_code');
  perform pg_temp.fails_with($q$select * from settings$q$, 'permission denied for table settings');
  reset role;                                                   -- come dal SQL Editor di Supabase
  perform set_creation_code('  la mia frase  ');
  perform pg_temp.check((select value from settings where key = 'creation_code_hash') <> 'la mia frase', 'il codice non è salvato in chiaro');
  set local role anon;
  perform pg_temp.check(creation_requires_code() = true, 'codice impostato: richiesto');
  perform pg_temp.fails_with($q$select * from create_campaign('Intrusa')$q$, 'invalid_code');
  perform pg_temp.fails_with($q$select * from create_campaign('Intrusa', '')$q$, 'invalid_code');
  perform pg_temp.fails_with($q$select * from create_campaign('Intrusa', 'sbagliato')$q$, 'invalid_code');
  perform pg_temp.fails_with($q$select * from create_campaign('Intrusa', 'LA MIA FRASE')$q$, 'invalid_code');   -- maiuscole contano
  perform pg_temp.check((select count(*) from pg_proc where proname = 'create_campaign') = 1, 'nessun overload senza codice');
  select * into x from create_campaign('Con codice', 'la mia frase');
  perform pg_temp.check(x.admin_token like 'ADM-%', 'con il codice giusto si crea');
  perform pg_temp.check((select role from resolve_token(x.admin_token)) = 'admin', 'e la campagna funziona');
  perform pg_temp.fails_with($q$select * from create_campaign('   ', 'la mia frase')$q$, 'invalid_name');
  reset role;
  perform set_creation_code(null);                              -- toglierlo riapre la creazione
  set local role anon;
  perform pg_temp.check(creation_requires_code() = false, 'codice rimosso');
  select * into x from create_campaign('Di nuovo aperta');

  -- ------------------------------------------------ 3. Chi sono
  perform pg_temp.check((select role from resolve_token(a.admin_token)) = 'admin', 'resolve admin');
  perform pg_temp.check((select character_id from resolve_token(p1.player_token)) = p1.id, 'resolve player → la sua scheda');
  perform pg_temp.fails_with($q$select * from resolve_token('PG-AAAA-AAAA-AAAA')$q$, 'invalid_token');
  perform pg_temp.fails_with($q$select * from resolve_token('')$q$, 'invalid_token');
  perform pg_temp.fails_with($q$select * from resolve_token(null)$q$, 'invalid_token');

  -- ------------------------------------------------ 4. Isolamento tra giocatori
  perform pg_temp.fails_with(format($q$select * from get_character(%L, %L)$q$, p1.player_token, p2.id), 'forbidden');
  perform pg_temp.fails_with(format($q$select * from save_character(%L, %L, '{"x":1}')$q$, p1.player_token, p2.id), 'forbidden');
  perform pg_temp.fails_with(format($q$select * from character_revision(%L, %L)$q$, p1.player_token, p2.id), 'forbidden');
  perform pg_temp.fails_with(format($q$select * from list_characters(%L)$q$, p1.player_token), 'invalid_token');
  perform pg_temp.fails_with(format($q$select * from create_character(%L, 'x')$q$, p1.player_token), 'invalid_token');
  perform pg_temp.fails_with(format($q$select rotate_player_token(%L, %L)$q$, p1.player_token, p1.id), 'invalid_token');
  perform pg_temp.fails_with(format($q$select delete_campaign(%L)$q$, p1.player_token), 'invalid_token');

  -- ------------------------------------------------ 5. Isolamento tra campagne
  perform pg_temp.fails_with(format($q$select * from get_character(%L, %L)$q$, b.admin_token, p1.id), 'not_found');
  perform pg_temp.fails_with(format($q$select * from save_character(%L, %L, '{"x":1}')$q$, b.admin_token, p1.id), 'not_found');
  perform pg_temp.fails_with(format($q$select rotate_player_token(%L, %L)$q$, b.admin_token, p1.id), 'not_found');
  perform delete_character(b.admin_token, p1.id);                      -- non solleva, ma non deve cancellare nulla
  perform rename_character(b.admin_token, p1.id, 'HACK');
  perform pg_temp.check((select count(*) from list_characters(a.admin_token)) = 2, 'delete tra campagne ha cancellato qualcosa');
  perform pg_temp.check((select label from list_characters(a.admin_token) where id = p1.id) = 'Mario', 'rename tra campagne ha modificato');
  perform pg_temp.check((select count(*) from list_characters(b.admin_token)) = 1, 'elenco dell''altra campagna');

  -- ------------------------------------------------ 6. Salvataggio: fusione in profondità
  select revision into rev from save_character(p1.player_token, null, '{"combat":{"hpCurrent":10,"hpMax":10,"speed":9},"weapons":[1,2]}');
  perform pg_temp.check(rev = 1, 'prima revisione');
  -- il Master toglie PF, poi il giocatore cambia la velocità: nessuno perde la modifica
  perform save_character(a.admin_token, p1.id, '{"combat":{"hpCurrent":3}}');
  select data into d from save_character(p1.player_token, null, '{"combat":{"speed":12}}');
  perform pg_temp.check(d = '{"combat":{"hpCurrent":3,"hpMax":10,"speed":12},"weapons":[1,2]}', 'merge in profondità: ' || d::text);
  select data into d from save_character(p1.player_token, null, '{"weapons":[9]}');
  perform pg_temp.check(d -> 'weapons' = '[9]', 'gli array si sostituiscono');
  perform pg_temp.check((select updated_by from get_character(a.admin_token, p1.id)) = 'player', 'updated_by = chi ha scritto per ultimo');
  perform pg_temp.check((select character_revision(p1.player_token)) = 4, 'revisione incrementata a ogni salvataggio');
  perform pg_temp.check((select char_name from list_characters(a.admin_token) where id = p2.id) = '', 'nome vuoto per scheda nuova');
  perform save_character(p2.player_token, null, '{"info":{"name":"Luigi Verdi"}}');
  perform pg_temp.check((select char_name from list_characters(a.admin_token) where id = p2.id) = 'Luigi Verdi', 'nome della scheda nell''elenco');

  perform pg_temp.fails_with(format($q$select * from save_character(%L, null, '[1]')$q$, p1.player_token), 'invalid_data');
  perform pg_temp.fails_with(format($q$select * from save_character(%L, null, 'null')$q$, p1.player_token), 'invalid_data');
  perform pg_temp.fails_with(format($q$select * from save_character(%L, null, %L)$q$, p1.player_token, jsonb_build_object('big', repeat('x', 140000))),
    'new row for relation "characters" violates check constraint "characters_data_check"');

  -- ------------------------------------------------ 7. Rotazione e revoca
  t := rotate_player_token(a.admin_token, p1.id);
  perform pg_temp.check(t <> p1.player_token and t like 'PG-%', 'nuovo token');
  perform pg_temp.fails_with(format($q$select * from get_character(%L)$q$, p1.player_token), 'invalid_token');
  perform pg_temp.check((select revision from get_character(t)) = 4, 'il nuovo token vede la stessa scheda');

  -- ------------------------------------------------ 8. Limite di schede per campagna
  for n in 1..48 loop perform create_character(b.admin_token, 'x'); end loop;   -- 1 + 48 = 49
  perform create_character(b.admin_token, 'cinquantesima');
  perform pg_temp.fails_with(format($q$select * from create_character(%L, 'una di troppo')$q$, b.admin_token), 'limit_reached');

  -- ------------------------------------------------ 9. Eliminazione
  perform delete_character(a.admin_token, p2.id);
  perform pg_temp.fails_with(format($q$select * from get_character(%L)$q$, p2.player_token), 'invalid_token');
  perform rename_campaign(a.admin_token, 'Nuovo nome');
  perform pg_temp.check((select campaign_name from resolve_token(a.admin_token)) = 'Nuovo nome', 'rename campagna');
  perform delete_campaign(a.admin_token);
  perform pg_temp.fails_with(format($q$select * from resolve_token(%L)$q$, a.admin_token), 'invalid_token');
  perform pg_temp.fails_with(format($q$select * from resolve_token(%L)$q$, t), 'invalid_token');
  perform pg_temp.check((select count(*) from list_characters(b.admin_token)) = 50, 'l''altra campagna è intatta');

  raise notice 'OK: tutti i controlli di sicurezza sono passati';
end $$;

rollback;
