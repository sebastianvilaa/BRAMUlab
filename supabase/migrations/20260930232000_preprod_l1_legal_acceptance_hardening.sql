-- BRAMUlab — V04.19 L1: hardening posterior al gate Central (YA APLICADA en Staging con esta versión; no renombrar).
-- Fija search_path de la función trigger append-only detectada por Supabase Advisor y agrega el índice de soporte de la
-- FK legal_version de legal_acceptances. No cambia comportamiento de producto.
--
-- Bloque 9A (replay limpio): esta migración ordena ANTES que 20260930280000, que es la que crea la tabla y la función.
-- En una base vacía los objetos todavía no existen, por eso cada paso es CONDICIONAL (no-op en replay limpio). El mismo
-- estado final (search_path + índice) está incluido en 20260930280000, así que el resultado es idéntico en ambos caminos.

do $$
begin
  if to_regprocedure('public.legal_acceptances_reject_mutation()') is not null then
    alter function public.legal_acceptances_reject_mutation() set search_path = public;
  end if;
  if to_regclass('public.legal_acceptances') is not null then
    create index if not exists legal_acceptances_legal_version_idx on public.legal_acceptances (legal_version);
  end if;
end $$;
