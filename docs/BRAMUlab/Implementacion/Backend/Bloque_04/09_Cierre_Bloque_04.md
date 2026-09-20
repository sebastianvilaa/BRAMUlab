# Backend Bloque 4 — Cierre

**Fecha de cierre:** 20/09/2026  
**Rama:** `staging`  
**HEAD validado funcionalmente:** `877069c`  
**Estado:** **CERRADO**

## Alcance cerrado

Backend Bloque 4 deja disponible y validado en Staging:

- búsqueda real autenticada de jugadores registrados;
- Perfil público server-backed acotado y sin datos privados/inventados;
- identidades provisionales persistentes;
- creación siempre por UUID, nunca merge automático por nombre;
- listado acotado de provisionales propios;
- links de claim de alta entropía, hash-only server-side, vigencia de 30 días, rotación y un solo uso;
- claim atómico conservando el mismo `player_id`;
- preservación/reasignación de eventos;
- rate limiting real para búsqueda y claim;
- flujo frontend de claim antes de `complete_profile`/Nivel;
- recuperación segura ante fallos transitorios;
- preservación de la intención de claim aun si falla `localStorage`;
- protección deny-by-default de tablas internas.

## Evidencia de cierre

Documento consolidado:

`docs/BRAMUlab/Implementacion/Backend/Bloque_04/08_Validacion_Final_Staging.md`

Resultados principales:

- `verify-bloque2.mjs` → **BLOQUE 2 OK**
- `verify-bloque3.mjs` → **BLOQUE 3 OK**
- `verify-bloque4.mjs` → **BLOQUE 4 OK**
- `verify-claim-token-storage.mjs` → **CLAIM TOKEN STORAGE OK**
- suite local → **1408/1408**
- Buscar jugadores real → **PASS**
- Perfil público server-backed → **PASS**
- transición server-backed → local/mock sin contaminación visual → **PASS**
- username canónico Home/Perfil/Datos → **PASS**
- claim completo real h11 → **PASS**
- segundo uso del link → **PASS**
- signup/refresh/login normal sin claim → **PASS**

## Hotfixes incorporados durante el cierre

1. búsqueda literal: `%%`/`__` ya no enumeran como wildcards;
2. fallos transitorios de claim ya no permiten oficializar la cuenta antes de resolver el claim;
3. los intentos inválidos de claim consumen rate limit;
4. Perfil público server-backed no inventa módulos/estadísticas y restaura correctamente la UI local al navegar después;
5. ACL server-only endurecidas;
6. limpieza del verificador corregida por orden de dependencias;
7. Home usa username canónico real;
8. intención de claim no se pierde ante fallo de `localStorage`.

## Datos de QA

Se conservan deliberadamente en Staging:

- `@claim_mualea_20` — evidencia del fallo previo al hotfix h11;
- `@claimb4h11` — claim exitoso;
- `@normalb4h11` — alta normal sin claim.

No borrar ni reutilizar como datos de producto. Production permanece sin tocar.

## Alcance que continúa después

Bloque 4 cierra identidad/búsqueda/claim. No implementa todavía:

- partidos compartidos;
- participantes de partidos reales usando provisionales;
- historial compartido;
- pendientes/validación;
- recientes derivados de partidos reales;
- JUGADORES server-backed como relación persistente.

Esos puntos pertenecen a Bloque 5+ según `Backend_Infraestructura.md`.

La validación literal de que “el mismo provisional aparece en varios partidos” se realizará al integrar partidos reales en Bloque 5; el contrato de identidad que lo permite ya quedó cerrado en este bloque.

## Estado de ramas/entornos

- `staging`: contiene el bloque cerrado;
- `main`: no tocado;
- Production: no tocada;
- BRAMUlive: no tocada.

**Bloque 4 queda formalmente CERRADO. No iniciar Bloque 5 automáticamente.**
