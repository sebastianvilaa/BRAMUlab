# Auditoría estructural de Nivel BRAMU y Ranking BRAMU — convergencia y comparabilidad entre grupos

**Fecha:** 7 de octubre de 2026 · **Rama:** `staging` (base `f1ad7d1`, bundle 04.37-h26) · **Alcance:** solo lectura del código; sin cambios funcionales, sin migraciones, sin Supabase, sin deploy.
**Fuentes de autoridad usadas:** `README.md` (mapa documental), `Nivel_BRAMU.md` (única fuente maestra de Nivel), `Ranking_BRAMU.md`, y el código real: `bramulab/level.js`, `level-context.js`, `level-calibration.js`, `match-level-engine.js`, `supabase/functions/_shared/match-officialize-core.ts`, `identity-recovery-core.mjs` y las migraciones SQL de Ranking y calibración. No se tomó nada de Archivo, Backup ni handoffs históricos.
**Simulaciones:** `docs/BRAMUlab/Auditorias/simulaciones/` (reproducibles, aisladas del código operativo; ver §9).

> **Convención de este informe.** Cada afirmación lleva una etiqueta de evidencia:
> **[CÓDIGO]** comprobado leyendo el código/SQL real · **[SIM]** medido en simulación con el algoritmo real, *bajo las hipótesis declaradas en §3* · **[DOC]** surge de la documentación vigente · **[HIPÓTESIS]** razonamiento no comprobado.
> Los números de simulación **no son predicciones sobre jugadores reales**: dependen de supuestos (cuánto se equivocan los cuestionarios por grupo, cuánto juega cada uno, cómo se arman los partidos) que hoy no se pueden medir con datos reales.

---

## 1. Resumen ejecutivo (para quien no programa)

**La pregunta.** BRAMU asigna a cada jugador un Nivel a partir de un cuestionario y lo va ajustando con los partidos. El Ranking ordena a los jugadores por ese Nivel. Si los jugadores de una localidad juegan casi siempre entre sí, ¿pueden llegar a quedar "más arriba" o "más abajo" que los de otra localidad *solo* por cómo respondieron el cuestionario, y no por cómo juegan?

**La respuesta corta: sí, y el motor actual no tiene forma de corregirlo por sí solo.**

Piense en dos clubes. Los socios del club A se creen un punto mejores de lo que son; los del club B se evalúan bien. Dentro de cada club, todos juegan contra todos. Un club entero que se sobrevalora **sigue estando sobrevalorado después de 5, 20 o 50 partidos por jugador**, porque cuando uno gana, otro del mismo club pierde, y el sistema solo mira *quién gana contra quién dentro del grupo*; el promedio del grupo no se mueve. Esto no es un error de programación: es una propiedad matemática de cualquier sistema de niveles basado solo en resultados (el ajedrez y el tenis la comparten). Lo que la resuelve en esos mundos es que los grupos **se mezclen**: que haya jugadores y partidos que crucen de un grupo a otro.

**Lo que midió esta auditoría (con el algoritmo real, sobre jugadores sintéticos):**

* En un grupo cerrado, el sesgo medio se mantiene idéntico entre el partido 0 y el 50 (por ejemplo +0,81 → +0,81). El orden *dentro* del grupo sí mejora, pero lento.
* Cuando los grupos se conectan, la corrección es **muy lenta**: con una cuarta parte de los partidos cruzados entre grupos, a los 100 partidos por jugador se corrigió solo el 27 % de la diferencia, y a los 200, el 48 %. Con un solo jugador-puente, el 12 % a los 200.
* En un Ranking provincial con 6 localidades, si cada localidad tuviera un sesgo típico de ±0,6 (hipótesis), **la localidad más sobrevalorada aportaría ~37 % del top-10 provincial cuando por capacidad real le corresponde ~17 %**, y los cruces mal ordenados entre localidades pasarían de ~1 % a ~5 %. El orden *dentro de cada localidad* no se ve afectado.
* Un jugador "honesto" que entra a un grupo sobrevalorado se contagia: tras 30 partidos ya quedó 0,29 puntos por encima de su capacidad real (≈ 40 % del desfasaje del grupo) y tras 100, 0,45 (≈ 65 %).

**Lo que funciona bien:** el motor reproduce exactamente las cifras de su propia documentación; no se infla ni se deprime solo (el promedio de un grupo cerrado no deriva); las desviaciones individuales sí se corrigen en la dirección correcta; el orden interno de cada localidad es confiable; el Ranking semanal congela datos y es auditable.

**Un hallazgo técnico concreto.** La regla de "círculo competitivo cerrado" (`Nivel_BRAMU.md` §7.7, que reduce a 0,45 el peso de partidos de grupos cerrados de hasta 12 personas) **no se activa en el flujo real del servidor**, salvo si cuatro personas exactas juegan siempre entre sí. [CÓDIGO + SIM]. En las simulaciones, aun si se activara tal como está escrita, **no cambia el resultado estructural**: el sesgo compartido igual se conserva. Es una discrepancia entre lo que dice el documento y lo que hace el sistema, que conviene registrar, pero no es la causa del problema ni urge.

**Veredicto general: MIXTO.** El motor es sano como estimador *relativo*, pero el Nivel **no es una medida absoluta comparable entre grupos no conectados**, y el Ranking provincial/nacional hereda esa limitación. Hoy (primeros usuarios reales, poblaciones chicas) el riesgo práctico es **bajo**; crece cuando haya varias localidades con densidad suficiente que no se crucen entre sí.

**¿Hay que intervenir ahora?** No en el algoritmo. Sí conviene (a) registrar la discrepancia del círculo, (b) definir qué evidencia real se va a recolectar para medir si los grupos de verdad tienen desfasajes (hoy no hay manera de saberlo), y (c) decidir qué se le promete al usuario sobre la comparabilidad de rankings provinciales/nacionales. Detalle en §7 y §8.

