-- Prepara un Postgres "nudo" (CI, sviluppo locale) con ciò che Supabase fornisce già:
-- lo schema "extensions", i ruoli anon / authenticated e lo schema "auth" (tabella degli
-- account e auth.uid(), che legge l'identità dal JWT). Su Supabase NON serve.
create schema if not exists extensions;
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
grant usage on schema public to anon, authenticated;

create schema if not exists auth;
create table if not exists auth.users (
  id    uuid primary key default gen_random_uuid(),
  email text
);
-- Stessa definizione di Supabase: l'identità arriva dal JWT messo da PostgREST nelle impostazioni di sessione.
create or replace function auth.uid() returns uuid language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
