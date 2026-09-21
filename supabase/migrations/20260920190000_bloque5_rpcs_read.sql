-- BRAMUlab — Bloque 5: RPCs de lectura y escritura trivial.
--
-- Depende de 20260920180000_bloque5_matches_core.sql. Ver
-- docs/BRAMUlab/Implementacion/Backend/Bloque_05/{02_Analisis_Claude.md §10/§11,
-- 06_Revision_Pre_Staging_ChatGPT.md} para el contrato completo de cada función. Única vía de
-- lectura de las 7 tablas de partidos: ninguna tiene policy ni GRANT de SELECT para
-- `authenticated` (§5 de la revisión pre-Staging) — estas RPC `SECURITY DEFINER` corren con los
-- privilegios del dueño de la tabla, nunca con los del caller.
--
--   1) compute_pending_action_count(p_player_id) — helper interno (no otorgado a authenticated,
--      mismo criterio que consume_rate_limit en Bloque 4), reusado por get_pending_action_count
--      y por create_or_attach_match (próxima migración).
--   2) get_pending_action_count() — contador personal + límite (5) para el caller.
--   3) get_my_matches(...) — feed de partidos del caller, con expiración calculada en LECTURA
--      (Decisión #4 de 04_Revision_ChatGPT.md: sin pg_cron, sin escritura física de 'expired').
--   4) get_match_detail(p_match_id) — detalle completo; 0 filas/NULL para quien no participa,
--      nunca confirma ni niega la existencia del match_id (mismo criterio que get_public_profile
--      de Bloque 4).
--   5) hide_match_for_me / set_match_private_note — únicas vías de escritura de
--      match_user_state. Ocultar nunca borra el partido compartido.
--   6) list_related_provisional_players() — Decisión #3 de 04_Revision_ChatGPT.md: además de
--      las creadas por el caller (ya cubierto por list_my_provisional_players de Bloque 4),
--      también las que aparecieron junto al caller en algún match_participants ya existente.
--      Nunca fusiona por nombre, nunca hace la provisional buscable globalmente.
--
-- Todas SECURITY DEFINER, grant execute únicamente a `authenticated` (nunca `anon` — a
-- diferencia de is_username_available en Bloque 3, nada de Bloque 5 tiene sentido sin sesión).

-- ------------------------------------------------------------------
-- 1) compute_pending_action_count — helper interno
-- ------------------------------------------------------------------

/** Cuenta, para p_player_id, los partidos donde: sigue pending_validation, todavía no venció
 *  su deadline (expiración lógica — un partido vencido deja de ser "accionable"), y el equipo
 *  de p_player_id en ESE partido coincide con matches.action_side (Experiencia_Inicial.md §8.1:
 *  "pendiente accionable = la acción está del lado de la pareja del usuario"). No cuenta
 *  partidos donde el lado de p_player_id ya declaró y espera al rival (action_side es del OTRO
 *  equipo), ni partidos validated/expired/annulled. */
create or replace function public.compute_pending_action_count(p_player_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.matches m
  join public.match_participants mp on mp.match_id = m.match_id and mp.player_id = p_player_id
  where m.status = 'pending_validation'
    and m.validation_deadline_at > now()
    and m.action_side = mp.team;
$$;

comment on function public.compute_pending_action_count is
  'Helper interno de Bloque 5. Nunca se otorga EXECUTE a authenticated/anon: solo lo llaman
   get_pending_action_count y create_or_attach_match.';

revoke all on function public.compute_pending_action_count(uuid) from public;

-- ------------------------------------------------------------------
-- 2) get_pending_action_count
-- ------------------------------------------------------------------

create or replace function public.get_pending_action_count()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_player_id uuid;
  v_count integer;
begin
  select player_id into v_caller_player_id from public.players where auth_user_id = auth.uid();
  if v_caller_player_id is null then
    raise exception 'no_player_for_session' using errcode = 'P0001';
  end if;

  v_count := public.compute_pending_action_count(v_caller_player_id);
  return jsonb_build_object('count', v_count, 'limit', 5, 'blocked', v_count >= 5);
end;
$$;

comment on function public.get_pending_action_count is
  'Contador personal de pendientes accionables del caller + límite (5, Experiencia_Inicial.md
   §10). El mismo límite se re-verifica dentro de create_or_attach_match antes de intentar
   cualquier carga nueva — este RPC es solo para que la UI muestre el estado sin intentar cargar.';

revoke all on function public.get_pending_action_count() from public;
grant execute on function public.get_pending_action_count() to authenticated;

-- ------------------------------------------------------------------
-- 3) get_my_matches
-- ------------------------------------------------------------------