---

## 2. Funcionamiento real encontrado

### 2.1 Nivel inicial (cuestionario `nivel_inicial_v1_3`) — [DOC + CÓDIGO]

* 5 preguntas adaptativas (panorama común; ritmo, ataque, defensa y decisiones con rama baja/media/alta según la media acumulada: <4,1 / <6,4 / ≥6,4). Cada respuesta es una de 10 posiciones; el resultado es el promedio de 5 valores interpolados sobre anclas fijas (`level-calibration.js:218–302`).
* No hay autoetiqueta, ni años jugando, ni categoría, ni género: es lo que V1.3 resolvió a propósito (`Nivel_BRAMU.md` §5.6).
* Confianza de origen: 0,15 si las 5 respuestas son coherentes (dispersión <2,0), 0,10 si no.
* **Rango alcanzable:** aprox. 1,56 a 8,48 (la pregunta 1 va de 1,8 a 7,2 y las otras de 1,5 a 8,8). Medido con un respondiente que percibe exactamente su nivel: devuelve valores cercanos (5,5→5,59; 6,5→6,21; 7→7,04), pero se **comprime arriba** (percepción 8,5 → 8,0; 9 → 8,48) [SIM].
* El cuestionario mide *lo que la persona dice de su juego*; no tiene ninguna referencia externa a su grupo. Es el **único ancla absoluta** del sistema.

### 2.2 Motor de partidos (`nivel_bramu_v1_0`) — [CÓDIGO]

* Estilo Elo con incertidumbre: `mu_efectivo = 5 + confianza·(mu − 5)`; fuerza de pareja = promedio; expectativa `1/(1+10^(−Δ/1,5))` (`level.js:151–173`).
* Variación individual: `K = 0,10 + 0,30·(1 − confianza)`, multiplicada por (resultado − expectativa), margen (0,90–1,15), formato, repetición, compañero, círculo, disponibilidad y `factor_oponente`; **tope ±0,50** en CALIBRANDO y **±0,35** en CALIBRADO (`level.js:270–285`).
* Confianza: crece con la "calidad de evidencia" del partido hasta un techo de 0,95 (`level.js:312–316`). En la simulación (rivales que también están calibrando, con algo de repetición): 5 partidos ≈ 0,5; 10 ≈ 0,72; 20 ≈ 0,89; 30 ≈ 0,93 [SIM]. Es más lento que la tabla ideal del documento (63 %/82 %/90 % a 5/10/15 partidos, que supone rivales confiables y diversos) porque el peso de cada partido incluye la confianza del rival y la repetición. A confianza alta, **K ≈ 0,115–0,12**: cada partido mueve poco.
* Inactividad: la confianza efectiva decae tras 60 días sin jugar, el Nivel no baja (`match-level-engine.js:105`).
* Diferencia neta para correcciones, ventana de 30 días entre `played_at` y validación, invitados con imputación neutral y `disponibilidad` (1,00/0,80/0,60).

### 2.3 Lo que el sistema ya contempla sobre redes cerradas — [DOC + CÓDIGO]

| Mecanismo | Qué hace | Ubicación |
|---|---|---|
| Factor de repetición | `max(0,45; 1 − 0,10·n_pareja − 0,025·(n_r1+n_r2))`, ventana 180 días | `level.js:208`, `level-context.js:360` |
| Factor de compañero | `max(0,60; 1 − 0,05·n_compañero)` | `level.js:216` |
| Círculo cerrado | 0,45 si el jugador está CALIBRADO, tiene ≥20 partidos en 180 días, ≥80 % concentrados en ≤11 coparticipantes, amplitud de Nivel ≤1,5, partido dentro del círculo y rival no superior por ≥0,75 | `level-context.js:420–502` |
| Peso por confianza del rival | `0,55 + 0,45·confianza_rival` | `level.js:250` |
| Límite de calibración | CALIBRADO = ≥5 partidos computables **y** ≥3 rivales distintos | SQL `20260927140000…:346–362` |
| Límite conocido | "los resultados internos identifican diferencias relativas, no el desplazamiento absoluto de un grupo; limitación estructural conocida" | `Nivel_BRAMU.md` §15.1 |

### 2.4 Ranking — [DOC + CÓDIGO]

* Orden por **Nivel interno consolidado** descendente, `rank()` por ámbito (localidad, provincia, país, global) y rama competitiva; empates comparten puesto (`20260924100000_bloque7_fase6…sql:252–301`).
* Elegible si: CALIBRADO (o RECALIBRANDO con consolidado), ubicación y rama definidas, perfil público, actividad ≤180 días, sin exclusión (`…sql:189–195`).
* Densidad: 0–4 elegibles no hay posiciones; 5–14 "en formación"; 15+ "establecido" (`Ranking_BRAMU.md` §10).
* **El Ranking no usa la confianza ni la incertidumbre del Nivel para ordenar ni para filtrar** (más allá de CALIBRADO), y **no tiene ningún ajuste ni advertencia sobre comparabilidad entre territorios**; `Ranking_BRAMU.md` no menciona la limitación que `Nivel_BRAMU.md` §15.1 sí reconoce.

### 2.5 Discrepancia confirmada: la regla de círculo cerrado no se alimenta como el documento supone — [CÓDIGO]

`computeClosedCircleContext` (`level-context.js:420`) mira, para cada partido previo del jugador, a su compañero y a sus dos rivales, y **descarta de la concentración** ("nunca concentrado") todo partido donde alguno de esos tres no figure en el diccionario `playerStates` (`:439–440`). El diccionario lo arma el servidor en `match-officialize-core.ts:182–185` y `:257–292` **solo con los 4 participantes del partido actual**; `identity-recovery-core.mjs:151` hace lo mismo con un solo jugador. Consecuencia: un partido previo cuenta únicamente si compañero y rivales son *exactamente* los otros tres jugadores del partido actual. Los tests que cubren la regla (`bramulab/tests.html:6142–6180`) pasan un diccionario con **todo el grupo habitual** (`habitualStates`), no el que arma el servidor, por eso la regla "pasa los tests" y no se activa en producción.

