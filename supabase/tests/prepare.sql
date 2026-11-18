-- Prepara un Postgres "nudo" (CI, sviluppo locale) con ciò che Supabase fornisce già:
-- lo schema "extensions" e i ruoli anon / authenticated. Su Supabase NON serve.
create schema if not exists extensions;
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
grant usage on schema public to anon, authenticated;