create or replace function public.get_my_matches(p_limit integer default 50, p_include_hidden boolean default false)
returns table (
  match_id uuid,
  status text,
  played_at timestamptz,
  format_id text,
  scoring_system text,
  my_team text,
  action_side text,
  is_action_mine boolean,
  ready_for_validation boolean,
  created_by_player_id uuid,
  validated_at timestamptz,
  validation_deadline_at timestamptz,
  hidden boolean,
  participants jsonb,
  sets jsonb
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
    select
      m.match_id,
      -- Expiración lógica: nunca se escribe, solo se presenta así en lectura (Decisión #4).
      case when m.status = 'pending_validation' and m.validation_deadline_at <= now()
           then 'expired' else m.status end as status,
      m.played_at, m.format_id, m.scoring_system,
      mp_self.team as my_team,
      m.action_side,
      (m.status = 'pending_validation' and m.validation_deadline_at > now() and m.action_side = mp_self.team) as is_action_mine,
      -- Conformidad rival ya registrada (create_or_attach_match libera action_side) pero
      -- TODAVÍA pending_validation — Bloque 5 nunca oficializa; es Bloque 6 quien consume este
      -- flag para decidir cuándo correr la transacción atómica de validación
      -- (06_Revision_Pre_Staging_ChatGPT.md §1).
      (m.status = 'pending_validation' and m.validation_deadline_at > now() and m.action_side is null) as ready_for_validation,
      m.created_by_player_id, m.validated_at, m.validation_deadline_at,
      coalesce(mus.hidden, false) as hidden,
      (
        select jsonb_agg(jsonb_build_object(
          'team', mp.team, 'position', mp.position_in_team, 'playerId', mp.player_id,
          'displayName', mp.display_name_snapshot
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
    where (p_include_hidden or coalesce(mus.hidden, false) = false)
    order by m.played_at desc
    limit v_limit;
end;
$$;

comment on function public.get_my_matches is
  'Feed de partidos del caller. status="expired" es una PRESENTACIÓN calculada en lectura
   (pending_validation + deadline vencido), nunca una escritura física — ver Decisión #4 de
   04_Revision_ChatGPT.md. ready_for_validation=true significa "conformidad rival ya
   registrada, pending_validation todavía" — Bloque 5 nunca pone status=validated
   (06_Revision_Pre_Staging_ChatGPT.md §1). No incluye winnerTeam: se deriva client-side desde
   sets+formatId con el mismo Engine compartido que ya usa la carga local, para no duplicar la
   regla de victoria en una tercera capa (02_Analisis_Claude.md §2).';

revoke all on function public.get_my_matches(integer, boolean) from public;
grant execute on function public.get_my_matches(integer, boolean) to authenticated;

-- ------------------------------------------------------------------
-- 4) get_match_detail
-- ------------------------------------------------------------------

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
  select player_id into v_caller_player_id from public.players where auth_user_id = auth.uid();
  if v_caller_player_id is null then
    raise exception 'no_player_for_session' using errcode = 'P0001';
  end if;

  select * into v_match from public.matches where match_id = p_match_id;
  if v_match is null then
    return null;
  end if;

  select * into v_my_row from public.match_participants where match_id = p_match_id and player_id = v_caller_player_id;
  if v_my_row is null then
    -- Nunca confirma ni niega la existencia del partido a quien no participa (mismo criterio
    -- que get_public_profile de Bloque 4 con una provisional inexistente).
    return null;
  end if;

  select jsonb_build_object(
    'matchId', v_match.match_id,
    'status', case when v_match.status = 'pending_validation' and v_match.validation_deadline_at <= now()
                   then 'expired' else v_match.status end,
    'playedAt', v_match.played_at,
    'formatId', v_match.format_id,
    'scoringSystem', v_match.scoring_system,
    'locationName', v_match.location_name,
    'locationLat', v_match.location_lat,
    'locationLng', v_match.location_lng,
    'myTeam', v_my_row.team,
    'actionSide', v_match.action_side,
    'isActionMine', (v_match.status = 'pending_validation' and v_match.validation_deadline_at > now() and v_match.action_side = v_my_row.team),
    'readyForValidation', (v_match.status = 'pending_validation' and v_match.validation_deadline_at > now() and v_match.action_side is null),
    'createdByPlayerId', v_match.created_by_player_id,
    'validatedAt', v_match.validated_at,
    'validationDeadlineAt', v_match.validation_deadline_at,
    'currentRevisionNumber', (select revision_number from public.match_revisions where revision_id = v_match.current_revision_id),
    'participants', (
      select jsonb_agg(jsonb_build_object(
        'team', mp.team, 'position', mp.position_in_team, 'playerId', mp.player_id,
        'displayName', mp.display_name_snapshot
      ) order by mp.team, mp.position_in_team)
      from public.match_participants mp where mp.match_id = v_match.match_id
    ),
    'sets', (
      select jsonb_agg(jsonb_build_object(
        'setNumber', ms.set_number, 'gamesA', ms.games_a, 'gamesB', ms.games_b,
        'tiebreakA', ms.tiebreak_a, 'tiebreakB', ms.tiebreak_b
      ) order by ms.set_number)
      from public.match_sets ms
      where ms.match_id = v_match.match_id
        and ms.revision_number = (select revision_number from public.match_revisions where revision_id = v_match.current_revision_id)
    ),
    'revisionCount', (select count(*) from public.match_revisions where match_id = v_match.match_id),
    'actions', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'actionType', ma.action_type, 'actorPlayerId', ma.actor_player_id,
        'actingSide', ma.acting_side, 'occurredAt', ma.occurred_at
      ) order by ma.occurred_at), '[]'::jsonb)
      from public.match_actions ma where ma.match_id = v_match.match_id
    ),
    'hidden', coalesce((select hidden from public.match_user_state where match_id = v_match.match_id and player_id = v_caller_player_id), false),
    'privateNote', (select private_note from public.match_user_state where match_id = v_match.match_id and player_id = v_caller_player_id)
  ) into v_result;

  return v_result;
