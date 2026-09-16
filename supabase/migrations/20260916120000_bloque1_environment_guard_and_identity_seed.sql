-- BRAMUlab — Bloque 1: Fundación de backend y entornos.
--
-- Crea:
--   1) app_config: guarda ambiental. Fila única que declara a qué entorno
--      (development/staging/production) pertenece ESTE proyecto Supabase.
--      La usa el health check (bramulab/api/health.js) y el build del
--      frontend para detectar credenciales cruzadas entre entornos.
--   2) players: esqueleto mínimo de identidad de jugador que Bloque 2 va a
--      extender con profiles, username, ubicación y rama competitiva.
--
-- RLS queda en "denegar por defecto": ninguna tabla es legible ni escribible
-- por anon/authenticated salvo la única política explícita de lectura de
-- app_config. Bloque 2 agrega las políticas reales de players/profiles.
--
-- Esta misma migración se aplica sin cambios en Development, Staging y
-- Production; lo único que cambia entre proyectos es la fila que se
-- inserta a mano en app_config después de correrla (ver el procedimiento
-- documentado en docs/BRAMUlab/Versiones/BRAMUlab_Backend/BRAMUlab_Backend_Informe.md).

create table if not exists public.app_config (
  id smallint primary key default 1,
  environment text not null check (environment in ('development', 'staging', 'production')),
  notes text,
  updated_at timestamptz not null default now(),
  constraint app_config_is_singleton check (id = 1)
);

comment on table public.app_config is
  'Fila única por proyecto Supabase. Declara a qué entorno pertenece este proyecto para que el health check y el build del frontend detecten credenciales cruzadas.';

alter table public.app_config enable row level security;

drop policy if exists "app_config_public_read" on public.app_config;
create policy "app_config_public_read"
  on public.app_config
  for select
  to anon, authenticated
  using (true);

-- Sin políticas de insert/update/delete: la fila se administra a mano desde
-- el SQL editor del proyecto (o con la service role key), nunca desde el cliente.

create table if not exists public.players (
  player_id uuid primary key default gen_random_uuid(),
  type text not null default 'registered' check (type in ('registered', 'provisional')),
  auth_user_id uuid unique references auth.users (id) on delete set null,
  display_name text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.players is
  'Esqueleto mínimo de identidad de jugador (Bloque 1). Bloque 2 agrega profiles, username, ubicación, rama competitiva y las políticas RLS de lectura/escritura reales.';

alter table public.players enable row level security;

-- Deny-by-default deliberado: RLS habilitada, cero políticas. Ni anon ni
-- authenticated pueden leer o escribir todavía. Verificar con
-- supabase/tests/verify-rls.mjs contra el proyecto de Staging.
