-- BRAMUlab — Bloque 3 follow-up: endurecer EXECUTE en funciones SECURITY DEFINER.
--
-- Supabase Advisor detectó que funciones creadas/reemplazadas conservaban EXECUTE implícito
-- para PUBLIC. Este ajuste deja explícito el contrato esperado:
--   - complete_profile: solo authenticated (y service_role)
--   - handle_email_confirmed: no invocable por clientes; solo uso interno del trigger
--   - rls_auto_enable: no invocable por clientes; solo infraestructura interna
--   - is_username_available: anon + authenticated por decisión de producto de Bloque 3
--   - officialize_level_onboarding ya estaba correctamente restringida a service_role

revoke execute on function public.complete_profile(
  text, text, text, text, date, text, text, text, text, text, text, text, text, text, text
) from public, anon;
grant execute on function public.complete_profile(
  text, text, text, text, date, text, text, text, text, text, text, text, text, text, text
) to authenticated;

revoke execute on function public.handle_email_confirmed() from public, anon, authenticated;

revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

-- is_username_available queda deliberadamente disponible a anon para feedback previo
-- a la confirmación del email. Se mantiene SECURITY DEFINER porque las tablas subyacentes
-- no son legibles directamente desde el cliente.
revoke execute on function public.is_username_available(text) from public;
grant execute on function public.is_username_available(text) to anon, authenticated;
