-- BRAMUlab — Bloque 7 / Fase 1 — verificación transaccional segura.
-- Requiere que las migraciones 20260922100000..130000 ya estén aplicadas.
-- No deja fixtures: toda mutación ocurre entre BEGIN/ROLLBACK.

begin;

create temporary table _b7_verify_target on commit drop as
select pl.player_id, pl.auth_user_id
from public.players pl
join public.profiles pr using (player_id)
where pl.auth_user_id is not null
  and pr.username is not null
  and pr.location_id is null
order by pr.created_at
limit 1;

do $$
begin
  if (select count(*) from _b7_verify_target) <> 1 then
    raise exception 'verify_b7_requires_one_registered_profile_without_location';
  end if;
end $$;

select set_config(
  'request.jwt.claim.sub',
  (select auth_user_id::text from _b7_verify_target limit 1),
  true
);

do $$
declare
  v_player_id uuid := (select player_id from _b7_verify_target limit 1);
  v_before public.profiles;
  v_after public.profiles;
  v_loc_a uuid;
  v_cooldown_blocked boolean := false;
  v_rejected boolean;
  v_ed uuid;
begin
  -- Seguridad / permisos.
  if has_function_privilege(
       'public',
       'public.complete_ranking_profile_data(text,boolean,text,text,text,text,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.complete_ranking_profile_data(text,boolean,text,text,text,text,text)',
       'EXECUTE'
     ) then
    raise exception 'ranking_profile_execute_too_broad';
  end if;

  if not has_function_privilege(
       'authenticated',
       'public.complete_ranking_profile_data(text,boolean,text,text,text,text,text)',
       'EXECUTE'
     ) then
    raise exception 'ranking_profile_authenticated_execute_missing';
  end if;

  if has_table_privilege('service_role','public.ranking_editions','UPDATE')
     or has_table_privilege('service_role','public.ranking_editions','DELETE')
     or has_table_privilege('service_role','public.ranking_rows','UPDATE')
     or has_table_privilege('service_role','public.ranking_rows','DELETE')
     or has_table_privilege('service_role','public.location_change_events','UPDATE')
     or has_table_privilege('service_role','public.location_change_events','DELETE') then
    raise exception 'append_only_privileges_wrong';
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname='public'
      and tablename in ('ranking_editions','ranking_rows','location_change_events')
  ) then
    raise exception 'unexpected_client_rls_policy';
  end if;

  if position(
       'FOR UPDATE'
       in upper(pg_get_functiondef(
         'public.complete_ranking_profile_data(text,boolean,text,text,text,text,text)'::regprocedure
       ))
     ) = 0 then
    raise exception 'ranking_profile_for_update_missing';
  end if;

  select * into v_before from public.profiles where player_id=v_player_id;

  -- Alta inicial de datos de Ranking con ubicación canónica de prueba.
  select (public.complete_ranking_profile_data(
    'M', true, 'AR', 'Buenos Aires', 'Bella Vista',
    'verify-b7-prov-a', 'verify-b7-loc-a'
  )).location_id into v_loc_a;

  select * into v_after from public.profiles where player_id=v_player_id;
  if v_loc_a is null
     or v_after.location_id <> v_loc_a
     or v_after.competitive_branch <> 'M'
     or v_after.ranking_opt_in is distinct from true then
    raise exception 'ranking_profile_initial_write_wrong';
  end if;

  if (select count(*) from public.location_change_events where player_id=v_player_id) <> 1 then
    raise exception 'ranking_profile_initial_event_count_wrong';
  end if;

  -- La RPC histórica complete_profile no puede volver a ser un bypass.
  perform public.complete_profile(
    v_before.username,
    coalesce(v_before.first_name,'Verify7'),
    v_before.last_name,
    coalesce(v_before.display_name,'Verify7'),
    v_before.birth_date,
    v_before.gender,
    v_before.dominant_hand,
    v_before.preferred_side,
    'F',
    'AR',
    'Santa Fe',
    'Rosario',
    'verify-b7-prov-b',
    'verify-b7-loc-b',
    v_before.terms_version
  );

  select * into v_after from public.profiles where player_id=v_player_id;
  if v_after.location_id <> v_loc_a or v_after.competitive_branch <> 'M' then
    raise exception 'complete_profile_bypass_open';
  end if;

  -- Segundo cambio real dentro de 30 días: bloqueado.
  begin
    perform public.complete_ranking_profile_data(
      'M', true, 'AR', 'Santa Fe', 'Rosario',
      'verify-b7-prov-b', 'verify-b7-loc-b'
    );
  exception when others then
    if sqlerrm = 'location_change_cooldown' then
      v_cooldown_blocked := true;
    else
      raise;
    end if;
  end;

  if not v_cooldown_blocked then
    raise exception 'location_change_cooldown_not_enforced';
  end if;

  -- Reenvío de la MISMA ubicación canónica: idempotente, sin evento extra.
  perform public.complete_ranking_profile_data(
    'M', true, 'AR', 'Buenos Aires', 'Bella Vista',
    'verify-b7-prov-a', 'verify-b7-loc-a'
  );

  if (select count(*) from public.location_change_events where player_id=v_player_id) <> 1 then
    raise exception 'idempotent_location_resend_created_event';
  end if;

  -- Snapshot: fila válida.
  insert into public.ranking_editions(period_start_at,period_end_at)
  values (now() + interval '100 years', now() + interval '100 years 7 days' - interval '1 millisecond')
  returning edition_id into v_ed;

  insert into public.ranking_rows(
    edition_id, player_id, scope_type, scope_key,
    is_eligible, position, tie_group, total_eligible, density_status,
    level_internal, level_public, level_band, level_status,
    eligibility_reason_codes, ranking_rules_version
  ) values (
    v_ed, v_player_id, 'local', 'verify-local',
    true, 1, 1, 5, 'forming',
    5.4321, 5.4, 5, 'CALIBRADO',
    '[]'::jsonb, 'ranking_v1'
  );

  -- Mismo jugador/scope_type con otro scope_key: inválido.
  v_rejected := false;
  begin
    insert into public.ranking_rows(
      edition_id,player_id,scope_type,scope_key,is_eligible,total_eligible,
      density_status,eligibility_reason_codes,ranking_rules_version
    ) values (
      v_ed,v_player_id,'local','verify-other-local',false,5,
      'forming','["location_missing"]'::jsonb,'ranking_v1'
    );
  exception when unique_violation then
    v_rejected := true;
  end;
  if not v_rejected then raise exception 'scope_type_uniqueness_not_enforced'; end if;

  -- Elegible con motivo residual: inválido.
  v_rejected := false;
  begin
    insert into public.ranking_rows(
      edition_id,player_id,scope_type,scope_key,is_eligible,total_eligible,
      density_status,eligibility_reason_codes,ranking_rules_version
    ) values (
      v_ed,v_player_id,'pais','AR',true,1,
      'insufficient','["stale_reason"]'::jsonb,'ranking_v1'
    );
  exception when check_violation then
    v_rejected := true;
  end;
  if not v_rejected then raise exception 'eligible_reason_constraint_not_enforced'; end if;

  -- reason_codes mal formado: debe rechazarse (CHECK o error de tipo al evaluar la constraint).
  v_rejected := false;
  begin
    insert into public.ranking_rows(
      edition_id,player_id,scope_type,scope_key,is_eligible,total_eligible,
      density_status,eligibility_reason_codes,ranking_rules_version
    ) values (
      v_ed,v_player_id,'pais','AR',false,1,
      'insufficient','{}'::jsonb,'ranking_v1'
    );
  exception when others then
    if sqlstate in ('23514','22023') then
      v_rejected := true;
    else
      raise;
    end if;
  end;
  if not v_rejected then raise exception 'reason_codes_shape_not_rejected'; end if;

  -- Empate inconsistente: inválido.
  v_rejected := false;
  begin
    insert into public.ranking_rows(
      edition_id,player_id,scope_type,scope_key,is_eligible,position,tie_group,
      total_eligible,density_status,eligibility_reason_codes,ranking_rules_version
    ) values (
      v_ed,v_player_id,'provincial','AR:verify',true,2,3,
      5,'forming','[]'::jsonb,'ranking_v1'
    );
  exception when check_violation then
    v_rejected := true;
  end;
  if not v_rejected then raise exception 'tie_group_constraint_not_enforced'; end if;

  -- Nivel fuera de escala: inválido.
  v_rejected := false;
  begin
    insert into public.ranking_rows(
      edition_id,player_id,scope_type,scope_key,is_eligible,total_eligible,
      density_status,level_internal,eligibility_reason_codes,ranking_rules_version
    ) values (
      v_ed,v_player_id,'global','GLOBAL',false,1,
      'insufficient',11,'["out_of_scale"]'::jsonb,'ranking_v1'
    );
  exception when check_violation then
    v_rejected := true;
  end;
  if not v_rejected then raise exception 'level_scale_constraint_not_enforced'; end if;
end $$;

rollback;

select 'BLOQUE 7 FASE 1 OK — rollback limpio' as result;
