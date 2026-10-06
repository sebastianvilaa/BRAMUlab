-- BRAMUlab V04.36 — Anular carga (autoservicio del AUTOR original sobre su propia carga pendiente).
--
-- Decisión de producto CERRADA (136 §D3 / 140 §B): el autor puede retirar su carga mientras NADIE más haya reconocido el
-- encuentro. Efecto: el partido queda `annulled` (se conserva internamente, nunca se borra) con kind='author_retracted',
-- desaparece de Historial/Pendientes/Home/notificaciones para TODOS los participantes, y no deja ningún efecto deportivo
-- (Nivel, Ranking, Grupos, Intelligence, stats, contadores): un pending nunca los produjo.
--
-- NO reutiliza admin_annul_match (genera notificaciones `admin_action`, contrario a la regla "sin notificación nueva").
--
-- Elegibilidad (server-side, `_annul_submission_block_reason`):
--   · el caller es el AUTOR (matches.created_by_player_id) y participante;
--   · status = pending_validation y validation_deadline_at vigente;
--   · NINGUNA OTRA persona realizó una acción que reconozca el encuentro: confirmó (`confirmed`), propuso/sostuvo una revisión
--     (`revision_proposed`/`revision_sustained`/revisión con otro proponente), declaró de nuevo desde el mismo lado
--     (`declared_again_same_side`), reemplazó un participante afirmando quién sí jugó (`participant_replaced`) o equivalentes
--     (`validated`/`correction_accepted`);
--   · NO bloquean: `identity_questioned` / "No participé" de otra persona, `participant_unidentified` (consecuencia del
--     anterior) ni ninguna acción del propio autor.
--
-- Invisibilidad robusta: `_match_is_author_retracted` filtra get_my_matches (aun con p_include_hidden), get_match_detail,
-- get_notifications (incidencias abiertas y notificaciones persistidas del partido) y los ids de partidos recuperados.
-- Además se oculta el partido para todos los participantes (match_user_state) y se anulan los candidatos de duplicado abiertos.
-- Sin cambio de firma de ninguna función existente. Idempotente. Sin notificaciones nuevas.

create or replace function public._match_is_author_retracted(p_match_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.matches m
    where m.match_id = p_match_id
      and m.status = 'annulled'
      and m.annulment_reason ->> 'kind' = 'author_retracted'
  );
$$;
revoke all on function public._match_is_author_retracted(uuid) from public, anon, authenticated;

