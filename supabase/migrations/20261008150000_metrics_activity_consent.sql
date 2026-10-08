-- BRAMU Metrics V1 — CONSENTIMIENTO INFORMADO para la medición de actividad (decisión confirmada de Sebastián, 09/10/2026).
--
-- Decisión: actualizar la Política y pedir una aceptación informada del registro de actividad. Usuarios existentes: UNA pantalla breve;
-- usuarios nuevos: dentro del alta habitual. No se registra ninguna apertura antes de consentir; quien no consiente sigue usando BRAMUlab
-- con normalidad (el consentimiento es ESPECÍFICO y OPCIONAL, distinto de la aceptación obligatoria de Términos/Política); la evidencia se
-- conserva; no se reconstruyen aperturas anteriores. Reutiliza el sistema legal existente: mismo patrón que `legal_acceptances`
-- (append-only, deny-by-default, versión vigente en `app_config`, registro en el alta vía metadata en `handle_email_confirmed`).
--
--   1) app_config.activity_consent_version — versión VIGENTE del texto de consentimiento; NULL = medición APAGADA (valor por defecto en
--      todos los entornos). Central la fija cuando el texto de la Política esté publicado: es el interruptor de salida.
--   2) activity_consents — evidencia APPEND-ONLY (versión, decisión granted|declined, origen, fecha, versión legal vigente). Sin acceso de cliente.
--   3) _activity_consent_status / _record_activity_consent — helpers internos. Declinar o retirar el consentimiento ELIMINA la actividad ya registrada.
--   4) get_my_activity_consent / set_my_activity_consent — únicas RPC del jugador (solo sobre sí mismo; solo la versión vigente; rate limit).
--   5) handle_email_confirmed — FUSIONADO (idéntico a L1 salvo registrar el consentimiento declarado en el alta).
--   6) register_app_presence — FUSIONADO: sin medición activa o sin consentimiento vigente NO escribe (server-side). 
--   7) Purga única: filas de actividad capturadas SIN consentimiento (Staging/pruebas; en Production no hay ninguna). Idempotente: conserva lo
--      registrado después de un consentimiento válido.
--   8) admin_export_player_data — el informe de acceso suma `activityConsents` (la propia constancia).
--   9) Metrics: `meta.measurement` (cobertura: cuentas y cuentas que aceptaron, con umbral k) y retención sobre altas que aceptaron desde el alta.
--
-- Conservación de la evidencia: igual que las aceptaciones legales, la constancia (versión, decisión, fecha) se conserva aunque se elimine la
-- cuenta; NO es actividad. La ACTIVIDAD sí se elimina (con la cuenta, al declinar o al retirar).
-- NO aplicada desde el sandbox del agente — la aplica Central en Staging (después de F1/F2/F4/F6 y 20261008140000).

alter table public.app_config
  add column if not exists activity_consent_version text check (activity_consent_version is null or activity_consent_version ~ '^[a-z0-9_.-]{1,40}$');
comment on column public.app_config.activity_consent_version is
  'Versión vigente del consentimiento para medir actividad básica de uso. NULL = medición apagada (nadie registra nada). Cambiarla exige nuevo consentimiento.';

