-- BRAMUlab — V04.19 L1: hardening posterior al gate Central.
-- Fija search_path de la función trigger append-only detectada por Supabase Advisor.
-- Agrega índice de soporte para la FK legal_version de legal_acceptances.
-- No cambia comportamiento de producto.

alter function public.legal_acceptances_reject_mutation() set search_path = public;

create index if not exists legal_acceptances_legal_version_idx
  on public.legal_acceptances (legal_version);
