# BRAMUlab — Backlog vigente

**Estado:** ideas y funciones futuras todavía no autorizadas para implementar.  
**Actualización documental:** 18 de septiembre de 2026.  
**Regla:** este archivo contiene solo futuro real. Lo ya definido o implementado vive en su fuente maestra correspondiente.

---

## 1. Qué NO es backlog porque ya tiene fuente propia

No volver a tratar como idea futura abierta:

- **Nivel BRAMU V1** → `Nivel_BRAMU_Formula_V1.5.md`, `Nivel_BRAMU_Implementacion.md`, `Nivel_BRAMU.md` y V04.
- **Ranking BRAMU V1** → `Ranking_BRAMU.md`.
- **BRAMU Intelligence V1** → `BRAMU_Intelligence.md` + `BRAMU_Intelligence_Implementacion.md`.
- **Experiencia inicial / validación por parejas / correcciones / pendientes** → `Experiencia_Inicial.md` + contrato técnico en `Backend_Infraestructura.md`.
- **Backend / cuentas reales / entornos / infraestructura** → `Backend_Infraestructura.md`.
- **Identidad local, Player Card, Perfil, Mis grupos y prototipo de Ranking** → V03 cerrada.

Si una idea de este backlog entra en desarrollo, primero debe pasar a un documento/consolidado autorizado; no se implementa directo desde acá.

---

## 2. Backend/producto multiusuario — pendientes funcionales posteriores

La arquitectura general y el ciclo básico de partido ya están definidos en `Backend_Infraestructura.md` y `Experiencia_Inicial.md`. Lo que sigue realmente pendiente incluye:

- política exacta para partidos observados y eventual reclamo/validación posterior;
- verificación reforzada de reclamo de identidades provisionales si el claim básico del piloto demuestra fricción;
- detección y resolución de identidades provisionales duplicadas;
- política de conflictos entre dispositivos y retención de cola offline;
- privacidad exacta de perfiles y relación con datos públicos/buscables;
- matriz final de permisos/RLS;
- límites operativos y antiabuso para producción;
- `supabase/tests/verify-bloque2.mjs` debería confirmar que sus propias operaciones de limpieza (borrado de cuentas/filas de prueba al final del script) realmente tuvieron éxito, en vez de dispararlas sin revisar la respuesta — un permiso faltante de `service_role` (corregido el 18/09/2026, ver Bloque 2 del Informe de Backend) dejó pasar desapercibidas dos corridas reales cuya limpieza falló en silencio. No bloquea ningún bloque; es una mejora de robustez del propio script de verificación.

No diseñar otra arquitectura paralela: estos puntos completan la fuente maestra de Backend.

---

## 3. Ranking BRAMU — evoluciones fuera de V1

La V1 oficial está cerrada en `Ranking_BRAMU.md`. Queda fuera de alcance actual:

- **Explorar rankings** de otras ciudades/provincias/países sin modificar la ubicación propia;
- vista “cerca de mi posición” si más adelante existe densidad suficiente;
- rankings privados de grupos;
- temporadas/races;
- rankings oficiales de torneos/clubes;
- premios o competiciones que exijan una capa extra de validación;
- herramientas de administración/integridad para universos competitivos grandes.

No agregar estas funciones durante el piloto inicial salvo decisión explícita.

---

## 4. Nivel BRAMU — evoluciones posteriores al piloto

Nivel V1 está implementado para ser probado, no cerrado para siempre. Después del piloto real puede evaluarse:

- recalibrar anclas, categorías locales o parámetros a partir de datos reales;
- ampliar mapas de categoría a otros países/circuitos;
- métricas de deriva, inflación/deflación y concentración;
- UX de explicación más rica de variaciones por partido;
- tratamiento de inactividad a largo plazo;
- revisión de umbrales de recalibración con evidencia real.

Cualquier cambio matemático requiere nueva versión explícita; nunca modificar resultados históricos silenciosamente.

---

## 5. BRAMU Intelligence — evoluciones posteriores a V1

V1 ya está definida. Futuro posible:

- incorporar datos de registro Por Games o punto a punto para análisis temporal más profundo;
- enriquecer relaciones de compañero/rival cuando exista mayor historial;
- benchmarking poblacional solo con una base suficientemente limpia;
- recuerdos/resúmenes de períodos, temporadas o hitos personales;
- nuevas familias de insights respaldadas por nuevos datos reales;
- personalización de tono dentro de límites editoriales;
- evaluación de nuevos proveedores generativos si cambia costo/calidad.

Nunca habilitar análisis técnico individual si BRAMU no registra evidencia suficiente.

---

## 6. Registro de partidos y marcador

Evoluciones posibles, no prioritarias antes del piloto:

- integración definitiva entre registro Completo / Por Games / Resultado manual dentro de un único modelo compartido;
- formatos excepcionales: partido interrumpido, amistoso con reglas arbitrarias, Partido Libre;
- rediseño estructural definitivo del marcador en vivo si las pruebas reales muestran fricción;
- simplificación adicional de corrección/undo si las pruebas reales muestran fricción, sin romper el contrato vigente de revisiones;
- carga colaborativa desde más de un dispositivo, solo cuando exista backend real y se justifique.

La prioridad sigue siendo registrar un partido con la menor cantidad de acciones posible.

---

## 7. Social, notificaciones y relaciones

A evaluar después de tener usuarios reales:

- notificaciones reales de validación, invitaciones, cambios relevantes y actividad;
- sistema de avisos no invasivo para perfil/datos incompletos cuando realmente aporte valor;
- seguidores/amigos si `Mi red` no alcanza;
- invitaciones más ricas a jugadores provisionales;
- herramientas sociales alrededor de grupos sin convertir BRAMU en una red social genérica.

---

## 8. Fotos, recuerdos y capa emocional

Ideas estacionadas:

- fotos asociadas a partidos;
- recuerdos automáticos de partidos/hitos;
- recap visual de períodos;
- piezas compartibles generadas desde resultados/estadísticas reales.

Mantener como dirección humana del producto; no construir antes de validar el núcleo.

---

## 9. Wearables y plataformas nativas

Futuro lejano:

- smartwatch: pulsaciones, calorías, distancia u otros datos compatibles;
- Apple Health / Google Health Connect si aporta valor real;
- Live Activities / Dynamic Island / lock screen.

Las funciones nativas de iOS/Android no son posibles desde la PWA actual sin una estrategia de app nativa/híbrida específica.

---

## 10. Torneos, clubes y organizadores

Hipótesis futura de producto/comercial:

- registrar partidos/finales con mayor nivel de validación;
- informes postpartido para jugadores;
- organización de torneos o ligas;
- roles de club/organizador verificado;
- rankings/competencias privadas u oficiales.

No priorizar monetización ni B2B hasta que el uso amateur básico funcione y sea atractivo.

---

## 11. Monetización

No es prioridad actual.

Solo evaluar después de validar:

- recurrencia de uso;
- valor real del historial/Ranking/Intelligence;
- costos inevitables de infraestructura/IA;
- interés de clubes/organizadores.

No agregar publicidad, paywalls o planes pagos al piloto por defecto.

---

## 12. Criterio para sacar algo del backlog

Antes de promover una idea a desarrollo registrar, como mínimo:

- problema real que resuelve;
- evidencia observada en pruebas/usuarios;
- impacto esperado;
- esfuerzo/dependencias;
- riesgo de complicar el uso;
- qué dato adicional exige registrar;
- versión/etapa a la que pertenecería.

La mejor primera versión sigue siendo la que registra fácil y devuelve suficiente valor como para querer volver a usar BRAMU.
