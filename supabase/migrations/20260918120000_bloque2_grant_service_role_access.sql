-- BRAMUlab — Bloque 2: corrige un permiso faltante de `service_role`.
--
-- Hallazgo real (18/09/2026, validación post-Auth real contra Staging —
-- supabase/tests/diagnose-bloque2-user.mjs): leer `players` con la service role key devolvió
--   permission denied for table players (SQLSTATE 42501)
--   hint: Grant the required privileges to the current role with:
--         GRANT SELECT ON public.players TO service_role;
--
-- Causa: mismo problema de dos capas ya documentado en Bloque 1 (§13 del Informe) — GRANT y RLS
-- son capas separadas en Postgres — pero esta vez del lado de `service_role`, no de
-- `anon`/`authenticated`. El proyecto tiene "Automatically expose new tables" desactivado (a
-- propósito, para no exponer nada por default): con esa opción apagada, NINGÚN rol recibe el
-- GRANT automático que Supabase aplicaría si estuviera prendida, ni siquiera `service_role`. La
-- migración de Bloque 2 (20260916180000_...) le dio SELECT a `authenticated` sobre
-- players/profiles/locations, pero nunca tocó `service_role` — nadie lo había necesitado hasta
-- un script que consulta esas tablas directo con esa clave (los flujos de producto normales
-- pasan por `complete_profile`/el trigger, SECURITY DEFINER, dueños de la tabla — a esos nunca
-- les faltó permiso, por eso el signup/login/onboarding reales funcionaron sin problema).
--
-- Consecuencia práctica ya sospechada: `supabase/tests/verify-bloque2.mjs` también usa
-- `service_role` para borrar sus cuentas de prueba al final (`serviceDelete`), y ese código
-- nunca revisaba si el DELETE realmente tuvo éxito — es probable que las dos corridas reales
-- anteriores hayan dejado filas de prueba (`vb2_...`/`vb2geo_...`) sin borrar. Revisar y limpiar
-- eso es un paso aparte, después de aplicar esta migración (no la hace esta migración sola).
--
-- Esta migración NO toca `anon` ni `authenticated` — seguir exigiendo un GRANT explícito y
-- acotado para esos dos roles sigue siendo la política vigente (deny-by-default real). Lo que
-- se amplía acá es exclusivamente `service_role`: un rol que nunca llega al navegador, pensado
-- justamente para bypassear RLS desde scripts/administración con la clave secreta.

grant select, insert, update, delete on table public.players to service_role;
grant select, insert, update, delete on table public.profiles to service_role;
grant select, insert, update, delete on table public.locations to service_role;
grant select, insert, update, delete on table public.pilot_events to service_role;
grant select on table public.reserved_usernames to service_role;

-- Evita repetir este mismo susto en cada bloque futuro: cualquier tabla nueva que se cree en
-- `public` con el mismo rol que ejecuta esta migración (el que se usa siempre desde el SQL
-- Editor) le va a dar automáticamente acceso completo a `service_role` de acá en adelante — sin
-- esto, cada bloque tendría que acordarse de repetir el GRANT manual de arriba. No se aplica a
-- `anon`/`authenticated`: esas dos siguen necesitando un GRANT explícito y acotado, tabla por
-- tabla, cada vez — eso es intencional (deny-by-default), no un descuido.
alter default privileges in schema public grant select, insert, update, delete on tables to service_role;
