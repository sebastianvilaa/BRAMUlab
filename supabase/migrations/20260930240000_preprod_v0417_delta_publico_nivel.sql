-- BRAMUlab — V04.17 (Issue #11 §1): delta PÚBLICO de Nivel para el chip ↑/↓ del Home.
--
-- V04.16 devolvía el último `delta_capped` interno; el cliente lo redondeaba a 1 decimal y un
-- microdelta (p. ej. 5.8928 -> 5.86 = -0.0328, público 5.9 -> 5.9) quedaba como ±0.0 y el chip
-- desaparecía. Nivel_BRAMU: presentación habitual = 1 decimal, cálculo interno hasta 4, nunca +0,0 / -0,0.
--
-- Nueva semántica de get_my_last_level_delta(): el ÚLTIMO cambio REAL que modificó el Nivel PÚBLICO
-- visible a 1 decimal, es decir el resultado vigente (effect_status='applied', eligible) más reciente
-- con round(formula_mu_before, 1) <> round(mu_after, 1). `delta` = round(mu_after,1) - round(mu_before,1)
-- (siempre múltiplo de 0.1, nunca 0). Si nunca hubo un cambio público real -> delta null (el cliente
-- oculta el chip; nunca se fabrica). No toca la fórmula ni las tablas: solo la lectura. Mismo
-- permiso/firma que la versión anterior (CREATE OR REPLACE).
--
-- NO aplicada desde el sandbox del agente (sin Supabase CLI ni credenciales) — la aplica y verifica
-- Central en Staging con supabase/tests/verify-preprod-v0417-delta-publico.sql (BEGIN/ROLLBACK).

create or replace function public.get_my_last_level_delta()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_caller uuid;
  v_row record;
begin
  select pl.player_id into v_caller from public.players pl where pl.auth_user_id = auth.uid() and pl.is_active;
  if v_caller is null then
    raise exception 'no_player_for_session' using errcode = 'P0001';
  end if;

  select rp.formula_mu_before, rp.mu_after, rp.delta_capped, r.match_id, m.played_at,
         round(rp.formula_mu_before, 1) as public_before,
         round(rp.mu_after, 1) as public_after
    into v_row
  from public.match_level_result_players rp
  join public.match_level_results r on r.result_id = rp.result_id
  join public.matches m on m.match_id = r.match_id
  where rp.player_id = v_caller
    and r.effect_status = 'applied'
    and r.eligible
    and round(rp.formula_mu_before, 1) <> round(rp.mu_after, 1)
  order by m.played_at desc, r.computed_at desc
  limit 1;

  if not found then
    return jsonb_build_object('ok', true, 'delta', null);
  end if;
  return jsonb_build_object(
    'ok', true,
    'delta', v_row.public_after - v_row.public_before,
    'publicBefore', v_row.public_before,
    'publicAfter', v_row.public_after,
    'muBefore', v_row.formula_mu_before,
    'muAfter', v_row.mu_after,
    'matchId', v_row.match_id,
    'playedAt', v_row.played_at
  );
end;
$$;

revoke all on function public.get_my_last_level_delta() from public;
revoke all on function public.get_my_last_level_delta() from anon;
grant execute on function public.get_my_last_level_delta() to authenticated;