Además, aun con el diccionario completo, la regla exige **amplitud de Nivel ≤1,5 dentro del grupo**; en grupos con dispersión realista se incumple casi siempre (ver §4.7). Se detalla en §4.

---

## 3. Escenarios ensayados y metodología

### 3.1 Qué es real y qué es hipótesis

| Pieza | Naturaleza |
|---|---|
| Cuestionario inicial (`computeInitialEstimateV13`), elegibilidad, repetición, compañero, círculo, motor de partido, diferencia neta aplicada a `level_states`, inactividad | **Código real** importado sin copiar (`vm` aislado, solo lectura de `bramulab/`) |
| Regla CALIBRANDO→CALIBRADO (≥5 partidos y ≥3 rivales distintos) | Réplica de la SQL |
| Capacidad deportiva **θ** de cada jugador | **Hipótesis del experimento** (se asume en la misma escala 1–10 que el Nivel) |
| Cómo responde el cuestionario: percepción = θ + β_grupo + ε (σ=0,5) y ruido por pregunta (σ=0,8) → posición del slider más cercana, respetando la adaptatividad real | **Modelo simplificado** |
| Resultados: juego a juego, `P(juego)=1/(1+10^(−Δθ/s))`, set a 6 con 7-5/7-6, mejor de 3. `s` se calibra para que una diferencia de 1,0 dé 82,2 % de ganar el partido (**la misma que supone el motor**: hipótesis favorable al motor) | **Modelo simplificado** |
| Ritmo: 1 partido por jugador por semana; los cuartetos salen de barajas sucesivas, parejas al azar | **Modelo simplificado** |

Tres modos de orquestación: **`real`** (`playerStates` con los 4 participantes, como el servidor), **`fullDict`** (contrafactual con todos los jugadores) y **`noCircle`** (detección de círculo desactivada en memoria; ningún archivo se modifica). Semillas fijas; 30 réplicas por celda (15 en los escenarios nacionales). Las tablas muestran la media; el desvío entre réplicas está en `resultados/resumen.md`.

### 3.2 Validación del simulador

Con confiabilidad 0,79 (el Anexo B no la declara; con ese valor se reproducen sus cifras) el simulador devuelve exactamente lo documentado [SIM]:

| Caso (Anexo B) | Documento | Simulador |
|---|---|---|
| 5,0 vs 5,0, 6-4 6-4 | P=50 %, +0,08 | 50 %, **+0,079** |
| 5,0 vence a 6,0 | 23 %, +0,12 | 23 %, **+0,121** |
| 6,0 vence a 5,0 | 77 %, +0,04 | 77 %, **+0,036** |
| 4,5 vence a 6,5 | 8 %, +0,14 | 8 %, **+0,144** |

También se validó la sonda de círculo: con un cuarteto fijo que ya está CALIBRADO la regla *sí* se activa (80 de 160 evaluaciones tras los primeros 20 partidos), de modo que el 0 observado en grupos rotativos no es un defecto de la sonda.

### 3.3 Escenarios

| ID | Qué estudia | Configuración principal |
|---|---|---|
| **A** | Misma capacidad, cuestionarios sistemáticamente distintos | 2 grupos de 16, θ~N(5,5; 0,9); G2 declara +0,5/+1,0/+1,5; cerrados hasta 50 partidos/jugador |
| **B** | Distinta capacidad, cuestionarios que igualan niveles | G1 θ≈4,5 declara +1,0; G2 θ≈6,5 declara −1,0 (y variante de brecha 1,0, y control sin sesgo) |
| **C** | Tamaño del círculo y partidos por jugador (5/10/20/30/50) | un grupo cerrado de 5, 8, 12, 16, 24 y 48; sesgo +1,0 y control 0; sensibilidades: ritmo ×2, escala real del partido, círculo activo/inactivo |
| **C2** | ¿Importa el factor de círculo si puede activarse? | grupos de 8 y 12, θ homogéneo (σ=0,45) y heterogéneo |
| **D** | Grupos aislados que empiezan a conectarse | A y B de 16; 30 partidos internos y luego 1, 2, 4 u 8 puentes, o 2/5/10/25 % de partidos mezclados, hasta +200 partidos/jugador |
| **E** | Desvíos individuales sin sesgo compartido | grupos de 6 a 96, cada persona con su propio error |
| **G** | Ingresantes a un grupo veterano | 12 veteranos con 30 partidos; 4 ingresantes honestos a un grupo sesgado y viceversa |
| **H** | Subgrupo que sobre/subdeclara dentro de un grupo abierto | n=12/24/48; 1, 3, 6 o 12 declarantes con ±1,5 |
| **F** | Posiciones de Ranking al reunir localidades | provincia = 6 localidades de 24; nación = 20 localidades de 12; β_loc~N(0,σ) con σ ∈ {0; 0,3; 0,6; 1,0}; islas o 2 %/10 % de partidos mezclados |

---

## 4. Resultados

Convenciones: *sesgo* = Nivel medio − capacidad media del grupo (en puntos de Nivel). *Error de orden* = desvío cuadrático medio de las posiciones relativas dentro del grupo. m = partidos por jugador.

### 4.1 Un sesgo compartido en un grupo cerrado no se corrige (A, C) — [SIM]

Dos grupos de 16 con la misma capacidad real; G2 declara +1,0 más alto (el cuestionario transmite ≈ 85 % de ese desfasaje: +0,81 de Nivel inicial):

