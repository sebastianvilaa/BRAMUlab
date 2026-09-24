# Pre-Production — Handoff P0.1C Perfil editable server-backed — Claude Code

**Fecha:** 24/09/2026  
**Rama:** `staging`  
**Estado de entrada:** P0.1 Estado Cero implementado; P0.1B Ranking automático validado; QA corta sobre cuentas reales de Staging en curso.  
**Objetivo:** hacer que `Perfil / Mis datos / Editar datos` funcione de verdad para cuentas server-backed.

## 1. Lectura obligatoria

Leer primero:

1. `docs/BRAMUlab/README.md`;
2. `docs/BRAMUlab/Metodo_Trabajo.md`;
3. `docs/BRAMUlab/Pre_Production.md` — sección P0.1C;
4. `docs/BRAMUlab/Backend_Infraestructura.md` — cuenta/perfil, Auth y privacidad;
5. `docs/BRAMUlab/Experiencia_Inicial.md` — Perfil progresivo y datos opcionales;
6. la definición vigente de WhatsApp en V03.6 solo como referencia de producto ya consolidada, no como autoridad técnica histórica.

Después inspeccionar únicamente el código/migraciones actuales afectados.

No reauditar Bloques 1–8.

## 2. Problema real

Hoy `openProfileEditModal()` detecta `user.serverBacked` y deshabilita el guardado por completo.

La propia nota en código explica que varios campos todavía no estaban conectados a backend.

Esto ya bloquea QA real porque Sebastián necesita comprobar:

- Mi Perfil;
- Perfil público;
- foto/avatar;
- mano/lado;
- datos personales;
- ubicación/rama;
- contacto por WhatsApp;
- persistencia entre sesiones/dispositivos.

## 3. Regla de producto

Una cuenta real debe poder editar desde Perfil / Mis datos, sin convertir esos campos en requisito para usar Home:

- nombre;
- apellido;
- nombre visible;
- fecha de nacimiento;
- género opcional;
- mano dominante;
- lado habitual;
- localidad;
- rama competitiva;
- teléfono;
- consentimiento de contacto por WhatsApp;
- foto/avatar.

### Username

`@usuario` permanece fijo para V1.

El backend ya lo trata como `username_locked`.

En la UI server-backed:

- puede mostrarse;
- no debe ofrecerse como editable si el servidor lo va a rechazar;
- no crear otra vía paralela para cambiarlo.

## 4. Reutilizar lo que ya existe

NO crear un segundo sistema de Perfil.

`complete_profile` ya soporta ediciones posteriores de:

- first_name;
- last_name;
- display_name;
- birth_date;
- gender;
- dominant_hand;
- preferred_side;
- competitive_branch;
- location.

Reutilizar ese contrato o extenderlo de manera compatible si es estrictamente necesario.

No permitir que el frontend escriba directamente tablas protegidas.

## 5. WhatsApp — contrato V1

Producto ya definido:

- `phone` es privado;
- `allow_whatsapp_contact` es booleano separado;
- default = false;
- cargar teléfono NO implica consentimiento;
- activar consentimiento exige teléfono válido;
- revocar consentimiento siempre debe ser posible;
- Perfil público muestra `CONTACTAR POR WHATSAPP` únicamente si teléfono válido + consentimiento;
- el número NO se muestra como texto en Perfil público;
- mensaje fijo vigente del frontend puede reutilizarse;
- email nunca se expone.

Backend esperado:

- persistencia real de teléfono/consentimiento;
- validación server-side mínima;
- lectura propia desde `fetchOwnProfile`;
- lectura pública solo de lo imprescindible para habilitar el contacto cuando el consentimiento esté activo.

No exponer teléfono por una RPC pública cuando `allow_whatsapp_contact=false`.

## 6. Avatar/foto — contrato V1

La foto es opcional y debe:

- persistir entre sesiones/dispositivos;
- verse en Home/Mi Perfil;
- verse en Perfil público cuando exista;
- poder reemplazarse;
- poder eliminarse.

No guardar data URLs/base64 en `profiles`.

Preferir Supabase Storage con:

- bucket dedicado a avatares;
- path estable por `player_id`;
- upload/update/delete permitido solo al dueño;
- lectura compatible con Perfil público autenticado;
- referencia persistida en `profiles`.

Evitar hacer público todo el bucket si una política autenticada/private bucket resuelve el caso con complejidad razonable.

Reusar el downscale existente del frontend; no subir fotos enormes sin necesidad.

## 7. Privacidad pública

Mi Perfil / Mis Datos puede mostrar los datos propios persistidos.

Perfil público debe continuar mostrando únicamente lo autorizado por producto.

Conservar estas reglas:

- fecha de nacimiento / edad personal: no exponer por defecto;
- género personal: no exponer por defecto;
- email: nunca;
- teléfono: nunca como texto visible;
- WhatsApp: solo CTA con consentimiento;
- mano/lado: pueden mostrarse como hoy;
- localidad/rama: solo según contratos ya vigentes;
- avatar: visible si existe;
- Nivel/Ranking: sin cambios.

