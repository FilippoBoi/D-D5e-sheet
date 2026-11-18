-- Simula un database con la VERSIONE PRECEDENTE dello schema (token admin, niente account),
-- cioè com'è oggi un progetto già installato. Va eseguito prima di schema.sql: l'aggiornamento
-- deve togliere le vecchie funzioni con token (altrimenti resterebbero porte aperte) e
-- lasciare rivendicabile la campagna già esistente.
create extension if not exists pgcrypto with schema extensions;

create table public.campaigns (
  id               uuid primary key default gen_random_uuid(),
  name             text not null check (char_length(name) between 1 and 80),
  admin_token_hash text not null unique,
  created_at       timestamptz not null default now()
);

-- Una campagna creata con la versione precedente: il suo token admin è ADM-LEGA-CYCA-MPNX.
insert into public.campaigns (name, admin_token_hash)
values ('Campagna legacy', encode(extensions.digest('ADM-LEGA-CYCA-MPNX', 'sha256'), 'hex'));

-- Vecchie funzioni che autorizzavano con il token admin.
create function public.create_campaign(p_name text)
returns table (campaign_id uuid, campaign_name text, admin_token text)
language sql as $$ select null::uuid, p_name, 'vecchia versione'::text $$;
create function public.create_campaign(p_name text, p_code text default null)
returns table (campaign_id uuid, campaign_name text, admin_token text)
language sql as $$ select null::uuid, p_name, 'vecchia versione'::text $$;
create function public.rename_campaign(p_admin_token text, p_name text) returns void language sql as $$ select 1 $$;
create function public.delete_campaign(p_admin_token text) returns void language sql as $$ select 1 $$;
create function public.list_characters(p_admin_token text)
returns table (id uuid) language sql as $$ select null::uuid $$;
create function public.create_character(p_admin_token text, p_label text default '')
returns table (id uuid, player_token text) language sql as $$ select null::uuid, 'x'::text $$;
create function public.rename_character(p_admin_token text, p_character_id uuid, p_label text) returns void language sql as $$ select 1 $$;
create function public.rotate_player_token(p_admin_token text, p_character_id uuid) returns text language sql as $$ select 'x'::text $$;
create function public.delete_character(p_admin_token text, p_character_id uuid) returns void language sql as $$ select 1 $$;