| m | Brecha de Nivel medio G2−G1 | Error de orden dentro de G1 | Spearman dentro de G1 | % CALIBRADOS |
|---:|---:|---:|---:|---:|
| 0 | 0,81 | 0,56 | 0,78 | 0 % |
| 5 | 0,81 | 0,57 | 0,80 | 100 % |
| 10 | 0,81 | 0,56 | 0,81 | 100 % |
| 20 | 0,81 | 0,51 | 0,84 | 100 % |
| 30 | 0,81 | 0,46 | 0,86 | 100 % |
| 50 | 0,81 | 0,40 | 0,89 | 100 % |

La brecha de Nivel (0,81 ± 0,33 entre réplicas) es **idéntica al segundo decimal en todos los puntos**; la capacidad real de ambos grupos es la misma. Con +0,5 y +1,5 el comportamiento es el mismo (brecha 0,35 y 1,24, constantes). **El tamaño del grupo (5 a 48), el ritmo (1 o 2 partidos por semana), la escala real de los resultados (que una diferencia de 1,0 gane 70 % o 92 %) y la presencia o ausencia de la regla de círculo no alteran esto** (sesgo @50 igual a @0 en todas las variantes de C). Solo cambian el error de orden y la dispersión.

Control sin sesgo: el promedio tampoco deriva (entre −0,01 y −0,10 de sesgo según tamaño, idéntico de m=0 a m=50) → **no hay inflación ni deflación de un grupo cerrado**.

**Por qué ocurre [CÓDIGO]:** si ganan A y B de la pareja ganadora y pierden C y D, las subidas y bajadas se compensan (misma `K`, misma expectativa complementaria, mismos factores); el promedio del grupo es una constante del sistema. Solo se rompe si hay recortes de escala (1,0/10,0), topes de delta o jugadores con confiabilidades muy distintas.

### 4.2 Grupos de capacidad distinta que se declaran igual quedan fusionados (B) — [SIM]

G1 (θ≈4,5, declara +1,0) y G2 (θ≈6,5, declara −1,0). Brecha real: 1,96 puntos.

| m | Brecha de Nivel (mu2−mu1) | P(un jugador de G1 supera a uno de G2): observada | verdadera | Cuartil superior del Ranking conjunto que viene de G1: observado | verdadero |
|---:|---:|---:|---:|---:|---:|
| 0 | −0,10 | 52 % | 5 % | 51 % | 3 % |
| 10 | −0,10 | 53 % | 5 % | 55 % | 3 % |
| 30 | −0,10 | 52 % | 5 % | 51 % | 3 % |
| 50 | −0,10 | 52 % | 5 % | 51 % | 3 % |

En un Ranking que reúna ambos grupos, el grupo más débil ocuparía la mitad del cuartil superior (debería ocupar ~3 %). El control (misma realidad, sin sesgo de cuestionario) da 4–7 %, es decir, la distorsión es del cuestionario/aislamiento y no del motor. Con brecha real de 1,0 el efecto es proporcional (observado ≈ 52 % vs 15 % verdadero).

### 4.3 Conexión entre grupos (D) — [SIM]

Brecha de sesgo G2−G1 (≈0,88 al terminar los 30 partidos internos); porcentaje corregido a +100 y +200 partidos por jugador:

| Conexión | +50 | +100 | +200 | % corregido a +100 | a +200 |
|---|---:|---:|---:|---:|---:|
| Sin conexión (control) | 0,88 | 0,89 | 0,89 | −1 % | −1 % |
| 1 jugador-puente | 0,86 | 0,83 | 0,78 | 7 % | 12 % |
| 2 puentes | 0,84 | 0,79 | 0,69 | 12 % | 22 % |
| 4 puentes | 0,79 | 0,71 | 0,57 | 20 % | 35 % |
| 8 puentes (la mitad de un grupo) | 0,75 | 0,64 | 0,42 | 25 % | 51 % |
| 2 % de partidos mezclados | 0,87 | 0,85 | 0,84 | 3 % | 5 % |
| 5 % | 0,86 | 0,83 | 0,79 | 6 % | 11 % |
| 10 % | 0,83 | 0,78 | 0,67 | 12 % | 24 % |
| 25 % | 0,75 | 0,64 | 0,46 | 27 % | 48 % |

Observaciones: (i) la corrección es **real pero lenta**: las conexiones reparten el desfasaje, no lo eliminan (con 8 puentes a +200, G1 sube de −0,08 a +0,09 mientras G2 baja de 0,78 a 0,51: **el grupo bien calibrado absorbe parte del sesgo ajeno**). (ii) Los jugadores-puente quedan en medio (sesgo +0,24 a +0,33 a los +200). (iii) Con círculo activo, inactivo o con diccionario completo, el resultado es el mismo (filas "mezcla 10 %": 12 %/24 % en los tres modos), porque los partidos cruzados quedan fuera del círculo.

**Motivo [CÓDIGO]:** los veteranos tienen confianza ≈0,93–0,95 → `K ≈ 0,115–0,12`; un partido cruzado típico los mueve ~0,01–0,02. Corregir 1,0 punto exige decenas de partidos *cruzados* por jugador, no decenas de partidos en total.

### 4.4 Ingresantes (G) — [SIM]

Sesgo medio de 4 ingresantes que entran a 12 veteranos (con 30 partidos) y juegan con todos:

| m (del ingresante) | Veteranos con +1,0; ingresantes honestos | Veteranos honestos; ingresantes con +1,0 |
|---:|---:|---:|
| 0 | −0,03 | 0,86 |
| 10 | 0,19 | 0,81 |
| 30 | 0,29 | 0,66 |
| 50 | 0,35 | 0,55 |
| 100 | 0,45 | 0,37 |

