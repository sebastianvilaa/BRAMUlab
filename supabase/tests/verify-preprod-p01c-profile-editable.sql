-- BRAMUlab — Pre-Production P0.1C (Perfil editable server-backed) — verificación transaccional
-- segura de 20260924130000_preprod_p01c_profile_editable.sql, revisión 2 (24/09/2026: bucket de
-- avatares privado + separación categoría histórica/actual). Requiere Bloques 1-8 + esa
-- migración aplicados, y al menos UNA cuenta real registrada con sesión (auth_user_id no nulo,
-- perfil con username) ya existente en el entorno — mismo criterio exacto que
-- verify-bloque7-fase1.sql (que ya corrió con éxito contra Staging real en una ronda anterior).
-- Si hay una SEGUNDA cuenta real registrada disponible, la sección 3 además verifica el contrato
-- de visibilidad cruzada de avatar_url vía get_public_profile; si no la hay, esa sub-verificación
-- se saltea con un aviso (RAISE NOTICE), nunca falla el script por eso — mismo espíritu de "no
-- exigir más fixtures de las estrictamente necesarias" que el resto de este proyecto.
--
-- No fabrica ningún usuario de auth.users: complete_contact_profile_data/update_profile_avatar/
-- update_current_category/get_public_profile dependen de auth.uid(), y fabricar esa fila a mano
-- en el schema interno de Supabase Auth es más riesgo del que justifica esta verificación. No
-- deja fixtures ni cambios permanentes: toda mutación ocurre entre BEGIN/ROLLBACK, incluidos los
-- cambios sobre las cuentas reales elegidas (phone/allow_whatsapp_contact/avatar_url/
-- current_category/level_states.status vuelven exactamente a como estaban al hacer ROLLBACK) y
-- la manipulación puntual y controlada de level_states.status en la sección 5 (necesaria para
-- poder ejercitar de verdad la transición PENDIENTE->CALIBRANDO de officialize_level_onboarding
-- sin depender de que la cuenta elegida esté hoy, por casualidad, en ese estado exacto).
--
-- LO QUE ESTE SCRIPT *NO* PUEDE PROBAR (documentado con honestidad, no es una omisión): que un
-- request HTTP anónimo real contra el objeto de Storage devuelva 400/403, y que `createSignedUrl`
-- resuelva de verdad una URL utilizable cross-usuario — ambos son comportamiento de la API REST de
-- Storage, no alcanzable desde una función SQL. Lo que SÍ se verifica acá (sección 6) es el
-- contrato de catálogo que ESTRUCTURALMENTE implica ambas cosas: bucket privado + exactamente las
-- políticas RLS esperadas (select amplia a `authenticated`, sin `anon`/`public` en ningún rol de
-- ninguna política de esta bucket = deny-by-default real para anónimos). La verificación end-to-
-- end final (QA manual contra Staging real) queda documentada en el informe, mismo criterio que
-- siempre en este proyecto para lo que un script SQL no puede ejercitar.

begin;

create temporary table _p01c_verify_target on commit drop as
select pl.player_id, pl.auth_user_id, pr.phone as original_phone,
       pr.allow_whatsapp_contact as original_allow_whatsapp, pr.avatar_url as original_avatar_url,
       pr.current_category as original_current_category, pr.current_category_at as original_current_category_at
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

create temporary table _p01c_verify_target2 on commit drop as
select pl.player_id, pl.auth_user_id
from public.players pl
join public.profiles pr using (player_id)
where pl.auth_user_id is not null
  and pr.username is not null
  and pl.player_id <> (select player_id from _p01c_verify_target limit 1)
order by pr.created_at
limit 1;

select set_config(
  'request.jwt.claim.sub',
  (select auth_user_id::text from _p01c_verify_target limit 1),
  true
);

-- ------------------------------------------------------------------
-- 1) complete_contact_profile_data — SIN CAMBIOS respecto de la versión anterior de este test.
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
-- 2) update_profile_avatar — REESCRITA (revisión 2): valida FORMATO DE RUTA
-- ("{player_id_propio}/<archivo>"), nunca substring de URL. Prueba explícitamente el caso que
-- motivó la corrección: una URL completa de un dominio EXTERNO que contiene el propio player_id
-- como substring ya NO pasa (el chequeo anterior, basado en LIKE, la hubiera aceptado).
-- ------------------------------------------------------------------

