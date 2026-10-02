-- BRAMUlab V04.28 — snapshot READ-ONLY de level_states para comparar ANTES/DESPUÉS del deploy de Nivel V1.3.
-- Ejecutar en Staging (project ref serxtivkfnptzurnvewg) con service_role / SQL editor ANTES de desplegar la Edge Function
-- y repetir DESPUÉS. Solo SELECT: no modifica nada. Comparar los dos resultados (mismo ORDER BY) fila por fila:
-- todas las cuentas que ya existían deben quedar idénticas en estas 8 columnas.
select
  player_id, status, mu, confidence, rated_matches, distinct_opponents, questionnaire_version, algorithm_version
from public.level_states
order by player_id;

-- Huella compacta para comparar de un vistazo (misma consulta, agregada):
select count(*) as filas,
       md5(string_agg(concat_ws('|', player_id, status, mu, confidence, rated_matches, distinct_opponents, questionnaire_version, algorithm_version), ';' order by player_id)) as huella
from public.level_states;
