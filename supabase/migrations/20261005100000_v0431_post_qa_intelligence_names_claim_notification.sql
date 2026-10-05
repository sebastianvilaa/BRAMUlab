-- BRAMUlab — V04.31 · ronda post QA humano (05/10/2026). Forward-only.
--
--  1) BUG 2 — BRAMU Intelligence conservaba nombres provisionales viejos (Bruno/federico): get_player_intelligence_history leía
--     `display_name_snapshot` crudo; ahora resuelve el nombre CANÓNICO actual con `_match_participant_display_name` (misma regla que
--     get_my_matches/get_match_detail). (El fingerprint de Intelligence suma además el nombre — ver intelligence-presentation.js —
--     para invalidar checkpoints ya persistidos con nombres viejos.)
--  2) get_notifications: `openedByName` en identity_questioned (el actor de un self-report ya no figura en el partido) y
--     `claimedByName` en la nueva notificación persistida `identity_claimed`.
--  3) Nueva notificación `identity_claimed`: cuando un link de invitación pasa a `claimed`, se avisa a QUIEN GENERÓ ESE LINK
--     (destinatario inequívoco: provisional_claims.created_by_player_id). Trigger sobre provisional_claims: no toca
--     claim_provisional_player (función de concurrencia crítica). No revela nada de quien rechazó ("NO SOY YO" no se notifica).

-- ------------------------------------------------------------------
-- 1) Intelligence: nombres canónicos
-- ------------------------------------------------------------------

create or replace function public.get_player_intelligence_history(
  p_limit integer default 300,
  p_before_played_at timestamptz default null,
  p_include_hidden boolean default false
)
returns table (
  match_id uuid,
  status text,
  played_at timestamptz,
  played_at_time_known boolean,
  format_id text,
  scoring_system text,
  my_team text,
  created_by_player_id uuid,
  validated_at timestamptz,
  validation_deadline_at timestamptz,
  hidden boolean,
  has_open_identity_issue boolean,
  official_eligible boolean,
  participants jsonb,
  sets jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_player_id uuid;
  v_limit integer := least(greatest(coalesce(p_limit, 300), 1), 1000);
begin
  select player_id into v_caller_player_id from public.players where auth_user_id = auth.uid();
  if v_caller_player_id is null then
    raise exception 'no_player_for_session' using errcode = 'P0001';
  end if;

  return query
    select
      m.match_id,
      -- Expiración lógica en lectura, mismo criterio que get_my_matches (Bloque 5, Decisión #4):
      -- nunca se escribe un estado 'expired' físico.
      case when m.status = 'pending_validation' and m.validation_deadline_at <= now()
           then 'expired' else m.status end as status,
      m.played_at,
      m.played_at_time_known,
      m.format_id,
      m.scoring_system,
      mp_self.team as my_team,
      m.created_by_player_id,
      m.validated_at,
      m.validation_deadline_at,
      coalesce(mus.hidden, false) as hidden,
      exists (
        select 1 from public.match_identity_issues mii
        where mii.match_id = m.match_id and mii.status = 'open'
      ) as has_open_identity_issue,
      -- Mismo predicado que get_player_match_history_for_level_engine (Bloque 6), sin ventana
      -- de 180 días: acá interesa saber si ESTE partido, en cualquier momento de su historia,
      -- tuvo impacto oficial de Nivel — nunca si sigue dentro de la ventana de repetición.
      exists (
        select 1 from public.match_level_results mlr
        where mlr.match_id = m.match_id and mlr.effect_status = 'applied' and mlr.eligible
      ) as official_eligible,
      (
        select jsonb_agg(jsonb_build_object(
          'team', mp.team, 'position', mp.position_in_team, 'playerId', mp.player_id,
          'displayName', public._match_participant_display_name(mp.player_id, mp.display_name_snapshot)
        ) order by mp.team, mp.position_in_team)
        from public.match_participants mp where mp.match_id = m.match_id
      ) as participants,
      (
        select jsonb_agg(jsonb_build_object(
          'setNumber', ms.set_number, 'gamesA', ms.games_a, 'gamesB', ms.games_b,
          'tiebreakA', ms.tiebreak_a, 'tiebreakB', ms.tiebreak_b
        ) order by ms.set_number)
        from public.match_sets ms
        where ms.match_id = m.match_id
          and ms.revision_number = (select mr.revision_number from public.match_revisions mr where mr.revision_id = m.current_revision_id)
      ) as sets
    from public.matches m
    join public.match_participants mp_self on mp_self.match_id = m.match_id and mp_self.player_id = v_caller_player_id
    left join public.match_user_state mus on mus.match_id = m.match_id and mus.player_id = v_caller_player_id
    where m.status <> 'annulled'
      and (p_include_hidden or coalesce(mus.hidden, false) = false)
      and (p_before_played_at is null or m.played_at < p_before_played_at)
    order by m.played_at desc, m.created_at desc, m.match_id
    limit v_limit;
end;
$$;

revoke all on function public.get_player_intelligence_history(integer, timestamptz, boolean) from public, anon;
grant execute on function public.get_player_intelligence_history(integer, timestamptz, boolean) to authenticated;

-- ------------------------------------------------------------------
-- 2) get_notifications (openedByName, claimedByName)
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
    ) all_rows
    where not p_only_unread or all_rows.read_at is null
    order by all_rows.created_at desc
    limit v_limit;
end;
$$;

-- ------------------------------------------------------------------
-- 3) identity_claimed: tipo permitido + trigger
-- ------------------------------------------------------------------

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in (
  'pending_review', 'correction_proposed', 'correction_accepted',
  'identity_questioned', 'identity_resolved', 'identity_unidentified',
  'match_validated', 'match_expired', 'admin_action', 'identity_claimed'
));

create or replace function public._notify_inviter_identity_claimed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'claimed' and old.status is distinct from 'claimed'
     and new.claimed_by_player_id is not null
     and new.created_by_player_id is not null
     and new.created_by_player_id <> new.claimed_by_player_id then
    insert into public.notifications (player_id, type, match_id, payload)
    values (new.created_by_player_id, 'identity_claimed', null,
            jsonb_build_object('claimedByPlayerId', new.claimed_by_player_id));
  end if;
  return new;
end;
$$;

revoke all on function public._notify_inviter_identity_claimed() from public, anon, authenticated;

drop trigger if exists provisional_claims_notify_inviter on public.provisional_claims;
create trigger provisional_claims_notify_inviter
  after update of status on public.provisional_claims
  for each row execute function public._notify_inviter_identity_claimed();

