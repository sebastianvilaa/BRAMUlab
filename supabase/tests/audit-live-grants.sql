-- BRAMUlab — Pre-Bloque 9: auditoría VIVA de permisos (solo lectura). Correr en Staging (y luego en Production tras el
-- replay de migraciones). Complementa supabase/scripts/audit-migration-grants.mjs (inventario estático del repo).
-- Resultado esperado documentado en docs/.../82_Resultado_Pre_Bloque_9_Hardening_Staging_30SEP.md

-- 1) Funciones SECURITY DEFINER de public ejecutables por ANON (esperado: solo is_username_available)
select p.proname as anon_executable_secdef
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.prosecdef and has_function_privilege('anon', p.oid, 'EXECUTE')
 order by 1;

-- 2) Funciones SECURITY DEFINER ejecutables por AUTHENTICATED que parecen internas/administrativas
--    (esperado: solo helpers _group_photo_* usados por políticas de Storage)
select p.proname as authenticated_internal_secdef
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.prosecdef and has_function_privilege('authenticated', p.oid, 'EXECUTE')
   and (p.proname like '\_%' escape '\' or p.proname like 'admin\_%' escape '\' or p.prorettype = 'trigger'::regtype
        or p.proname in ('consume_rate_limit','consume_auth_rate_limit','record_legal_acceptance','ops_health_snapshot','purge_old_rate_limits'))
 order by 1;

-- 3) Tablas de public SIN RLS (esperado: ninguna)
select c.relname as table_without_rls
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
 order by 1;

-- 4) Privilegios de TABLA concedidos a anon/authenticated (esperado: app_config y legal_versions SELECT; el resto, vacío)
select table_name, grantee, string_agg(privilege_type, ',' order by privilege_type) as privileges
  from information_schema.role_table_grants
 where table_schema = 'public' and grantee in ('anon', 'authenticated')
 group by 1, 2 order by 1, 2;

-- 5) Buckets de Storage públicos (esperado: ninguno — avatars y group-photos son privados)
select id, public from storage.buckets where public order by 1;

-- 6) Cron jobs programados
select jobname, schedule, active from cron.job order by 1;
