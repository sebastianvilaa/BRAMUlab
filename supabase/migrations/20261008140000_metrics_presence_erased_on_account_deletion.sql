-- BRAMU Metrics V1 — la actividad diaria se ELIMINA al eliminar la cuenta (decisión confirmada de Sebastián, 08/10/2026).
--
-- Regla: los datos históricos de actividad solo pueden conservarse si quedan REALMENTE anonimizados y no permiten identificar al jugador;
-- si no se puede garantizar, deben eliminarse. Verificación técnica (supabase/functions/_shared/metrics-deletion-anonymization.test.mjs):
-- con la versión anterior, una fila de `player_activity_days` de una cuenta eliminada seguía unida por `player_id` a partidos (fechas y
-- compañeros), Ranking (localidad, banda de Nivel, rama) y grupos del MISMO jugador → seudonimizada, no anónima. No hay forma de garantizar
-- la anonimización sin romper ese vínculo, así que la fila se borra.
--
-- Cambios (aditivos y con retiro probado):
--   1) `admin_delete_player_account` — se reaplica IDÉNTICA a la definición vigente (20261003130000) salvo el borrado de la actividad diaria
--      (y de la marca de «cuenta interna») de ese jugador, también en la rama «ya eliminada» (limpieza idempotente). Usa `to_regclass`
--      para no depender de que las tablas de Metrics existan.
--   2) Purga única de las filas de actividad de cuentas YA eliminadas (si las hubiera).
--   3) `_metrics_retention` — la cohorte excluye cuentas eliminadas: su actividad ya no existe y, si contaran, bajarían la retención
--      como si hubieran dejado de volver. El texto de población de los KPI de retención lo declara.
-- Consecuencia asumida: las métricas históricas de uso (activos, retención) pierden a quienes eliminan su cuenta. Es lo que implica no conservar nada identificable.
--
-- NO aplicada desde el sandbox del agente — la aplica Central en Staging y luego, con autorización, en Production (después de F1/F2/F4/F6).

-- ------------------------------------------------------------------
-- 1) Eliminación de cuenta: borra la actividad diaria
-- ------------------------------------------------------------------

