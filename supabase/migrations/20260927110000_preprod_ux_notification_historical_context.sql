-- BRAMUlab — Corrección post-QA sobre Ronda UX 25/09 (Notificaciones históricas + contexto de
-- partido).
--
-- HALLAZGO REAL DE QA (Work, cuenta Seba / @seba_qa, Staging real): la bandeja de Notificaciones
-- mostraba 5 filas `match_validated` IDÉNTICAS — mismo título "Partido oficial", mismo body "Tu
-- partido ya quedó validado.", misma fecha "25-sept", sin rival/resultado/ningún dato que las
-- distinga entre sí. Central auditó Supabase Staging real y confirmó: las 5 son notificaciones
-- HISTÓRICAS, persistidas ANTES de que se aplicara `preprod_ux_notification_actor_enrichment`
-- (Ronda UX 25/09, Ronda 2) — su `payload` quedó literalmente `{}` para siempre, porque el
-- trigger `bloque6_enrich_notification_actor` que esa migración agregó solo enriquece INSERTS
-- FUTUROS (dispara BEFORE INSERT); nunca reescribe filas ya persistidas.
--
-- Bug adicional encontrado por central: de esas 5 filas, 2 fueron causadas por el propio Seba
-- (él ejecutó `officialize_match_validation` con trigger='initial' en esos 2 partidos) — sin
-- `payload.actorPlayerId`, el frontend (`mapB6Notification`/`selfCaused`, Ronda UX 25/09 Ronda 2
-- §9) no tiene cómo saber que esas 2 son un eco de su propia acción, y las sigue mostrando como
-- si fueran informativas de un tercero — viola la regla ya cerrada "nunca una notificación
-- informativa redundante hacia el mismo actor que realizó la acción".
--
-- SOLUCIÓN: extensión aditiva de `get_notifications`, reconstrucción EN LECTURA (nunca backfill
-- destructivo de `notifications` — cero UPDATE a esa tabla en esta migración). Dos piezas:
--
--   1) `_bloque6_notification_historical_actor(match_id, notification_type)` — reconstruye
--      `actorPlayerId` desde `match_actions` SOLO cuando hay una correspondencia INEQUÍVOCA:
--      mapea el tipo de notificación al `action_type` REAL que esa RPC productora registra (
--      verificado leyendo el código, no asumido — ver tabla de mapeo abajo) y exige que exista
--      EXACTAMENTE UNA fila de `match_actions` con ese match_id+action_type; con 0 o 2+ filas
--      (ambiguo) devuelve NULL, nunca adivina. `match_validated`→`validated` es el único caso
--      con evidencia real en Staging (los 5 fixtures de QA); los otros 3 (`correction_accepted`,
--      `identity_resolved`→`participant_replaced`, `identity_unidentified`→
--      `participant_unidentified`) se resuelven con el MISMO criterio inequívoco, pero sin
--      evidencia de QA que los haya ejercitado todavía.
--   2) `_bloque6_notification_match_context(match_id, caller_player_id)` — arma
--      `{myTeam, opponentNames, score}` desde `match_participants`/`match_sets` de la revisión
--      VIGENTE (`matches.current_revision_id`, mismo criterio que `get_match_detail`), orientado
--      SIEMPRE a la perspectiva del caller (score invertido si su equipo es B — `match_sets`
--      guarda games_a/games_b fijos a team=A/B, nunca a "quién mira"). `opponentNames` usa
--      `display_name_snapshot` (nunca resuelve identidad por nombre en vivo). Si no hay sets
--      todavía, `score` queda `null` — nunca inventado.
--
-- `get_notifications` (CREATE OR REPLACE sobre la MISMA firma/columnas/permisos que
-- `preprod_ux_notification_actor_enrichment`, última definición aplicada) suma `matchContext` a
-- las 4 tareas derivadas Y a las persistidas informativas, y reconstruye `actorPlayerId` SOLO
-- para las persistidas informativas cuando `payload` todavía no lo trae — el payload YA
-- enriquecido de una fila futura (el trigger de Ronda 2 ya lo puso ahí) tiene prioridad absoluta,
-- nunca se pisa. Cero llamadas adicionales del cliente: todo sale de la MISMA lectura de
-- `get_notifications` que ya existía — cero N+1, cero `get_match_detail` por tarjeta.
--
-- Contrato viejo: `payload` de una fila histórica sin enriquecer es `{}` o sin `actorPlayerId`;
-- ninguna fila trae `matchContext`.
-- Contrato nuevo (aditivo, retrocompatible): TODA fila ligada a un `matchId` gana
-- `payload.matchContext` (o `null` si no hay evidencia); las 4 informativas persistidas ganan
-- además `payload.actorPlayerId` reconstruido cuando la evidencia es inequívoca. Un frontend que
-- todavía no lea `matchContext` sigue funcionando exactamente igual — el payload solo gana
-- claves, nunca pierde ni cambia una existente.
--
-- NO se toca la tabla `notifications` (sin UPDATE, sin backfill), ni el trigger
-- `bloque6_enrich_notification_actor` (sigue intacto, sigue enriqueciendo inserts futuros), ni
-- ninguna otra RPC/migración ya aplicada. NO aplicada desde esta sesión (sin Supabase CLI ni
-- credenciales en este sandbox, igual que todas las rondas anteriores) — central la revisará y
-- aplicará contra Staging real.

