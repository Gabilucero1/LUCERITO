-- ============================================================================
-- LUCERITO · base de datos central en Supabase (PostgreSQL)
-- Cómo usarlo: Supabase → SQL Editor → New query → pegá TODO este archivo → Run.
-- Se ejecuta UNA sola vez en un proyecto nuevo. Ver README, sección "Supabase".
--
-- Diseño: cada tabla del negocio tiene columnas clave (id, version, fechas, quién)
-- y un campo "data" (JSON) con el resto del registro. Las reglas de seguridad (RLS)
-- se aplican en la base de datos: no dependen del navegador ni del celular.
-- ============================================================================
create extension if not exists pgcrypto;

-- 1) PERFILES: uno por cuenta de Supabase Auth (el correo y la contraseña los guarda Auth)
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null unique,
  username    text not null unique,
  first_name  text not null default '',
  last_name   text not null default '',
  photo       text not null default '',
  role        text not null default 'user' check (role in ('admin','user')),
  active      boolean not null default true,
  notif_prefs jsonb not null default '{"vencimientos":true,"stock_bajo":true,"sin_stock":true,"aumentos":true,"pedidos":true,"mercaderia":true,"otros":true}',
  last_access timestamptz,
  last_seen   timestamptz,
  created_at  timestamptz not null default now()
);

-- 2) CONFIGURACIÓN GENERAL (una sola fila). approve=true: las cuentas nuevas esperan la aprobación de la administradora.
create table public.app_settings (
  id         int primary key default 1 check (id = 1),
  data       jsonb not null default '{"offerDays":10,"approve":true}',
  updated_at timestamptz not null default now()
);
insert into public.app_settings (id) values (1) on conflict do nothing;

-- 3) FUNCIONES DE AUTORIZACIÓN (quién puede qué)
create or replace function public.is_active() returns boolean
language sql security definer stable set search_path = public as
$$ select exists (select 1 from public.profiles where id = auth.uid() and active) $$;

create or replace function public.is_admin() returns boolean
language sql security definer stable set search_path = public as
$$ select exists (select 1 from public.profiles where id = auth.uid() and active and role = 'admin') $$;

-- ¿el nombre de usuario está libre? (se puede consultar antes de crear la cuenta)
create or replace function public.username_available(u text) returns boolean
language sql security definer stable set search_path = public as
$$ select not exists (select 1 from public.profiles where username = lower(u)) $$;
grant execute on function public.username_available(text) to anon, authenticated;

-- 4) AL CREARSE UNA CUENTA se crea su perfil. La PRIMERA cuenta queda como administradora.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare first_user boolean; need_ok boolean;
begin
  select not exists (select 1 from public.profiles where role = 'admin') into first_user;
  select coalesce((data->>'approve')::boolean, true) into need_ok from public.app_settings where id = 1;
  insert into public.profiles (id, email, username, first_name, last_name, role, active)
  values (new.id, lower(new.email),
          lower(coalesce(new.raw_user_meta_data->>'username', split_part(new.email,'@',1))),
          coalesce(new.raw_user_meta_data->>'first_name',''),
          coalesce(new.raw_user_meta_data->>'last_name',''),
          case when first_user then 'admin' else 'user' end,
          first_user or not need_ok);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Una usuaria NO puede cambiarse el rol, el estado, el correo ni el usuario (solo la administradora).
create or replace function public.protect_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    if new.role <> old.role or new.active <> old.active or new.email <> old.email or new.username <> old.username then
      raise exception 'No autorizado';
    end if;
  end if;
  return new;
end $$;
create trigger protect_profile before update on public.profiles
  for each row execute function public.protect_profile();

alter table public.profiles enable row level security;
create policy profiles_select on public.profiles for select to authenticated
  using (public.is_active() or id = auth.uid());
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());

alter table public.app_settings enable row level security;
create policy settings_select on public.app_settings for select to authenticated using (public.is_active());
create policy settings_update on public.app_settings for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create or replace function public.touch_updated_at() returns trigger language plpgsql as
$$ begin new.updated_at = now(); return new; end $$;

-- 5) TABLAS DEL NEGOCIO (productos, proveedores, pedidos, mercadería, pagos, gastos, notas, aumentos,
--    papelera, solicitudes de permiso e historial)
do $$
declare t text;
begin
  foreach t in array array['products','suppliers','orders','receipts','payments','expenses','notes',
                           'price_changes','trash_items','permission_requests','audit_log'] loop
    execute format($f$create table public.%I (
      id         bigint primary key,
      data       jsonb not null,
      version    integer not null default 1,
      created_by uuid default auth.uid(),
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )$f$, t);
    execute format('alter table public.%I enable row level security', t);
    execute format('create trigger touch_updated before update on public.%I for each row execute function public.touch_updated_at()', t);
  end loop;
