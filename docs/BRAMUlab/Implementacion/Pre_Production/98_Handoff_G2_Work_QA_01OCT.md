# 98 — Handoff G2 a Work: QA browser + Auth URL + icono

**Fecha:** 01/10/2026  
**Entorno único:** Staging  
**Issue:** #22 ABIERTO  
**NO tocar:** main, Production, BRAMUlive, copy/diseño de emails G1.

## Entrada

Leer:
1. `docs/BRAMUlab/README.md`
2. `docs/BRAMUlab/Implementacion/Pre_Production/97_Gate_Central_G2_Pre_Work_01OCT.md`
3. `docs/BRAMUlab/Implementacion/Pre_Production/96_Resultado_G2_Configuracion_Acceso_Legal_01OCT.md`
4. este handoff.

Central ya revisó código. NO repetir auditoría general, migraciones, deploys de Edge ni QA exhaustiva de emails.

## 1. Confirmar deployment

Abrir la app Staging correspondiente a rama `staging` y confirmar:
- versión pública V04.20;
- bundle `04.20-h5`;
- proyecto/entorno correcto;
- Vercel Staging sigue protegido.

## 2. QA UX mobile + desktop

Recorrer con cuenta sintética o cuenta QA:

### Perfil / Mis datos
- engranaje visible y discreto arriba a la derecha;
- Mis datos solo muestra datos de jugador/contacto;
- no aparecen tarjetas Acceso/Legal ni botón grande Cerrar sesión;
- edición server-backed sigue funcionando.

### Configuración
Verificar jerarquía/compactación:
- Cuenta y seguridad;
- Privacidad y datos;
- Legal;
- Ayuda;
- Sesión;
- zona destructiva separada.

Filas centradas verticalmente, chevrons alineados y altura compacta. Sin card-dentro-de-card innecesaria.

### Email
- primer tap en Email abre pantalla informativa;
- **no debe llegar Email #3 todavía**;
- CTA `Cambiar email` recién inicia el flujo y debe llegar #3.
No hace falta repetir todo G1 hasta #5 salvo que se detecte regresión.

### Eliminar cuenta
Usar cuenta descartable:
- primer tap abre explicación;
- **no debe llegar #7 todavía**;
- CTA `Continuar con la eliminación` recién inicia #7.
No completar la destrucción si no hace falta para verificar esta frontera; G1 ya probó el E2E destructivo.

### Copia / Contacto
- primer tap solo abre pantalla;
- CTA recién abre cliente de correo;
- comprobar contenido/categorías honestas sin datos inventados.

### Logout
- fila Cerrar sesión abre:
  - Cerrar sesión
  - Cerrar todas las sesiones
  - Cancelar
- ninguna opción se dispara antes de confirmación.

## 3. Legal in-app

Desde Configuración:
- Términos;
- Política.

Comprobar:
- abre dentro de BRAMU;
- header + back;
- no bottom nav;
- scroll correcto;
- back vuelve a Configuración.

También comprobar al menos un acceso desde alta/reaceptación y que back vuelva a su origen sin perder estado.

## 4. Reaceptación legal

Reproducir con cuenta/fixture sintético.

Validar mobile + desktop:
- no todo pegado arriba;
- jerarquía clara;
- aire entre logo/título/texto/checkbox/CTA;
- CTA relacionado visualmente con la decisión;
- sin vacío inferior absurdo;
- checkbox sigue obligatorio;
- aceptación persiste.

No modificar copy legal.

## 5. Site URL / redirects hosted Auth

Work ya observó anteriormente `Site URL = http://localhost:3000`.

Corregir **solo en Supabase Staging**.

Origen candidato conocido de la rama:
`https://bramulab-git-staging-bramu-lab.vercel.app`

Antes de guardar, confirmar que sigue siendo el alias estable de Staging y no un deployment efímero/Production.

Configurar:
- Site URL = origen estable de Staging;
- Redirect URLs = origen + `/**` (y origen exacto si Dashboard los separa).

Reglas:
- no GitHub/raw;
- no localhost;
- no abrir Vercel Staging públicamente;
- no tocar Production.

Después verificar que la configuración quedó guardada. Como G1 usa OTP y no enlaces, no repetir los 8 emails.

## 6. Icono PWA/iOS

Claude endureció:
- apple-touch-icon embebido;
- manifest con credenciales;
- bundle/cache h5.

Si Work dispone de iPhone/iOS real, validar:
1. eliminar instalación anterior;
2. abrir Staging autenticado;
3. Agregar a pantalla de inicio;
4. confirmar que se ve el isotipo correcto.

Si Work NO dispone de dispositivo iOS real:
- verificar HTML/manifest/assets por navegador;
- dejar **un único residual manual**: Sebastián reinstala una vez y confirma icono;
- no pedir capturas en cadena.

Si falla en iOS real:
- no cambiar asset;
- registrar si Safari parece cachear icono/origen;
- probar limpieza de datos del sitio solo si es necesario;
- documentar reproducción exacta.

## 7. Network/console

Solo en recorridos sensibles:
- Email primer tap vs CTA;
- Eliminación primer tap vs CTA;
- Legal iframe;
- logout.

Confirmar:
- no request Edge al primer tap;
- request aparece recién con CTA;
- sin 5xx;
- sin secretos/OTP en consola.

## 8. Resultado

Guardar:
`docs/BRAMUlab/Implementacion/Pre_Production/99_Resultado_G2_Work_QA_01OCT.md`

Si no puede escribir repo:
`/BRAMUlab/Temporales/BRAMUlab_Resultado_G2_Work_QA_01OCT2026.md`

Debe incluir PASS/FAIL por secciones 1–7, Site URL final, evidencia resumida de frontera de mails, visual mobile/desktop, legal/reaceptación, icono y cualquier residual.

No cerrar Issue #22. Central hace gate final.