do $$
declare
  v_player_id uuid := (select player_id from _p01c_verify_target limit 1);
  v_other_player_id uuid;
  v_after public.profiles;
  v_own_path text;
  v_rejected boolean;
begin
  v_own_path := v_player_id::text || '/1727200000000.jpg';
  perform public.update_profile_avatar(v_own_path);
  select * into v_after from public.profiles where player_id = v_player_id;
  if v_after.avatar_url is distinct from v_own_path then
    raise exception 'avatar_own_path_not_persisted';
  end if;

  -- Ruta de otro jugador (carpeta ajena): rechazada, fila sin tocar.
  select gen_random_uuid() into v_other_player_id;
  v_rejected := false;
  begin
    perform public.update_profile_avatar(v_other_player_id::text || '/1727200000001.jpg');
  exception when others then
    if sqlerrm = 'avatar_path_invalid' then v_rejected := true; else raise; end if;
  end;
  if not v_rejected then raise exception 'foreign_avatar_path_not_rejected'; end if;

  -- EL CASO REAL QUE MOTIVÓ LA CORRECCIÓN: una URL completa de un dominio EXTERNO que contiene el
  -- propio player_id como substring dentro de la ruta. El chequeo anterior (LIKE
  -- '%/avatars/{player_id}/%') la hubiera aceptado; el regex anclado (^{player_id}/archivo$) la
  -- rechaza porque la cadena no EMPIEZA con el player_id propio.
  v_rejected := false;
  begin
    perform public.update_profile_avatar('https://dominio-ajeno.evil/avatars/' || v_player_id::text || '/x.jpg');
  exception when others then
    if sqlerrm = 'avatar_path_invalid' then v_rejected := true; else raise; end if;
  end;
  if not v_rejected then raise exception 'external_domain_avatar_url_not_rejected_regression'; end if;

  -- Path traversal / segmentos anidados dentro de la carpeta propia: también rechazado (el
  -- formato exige EXACTAMENTE un archivo plano, sin barras adicionales).
  v_rejected := false;
  begin
    perform public.update_profile_avatar(v_player_id::text || '/sub/../x.jpg');
  exception when others then
    if sqlerrm = 'avatar_path_invalid' then v_rejected := true; else raise; end if;
  end;
  if not v_rejected then raise exception 'nested_path_avatar_not_rejected'; end if;

  -- Ninguno de los rechazos de arriba debe haber tocado la fila (sigue con la ruta propia válida).
  select * into v_after from public.profiles where player_id = v_player_id;
  if v_after.avatar_url is distinct from v_own_path then
    raise exception 'rejected_avatar_calls_should_not_have_changed_anything';
  end if;

  -- NULL siempre permitido (quitar foto), sin el chequeo de ruta.
  perform public.update_profile_avatar(null);
  select * into v_after from public.profiles where player_id = v_player_id;
  if v_after.avatar_url is distinct from null then
    raise exception 'avatar_removal_did_not_clear_column';
  end if;
end $$;

-- ------------------------------------------------------------------
-- 3) get_public_profile — avatar_url (ahora una RUTA, ver comentario de la migración) +
--    whatsapp_phone (filtrado server-side). Sin cambios de columnas en esta revisión.
-- ------------------------------------------------------------------

do $$
declare
  v_player_id uuid := (select player_id from _p01c_verify_target limit 1);
  v_own_path text := v_player_id::text || '/1727200000002.jpg';
  v_row record;
  v_target2_exists boolean := (select count(*) from _p01c_verify_target2) = 1;
  v_target2_auth_user_id uuid;