-- NULL = elegible; si no, el código del primer bloqueo.
create or replace function public._annul_submission_block_reason(p_match_id uuid, p_player_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_match public.matches;
begin
  select * into v_match from public.matches where match_id = p_match_id;
  if v_match is null
     or not exists (select 1 from public.match_participants mp where mp.match_id = p_match_id and mp.player_id = p_player_id) then
    return 'match_not_found';
  end if;
  if v_match.created_by_player_id <> p_player_id then
    return 'not_author';
  end if;
  if v_match.status <> 'pending_validation' or v_match.validation_deadline_at <= now() then
    return 'not_pending';
  end if;
  -- Reconocimiento del encuentro por OTRA persona (las acciones del propio autor nunca bloquean).
  if exists (
    select 1 from public.match_actions ma
    where ma.match_id = p_match_id
      and ma.actor_player_id <> p_player_id
      and ma.action_type in ('confirmed', 'revision_proposed', 'revision_sustained', 'declared_again_same_side',
                             'participant_replaced', 'validated', 'correction_accepted')
  ) or exists (
    select 1 from public.match_revisions mr
    where mr.match_id = p_match_id and mr.proposed_by_player_id <> p_player_id
  ) then
    return 'recognized_by_other';
  end if;
  return null;
end;
$$;
revoke all on function public._annul_submission_block_reason(uuid, uuid) from public, anon, authenticated;

create or replace function public.annul_my_match_submission(p_match_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid;
  v_match public.matches;
  v_team text;
  v_reason text;
begin
  select player_id into v_caller from public.players where auth_user_id = auth.uid();
  if v_caller is null then
    raise exception 'no_player_for_session' using errcode = 'P0001';
  end if;

  -- El mismo lock FOR UPDATE que usan confirmar/proponer/crear-o-adjuntar: serializa contra un reconocimiento concurrente.
  select * into v_match from public.matches where match_id = p_match_id for update;
  if v_match is null
     or not exists (select 1 from public.match_participants mp where mp.match_id = p_match_id and mp.player_id = v_caller) then
    return jsonb_build_object('ok', false, 'code', 'match_not_found');
  end if;

  if v_match.status = 'annulled' and v_match.annulment_reason ->> 'kind' = 'author_retracted' then
    -- Para quien no es el autor, un partido retirado "no existe" (invisible); para el autor la repetición es idempotente.
    if v_match.created_by_player_id <> v_caller then
      return jsonb_build_object('ok', false, 'code', 'match_not_found');
    end if;
    return jsonb_build_object('ok', true, 'code', 'already_annulled', 'idempotentReturn', true, 'matchId', p_match_id);
  end if;

  v_reason := public._annul_submission_block_reason(p_match_id, v_caller);
  if v_reason is not null then
    return jsonb_build_object('ok', false, 'code', v_reason);
  end if;

  select mp.team into v_team from public.match_participants mp where mp.match_id = p_match_id and mp.player_id = v_caller limit 1;

  update public.matches
    set status = 'annulled', annulled_at = now(), action_side = null,
        annulment_reason = jsonb_build_object('kind', 'author_retracted', 'byPlayerId', v_caller),
        updated_at = now()
    where match_id = p_match_id;

  insert into public.match_actions (match_id, action_type, actor_player_id, acting_side, metadata)
  values (p_match_id, 'annulled', v_caller, v_team, jsonb_build_object('reason', 'author_retracted'));

  -- Fuera de todas las superficies (queda auditable en base): oculto para cada participante.
  insert into public.match_user_state (match_id, player_id, hidden, hidden_at)
    select p_match_id, mp.player_id, true, now()
      from public.match_participants mp where mp.match_id = p_match_id and mp.player_id is not null
    on conflict (match_id, player_id) do update
      set hidden = true, hidden_at = coalesce(public.match_user_state.hidden_at, now()), updated_at = now();

  -- Un posible duplicado abierto que involucre a este partido deja de tener sentido.
  update public.match_duplicate_candidates
    set status = 'void', updated_at = now()
    where status = 'open' and (match_low_id = p_match_id or match_high_id = p_match_id);

  -- Deliberadamente NO inserta en public.notifications (regla cerrada: sin notificación nueva).
  return jsonb_build_object('ok', true, 'code', 'annulled', 'matchId', p_match_id);
end;
$$;
comment on function public.annul_my_match_submission(uuid) is
  'V04.36 — el AUTOR retira su carga pendiente si nadie más la reconoció (ver cabecera de la migración). Conserva el partido
   como annulled/author_retracted, lo oculta a todos, sin notificaciones ni efectos deportivos. Idempotente.';
revoke all on function public.annul_my_match_submission(uuid) from public, anon;
grant execute on function public.annul_my_match_submission(uuid) to authenticated;

-- get_my_matches — excluye cargas retiradas por su autor (misma firma que antes; fuente: 20261003140000_g3b_duplicate_score_confirmation_counts_locks.sql)
create or replace function public.get_my_matches(p_limit integer default 50, p_include_hidden boolean default false)
returns table (
  match_id uuid,
  status text,
  played_at timestamptz,
  played_at_time_known boolean,
  reported_time_zone text,
  format_id text,
  scoring_system text,
  location_name text,
  location_lat numeric,
  location_lng numeric,
  my_team text,
  action_side text,
  is_action_mine boolean,
  ready_for_validation boolean,
  created_by_player_id uuid,
  validated_at timestamptz,
  validation_deadline_at timestamptz,
  hidden boolean,
  private_note text,
  participants jsonb,
  sets jsonb,
  pending_correction_revision_id uuid,
  has_open_identity_issue boolean,
  pending_correction_origin text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_player_id uuid;
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 200);
begin
  select player_id into v_caller_player_id
  from public.players
  where auth_user_id = auth.uid();

  if v_caller_player_id is null then
    raise exception 'no_player_for_session' using errcode = 'P0001';
  end if;

  return query
    select
      m.match_id,
      case when m.status = 'pending_validation' and m.validation_deadline_at <= now()
           then 'expired' else m.status end as status,
      m.played_at,
      m.played_at_time_known,
      m.reported_time_zone,
      m.format_id,
      m.scoring_system,
      m.location_name,
      m.location_lat,
      m.location_lng,
      mp_self.team as my_team,
      m.action_side,
      (m.status = 'pending_validation'
        and m.validation_deadline_at > now()
        and m.action_side = mp_self.team) as is_action_mine,
      (m.status = 'pending_validation'
        and m.validation_deadline_at > now()
        and m.action_side is null) as ready_for_validation,
      m.created_by_player_id,
      m.validated_at,
      m.validation_deadline_at,
      coalesce(mus.hidden, false) as hidden,
      mus.private_note,
      (
        select jsonb_agg(jsonb_build_object(
          'team', mp.team,
          'position', mp.position_in_team,
          'playerId', mp.player_id,
          'displayName', public._match_participant_display_name(mp.player_id, mp.display_name_snapshot)
        ) order by mp.team, mp.position_in_team)
        from public.match_participants mp
        where mp.match_id = m.match_id
      ) as participants,
      (
        select jsonb_agg(jsonb_build_object(
          'setNumber', ms.set_number,
          'gamesA', ms.games_a,
          'gamesB', ms.games_b,
          'tiebreakA', ms.tiebreak_a,
          'tiebreakB', ms.tiebreak_b
        ) order by ms.set_number)
        from public.match_sets ms
        where ms.match_id = m.match_id
          and ms.revision_number = (
            select mr.revision_number
            from public.match_revisions mr
            where mr.revision_id = m.current_revision_id
          )
      ) as sets,
      m.pending_correction_revision_id,
      exists (
        select 1 from public.match_identity_issues mii
        where mii.match_id = m.match_id and mii.status = 'open'
      ) as has_open_identity_issue,
      case when public._pending_correction_is_duplicate_origin(m.match_id) then 'duplicate' else null end as pending_correction_origin
    from public.matches m
    join public.match_participants mp_self
      on mp_self.match_id = m.match_id
     and mp_self.player_id = v_caller_player_id
    left join public.match_user_state mus
      on mus.match_id = m.match_id
     and mus.player_id = v_caller_player_id
    where (p_include_hidden or coalesce(mus.hidden, false) = false)
      -- V04.36: una carga retirada por su autor no existe para nadie, ni siquiera con "mostrar ocultos".
      and not public._match_is_author_retracted(m.match_id)
    order by m.played_at desc
    limit v_limit;
end;
$$;
revoke all on function public.get_my_matches(integer, boolean) from public, anon;
grant execute on function public.get_my_matches(integer, boolean) to authenticated;

-- get_match_detail — null para cargas retiradas + canAnnulSubmission (fuente: 20261003140000_g3b_duplicate_score_confirmation_counts_locks.sql)
create or replace function public.get_match_detail(p_match_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_player_id uuid;
  v_match public.matches;
  v_my_row public.match_participants;
  v_result jsonb;
begin
  select player_id into v_caller_player_id
  from public.players
  where auth_user_id = auth.uid();

  if v_caller_player_id is null then
    raise exception 'no_player_for_session' using errcode = 'P0001';
  end if;

  select * into v_match
  from public.matches
  where match_id = p_match_id;

  if v_match is null or public._match_is_author_retracted(v_match.match_id) then
    return null;
  end if;

  select * into v_my_row
  from public.match_participants
  where match_id = p_match_id
    and player_id = v_caller_player_id;

  if v_my_row is null then
    return null;
  end if;

  select jsonb_build_object(
    'matchId', v_match.match_id,
    'status', case when v_match.status = 'pending_validation'
                       and v_match.validation_deadline_at <= now()
                   then 'expired' else v_match.status end,
    'playedAt', v_match.played_at,
    'playedAtTimeKnown', v_match.played_at_time_known,
    'reportedTimeZone', v_match.reported_time_zone,
    'formatId', v_match.format_id,
    'scoringSystem', v_match.scoring_system,
    'locationName', v_match.location_name,
    'locationLat', v_match.location_lat,
    'locationLng', v_match.location_lng,
    'myTeam', v_my_row.team,
    'actionSide', v_match.action_side,
    'isActionMine', (
      v_match.status = 'pending_validation'
      and v_match.validation_deadline_at > now()
      and v_match.action_side = v_my_row.team
    ),
    'readyForValidation', (
      v_match.status = 'pending_validation'
      and v_match.validation_deadline_at > now()
      and v_match.action_side is null
    ),
    'createdByPlayerId', v_match.created_by_player_id,
    -- V04.36: la UI solo ofrece "Anular carga" si el servidor dice que es elegible (nunca lo infiere en cliente).
    'canAnnulSubmission', (public._annul_submission_block_reason(v_match.match_id, v_caller_player_id) is null),
    'validatedAt', v_match.validated_at,
    'validationDeadlineAt', v_match.validation_deadline_at,
    'pendingCorrectionRevisionId', v_match.pending_correction_revision_id,
    'pendingCorrectionOrigin', case when public._pending_correction_is_duplicate_origin(v_match.match_id) then 'duplicate' else null end,
    'currentRevisionNumber', (
      select revision_number
      from public.match_revisions
      where revision_id = v_match.current_revision_id
    ),
    'participants', (
      select jsonb_agg(jsonb_build_object(
        'team', mp.team,
        'position', mp.position_in_team,
        'playerId', mp.player_id,
        'displayName', public._match_participant_display_name(mp.player_id, mp.display_name_snapshot)
      ) order by mp.team, mp.position_in_team)
      from public.match_participants mp
      where mp.match_id = v_match.match_id
    ),
    'sets', (
      select jsonb_agg(jsonb_build_object(
        'setNumber', ms.set_number,
        'gamesA', ms.games_a,
        'gamesB', ms.games_b,
        'tiebreakA', ms.tiebreak_a,
        'tiebreakB', ms.tiebreak_b
      ) order by ms.set_number)
      from public.match_sets ms
      where ms.match_id = v_match.match_id
        and ms.revision_number = (
          select revision_number
          from public.match_revisions
          where revision_id = v_match.current_revision_id
        )
    ),
    -- Ronda correctiva (revisión central) — ver nota de cabecera §1. `revision_number - 1` sobre
    -- la MISMA revisión vigente ya resuelta arriba (nunca un segundo criterio de "cuál es la
    -- vigente"); si no existe esa revisión_number-1 en match_sets (currentRevisionNumber=1),
    -- `jsonb_agg` sin filas devuelve `null`, igual que `sets` arriba sin `coalesce`.
    'previousRevisionSets', (
      select jsonb_agg(jsonb_build_object(
        'setNumber', ms.set_number,
        'gamesA', ms.games_a,
        'gamesB', ms.games_b,
        'tiebreakA', ms.tiebreak_a,
        'tiebreakB', ms.tiebreak_b
      ) order by ms.set_number)
      from public.match_sets ms
      where ms.match_id = v_match.match_id
        and ms.revision_number = (
          select revision_number - 1
          from public.match_revisions
          where revision_id = v_match.current_revision_id
        )
    ),
    -- Ronda correctiva (revisión central) — ver nota de cabecera §2. `pending_correction_revision_id`
    -- ya se exponía como id (`pendingCorrectionRevisionId`, sin cambios), nunca resuelto a sets
    -- hasta ahora. Sin corrección pendiente, `v_match.pending_correction_revision_id` es NULL:
    -- comparar `revision_id = NULL` nunca es verdadero en SQL, el subselect no encuentra fila y
    -- el `jsonb_agg` externo devuelve `null` sin necesitar un `case`/`if` aparte.
    'pendingCorrectionSets', (
      select jsonb_agg(jsonb_build_object(
        'setNumber', ms.set_number,
        'gamesA', ms.games_a,
        'gamesB', ms.games_b,
        'tiebreakA', ms.tiebreak_a,
        'tiebreakB', ms.tiebreak_b
      ) order by ms.set_number)
      from public.match_sets ms
      where ms.match_id = v_match.match_id
        and ms.revision_number = (
          select revision_number
          from public.match_revisions
          where revision_id = v_match.pending_correction_revision_id
        )
    ),
    'revisionCount', (
      select count(*)
      from public.match_revisions
      where match_id = v_match.match_id
    ),
    'actions', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'actionType', ma.action_type,
        'actorPlayerId', ma.actor_player_id,
        'actingSide', ma.acting_side,
        'occurredAt', ma.occurred_at
      ) order by ma.occurred_at), '[]'::jsonb)
      from public.match_actions ma
      where ma.match_id = v_match.match_id
    ),
    'openIdentityIssues', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'issueId', mii.issue_id, 'team', mii.team, 'positionInTeam', mii.position_in_team,
        'openedAt', mii.opened_at, 'resolutionDeadlineAt', mii.resolution_deadline_at
      )), '[]'::jsonb)
      from public.match_identity_issues mii
      where mii.match_id = v_match.match_id and mii.status = 'open'
    ),
    'hidden', coalesce((
      select hidden
      from public.match_user_state
      where match_id = v_match.match_id
        and player_id = v_caller_player_id
    ), false),
    'privateNote', (
      select private_note
      from public.match_user_state
      where match_id = v_match.match_id
        and player_id = v_caller_player_id
    )
  ) into v_result;

  return v_result;