create table if not exists public.activity_consents (
  consent_id bigint generated always as identity primary key,
  player_id uuid not null references public.players (player_id),
  consent_version text not null check (consent_version ~ '^[a-z0-9_.-]{1,40}$'),
  decision text not null check (decision in ('granted', 'declined')),
  source text not null check (source in ('signup', 'prompt', 'settings')),
  legal_version text references public.legal_versions (legal_version),
  decided_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
comment on table public.activity_consents is
  'Evidencia del consentimiento (o rechazo) para medir actividad básica. APPEND-ONLY: la decisión vigente es la última fila de la versión vigente.
   No guarda texto, IP ni user-agent. Sin acceso directo del cliente: escribe solo el servidor.';
create index if not exists activity_consents_player_version_idx on public.activity_consents (player_id, consent_version, consent_id desc);
create index if not exists activity_consents_legal_version_idx on public.activity_consents (legal_version);

create or replace function public.activity_consents_reject_mutation()
returns trigger language plpgsql set search_path = public as $$
begin
  raise exception 'activity_consents_append_only' using errcode = 'P0001';
end;
$$;
revoke execute on function public.activity_consents_reject_mutation() from public, anon, authenticated;
drop trigger if exists activity_consents_append_only on public.activity_consents;
create trigger activity_consents_append_only before update or delete on public.activity_consents
  for each row execute function public.activity_consents_reject_mutation();

alter table public.activity_consents enable row level security;
revoke all on table public.activity_consents from public, anon, authenticated;
revoke update, delete on table public.activity_consents from service_role;
grant select, insert on table public.activity_consents to service_role;

-- Estado del jugador respecto de la versión VIGENTE: 'disabled' (medición apagada) | 'unset' | 'granted' | 'declined'
create or replace function public._activity_consent_status(p_player uuid)
returns text
language sql
stable
set search_path = public
as $$
  select case when cfg.v is null then 'disabled'
              else coalesce((select c.decision from public.activity_consents c
                              where c.player_id = p_player and c.consent_version = cfg.v order by c.consent_id desc limit 1), 'unset') end
    from (select activity_consent_version as v from public.app_config where id = 1) cfg
$$;

-- Registra una decisión (idempotente: no repite la misma decisión). Declinar/retirar ELIMINA la actividad ya registrada.
create or replace function public._record_activity_consent(p_player uuid, p_version text, p_decision text, p_source text, p_at timestamptz)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_last text;
  v_legal text;
begin
  select c.decision into v_last from public.activity_consents c
   where c.player_id = p_player and c.consent_version = p_version order by c.consent_id desc limit 1;
  if v_last is not distinct from p_decision then
    return jsonb_build_object('changed', false, 'status', p_decision);
  end if;
  select legal_version into v_legal from public.app_config where id = 1;
  insert into public.activity_consents (player_id, consent_version, decision, source, legal_version, decided_at)
  values (p_player, p_version, p_decision, p_source, v_legal, coalesce(p_at, now()));
  if p_decision = 'declined' then
    delete from public.player_activity_days where player_id = p_player;
  end if;
  return jsonb_build_object('changed', true, 'status', p_decision);
end;
$$;

create or replace function public.get_my_activity_consent()
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_player uuid;
  v_cfg text;
  v_at timestamptz;
begin
  select player_id into v_player from public.players where auth_user_id = auth.uid() and type = 'registered' and deleted_at is null;
  if v_player is null then
    raise exception 'no_player_for_session' using errcode = 'P0001';
  end if;
  select activity_consent_version into v_cfg from public.app_config where id = 1;
  if v_cfg is not null then
    select c.decided_at into v_at from public.activity_consents c where c.player_id = v_player and c.consent_version = v_cfg order by c.consent_id desc limit 1;
  end if;
  return jsonb_build_object('enabled', v_cfg is not null, 'version', v_cfg, 'status', public._activity_consent_status(v_player), 'decidedAt', v_at);
end;
$$;

create or replace function public.set_my_activity_consent(p_version text, p_granted boolean, p_source text default 'prompt')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player uuid;
  v_cfg text;
  v_rec jsonb;
begin
  select player_id into v_player from public.players where auth_user_id = auth.uid() and type = 'registered' and deleted_at is null;
  if v_player is null then
    raise exception 'no_player_for_session' using errcode = 'P0001';
  end if;
  if not public.consume_rate_limit(v_player, 'set_activity_consent', 20, 60) then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  select activity_consent_version into v_cfg from public.app_config where id = 1;
  if v_cfg is null then
    raise exception 'activity_measurement_disabled' using errcode = 'P0001';
  end if;
  if p_version is distinct from v_cfg then
    raise exception 'activity_consent_version_not_current' using errcode = 'P0001';
  end if;
  if p_granted is null or p_source not in ('prompt', 'settings') then
    raise exception 'invalid_activity_consent_request' using errcode = 'P0001';
  end if;
  v_rec := public._record_activity_consent(v_player, v_cfg, case when p_granted then 'granted' else 'declined' end, p_source, now());
  return jsonb_build_object('ok', true, 'version', v_cfg, 'status', public._activity_consent_status(v_player), 'changed', (v_rec ->> 'changed')::boolean);
end;
$$;

revoke all on function public._activity_consent_status(uuid) from public, anon, authenticated;
revoke all on function public._record_activity_consent(uuid, text, text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.get_my_activity_consent() from public, anon;
revoke all on function public.set_my_activity_consent(text, boolean, text) from public, anon;
grant execute on function public.get_my_activity_consent() to authenticated;
grant execute on function public.set_my_activity_consent(text, boolean, text) to authenticated;

-- 5) Alta: consentimiento declarado (FUSIONADO sobre handle_email_confirmed vigente)
create or replace function public.handle_email_confirmed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player_id uuid;
  v_legal_version text;
  v_ac_version text;
  v_ac_decision text;
  v_ac_cfg text;
begin
  if new.email_confirmed_at is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.email_confirmed_at is not null then
    return new;
  end if;

  insert into public.players (auth_user_id, type, display_name)
  values (new.id, 'registered', null)
  on conflict (auth_user_id) do nothing
  returning player_id into v_player_id;

  if v_player_id is null then
    select player_id into v_player_id from public.players where auth_user_id = new.id;
  end if;

  insert into public.profiles (player_id)
  values (v_player_id)
  on conflict (player_id) do nothing;

  insert into public.level_states (player_id, status)
  values (v_player_id, 'PENDIENTE')
  on conflict (player_id) do nothing;

  -- L1 — aceptación legal declarada en el signUp (metadata `legal_version`). Solo versiones CONOCIDAS del
  -- catálogo; accepted_at = momento en que el servidor creó el usuario Auth (inmediatamente posterior a la
  -- aceptación en pantalla, que bloquea signUp sin checkbox). Idempotente. Falta/versión desconocida => no se
  -- registra nada (nunca se fabrica): complete_profile y el gate de reaceptación lo resuelven.
  v_legal_version := nullif(trim(coalesce(new.raw_user_meta_data, '{}'::jsonb) ->> 'legal_version'), '');
  if v_legal_version is not null
     and exists (select 1 from public.legal_versions where legal_version = v_legal_version) then
    perform public.record_legal_acceptance(v_player_id, v_legal_version, 'signup', new.created_at);
  end if;

  -- BRAMU Metrics — consentimiento ESPECÍFICO y OPCIONAL para la medición de actividad, declarado en el mismo paso del alta (metadata
  -- `activity_consent` = granted|declined y `activity_consent_version`). Solo se registra si coincide con la versión VIGENTE del servidor
  -- (si el servidor la apagó o cambió mientras tanto, no se fabrica nada: el jugador verá la pantalla de decisión). Idempotente.
  v_ac_version := nullif(trim(coalesce(new.raw_user_meta_data, '{}'::jsonb) ->> 'activity_consent_version'), '');
  v_ac_decision := nullif(trim(coalesce(new.raw_user_meta_data, '{}'::jsonb) ->> 'activity_consent'), '');
  select activity_consent_version into v_ac_cfg from public.app_config where id = 1;
  if v_ac_cfg is not null and v_ac_version = v_ac_cfg and v_ac_decision in ('granted', 'declined') then
    perform public._record_activity_consent(v_player_id, v_ac_cfg, v_ac_decision, 'signup', new.created_at);
  end if;

  insert into public.pilot_events (event_name, player_id, properties)
  values ('signup_completed', v_player_id, '{}'::jsonb);

  return new;
end;
$$;

-- 6) Presencia: solo con medición activa y consentimiento vigente
create or replace function public.register_app_presence(
  p_display_mode text,
  p_platform text,
  p_app_bundle text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_player_id uuid;
  v_day date;
  v_cfg text;
  v_rows integer;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'code', 'not_authenticated');
  end if;

  -- Validación estricta: ante cualquier valor fuera de contrato NO se escribe nada.
  if p_display_mode is null or p_display_mode not in ('standalone', 'browser') then
    return jsonb_build_object('ok', false, 'code', 'invalid_display_mode');
  end if;
  if p_platform is null or p_platform not in ('ios', 'android', 'desktop', 'other') then
    return jsonb_build_object('ok', false, 'code', 'invalid_platform');
  end if;
  if p_app_bundle is not null and p_app_bundle !~ '^[0-9]{2}\.[0-9]{2}-h[0-9]{1,3}$' then
    return jsonb_build_object('ok', false, 'code', 'invalid_app_bundle');
  end if;

  -- El jugador SIEMPRE sale de la sesión. Solo cuentas registradas y no eliminadas.
  select player_id into v_player_id
    from public.players
   where auth_user_id = v_uid and type = 'registered' and deleted_at is null;
  if v_player_id is null then
    return jsonb_build_object('ok', false, 'code', 'no_player_for_session');
  end if;

  -- Consentimiento (decisión de Sebastián): NO se registra ninguna apertura si la medición está desactivada en este entorno o si el jugador
  -- no aceptó la versión vigente (nunca antes de aceptar; nunca hacia atrás). La exigencia es SERVER-SIDE: el cliente no decide.
  select activity_consent_version into v_cfg from public.app_config where id = 1;
  if v_cfg is null then
    return jsonb_build_object('ok', false, 'code', 'measurement_disabled');
  end if;
  if public._activity_consent_status(v_player_id) <> 'granted' then
    return jsonb_build_object('ok', false, 'code', 'no_consent');
  end if;

  v_day := (now() at time zone 'America/Argentina/Buenos_Aires')::date;

  insert into public.player_activity_days as d (player_id, activity_date, display_mode, platform, app_bundle)
  values (v_player_id, v_day, p_display_mode, p_platform, p_app_bundle)
  on conflict (player_id, activity_date) do update
     set last_seen_at = now(),
         opens = least(d.opens + 1, 999),
         -- «usó la app instalada ese día» si ALGUNA apertura fue standalone.
         display_mode = case when d.display_mode = 'standalone' or excluded.display_mode = 'standalone' then 'standalone' else 'browser' end,
         platform = excluded.platform,
         app_bundle = coalesce(excluded.app_bundle, d.app_bundle)
   -- Anti-amplificación de escritura: ráfagas dentro de 5 min no tocan la fila.
   where d.last_seen_at < now() - interval '5 minutes';
  get diagnostics v_rows = row_count;

  return jsonb_build_object('ok', true, 'recorded', v_rows > 0);