begin
  perform public.update_profile_avatar(v_own_path);

  -- allow_whatsapp_contact=false (dejado así por el bloque 1 de arriba) -> whatsapp_phone NULL
  -- aunque profiles.phone siga teniendo el valor cargado antes.
  select * into v_row from public.get_public_profile(v_player_id);
  if v_row.avatar_url is distinct from v_own_path then
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
  -- que la fila solo tiene las 18 columnas esperadas (sin cambios en esta revisión).
  if (select count(*) from json_each(row_to_json(v_row))) <> 18 then
    raise exception 'get_public_profile_unexpected_column_count: %', (select count(*) from json_each(row_to_json(v_row)));
  end if;

  -- Visibilidad cruzada: cualquier usuario AUTENTICADO (no solo el dueño) puede resolver la RUTA
  -- de avatar de OTRO jugador vía get_public_profile — la parte de esto que SQL puede probar
  -- (la resolución de esa ruta a una URL firmada real es un llamado a la API de Storage, ver
  -- cabecera del archivo). Solo corre si hay una segunda cuenta real disponible en el entorno.
  if v_target2_exists then
    select auth_user_id into v_target2_auth_user_id from _p01c_verify_target2 limit 1;
    perform set_config('request.jwt.claim.sub', v_target2_auth_user_id::text, true);
    select * into v_row from public.get_public_profile(v_player_id);
    if v_row.avatar_url is distinct from v_own_path then
      raise exception 'get_public_profile_avatar_not_visible_to_other_authenticated_user: %', v_row.avatar_url;
    end if;
    -- Vuelve a la sesión de la cuenta objetivo principal para el resto del script.
    perform set_config('request.jwt.claim.sub', (select auth_user_id::text from _p01c_verify_target limit 1), true);
  else
    raise notice 'p01c: solo hay una cuenta real registrada en el entorno — se saltea la subverificación de visibilidad cruzada de avatar_url (no es un fallo, ver cabecera del archivo)';
  end if;
end $$;

-- ------------------------------------------------------------------
-- 4) profiles.current_category / update_current_category — NUEVO (revisión 2). Dato
--    declarativo puramente de Perfil: se verifica que nunca toca level_states/mu/confidence/
--    evidence_units, y que el timestamp solo se re-estampa cuando el valor realmente cambia.
-- ------------------------------------------------------------------

do $$
declare
  v_player_id uuid := (select player_id from _p01c_verify_target limit 1);
  v_level_before public.level_states;
  v_level_after public.level_states;
  v_profile_after public.profiles;
  v_backdated_stamp timestamptz := now() - interval '10 days';
  v_rejected boolean;
begin
  select * into v_level_before from public.level_states where player_id = v_player_id;

  -- Escritura válida.
  perform public.update_current_category('5');
  select * into v_profile_after from public.profiles where player_id = v_player_id;
  if v_profile_after.current_category is distinct from '5' or v_profile_after.current_category_at is null then
    raise exception 'current_category_valid_write_wrong: value=% at=%', v_profile_after.current_category, v_profile_after.current_category_at;
  end if;

  -- `now()` queda FIJO para toda esta transacción (transaction_timestamp real de Postgres) — no
  -- sirve para distinguir "se re-estampó" de "no se re-estampó" comparando contra otra llamada
  -- posterior dentro del mismo script. Se inyecta a propósito un timestamp ya viejo (10 días
  -- atrás) directamente en la fila para tener una base realmente distinta de `now()` contra la
  -- que comparar — mismo espíritu que la sección 5 (mutación controlada, revertida por el
  -- ROLLBACK final).
  update public.profiles set current_category_at = v_backdated_stamp where player_id = v_player_id;

  -- Guardar el MISMO valor de nuevo no debe re-estampar el timestamp (mismo criterio que ya
  -- usaba el camino local/legacy en app.js): la fecha vieja inyectada arriba debe sobrevivir
  -- intacta si la RPC realmente no re-escribe el timestamp cuando el valor no cambia.
  perform public.update_current_category('5');
  select * into v_profile_after from public.profiles where player_id = v_player_id;
  if v_profile_after.current_category_at is distinct from v_backdated_stamp then
    raise exception 'current_category_same_value_should_not_restamp_timestamp: got=%', v_profile_after.current_category_at;
  end if;

  -- Cambiar el valor SÍ debe re-estampar el timestamp — la fecha vieja inyectada debe desaparecer,
  -- reemplazada por el `now()` real de esta transacción (necesariamente distinto de hace 10 días).
  perform public.update_current_category('no-compito');
  select * into v_profile_after from public.profiles where player_id = v_player_id;
  if v_profile_after.current_category is distinct from 'no-compito' or v_profile_after.current_category_at = v_backdated_stamp then
    raise exception 'current_category_change_should_restamp_timestamp: got=%', v_profile_after.current_category_at;
  end if;

  -- Valor fuera del conjunto permitido -> rechazado, fila sin tocar.
  v_rejected := false;
  begin
    perform public.update_current_category('categoria-inventada');
  exception when others then
    if sqlerrm = 'current_category_invalid' then v_rejected := true; else raise; end if;
  end;
  if not v_rejected then raise exception 'invalid_current_category_not_rejected'; end if;
  select * into v_profile_after from public.profiles where player_id = v_player_id;
  if v_profile_after.current_category is distinct from 'no-compito' then
    raise exception 'rejected_current_category_call_should_not_have_changed_anything';
  end if;

  -- El corazón de la separación A/B: NINGUNA de las escrituras de arriba debe haber tocado
  -- level_states (mu/confidence/evidence_units/declared_category/status) en absoluto.
  select * into v_level_after from public.level_states where player_id = v_player_id;
  if v_level_after.mu is distinct from v_level_before.mu
     or v_level_after.confidence is distinct from v_level_before.confidence
     or v_level_after.evidence_units is distinct from v_level_before.evidence_units
     or v_level_after.declared_category is distinct from v_level_before.declared_category
     or v_level_after.status is distinct from v_level_before.status then
    raise exception 'update_current_category_leaked_into_level_states';
  end if;
