-- Simula un database che ha già la VERSIONE PRECEDENTE dello schema (create_campaign senza
-- codice). Va eseguito prima di schema.sql: dopo l'aggiornamento il vecchio overload deve
-- sparire, altrimenti chiunque potrebbe creare campagne chiamandolo e saltare il codice.
create function public.create_campaign(p_name text)
returns table (campaign_id uuid, campaign_name text, admin_token text)
language sql as $$ select null::uuid, p_name, 'vecchia versione'::text $$;
