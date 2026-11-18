-- Test di sicurezza e di comportamento del backend. Eseguirli DOPO schema.sql:
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/prepare.sql -f supabase/schema.sql -f supabase/tests/security.sql
-- Ogni controllo che fallisce interrompe lo script con un errore "FAIL: ...".
-- Si recitano i tre ruoli reali: anonimo (chiave pubblica, chi gioca con un token), Master
-- (account loggato: ruolo `authenticated` + JWT con il suo id) e il proprietario del database (root).
-- Tutto avviene in una transazione annullata.

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

-- Cambia "chi parla": 'root', 'anon', oppure l'id di un account (Master loggato).
create function pg_temp.act(p_who text, p_anonymous boolean default false) returns void language plpgsql as $$
begin
  if p_who = 'root' then
    perform set_config('request.jwt.claims', '', true);
    execute 'reset role';
  elsif p_who = 'anon' then
    perform set_config('request.jwt.claims', '', true);
    execute 'set local role anon';
  else
    perform set_config('request.jwt.claims', json_build_object('sub', p_who, 'role', 'authenticated', 'is_anonymous', p_anonymous)::text, true);
    execute 'set local role authenticated';
  end if;
end $$;

do $$
declare
  m1 text; m2 text; m3 text;            -- id degli account: Master A, Master B, un terzo
  a record; b record; p1 record; p2 record; x record;
  d jsonb; rev bigint; t text; n int;
  legacy_token constant text := 'ADM-TEST-LEGA-CYXK';