create or replace function public.admin_delete_player_account(p_player_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player public.players;
  v_captured_auth_user_id uuid;
begin
  select * into v_player from public.players where player_id = p_player_id for update;

  if v_player is null then
    return jsonb_build_object('ok', false, 'code', 'player_not_found');
  end if;

  if v_player.deleted_at is not null then
    -- BRAMU Metrics: el registro de actividad diaria NO se conserva «anonimizado». Una fila conserva el player_id, que sigue enlazado a
    -- partidos, Ranking (localidad, banda de Nivel, rama) y grupos del mismo jugador: es SEUDONIMIZADO, no anónimo. Decisión confirmada de
    -- Sebastián: solo se conserva si queda realmente anonimizado; como no se puede garantizar, se ELIMINA junto con la cuenta.
    -- `to_regclass`: la función no depende de que existan las tablas de Metrics (retiro por niveles, entornos sin Metrics).
    if to_regclass('public.player_activity_days') is not null then
      execute 'delete from public.player_activity_days where player_id = $1' using p_player_id;
    end if;
    if to_regclass('public.metrics_internal_players') is not null then
      execute 'delete from public.metrics_internal_players where player_id = $1' using p_player_id;
    end if;
    select (properties->>'authUserId')::uuid into v_captured_auth_user_id
      from public.pilot_events
      where event_name = 'account_deleted' and player_id = p_player_id
      order by created_at desc
      limit 1;
    return jsonb_build_object(
      'ok', true, 'playerId', p_player_id, 'alreadyDeleted', true, 'authUserId', v_captured_auth_user_id
    );
  end if;

  if v_player.type <> 'registered' then
    return jsonb_build_object('ok', false, 'code', 'not_a_registered_account');
  end if;

  v_captured_auth_user_id := v_player.auth_user_id;

  -- ---- B2c/P0.3: salir de TODOS los grupos (Issue #4), en esta misma transacción. ----
  perform public._groups_account_deletion_cleanup(p_player_id);

  update public.players set
    display_name = 'Jugador eliminado',
    is_active = false,
    deleted_at = now(),
    auth_user_id = null,
    updated_at = now()
  where player_id = p_player_id;

  update public.profiles set
    username = null,
    first_name = null,
    last_name = null,
    display_name = null,
    avatar_url = null,
    birth_date = null,
    gender = null,
    dominant_hand = null,
    preferred_side = null,
    competitive_branch = null,
    location_id = null,
    location_effective_from = null,
    phone = null,
    allow_whatsapp_contact = false,
    current_category = null,
    current_category_at = null,
    ranking_opt_in = false,
    updated_at = now()
  where player_id = p_player_id;

  update public.match_participants
    set display_name_snapshot = 'Jugador eliminado'
    where player_id = p_player_id;

  -- V04.29: las identidades provisionales que esta cuenta había recuperado (tombstones) conservan el nombre con el
  -- que alguien las cargó: se anonimizan igual que la cuenta. La estructura deportiva (match_participants.player_id ya
  -- apunta a la cuenta) y la auditoría de player_identity_recoveries se preservan sin PII adicional.
  update public.players
    set display_name = 'Jugador eliminado', updated_at = now()
    where recovered_into_player_id = p_player_id;

  delete from public.intelligence_match_outputs
    where match_id in (select match_id from public.match_participants where player_id = p_player_id);

  delete from public.match_user_state where player_id = p_player_id;
  delete from public.notifications where player_id = p_player_id;

  delete from public.player_saved_players
    where owner_player_id = p_player_id or saved_player_id = p_player_id;
  delete from public.ranking_network_hidden
    where player_id = p_player_id or hidden_player_id = p_player_id;


  -- BRAMU Metrics: el registro de actividad diaria NO se conserva «anonimizado». Una fila conserva el player_id, que sigue enlazado a
  -- partidos, Ranking (localidad, banda de Nivel, rama) y grupos del mismo jugador: es SEUDONIMIZADO, no anónimo. Decisión confirmada de
  -- Sebastián: solo se conserva si queda realmente anonimizado; como no se puede garantizar, se ELIMINA junto con la cuenta.
  -- `to_regclass`: la función no depende de que existan las tablas de Metrics (retiro por niveles, entornos sin Metrics).
  if to_regclass('public.player_activity_days') is not null then
    execute 'delete from public.player_activity_days where player_id = $1' using p_player_id;
  end if;
  if to_regclass('public.metrics_internal_players') is not null then
    execute 'delete from public.metrics_internal_players where player_id = $1' using p_player_id;
  end if;

  insert into public.pilot_events (event_name, player_id, properties)
  values ('account_deleted', p_player_id, jsonb_build_object('authUserId', v_captured_auth_user_id));

  return jsonb_build_object(
    'ok', true, 'playerId', p_player_id, 'alreadyDeleted', false,
    'authUserId', v_captured_auth_user_id
  );
end;
$$;

revoke all on function public.admin_delete_player_account(uuid) from public;
revoke all on function public.admin_delete_player_account(uuid) from anon;
revoke all on function public.admin_delete_player_account(uuid) from authenticated;
grant execute on function public.admin_delete_player_account(uuid) to service_role;

-- ------------------------------------------------------------------
-- 2) Purga única: actividad de cuentas ya eliminadas
-- ------------------------------------------------------------------

delete from public.player_activity_days a
 using public.players p
 where p.player_id = a.player_id and p.deleted_at is not null;
delete from public.metrics_internal_players i
 using public.players p
 where p.player_id = i.player_id and p.deleted_at is not null;

-- ------------------------------------------------------------------
-- 3) Retención: la cohorte excluye cuentas eliminadas
-- ------------------------------------------------------------------

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
     where pl.type = 'registered' and pl.deleted_at is null and pl.created_at >= p_from and pl.created_at < p_to
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

