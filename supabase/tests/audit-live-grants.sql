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

-- 4) Privilegios de TABLA peligrosos/directos para anon/authenticated.
--    Esperado: VACÍO. SELECT puede existir de forma intencional sobre tablas públicas/RLS;
--    INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER no son necesarios para el cliente.
select table_name, grantee, privilege_type
  from information_schema.role_table_grants
 where table_schema = 'public'
   and grantee in ('anon', 'authenticated')
   and privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER')
 order by 1, 2, 3;

-- 5) Buckets de Storage públicos (esperado: ninguno — avatars y group-photos son privados)
select id, public from storage.buckets where public order by 1;

-- 6) Cron jobs programados
select jobname, schedule, active from cron.job order by 1;

-- 7) (Bloque 9A) Funciones de public ejecutables por AUTHENTICATED en este proyecto. ANTES de aplicar
--    20261001060000_bloque9a_baseline_privileges.sql comparar con las 58 funciones que esa migración re-concede: toda fila
--    de ESTE resultado que no figure en esa lista dejaría de ser ejecutable por el cliente al aplicarla.
select p.oid::regprocedure::text as authenticated_executable
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.prokind = 'f' and has_function_privilege('authenticated', p.oid, 'EXECUTE')
 order by 1;
