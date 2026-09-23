-- BRAMUlab — Bloque 8 (Fase A): datos y derivados para BRAMU Intelligence V1.
--
-- Ver docs/BRAMUlab/BRAMU_Intelligence.md, docs/BRAMUlab/BRAMU_Intelligence_Implementacion.md
-- §10 (Bloque A — "identidad estable, partido, fecha real, formato/score, historia personal vs
-- oficial, rachas/forma/relaciones") y el handoff
-- docs/BRAMUlab/Implementacion/Backend/Bloque_08/01_Handoff_Inicio_Bloque_08.md §5.
--
-- Esta migración agrega UNA sola RPC de lectura:
--
--   get_player_intelligence_history(p_limit, p_before_played_at, p_include_hidden) — historia
--   personal del caller ordenada por FECHA REAL jugada (nunca por orden de carga), en la MISMA
--   forma jsonb (camelCase) que ya usa get_my_matches — para que
--   PLMatchSync.translateServerMatchToLocalShape (Bloque 5) la traduzca sin ningún adaptador
--   nuevo — más dos campos nuevos exclusivos de Intelligence:
--
--     - hasOpenIdentityIssue: mismo criterio que get_my_matches/get_match_detail (Bloque 6).
--     - officialEligible: mismo predicado exacto que usa
--       get_player_match_history_for_level_engine (Bloque 6) para "computable" — pero SIN la
--       ventana de 180 días de esa RPC, porque acá la necesidad es la contraria: hitos y
--       récords personales (BRAMU_Intelligence.md §5.2/§8) necesitan poder mirar TODO el
--       historial, no solo la ventana de repetición de Nivel.
--
-- No agrega ninguna tabla nueva ni recalcula Nivel/Ranking: es una proyección de lectura sobre
-- `matches`/`match_participants`/`match_sets`/`match_user_state`/`match_identity_issues`
-- (Bloque 5/6) y `match_level_results` (Bloque 6), todas ya RLS deny-by-default — esta función
-- SECURITY DEFINER es, igual que sus pares de Bloque 5/6, la única vía de lectura para
-- `authenticated`.
--
-- Alcance de "historia personal" (BRAMU_Intelligence.md §5.8 último párrafo: "un partido válido
-- y no duplicado puede formar parte de la historia personal aunque esté pendiente, disputado,
-- sea casual... o se haya validado fuera de término"): se incluye cualquier estado salvo
-- `annulled` (partido administrativamente anulado — nunca ocurrió a efectos de producto) y,
-- salvo que el caller pida lo contrario, salvo los partidos que el propio jugador ocultó de su
-- Historial (mismo criterio de default que get_my_matches/p_include_hidden).
--
-- DECISIÓN ABIERTA (documentada también en el informe de cierre de esta ronda): si un partido
-- oculto por el usuario debería poder producir un insight de BRAMU Intelligence más adelante.
-- Se deja como parámetro explícito (p_include_hidden, default false) en vez de una exclusión
-- fija, para no bloquear ninguna decisión de producto futura con una migración nueva.

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
    where m.status <> 'annulled'
      and (p_include_hidden or coalesce(mus.hidden, false) = false)
      and (p_before_played_at is null or m.played_at < p_before_played_at)
    order by m.played_at desc, m.created_at desc, m.match_id
    limit v_limit;
end;
$$;

comment on function public.get_player_intelligence_history is
  'Historia personal del caller ordenada por FECHA REAL jugada (nunca orden de carga), para
   BRAMU Intelligence Bloque 8 Fase A. Misma forma camelCase que get_my_matches
   (PLMatchSync.translateServerMatchToLocalShape la traduce sin cambios) + hasOpenIdentityIssue
   + officialEligible. Excluye siempre matches.status=annulled; excluye ocultos salvo
   p_include_hidden=true (mismo default que get_my_matches). p_before_played_at pagina hacia
   atrás en el tiempo para historiales largos (récords/hitos, BRAMU_Intelligence.md §5.2/§8) —
   a diferencia de get_player_match_history_for_level_engine, esta función NO limita a 180 días.
   No calcula rachas/forma/balances: eso vive en bramulab/intelligence-context.js, sobre el
   array ya traducido, mismo criterio de capas que level-context.js sobre level.js.';

revoke all on function public.get_player_intelligence_history(integer, timestamptz, boolean) from public;
grant execute on function public.get_player_intelligence_history(integer, timestamptz, boolean) to authenticated;