-- ------------------------------------------------------------------
-- 1) _bloque6_notification_historical_actor — actor histórico, solo con evidencia inequívoca.
-- ------------------------------------------------------------------

create or replace function public._bloque6_notification_historical_actor(p_match_id uuid, p_notification_type text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  -- Mapeo notification.type -> match_actions.action_type REAL (leído de las RPCs productoras,
  -- nunca asumido): 'match_validated'/'correction_accepted' comparten nombre literal con su
  -- action_type (ver officialize_match_validation, 20260924110000_bloque6_public_match_outcomes.
  -- sql); 'identity_resolved' registra 'participant_replaced' y 'identity_unidentified' registra
  -- 'participant_unidentified' (ver 20260921230000_bloque6_correction_and_identity_rpcs.sql y la
  -- rama identity_* de officialize_match_validation) — NUNCA el nombre del tipo de notificación.
  -- Cualquier otro tipo (admin_action, match_expired, o uno futuro sin mapeo) devuelve NULL acá
  -- mismo, porque `action_type = null` no matchea ninguna fila.
  select actor_player_id
  from (
    select ma.actor_player_id, count(*) over () as match_count
    from public.match_actions ma
    where ma.match_id = p_match_id
      and ma.action_type = (
        case p_notification_type
          when 'match_validated' then 'validated'
          when 'correction_accepted' then 'correction_accepted'
          when 'identity_resolved' then 'participant_replaced'
          when 'identity_unidentified' then 'participant_unidentified'
          else null
        end
      )
  ) candidates
  -- INEQUÍVOCO = exactamente una fila. Con 0 (sin evidencia) o 2+ (un partido con más de un
  -- evento del mismo tipo a lo largo de su vida — posible para correction_accepted/
  -- participant_replaced/participant_unidentified, nunca para validated) nunca se adivina: el
  -- actor queda ausente y el frontend cae al copy genérico de siempre.
  where match_count = 1;
$$;

comment on function public._bloque6_notification_historical_actor is
  'Reconstruye actorPlayerId para una notificación PERSISTIDA histórica (payload sin enriquecer)
   desde match_actions, solo cuando hay exactamente una fila con el action_type real que esa RPC
   productora registra para ese tipo de notificación. NULL si no hay evidencia inequívoca — nunca
   inventa un actor. Uso interno de get_notifications.';

-- ------------------------------------------------------------------
-- 2) _bloque6_notification_match_context — contexto mínimo del partido, orientado al caller.
-- ------------------------------------------------------------------

create or replace function public._bloque6_notification_match_context(p_match_id uuid, p_caller_player_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'myTeam', mp_me.team,
    'opponentNames', (
      select jsonb_agg(mp2.display_name_snapshot order by mp2.position_in_team)
      from public.match_participants mp2
      where mp2.match_id = p_match_id
        and mp2.team = (case mp_me.team when 'A' then 'B' else 'A' end)
    ),
    -- match_sets.games_a/games_b están SIEMPRE fijos a team=A/B (mismo criterio documentado en
    -- el comment de esa tabla), nunca a "quién mira" — acá se invierte a la perspectiva del
    -- caller si su equipo es B. Revisión VIGENTE (matches.current_revision_id), mismo patrón
    -- exacto que ya usa get_match_detail para 'sets'. Sin sets todavía (no debería pasar para un
    -- partido ya validated/con match_actions, pero por las dudas): jsonb_agg sin filas -> null,
    -- nunca un score inventado.
    'score', (
      select jsonb_agg(
        (case mp_me.team when 'B' then ms.games_b else ms.games_a end)::text
        || '–' ||
        (case mp_me.team when 'B' then ms.games_a else ms.games_b end)::text
        order by ms.set_number
      )
      from public.match_sets ms
      where ms.match_id = p_match_id
        and ms.revision_number = (
          select mr.revision_number
          from public.matches m
          join public.match_revisions mr on mr.revision_id = m.current_revision_id
          where m.match_id = p_match_id
        )
    )
  )
  from public.match_participants mp_me
  where mp_me.match_id = p_match_id
    and mp_me.player_id = p_caller_player_id;
