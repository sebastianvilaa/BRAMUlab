# BRAMUlab — Referencia visual de pádel

**Estado:** referencia técnica complementaria para generación y revisión de recursos visuales.  
**Fecha:** 16/10/2026.  
**Alcance actual:** cancha de pádel. Este documento puede ampliarse con pala, pelota, calzado, gestos y situaciones de juego cuando sea necesario.

## 1. Principio

Cuando BRAMUlab genere una imagen de pádel, el deporte debe verse correcto antes de aplicar estilo, iluminación o composición.

No alcanza con que la imagen “se parezca” a una cancha. Si la geometría, el cerramiento, la red, los accesos o las líneas son incorrectos, la imagen se considera inválida aunque sea estéticamente buena.

Fuente normativa principal: **FIP Rules of Padel, vigentes desde 01/01/2026**.

## 2. Cancha — geometría obligatoria

- Rectángulo interior de **20 m de largo × 10 m de ancho**.
- La red cruza los **10 m de ancho exactamente en el centro**, dividiendo la cancha en dos mitades simétricas de 10 × 10 m.
- Red: **0,88 m en el centro** y **0,92 m en los extremos/postes**.
- Los postes de red están en los límites laterales de la cancha y no superan 1,05 m.
- A cada lado de la red existe una línea de saque paralela a ella, situada a **6,95 m**.
- Una línea central de saque, perpendicular a la red, divide cada zona de servicio en dos.
- Las líneas tienen **5 cm de ancho**, normalmente blancas sobre césped azul.
- No dibujar líneas de tenis adicionales, pasillos de dobles ni línea de fondo separada del cerramiento.
- Altura libre mínima sobre toda la cancha: **6 m**; en instalaciones nuevas la FIP recomienda 8 m.

## 3. Cerramiento correcto

La cancha está cerrada por una combinación de **vidrio/pared lisa + malla metálica**, no por una jaula uniforme de reja ni por vidrio completo de piso a techo en todo el perímetro.

### Fondos
- Cada fondo tiene 10 m de ancho.
- Los primeros **3 m de altura** son pared lisa, habitualmente vidrio templado transparente.
- Sobre esa pared hay **1 m de malla metálica**, totalizando 4 m de altura.

### Laterales
Para una imagen contemporánea de BRAMU usar por defecto la variante moderna de vidrio:
- Cerca de cada fondo, los primeros **4 m de longitud lateral** tienen pared/vidrio de **3 m de altura**.
- El tramo central del lateral se resuelve principalmente con **malla metálica**.
- En los extremos la malla completa la altura hasta 4 m.
- El vidrio lateral nace desde el fondo; no colocar paneles de vidrio aislados arbitrariamente en mitad de la cancha.
- La malla debe ser plana, vertical y de cuadrícula; visualmente puede asumirse electrosoldada de alrededor de 50 × 50 mm.
- Estructura metálica normalmente de acero pintado, con postes y marcos verticales negros, azul noche u otro acabado sobrio.

### Vidrio
Como referencia visual contemporánea de competición:
- vidrio templado transparente;
- típicamente 10–12 mm según modelo; 12 mm es habitual en canchas premium/FIP;
- paneles verticales grandes, limpios y transparentes;
- reflejos reales pero sin apariencia de pared espejada.

## 4. Accesos / “puertas”

Este es un error crítico en generación de imágenes.

- Los accesos están **en los laterales largos**, nunca en el fondo de vidrio.
- Se sitúan **en la zona central del lateral**, simétricos respecto del centro de la cancha/red.
- Puede haber uno o dos accesos por lateral y pueden llevar puerta o quedar como abertura.
- Con un acceso por lateral: abertura FIP de aprox. **1,05–2,20 m de ancho × 2,00–2,20 m de alto**.
- Con dos accesos por lateral: cada abertura de aprox. **0,72–1,10 m × 2,00–2,20 m**.
- Para recursos BRAMU, salvo pedido contrario, preferir una **abertura rectangular limpia en la malla a la altura de la red**, sin hoja de puerta visible. Es la lectura visual más clara y evita que la IA invente portones.
- El acceso debe interrumpir la malla de manera lógica. No crear una “puerta” suelta en el vidrio, una puerta en una esquina ni una puerta detrás de la línea de fondo.

## 5. Piso

- Para la estética BRAMU, usar **césped sintético azul**.
- Debe verse como superficie deportiva texturada, no como pintura lisa, cemento azul o alfombra doméstica.
- Puede insinuarse arena de sílice, pero sin exagerarla.
- Las líneas son blancas y nítidas.
- Todo el piso de juego mantiene el mismo color general.