La escala de los veteranos funciona como el "patrón": un ingresante honesto en un grupo sobrevalorado se **contagia** (queda +0,29 sobre su capacidad a los 30 partidos, ≈ 40 % del desfasaje de los veteranos, y +0,45 a los 100, ≈ 65 %), y uno sobredeclarante en un grupo bien anclado se corrige lento (36 % corregido a los 50 partidos y 57 % a los 100). Esto es coherente con que el sistema "ancla" a los jugadores nuevos a la escala del conjunto de veteranos con los que juegan.

### 4.5 Desvíos individuales y velocidad de corrección (E, H) — [SIM]

**Error de orden relativo dentro de un grupo** (desvíos individuales de σ=0,9, sin sesgo compartido):

| Tamaño del círculo | @0 | @5 | @10 | @20 | @30 | @50 | Spearman @0 → @50 |
|---:|---:|---:|---:|---:|---:|---:|---|
| 6 | 0,86 | 0,84 | 0,81 | 0,73 | 0,70 | 0,64 | 0,60 → 0,80 |
| 12 | 0,95 | 0,91 | 0,85 | 0,76 | 0,70 | 0,62 | 0,65 → 0,83 |
| 24 | 1,00 | 0,97 | 0,92 | 0,82 | 0,75 | 0,63 | 0,62 → 0,84 |
| 48 | 1,03 | 1,00 | 0,93 | 0,84 | 0,75 | 0,62 | 0,62 → 0,85 |
| 96 | 1,01 | 0,98 | 0,92 | 0,82 | 0,75 | 0,61 | 0,66 → 0,87 |

* **A los 5 partidos —cuando el jugador pasa a CALIBRADO y entra al Ranking— el error casi no se corrigió** (≈ 3 %: 1,00 → 0,97). A los 50 partidos se corrigió ≈ 37 %.
* **La diversidad de rivales casi no cambia la velocidad** de corrección relativa a partir de ~8–12 personas (0,62–0,64 a los 50 partidos en grupos de 12 a 96). Lo que manda es la cantidad de partidos, no el tamaño de la red; la diversidad solo importa para el desfasaje *absoluto* (§4.3).
* Un sobredeclarante aislado (+1,5) en un grupo abierto de 24 honestos (H): sesgo 1,29 → 1,00 (m=20) → 0,70 (m=50) → 0,43 (m=100). **≈ 46 % corregido a los 50 partidos, ≈ 67 % a los 100.** Si el subgrupo es grande (12 de 24), a 100 partidos queda 0,80 y el resto del grupo sube +0,42: el motor reparte el desvío entre quienes lo cargan y quienes los enfrentan.

### 4.6 Ranking con varias localidades (F) — [SIM]

Provincia de 6 localidades de 24 jugadores (144 CALIBRADOS), idéntica capacidad real en todas; cada localidad con un sesgo compartido β~N(0,σ). Resultados a **30 partidos por jugador**, islas (sin partidos entre localidades):

| σ de sesgo entre localidades | Spearman Ranking vs capacidad | Aciertos del top-10 | Pares entre localidades con ≥1,0 de diferencia real mal ordenados | Top-10 aportado por la localidad más sobrevalorada (justo: 17 %) | Peor puesto *real* dentro del top-10 provincial | Spearman *dentro* de cada localidad |
|---:|---:|---:|---:|---:|---:|---:|
| 0 (sin sesgo) | 0,90 | 68 % | 1 % | 15 % | 28 de 144 | 0,88 |
| 0,3 | 0,88 | 63 % | 2 % | 26 % | 33 | 0,88 |
| 0,6 | 0,83 | 57 % | 5 % | **37 %** | 39 | 0,88 |
| 1,0 | 0,74 | 48 % | 10 % | **49 %** | 49 | 0,88 |

* El orden *dentro de cada localidad* no depende de σ (0,88). Lo que se distorsiona es la **comparación entre localidades**.
* Una pequeña conexión (2 % o 10 % de partidos mezclados) **no mejora** los números a 30 partidos (σ=0,6: 0,83/57 %/4 %/37 %); a 50 mejora apenas (10 %: 0,86 y 35 %).
* Nación de 20 localidades de 12 (σ=0,6, islas, 30 partidos): Spearman 0,82; la localidad más sobrevalorada aporta 16 % del top-20 (justo: 5 %); un jugador del top-20 llega a tener puesto real 82 de 240. Con σ=0,3: 9 % y puesto real 64.

**Lo que esto responde:** una distorsión considerable del Ranking supralocal puede producirse **sin ningún error técnico**, por sesgo de cuestionario compartido + aislamiento. El tamaño del efecto depende de σ, que hoy es **desconocido** (DECISIÓN ABIERTA D-4): con σ=0,3 es moderado; con σ≥0,6 es visible a simple vista en el top.

### 4.7 Factores que reducen el peso de círculos poco conectados — [SIM + CÓDIGO]

**Repetición y compañero** (peso medio efectivo del partido, ventana de 180 días, 1 partido/semana):

| Tamaño | repetición a 6–10 | a 21–30 | a 31–50 | compañero a 31–50 |
|---:|---:|---:|---:|---:|
| 5 | 0,62 | 0,45 | 0,45 | 0,70 |
| 8 | 0,81 | 0,50 | 0,48 | 0,82 |
| 12 | 0,89 | 0,66 | 0,64 | 0,89 |
| 24 | 0,95 | 0,84 | 0,83 | 0,94 |
| 48 | 0,97 | 0,92 | 0,92 | 0,97 |

Operan como un amortiguador que **crece al achicarse el círculo** (en grupos de 5–8 llega al piso de 0,45). Cumplen su objetivo —frenar el "farming" y la sobreconfianza por jugar siempre contra los mismos—, pero **no corrigen el sesgo**: solo enlentecen *todo* (el ruido y también la corrección posterior). Menos peso en el interior de un círculo no equivale a anclar ese círculo al resto del mundo.

