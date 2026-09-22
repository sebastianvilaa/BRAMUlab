// BRAMUlab — Bloque 7 / Fase 1
//
// Este runner HTTP quedó retirado antes de su primera ejecución real.
// Motivo: después del hardening de F1-C02, service_role no puede DELETE en
// ranking_editions/ranking_rows/location_change_events (append-only). La versión original
// intentaba crear fixtures persistentes y luego limpiarlos con service_role, por lo que podía
// dejar residuos aunque el test funcional hubiera pasado.
//
// Usar en su lugar:
//   supabase/tests/verify-bloque7-fase1.sql
//
// Ese runner usa BEGIN/ROLLBACK y no deja cuentas, filas ni eventos de QA.

console.error(
  'verify-bloque7-fase1.mjs está retirado. Usar supabase/tests/verify-bloque7-fase1.sql (transaccional, rollback limpio).'
);
process.exit(1);