end;
$$;

-- 7) Purga única de actividad capturada SIN consentimiento válido (idempotente)
delete from public.player_activity_days a
 where public._activity_consent_status(a.player_id) <> 'granted'
    or a.first_seen_at < (select min(c.decided_at) from public.activity_consents c, public.app_config cfg
                           where c.player_id = a.player_id and c.consent_version = cfg.activity_consent_version and c.decision = 'granted');

-- 8) Informe de acceso/copia: suma la constancia propia
create or replace function public.admin_export_player_data(p_player_id uuid)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v jsonb;
begin
  v := public._admin_export_player_data_raw(p_player_id);
  if v is null or coalesce((v ->> 'ok')::boolean, false) is not true then
    return v;
  end if;
  -- Presencia propia: sin player_id (es el del titular). Nada de terceros.
  v := v || jsonb_build_object('activityDays', coalesce((
    select jsonb_agg(jsonb_build_object(
             'date', a.activity_date, 'firstSeenAt', a.first_seen_at, 'lastSeenAt', a.last_seen_at,
             'opens', a.opens, 'displayMode', a.display_mode, 'platform', a.platform, 'appBundle', a.app_bundle
           ) order by a.activity_date)
      from public.player_activity_days a where a.player_id = p_player_id
  ), '[]'::jsonb));
  -- Constancia de la propia decisión sobre la medición (derecho de acceso): versión, decisión, origen y fecha. Sin player_id.
  v := v || jsonb_build_object('activityConsents', coalesce((
    select jsonb_agg(jsonb_build_object('consentVersion', c.consent_version, 'decision', c.decision, 'source', c.source,
                                        'decidedAt', c.decided_at, 'legalVersion', c.legal_version) order by c.consent_id)
      from public.activity_consents c where c.player_id = p_player_id
  ), '[]'::jsonb));
  return public._export_redact_third_parties(v, p_player_id);
