-- BRAMUlab — Backend Bloque 4
-- Hardening posterior a la primera aplicación en Staging:
-- las tablas server-only no deben otorgar privilegios directos a anon/authenticated.
-- RLS deny-by-default protege SELECT/DML, pero TRUNCATE/REFERENCES/TRIGGER/MAINTAIN
-- no dependen de RLS. Las RPC SECURITY DEFINER siguen funcionando como owner.

revoke all on table public.provisional_claims from anon, authenticated;
revoke all on table public.api_rate_limits from anon, authenticated;
