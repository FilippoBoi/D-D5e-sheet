-- Dati di una installazione della versione precedente (token admin, niente account): una campagna
-- esistente e un giocatore. Va eseguito dopo lo schema precedente (supabase/tests/fixtures/) e prima
-- di schema.sql, per provare l'aggiornamento di un database che contiene già dati.
-- Il token admin della campagna è ADM-LEGA-CYCA-MPNX, quello del giocatore PG-LEGA-CYPL-AYER.
insert into public.campaigns (name, admin_token_hash)
values ('Campagna legacy', encode(extensions.digest('ADM-LEGA-CYCA-MPNX', 'sha256'), 'hex'));
insert into public.characters (campaign_id, player_token, label, data, revision)
select id, 'PG-LEGA-CYPL-AYER', 'Lia', '{"info":{"name":"Lia Vecchia"}}', 3 from public.campaigns where name = 'Campagna legacy';
