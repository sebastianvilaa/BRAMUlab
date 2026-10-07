# BRAMUlab — Resultado primer deploy Production · 07/10/2026

## Estado

**DEPLOY TÉCNICO PRODUCTION: READY**
**SMOKE HUMANO FINAL: PENDIENTE**

## Release publicada

Proyecto Vercel:
- `bramulab`
- deployment: `dpl_Nmn2pKLHi4XN8WdBKaGfDhC4Vwd4`
- commit fuente: `b0889fe655a0b56ca54694d3d292eade6bb90cf8`
- rama fuente: `staging`
- target Vercel: `production`
- estado: `READY`
- alias error: ninguno

Aliases Production:
- `https://app.bramulab.com`
- `https://bramulab.vercel.app`
- `https://bramulab-bramu-lab.vercel.app`

## Separación Staging / Production

Al crear el primer deploy dirigido desde `staging`, Vercel asignó temporalmente también el alias automático de la rama Staging al deploy Production.

Se corrigió inmediatamente:
- `bramulab-git-staging-bramu-lab.vercel.app` fue reasignado al último deploy Preview READY;
- Preview deployment: `dpl_5fiM4ZKxJN4KrqbXX6snGoj2tLMV`;
- commit Preview: el mismo commit de producto `b0889fe655a0b56ca54694d3d292eade6bb90cf8`, construido con variables Preview/Staging;
- Production conserva únicamente sus aliases de salida.

`main` no fue movido.
BRAMUlive no fue modificado.

## Legal guard

Antes del deploy:
- responsable público completado como `Vila Sebastian`, exactamente según autorización del titular;
- fecha de vigencia: 07/10/2026;
- domicilio publicable autorizado;
- AAIP informado como trámite presentado, expediente `EX-2026-97673851-APN-DNDPD#AAIP`, pendiente de aprobación/número definitivo;
- infraestructura, proveedores, transferencias internacionales y retención completados con datos reales;
- alta y reaceptación explicitan consentimiento para las transferencias internacionales informadas;
- cero placeholders `[[PENDIENTE_PRODUCCION:*]]` restantes en Términos, Privacidad y Eliminar cuenta.

## Supabase Production post-deploy

Proyecto:
- `bramulab-production`
- ref `bgnnnfbdywefftvoqiss`
- `app_config.environment = production`

Estado de datos tras deploy:
- Auth users: 0
- players: 0
- matches: 0

Edge Functions:
- 12/12 ACTIVE

## Dominio

Vercel confirma:
- `app.bramulab.com` verificado;
- alias Production mapeado al deployment READY;
- sin aliasError.

## Pendiente inmediato

Hacer un smoke humano mínimo sobre `https://app.bramulab.com`:
1. abrir la app sin protección de Vercel;
2. confirmar carga visual normal;
3. confirmar que acceso/crear cuenta aparece;
4. abrir Términos y Privacidad;
5. opcionalmente revisar que el logo de emails ya resuelva desde el dominio público.

No crear todavía datos reales adicionales solo para repetir QA de lógica deportiva ya cerrada, salvo que aparezca una regresión concreta.

## AAIP

El expediente sigue pendiente de aprobación y número definitivo.
Hay seguimiento programado para revisar estado dentro de 5 días.
Cuando exista número definitivo:
- actualizar Política de Privacidad;
- actualizar documentación de salida;
- si corresponde, modificar registro AAIP con cualquier dato que haya cambiado.

## NO TOCAR

- BRAMUlive;
- fast-forward global de `main` a `staging`;
- repo privado hasta autorización separada;
- features nuevas no justificadas.