**Círculo competitivo cerrado (§7.7).** [CÓDIGO + SIM]
* Flujo real: **0 evaluaciones con factor 0,45 en 480 (grupo de 12, 40 partidos/jugador) y 0 en 320 (grupo de 8)**. Solo se activa con el mismo cuarteto repetido (80/160).
* Con diccionario completo (lo que el documento supone): 32/480 (7 %) en grupo de 12 y 60/320 (19 %) en grupo de 8 **solo si el grupo es homogéneo**; con dispersión realista (σθ=0,9) baja a ≈ 0,2 %, porque la amplitud de Nivel del grupo supera 1,5. Los grupos de más de 12 nunca lo activan (0/960).
* **Efecto sobre el resultado estructural: nulo** (C2): en grupos de 8 y 12 con círculo activo (12–18 % de las evaluaciones), sesgo @80 = 0,85/0,86 igual al de «sin círculo», y error de orden 0,45/0,39 vs 0,44/0,39.

Conclusión: **los factores reducen la velocidad con la que un círculo se auto-confirma, pero ninguno de los tres (repetición, compañero, círculo) puede detectar ni corregir un desfasaje compartido**, por construcción: todos miran la estructura de los partidos, y el sesgo no está en la estructura sino en el punto de partida.

### 4.8 Sensibilidad de los resultados a las hipótesis — [SIM]

* **Escala real de resultados.** Si en la realidad una diferencia de 1,0 gana el 70 % (más parejo) o el 92 % (más determinista) en lugar de 82 %, el sesgo compartido se conserva igual (0,86 @0 y @50 en ambos casos); cambia la dispersión del Nivel respecto de la real (σμ/σθ = 0,99 y 1,34 vs 1,19). *El tamaño de la escala depende del divisor 1,5, parámetro que el documento reconoce como no validado con datos reales (§15.2).*
* **Ritmo de juego.** 2 partidos/semana no cambia la conservación del sesgo (0,87 @0 y @50); acelera el reloj, no la información.
* **Dispersión de los grupos y tamaño**: ver §4.1 y §4.7.

---

## 5. Limitaciones de los experimentos

1. **Todo lo "verdadero" es hipótesis**: θ en la misma escala que el Nivel; el cuestionario se modela como `θ + β + ε`. No se sabe cuánto se equivocan en la realidad los grupos de BRAMU ni si el error tiene componente compartida (σ_loc). Esta es la incógnita central.
2. El generador de resultados es un modelo logístico por juego; no incluye parejas con roles (drive/revés), cansancio, rachas ni resultados "raros". Escala igual a la del motor: favorable al motor. Se ensayaron 70 % y 92 % solo en el escenario C.
3. **La capacidad θ es constante.** En la realidad los jugadores mejoran o empeoran, lo que genera deriva que sí mueve la media del grupo (no se modeló).
4. Los cuartetos se arman **al azar**; en la realidad la gente busca parejas parejas o se agrupa por horario. No se estudió el efecto del emparejamiento selectivo ni de la rotación de socios.
5. **Un solo ritmo base** (1/semana) y poblaciones fijas: sin altas y bajas continuas, sin inactividad, sin invitados, sin correcciones ni anulaciones, sin recuperación de identidad.
6. **Ranking simplificado:** solo orden de CALIBRADOS por Nivel; no se simularon densidad mínima, filtros por rama, bandas de Nivel, ventana semanal de corte ni cambios de ubicación.
7. Variantes `fullDict` y `noCircle` son **contrafactuales de laboratorio**, no versiones del producto.
8. 30 réplicas por celda (15 nacionales): suficiente para las tendencias, no para efectos finos (<0,05). Los desvíos están en `resumen.md`.
9. **No se consultaron datos reales** (Staging/Production prohibidos). No se sabe cuántas localidades ni qué densidad tiene hoy la base real.
10. Las cifras de la tabla del §4.6 son *ilustrativas*: dependen de σ_loc, que no se conoce.

---

## 6. Problemas confirmados, riesgos potenciales y aspectos que funcionan

### 6.1 Problemas confirmados

| # | Hallazgo | Evidencia | Gravedad hoy |
|---|---|---|---|
| **P1** | **El Nivel es una escala relativa al grupo que juega junto**: un desfasaje compartido de cuestionario no puede ser corregido por partidos dentro del grupo (promedio conservado) y se corrige muy lentamente cuando hay cruces. | [SIM + CÓDIGO], límite matemático | Media; crece con la población |
| **P2** | **La regla de círculo cerrado (§7.7) no se activa en el flujo del servidor** (diccionario `playerStates` con 4 participantes) salvo con el mismo cuarteto; los tests la validan con un diccionario distinto del real. Además la condición «amplitud ≤1,5» la deja inoperante en grupos heterogéneos. | [CÓDIGO + SIM] | Baja en impacto (no cambia el desfasaje), media en trazabilidad: **doc ≠ comportamiento** |
| **P3** | **CALIBRADO ocurre a los 5 partidos**, con confiabilidad ≈0,5, y alcanza para entrar al Ranking (si hay ubicación y rama): en ese punto el Nivel es casi el del cuestionario (error corregido ≈3 %). | [SIM + CÓDIGO SQL] | Baja a media |
| **P4** | **`Ranking_BRAMU.md` no documenta** la limitación de comparabilidad entre territorios que `Nivel_BRAMU.md` §15.1 sí reconoce, ni el Ranking aplica ninguna salvaguarda (ni confianza mínima ni conectividad). | [DOC + CÓDIGO] | Media (expectativa del usuario) |

### 6.2 Riesgos potenciales (no confirmados con datos reales)