No ampliar `get_public_profile` a datos privados por comodidad de implementación.

## 8. Categoría declarada

La UI histórica tiene una fila de categoría, pero el backend real la lee desde `level_states.declared_category`.

Antes de tocarla, trazar el contrato actual.

Regla de seguridad/producto para esta ronda:

- editar Perfil NO puede recalcular libremente el Nivel;
- no modificar `mu`, confidence, evidence_units ni resultados/eventos históricos solo porque cambió una categoría declarada;
- no reescribir el cuestionario inicial.

Si existe una vía semánticamente limpia para actualizar solo el contexto declarado actual sin alterar el Nivel, implementarla con auditoría.

Si no existe o requiere una decisión conceptual nueva, dejar categoría temporalmente solo lectura en server-backed, marcar `DECISIÓN ABIERTA` no bloqueante y completar todo el resto.

No frenar la ronda entera por categoría.

## 9. Frontend esperado

En cuentas server-backed:

- retirar el bloqueo general que hoy impide guardar;
- precargar valores reales desde Supabase;
- username claramente no editable;
- GUARDAR ejecuta persistencia real;
- mostrar loading/disabled mientras guarda;
- errores server-side con copy entendible;
- al éxito: refrescar perfil desde servidor y volver a Perfil/Mis Datos;
- recargar debe conservar todo;
- nunca hacer optimistic cache como única verdad.

No rediseñar visualmente la pantalla salvo ajustes mínimos necesarios para estados disabled/loading/error.

## 10. Ranking y Nivel

NO tocar fórmula de Nivel.

Cambiar localidad/rama actualiza el Perfil actual pero:

- no reescribe snapshots semanales publicados de Ranking;
- no fuerza una posición durante `CALIBRANDO`;
- no reintroduce `ranking_opt_in`.

No tocar la lógica competitiva de Ranking.

## 11. Seguridad

Mantener patrón backend actual:

- RLS deny-by-default;
- escrituras por RPC segura o políticas Storage acotadas;
- usuario autenticado solo puede modificar su propio Perfil/avatar;
- un jugador no puede cambiar phone/avatar/datos de otro;
- Perfil público no filtra privados;
- validar MIME/tamaño razonable de avatar;
- no aceptar rutas de Storage arbitrarias pertenecientes a otro jugador.

Revisar Security Advisor solo por regresiones nuevas de esta ronda; no reabrir warnings históricos no relacionados.

## 12. Tests mínimos

Backend / SQL:

1. propio usuario puede editar campos permitidos;
2. otro usuario no puede editarlos;
3. username no cambia;
4. teléfono persiste;
5. consentimiento false no expone contacto;
6. consentimiento true + teléfono válido habilita dato mínimo para WhatsApp;
7. avatar path solo puede modificarse por dueño;
8. ubicación/rama siguen respetando reglas de Ranking;
9. ningún cambio de Perfil altera `mu`/confidence/evidence;
10. privacidad de `get_public_profile`.

Frontend:

11. server-backed ya permite Guardar;
12. cambios sobreviven recarga;
13. cambios sobreviven logout/login;
14. quitar consentimiento oculta CTA público;
15. foto subir/reemplazar/eliminar;
16. Perfil público de otra cuenta refleja avatar/WhatsApp correctos;
17. 0 partidos sigue respetando Estado Cero/perfil progresivo;
18. Ranking automático sin opt-in sigue intacto.

No repetir suites equivalentes si ya existe evidencia suficiente.

## 13. Staging / deploy

Solo `staging`.

NO tocar:

- `main`;
- Production;
- BRAMUlive.

Trabajar localmente primero.

Antes de push:

- revisar diff completo;
- tests focalizados;
- regresión mínima;
- un solo bump de bundle si frontend cambia;
- un único commit/push lógico final.

Si hay migraciones de Supabase que no podés aplicar desde tu sesión, dejarlas listas y especificar exactamente cuáles; ChatGPT central las aplicará y verificará.

Si hay cambios de Edge Functions, indicar cuáles deben redeployarse.

## 14. Informe

Guardar:

`docs/BRAMUlab/Implementacion/Pre_Production/10_Resultado_Perfil_Editable_ServerBacked_Claude.md`

Incluir:

- arquitectura elegida;
- campos persistidos;
- tratamiento de username;
- tratamiento de categoría;
- Storage/avatar;
- WhatsApp/consentimiento;
- privacidad pública;
- migraciones;
- Edge Functions/RPCs;
- tests;
- bundle;
- commit SHA;
- cualquier `DECISIÓN ABIERTA` real.

## 15. Condición de finalización

No dar por terminada la intervención hasta que:

- implementación esté completa;
- tests pasen;
- informe esté escrito;
- commit final exista;
- todo esté pusheado a `origin/staging`.

Si una decisión humana bloquea solo una parte (por ejemplo categoría), marcarla y continuar con todo lo demás.