end $$;

-- ------------------------------------------------------------------
-- 5) officialize_level_onboarding — inicialización de profiles.current_category. Manipula
--    level_states.status a 'PENDIENTE' de forma CONTROLADA y temporal (dentro de esta misma
--    transacción, revertido por el ROLLBACK final) para poder ejercitar de verdad la transición
--    PENDIENTE->CALIBRANDO sin depender de que la cuenta elegida esté hoy, por casualidad, en ese
--    estado exacto. Verifica las DOS mitades de la corrección de esta revisión:
--      a) el valor de declared_category que llega a la RPC SÍ se persiste en level_states (cierra
--         el hallazgo de "p_declared_category: null hardcodeado" — ver el fix del Edge Function);
--      b) esa MISMA oficialización inicializa profiles.current_category UNA vez, y una edición
--         posterior de Perfil (update_current_category) jamás vuelve a tocar el valor histórico
--         de level_states.declared_category (inmutabilidad real, no solo documentada).
-- ------------------------------------------------------------------

do $$
declare
  v_player_id uuid := (select player_id from _p01c_verify_target limit 1);
  v_auth_user_id uuid := (select auth_user_id from _p01c_verify_target limit 1);
  v_level_before public.level_states;
  v_level_after public.level_states;
  v_profile_after public.profiles;
begin
  select * into v_level_before from public.level_states where player_id = v_player_id;

  update public.level_states set status = 'PENDIENTE' where player_id = v_player_id;

  perform public.officialize_level_onboarding(
    v_auth_user_id, 'v1.2', 'v1.2', 'quick', 4.5, 0.35,
    '5', 'ctx_test', '{}'::jsonb, '{}'::jsonb
  );

  select * into v_level_after from public.level_states where player_id = v_player_id;
  if v_level_after.status is distinct from 'CALIBRANDO' or v_level_after.declared_category is distinct from '5' then
    raise exception 'officialize_level_onboarding_did_not_persist_declared_category: status=% declared=%', v_level_after.status, v_level_after.declared_category;
  end if;

  select * into v_profile_after from public.profiles where player_id = v_player_id;
  if v_profile_after.current_category is distinct from '5' or v_profile_after.current_category_at is null then
    raise exception 'officialize_level_onboarding_did_not_initialize_current_category: value=% at=%', v_profile_after.current_category, v_profile_after.current_category_at;
  end if;

  -- Idempotencia ya existente (status ya no es PENDIENTE): una segunda llamada con OTRA
  -- categoría declarada no debe cambiar nada, ni en level_states ni en profiles.current_category.
  perform public.officialize_level_onboarding(
    v_auth_user_id, 'v1.2', 'v1.2', 'quick', 9.9, 0.99,
    '1', 'ctx_other', '{}'::jsonb, '{}'::jsonb
  );
  select * into v_level_after from public.level_states where player_id = v_player_id;
  select * into v_profile_after from public.profiles where player_id = v_player_id;
  if v_level_after.declared_category is distinct from '5' or v_profile_after.current_category is distinct from '5' then
    raise exception 'officialize_level_onboarding_idempotency_broken_by_current_category_change';
  end if;

  -- Inmutabilidad real: editar la categoría ACTUAL desde Perfil (update_current_category) jamás
  -- toca el contexto histórico de Nivel (level_states.declared_category sigue en '5').
  perform public.update_current_category('no-se');
  select * into v_level_after from public.level_states where player_id = v_player_id;
  select * into v_profile_after from public.profiles where player_id = v_player_id;
  if v_level_after.declared_category is distinct from '5' then
    raise exception 'perfil_category_edit_mutated_historical_level_states_declared_category: %', v_level_after.declared_category;
  end if;
  if v_profile_after.current_category is distinct from 'no-se' then
    raise exception 'perfil_category_edit_did_not_persist_current_category';
  end if;