* **R1.** Que existan sesgos compartidos por localidad/club de magnitud ≥0,3–0,6 (depende de cómo se expresen las respuestas del cuestionario en cada comunidad). El §5.6 de `Nivel_BRAMU.md` justifica V1.3 precisamente por la sospecha de efectos de entorno; pero V1.3 no se ha podido contrastar con datos de varios grupos.
* **R2.** Que el contagio de ingresantes (§4.4) consolide escalas locales: la primera cohorte de cada comunidad "fija" su zero; las siguientes se adaptan.
* **R3.** Que la gamificación del Ranking (posiciones) magnifique diferencias que son de escala y no de juego (percepción de injusticia entre localidades).
* **R4.** La compresión del cuestionario arriba (percepción 8,5 → 8,0) limita a los jugadores muy fuertes a empezar abajo de su nivel; el motor los sube lento (K bajo cuando confían en sus rivales). [HIPÓTESIS sobre la magnitud real.]
* **R5.** Parámetros sin validar con datos reales (divisor 1,5, curva de confianza, K), como ya declara el documento (§15.2).

### 6.3 Aspectos que funcionan correctamente

* El motor **reproduce al milímetro** el Anexo B (§3.2) y no inventa deriva: el promedio de un grupo cerrado no sube ni baja (inflación/deflación nulas).
* **Las desviaciones individuales se corrigen en el sentido correcto** y el orden relativo dentro de un grupo mejora de forma sostenida (Spearman 0,78 → 0,89 en 50 partidos en A).
* **El orden dentro de cada localidad es robusto** frente al sesgo (0,88 con σ=0 y σ=1,0).
* Los pasos están acotados (±0,50/±0,35 por partido); no hay saltos grandes por un partido solo.
* Los factores de repetición y compañero cumplen su propósito antifarming (llegan al piso 0,45 en grupos de 5–8).
* El Ranking congela snapshots semanales, es auditable, ordena por Nivel interno exacto (sin puntos propios que dupliquen la lógica) y diferencia ámbitos y ramas.
* El cuestionario V1.3 es sustancialmente fiel cuando la percepción es correcta (error ≤0,3 entre 1,5 y 7,5).

---

## 7. Opciones conceptuales de mejora (ordenadas por impacto; **no implementadas**)

> Todas requerirían, según `Nivel_BRAMU.md`, una versión nueva del algoritmo o del cuestionario y decisión de producto. Aquí solo se describen y se estima su efecto esperado según lo medido.

1. **Medir antes de corregir (impacto: máximo, riesgo: ninguno).** Definir qué evidencia real se va a recolectar para estimar si existen desfasajes entre grupos: por ejemplo, resultado observado vs esperado agrupado por *par de localidades/clubes* en los partidos que ya cruzan fronteras, y distribución de Nivel inicial por localidad. Sin esa medición no se puede saber si σ_loc es 0,1 o 1,0 y, por tanto, si el problema es relevante.
2. **Palanca de producto: fomentar partidos que crucen grupos** (torneos o eventos abiertos, "partidos puente", invitaciones cruzadas). §4.3 muestra que esa es la única forma de anclar; con 8 puentes o 25 % de cruces la corrección llega al ~50 % en 200 partidos. No toca el algoritmo.
3. **Política de comparabilidad del Ranking supralocal.** Decidir (producto) qué se promete en Ranking provincial/país/global mientras las localidades estén desconectadas: aclarar la limitación en la ayuda ("Cómo funciona"), mostrar un indicador de conectividad o publicar rankings supralocales solo cuando exista un mínimo de partidos cruzados entre las comunidades que se comparan.
4. **Elegibilidad por confiabilidad.** Exigir banda de confianza mayor (p. ej. ≥0,75, que en la simulación se alcanza a ~11–13 partidos) para ocupar posición oficial en ámbitos supralocales, manteniendo CALIBRADO como umbral para lo local. Atenúa P3 sin tocar la fórmula.
5. **Ponderar más los partidos cruzados.** Un piso de `K` mayor (o un bonus de diversidad) para partidos donde el rival es externo al círculo habitual del jugador, que hoy valen lo mismo que uno interno pero mueven muy poco a veteranos. Acelera §4.3; riesgo: más volatilidad y posibles incentivos (requiere simulación específica y versión nueva).
6. **Estimación jerárquica del desfasaje por grupo** (efecto de grupo estimado con los partidos cruzados y aplicado como corrección a todo el grupo, estilo modelos con "componentes conectadas"). Es la solución de fondo al problema de identificabilidad; también la más compleja y la que más cambia el modelo mental del producto.
7. **Alinear código y documento sobre el círculo cerrado.** O se construye `playerStates` con el grupo habitual como asume §7.7 (y se revisa si el umbral de amplitud 1,5 tiene sentido con dispersión realista), o se actualiza el documento para describir lo que hace hoy el sistema. Impacto bajo en resultados (§4.7), valor alto en coherencia.
8. **Cuestionario:** no se recomienda tocar V1.3 con esta evidencia (recién cerrado, sin datos reales que lo contradigan). Pendiente de la validación retrospectiva que ya prevé §15.2.

---

## 8. Recomendación: ¿intervenir ahora o esperar evidencia real?

**Esperar evidencia real; no modificar el algoritmo ni los parámetros ahora.** Razones:

* El problema es estructural pero **su magnitud depende de un parámetro que no se conoce** (cuánto se desfasa cada comunidad). Con σ_loc pequeño, el efecto es moderado; con σ_loc grande, visible. Cambiar el motor sin esa medición sería optimizar a ciegas, y cualquier cambio exige versión nueva.
* La población actual es de primeros usuarios; los rankings relevantes hoy son **locales**, donde el orden es confiable. La distorsión aparece cuando existan **varias localidades con ≥5–15 elegibles cada una y sin cruces** compartiendo ranking provincial o nacional.
* No hay ningún riesgo que amerite atención inmediata (ver abajo).

