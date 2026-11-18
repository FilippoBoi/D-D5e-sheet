-- =====================================================================
-- Backend per collaborazione sulla scheda (Supabase): Master con account, giocatori con token.
--
-- Come si usa: incolla questo file nel "SQL Editor" di Supabase e premi Run.
-- È idempotente: puoi rilanciarlo dopo un aggiornamento del repository.
-- Prima del primo uso: Authentication → URL Configuration (vedi README).
--
-- Modello di sicurezza
--   * MASTER = account Supabase Auth (login con email, link magico). Ogni campagna ha UN
--     solo proprietario (owner_id = auth.uid()); le funzioni admin ammettono solo lui.
--     Il token admin non esiste più: restano solo le campagne create con la versione
--     precedente, che si rivendicano UNA volta con il vecchio token (claim_campaign).
--   * GIOCATORE = token (PG-XXXX-XXXX-XXXX), 1 token = 1 giocatore = 1 scheda. Nessun account.
--   * Le tabelle hanno RLS attiva e NESSUNA policy: con la chiave pubblica non si
--     può leggere né scrivere nulla direttamente.
--   * Tutto passa da funzioni SECURITY DEFINER che verificano chi chiama (account o token).
--   * I token dei giocatori sono salvati in chiaro perché il Master deve poterli
--     ricopiare: sono leggibili solo dal proprietario della campagna.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------- Tabelle

create table if not exists public.campaigns (
  id               uuid primary key default gen_random_uuid(),
  name             text not null check (char_length(name) between 1 and 80),
  owner_id         uuid references auth.users (id) on delete set null,   -- il Master
  admin_token_hash text unique,    -- SOLO campagne della versione precedente, finché non rivendicate
  created_at       timestamptz not null default now()
);

-- Aggiornamento da una versione precedente (senza account).
alter table public.campaigns add column if not exists owner_id uuid references auth.users (id) on delete set null;
alter table public.campaigns alter column admin_token_hash drop not null;
create index if not exists campaigns_owner_idx on public.campaigns (owner_id);

create table if not exists public.characters (
  id           uuid primary key default gen_random_uuid(),
  campaign_id  uuid not null references public.campaigns (id) on delete cascade,
  player_token text not null unique,
  label        text not null default '' check (char_length(label) <= 80),
  data         jsonb not null default '{}'::jsonb check (octet_length(data::text) <= 131072),
  revision     bigint not null default 0,
  updated_by   text not null default '',
  updated_at   timestamptz not null default now(),
  created_at   timestamptz not null default now()
);

