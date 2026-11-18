-- =====================================================================
-- Backend per login a token e collaborazione sulla scheda (Supabase).
--
-- Come si usa: incolla questo file nel "SQL Editor" di Supabase e premi Run.
-- È idempotente: puoi rilanciarlo dopo un aggiornamento del repository.
--
-- Modello di sicurezza
--   * Nessuna email/password: l'accesso è un TOKEN univoco.
--       - token admin  (ADM-XXXX-XXXX-XXXX): gestisce una campagna e tutte le sue schede
--       - token player (PG-XXXX-XXXX-XXXX):  una sola scheda (1 token = 1 giocatore = 1 scheda)
--   * Le tabelle hanno RLS attiva e NESSUNA policy: con la chiave "anon" non si
--     può leggere né scrivere nulla direttamente.
--   * Tutto passa da funzioni SECURITY DEFINER che ricevono il token come
--     argomento e ne verificano ruolo e ambito.
--   * Il token admin è salvato solo come hash SHA-256 (si vede una volta sola alla
--     creazione). I token dei giocatori sono salvati in chiaro perché l'admin
--     deve poterli ricopiare: sono leggibili solo tramite il token admin.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------- Tabelle

create table if not exists public.campaigns (
  id               uuid primary key default gen_random_uuid(),
  name             text not null check (char_length(name) between 1 and 80),
  admin_token_hash text not null unique,
  created_at       timestamptz not null default now()
);

create table if not exists public.characters (
  id           uuid primary key default gen_random_uuid(),
  campaign_id  uuid not null references public.campaigns (id) on delete cascade,
  player_token text not null unique,
  label        text not null default '' check (char_length(label) <= 80),
  data         jsonb not null default '{}'::jsonb check (octet_length(data::text) <= 262144),
  revision     bigint not null default 0,
  updated_by   text not null default '',
  updated_at   timestamptz not null default now(),
  created_at   timestamptz not null default now()
);

create index if not exists characters_campaign_idx on public.characters (campaign_id);

alter table public.campaigns  enable row level security;
alter table public.characters enable row level security;
revoke all on public.campaigns, public.characters from anon, authenticated;

-- ------------------------------------------------------- Funzioni interne
-- Prefisso "_" e nessun GRANT: non sono chiamabili dal client.

create or replace function public._hash(p_token text)
returns text language sql immutable
set search_path = public, extensions as $$
  select encode(digest(coalesce(p_token, ''), 'sha256'), 'hex');
$$;

-- Token casuale a 60 bit, alfabeto senza caratteri ambigui (niente I, O, 0, 1).
create or replace function public._gen_token(p_prefix text)
returns text language plpgsql
set search_path = public, extensions as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- 32 caratteri: nessun bias
  bytes bytea := gen_random_bytes(12);
  result text := p_prefix;
  i int;
begin
  for i in 0..11 loop
    if i % 4 = 0 then result := result || '-'; end if;
    result := result || substr(alphabet, (get_byte(bytes, i) % 32) + 1, 1);
  end loop;
  return result;
end $$;

-- Token non valido: piccola attesa contro i tentativi a raffica, poi errore.
create or replace function public._deny()
returns void language plpgsql as $$
begin
  perform pg_sleep(0.4);
  raise exception 'invalid_token';
end $$;

-- Id della campagna a cui il token admin dà accesso (altrimenti errore).
create or replace function public._admin_campaign(p_token text)
returns uuid language plpgsql
set search_path = public, extensions as $$
declare cid uuid;
begin
  select id into cid from campaigns where admin_token_hash = _hash(p_token);
  if cid is null then perform _deny(); end if;
  return cid;
end $$;

-- Risolve (token, scheda richiesta) → scheda + ruolo.
--   admin  → qualunque scheda della sua campagna (p_character_id obbligatorio)
--   player → solo la propria (p_character_id, se presente, deve coincidere)
create or replace function public._resolve_character(p_token text, p_character_id uuid)
returns table (character_id uuid, role text)
language plpgsql
set search_path = public, extensions as $$
declare
  cid uuid;
  chid uuid;
begin
  select id into cid from campaigns where admin_token_hash = _hash(p_token);
  if cid is not null then
    select c.id into chid from characters c where c.id = p_character_id and c.campaign_id = cid;
    if chid is null then raise exception 'not_found'; end if;
    return query select chid, 'admin'::text;
    return;
  end if;

  select c.id into chid from characters c where c.player_token = p_token;
  if chid is null then perform _deny(); end if;
  if p_character_id is not null and p_character_id <> chid then raise exception 'forbidden'; end if;
  return query select chid, 'player'::text;
end $$;

-- ---------------------------------------------------------- API pubblica

-- Crea una campagna: il token admin viene restituito UNA volta sola.
create or replace function public.create_campaign(p_name text)
returns table (campaign_id uuid, campaign_name text, admin_token text)
language plpgsql security definer
set search_path = public, extensions as $$
declare
  token text := _gen_token('ADM');
  clean text := left(btrim(coalesce(p_name, '')), 80);
  cid uuid;
begin
  if clean = '' then raise exception 'invalid_name'; end if;
  insert into campaigns (name, admin_token_hash) values (clean, _hash(token)) returning id into cid;
  return query select cid, clean, token;
end $$;

