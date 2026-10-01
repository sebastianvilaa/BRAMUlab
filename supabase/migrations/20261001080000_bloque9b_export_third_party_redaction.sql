-- BRAMUlab — Bloque 9B: redacción de terceros en el informe de acceso/copia.
--
-- Defecto real hallado ensayando admin_export_player_data sobre una base efímera con fixtures: `notifications[].payload`
-- (y cualquier jsonb propio que embeba referencias) conserva claves como `actorPlayerId` con el player_id de OTRA persona.
-- Un id de jugador es un identificador de un tercero: el informe de A no debe contenerlo (Privacidad_Legal.md §2).
--
-- Corrección sin copiar el cuerpo vigente: la función existente pasa a ser el generador interno
-- `_admin_export_player_data_raw` (sin EXECUTE para nadie salvo service_role) y `admin_export_player_data` es un envoltorio
-- que aplica `_export_redact_third_parties` sobre TODO el resultado: elimina, recursivamente, toda clave `…playerId(s)/…userId/
-- …authUserId` cuyo valor no sea el player_id del titular. El resto del contrato (permisos, forma, errores) no cambia.
-- Idempotente: en una base donde ya se aplicó, no vuelve a renombrar.

create or replace function public._export_redact_third_parties(p jsonb, p_own uuid)
returns jsonb
language plpgsql
immutable
set search_path = public
as $$
declare
  k text;
  v jsonb;
  res jsonb;
begin
  if p is null then
    return null;
  end if;
  if jsonb_typeof(p) = 'object' then
    res := '{}'::jsonb;
    for k, v in select key, value from jsonb_each(p) loop
      if k ~* '(player_?ids?|user_?id|auth_?user_?id)$'
         and not (jsonb_typeof(v) = 'string' and (v #>> '{}') = p_own::text) then
        continue;
      end if;
      res := res || jsonb_build_object(k, public._export_redact_third_parties(v, p_own));
    end loop;
    return res;
  elsif jsonb_typeof(p) = 'array' then
    return coalesce((select jsonb_agg(public._export_redact_third_parties(e, p_own)) from jsonb_array_elements(p) e), '[]'::jsonb);
  end if;
  return p;
end;
$$;

do $$
begin
  if to_regprocedure('public._admin_export_player_data_raw(uuid)') is null then
    alter function public.admin_export_player_data(uuid) rename to _admin_export_player_data_raw;
  end if;
end $$;

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
  return public._export_redact_third_parties(v, p_player_id);
end;
$$;

comment on function public.admin_export_player_data is
  'Bloque 9B: informe de acceso/copia (solo lectura, solo service_role). Envoltorio que redacta recursivamente ids de terceros
   sobre el generador interno _admin_export_player_data_raw. Sin secretos, sin internals de Intelligence, sin PII de terceros.';

revoke all on function public._export_redact_third_parties(jsonb, uuid) from public, anon, authenticated;
revoke all on function public._admin_export_player_data_raw(uuid) from public, anon, authenticated;
revoke all on function public.admin_export_player_data(uuid) from public, anon, authenticated;
grant execute on function public.admin_export_player_data(uuid) to service_role;
grant execute on function public._admin_export_player_data_raw(uuid) to service_role;
grant execute on function public._export_redact_third_parties(jsonb, uuid) to service_role;