**Acciones de bajo costo y sin riesgo para ahora (decisión de Central):**
1. Registrar la discrepancia P2 (doc vs. flujo real del círculo) como pendiente documental/técnico, sin tocar código aún.
2. Acordar el plan de medición del punto 1 de §7 y los **disparadores** para reabrir esta auditoría: p. ej., primera provincia con ≥2 localidades con ≥15 elegibles; primeros partidos cruzados entre comunidades; o primera queja de "injusticia" entre localidades.
3. Decidir cómo se comunica la comparabilidad de los rankings supralocales (§7, punto 3) antes de que esos ámbitos tengan densidad.

**Riesgos relevantes hoy vs. con mayor población**

| Riesgo | Hoy | Con población mucho mayor |
|---|---|---|
| Sesgo compartido de localidades (P1) | Bajo: pocas localidades y rankings locales | **Alto** si se mantienen aisladas |
| Contagio de ingresantes (R2) | Bajo | Medio |
| Entrada al Ranking con confiabilidad ~0,5 (P3) | Bajo (densidad baja) | Medio |
| Círculo cerrado no efectivo (P2) | Bajo (sin efecto medible sobre el sesgo) | Bajo |
| Parámetros sin validar (R5) | Medio, conocido | Medio, requiere validación retrospectiva |

### Decisiones abiertas

* **DECISIÓN ABIERTA D-1:** ¿se alinea el comportamiento del círculo cerrado con §7.7 (código) o se reescribe §7.7 (documento)? Requiere versión nueva del algoritmo si se toca el código.
* **DECISIÓN ABIERTA D-2:** qué se le promete al usuario sobre la comparabilidad de Rankings provincial/país/global mientras las localidades no estén conectadas (ayuda, etiquetas, condiciones de publicación).
* **DECISIÓN ABIERTA D-3:** ¿se agrega un umbral de confiabilidad para ocupar posición en ámbitos supralocales, además de CALIBRADO?
* **DECISIÓN ABIERTA D-4:** definir cómo se obtendrá una estimación real de σ_loc (o de qué tamaño son los desfasajes entre comunidades) y qué valor activa una intervención.

### Respuestas directas a las preguntas de la auditoría

| Pregunta | Respuesta (con evidencia) |
|---|---|
| ¿Los partidos corrigen un sesgo compartido dentro de un grupo cerrado? | **No.** Sesgo medio idéntico de m=0 a m=50 en todos los tamaños y variantes (§4.1). Propiedad matemática (promedio conservado). |
| ¿Un grupo puede conservar sobre/infravaloración muchos partidos? | **Sí, indefinidamente** mientras permanezca cerrado (§4.1, §4.2). |
| ¿Qué sucede con conexiones entre grupos? | Se corrige parcialmente y **muy lento**; el sesgo se reparte (el grupo bien calibrado sube) (§4.3). |
| ¿Cuántos partidos y qué diversidad? | **No hay número universal.** Orden relativo: error −37 % a 50 partidos, casi independiente del tamaño del círculo desde ~8–12 personas (§4.5). Desviación individual en grupo abierto: ~46 % corregido a 50 partidos y ~67 % a 100. Desfasaje de grupo: depende de la cantidad de partidos *cruzados*; con 25 % de cruces, 48 % corregido a +200 partidos (§4.3). |
| ¿Efecto de los factores para círculos poco conectados? | Enlentecen el círculo (hasta 0,45 en grupos de 5–8) pero **no corrigen ni detectan el desfasaje**; el factor de círculo cerrado no se activa en el flujo real y, aun activándose, no cambia el resultado (§4.7). |
| ¿Puede distorsionarse el Ranking sin error técnico? | **Sí.** Con σ_loc=0,6 (hipótesis): la localidad más sobrevalorada aporta 37 % del top-10 provincial (justo: 17 %); pares mal ordenados ×5 (§4.6). |
| ¿Qué es matemático y qué es ajustable? | **Matemático:** la conservación del promedio y la imposibilidad de identificar el desfasaje absoluto sin conexiones. **Ajustable:** velocidad de corrección (K, curva de confianza), umbral de calibración (5/3), umbrales del círculo, pesos de repetición, elegibilidad al Ranking, política de ámbitos. |
| ¿Qué riesgos son importantes hoy y cuáles con mayor población? | Ver tabla de §8: hoy ninguno amerita atención inmediata; P1/R2 se vuelven relevantes con varias localidades densas y aisladas. |

---

## 9. Reproducibilidad y archivos

Todo vive bajo `docs/BRAMUlab/Auditorias/`:

* `Auditoria_Nivel_Ranking_Convergencia.md` (este informe).
* `simulaciones/README.md` — cómo ejecutar; `sim-core.mjs`, `scenario-lib.mjs`, `00`–`06-*.mjs`.
* `simulaciones/resultados/*.json` (salida cruda) y `resultados/resumen.md` (todas las tablas, con desvíos entre réplicas).

Los scripts importan el motor de `bramulab/` solo en lectura dentro de un contexto `vm`, no escriben fuera de `resultados/`, usan semillas fijas (se verificó que dos ejecuciones producen archivos idénticos byte a byte) y requieren solo Node ≥18.

```bash
cd docs/BRAMUlab/Auditorias/simulaciones
node 00-validacion.mjs && REPS=30 node 01-grupos-cerrados.mjs && REPS=30 node 02-puentes.mjs \
 && REPS=30 node 03-ranking.mjs && REPS=30 node 04-sesgo-individual.mjs \
 && REPS=30 node 06-ingresantes-y-circulo.mjs && node 05-resumen.mjs
```

**Cumplimiento de restricciones:** no se modificó el algoritmo, parámetros, cuestionarios, reglas de Ranking, datos reales, migraciones, Supabase (Staging/Production), `main`, Production ni BRAMUlive; no se hizo deploy ni se crearon tareas de implementación.
