-- BRAMUlab — Bloque 9B gate Central: hardening final de redacción del informe de acceso/copia.
--
-- 20261001080000 corrigió referencias de terceros expuestas como claves *PlayerId/UserId, pero el gate vivo de Central
-- encontró otra vía real: BRAMU Intelligence guarda player_id dentro de strings internos `semanticKey`
-- (p.ej. rival_relacion:<uuid>). Un export real seguía conteniendo ids de terceros aunque actorPlayerId ya se redactara.
--
-- Forward-fix (080000 ya fue aplicada en Staging; NO editarla):
-- 1) semanticKey se considera metadata interna y se elimina del informe.
-- 2) cualquier UUID embebido dentro de un string se reemplaza SOLO si corresponde a player_id/auth_user_id de otra
--    cuenta BRAMU; los UUID legítimos de partido/evidencia se conservan.
-- 3) el generador RAW y el helper dejan de ser invocables directamente por service_role: el único camino operativo
--    concedido es admin_export_player_data(uuid), que aplica la redacción.

create or replace function public._export_redact_third_parties(p jsonb, p_own uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  k text;
  v jsonb;
  res jsonb;
  s text;
  m text[];
  candidate uuid;
begin
  if p is null then
    return null;
  end if;

  if jsonb_typeof(p) = 'object' then
    res := '{}'::jsonb;
    for k, v in select key, value from jsonb_each(p) loop
      if k ~* '^semantic_?key$' then
        continue;
      end if;

      if k ~* '(player_?ids?|user_?id|auth_?user_?id)$'
         and not (jsonb_typeof(v) = 'string' and (v #>> '{}') = p_own::text) then
        continue;
      end if;

      res := res || jsonb_build_object(k, public._export_redact_third_parties(v, p_own));
    end loop;
    return res;

  elsif jsonb_typeof(p) = 'array' then
    return coalesce(
      (select jsonb_agg(public._export_redact_third_parties(e, p_own))
         from jsonb_array_elements(p) e),
      '[]'::jsonb
    );

  elsif jsonb_typeof(p) = 'string' then
    s := p #>> '{}';
    for m in
      select regexp_matches(
        s,
        '([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})',
        'g'
      )
    loop
      begin
        candidate := m[1]::uuid;
        if candidate <> p_own
           and exists (
             select 1
               from public.players pl
              where pl.player_id = candidate
                 or pl.auth_user_id = candidate
           ) then
          s := replace(s, m[1], '[redacted-player]');
        end if;
      exception when invalid_text_representation then
        null;
      end;
    end loop;
    return to_jsonb(s);
  end if;

  return p;
end;
$$;

comment on function public._export_redact_third_parties is
  'Bloque 9B/Central: redacción recursiva del informe de acceso. Elimina referencias directas y UUIDs embebidos de identidades BRAMU ajenas; semanticKey es metadata interna y no se exporta. Solo uso interno del wrapper seguro.';

revoke all on function public._admin_export_player_data_raw(uuid) from public, anon, authenticated, service_role;
revoke all on function public._export_redact_third_parties(jsonb, uuid) from public, anon, authenticated, service_role;
revoke all on function public.admin_export_player_data(uuid) from public, anon, authenticated;
grant execute on function public.admin_export_player_data(uuid) to service_role;
