# 97 — Gate Central G2 pre-Work

**Fecha:** 01/10/2026  
**Issue:** #22  
**Entrega Claude:** `3c2834ff6baaa2a3a2954016baddf4de4f939c93`  
**Bundle:** `04.20-h5`  
**Resultado:** **PASS TÉCNICO PRE-WORK**. Issue #22 sigue abierto hasta QA real.

## Revisado

- diff completo contra `c5070ad85f8f0c40ac09e35d1bef7d93edcc08db`;
- navegación Perfil → Configuración;
- limpieza de Mis datos;
- pantallas intermedias Email / Eliminación / Copia / Contacto;
- logout actual vs. todas las sesiones;
- Términos/Privacidad in-app;
- reaceptación legal;
- bundle/cache/service worker/icono;
- tooling de Site URL/redirects;
- regresión de contrato G1;
- deploy Vercel.

## Gate funcional

Central confirmó estáticamente:

1. las filas `Email`, `Eliminar mi cuenta`, `Solicitar copia` y `Contacto` **solo navegan**;
2. únicamente los CTA intermedios invocan `openAccountFlow('email')`, `openAccountFlow('delete')` o `mailto:`;
3. cambio de email conserva el flujo G1 ya cerrado, sin `recovery` ni `updateUser({email})` directo;
4. eliminación conserva `delete_account`;
5. `Cerrar sesión` abre opciones y `Cerrar todas las sesiones` no queda expuesto como fila permanente;
6. Legal usa vista interna con back al origen y sin bottom nav;
7. reaceptación conserva checkbox obligatorio + `accept_legal_version`;
8. Perfil/Mis datos server-backed no cambia de contrato;
9. no hay migraciones/backend nuevos en G2.

Vercel del commit funcional: **SUCCESS**.

## Icono PWA/iOS

Claude validó assets/tamaños/versionado y endureció el caso de Staging protegido:
- `apple-touch-icon` embebido con los mismos bytes del PNG real;
- manifest con credenciales;
- cache `04.20-h5` y purge de caches anteriores.

Safari 26/WebKit soporta data-URL para iconos, pero el criterio de cierre sigue siendo evidencia en dispositivo real. Work debe validar el resultado; si persiste, no rediseñar el asset: diagnosticar cache/instalación/protección.

## Correcciones absorbidas por Central

Sin devolver micro-ronda a Claude:

- se eliminó una asignación duplicada inocua en `openLogoutOptions`;
- el generador/manifest de emails se volvió a alinear con G1: el logo native no usa `{{ .SiteURL }}`; `manifest.json` registra la base pública real y solo declara `{{ .Token }}` cuando corresponde.

No se cambió copy/diseño de los emails.

## Pendiente Work

- QA visual mobile + desktop;
- recorrido real Perfil → Configuración → subpantallas y backs;
- comprobar que el primer tap de Email/Eliminar no manda mail y el CTA sí;
- Legal in-app y reaceptación;
- configurar Site URL/redirects hosted de Auth en Staging;
- validar consola/network solo sobre recorridos de riesgo;
- validar icono PWA/iOS si el entorno permite dispositivo real.

**G2 global todavía NO está cerrado.**
