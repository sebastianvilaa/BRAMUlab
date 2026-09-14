# Handoff para chat de Ranking BRAMU — exploración geográfica y visibilidad del Ranking

Quiero retomar Ranking BRAMU a partir de una situación que apareció durante la implementación real de V03.7.

No quiero que implementes nada todavía.

Necesito que uses este mensaje como handoff de contexto, revises la documentación vigente de Ranking BRAMU y hagas una investigación adicional de producto/UX antes de proponer una decisión.

## Contexto actual

Ranking BRAMU V1 ya está cerrado conceptualmente como ranking semanal, separado de Nivel BRAMU.

La lógica vigente es:

- Nivel BRAMU cambia partido a partido.
- Ranking BRAMU se publica semanalmente.
- El Ranking usa el Nivel BRAMU consolidado del corte semanal.
- Local / Provincial / País / Global / Mi red son los ámbitos principales.
- Local representa la localidad principal del usuario.
- Provincial representa su provincia/estado.
- País representa su país.
- Mi red depende de vínculos deportivos, no de geografía.
- La posición publicada permanece estable durante la semana.

Durante la implementación V03.7 se corrigió un bug real del prototipo: los mocks mezclaban geografías incorrectamente.

Ahora quedó funcionando así:

- Si el usuario es de Bella Vista, `Local` muestra solamente Bella Vista.
- `Provincial` muestra solamente Provincia de Buenos Aires.
- CABA queda separada de Provincia de Buenos Aires.
- `País` puede mezclar Buenos Aires, CABA, Córdoba, Santa Fe, etc., siempre dentro de Argentina.
- Global y Mi red no cambiaron.

También se agregó al Perfil público una tarjeta informativa de Ranking BRAMU que muestra:

- posición Local;
- posición Provincial;
- posición País;
- denominador de cada ámbito;
- territorio;
- período de la edición semanal.

La tarjeta usa la ubicación del jugador cuyo perfil se está mirando, no la ubicación del usuario que lo observa.

Ejemplo:

RANKING BRAMU — Lun 31 ago — Dom 06 sep

LOCAL
#8 de 74
Rosario

PROVINCIA
#21 de 320
Santa Fe

PAÍS
#540 de 8.000
Argentina

La tarjeta no es clickeable.

Si el jugador está calibrando o no es elegible, no se inventa posición.
Si no existe una cuenta real vinculada, no se inventa Ranking oficial.

## Problema que apareció

Al corregir correctamente la geografía surgió una duda de producto importante.

Si mi ubicación es Bella Vista:

- Local me muestra Bella Vista.
- Provincial me muestra Buenos Aires.
- País me muestra Argentina.

Eso es coherente para responder:

> “¿Dónde estoy yo parado?”

Pero aparece otra necesidad:

> “Quiero saber quién es el #1 de Santa Fe.”
> “Quiero mirar el Ranking de Rosario.”
> “Quiero comparar otra provincia.”
> “Quiero explorar otro país.”

Con la lógica actual no puedo hacerlo, porque los scopes siempre se construyen desde mi propia ubicación.

La primera reacción fue pensar en agregar filtros geográficos dentro de Ranking, pero eso abre un problema grande:

- miles de localidades;
- provincias/estados distintos según país;
- jerarquías territoriales diferentes;
- demasiados selects;
- complejidad innecesaria en mobile;
- posibilidad de ensuciar una pantalla que hoy es bastante clara.

## Investigación preliminar que hicimos

Revisamos referencias como UTR Sports, Playtomic y DUPR.

Lo más interesante fue UTR Sports.

Encontramos un patrón que parece resolver bien las dos necesidades:

### 1. “Dónde estoy yo”

El perfil del jugador muestra posiciones relativas por territorio, por ejemplo:

- ciudad;
- estado/provincia;
- país;
- mundo.

Esto se parece mucho a la tarjeta que ya implementamos en Perfil público.

### 2. “Quiero explorar otro lugar”

UTR separa esa necesidad en leaderboards o páginas geográficas independientes.

Es decir:

- el Ranking principal mantiene el contexto propio;
- explorar otro territorio es otra acción/flujo.

También vimos dos ideas interesantes:

### Explorar Ranking por ubicación