-- Chi sono? Usata al login.
create or replace function public.resolve_token(p_token text)
returns table (role text, campaign_id uuid, campaign_name text, character_id uuid)
language plpgsql security definer
set search_path = public, extensions as $$
begin
  return query
    select 'admin'::text, c.id, c.name, null::uuid
    from campaigns c where c.admin_token_hash = _hash(p_token);
  if found then return; end if;

  return query
    select 'player'::text, c.id, c.name, ch.id
    from characters ch join campaigns c on c.id = ch.campaign_id
    where ch.player_token = p_token;
  if found then return; end if;

  perform _deny();
end $$;

create or replace function public.rename_campaign(p_admin_token text, p_name text)
returns void language plpgsql security definer
set search_path = public, extensions as $$
declare
  cid uuid := _admin_campaign(p_admin_token);
  clean text := left(btrim(coalesce(p_name, '')), 80);
begin
  if clean = '' then raise exception 'invalid_name'; end if;
  update campaigns set name = clean where id = cid;
end $$;

create or replace function public.delete_campaign(p_admin_token text)
returns void language plpgsql security definer
set search_path = public, extensions as $$
declare cid uuid := _admin_campaign(p_admin_token);
begin
  delete from campaigns where id = cid;
end $$;

-- Elenco schede della campagna (solo admin), con i token da ricopiare.
create or replace function public.list_characters(p_admin_token text)
returns table (id uuid, label text, char_name text, player_token text, revision bigint, updated_at timestamptz, updated_by text)
language plpgsql security definer
set search_path = public, extensions as $$
declare cid uuid := _admin_campaign(p_admin_token);
begin
  return query
    select c.id, c.label, coalesce(c.data -> 'info' ->> 'name', ''), c.player_token, c.revision, c.updated_at, c.updated_by
    from characters c where c.campaign_id = cid order by c.created_at;
end $$;

-- Crea una scheda vuota con il suo token giocatore (massimo 50 per campagna).
create or replace function public.create_character(p_admin_token text, p_label text default '')
returns table (id uuid, player_token text)
language plpgsql security definer
set search_path = public, extensions as $$
declare
  cid uuid := _admin_campaign(p_admin_token);
  token text := _gen_token('PG');
  chid uuid;
begin
  if (select count(*) from characters where campaign_id = cid) >= 50 then
    raise exception 'limit_reached';
  end if;
  insert into characters (campaign_id, player_token, label)
    values (cid, token, left(btrim(coalesce(p_label, '')), 80))
    returning characters.id into chid;
  return query select chid, token;
end $$;

create or replace function public.rename_character(p_admin_token text, p_character_id uuid, p_label text)
returns void language plpgsql security definer
set search_path = public, extensions as $$
declare cid uuid := _admin_campaign(p_admin_token);
begin
  update characters set label = left(btrim(coalesce(p_label, '')), 80)
   where id = p_character_id and campaign_id = cid;
end $$;

-- Genera un nuovo token giocatore: il vecchio smette di funzionare subito.
create or replace function public.rotate_player_token(p_admin_token text, p_character_id uuid)
returns text language plpgsql security definer
set search_path = public, extensions as $$
declare
  cid uuid := _admin_campaign(p_admin_token);
  token text := _gen_token('PG');
begin
  update characters set player_token = token
   where id = p_character_id and campaign_id = cid;
  if not found then raise exception 'not_found'; end if;
  return token;
end $$;

create or replace function public.delete_character(p_admin_token text, p_character_id uuid)
returns void language plpgsql security definer
set search_path = public, extensions as $$
declare cid uuid := _admin_campaign(p_admin_token);
begin
  delete from characters where id = p_character_id and campaign_id = cid;
end $$;

-- Legge una scheda. Admin: indicare p_character_id. Player: lo si può omettere.
create or replace function public.get_character(p_token text, p_character_id uuid default null)
returns table (id uuid, data jsonb, revision bigint, updated_at timestamptz, updated_by text)
language plpgsql security definer
set search_path = public, extensions as $$
declare r record;
begin
  select * into r from _resolve_character(p_token, p_character_id);
  return query
    select c.id, c.data, c.revision, c.updated_at, c.updated_by
    from characters c where c.id = r.character_id;
end $$;

-- Salva solo le sezioni modificate (chiavi di primo livello di p_changes) e
-- restituisce lo stato completo risultante, così il client si riallinea con
-- eventuali modifiche fatte in parallelo da un'altra persona su sezioni diverse.
create or replace function public.save_character(p_token text, p_character_id uuid, p_changes jsonb)
returns table (data jsonb, revision bigint, updated_by text)
language plpgsql security definer
set search_path = public, extensions as $$
declare r record;
begin
  if p_changes is null or jsonb_typeof(p_changes) <> 'object' then raise exception 'invalid_data'; end if;
  select * into r from _resolve_character(p_token, p_character_id);

  return query
    update characters c
       set data = c.data || p_changes,
           revision = c.revision + 1,
           updated_by = r.role,
           updated_at = now()
     where c.id = r.character_id
    returning c.data, c.revision, c.updated_by;
end $$;

-- -------------------------------------------------------------- Permessi
-- Di default Postgres dà EXECUTE a PUBLIC: lo togliamo e lo diamo solo alle
-- funzioni pubbliche, mai a quelle interne.

revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function
  public.create_campaign(text),
  public.resolve_token(text),
  public.rename_campaign(text, text),
  public.delete_campaign(text),
  public.list_characters(text),
  public.create_character(text, text),
  public.rename_character(text, uuid, text),
  public.rotate_player_token(text, uuid),
  public.delete_character(text, uuid),
  public.get_character(text, uuid),
  public.save_character(text, uuid, jsonb)
to anon, authenticated;