end;
$$;
revoke all on function public.get_match_detail(uuid) from public, anon;
grant execute on function public.get_match_detail(uuid) to authenticated;

-- get_notifications — nada de una carga retirada por su autor (fuente: 20261005100000_v0431_post_qa_intelligence_names_claim_notification.sql)
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
        and (now() <= m.validated_at + interval '3 days' or public._pending_correction_is_duplicate_origin(m.match_id))

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
          -- V04.30 — la persona señaló SU PROPIO lugar ("No participé"): copy en primera persona, sin hablar de "un jugador cargado".
          'selfReported', coalesce(mii.previous_player_id = mii.opened_by_player_id, false),
          -- V04.31 — el actor de un self-report deja de figurar en el partido (su lugar queda "Por identificar"): el nombre viaja acá.
          'openedByName', (select nullif(btrim(op.display_name), '') from public.players op where op.player_id = mii.opened_by_player_id),
          'matchContext', public._bloque6_notification_match_context(mii.match_id, v_caller_player_id)
        ),
        mii.opened_at,
        null::timestamptz
      from public.match_identity_issues mii
      join public.match_participants mp on mp.match_id = mii.match_id and mp.player_id = v_caller_player_id
      where mii.status = 'open'
        and not public._match_is_author_retracted(mii.match_id)

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
        ) || jsonb_build_object('matchContext', ctx.match_context)
          -- V04.31 — identity_claimed: nombre ACTUAL de quien se vinculó (al vincular, en un alta nueva, el perfil todavía no existe).
          || (case when n.type = 'identity_claimed'
                then jsonb_build_object('claimedByName', (select coalesce(nullif(btrim(cp.display_name), ''), 'Alguien') from public.players cp where cp.player_id = (n.payload->>'claimedByPlayerId')::uuid))
                else '{}'::jsonb end) as payload,
        n.created_at, n.read_at
      from public.notifications n
      left join lateral (
        select
          public._bloque6_notification_historical_actor(n.match_id, n.type) as hist_actor,
          public._bloque6_notification_match_context(n.match_id, v_caller_player_id) as match_context
      ) ctx on true
      where n.player_id = v_caller_player_id
        and (n.match_id is null or not public._match_is_author_retracted(n.match_id))
    ) all_rows
    where not p_only_unread or all_rows.read_at is null
    order by all_rows.created_at desc
    limit v_limit;
