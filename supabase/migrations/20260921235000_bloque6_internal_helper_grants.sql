-- BRAMUlab — Bloque 6: hardening de helpers internos.
--
-- PostgreSQL otorga EXECUTE a PUBLIC por defecto al crear funciones. Estos dos helpers
-- SECURITY DEFINER son implementación interna de Bloque 6 y nunca deben quedar expuestos
-- directamente por PostgREST a anon/authenticated.
--
-- No se concede EXECUTE a ningún rol cliente. Las RPC SECURITY DEFINER que los usan los
-- invocan como owner dentro de su propia ejecución.

revoke all on function public._bloque6_refresh_participant_fingerprint(uuid) from public;
revoke all on function public._bloque6_revert_applied_result(uuid) from public;
