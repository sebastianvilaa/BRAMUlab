-- BRAMUlab — Bloque 6: notificaciones internas.
--
-- Ver Backend_Infraestructura.md §6.7 (contrato ya cerrado) y
-- docs/BRAMUlab/Implementacion/Backend/Bloque_06/{02_Analisis_Claude.md §3.10,
-- 03_Plan_Implementacion_Claude.md §1.1/§1.4}.
--
-- RLS deny-by-default TOTAL, mismo criterio que el resto de las tablas de partidos/Nivel de
-- Bloque 6: ninguna política de select/insert/update/delete para authenticated/anon. Cada RPC de
-- negocio de este bloque (officialize_match_validation, corrección, identidad, admin) inserta
-- acá directamente dentro de su misma transacción — mismo patrón que ya usa pilot_events, sin
-- necesitar una función auxiliar separada (todas son SECURITY DEFINER, corren con los
-- privilegios del dueño de la tabla).

create table public.notifications (
  notification_id uuid primary key default gen_random_uuid(),
  player_id        uuid not null references public.players (player_id) on delete cascade,
  type             text not null check (type in (
                      'pending_review', 'correction_proposed', 'correction_accepted',
                      'identity_questioned', 'identity_resolved', 'identity_unidentified',
                      'match_validated', 'match_expired', 'admin_action'
                    )),
  match_id         uuid references public.matches (match_id) on delete cascade,
  -- Datos mínimos para armar el copy sin una segunda consulta (quién actuó, qué cambió) — nunca
  -- información privada de terceros más allá de lo que ya es visible para el destinatario.
  payload          jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  read_at          timestamptz
);

comment on table public.notifications is
  'Bandeja interna server-backed (Backend_Infraestructura.md §6.7). Sin push. Escritura
   exclusiva desde las RPCs de negocio de Bloque 6 (mismo patrón que pilot_events). Lectura/
   marcado exclusivamente vía get_notifications/mark_notification_read/
   mark_all_notifications_read (SECURITY DEFINER).';

create index notifications_player_id_idx on public.notifications (player_id, created_at desc);

alter table public.notifications enable row level security;
-- Deny-by-default TOTAL — ver comentario de cabecera.

grant select, insert, update, delete on table public.notifications to service_role;

-- ------------------------------------------------------------------
-- get_notifications
-- ------------------------------------------------------------------

create or replace function public.get_notifications(p_limit integer default 50, p_only_unread boolean default false)
returns table (
  notification_id uuid,
  type             text,
  match_id         uuid,
  payload          jsonb,
  created_at       timestamptz,
  read_at          timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_player_id uuid;
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 200);
begin
  select player_id into v_caller_player_id from public.players where auth_user_id = auth.uid();
  if v_caller_player_id is null then
    raise exception 'no_player_for_session' using errcode = 'P0001';
  end if;

  return query
    select n.notification_id, n.type, n.match_id, n.payload, n.created_at, n.read_at
    from public.notifications n
    where n.player_id = v_caller_player_id
      and (not p_only_unread or n.read_at is null)
    order by n.created_at desc
    limit v_limit;
end;
$$;

comment on function public.get_notifications is
  'Bandeja del caller, más reciente primero. Nunca expone notificaciones de otro jugador.';

revoke all on function public.get_notifications(integer, boolean) from public;
grant execute on function public.get_notifications(integer, boolean) to authenticated;

-- ------------------------------------------------------------------
-- mark_notification_read / mark_all_notifications_read
-- ------------------------------------------------------------------

create or replace function public.mark_notification_read(p_notification_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_player_id uuid;
  v_updated integer;
begin
  select player_id into v_caller_player_id from public.players where auth_user_id = auth.uid();
  if v_caller_player_id is null then
    raise exception 'no_player_for_session' using errcode = 'P0001';
  end if;

  update public.notifications
    set read_at = now()
    where notification_id = p_notification_id
      and player_id = v_caller_player_id
      and read_at is null;
  get diagnostics v_updated = row_count;

  return jsonb_build_object('ok', true, 'updated', v_updated > 0);
end;
$$;

comment on function public.mark_notification_read is
  'Marca UNA notificación propia como leída. Silenciosamente no-op si no existe o no es del
   caller (nunca confirma ni niega notificaciones ajenas).';

revoke all on function public.mark_notification_read(uuid) from public;
grant execute on function public.mark_notification_read(uuid) to authenticated;

create or replace function public.mark_all_notifications_read()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_player_id uuid;
  v_updated integer;
begin
  select player_id into v_caller_player_id from public.players where auth_user_id = auth.uid();
  if v_caller_player_id is null then
    raise exception 'no_player_for_session' using errcode = 'P0001';
  end if;

  update public.notifications
    set read_at = now()
    where player_id = v_caller_player_id
      and read_at is null;
  get diagnostics v_updated = row_count;

  return jsonb_build_object('ok', true, 'updated', v_updated);
end;
$$;

comment on function public.mark_all_notifications_read is
  'Marca todas las notificaciones propias no leídas como leídas — respalda el botón "marcar
   todas" ya existente en la pantalla de Notificaciones (app.js).';

revoke all on function public.mark_all_notifications_read() from public;
grant execute on function public.mark_all_notifications_read() to authenticated;