En lugar de un select enorme:

`Buscar ciudad, provincia o país`

Ejemplo:

- Santa Fe, Argentina · Provincia
- Santa Fe, Santa Fe · Localidad
- Rosario, Santa Fe · Localidad
- Chile · País

El usuario elige una ubicación y entra al leaderboard correspondiente.

### Ver cerca de mi posición

UTR también tiene una lógica de mostrar jugadores cercanos al puesto del usuario, por ejemplo:

#12
#13
#14
#15 YO
#16
#17
#18

Esto puede ser muy atractivo para un jugador amateur porque permite ver a quién está persiguiendo y quién viene detrás.

## Hipótesis actual

Nuestra hipótesis provisional es:

### Mantener el Ranking principal como está

`Local | Provincial | País | Global | Mi red`

Siempre relativo a la ubicación propia.

Eso responde:

> “¿Dónde estoy yo?”

### NO agregar ahora selects geográficos dentro de esos scopes

Evitar una cascada tipo:

País → Provincia → Localidad

dentro de la pantalla principal.

### Evaluar una función separada

Algo como:

`Explorar Rankings`

o

`Explorar ubicación`

con buscador geográfico.

Esto respondería:

> “¿Cómo está el Ranking en otro lugar?”

### Mantener la tarjeta territorial en Perfil público

Porque permite conocer:

- Local;
- Provincia;
- País;

de cualquier jugador real cuyo perfil abras.

Eso ya resuelve parcialmente la curiosidad geográfica sin necesidad de navegar manualmente todos los territorios.

## Otras ideas aparecidas durante la prueba

### Ranking en Mi Perfil

La tarjeta que hoy existe en Perfil público probablemente también debería aparecer en Mi Perfil.

La lógica debería ser la misma.

### Ranking en Home

No está decidido.

Dos alternativas para evaluar:

1. tarjeta compacta;
2. integrar datos de Ranking en `TU MOMENTO`.

Ejemplos de TU MOMENTO:

- “Subiste 5 puestos en el Ranking Local.”
- “Esta semana estás #15 en Provincia.”
- “Entraste al top 10 de Bella Vista.”

La idea es evitar duplicar toda la tarjeta del Perfil si no aporta valor.

## Qué necesito de este chat

Quiero que revises todo esto contra la definición vigente de Ranking BRAMU.

Después:

1. Investigá cómo resuelven esta problemática otros productos deportivos, rankings o leaderboards relevantes.
2. No te limites a UTR/Playtomic/DUPR si encontrás mejores referencias.
3. Separá claramente:
   - contexto propio;
   - exploración geográfica;
   - descubrimiento de otros jugadores;
   - posición cercana;
   - perfil individual.
4. Evaluá si nuestra hipótesis actual es correcta o si existe una solución mejor.
5. Decime si conviene:
   - mantener los scopes actuales;
   - agregar filtros geográficos dentro de Ranking;
   - crear `Explorar Rankings`;
   - usar búsqueda geográfica;
   - mostrar “cerca de mi posición”;
   - alguna combinación diferente.
6. Evaluá específicamente mobile y simplicidad de uso.
7. Priorizá qué debería pertenecer a:
   - V1 actual;
   - mejora inmediata;
   - futuro.
8. Revisá si la tarjeta de Ranking en Perfil público debería replicarse en Mi Perfil.
9. Evaluá cómo debería aparecer Ranking en Home:
   - tarjeta;
   - TU MOMENTO;
   - ambos;
   - ninguno.
10. Indicá qué cambios conceptuales deberían hacerse en `Ranking_BRAMU.md`, si corresponde.
11. No modifiques archivos ni implementes nada todavía.

## Entrega esperada

Quiero una recomendación concreta, no una lista interminable de alternativas.

Primero:

**Recomendación principal**

Después:

- por qué;
- referencias comparables;
- flujo propuesto;
- qué dejaría para V1;
- qué dejaría para futuro;
- impacto sobre la documentación actual.

Si detectás una contradicción real con lo que ya está cerrado, marcala claramente.

Cuando termines, confirmame explícitamente que el análisis quedó terminado para poder llevar la conclusión nuevamente al chat central de BRAMUlab.
