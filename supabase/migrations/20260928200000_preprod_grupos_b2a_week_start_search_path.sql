-- BRAMUlab — Grupos B2a · hardening helper de frontera semanal (28/09/2026).
--
-- Supabase Security Advisor detectó function_search_path_mutable en
-- public._groups_week_start_ba(timestamptz). Es un helper puro sin tablas, pero fijamos
-- explícitamente pg_catalog para eliminar resolución mutable de funciones/operadores.
--
-- B2a ya fue aplicada en Staging antes de este hardening, por eso esto queda como migración
-- correctiva separada y reproducible para futuros entornos.

alter function public._groups_week_start_ba(timestamptz)
  set search_path = pg_catalog;
