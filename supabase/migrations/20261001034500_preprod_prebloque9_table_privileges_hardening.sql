-- BRAMUlab — Pre-Bloque 9: privilegios de tabla de mínimo alcance.
-- Hallazgo del gate vivo Central: Supabase/Postgres conservaba TRUNCATE, REFERENCES y TRIGGER
-- para anon/authenticated en tablas public aunque DML directo ya estaba revocado.
-- BRAMU no necesita ninguno de esos privilegios desde el cliente.
--
-- SELECT intencional se conserva donde corresponde y sigue limitado por RLS.
-- service_role no se modifica.

revoke truncate, references, trigger on all tables in schema public from anon, authenticated;

-- Evitar que nuevas tablas creadas por el mismo rol de migraciones vuelvan a heredarlos.
alter default privileges in schema public
  revoke truncate, references, trigger on tables from anon, authenticated;