end;
$$;
revoke all on function public.get_notifications(integer, boolean) from public, anon;
grant execute on function public.get_notifications(integer, boolean) to authenticated;

-- get_my_recent_recoveries — sin cargas retiradas (fuente: 20261005200000_v0433_recuperados_pendientes.sql)
create or replace function public.get_my_recent_recoveries(p_days integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_caller uuid;
  v_days integer := least(greatest(coalesce(p_days, 30), 1), 365);
  v_rows jsonb;
begin
  select p.player_id into v_caller from public.players p where p.auth_user_id = auth.uid();
  if v_caller is null then
    raise exception 'no_player_for_session' using errcode = 'P0001';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'recoveryId', r.recovery_id,
           'sourceName', coalesce(nullif(btrim(sp.display_name), ''), 'Jugador'),
           'matchIds', to_jsonb(array(select x from unnest(r.recovered_match_ids) x where not public._match_is_author_retracted(x))),
           'recoveredAt', coalesce(r.completed_at, r.created_at)
         ) order by coalesce(r.completed_at, r.created_at) desc), '[]'::jsonb)
    into v_rows
    from public.player_identity_recoveries r
    join public.players sp on sp.player_id = r.source_provisional_player_id
   where r.target_player_id = v_caller
     and r.status = 'completed'
     and exists (select 1 from unnest(r.recovered_match_ids) x where not public._match_is_author_retracted(x))
     and coalesce(r.completed_at, r.created_at) > now() - make_interval(days => v_days);

  return jsonb_build_object('ok', true, 'recoveries', v_rows);