begin
  -- ------------------------------------------------ 0. Account di prova
  perform pg_temp.act('root');
  insert into auth.users (email) values ('a@example.com') returning id::text into m1;
  insert into auth.users (email) values ('b@example.com') returning id::text into m2;
  insert into auth.users (email) values ('c@example.com') returning id::text into m3;

  -- ------------------------------------------------ 0b. Nessuna porta vecchia: niente funzioni con token admin (tranne la rivendicazione)
  perform pg_temp.check(not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proargnames @> array['p_admin_token'] and p.proname <> 'claim_campaign'
  ), 'restano funzioni con il vecchio token admin: ' || coalesce((
    select string_agg(p.oid::regprocedure::text, ', ') from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proargnames @> array['p_admin_token'] and p.proname <> 'claim_campaign'), ''));
  perform pg_temp.check(not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = '_admin_campaign'),
    'il vecchio helper _admin_campaign è stato tolto');
  perform pg_temp.check((select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname in ('create_campaign', 'rename_campaign', 'delete_campaign', 'list_characters', 'create_character', 'rename_character', 'rotate_player_token', 'delete_character')) = 8,
    'ogni funzione di gestione esiste una sola volta (nessun overload vecchio)');

  -- ------------------------------------------------ 1. Accesso diretto e funzioni interne
  perform pg_temp.act('anon');
  perform pg_temp.fails_with('select * from campaigns', 'permission denied for table campaigns');
  perform pg_temp.fails_with('select * from characters', 'permission denied for table characters');
  perform pg_temp.fails_with('select * from settings', 'permission denied for table settings');
  perform pg_temp.fails_with($q$insert into campaigns (name) values ('x')$q$, 'permission denied for table campaigns');
  perform pg_temp.act(m1);
  perform pg_temp.fails_with('select * from campaigns', 'permission denied for table campaigns');
  perform pg_temp.fails_with($q$update campaigns set owner_id = null$q$, 'permission denied for table campaigns');
  perform pg_temp.fails_with($q$select public._hash('x')$q$, 'permission denied for function _hash');
  perform pg_temp.fails_with($q$select public._me()$q$, 'permission denied for function _me');
  perform pg_temp.fails_with($q$select public._resolve_character('x', null)$q$, 'permission denied for function _resolve_character');
  perform pg_temp.fails_with($q$select public._owned_campaign(null)$q$, 'permission denied for function _owned_campaign');
  perform pg_temp.fails_with($q$select public._jsonb_deep_merge('{}', '{}')$q$, 'permission denied for function _jsonb_deep_merge');
  perform pg_temp.fails_with($q$select set_creation_code('hack')$q$, 'permission denied for function set_creation_code');

  -- ------------------------------------------------ 2. Senza account non si gestisce nulla
  perform pg_temp.act('anon');
  perform pg_temp.fails_with($q$select * from create_campaign('Intrusa')$q$, 'permission denied for function create_campaign');
  perform pg_temp.fails_with($q$select * from list_campaigns()$q$, 'permission denied for function list_campaigns');
  perform pg_temp.fails_with($q$select * from claim_campaign('ADM-AAAA-AAAA-AAAA')$q$, 'permission denied for function claim_campaign');
  perform pg_temp.fails_with($q$select * from list_characters('00000000-0000-0000-0000-000000000000')$q$, 'permission denied for function list_characters');
  perform pg_temp.fails_with($q$select delete_campaign('00000000-0000-0000-0000-000000000000')$q$, 'permission denied for function delete_campaign');

  -- Un accesso anonimo di Supabase ha il ruolo "authenticated" ma non è un Master
  perform pg_temp.act(m3, true);
  perform pg_temp.fails_with($q$select * from create_campaign('Anonima')$q$, 'auth_required');
  perform pg_temp.fails_with($q$select * from list_campaigns()$q$, 'auth_required');
  perform pg_temp.fails_with($q$select * from claim_campaign('ADM-AAAA-AAAA-AAAA')$q$, 'auth_required');

  -- ------------------------------------------------ 3. Creazione campagne (account) e codice di creazione
  perform pg_temp.act(m1);
  perform pg_temp.check(creation_requires_code() = false, 'senza codice impostato: nessun obbligo');
  perform pg_temp.fails_with($q$select * from create_campaign('   ')$q$, 'invalid_name');
  perform pg_temp.act('root');
  perform set_creation_code('  la mia frase  ');
  perform pg_temp.check((select value from settings where key = 'creation_code_hash') <> 'la mia frase', 'il codice non è salvato in chiaro');
  perform pg_temp.act(m1);
  perform pg_temp.check(creation_requires_code() = true, 'codice impostato: richiesto');
  perform pg_temp.fails_with($q$select * from create_campaign('Intrusa')$q$, 'invalid_code');
  perform pg_temp.fails_with($q$select * from create_campaign('Intrusa', '')$q$, 'invalid_code');
  perform pg_temp.fails_with($q$select * from create_campaign('Intrusa', 'sbagliato')$q$, 'invalid_code');
  perform pg_temp.fails_with($q$select * from create_campaign('Intrusa', 'LA MIA FRASE')$q$, 'invalid_code');
  perform pg_temp.check((select count(*) from pg_proc where proname = 'create_campaign') = 1, 'nessun overload di create_campaign');
  select * into a from create_campaign('Curse of Strahd', 'la mia frase');
  perform pg_temp.act('anon');
  perform pg_temp.check(creation_requires_code() = true, 'anche chi non ha account vede se serve il codice');
  perform pg_temp.act('root');
  perform set_creation_code(null);
  perform pg_temp.act(m2);
  perform pg_temp.check(creation_requires_code() = false, 'codice rimosso');
  select * into b from create_campaign('Altra campagna');
  perform pg_temp.act('root');
  perform pg_temp.check((select owner_id::text from campaigns where id = a.campaign_id) = m1, 'il proprietario è chi l''ha creata');
  perform pg_temp.check((select owner_id::text from campaigns where id = b.campaign_id) = m2, 'il proprietario dell''altra');
  perform pg_temp.check((select admin_token_hash from campaigns where id = a.campaign_id) is null, 'nessun token admin per le campagne nuove');

  perform pg_temp.act(m1);
  perform pg_temp.check((select count(*) from list_campaigns()) = 1, 'ogni Master vede solo le proprie campagne');
  perform pg_temp.check((select campaign_name from list_campaigns()) = 'Curse of Strahd', 'nome campagna');
  perform pg_temp.act(m3);
  perform pg_temp.check((select count(*) from list_campaigns()) = 0, 'un account senza campagne non ne vede');

  -- ------------------------------------------------ 4. Schede e token dei giocatori
  perform pg_temp.act(m1);
  select * into p1 from create_character(a.campaign_id, 'Mario');
  select * into p2 from create_character(a.campaign_id, 'Luigi');
  perform pg_temp.act(m2);
  select * into x from create_character(b.campaign_id, 'Estraneo');
  perform pg_temp.check(p1.player_token ~ '^PG-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$', 'formato token giocatore');
  perform pg_temp.check(p1.player_token <> p2.player_token, 'token diversi');

  perform pg_temp.act('anon');
  perform pg_temp.check((select character_id from resolve_token(p1.player_token)) = p1.id, 'login giocatore → la sua scheda');
  perform pg_temp.check((select role from resolve_token(p1.player_token)) = 'player', 'ruolo player');
  perform pg_temp.fails_with($q$select * from resolve_token('PG-AAAA-AAAA-AAAA')$q$, 'invalid_token');
  perform pg_temp.fails_with($q$select * from resolve_token('')$q$, 'invalid_token');
  perform pg_temp.fails_with($q$select * from resolve_token(null)$q$, 'invalid_token');

  -- ------------------------------------------------ 5. Un giocatore non esce dalla sua scheda
  perform pg_temp.fails_with(format($q$select * from get_character(%L, %L)$q$, p1.player_token, p2.id), 'forbidden');
  perform pg_temp.fails_with(format($q$select * from save_character(%L, %L, '{"x":1}')$q$, p1.player_token, p2.id), 'forbidden');
  perform pg_temp.fails_with(format($q$select * from character_revision(%L, %L)$q$, p1.player_token, p2.id), 'forbidden');
  perform pg_temp.fails_with(format($q$select * from get_character(null, %L)$q$, p1.id), 'invalid_token');   -- senza token e senza account
  perform pg_temp.fails_with('select * from get_character()', 'invalid_token');
  perform pg_temp.fails_with(format($q$select * from save_character(null, %L, '{"x":1}')$q$, p1.id), 'invalid_token');

  -- ------------------------------------------------ 6. Isolamento tra Master e tra campagne
  perform pg_temp.act(m2);   -- Master B tocca la campagna di Master A
  perform pg_temp.fails_with(format($q$select * from get_character(null, %L)$q$, p1.id), 'not_found');
  perform pg_temp.fails_with(format($q$select * from save_character(null, %L, '{"x":1}')$q$, p1.id), 'not_found');
  perform pg_temp.fails_with(format($q$select * from character_revision(null, %L)$q$, p1.id), 'not_found');
  perform pg_temp.fails_with(format($q$select * from list_characters(%L)$q$, a.campaign_id), 'not_found');
  perform pg_temp.fails_with(format($q$select * from create_character(%L, 'x')$q$, a.campaign_id), 'not_found');
  perform pg_temp.fails_with(format($q$select rename_campaign(%L, 'HACK')$q$, a.campaign_id), 'not_found');
  perform pg_temp.fails_with(format($q$select delete_campaign(%L)$q$, a.campaign_id), 'not_found');
  perform pg_temp.fails_with(format($q$select rename_character(%L, 'HACK')$q$, p1.id), 'not_found');
  perform pg_temp.fails_with(format($q$select rotate_player_token(%L)$q$, p1.id), 'not_found');
  perform pg_temp.fails_with(format($q$select delete_character(%L)$q$, p1.id), 'not_found');
  perform pg_temp.act(m3);   -- un account senza campagne
  perform pg_temp.fails_with(format($q$select * from get_character(null, %L)$q$, p1.id), 'not_found');
  perform pg_temp.fails_with('select * from get_character()', 'not_found');
  perform pg_temp.fails_with(format($q$select * from list_characters(%L)$q$, a.campaign_id), 'not_found');
  -- il token di un giocatore non dà poteri da Master, nemmeno a chi ha un account
  perform pg_temp.fails_with(format($q$select rotate_player_token(%L)$q$, p1.id), 'not_found');
  perform pg_temp.check((select revision from get_character(p1.player_token)) = 0, 'ma con il token si usa la scheda da giocatore');
  perform pg_temp.act('root');
  perform pg_temp.check((select count(*) from characters where campaign_id = a.campaign_id) = 2, 'nulla è stato cancellato');
  perform pg_temp.check((select label from characters where id = p1.id) = 'Mario', 'nulla è stato rinominato');

  perform pg_temp.act(m1);
  perform pg_temp.check((select count(*) from list_characters(a.campaign_id)) = 2, 'il proprietario vede le sue schede');
  perform pg_temp.act(m2);
  perform pg_temp.check((select count(*) from list_characters(b.campaign_id)) = 1, 'elenco dell''altra campagna');

  -- ------------------------------------------------ 7. Salvataggio: fusione in profondità
  perform pg_temp.act('anon');
  select revision into rev from save_character(p1.player_token, null, '{"combat":{"hpCurrent":10,"hpMax":10,"speed":9},"weapons":[1,2]}');
  perform pg_temp.check(rev = 1, 'prima revisione');
  perform pg_temp.act(m1);   -- il Master toglie PF; poi il giocatore cambia la velocità: nessuno perde la modifica
  perform save_character(null, p1.id, '{"combat":{"hpCurrent":3}}');
  perform pg_temp.check((select updated_by from get_character(null, p1.id)) = 'admin', 'updated_by = admin');
  perform pg_temp.act('anon');
  select data into d from save_character(p1.player_token, null, '{"combat":{"speed":12}}');
  perform pg_temp.check(d = '{"combat":{"hpCurrent":3,"hpMax":10,"speed":12},"weapons":[1,2]}', 'merge in profondità: ' || d::text);
  select data into d from save_character(p1.player_token, null, '{"weapons":[9]}');
  perform pg_temp.check(d -> 'weapons' = '[9]', 'gli array si sostituiscono');
  perform pg_temp.check((select updated_by from get_character(p1.player_token)) = 'player', 'updated_by = player');
  perform pg_temp.check((select character_revision(p1.player_token)) = 4, 'revisione incrementata a ogni salvataggio');
  perform pg_temp.act(m1);
  perform pg_temp.check((select character_revision(null, p1.id)) = 4, 'il Master vede la stessa revisione');
  perform pg_temp.check((select char_name from list_characters(a.campaign_id) where id = p2.id) = '', 'nome vuoto per scheda nuova');
  perform pg_temp.act('anon');
  perform save_character(p2.player_token, null, '{"info":{"name":"Luigi Verdi"}}');
  perform pg_temp.act(m1);
  perform pg_temp.check((select char_name from list_characters(a.campaign_id) where id = p2.id) = 'Luigi Verdi', 'nome della scheda nell''elenco');

  perform pg_temp.act('anon');
  perform pg_temp.fails_with(format($q$select * from save_character(%L, null, '[1]')$q$, p1.player_token), 'invalid_data');
  perform pg_temp.fails_with(format($q$select * from save_character(%L, null, 'null')$q$, p1.player_token), 'invalid_data');
  perform pg_temp.fails_with(format($q$select * from save_character(%L, null, %L)$q$, p1.player_token, jsonb_build_object('big', repeat('x', 140000))),
    'new row for relation "characters" violates check constraint "characters_data_check"');

  -- ------------------------------------------------ 8. Gestione da parte del Master
  perform pg_temp.act(m1);
  perform rename_character(p1.id, '  Mario Rossi ');
  perform pg_temp.check((select label from list_characters(a.campaign_id) where id = p1.id) = 'Mario Rossi', 'rename_character');
  t := rotate_player_token(p1.id);
  perform pg_temp.check(t <> p1.player_token and t like 'PG-%', 'nuovo token');
  perform pg_temp.act('anon');
  perform pg_temp.fails_with(format($q$select * from get_character(%L)$q$, p1.player_token), 'invalid_token');
  perform pg_temp.check((select revision from get_character(t)) = 4, 'il nuovo token vede la stessa scheda');

  -- ------------------------------------------------ 9. Limite di schede per campagna
  perform pg_temp.act(m2);
  for n in 1..48 loop perform create_character(b.campaign_id, 'x'); end loop;   -- 1 + 48 = 49
  perform create_character(b.campaign_id, 'cinquantesima');
  perform pg_temp.fails_with(format($q$select * from create_character(%L, 'una di troppo')$q$, b.campaign_id), 'limit_reached');

  -- ------------------------------------------------ 10. Campagne della versione precedente: si rivendicano una volta sola
  perform pg_temp.act('root');
  insert into campaigns (name, admin_token_hash) values ('Vecchia', encode(extensions.digest(legacy_token, 'sha256'), 'hex'));
  perform pg_temp.act('anon');
  perform pg_temp.fails_with(format($q$select * from resolve_token(%L)$q$, legacy_token), 'legacy_admin_token');
  perform pg_temp.act(m3);
  perform pg_temp.fails_with(format($q$select * from resolve_token(%L)$q$, legacy_token), 'legacy_admin_token');
  perform pg_temp.fails_with($q$select * from claim_campaign('ADM-AAAA-AAAA-AAAA')$q$, 'invalid_token');
  perform pg_temp.fails_with($q$select * from claim_campaign('')$q$, 'invalid_token');
  perform pg_temp.fails_with($q$select * from claim_campaign(null)$q$, 'invalid_token');
  perform pg_temp.fails_with(format($q$select * from claim_campaign(%L)$q$, p1.player_token), 'invalid_token');   -- un token giocatore non rivendica nulla
  select * into x from claim_campaign(legacy_token);
  perform pg_temp.check(x.campaign_name = 'Vecchia', 'rivendicata');
  perform pg_temp.check((select count(*) from list_campaigns()) = 1, 'ora è del Master C');
  perform pg_temp.fails_with(format($q$select * from claim_campaign(%L)$q$, legacy_token), 'invalid_token');   -- una volta sola
  perform pg_temp.act(m2);
  perform pg_temp.fails_with(format($q$select * from claim_campaign(%L)$q$, legacy_token), 'invalid_token');   -- nemmeno da un altro account
  perform pg_temp.act('anon');
  perform pg_temp.fails_with(format($q$select * from resolve_token(%L)$q$, legacy_token), 'invalid_token');   -- e il vecchio token non vale più
  perform pg_temp.act('root');
  perform pg_temp.check((select admin_token_hash from campaigns where name = 'Vecchia') is null, 'hash del vecchio token eliminato');
  -- difesa in più: anche in uno stato incoerente (proprietario E vecchio token) non si può rubare la campagna
  insert into campaigns (name, owner_id, admin_token_hash)
    values ('Ibrida', m2::uuid, encode(extensions.digest('ADM-IBRI-DACA-MPNX', 'sha256'), 'hex'));
  perform pg_temp.act(m3);
  perform pg_temp.fails_with($q$select * from claim_campaign('ADM-IBRI-DACA-MPNX')$q$, 'invalid_token');
  perform pg_temp.act('root');
  -- (se il database arriva da un aggiornamento, c'è anche la campagna di legacy.sql)
  if exists (select 1 from campaigns where name = 'Campagna legacy' and owner_id is null) then
    -- il giocatore esistente non si accorge dell'aggiornamento: stesso token, stessi dati
    perform pg_temp.act('anon');
    perform pg_temp.check((select revision from get_character('PG-LEGA-CYPL-AYER')) = 3, 'aggiornamento: la revisione del giocatore esistente');
    perform pg_temp.check((select data -> 'info' ->> 'name' from get_character('PG-LEGA-CYPL-AYER')) = 'Lia Vecchia', 'aggiornamento: i dati del giocatore esistente');
    select * into x from save_character('PG-LEGA-CYPL-AYER', null, '{"info":{"name":"Lia Nuova"}}');
    perform pg_temp.check(x.revision = 4, 'aggiornamento: il giocatore esistente può ancora salvare');
    perform pg_temp.act(m1);
    select * into x from claim_campaign('ADM-LEGA-CYCA-MPNX');
    perform pg_temp.check(x.campaign_name = 'Campagna legacy', 'campagna preesistente rivendicata dopo l''aggiornamento');
    perform pg_temp.check((select count(*) from list_characters(x.campaign_id)) = 1, 'la scheda del giocatore esistente è nella campagna rivendicata');
  end if;

  -- ------------------------------------------------ 11. Eliminazioni
  perform pg_temp.act(m1);
  perform delete_character(p2.id);
  perform pg_temp.act('anon');
  perform pg_temp.fails_with(format($q$select * from get_character(%L)$q$, p2.player_token), 'invalid_token');
  perform pg_temp.act(m1);
  perform rename_campaign(a.campaign_id, 'Nuovo nome');
  perform pg_temp.check((select campaign_name from list_campaigns() where campaign_id = a.campaign_id) = 'Nuovo nome', 'rename campagna');
  perform pg_temp.fails_with(format($q$select rename_campaign(%L, '  ')$q$, a.campaign_id), 'invalid_name');
  -- se l'account viene eliminato, i giocatori non perdono la scheda (la campagna resta, senza proprietario)
  perform pg_temp.act('root');
  delete from auth.users where id::text = m1;
  perform pg_temp.check((select owner_id from campaigns where id = a.campaign_id) is null, 'campagna senza proprietario');
  perform pg_temp.act('anon');
  perform pg_temp.check((select revision from get_character(t)) = 4, 'il giocatore ha ancora la sua scheda');
  perform pg_temp.act(m2);
  perform delete_campaign(b.campaign_id);
  perform pg_temp.fails_with(format($q$select * from list_characters(%L)$q$, b.campaign_id), 'not_found');
  perform pg_temp.act('root');
  raise notice 'OK: tutti i controlli di sicurezza sono passati';
end $$;

rollback;