end $$;

-- ------------------------------------------------------------------
-- 6) Storage: bucket "avatars" PRIVADO + políticas RLS esperadas.
-- ------------------------------------------------------------------

do $$
declare
  v_policy_count integer;
  v_select_qual text;
  v_select_roles name[];
  v_any_anon_or_public_role boolean;
begin
  -- Bucket privado (revisión 2 — Backend_Infraestructura.md §5.1), con los mismos límites de
  -- tamaño/MIME de siempre.
  if not exists (
    select 1 from storage.buckets
    where id = 'avatars' and public = false and file_size_limit = 2097152
  ) then
    raise exception 'avatars_bucket_missing_or_not_private';
  end if;

  -- Exactamente 4 políticas para esta bucket (insert/update/delete owner-scoped + 1 select
  -- amplia a authenticated) — mismo conteo que antes, pero la de select cambió de nombre/alcance.
  select count(*) into v_policy_count
  from pg_policies
  where schemaname = 'storage' and tablename = 'objects' and policyname like 'avatars_%';
  if v_policy_count <> 4 then
    raise exception 'avatars_storage_policies_unexpected_count: %', v_policy_count;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'avatars_select_authenticated'
  ) then
    raise exception 'avatars_select_authenticated_policy_missing';
  end if;
  if exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'avatars_select_own'
  ) then
    raise exception 'avatars_select_own_policy_should_have_been_replaced';
  end if;

  -- La política de select NO debe estar restringida a la carpeta propia (foldername) — cualquier
  -- authenticated puede leer cualquier objeto de esta bucket.
  select qual, roles into v_select_qual, v_select_roles
  from pg_policies
  where schemaname = 'storage' and tablename = 'objects' and policyname = 'avatars_select_authenticated';
  if v_select_qual ilike '%foldername%' then
    raise exception 'avatars_select_authenticated_should_not_be_folder_scoped: %', v_select_qual;
  end if;

  -- Ninguna de las 4 políticas de esta bucket debe incluir `anon`/`public` entre sus roles — la
  -- ausencia total de una política para esos roles es lo que hace que Postgres deniegue por
  -- defecto cualquier acceso anónimo al bucket privado (deny-by-default real, no solo documentado).
  select bool_or(r = 'anon' or r = 'public') into v_any_anon_or_public_role
  from pg_policies, unnest(roles) as r
  where schemaname = 'storage' and tablename = 'objects' and policyname like 'avatars_%';
  if coalesce(v_any_anon_or_public_role, false) then
    raise exception 'avatars_storage_policy_unexpectedly_grants_anon_or_public_role';
  end if;
end $$;

-- ------------------------------------------------------------------
-- 7) Seguridad / permisos / firmas — funciones nuevas o modificadas de esta revisión.
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

  if has_function_privilege('public', 'public.update_current_category(text)', 'EXECUTE')
     or has_function_privilege('anon', 'public.update_current_category(text)', 'EXECUTE') then
    raise exception 'update_current_category_execute_too_broad';
  end if;
  if not has_function_privilege('authenticated', 'public.update_current_category(text)', 'EXECUTE') then
    raise exception 'update_current_category_authenticated_execute_missing';
  end if;

  if has_function_privilege('public', 'public.get_public_profile(uuid)', 'EXECUTE')
     or has_function_privilege('anon', 'public.get_public_profile(uuid)', 'EXECUTE') then
    raise exception 'get_public_profile_execute_too_broad';
  end if;
  if not has_function_privilege('authenticated', 'public.get_public_profile(uuid)', 'EXECUTE') then
    raise exception 'get_public_profile_authenticated_execute_missing';
  end if;

  -- officialize_level_onboarding sigue siendo EXCLUSIVA de service_role (sin cambios de grants —
  -- CREATE OR REPLACE con la misma firma preserva los GRANTs existentes automáticamente).
  if has_function_privilege('public', 'public.officialize_level_onboarding(uuid,text,text,text,numeric,numeric,text,text,jsonb,jsonb)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.officialize_level_onboarding(uuid,text,text,text,numeric,numeric,text,text,jsonb,jsonb)', 'EXECUTE') then
    raise exception 'officialize_level_onboarding_execute_too_broad';
  end if;
end $$;

rollback;

select 'PRE-PRODUCTION P0.1C revisión 2 (Perfil editable server-backed) OK — rollback limpio' as result;
