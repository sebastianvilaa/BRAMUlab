-- BRAMUlab V04.37 — get_my_level_evolution(): lectura oficial, self-only y acotada de la EVOLUCIÓN del Nivel del propio jugador
-- (Nivel_BRAMU.md §16 / BRAMU_Intelligence.md §18). Alimenta la tarjeta "Evolución del Nivel BRAMU" de Mi Perfil.
--
-- Fuente canónica = el estado VIGENTE, no la bitácora:
--   * `level_events` es auditoría inmutable (incluye reversiones y los snapshots de cada operación): NO se grafica directamente,
--     porque una corrección/anulación dejaría puntos de resultados ya revertidos o duplicados.
--   * Se usan los `match_level_results` con `effect_status='applied'` y `eligible` (como máximo uno por partido, ver índice único
--     parcial) y la fila del propio jugador en `match_level_result_players`. Una corrección deja UN resultado vigente por partido
--     (el anterior queda `reverted`), y una anulación/identidad revierte el resultado: ninguno de los dos aporta punto.
--   * El efecto de cada partido es `mu_after − original_live_mu_before`: exactamente lo que `officialize_match_validation` suma y
--     `_bloque6_revert_applied_result` resta sobre `level_states.mu` (C-01). Como los efectos son aditivos, la trayectoria se
--     reconstruye ANCLADA AL NIVEL ACTUAL: valor_k = mu_actual − Σ efectos vigentes + Σ_{i≤k} efecto_i (orden deportivo:
--     played_at, luego computed_at). Así el ÚLTIMO punto coincide SIEMPRE con el Nivel público actual (round(mu,1)) y el punto
--     inicial es el valor base vigente (el de la estimación inicial salvo recuperaciones/ajustes posteriores).
--   * Contrato mínimo para UI: SOLO valores públicos (un decimal), fecha y match_id propio. Nada de k, factores, confianza,
--     expectativa, deltas crudos ni mu de 4 decimales.
--
-- Evidencia insuficiente (sin Nivel oficial o sin ningún resultado vigente con efecto): `available=false` y la UI oculta el módulo.

create or replace function public.get_my_level_evolution()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_caller uuid;
  v_ls public.level_states;
  v_initial_at timestamptz;
  v_n bigint;
  v_total numeric;
  v_first_played timestamptz;
  v_series jsonb;
  v_points jsonb;
begin
  select pl.player_id into v_caller from public.players pl where pl.auth_user_id = auth.uid() and pl.is_active;
  if v_caller is null then
    raise exception 'no_player_for_session' using errcode = 'P0001';
  end if;

  select * into v_ls from public.level_states where player_id = v_caller;
  if v_ls.player_id is null or v_ls.mu is null or v_ls.status = 'PENDIENTE' then
    return jsonb_build_object('ok', true, 'available', false, 'reason', 'no_level');
  end if;

  select min(le.created_at) into v_initial_at
    from public.level_events le where le.player_id = v_caller and le.event_type = 'initial_estimate';

  -- Un solo SELECT (la función es STABLE: sin tablas temporales ni escrituras).
  with eff as (
    select m.match_id, m.played_at, r.computed_at, (rp.mu_after - rp.original_live_mu_before) as effect
    from public.match_level_result_players rp
    join public.match_level_results r on r.result_id = rp.result_id and r.effect_status = 'applied' and r.eligible
    join public.matches m on m.match_id = r.match_id and m.status = 'validated'
    where rp.player_id = v_caller
  ), ord as (
    select e.match_id, e.played_at, e.effect,
           row_number() over w as rn,
           sum(e.effect) over (w rows between unbounded preceding and current row) as cum
    from eff e
    window w as (order by e.played_at, e.computed_at, e.match_id)
  ), agg as (
    select count(*) as n, coalesce(sum(effect), 0) as total, min(played_at) as first_played from ord
  )
  select agg.n, agg.total, agg.first_played,
         (select jsonb_agg(jsonb_build_object(
            'at', o.played_at,
            'level', round(greatest(1.0, least(10.0, v_ls.mu - agg.total + o.cum)), 1),
            'matchId', o.match_id
          ) order by o.rn) from ord o)
    into v_n, v_total, v_first_played, v_series
  from agg;

  if coalesce(v_n, 0) = 0 then
    return jsonb_build_object('ok', true, 'available', false, 'reason', 'no_results');
  end if;

  -- Punto inicial: valor base vigente, fechado en la estimación inicial (o el primer partido si éste fue jugado antes).
  v_points := jsonb_build_array(jsonb_build_object(
    'at', least(coalesce(v_initial_at, v_ls.created_at), v_first_played),
    'level', round(greatest(1.0, least(10.0, v_ls.mu - v_total)), 1),
    'matchId', null::uuid
  )) || v_series;

  return jsonb_build_object(
    'ok', true, 'available', true,
    'currentLevel', round(v_ls.mu, 1),
    'points', v_points
  );
end;
$$;
comment on function public.get_my_level_evolution() is
  'V04.37 — evolución OFICIAL del Nivel del propio jugador (self-only). Serie anclada al Nivel actual a partir de los resultados
   vigentes (applied+eligible), sin puntos de resultados revertidos/anulados. Solo valores públicos (1 decimal); sin internals del motor.';
revoke all on function public.get_my_level_evolution() from public, anon;
grant execute on function public.get_my_level_evolution() to authenticated;