end;
$$;

comment on function public.get_match_detail is
  'Detalle completo de un partido, incluida la sección de Modificaciones (match_actions). NULL
   si el caller no es participante — nunca confirma ni niega que el match_id exista.';

revoke all on function public.get_match_detail(uuid) from public;
grant execute on function public.get_match_detail(uuid) to authenticated;

-- ------------------------------------------------------------------
-- 5) hide_match_for_me / set_match_private_note
-- ------------------------------------------------------------------

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

comment on function public.hide_match_for_me is
  'Única vía de escritura de match_user_state.hidden. Ocultar NUNCA borra matches/
   match_participants ni sus efectos oficiales — el partido sigue intacto para los otros
   participantes (Backend_Infraestructura.md §8.8).';

revoke all on function public.hide_match_for_me(uuid, boolean) from public;
grant execute on function public.hide_match_for_me(uuid, boolean) to authenticated;

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

comment on function public.set_match_private_note is
  'Única vía de escritura de match_user_state.private_note — dato privado, nunca compartido con
   los demás participantes (Backend_Infraestructura.md §5.1).';

revoke all on function public.set_match_private_note(uuid, text) from public;
grant execute on function public.set_match_private_note(uuid, text) to authenticated;

-- ------------------------------------------------------------------
-- 6) list_related_provisional_players — Decisión #3 de 04_Revision_ChatGPT.md
-- ------------------------------------------------------------------

/** Además de list_my_provisional_players (Bloque 4, solo creador), también las provisionales
 *  que ya compartieron un match_participants con el caller — completa la promesa de identidad
 *  persistente/reutilizable de Backend_Infraestructura.md §9.1 más allá de quien la creó.
 *  NUNCA globalmente buscable (no reemplaza search_players) y NUNCA fusiona por nombre — la
 *  relación es siempre por player_id vía un partido ya existente. */
create or replace function public.list_related_provisional_players()
returns table (
  player_id uuid,
  display_name text,
  created_at timestamptz,
  relation text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_player_id uuid;
begin
  select p.player_id into v_caller_player_id from public.players p where p.auth_user_id = auth.uid();
  if v_caller_player_id is null then
    raise exception 'no_player_for_session' using errcode = 'P0001';
  end if;

  return query
    select
      pl.player_id, pl.display_name, pl.created_at,
      case when pl.created_by_player_id = v_caller_player_id then 'created_by_me' else 'played_with' end as relation
    from public.players pl
    where pl.type = 'provisional'
      and pl.is_active
      and (
        pl.created_by_player_id = v_caller_player_id
        or exists (
          select 1
          from public.match_participants mp_prov
          join public.match_participants mp_self
            on mp_self.match_id = mp_prov.match_id and mp_self.player_id = v_caller_player_id
          where mp_prov.player_id = pl.player_id
        )
      )
    order by pl.created_at desc;
end;
$$;

comment on function public.list_related_provisional_players is
  'Provisionales creadas por el caller o que ya compartieron un partido con él. Nunca las
   expone globalmente (no reemplaza search_players) ni fusiona por nombre — relación siempre
   por player_id vía match_participants o created_by_player_id.';

revoke all on function public.list_related_provisional_players() from public;
grant execute on function public.list_related_provisional_players() to authenticated;