end $$;

-- Un mismo código de barras / proveedor no se puede repetir, aunque lo carguen dos personas a la vez
create unique index products_barcode_uq on public.products ((nullif(data->>'barcode','')));
create unique index suppliers_name_uq   on public.suppliers ((lower(data->>'name')));
create index orders_date_idx   on public.orders   ((data->>'date'));
create index receipts_date_idx on public.receipts ((data->>'date'));

-- 6) PERMISOS (RLS). Toda persona activa puede trabajar con los datos del negocio.
do $$
declare t text;
begin
  foreach t in array array['products','suppliers','orders','receipts','payments','expenses','notes','price_changes'] loop
    execute format('create policy %1$s_select on public.%1$I for select to authenticated using (public.is_active())', t);
    execute format('create policy %1$s_insert on public.%1$I for insert to authenticated with check (public.is_active())', t);
    execute format('create policy %1$s_update on public.%1$I for update to authenticated using (public.is_active()) with check (public.is_active())', t);
    execute format('create policy %1$s_delete on public.%1$I for delete to authenticated using (public.is_active())', t);
  end loop;
end $$;

-- Papelera: todas ven, mueven y restauran; SOLO la administradora elimina definitivamente (delete)
create policy trash_select on public.trash_items for select to authenticated using (public.is_active());
create policy trash_insert on public.trash_items for insert to authenticated with check (public.is_active());
create policy trash_update on public.trash_items for update to authenticated using (public.is_active()) with check (public.is_active());
create policy trash_delete on public.trash_items for delete to authenticated using (public.is_admin());

-- Solicitudes de permiso: todas crean y ven; solo la administradora aprueba o rechaza
create policy reqs_select on public.permission_requests for select to authenticated using (public.is_active());
create policy reqs_insert on public.permission_requests for insert to authenticated with check (public.is_active());
create policy reqs_update on public.permission_requests for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Historial: SOLO se puede agregar y leer. Nadie (ni la administradora) lo modifica ni lo borra desde la app.
create policy audit_select on public.audit_log for select to authenticated using (public.is_active());
create policy audit_insert on public.audit_log for insert to authenticated with check (public.is_active());

-- 7) SESIONES de la app (para que la administradora vea y cierre sesiones)
create table public.app_sessions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  device     text,
  started_at timestamptz not null default now(),
  last_seen  timestamptz not null default now(),
  ended_at   timestamptz,
  revoked_at timestamptz,
  revoked_by uuid
);
create or replace function public.protect_session() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin()
     and (new.revoked_at is distinct from old.revoked_at or new.revoked_by is distinct from old.revoked_by) then
    raise exception 'No autorizado';
  end if;
  return new;
end $$;
create trigger protect_session before update on public.app_sessions
  for each row execute function public.protect_session();
alter table public.app_sessions enable row level security;
create policy sessions_select on public.app_sessions for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy sessions_insert on public.app_sessions for insert to authenticated with check (user_id = auth.uid());
create policy sessions_update on public.app_sessions for update to authenticated
  using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin());

-- 8) DISPOSITIVOS PARA NOTIFICACIONES PUSH (token de Firebase de cada celular, ligado a la cuenta)
create table public.push_devices (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  token      text not null unique,
  device     text,
  created_at timestamptz not null default now(),
  last_seen  timestamptz not null default now()
);
alter table public.push_devices enable row level security;
create policy push_select on public.push_devices for select to authenticated using (user_id = auth.uid());
create policy push_delete on public.push_devices for delete to authenticated using (user_id = auth.uid());
-- (el alta se hace con esta función, que también reasigna el token si el celular cambia de cuenta)
create or replace function public.register_push_token(p_token text, p_device text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.is_active() then raise exception 'No autorizado'; end if;
  insert into public.push_devices (user_id, token, device) values (auth.uid(), p_token, p_device)
  on conflict (token) do update set user_id = auth.uid(), device = excluded.device, last_seen = now();
end $$;
grant execute on function public.register_push_token(text, text) to authenticated;

-- 9) TIEMPO REAL: los cambios de una persona llegan a las demás sin recargar
alter publication supabase_realtime add table
  public.products, public.suppliers, public.orders, public.receipts, public.payments, public.expenses,
  public.notes, public.price_changes, public.trash_items, public.permission_requests, public.audit_log,
  public.profiles, public.app_settings, public.app_sessions;
