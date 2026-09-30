-- BRAMUlab — V04.20 gate Central: pg_net fuera de public.
-- Supabase Advisor 0014 marca extensiones instaladas en public como superficie API innecesaria.
-- pg_net no es relocatable con ALTER EXTENSION, por lo que se recrea en extensions.
-- Sus tablas de requests/responses son operativas/efímeras; no contienen datos fuente de BRAMU.
-- El cron conserva su comando textual net.http_post y continúa funcionando después de recrear.

drop extension if exists pg_net;
create extension pg_net with schema extensions;