end;
$$;

-- 9) Metrics: cobertura de la medición y retención sobre altas que aceptaron desde el alta
create or replace function public._metrics_meta(p_range text, p_compare boolean, p_include boolean, p_asof timestamptz, p_window jsonb)
returns jsonb
language sql
stable
set search_path = public
as $$
  select jsonb_build_object(
    'environment', (select c.environment from public.app_config c where c.id = 1),
    'catalogVersion', 'metrics_v1',
    'generatedAt', now(),
    'asOf', p_asof,
    'tz', 'America/Argentina/Buenos_Aires',
    'completeDaysOnly', true,
    'today', (p_asof at time zone 'America/Argentina/Buenos_Aires')::date,
    'range', p_range,
    'compare', coalesce(p_compare, true) and p_window -> 'prevFrom' is not null and p_window ->> 'prevFrom' is not null,
    'window', jsonb_build_array(p_window -> 'from', p_window -> 'to'),
    'previousWindow', case when p_window ->> 'prevFrom' is null then null
                           else jsonb_build_array(p_window -> 'prevFrom', p_window -> 'prevTo') end,
    'granularity', p_window ->> 'granularity',
    'presenceSince', (select min(a.first_seen_at) from public.player_activity_days a),
    'includeInternal', coalesce(p_include, false),
    'internalExcluded', case when coalesce(p_include, false) then 0 else (select count(*) from public.metrics_internal_players) end,
    'minCell', public.metrics_min_cell(),
    -- Cobertura de la medición: la actividad solo cuenta cuentas que ACEPTARON. `consenting` se oculta (null) si el número o su complemento
    -- quedan en 1–4 personas (misma regla k que los desgloses).
    'measurement', (
      select jsonb_build_object(
        'enabled', cfg.v is not null, 'consentVersion', cfg.v, 'accounts', a.n,
        'consenting', case when cfg.v is null then null
                           when s.g >= public.metrics_min_cell() and (a.n - s.g = 0 or a.n - s.g >= public.metrics_min_cell()) then s.g
                           else null end)
        from (select activity_consent_version as v from public.app_config where id = 1) cfg,
             lateral (select count(*) as n from public.players pl where pl.type = 'registered' and pl.is_active and pl.deleted_at is null
                        and not public._metrics_excluded(pl.player_id, p_include)) a,
             lateral (select count(*) as g from public.players pl where pl.type = 'registered' and pl.is_active and pl.deleted_at is null
                        and not public._metrics_excluded(pl.player_id, p_include) and public._activity_consent_status(pl.player_id) = 'granted') s
    )
  )
