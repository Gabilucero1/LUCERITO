-- ============================================================================
-- LUCERITO · MIGRACIÓN 001 · Calculadora del día (tabla calc_entries)
-- Qué hace: SOLO agrega una tabla nueva para guardar los importes de la calculadora de "Pedidos".
-- Qué NO hace: no borra ni modifica ninguna tabla, dato, usuaria ni permiso existente.
-- Es segura de ejecutar más de una vez (no falla si ya se ejecutó).
-- Cómo usarla: Supabase → SQL Editor → New query → pegá TODO este archivo → Run.
-- ============================================================================
create table if not exists public.calc_entries (
  id         bigint primary key,
  data       jsonb not null,
  version    integer not null default 1,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists calc_entries_date_idx on public.calc_entries ((data->>'date'));
alter table public.calc_entries enable row level security;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'touch_updated' and tgrelid = 'public.calc_entries'::regclass) then
    create trigger touch_updated before update on public.calc_entries
      for each row execute function public.touch_updated_at();
  end if;
  -- Igual que productos, pedidos, etc.: toda persona ACTIVA puede ver, agregar, corregir y eliminar importes.
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='calc_entries' and policyname='calc_entries_select') then
    create policy calc_entries_select on public.calc_entries for select to authenticated using (public.is_active());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='calc_entries' and policyname='calc_entries_insert') then
    create policy calc_entries_insert on public.calc_entries for insert to authenticated with check (public.is_active());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='calc_entries' and policyname='calc_entries_update') then
    create policy calc_entries_update on public.calc_entries for update to authenticated using (public.is_active()) with check (public.is_active());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='calc_entries' and policyname='calc_entries_delete') then
    create policy calc_entries_delete on public.calc_entries for delete to authenticated using (public.is_active());
  end if;
  -- Tiempo real: lo que una persona suma se ve en los demás dispositivos.
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='calc_entries') then
    alter publication supabase_realtime add table public.calc_entries;
  end if;
end $$;
