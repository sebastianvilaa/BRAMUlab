# 140 — Handoff V04.36 · Anular carga + identidad visual final

**Fecha:** 06/10/2026  
**Rama:** `staging`  
**Base:** `261bc2b3c6d41cd9416da24fc9a1e7d185a356f5`  
**Objetivo:** BRAMUlab **V04.36 / 04.36-h1**  
**NO TOCAR:** `main`, Production, BRAMUlive.

## Leer
1. `docs/BRAMUlab/README.md`
2. `docs/BRAMUlab/Metodo_Trabajo.md`
3. `docs/BRAMUlab/Identidad_Visual.md`
4. este handoff
5. `136_Handoff_Brainstorming_Pre_Salida_06OCT.md` §D3
6. `137_Evaluacion_Central_Brainstorming_Secuencia_Pre_Salida_06OCT.md` §4

Hardening 138–139 está cerrado. No reabrirlo.

## A. Identidad visual final

Assets aprobados fuera del repo:
- `/Otros Trabajos/BRAMUlab/Sistema grafico/Archivos/Marca/SVG/BRAMUlab-Logo.svg`
- `/Otros Trabajos/BRAMUlab/Sistema grafico/Archivos/Marca/SVG/BRAMUlab-Isotipo.svg`
- `/Otros Trabajos/BRAMUlab/Sistema grafico/Archivos/Marca/SVG/BRAMUlab-IconoApp.svg`

PNG equivalentes existen en `.../Marca/PNG/` solo como referencia visual.

Si esa ruta externa no es accesible: NO redibujar ni improvisar; continuar lo no bloqueado y reportar el límite.

### AGREGAR
- `docs/BRAMUlab/Marca/` con los 3 SVG maestros.
- `Identidad_Visual.md` YA EXISTE y es la fuente maestra visual. No reemplazarlo por un brand book generado ni reabrir sus decisiones; actualizarlo solo si la implementación descubre una necesidad técnica real.

### REEMPLAZAR / FUSIONAR
- nuevo logo SVG en splash, acceso, headers y footer;
- conservar `bramulab/icons/logo.png` derivado del logo nuevo solo para compatibilidad de emails;
- generar desde `BRAMUlab-IconoApp.svg`: `icon-192.png`, `icon-512.png`, `icon-512-maskable.png`, `apple-touch-icon.png`, `favicon-64.png`;
- actualizar apple-touch data URI, manifest, SW, cache/version strings y tests;
- sanitizar metadata SVG sin alterar diseño.

### BORRAR, después de verificar referencias
Retirar la vieja `docs/identidad-visual/`: 4 PNG históricos + generador viejo + assets reemplazados.  
`bramulab/icons/splash-b.png` también sale si no tiene referencias.

Las 18 referencias Premier Padel ya fueron archivadas por Central en `/Otros Trabajos/BRAMUlab/Sistema grafico/Referencias/Premier-Padel/` y verificadas (18/18). La copia versionada del repo debe eliminarse en esta ronda.

Las referencias Playtomic locales también fueron movidas por Central a `/Otros Trabajos/BRAMUlab/Sistema grafico/Referencias/Playtomic/` y verificadas (25/25). No son fuente de verdad ni deben volver al repo.

### NO TOCAR
- `bramulab/icons/padel-court-example.svg`
- UI general fuera del reemplazo de marca
- BRAMUlive

### Paleta vigente
Marca: `#050A12`, `#95FF19`, `#199FFF`, `#F8FAFC`.  
Superficies: `#03070D`, `#050A12`, `#09131F`, `#0D1A2A`, `#112238`, `#152B43`.  
Secundarios: `#66B30F`, `#0D6FCC`, `#9AA7B5`, `#687482`.  
Funcionales, no marca: `#FFC93D`, `#FFA93D`, `#FF5B61`, `#2ECC71`.  
Tipografía: **Inter 400–900**.

No abrir redesign. Los assets aprobados ya son autoridad.

## B. Anular carga

Implementar autoservicio para el autor original.

### Elegibilidad server-side
Solo puede si:
- es autor original;
- match sigue `pending_validation`;
- ninguna OTRA persona realizó una acción que reconozca el encuentro.

NO bloquea:
- `identity_questioned` / “No participé” de otra persona.

SÍ bloquean acciones de otra persona equivalentes a:
- validar/confirmar;
- corrección/revisión;
- reemplazo/corrección de participante afirmando quién sí jugó;
- cualquier evidencia equivalente.

Acciones del propio autor no bloquean por sí solas.

No reutilizar ciegamente `admin_annul_match`: genera `admin_action`.

### Efecto
- conservar internamente `annulled` + timestamp/razón/auditoría;
- no borrar físicamente;
- desaparecer de Historial, Pendientes, Home, notificaciones y superficies deportivas;
- no crear notificación nueva;
- no afectar Nivel, Ranking, Grupos, Intelligence, stats ni contadores;
- invisibilidad robusta server-side.

### UX
En Resumen del pending elegible del autor:
- mantener `Reportar un error`;
- debajo, menor jerarquía, texto destructivo rojo: **Anular carga**.

Modal:
- **¿Anular esta carga?**
- **El partido dejará de estar pendiente y no tendrá efectos en BRAMU.**
- cancelar / anular carga.

Tras éxito: salir y refrescar.

## C. Pruebas mínimas
- autor elegible PASS;
- no autor FAIL;
- no pending FAIL;
- acción reconocedora de tercero bloquea;
- “No participé” de tercero no bloquea;
- acciones solo del autor no bloquean;
- doble ejecución no corrompe;
- sin notificación nueva;
- desaparece de lecturas;
- sin efectos deportivos;
- sin refs activas a assets viejos;
- PWA/iconos/manifest/SW coherentes;
- logo nuevo en splash/acceso/header/footer;
- `/icons/logo.png` nuevo sigue disponible para emails;
- hardening 139 no retrocede.

Por tocar backend/lecturas: focales + suite Node completa + `release-check`.

## D. Versionado / entrega
- `BRAMUlab V04.36`
- bundle `04.36-h1`
- un solo push funcional razonable a `origin/staging`;
- resultado `141_Resultado_V0436_...` con cambios, migración, tests, límites, decisiones abiertas y SHA.
- si hay migración que Claude no puede aplicar a Staging real, dejarla lista; Central la aplicará/verificará.

## Después
1. residuales Issue #28: P0.1/P0.1B + QA final Grupos;
2. autorización explícita G3;
3. origen estable + logos emails + Pages + repo privado;
4. G3/G4 + smoke final;
5. primeros usuarios.

No existe otro manual de sistema gráfico aprobado que bloquee esta ronda. `docs/BRAMUlab/Identidad_Visual.md` es la autoridad visual vigente. Cualquier documento externo futuro deberá respetarlo o ser aprobado explícitamente antes de reemplazarlo.