$$;

create or replace function public._metrics_retention(p_from timestamptz, p_to timestamptz, p_asof timestamptz, p_include boolean)
returns jsonb
language sql
stable
set search_path = public
as $$
  with t as (select (min(a.first_seen_at) at time zone 'America/Argentina/Buenos_Aires')::date as since_day from public.player_activity_days a),
  asof as (select (p_asof at time zone 'America/Argentina/Buenos_Aires')::date as d),
  cohort as (
    select pl.player_id, (pl.created_at at time zone 'America/Argentina/Buenos_Aires')::date as sd
      from public.players pl, t
     where pl.type = 'registered' and pl.deleted_at is null
       -- solo altas que aceptaron la medición DESDE el día del alta (si aceptó después, no hay presencia de sus primeros días: no es comparable)
       and public._activity_consent_status(pl.player_id) = 'granted'
       and exists (select 1 from public.activity_consents c, public.app_config cfg
                    where c.player_id = pl.player_id and c.consent_version = cfg.activity_consent_version and c.decision = 'granted'
                      and c.decided_at < ((((pl.created_at at time zone 'America/Argentina/Buenos_Aires')::date + 1)::timestamp) at time zone 'America/Argentina/Buenos_Aires'))
       and pl.created_at >= p_from and pl.created_at < p_to
       and t.since_day is not null and (pl.created_at at time zone 'America/Argentina/Buenos_Aires')::date >= t.since_day - 1
       and not public._metrics_excluded(pl.player_id, p_include)
  ), r as (
    select c.player_id, c.sd,
           coalesce(bool_or(a.activity_date = c.sd + 1), false) as d1,
           coalesce(bool_or(a.activity_date = c.sd + 7), false) as d7,
           coalesce(bool_or(a.activity_date = c.sd + 30), false) as d30,
           coalesce(bool_or(date_trunc('week', a.activity_date::timestamp) = date_trunc('week', c.sd::timestamp) + interval '1 week'), false) as w1,
           coalesce(bool_or(date_trunc('week', a.activity_date::timestamp) = date_trunc('week', c.sd::timestamp) + interval '4 weeks'), false) as w4
      from cohort c left join public.player_activity_days a on a.player_id = c.player_id
     group by 1, 2
  )
  select jsonb_build_object(
    'cohort', count(*),
    'd1_den', count(*) filter (where sd + 1 <= asof.d - 1),   'd1_ret', count(*) filter (where d1 and sd + 1 <= asof.d - 1),
    'd7_den', count(*) filter (where sd + 7 <= asof.d - 1),   'd7_ret', count(*) filter (where d7 and sd + 7 <= asof.d - 1),
    'd30_den', count(*) filter (where sd + 30 <= asof.d - 1), 'd30_ret', count(*) filter (where d30 and sd + 30 <= asof.d - 1),
    'w1_den', count(*) filter (where date_trunc('week', sd::timestamp) + interval '2 weeks' <= date_trunc('week', asof.d::timestamp)),
    'w1_ret', count(*) filter (where w1 and date_trunc('week', sd::timestamp) + interval '2 weeks' <= date_trunc('week', asof.d::timestamp)),
    'w4_den', count(*) filter (where date_trunc('week', sd::timestamp) + interval '5 weeks' <= date_trunc('week', asof.d::timestamp)),
    'w4_ret', count(*) filter (where w4 and date_trunc('week', sd::timestamp) + interval '5 weeks' <= date_trunc('week', asof.d::timestamp))
  ) from r, asof
$$;
