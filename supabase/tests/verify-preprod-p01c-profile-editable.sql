-- BRAMUlab — Pre-Production P0.1C (Perfil editable server-backed) — verificación transaccional
-- segura de 20260924130000_preprod_p01c_profile_editable.sql. Requiere Bloques 1-8 + esa
-- migración aplicados, y al menos UNA cuenta real registrada con sesión (auth_user_id no nulo,
-- perfil con username) ya existente en el entorno — mismo criterio exacto que
-- verify-bloque7-fase1.sql (que ya corrió con éxito contra Staging real en una ronda anterior).
-- No fabrica un usuario de auth.users: complete_contact_profile_data/update_profile_avatar/
-- get_public_profile dependen de auth.uid(), y fabricar esa fila a mano en el schema interno de
-- Supabase Auth es más riesgo del que justifica esta verificación (ver el informe P0.1C para el
-- razonamiento). No deja fixtures ni cambios permanentes: toda mutación ocurre entre BEGIN/
-- ROLLBACK, incluidos los cambios sobre la cuenta real elegida (phone/allow_whatsapp_contact/
-- avatar_url vuelven exactamente a como estaban al hacer ROLLBACK).

begin;

create temporary table _p01c_verify_target on commit drop as
select pl.player_id, pl.auth_user_id, pr.phone as original_phone,
       pr.allow_whatsapp_contact as original_allow_whatsapp, pr.avatar_url as original_avatar_url
from public.players pl
join public.profiles pr using (player_id)
where pl.auth_user_id is not null
  and pr.username is not null
order by pr.created_at
limit 1;

do $$
begin
  if (select count(*) from _p01c_verify_target) <> 1 then
    raise exception 'verify_p01c_requires_one_registered_account_with_session';
  end if;
end $$;

select set_config(
  'request.jwt.claim.sub',
  (select auth_user_id::text from _p01c_verify_target limit 1),
  true
);

-- ------------------------------------------------------------------
-- 1) complete_contact_profile_data
-- ------------------------------------------------------------------

do $$
declare
  v_player_id uuid := (select player_id from _p01c_verify_target limit 1);
  v_after public.profiles;
  v_rejected boolean;
begin
  -- Teléfono válido (10 dígitos) + consentimiento true.
  perform public.complete_contact_profile_data('+54 9 11 2345 6789', true);
  select * into v_after from public.profiles where player_id = v_player_id;
  if v_after.phone is distinct from '+54 9 11 2345 6789' or v_after.allow_whatsapp_contact is distinct from true then
    raise exception 'contact_valid_write_wrong: phone=% allow=%', v_after.phone, v_after.allow_whatsapp_contact;
  end if;

  -- Desactivar consentimiento nunca exige teléfono válido (handoff §5 — "revocar consentimiento
  -- siempre debe ser posible"), incluso pasando un teléfono corto/inválido junto con `false`.
  perform public.complete_contact_profile_data('123', false);
  select * into v_after from public.profiles where player_id = v_player_id;
  if v_after.allow_whatsapp_contact is distinct from false then
    raise exception 'contact_disable_should_never_be_blocked';
  end if;

  -- Teléfono inválido (menos de 8 dígitos) + consentimiento true -> rechazado, fila sin tocar.
  v_rejected := false;
  begin
    perform public.complete_contact_profile_data('123', true);
  exception when others then
    if sqlerrm = 'whatsapp_phone_invalid' then v_rejected := true; else raise; end if;
  end;
  if not v_rejected then raise exception 'invalid_phone_with_consent_not_rejected'; end if;
  select * into v_after from public.profiles where player_id = v_player_id;
  if v_after.allow_whatsapp_contact is distinct from false then
    raise exception 'rejected_call_should_not_have_written_anything';
  end if;

  -- Teléfono con más de 15 dígitos + consentimiento true -> también rechazado.
  v_rejected := false;
  begin
    perform public.complete_contact_profile_data('1234567890123456', true);
  exception when others then
    if sqlerrm = 'whatsapp_phone_invalid' then v_rejected := true; else raise; end if;
  end;
  if not v_rejected then raise exception 'too_long_phone_with_consent_not_rejected'; end if;
end $$;

-- ------------------------------------------------------------------
-- 2) update_profile_avatar
-- ------------------------------------------------------------------

do $$
declare
  v_player_id uuid := (select player_id from _p01c_verify_target limit 1);
  v_other_player_id uuid;
  v_after public.profiles;
  v_own_url text;
  v_foreign_url text;
  v_rejected boolean;
begin
  v_own_url := 'https://xyzco.supabase.co/storage/v1/object/public/avatars/' || v_player_id::text || '/1727200000000.jpg';
  perform public.update_profile_avatar(v_own_url);
  select * into v_after from public.profiles where player_id = v_player_id;
  if v_after.avatar_url is distinct from v_own_url then
    raise exception 'avatar_own_path_not_persisted';
  end if;

  -- Ruta de otro jugador (o cualquier jugador inexistente): rechazada, fila sin tocar.
  select gen_random_uuid() into v_other_player_id;
  v_foreign_url := 'https://xyzco.supabase.co/storage/v1/object/public/avatars/' || v_other_player_id::text || '/1727200000001.jpg';
  v_rejected := false;
  begin
    perform public.update_profile_avatar(v_foreign_url);
  exception when others then
    if sqlerrm = 'avatar_path_invalid' then v_rejected := true; else raise; end if;
  end;
  if not v_rejected then raise exception 'foreign_avatar_path_not_rejected'; end if;
  select * into v_after from public.profiles where player_id = v_player_id;
  if v_after.avatar_url is distinct from v_own_url then
    raise exception 'rejected_avatar_call_should_not_have_changed_anything';
  end if;

  -- NULL siempre permitido (quitar foto), sin el chequeo de ruta.
  perform public.update_profile_avatar(null);
  select * into v_after from public.profiles where player_id = v_player_id;
  if v_after.avatar_url is distinct from null then
    raise exception 'avatar_removal_did_not_clear_column';
  end if;