$$;

comment on function public._bloque6_notification_match_context is
  'Contexto mínimo de un partido ({myTeam, opponentNames, score}) para que una notificación
   ligada a matchId sea reconocible sin una segunda RPC — opponentNames desde
   display_name_snapshot (nunca identidad por nombre en vivo), score orientado al caller desde la
   revisión vigente. NULL si el caller no es participante o no hay match_id. Uso interno de
   get_notifications.';

revoke all on function public._bloque6_notification_historical_actor(uuid, text) from public;
revoke all on function public._bloque6_notification_match_context(uuid, uuid) from public;

-- ------------------------------------------------------------------
-- get_notifications: suma matchContext a las 4 formas de notificación (derivadas 1-3 +
-- persistidas 4) y actorPlayerId reconstruido a las persistidas SOLO cuando falta. CREATE OR
-- REPLACE puro sobre la MISMA firma/columnas de retorno/permisos que
-- 20260926120000_preprod_ux_notification_actor_enrichment.sql (última definición aplicada) — el
-- resto del cuerpo (tareas derivadas 1-3, ventanas de tiempo, orden, límite) se preserva sin
-- tocar una sola línea de lógica preexistente, solo se agregan claves al jsonb de cada rama.
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

  -- C-08/C-10 (10_Revision_Final_Pre_Staging_ChatGPT.md): las tareas accionables se DERIVAN en
  -- lectura desde el estado real del partido/revisión/incidencia — nunca se persisten como
  -- mensajes históricos (report_identity_issue/propose_post_validation_correction ya NO insertan
  -- 'identity_questioned'/'correction_proposed'). Así desaparecen automáticamente para AMBOS
  -- integrantes de la pareja apenas se resuelve el estado, sin poder marcarse "leídas"
  -- prematuramente (una tarea sintética nunca tiene una fila real que mark_notification_read
  -- pueda actualizar). La ventana de 3 días de una corrección pendiente (C-10) se evalúa acá
  -- mismo contra validated_at — sin cron, una corrección vencida simplemente deja de aparecer.
  -- notification_id se deriva determinísticamente (md5 formateado como uuid) del tipo+clave real
  -- para que sea estable entre lecturas sucesivas.
  return query
    select all_rows.* from (
      -- 1) pending_review — partido pending_validation, deadline vigente, la acción es del lado
      --    del caller (aparece para AMBOS integrantes de esa pareja, cada uno al consultar).
      --    Corrección post-QA — suma matchContext (§2): mismo criterio que el resto de las ramas.
      select
        (regexp_replace(md5('pending_review:' || m.match_id::text), '^(.{8})(.{4})(.{4})(.{4})(.{12})$', '\1-\2-\3-\4-\5'))::uuid as notification_id,
        'pending_review'::text as type,
        m.match_id as match_id,
        jsonb_build_object('matchContext', public._bloque6_notification_match_context(m.match_id, v_caller_player_id)) as payload,
        m.created_at as created_at,
        null::timestamptz as read_at
      from public.matches m
      join public.match_participants mp on mp.match_id = m.match_id and mp.player_id = v_caller_player_id
      where m.status = 'pending_validation'
        and m.validation_deadline_at > now()
        and m.action_side = mp.team

      union all

      -- 2) correction_proposed — corrección post-validación en espera, ventana de 3 días vigente
      --    (C-10: vencida deja de mostrarse, sin necesitar materializar nada), lado del caller es
      --    quien debe responder.
      select
        (regexp_replace(md5('correction_proposed:' || m.pending_correction_revision_id::text), '^(.{8})(.{4})(.{4})(.{4})(.{12})$', '\1-\2-\3-\4-\5'))::uuid,
        'correction_proposed'::text,
        m.match_id,
        jsonb_build_object(
          'pendingCorrectionRevisionId', m.pending_correction_revision_id,
          'proposedByPlayerId', mr.proposed_by_player_id,
          'matchContext', public._bloque6_notification_match_context(m.match_id, v_caller_player_id)
        ),
        mr.created_at,
        null::timestamptz
      from public.matches m
      join public.match_revisions mr on mr.revision_id = m.pending_correction_revision_id
      join public.match_participants mp on mp.match_id = m.match_id and mp.player_id = v_caller_player_id
      where m.pending_correction_revision_id is not null
        and mp.team <> mr.proposed_by_team
        and m.validated_at is not null
        and now() <= m.validated_at + interval '3 days'

      union all

      -- 3) identity_questioned — incidencia open sobre un partido donde el caller sigue siendo
      --    participante habilitado.
      select
        (regexp_replace(md5('identity_questioned:' || mii.issue_id::text), '^(.{8})(.{4})(.{4})(.{4})(.{12})$', '\1-\2-\3-\4-\5'))::uuid,
        'identity_questioned'::text,
        mii.match_id,
        jsonb_build_object(
          'issueId', mii.issue_id, 'team', mii.team, 'positionInTeam', mii.position_in_team,
          'openedByPlayerId', mii.opened_by_player_id,
          'matchContext', public._bloque6_notification_match_context(mii.match_id, v_caller_player_id)
        ),
        mii.opened_at,
        null::timestamptz
      from public.match_identity_issues mii
      join public.match_participants mp on mp.match_id = mii.match_id and mp.player_id = v_caller_player_id
      where mii.status = 'open'

      union all

      -- 4) notificaciones PERSISTIDAS informativas — eventos ya consumados (match_validated,
      --    correction_accepted, identity_resolved/unidentified, admin_action, etc.).
      --    Corrección post-QA — el LATERAL calcula UNA vez por fila tanto el actor histórico
      --    como matchContext (nunca dos llamadas separadas a la misma función). El payload YA
      --    enriquecido de una fila FUTURA (trigger bloque6_enrich_notification_actor, Ronda 2)
      --    tiene prioridad absoluta: solo se agrega actorPlayerId reconstruido cuando la clave
      --    todavía no está en `n.payload`, nunca se pisa un valor existente.
      select
        n.notification_id, n.type, n.match_id,
        (
          case
            when n.payload ? 'actorPlayerId' then n.payload
            when ctx.hist_actor is not null then n.payload || jsonb_build_object('actorPlayerId', ctx.hist_actor)
            else n.payload
          end
        ) || jsonb_build_object('matchContext', ctx.match_context) as payload,
        n.created_at, n.read_at
      from public.notifications n
      left join lateral (
        select
          public._bloque6_notification_historical_actor(n.match_id, n.type) as hist_actor,
          public._bloque6_notification_match_context(n.match_id, v_caller_player_id) as match_context
      ) ctx on true
      where n.player_id = v_caller_player_id
    ) all_rows
    where not p_only_unread or all_rows.read_at is null
    order by all_rows.created_at desc
    limit v_limit;
end;
$$;

comment on function public.get_notifications is
  'Bandeja del caller, más reciente primero. Nunca expone notificaciones de otro jugador. Unión
   de tareas accionables DERIVADAS en lectura (pending_review/correction_proposed/
   identity_questioned — C-08/C-10, desaparecen solas al resolverse, nunca marcables como
   leídas) con notificaciones persistidas informativas (eventos ya ocurridos). Ronda UX 25/09
   (Ronda 2, §10): identity_questioned suma openedByPlayerId; las persistidas informativas llegan
   con payload.actorPlayerId ya enriquecido por el trigger de esa misma migración, para los 4
   tipos donde ese actor es real (nunca admin_action). Corrección post-QA (26/09/2026): TODA fila
   ligada a un matchId suma payload.matchContext ({myTeam, opponentNames, score}, orientado al
   caller); las persistidas informativas reconstruyen actorPlayerId histórico cuando la evidencia
   en match_actions es inequívoca (nunca pisa un valor ya enriquecido).';

revoke all on function public.get_notifications(integer, boolean) from public;
grant execute on function public.get_notifications(integer, boolean) to authenticated;