-- Catálogo: población de los KPI de retención (sin cuentas eliminadas)
create or replace function public._metrics_catalog()
returns jsonb
language sql
immutable
set search_path = public
as $json$
select $cat$[
 {"id":"users.registered_now","section":"users","label":"Cuentas registradas","kind":"stock","definition":"Cuentas con email confirmado, activas y no eliminadas, al corte","population":"players registrados, is_active, sin deleted_at"},
 {"id":"users.signups","section":"users","label":"Altas","kind":"flow","definition":"Cuentas que confirmaron el email en la ventana (brutas: incluye las luego eliminadas)","population":"players registrados con created_at en la ventana"},
 {"id":"users.guests_open","section":"users","label":"Invitados vigentes","kind":"stock","definition":"Jugadores provisionales que no fueron recuperados en una cuenta","population":"players provisionales sin recovered_into_player_id ni deleted_at"},
 {"id":"users.profile_complete","section":"users","label":"Perfiles completos","kind":"stock","definition":"Cuentas actuales con @usuario definido","population":"cuentas registradas actuales"},
 {"id":"users.profile_complete_rate","section":"users","label":"Perfiles completos (%)","kind":"ratio","snapshot":true,"minN":5,"definition":"Perfiles completos sobre cuentas actuales","population":"cuentas registradas actuales"},
 {"id":"users.with_location_rate","section":"users","label":"Con localidad declarada (%)","kind":"ratio","snapshot":true,"minN":5,"definition":"Cuentas actuales con localidad declarada (sin localidad no equivale a otra localidad)","population":"cuentas registradas actuales"},
 {"id":"matches.created","section":"matches","label":"Partidos cargados","kind":"flow","definition":"Partidos creados en la ventana, en cualquier estado (hecho operativo, incluye anulados)","population":"matches con created_at en la ventana"},
 {"id":"matches.real","section":"matches","label":"Partidos reales cargados","kind":"flow","definition":"Partidos creados en la ventana que no fueron anulados","population":"matches con created_at en la ventana y status distinto de annulled"},
 {"id":"matches.annulled","section":"matches","label":"Partidos anulados","kind":"flow","definition":"Partidos creados en la ventana que hoy están anulados (duplicado, carga retirada o administrativa)","population":"matches con created_at en la ventana y status annulled"},
 {"id":"matches.validated","section":"matches","label":"Partidos validados","kind":"flow","definition":"Partidos cuya validación ocurrió dentro de la ventana","population":"matches validated con validated_at en la ventana"},
 {"id":"matches.pending_validable","section":"matches","label":"Pendientes validables","kind":"stock","definition":"Cargados en la ventana, plazo vigente y ambas parejas con al menos una cuenta registrada","population":"cohorte de la ventana, estado al corte"},
 {"id":"matches.pending_waiting_counterpart","section":"matches","label":"Pendientes esperando contraparte","kind":"stock","definition":"Cargados en la ventana, plazo vigente y una pareja sin cuentas registradas (no se validan solos)","population":"cohorte de la ventana, estado al corte"},
 {"id":"matches.expired_derived","section":"matches","label":"Vencidos sin validar","kind":"stock","definition":"Pendientes cuyo plazo venció (estado derivado: el servidor no escribe expired)","population":"cohorte de la ventana, estado al corte"},
 {"id":"matches.validation_rate_closed","section":"matches","label":"Validados entre validables con plazo cerrado (%)","kind":"ratio","minN":5,"definition":"Validados / (validados + vencidos con ambas parejas con cuenta), cohorte de la ventana","population":"cohorte de la ventana con plazo cerrado"},
 {"id":"matches.validation_p50_hours","section":"matches","label":"Mediana de validación (h)","kind":"duration","minN":5,"definition":"Horas entre carga y validación","population":"validados con validated_at en la ventana"},
 {"id":"matches.validation_p90_hours","section":"matches","label":"P90 de validación (h)","kind":"duration","minN":5,"definition":"Percentil 90 de horas entre carga y validación","population":"validados con validated_at en la ventana"},
 {"id":"matches.authors","section":"matches","label":"Autores únicos","kind":"flow","definition":"Jugadores distintos que cargaron al menos un partido real","population":"matches reales con created_at en la ventana"},
 {"id":"matches.registered_participants","section":"matches","label":"Participantes con cuenta","kind":"flow","definition":"Cuentas registradas distintas que participaron en partidos reales","population":"matches reales con created_at en la ventana"},
 {"id":"activation.cohort","section":"activation","label":"Cohorte madura de altas","kind":"flow","definition":"Altas de la ventana con al menos 7 días de antigüedad (las más recientes todavía no tuvieron tiempo de activarse)","population":"players registrados con alta en la ventana y antigüedad mayor o igual a 7 días"},
 {"id":"activation.cohort_immature","section":"activation","label":"Altas todavía inmaduras","kind":"flow","definition":"Altas de la ventana con menos de 7 días: no entran en los porcentajes","population":"players registrados con alta en la ventana y antigüedad menor a 7 días"},
 {"id":"activation.level_initial","section":"activation","label":"Completó Nivel inicial (%)","kind":"ratio","minN":5,"definition":"Cohorte madura con estimador inicial confirmado","population":"cohorte madura"},
 {"id":"activation.loaded_first","section":"activation","label":"Cargó su 1.er partido (%)","kind":"ratio","minN":5,"definition":"Cohorte madura que cargó al menos un partido real (autor)","population":"cohorte madura"},
 {"id":"activation.participated_first","section":"activation","label":"Participó en un partido (%)","kind":"ratio","minN":5,"definition":"Cohorte madura con al menos un partido real como participante (autor o no)","population":"cohorte madura"},
 {"id":"activation.participated_validated","section":"activation","label":"Participó en un partido validado (%)","kind":"ratio","minN":5,"definition":"Cohorte madura con al menos un partido validado como participante","population":"cohorte madura"},
 {"id":"activation.third_match","section":"activation","label":"Llegó al 3.er partido (%)","kind":"ratio","minN":5,"definition":"Cohorte madura con 3 o más partidos reales como participante","population":"cohorte madura"},
 {"id":"activation.fifth_match","section":"activation","label":"Llegó al 5.º partido (%)","kind":"ratio","minN":5,"definition":"Cohorte madura con 5 o más partidos reales como participante","population":"cohorte madura"},
 {"id":"activation.returned_other_week","section":"activation","label":"Volvió con una acción otra semana (%)","kind":"ratio","minN":5,"definition":"Cohorte madura con una acción de usuario registrada en una semana BA posterior a la de su alta (proxy retroactivo; la presencia exacta está en Uso)","population":"cohorte madura"},
 {"id":"activation.median_days_to_first_load","section":"activation","label":"Días del alta a la 1.ª carga (mediana)","kind":"duration","minN":5,"definition":"Mediana de días entre el alta y el primer partido real cargado","population":"cohorte madura que cargó"},
 {"id":"community.groups_active","section":"community","label":"Grupos vigentes","kind":"stock","definition":"Grupos con estado activo al corte","population":"groups status active"},
 {"id":"community.groups_created","section":"community","label":"Grupos creados","kind":"flow","definition":"Grupos creados en la ventana (incluye los luego eliminados)","population":"groups con created_at en la ventana"},
 {"id":"community.memberships_active","section":"community","label":"Membresías activas","kind":"stock","definition":"Pertenencias vigentes a grupos vigentes de cuentas no eliminadas","population":"group_memberships sin left_at en grupos activos"},
 {"id":"community.invites_created","section":"community","label":"Invitaciones creadas","kind":"flow","definition":"Enlaces de invitación generados en la ventana","population":"provisional_claims con created_at en la ventana"},
 {"id":"community.invites_claimed","section":"community","label":"Invitaciones canjeadas","kind":"flow","definition":"Invitaciones canjeadas dentro de la ventana","population":"provisional_claims claimed con claimed_at en la ventana"},
 {"id":"community.invites_open","section":"community","label":"Invitaciones abiertas","kind":"stock","definition":"Pendientes con vencimiento futuro al corte","population":"provisional_claims pending no vencidos"},
 {"id":"community.invites_expired","section":"community","label":"Invitaciones vencidas sin canjear","kind":"stock","definition":"Pendientes con vencimiento pasado (derivado: el estado expired solo se escribe al intentar canjear)","population":"provisional_claims pending vencidos"},
 {"id":"community.invite_conversion","section":"community","label":"Invitaciones canjeadas (%)","kind":"ratio","minN":5,"definition":"Canjeadas / (canjeadas + vencidas sin canjear), de las creadas en la ventana","population":"invitaciones de la ventana ya resueltas"},
 {"id":"community.ranking_editions","section":"community","label":"Ediciones de Ranking publicadas","kind":"flow","definition":"Ediciones semanales publicadas en la ventana","population":"ranking_editions con published_at en la ventana"},
 {"id":"community.groups_with_match","section":"community","label":"Grupos con partido","kind":"flow","definition":"Grupos vigentes al corte con al menos un partido validado calificable (criterio de Grupos BRAMU: 3 o más integrantes) jugado dentro de la ventana","population":"groups status active con partido calificable en la ventana"},
 {"id":"community.groups_avg_members","section":"community","label":"Integrantes por grupo (promedio)","kind":"stock","minN":5,"definition":"Promedio de integrantes vigentes por grupo vigente, al corte (requiere al menos 5 grupos)","population":"groups status active"},
 {"id":"community.level_calibrated_share","section":"community","label":"Nivel calibrado (%)","kind":"ratio","snapshot":true,"minN":5,"definition":"Cuentas con Nivel CALIBRADO sobre las que ya iniciaron su Nivel (sin PENDIENTE), al corte. Foto del estado actual: no se compara","population":"cuentas registradas actuales con Nivel iniciado"},
 {"id":"community.ranking_days_since_edition","section":"community","label":"Días desde la última edición de Ranking","kind":"stock","definition":"Días de Buenos Aires entre la última edición semanal publicada y el corte","population":"ranking_editions publicadas"},
 {"id":"community.ranking_eligible_players","section":"community","label":"Elegibles en la última edición","kind":"stock","definition":"Cuentas elegibles para Ranking en la última edición publicada (alcance global), según el snapshot de esa edición","population":"ranking_rows global elegibles de la última edición"},
 {"id":"community.ranking_eligibility_rate","section":"community","label":"Cuentas elegibles para Ranking (%)","kind":"ratio","snapshot":true,"minN":5,"definition":"Cuentas actuales que figuran como elegibles en la última edición sobre el total de cuentas actuales. Foto del estado actual: no se compara","population":"cuentas registradas actuales"},
 {"id":"usage.dau","section":"usage","label":"Activos en el último día completo","kind":"flow","definition":"Jugadores distintos con presencia en el último día completo de la ventana (ayer, en la ventana actual; apertura real autenticada, no último login). La actividad de hoy se informa aparte como parcial","population":"player_activity_days del día"},
 {"id":"usage.wau","section":"usage","label":"Activos 7 días","kind":"flow","definition":"Jugadores distintos con presencia en los 7 días completos que terminan ayer (no se suman DAU)","population":"player_activity_days de 7 días"},
 {"id":"usage.mau","section":"usage","label":"Activos 30 días","kind":"flow","definition":"Jugadores distintos con presencia en los 30 días completos que terminan ayer","population":"player_activity_days de 30 días"},
 {"id":"usage.dau_avg","section":"usage","label":"Promedio diario de activos","kind":"flow","definition":"Promedio de activos por día dentro de la ventana, desde que hay presencia","population":"días con presencia instrumentada"},
 {"id":"usage.standalone_share","section":"usage","label":"Uso desde la app instalada (%)","kind":"ratio","minN":5,"definition":"Días de presencia abiertos en modo app instalada. Es uso, NO instalaciones","population":"días de presencia de la ventana"},
 {"id":"usage.wau_with_action","section":"usage","label":"Con acción 7 días","kind":"flow","definition":"Jugadores distintos con una acción de usuario registrada en 7 días (retroactivo; no es presencia)","population":"acciones de usuario persistidas"},
 {"id":"usage.mau_with_action","section":"usage","label":"Con acción 30 días","kind":"flow","definition":"Jugadores distintos con una acción de usuario registrada en 30 días (retroactivo; no es presencia)","population":"acciones de usuario persistidas"},
 {"id":"usage.ret_w1","section":"usage","label":"Retención semanal W1 (%)","kind":"ratio","minN":5,"definition":"Altas con presencia en la semana BA siguiente a la de su alta (solo cohortes maduras y posteriores al inicio de la presencia)","population":"altas de la ventana (sin cuentas eliminadas: su actividad se borra) con semana objetivo completa"},
 {"id":"usage.ret_w4","section":"usage","label":"Retención semanal W4 (%)","kind":"ratio","minN":5,"definition":"Altas con presencia en la 4.ª semana BA posterior a la de su alta","population":"altas de la ventana (sin cuentas eliminadas: su actividad se borra) con semana objetivo completa"},
 {"id":"usage.ret_d1","section":"usage","label":"Retención D1 (%)","kind":"ratio","minN":5,"definition":"Altas con presencia exactamente al día siguiente","population":"altas de la ventana (sin cuentas eliminadas: su actividad se borra) con el día objetivo completo"},
 {"id":"usage.ret_d7","section":"usage","label":"Retención D7 (%)","kind":"ratio","minN":5,"definition":"Altas con presencia exactamente 7 días después","population":"altas de la ventana (sin cuentas eliminadas: su actividad se borra) con el día objetivo completo"},
 {"id":"usage.ret_d30","section":"usage","label":"Retención D30 (%)","kind":"ratio","minN":5,"definition":"Altas con presencia exactamente 30 días después","population":"altas de la ventana (sin cuentas eliminadas: su actividad se borra) con el día objetivo completo"}
]$cat$::jsonb
$json$;
comment on function public._metrics_catalog is 'BRAMU Metrics: catálogo cerrado y versionado de KPIs (id, sección, tipo, definición, población, muestra mínima, snapshot).';
