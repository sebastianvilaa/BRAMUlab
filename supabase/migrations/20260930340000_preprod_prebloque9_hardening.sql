-- BRAMUlab — Pre-Bloque 9 (hardening de Staging, Issue #17 / handoff 81). Migración ADITIVA y de bajo riesgo.
--
-- Auditoría de grants/RPC (ver docs/.../82_Resultado_Pre_Bloque_9_Hardening_Staging_30SEP.md y
-- supabase/scripts/audit-migration-grants.mjs): de 114 funciones de `public`, SOLO se detectaron
--   (a) funciones TRIGGER internas con EXECUTE implícito para PUBLIC (no invocables como RPC, pero el Advisor las
--       marca y no hay razón para que anon/authenticated las ejecuten) -> se revoca;
--   (b) 7 RPCs de escritura de `authenticated` sin rate limit, con riesgo concreto (spam de notificaciones a otros
--       jugadores con report_identity_issue, escritura repetida de avatar/teléfono/categoría/notas) -> se agrega;
--   (c) las RPC de match/corrección/onboarding son service_role (las llama una Edge Function) y no tenían límite
--       por cuenta -> `consume_auth_rate_limit` (service_role) para que las Edge Functions lo apliquen.
-- NO se tocan: is_username_available (anon por decisión de producto, ver 20260919153500), `_group_photo_*`
-- (las usan las políticas de Storage como `authenticated`), ni ninguna regla deportiva.
-- Se agrega además `ops_health_snapshot()` (métricas operativas mínimas, solo agregados, solo service_role).
--
-- NO aplicada desde el sandbox del agente — la aplica Central. Verify: supabase/tests/verify-preprod-prebloque9-hardening.sql

-- (a) triggers internos: ni anon ni authenticated ni PUBLIC
revoke execute on function public._bloque6_enrich_notification_actor() from public, anon, authenticated;
revoke execute on function public._groups_assert_has_active_admin() from public, anon, authenticated;
revoke execute on function public.legal_acceptances_reject_mutation() from public, anon, authenticated;

-- (c) rate limit por auth user para Edge Functions (resuelve el player server-side)
create or replace function public.consume_auth_rate_limit(
  p_auth_user_id uuid,
  p_action text,
  p_max_requests integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player_id uuid;
begin
  if p_auth_user_id is null then
    return false;
  end if;
  select player_id into v_player_id from public.players where auth_user_id = p_auth_user_id;
  -- Sin player no hay contador posible: la RPC de negocio que sigue rechaza `no_player_for_session`.
  if v_player_id is null then
    return true;
  end if;
  return public.consume_rate_limit(v_player_id, p_action, p_max_requests, p_window_seconds);
end;
$$;

comment on function public.consume_auth_rate_limit is
  'Pre-Bloque 9: rate limit por cuenta para Edge Functions (service_role). Reusa consume_rate_limit.';

revoke all on function public.consume_auth_rate_limit(uuid, text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_auth_rate_limit(uuid, text, integer, integer) to service_role;

-- (b) rate limits en RPCs de escritura de authenticated (mismos cuerpos vigentes + guard al inicio;
--     CREATE OR REPLACE conserva grants y comentarios)

create or replace function public.report_identity_issue(
  p_match_id uuid,
  p_team text,
  p_position_in_team smallint,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_player_id uuid;
  v_match public.matches;
  v_slot public.match_participants;
  v_issue_id uuid;
  v_reverted_result_id uuid;
begin
  -- V04.20 hardening: rate limit por cuenta (consume_auth_rate_limit; solo cuenta una llamada por intento)
  if not public.consume_auth_rate_limit(auth.uid(), 'report_identity_issue', 20, 3600) then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  -- Sin cálculo del motor JS involucrado (revertir usa match_level_results ya calculado, nunca
  -- recalcula) — alcanzable DIRECTO por authenticated vía auth.uid(), mismo criterio que
  -- hide_match_for_me/set_match_private_note (Bloque 5), sin pasar por ninguna Edge Function.
  select player_id into v_caller_player_id from public.players where auth_user_id = auth.uid();
  if v_caller_player_id is null then
    raise exception 'no_player_for_session' using errcode = 'P0001';
  end if;

  if not exists (select 1 from public.match_participants where match_id = p_match_id and player_id = v_caller_player_id) then
    return jsonb_build_object('ok', false, 'code', 'not_a_participant');
  end if;

  select * into v_match from public.matches where match_id = p_match_id for update;
  if v_match is null then
    return jsonb_build_object('ok', false, 'code', 'match_not_found');
  end if;

  if v_match.status = 'validated' then
    if v_match.validated_at is null or now() > v_match.validated_at + interval '10 days' then
      return jsonb_build_object('ok', false, 'code', 'identity_window_expired');
    end if;
  elsif v_match.status = 'pending_validation' then
    -- B6-B-07: la ventana fija de 30 días (Experiencia_Inicial.md §11.2) también gobierna acá —
    -- un partido pending_validation con validation_deadline_at ya vencido deja de ser accionable,
    -- nunca se reactiva por un reporte de identidad.
    if v_match.validation_deadline_at is null or now() > v_match.validation_deadline_at then
      return jsonb_build_object('ok', false, 'code', 'match_expired');
    end if;
  else
    return jsonb_build_object('ok', false, 'code', 'match_not_actionable');
  end if;

  select * into v_slot from public.match_participants
    where match_id = p_match_id and team = p_team and position_in_team = p_position_in_team
    for update;
  if v_slot is null then
    return jsonb_build_object('ok', false, 'code', 'slot_not_found');
  end if;
  if exists (select 1 from public.match_identity_issues where match_id = p_match_id and team = p_team and position_in_team = p_position_in_team and status = 'open') then
    return jsonb_build_object('ok', false, 'code', 'identity_issue_already_open');
  end if;

  -- Alcance de reversión: EL PARTIDO COMPLETO, no solo este slot (04_Revision_ChatGPT.md §3) —
  -- la composición de los 4 determina fuerza de pareja/expectativa/disponibilidad/repetición/
  -- círculo, así que una identidad incorrecta puede invalidar todo el cálculo.
  v_reverted_result_id := public._bloque6_revert_applied_result(p_match_id);

  insert into public.match_identity_issues (
    match_id, team, position_in_team, previous_player_id, opened_by_player_id, opened_at,
    resolution_deadline_at, reverted_result_id
  ) values (
    p_match_id, p_team, p_position_in_team, v_slot.player_id, v_caller_player_id, now(),
    now() + interval '7 days', v_reverted_result_id
  ) returning issue_id into v_issue_id;

  update public.match_participants set player_id = null, display_name_snapshot = 'Por identificar'
    where match_id = p_match_id and team = p_team and position_in_team = p_position_in_team;

  -- B6-B-04: el slot recién quedó NULL — el fingerprint pasa al centinela determinístico hasta
  -- que se resuelva la incidencia (evita que una carga posterior con los 4 IDs correctos cree un
  -- duplicado, o que la identidad vieja siga siendo adjuntable).
  perform public._bloque6_refresh_participant_fingerprint(p_match_id);

  insert into public.match_actions (match_id, action_type, actor_player_id, acting_side, metadata)
  values (p_match_id, 'identity_questioned', v_caller_player_id, null, jsonb_build_object('team', p_team, 'position', p_position_in_team, 'reason', p_reason));

  -- C-08: sin insert en notifications acá — get_notifications DERIVA la tarea
  -- 'identity_questioned' en lectura desde match_identity_issues.status='open', nunca la
  -- persiste como mensaje histórico (el match_actions de arriba ya conserva la auditoría).

  return jsonb_build_object('ok', true, 'code', 'identity_issue_opened', 'issueId', v_issue_id, 'resolutionDeadlineAt', now() + interval '7 days');
end;
$$;

create or replace function public.set_match_private_note(p_match_id uuid, p_note text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_player_id uuid;
  v_note text := nullif(trim(coalesce(p_note, '')), '');
begin
  -- V04.20 hardening: rate limit por cuenta (consume_auth_rate_limit; solo cuenta una llamada por intento)
  if not public.consume_auth_rate_limit(auth.uid(), 'set_match_private_note', 60, 60) then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  select player_id into v_caller_player_id from public.players where auth_user_id = auth.uid();
  if v_caller_player_id is null then
    raise exception 'no_player_for_session' using errcode = 'P0001';
  end if;

  if v_note is not null and length(v_note) > 500 then
    return jsonb_build_object('ok', false, 'code', 'note_too_long');
  end if;

  if not exists (select 1 from public.match_participants where match_id = p_match_id and player_id = v_caller_player_id) then
    return jsonb_build_object('ok', false, 'code', 'not_a_participant');
  end if;

  insert into public.match_user_state (match_id, player_id, private_note, private_note_updated_at, updated_at)
  values (p_match_id, v_caller_player_id, v_note, now(), now())
  on conflict (match_id, player_id) do update
    set private_note = excluded.private_note,
        private_note_updated_at = now(),
        updated_at = now();

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.update_profile_avatar(
  p_avatar_path text default null
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player_id uuid;
  v_result    public.profiles;
begin
  -- V04.20 hardening: rate limit por cuenta (consume_auth_rate_limit; solo cuenta una llamada por intento)
  if not public.consume_auth_rate_limit(auth.uid(), 'update_profile_avatar', 20, 600) then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  select player_id into v_player_id from public.players where auth_user_id = auth.uid();
  if v_player_id is null then
    raise exception 'no_player_for_session' using errcode = 'P0001';
  end if;

  -- Defensa en profundidad además de la política RLS de storage.objects (que ya impide subir
  -- fuera de la carpeta propia): la ruta persistida debe ser EXACTAMENTE
  -- "{player_id_propio}/<archivo>" — un solo segmento de carpeta (el player_id del caller, nunca
  -- otro) seguido de un nombre de archivo con caracteres seguros. Rechaza estructuralmente
  -- cualquier esquema/dominio (`http://`, `//`, etc.), cualquier carpeta ajena y cualquier
  -- traversal (`../`). `null` (quitar foto) siempre se permite sin este chequeo.
  if p_avatar_path is not null
     and p_avatar_path !~ ('^' || v_player_id::text || '/[A-Za-z0-9._-]+$') then
    raise exception 'avatar_path_invalid' using errcode = 'P0001';
  end if;

  update public.profiles set
    avatar_url = p_avatar_path,
    updated_at = now()
  where player_id = v_player_id
  returning * into v_result;

  if v_result is null then
    raise exception 'no_profile_for_player' using errcode = 'P0001';
  end if;

  return v_result;
end;
$$;

create or replace function public.complete_contact_profile_data(
  p_phone text,
  p_allow_whatsapp_contact boolean
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player_id     uuid;
  v_phone_digits  text;
  v_result        public.profiles;
begin
  -- V04.20 hardening: rate limit por cuenta (consume_auth_rate_limit; solo cuenta una llamada por intento)
  if not public.consume_auth_rate_limit(auth.uid(), 'complete_contact_profile_data', 20, 600) then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  select player_id into v_player_id from public.players where auth_user_id = auth.uid();
  if v_player_id is null then
    raise exception 'no_player_for_session' using errcode = 'P0001';
  end if;

  -- Defensa server-side — MISMO criterio simple que ya usa el cliente
  -- (bramulab/player-identity.js#isValidWhatsAppPhone: 8-15 dígitos, sin resolver telefonía
  -- internacional real): nunca confiar solo en la validación del formulario. Desactivar el
  -- consentimiento (`p_allow_whatsapp_contact=false`) nunca exige un teléfono válido — "revocar
  -- consentimiento siempre debe ser posible" (handoff §5).
  v_phone_digits := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  if coalesce(p_allow_whatsapp_contact, false)
     and (length(v_phone_digits) < 8 or length(v_phone_digits) > 15) then
    raise exception 'whatsapp_phone_invalid' using errcode = 'P0001';
  end if;

  update public.profiles set
    phone = nullif(trim(coalesce(p_phone, '')), ''),
    allow_whatsapp_contact = coalesce(p_allow_whatsapp_contact, false),
    updated_at = now()
  where player_id = v_player_id
  returning * into v_result;

  if v_result is null then
    raise exception 'no_profile_for_player' using errcode = 'P0001';
  end if;

  return v_result;
end;
$$;

create or replace function public.update_current_category(p_current_category text)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player_id uuid;
  v_previous  text;
  v_result    public.profiles;
begin
  -- V04.20 hardening: rate limit por cuenta (consume_auth_rate_limit; solo cuenta una llamada por intento)
  if not public.consume_auth_rate_limit(auth.uid(), 'update_current_category', 30, 600) then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  select player_id into v_player_id from public.players where auth_user_id = auth.uid();
  if v_player_id is null then
    raise exception 'no_player_for_session' using errcode = 'P0001';
  end if;

  if p_current_category is not null and p_current_category not in (
    '1', '2', '3', '4', '5', '6', '7', '8', '9', 'no-se', 'no-compito'
  ) then
    raise exception 'current_category_invalid' using errcode = 'P0001';
  end if;

  select current_category into v_previous from public.profiles where player_id = v_player_id;

  update public.profiles set
    current_category = p_current_category,
    -- Mismo criterio que ya usaba el camino local (app.js): el timestamp solo se re-estampa si
    -- el valor realmente cambió — guardar sin tocar el campo (o guardando el mismo valor)
    -- conserva la fecha de declaración original.
    current_category_at = case
      when p_current_category is distinct from v_previous then now()
      else current_category_at
    end,
    updated_at = now()
  where player_id = v_player_id
  returning * into v_result;

  if v_result is null then
    raise exception 'no_profile_for_player' using errcode = 'P0001';
  end if;

  return v_result;
end;
$$;

create or replace function public.hide_match_for_me(p_match_id uuid, p_hidden boolean default true)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_player_id uuid;
  v_hidden boolean := coalesce(p_hidden, true);
begin
  -- V04.20 hardening: rate limit por cuenta (consume_auth_rate_limit; solo cuenta una llamada por intento)
  if not public.consume_auth_rate_limit(auth.uid(), 'hide_match_for_me', 60, 60) then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  select player_id into v_caller_player_id from public.players where auth_user_id = auth.uid();
  if v_caller_player_id is null then
    raise exception 'no_player_for_session' using errcode = 'P0001';
  end if;

  if not exists (select 1 from public.match_participants where match_id = p_match_id and player_id = v_caller_player_id) then
    return jsonb_build_object('ok', false, 'code', 'not_a_participant');
  end if;

  insert into public.match_user_state (match_id, player_id, hidden, hidden_at, updated_at)
  values (p_match_id, v_caller_player_id, v_hidden, case when v_hidden then now() else null end, now())
  on conflict (match_id, player_id) do update
    set hidden = excluded.hidden,
        hidden_at = excluded.hidden_at,
        updated_at = now();

  return jsonb_build_object('ok', true, 'hidden', v_hidden);
end;
$$;

create or replace function public.set_ranking_network_hidden(p_hidden_player_id uuid, p_hidden boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_player_id uuid;
begin
  -- V04.20 hardening: rate limit por cuenta (consume_auth_rate_limit; solo cuenta una llamada por intento)
  if not public.consume_auth_rate_limit(auth.uid(), 'set_ranking_network_hidden', 60, 60) then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  select player_id into v_caller_player_id from public.players where auth_user_id = auth.uid();
  if v_caller_player_id is null then
    raise exception 'no_player_for_session' using errcode = 'P0001';
  end if;
  if p_hidden_player_id is null then
    raise exception 'hidden_player_id_required' using errcode = 'P0001';
  end if;
  if p_hidden_player_id = v_caller_player_id then
    raise exception 'cannot_hide_self' using errcode = 'P0001';
  end if;
  if p_hidden is null then
    raise exception 'hidden_flag_required' using errcode = 'P0001';
  end if;

  if p_hidden then
    insert into public.ranking_network_hidden (player_id, hidden_player_id)
    values (v_caller_player_id, p_hidden_player_id)
    on conflict (player_id, hidden_player_id) do nothing;
  else
    delete from public.ranking_network_hidden
    where player_id = v_caller_player_id and hidden_player_id = p_hidden_player_id;
  end if;

  return true;
end;
$$;

-- Métricas operativas mínimas (solo agregados; sin ids, emails ni contenido). Reusa pilot_events + tablas reales.
create or replace function public.ops_health_snapshot()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'generatedAt', now(),
    'accounts', jsonb_build_object(
      'registeredActive', (select count(*) from public.players where type = 'registered' and is_active and deleted_at is null),
      'registeredDeleted', (select count(*) from public.players where type = 'registered' and deleted_at is not null),
      'profileComplete', (select count(*) from public.profiles pr join public.players pl using (player_id) where pl.type = 'registered' and pl.is_active and pr.username is not null),
      'levelOfficialized', (select count(*) from public.level_states ls join public.players pl using (player_id) where pl.is_active and ls.status <> 'PENDIENTE'),
      'legalPendingCurrentVersion', (
        select count(*) from public.players pl
         where pl.type = 'registered' and pl.is_active and pl.deleted_at is null
           and not exists (select 1 from public.legal_acceptances la, public.app_config c where la.player_id = pl.player_id and c.id = 1 and la.legal_version = c.legal_version)
      ),
      'unconfirmedSignupsOver24h', (select count(*) from auth.users u where u.email_confirmed_at is null and u.created_at < now() - interval '24 hours')
    ),
    'matchesByStatus', coalesce((select jsonb_object_agg(status, n) from (select status, count(*) n from public.matches group by status) s), '{}'::jsonb),
    'matchesPendingPastDeadline', (select count(*) from public.matches where status = 'pending_validation' and validation_deadline_at < now()),
    'eventsLast7Days', coalesce((
      select jsonb_object_agg(event_name, n) from (
        select event_name, count(*) n from public.pilot_events where created_at >= now() - interval '7 days' group by event_name
      ) e
    ), '{}'::jsonb),
    'activeByDay', coalesce((
      select jsonb_agg(jsonb_build_object('day', d, 'matchesCreated', n) order by d) from (
        select (created_at at time zone 'America/Argentina/Buenos_Aires')::date d, count(*) n
          from public.matches where created_at >= now() - interval '14 days' group by 1
      ) x
    ), '[]'::jsonb),
    'rateLimitedLastHour', (select coalesce(sum(request_count), 0) from public.api_rate_limits where window_started_at >= now() - interval '1 hour')
  );
$$;

comment on function public.ops_health_snapshot is
  'Pre-Bloque 9: salud operativa mínima de los primeros usuarios (agregados, sin datos sensibles). Solo service_role.
   Consulta: select public.ops_health_snapshot();';

revoke all on function public.ops_health_snapshot() from public, anon, authenticated;
grant execute on function public.ops_health_snapshot() to service_role;

-- api_rate_limits crece una fila por jugador+acción+ventana y nunca se purgaba. Purga operativa (service_role),
-- pensada para correr desde el cron existente o a mano; conserva 7 días por defecto.
create or replace function public.purge_old_rate_limits(p_older_than interval default interval '7 days')
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer;
begin
  if p_older_than is null or p_older_than < interval '1 day' then
    raise exception 'older_than_below_policy' using errcode = 'P0001';
  end if;
  delete from public.api_rate_limits where window_started_at < now() - p_older_than;
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

comment on function public.purge_old_rate_limits is
  'Pre-Bloque 9: purga contadores de rate limit antiguos (>= 1 día; default 7). Solo service_role.';

revoke all on function public.purge_old_rate_limits(interval) from public, anon, authenticated;
grant execute on function public.purge_old_rate_limits(interval) to service_role;
