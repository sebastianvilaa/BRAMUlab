# BRAMUlab V03.4.5 — Microparche responsive final sobre V03.4.4

Pedido directamente en chat (sin archivo adjunto) — transcripto acá tal cual para dejar
registro del alcance de esta ronda, mismo criterio que el resto de `Versiones/`.

Aplicar V03.4.5 como microparche responsive final sobre V03.4.4.

No cambiar lógica ni producto.
Solo corregir los detalles responsive detectados en tablet y un ajuste visual mínimo de CREAR GRUPO.

## 1. MIS GRUPOS — botón CREAR GRUPO

En el selector de grupos:

REEMPLAZAR
`+ CREAR GRUPO`

por
`CREAR GRUPO`

Mantener exactamente el estilo actual del botón outline verde.

No cambiar:
- tamaño;
- color;
- borde;
- padding;
- ubicación;
- jerarquía.

Solo quitar el `+`.

---

## 2. BOTTOM NAV — TABLET

En mobile/celular:
MANTENER exactamente el comportamiento actual.

En tablet / viewport intermedio:
la bottom nav hoy queda demasiado angosta y centrada, como una barra flotante pequeña respecto del resto de la interfaz.

AJUSTAR para que ocupe todo el ancho disponible del viewport/contenedor de la app.

Objetivo:
- que se vea como una barra inferior estructural;
- de punta a punta;
- coherente con el ancho general de la interfaz;
- no como una pastilla flotante angosta.

No agrandar iconos ni textos.

Solo corregir ancho/posición/contenedor responsive.

Verificar especialmente iPad Mini / ancho equivalente.

---

## 3. PERFIL — TABS EN TABLET

En tablet las tabs:

`MI PERFIL / MIS DATOS / JUGADORES`

quedan demasiado agrupadas en el centro.

AJUSTAR únicamente para tablet / viewport intermedio:

- distribuir mejor las tres opciones en el ancho disponible;
- mantener la misma jerarquía visual actual;
- mantener mismo tamaño tipográfico;
- mantener peso;
- mantener sistema de indicador activo;
- no agrandar texto;
- no cambiar mobile.

La mejora debe venir del layout/espaciado, no de escalar la tipografía.

---

## 4. PERFIL — GRÁFICO DE EVOLUCIÓN EN TABLET

Hay un problema responsive claro:
el gráfico gana ancho, pero también se están escalando demasiado los textos/ejes/labels.

CORREGIR:

- permitir que el gráfico gane ancho en tablet;
- NO escalar proporcionalmente tipografías, labels ni valores;
- mantener tamaños de texto cercanos a mobile/desktop actual;
- limitar cualquier regla responsive que esté haciendo crecer labels/ejes demasiado;
- conservar la estructura, datos y lógica del gráfico;
- no modificar fórmula ni contenido.

Objetivo:
más espacio horizontal para la información, no gigantismo tipográfico.

Verificar:
- labels del eje Y;
- labels del eje X;
- valores superiores;
- título;
- badge BETA;
- spacing interno.

---

## 5. NO TOCAR

No modificar:
- Home;
- Historial;
- carga de partidos;
- resumen;
- Mis grupos salvo quitar el `+`;
- lógica de puntos;
- BRAMU Intelligence;
- Perfil mobile;
- Mis Datos;
- ubicación;
- Nivel BRAMU;
- Ranking BRAMU;
- backend.

---

## 6. QA

QA visual:

Mobile:
- confirmar cero regresiones.

Tablet / iPad Mini:
- bottom nav full width;
- tabs de Perfil mejor distribuidas;
- gráfico sin textos gigantes;
- resto de componentes sin cambios inesperados.

Desktop:
- chequeo rápido.

Sin tests nuevos salvo que se toque lógica accidentalmente.
Suite completa una sola vez al cierre.

Implementar directamente.
Informe, commit, tag, push y deploy.