-- Impostazioni del progetto (oggi: solo l'hash del codice di creazione).
create table if not exists public.settings (
  key   text primary key,
  value text not null
);

create index if not exists characters_campaign_idx on public.characters (campaign_id);

alter table public.campaigns  enable row level security;
alter table public.characters enable row level security;
alter table public.settings   enable row level security;
revoke all on public.campaigns, public.characters, public.settings from anon, authenticated;

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

-- Token non valido. Niente pg_sleep "anti brute force": terrebbe occupata una connessione
-- del database per ogni tentativo e permetterebbe a chiunque di esaurirle con poche richieste.
-- La protezione è l'entropia del token (60 bit: 2^60 tentativi).
create or replace function public._deny()
returns void language plpgsql as $$
begin
  raise exception 'invalid_token';
end $$;

-- Fusione ricorsiva: gli oggetti si fondono, tutto il resto (numeri, testi, array) si sostituisce.
-- Stessa semantica di deepMerge in js/sync/diff.js.
create or replace function public._jsonb_deep_merge(a jsonb, b jsonb)
returns jsonb language sql immutable
set search_path = public as $$
  select case
    when jsonb_typeof(a) = 'object' and jsonb_typeof(b) = 'object' then
      coalesce((
        select jsonb_object_agg(k, case
          when a ? k and b ? k then public._jsonb_deep_merge(a -> k, b -> k)
          when b ? k then b -> k
          else a -> k end)
        from (select jsonb_object_keys(a) as k union select jsonb_object_keys(b)) keys
      ), '{}'::jsonb)
    else b
  end;
$$;

-- Chi chiama è un account loggato (altrimenti 'auth_required').
create or replace function public._me()
returns uuid language plpgsql
set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'auth_required'; end if;
  return uid;
end $$;

-- La campagna è del chiamante (altrimenti 'not_found': non si distingue "non esiste" da "non è tua").
create or replace function public._owned_campaign(p_campaign_id uuid)
returns uuid language plpgsql
set search_path = public as $$
declare uid uuid := _me(); cid uuid;
begin
  select m.id into cid from campaigns m where m.id = p_campaign_id and m.owner_id = uid;
  if cid is null then raise exception 'not_found'; end if;
  return cid;
end $$;

-- Come sopra, partendo da una scheda: restituisce la campagna a cui appartiene.
create or replace function public._owned_campaign_of_character(p_character_id uuid)
returns uuid language plpgsql
set search_path = public as $$
declare uid uuid := _me(); cid uuid;
begin
  select m.id into cid
    from characters c join campaigns m on m.id = c.campaign_id
   where c.id = p_character_id and m.owner_id = uid;
  if cid is null then raise exception 'not_found'; end if;
  return cid;
end $$;

-- Risolve (chi chiama, scheda richiesta) → scheda + ruolo.
--   Master (account proprietario della campagna) → qualunque scheda della sua campagna;
--     p_character_id è obbligatorio, p_token si omette.
--   Giocatore (token) → solo la propria; p_character_id, se presente, deve coincidere.
create or replace function public._resolve_character(p_token text, p_character_id uuid)
returns table (character_id uuid, role text)
language plpgsql
set search_path = public, extensions as $$
declare
  uid uuid := auth.uid();
  chid uuid;
begin
  if uid is not null and p_character_id is not null then
    select c.id into chid
      from characters c join campaigns m on m.id = c.campaign_id
     where c.id = p_character_id and m.owner_id = uid;
    if chid is not null then
      return query select chid, 'admin'::text;
      return;
    end if;
  end if;

  if p_token is null or p_token = '' then
    if uid is not null then raise exception 'not_found'; end if;   -- loggato, ma non è la sua scheda
    perform _deny();
  end if;

  select c.id into chid from characters c where c.player_token = p_token;
  if chid is null then perform _deny(); end if;
  if p_character_id is not null and p_character_id <> chid then raise exception 'forbidden'; end if;
  return query select chid, 'player'::text;
end $$;

-- Il codice di creazione è opzionale. Se è impostato, solo chi lo conosce può creare
-- campagne (le campagne esistenti e l'accesso con token non cambiano).
-- Si imposta dal SQL Editor, non dal sito:  select set_creation_code('la tua frase');
-- Per toglierlo:                            select set_creation_code(null);
-- Nel database resta solo l'hash.
create or replace function public.set_creation_code(p_code text)
returns void language plpgsql security definer
set search_path = public, extensions as $$
begin
  if p_code is null or btrim(p_code) = '' then
    delete from settings where key = 'creation_code_hash';
  else
    insert into settings (key, value) values ('creation_code_hash', _hash(btrim(p_code)))
      on conflict (key) do update set value = excluded.value;
  end if;
end $$;

-- Il sito lo usa per mostrare il campo "Codice" solo quando serve.
create or replace function public.creation_requires_code()
returns boolean language sql stable security definer
set search_path = public, extensions as $$
  select exists (select 1 from settings where key = 'creation_code_hash');
$$;

-- Versioni precedenti (token admin): vanno tolte, altrimenti resterebbero overload
-- aggirabili o con un tipo di ritorno diverso.
drop function if exists public._admin_campaign(text);
drop function if exists public.create_campaign(text);
drop function if exists public.create_campaign(text, text);
drop function if exists public.rename_campaign(text, text);
drop function if exists public.delete_campaign(text);
drop function if exists public.list_characters(text);
drop function if exists public.create_character(text, text);
drop function if exists public.rename_character(text, uuid, text);
drop function if exists public.rotate_player_token(text, uuid);
drop function if exists public.delete_character(text, uuid);

-- Crea una campagna: il chiamante (account) ne diventa l'unico proprietario.
create or replace function public.create_campaign(p_name text, p_code text default null)
returns table (campaign_id uuid, campaign_name text)
language plpgsql security definer
set search_path = public, extensions as $$
declare
  uid uuid := _me();
  clean text := left(btrim(coalesce(p_name, '')), 80);
  required text := (select value from settings where key = 'creation_code_hash');
  cid uuid;
begin
  if required is not null and _hash(btrim(coalesce(p_code, ''))) <> required then
    raise exception 'invalid_code';
  end if;
  if clean = '' then raise exception 'invalid_name'; end if;
  insert into campaigns (name, owner_id) values (clean, uid) returning id into cid;
  return query select cid, clean;
end $$;

-- Rivendica UNA campagna creata con la versione precedente (quella con il token admin):
-- il chiamante ne diventa il proprietario e il vecchio token smette di valere.
create or replace function public.claim_campaign(p_admin_token text)
returns table (campaign_id uuid, campaign_name text)
language plpgsql security definer
set search_path = public, extensions as $$
declare
  uid uuid := _me();
  cid uuid;
  nm text;
begin
  update campaigns m
     set owner_id = uid, admin_token_hash = null
   where m.admin_token_hash = _hash(p_admin_token) and m.owner_id is null
  returning m.id, m.name into cid, nm;
  if cid is null then perform _deny(); end if;
  return query select cid, nm;
end $$;

-- Le campagne del chiamante.
create or replace function public.list_campaigns()
returns table (campaign_id uuid, campaign_name text, character_count bigint, created_at timestamptz)
language plpgsql security definer
set search_path = public, extensions as $$
declare uid uuid := _me();
begin
  return query
    select m.id, m.name, (select count(*) from characters c where c.campaign_id = m.id), m.created_at
    from campaigns m where m.owner_id = uid order by m.created_at;
end $$;

-- Chi sono? Usata al login di un GIOCATORE (token). Un vecchio token admin non è più un login:
-- si risponde con un errore dedicato, così il sito può spiegare come rivendicare la campagna.
create or replace function public.resolve_token(p_token text)
returns table (role text, campaign_id uuid, campaign_name text, character_id uuid)
language plpgsql security definer
set search_path = public, extensions as $$
begin
  return query
    select 'player'::text, m.id, m.name, ch.id
    from characters ch join campaigns m on m.id = ch.campaign_id
    where ch.player_token = p_token;
  if found then return; end if;

  if exists (select 1 from campaigns m where m.admin_token_hash = _hash(p_token)) then
    raise exception 'legacy_admin_token';
  end if;
  perform _deny();
end $$;

create or replace function public.rename_campaign(p_campaign_id uuid, p_name text)
returns void language plpgsql security definer
set search_path = public, extensions as $$
declare
  cid uuid := _owned_campaign(p_campaign_id);
  clean text := left(btrim(coalesce(p_name, '')), 80);
begin
  if clean = '' then raise exception 'invalid_name'; end if;
  update campaigns set name = clean where id = cid;
end $$;

create or replace function public.delete_campaign(p_campaign_id uuid)
returns void language plpgsql security definer
set search_path = public, extensions as $$
declare cid uuid := _owned_campaign(p_campaign_id);
begin
  delete from campaigns where id = cid;
end $$;

-- Elenco schede della campagna (solo proprietario), con i token da ricopiare.
create or replace function public.list_characters(p_campaign_id uuid)
returns table (id uuid, label text, char_name text, player_token text, revision bigint, updated_at timestamptz, updated_by text)
language plpgsql security definer
set search_path = public, extensions as $$
declare cid uuid := _owned_campaign(p_campaign_id);
begin
  return query
    select c.id, c.label, coalesce(c.data -> 'info' ->> 'name', ''), c.player_token, c.revision, c.updated_at, c.updated_by
    from characters c where c.campaign_id = cid order by c.created_at;
end $$;

-- Crea una scheda vuota con il suo token giocatore (massimo 50 per campagna).
create or replace function public.create_character(p_campaign_id uuid, p_label text default '')
returns table (id uuid, player_token text)
language plpgsql security definer
set search_path = public, extensions as $$
declare
  cid uuid := _owned_campaign(p_campaign_id);
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

create or replace function public.rename_character(p_character_id uuid, p_label text)
returns void language plpgsql security definer
set search_path = public, extensions as $$
declare cid uuid := _owned_campaign_of_character(p_character_id);
begin
  update characters set label = left(btrim(coalesce(p_label, '')), 80) where id = p_character_id and campaign_id = cid;
end $$;

-- Genera un nuovo token giocatore: il vecchio smette di funzionare subito.
create or replace function public.rotate_player_token(p_character_id uuid)
returns text language plpgsql security definer
set search_path = public, extensions as $$
declare
  cid uuid := _owned_campaign_of_character(p_character_id);
  token text := _gen_token('PG');
begin
  update characters set player_token = token where id = p_character_id and campaign_id = cid;
  return token;
end $$;

create or replace function public.delete_character(p_character_id uuid)
returns void language plpgsql security definer
set search_path = public, extensions as $$
declare cid uuid := _owned_campaign_of_character(p_character_id);
begin
  delete from characters where id = p_character_id and campaign_id = cid;
end $$;

-- Legge una scheda. Master: p_character_id (senza token). Giocatore: il token (p_character_id facoltativo).
create or replace function public.get_character(p_token text default null, p_character_id uuid default null)
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

-- Solo il numero di revisione: è ciò che il polling chiede ogni pochi secondi
-- (pochi byte invece dell'intera scheda); la scheda si scarica solo se è cambiata.
create or replace function public.character_revision(p_token text default null, p_character_id uuid default null)
returns bigint language plpgsql security definer
set search_path = public, extensions as $$
declare r record; rev bigint;
begin
  select * into r from _resolve_character(p_token, p_character_id);
  select c.revision into rev from characters c where c.id = r.character_id;
  return rev;
end $$;

-- Salva solo i campi modificati (p_changes è un documento parziale, fuso in profondità)
-- e restituisce lo stato completo risultante, così il client si riallinea con le
-- modifiche fatte in parallelo da un'altra persona su campi diversi.
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
       set data = public._jsonb_deep_merge(c.data, p_changes),
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

-- Chiunque (anche senza account): codice di creazione richiesto?, login giocatore, scheda con token.
grant execute on function
  public.creation_requires_code(),
  public.resolve_token(text),
  public.get_character(text, uuid),
  public.character_revision(text, uuid),
  public.save_character(text, uuid, jsonb)
to anon, authenticated;

-- Solo con un account (il Master): chi non è loggato riceve 'auth_required'.
grant execute on function
  public.create_campaign(text, text),
  public.claim_campaign(text),
  public.list_campaigns(),
  public.rename_campaign(uuid, text),
  public.delete_campaign(uuid),
  public.list_characters(uuid),
  public.create_character(uuid, text),
  public.rename_character(uuid, text),
  public.rotate_player_token(uuid),
  public.delete_character(uuid)
to authenticated;