## 6. Iluminación y cancha techada/nocturna

- En una cancha techada debe existir una estructura de nave, cubierta o techo claramente por encima del espacio de juego.
- Los proyectores no deben invadir la altura útil de la cancha.
- La FIP exige iluminación uniforme; los proyectores deben quedar al menos a 6 m del suelo y en nuevas instalaciones se recomiendan 8 m cuando están dentro de la proyección de la cancha.
- Para BRAMU: luz LED fría o neutra-fría desde arriba, blanca, con contraste nocturno alto.
- Puede haber sombras profundas fuera de la cancha, pero el rectángulo de juego debe seguir siendo legible.
- No convertir la escena en cyberpunk: sin tubos RGB, neón violeta/magenta ni luces decorativas ajenas a una instalación deportiva real.

## 7. Construcción visual típica

Una cancha moderna creíble combina:
- base/nivel de piso;
- césped sintético;
- estructura de acero galvanizado/pintado;
- paneles de vidrio templado;
- paneles de malla electrosoldada;
- red y dos postes;
- accesos laterales;
- luminarias LED elevadas;
- cubierta/estructura superior si es indoor.

Como referencia de cancha premium contemporánea, fabricantes de canchas oficiales FIP utilizan estructura de acero galvanizado, vidrio templado de 12 mm, césped sintético texturizado y luminarias LED.

## 8. Errores visuales que invalidan una imagen

**NO generar:**
- cancha con proporciones de tenis;
- pasillos laterales de tenis;
- red desplazada del centro;
- red demasiado alta;
- paredes de vidrio completas de 4 m sin malla superior;
- reja desde el piso en todo el fondo;
- fondo sin vidrio;
- puertas en el fondo;
- puertas en las esquinas;
- una puerta arbitraria lejos del centro lateral;
- acceso que atraviesa una pared de vidrio;
- estructura o postes creciendo dentro de la superficie de juego sin lógica;
- líneas extra;
- aro, arco, banco u objetos propios de otros deportes;
- césped con aspecto de piso de gimnasio;
- techo demasiado bajo;
- reflectores colgando dentro del volumen de juego;
- estética futurista que impida reconocer una cancha real.

## 9. Prompt base reutilizable — cancha BRAMU

> Fotografía deportiva hiperrealista de una **cancha reglamentaria de pádel moderna**, proporción real **20 m × 10 m**, completamente reconocible como pádel y no como tenis. Césped sintético azul con líneas blancas reglamentarias; red baja situada exactamente en el centro, cruzando los 10 m de ancho. Fondos de vidrio templado transparente de 3 m de alto con 1 m de malla metálica cuadrada por encima. Laterales con vidrio únicamente en los tramos próximos a ambos fondos y malla metálica negra en la zona central. **Acceso rectangular ubicado en el centro de cada lateral, junto a la zona de la red, abierto y sin una hoja de puerta visible.** Estructura metálica negra sobria y realista. Cancha techada de noche, techo industrial alto, iluminación LED blanca fría desde arriba, cancha bien iluminada y entorno azul noche oscuro, sombras profundas, reflejos sutiles y físicamente creíbles en el vidrio. Fotografía real, arquitectura deportiva real, escala humana correcta, lente fotográfica realista, sin estética CGI evidente.

### Restricciones negativas

> No cancha de tenis, no pasillos de dobles, no puertas en los fondos o esquinas, no vidrio continuo de piso a techo en todo el perímetro, no reja uniforme en los cuatro lados, no red alta, no líneas extra, no postes dentro del campo, no techo bajo, no reflectores a baja altura, no neón RGB, no cyberpunk, no arquitectura imposible.

## 10. Uso recomendado al generar imágenes

No confiar solo en texto cuando la cancha sea protagonista.

Orden preferido:
1. usar este documento como contrato geométrico;
2. dar al generador una o más **fotografías reales de referencia** del tipo de cancha deseado;
3. pedir primero fidelidad de cancha y después clima/estética;
4. revisar expresamente: proporción, red, fondos, laterales, accesos y líneas;
5. si uno de esos seis puntos falla, corregir o regenerar antes de avanzar.

Para una toma cerrada donde solo aparece una parte de la cancha, mantener igualmente la lógica espacial: el acceso pertenece al lateral y el vidrio/malla debe continuar de manera estructuralmente posible.

## 11. Fuentes

- International Padel Federation — Rules of Padel 2026: dimensiones, red, cerramientos, superficie, accesos e iluminación.
- FIP Official Court / MejorSet: referencia contemporánea de construcción premium, vidrio templado de 12 mm, estructura galvanizada, césped azul y LED.