end $$;

-- ------------------------------------------------------------------
-- 3) get_public_profile — avatar_url + whatsapp_phone (filtrado server-side)
-- ------------------------------------------------------------------

do $$
declare
  v_player_id uuid := (select player_id from _p01c_verify_target limit 1);
  v_own_url text := 'https://xyzco.supabase.co/storage/v1/object/public/avatars/' || v_player_id::text || '/1727200000002.jpg';
  v_row record;
begin
  perform public.update_profile_avatar(v_own_url);

  -- allow_whatsapp_contact=false (dejado así por el bloque 1 de arriba) -> whatsapp_phone NULL
  -- aunque profiles.phone siga teniendo el valor cargado antes.
  select * into v_row from public.get_public_profile(v_player_id);
  if v_row.avatar_url is distinct from v_own_url then
    raise exception 'get_public_profile_avatar_url_wrong: %', v_row.avatar_url;
  end if;
  if v_row.whatsapp_phone is not null then
    raise exception 'get_public_profile_leaked_phone_without_consent: %', v_row.whatsapp_phone;
  end if;

  -- Activar consentimiento con un teléfono válido -> ahora SÍ debe aparecer en whatsapp_phone,
  -- con el mismo valor que se cargó (nunca reformateado a otra cosa).
  perform public.complete_contact_profile_data('+54 9 11 9876 5432', true);
  select * into v_row from public.get_public_profile(v_player_id);
  if v_row.whatsapp_phone is distinct from '+54 9 11 9876 5432' then
    raise exception 'get_public_profile_whatsapp_phone_wrong_with_consent: %', v_row.whatsapp_phone;
  end if;

  -- Nunca expone email/fecha de nacimiento/género (privados, Backend_Infraestructura.md §5.1) —
  -- get_public_profile ni siquiera los declara en su RETURNS TABLE, así que un SELECT * sobre
  -- el record no puede tener esas columnas en absoluto; se confirma indirectamente comprobando
  -- que la fila solo tiene las 18 columnas esperadas.
  if (select count(*) from json_each(row_to_json(v_row))) <> 18 then
    raise exception 'get_public_profile_unexpected_column_count: %', (select count(*) from json_each(row_to_json(v_row)));
  end if;
end $$;

-- ------------------------------------------------------------------
-- 4) Seguridad / permisos / firmas.
-- ------------------------------------------------------------------

do $$
begin
  if has_function_privilege('public', 'public.complete_contact_profile_data(text,boolean)', 'EXECUTE')
     or has_function_privilege('anon', 'public.complete_contact_profile_data(text,boolean)', 'EXECUTE') then
    raise exception 'complete_contact_profile_data_execute_too_broad';
  end if;
  if not has_function_privilege('authenticated', 'public.complete_contact_profile_data(text,boolean)', 'EXECUTE') then
    raise exception 'complete_contact_profile_data_authenticated_execute_missing';
  end if;

  if has_function_privilege('public', 'public.update_profile_avatar(text)', 'EXECUTE')
     or has_function_privilege('anon', 'public.update_profile_avatar(text)', 'EXECUTE') then
    raise exception 'update_profile_avatar_execute_too_broad';
  end if;
  if not has_function_privilege('authenticated', 'public.update_profile_avatar(text)', 'EXECUTE') then
    raise exception 'update_profile_avatar_authenticated_execute_missing';
  end if;

  if has_function_privilege('public', 'public.get_public_profile(uuid)', 'EXECUTE')
     or has_function_privilege('anon', 'public.get_public_profile(uuid)', 'EXECUTE') then
    raise exception 'get_public_profile_execute_too_broad';
  end if;
  if not has_function_privilege('authenticated', 'public.get_public_profile(uuid)', 'EXECUTE') then
    raise exception 'get_public_profile_authenticated_execute_missing';
  end if;

  -- Storage: bucket avatars existe, público de lectura, con límite de tamaño/MIME.
  if not exists (
    select 1 from storage.buckets
    where id = 'avatars' and public = true and file_size_limit = 2097152
  ) then
    raise exception 'avatars_bucket_missing_or_misconfigured';
  end if;

  -- RLS de storage.objects: las 4 políticas de "avatars" existen y están scoped a esa bucket.
  if (
    select count(*) from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname like 'avatars_%'
  ) <> 4 then
    raise exception 'avatars_storage_policies_missing_or_unexpected_count';
  end if;
end $$;

rollback;

select 'PRE-PRODUCTION P0.1C (Perfil editable server-backed) OK — rollback limpio' as result;