end;
$$;
revoke all on function public.get_my_recent_recoveries(integer) from public, anon;
grant execute on function public.get_my_recent_recoveries(integer) to authenticated;

-- get_my_recovered_match_ids — sin cargas retiradas (fuente: 20261004100000_v0430_create_or_attach_idempotent_replay.sql)
create or replace function public.get_my_recovered_match_ids(p_recovery_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_caller uuid;
  v_ids uuid[];
  v_src text;
begin
  select p.player_id into v_caller from public.players p where p.auth_user_id = auth.uid();
  if v_caller is null then
    raise exception 'no_player_for_session' using errcode = 'P0001';
  end if;
  select r.recovered_match_ids, nullif(btrim(sp.display_name), '')
    into v_ids, v_src
    from public.player_identity_recoveries r
    join public.players sp on sp.player_id = r.source_provisional_player_id
   where r.recovery_id = p_recovery_id and r.target_player_id = v_caller and r.status = 'completed';
  if v_ids is null then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  v_ids := array(select x from unnest(v_ids) x where not public._match_is_author_retracted(x));
  return jsonb_build_object('ok', true, 'matchIds', to_jsonb(v_ids), 'sourceName', coalesce(v_src, 'Jugador'));
end;
$$;
revoke all on function public.get_my_recovered_match_ids(uuid) from public, anon;
grant execute on function public.get_my_recovered_match_ids(uuid) to authenticated;
