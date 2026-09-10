/* ==========================================================================
   BRAMU Lab — locations.js (BRAMUlab_V03.4.1, ampliado en V03.4.2)
   Búsqueda de localidades para el campo "¿De dónde sos?" de MIS DATOS (§9).

   BRAMUlab_V03.4.2 (§8) — la fuente PRINCIPAL pasa a ser la API pública GeoRef
   de Argentina (apis.datos.gob.ar/georef), que cubre el país completo — el
   dataset local curado de V03.4.1 (~180 localidades, foco AMBA) se degrada a
   FALLBACK MÍNIMO: solo se usa si GeoRef no responde (sin conexión, error de
   red, timeout), y nunca como fuente primaria. `searchLocationsRemote` es
   async (hace un `fetch` real); `searchLocations` sigue siendo síncrona sobre
   el dataset local — `app.js` decide cuál mostrar según el estado de la
   búsqueda (ver renderProfileLocationResults). Ninguna de las dos inventa
   resultados: sin coincidencias reales, ambas devuelven `[]`.
   ========================================================================== */
(function (global) {
  'use strict';

  const COUNTRY = 'Argentina';

  /** `[locality, region]` — `country` es siempre 'Argentina' en este dataset, así que no se
   *  repite en cada fila (armado en `LOCATIONS` más abajo). */
  const RAW = [
    // CABA (barrios)
    ['Palermo', 'CABA'], ['Belgrano', 'CABA'], ['Recoleta', 'CABA'], ['Caballito', 'CABA'],
    ['Núñez', 'CABA'], ['Flores', 'CABA'], ['Villa Urquiza', 'CABA'], ['Almagro', 'CABA'],
    ['Villa Crespo', 'CABA'], ['Colegiales', 'CABA'], ['Saavedra', 'CABA'], ['Coghlan', 'CABA'],
    ['Barracas', 'CABA'], ['Boedo', 'CABA'], ['San Telmo', 'CABA'], ['Puerto Madero', 'CABA'],
    ['Retiro', 'CABA'], ['Monserrat', 'CABA'], ['Constitución', 'CABA'], ['Liniers', 'CABA'],
    ['Mataderos', 'CABA'], ['Parque Patricios', 'CABA'], ['Floresta', 'CABA'],
    ['Villa del Parque', 'CABA'], ['Villa Devoto', 'CABA'], ['Villa Pueyrredón', 'CABA'],
    ['Agronomía', 'CABA'], ['Chacarita', 'CABA'], ['Parque Chas', 'CABA'],
    // Buenos Aires (GBA + interior)
    ['Bella Vista', 'Buenos Aires'], ['San Miguel', 'Buenos Aires'], ['Muñiz', 'Buenos Aires'],
    ['José C. Paz', 'Buenos Aires'], ['Malvinas Argentinas', 'Buenos Aires'], ['Grand Bourg', 'Buenos Aires'],
    ['Hurlingham', 'Buenos Aires'], ['Villa Tesei', 'Buenos Aires'], ['Ituzaingó', 'Buenos Aires'],
    ['Castelar', 'Buenos Aires'], ['Morón', 'Buenos Aires'], ['Haedo', 'Buenos Aires'],
    ['El Palomar', 'Buenos Aires'], ['Ramos Mejía', 'Buenos Aires'], ['San Justo', 'Buenos Aires'],
    ['Isidro Casanova', 'Buenos Aires'], ['González Catán', 'Buenos Aires'], ['Merlo', 'Buenos Aires'],
    ['Libertad', 'Buenos Aires'], ['Moreno', 'Buenos Aires'], ['Paso del Rey', 'Buenos Aires'],
    ['San Isidro', 'Buenos Aires'], ['Martínez', 'Buenos Aires'], ['Acassuso', 'Buenos Aires'],
    ['Boulogne', 'Buenos Aires'], ['Beccar', 'Buenos Aires'], ['Vicente López', 'Buenos Aires'],
    ['Olivos', 'Buenos Aires'], ['Florida', 'Buenos Aires'], ['Munro', 'Buenos Aires'],
    ['La Lucila', 'Buenos Aires'], ['Tigre', 'Buenos Aires'], ['Don Torcuato', 'Buenos Aires'],
    ['General Pacheco', 'Buenos Aires'], ['Benavídez', 'Buenos Aires'], ['Nordelta', 'Buenos Aires'],
    ['Pilar', 'Buenos Aires'], ['Del Viso', 'Buenos Aires'], ['Derqui', 'Buenos Aires'],
    ['Escobar', 'Buenos Aires'], ['Garín', 'Buenos Aires'], ['Maschwitz', 'Buenos Aires'],
    ['Campana', 'Buenos Aires'], ['Zárate', 'Buenos Aires'], ['Luján', 'Buenos Aires'],
    ['Mercedes', 'Buenos Aires'], ['Chivilcoy', 'Buenos Aires'], ['Nueve de Julio', 'Buenos Aires'],
    ['Junín', 'Buenos Aires'], ['Pergamino', 'Buenos Aires'], ['San Nicolás de los Arroyos', 'Buenos Aires'],
    ['San Pedro', 'Buenos Aires'], ['Baradero', 'Buenos Aires'], ['Quilmes', 'Buenos Aires'],
    ['Bernal', 'Buenos Aires'], ['Ezpeleta', 'Buenos Aires'], ['Avellaneda', 'Buenos Aires'],
    ['Sarandí', 'Buenos Aires'], ['Dock Sud', 'Buenos Aires'], ['Lanús', 'Buenos Aires'],
    ['Lomas de Zamora', 'Buenos Aires'], ['Banfield', 'Buenos Aires'], ['Temperley', 'Buenos Aires'],
    ['Adrogué', 'Buenos Aires'], ['Burzaco', 'Buenos Aires'], ['Lomas del Mirador', 'Buenos Aires'],
    ['Berazategui', 'Buenos Aires'], ['Florencio Varela', 'Buenos Aires'], ['La Plata', 'Buenos Aires'],
    ['City Bell', 'Buenos Aires'], ['Gonnet', 'Buenos Aires'], ['Tolosa', 'Buenos Aires'],
    ['Ensenada', 'Buenos Aires'], ['Berisso', 'Buenos Aires'], ['Mar del Plata', 'Buenos Aires'],
    ['Necochea', 'Buenos Aires'], ['Balcarce', 'Buenos Aires'], ['Tandil', 'Buenos Aires'],
    ['Azul', 'Buenos Aires'], ['Olavarría', 'Buenos Aires'], ['Bahía Blanca', 'Buenos Aires'],
    ['Coronel Suárez', 'Buenos Aires'], ['Trenque Lauquen', 'Buenos Aires'], ['Chascomús', 'Buenos Aires'],
    ['Dolores', 'Buenos Aires'], ['Pinamar', 'Buenos Aires'], ['Villa Gesell', 'Buenos Aires'],
    ['San Clemente del Tuyú', 'Buenos Aires'], ['Mar del Tuyú', 'Buenos Aires'],
    // Córdoba
    ['Córdoba', 'Córdoba'], ['Villa Carlos Paz', 'Córdoba'], ['Alta Gracia', 'Córdoba'],
    ['Río Cuarto', 'Córdoba'], ['Villa María', 'Córdoba'], ['San Francisco', 'Córdoba'],
    ['Jesús María', 'Córdoba'], ['Cosquín', 'Córdoba'], ['Bell Ville', 'Córdoba'], ['Marcos Juárez', 'Córdoba'],
    // Santa Fe
    ['Rosario', 'Santa Fe'], ['Santa Fe', 'Santa Fe'], ['Rafaela', 'Santa Fe'],
    ['Venado Tuerto', 'Santa Fe'], ['Reconquista', 'Santa Fe'], ['Casilda', 'Santa Fe'],
    ['Santo Tomé', 'Santa Fe'], ['Funes', 'Santa Fe'], ['Villa Constitución', 'Santa Fe'],
    // Mendoza
    ['Mendoza', 'Mendoza'], ['Godoy Cruz', 'Mendoza'], ['Guaymallén', 'Mendoza'],
    ['Las Heras', 'Mendoza'], ['Luján de Cuyo', 'Mendoza'], ['Maipú', 'Mendoza'],
    ['San Rafael', 'Mendoza'], ['General Alvear', 'Mendoza'], ['Tunuyán', 'Mendoza'],
    // San Juan
    ['San Juan', 'San Juan'], ['Rivadavia', 'San Juan'], ['Chimbas', 'San Juan'],
    ['Rawson', 'San Juan'], ['Pocito', 'San Juan'],
    // San Luis
    ['San Luis', 'San Luis'], ['Villa Mercedes', 'San Luis'], ['Merlo', 'San Luis'],
    // La Rioja
    ['La Rioja', 'La Rioja'], ['Chilecito', 'La Rioja'],
    // Catamarca
    ['San Fernando del Valle de Catamarca', 'Catamarca'],
    // Santiago del Estero
    ['Santiago del Estero', 'Santiago del Estero'], ['La Banda', 'Santiago del Estero'],
    ['Termas de Río Hondo', 'Santiago del Estero'],
    // Tucumán
    ['San Miguel de Tucumán', 'Tucumán'], ['Yerba Buena', 'Tucumán'], ['Tafí Viejo', 'Tucumán'],
    ['Concepción', 'Tucumán'],
    // Salta
    ['Salta', 'Salta'], ['San Ramón de la Nueva Orán', 'Salta'], ['Tartagal', 'Salta'],
    // Jujuy
    ['San Salvador de Jujuy', 'Jujuy'], ['Palpalá', 'Jujuy'], ['Libertador General San Martín', 'Jujuy'],
    // Formosa
    ['Formosa', 'Formosa'], ['Clorinda', 'Formosa'],
    // Chaco
    ['Resistencia', 'Chaco'], ['Presidencia Roque Sáenz Peña', 'Chaco'], ['Barranqueras', 'Chaco'],
    // Corrientes
    ['Corrientes', 'Corrientes'], ['Goya', 'Corrientes'], ['Mercedes', 'Corrientes'],
    // Misiones
    ['Posadas', 'Misiones'], ['Eldorado', 'Misiones'], ['Oberá', 'Misiones'], ['Puerto Iguazú', 'Misiones'],
    // Entre Ríos
    ['Paraná', 'Entre Ríos'], ['Concordia', 'Entre Ríos'], ['Gualeguaychú', 'Entre Ríos'],
    ['Concepción del Uruguay', 'Entre Ríos'], ['Gualeguay', 'Entre Ríos'],
    // La Pampa
    ['Santa Rosa', 'La Pampa'], ['General Pico', 'La Pampa'],
    // Neuquén
    ['Neuquén', 'Neuquén'], ['Plottier', 'Neuquén'], ['San Martín de los Andes', 'Neuquén'],
    ['Villa La Angostura', 'Neuquén'], ['Zapala', 'Neuquén'],
    // Río Negro
    ['Viedma', 'Río Negro'], ['San Carlos de Bariloche', 'Río Negro'], ['Cipolletti', 'Río Negro'],
    ['General Roca', 'Río Negro'], ['Cinco Saltos', 'Río Negro'], ['El Bolsón', 'Río Negro'],
    // Chubut
    ['Rawson', 'Chubut'], ['Trelew', 'Chubut'], ['Puerto Madryn', 'Chubut'],
    ['Comodoro Rivadavia', 'Chubut'], ['Esquel', 'Chubut'],
    // Santa Cruz
    ['Río Gallegos', 'Santa Cruz'], ['El Calafate', 'Santa Cruz'], ['Caleta Olivia', 'Santa Cruz'],
    ['Pico Truncado', 'Santa Cruz'],
    // Tierra del Fuego
    ['Ushuaia', 'Tierra del Fuego'], ['Río Grande', 'Tierra del Fuego'],
  ];

  const LOCATIONS = RAW.map(([locality, region]) => ({ locality, region, country: COUNTRY }));

  function normalizeText(s) {
    return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  }

  /** Etiqueta visible única para una localidad — "Bella Vista, Buenos Aires" (§9 del
   *  consolidado). Único punto de armado del formato, para que la fila del picker y el valor
   *  guardado en MIS DATOS siempre se vean idénticos. */
  function formatLocationLabel(loc) {
    if (!loc || !loc.locality) return '';
    return loc.region ? `${loc.locality}, ${loc.region}` : loc.locality;
  }

  const DEFAULT_RESULTS_LIMIT = 40;

  /** Sin `query`, devuelve las primeras `limit` localidades del dataset (mismo criterio de
   *  "explorar sin buscar" que ya usa Buscar Jugadores) — nunca una lista vacía sin motivo. Con
   *  `query`, filtra por substring normalizado (sin acentos/mayúsculas) sobre "localidad,
   *  región" combinadas, así que buscar "cordoba" o "buenos aires" encuentra por cualquiera de
   *  las dos partes. */
  function searchLocations(query, limit) {
    const max = limit || DEFAULT_RESULTS_LIMIT;
    const q = normalizeText(query);
    if (!q) return LOCATIONS.slice(0, max);
    return LOCATIONS.filter((loc) => normalizeText(`${loc.locality} ${loc.region}`).includes(q)).slice(0, max);
  }

  /** GeoRef devuelve los nombres en MAYÚSCULAS ("GENERAL LAS HERAS") — mismo criterio de
   *  Title Case que ya usa `Store.normalizePlayerName` para nombres de jugador (primera letra
   *  de cada palabra en mayúscula, resto en minúscula), aplicado acá a topónimos para que se
   *  vean como el resto de la interfaz, nunca gritando en mayúsculas. */
  function toTitleCaseEs(s) {
    return (s || '').trim().split(/\s+/).map((word) => {
      if (!word) return word;
      return word.charAt(0).toLocaleUpperCase('es') + word.slice(1).toLocaleLowerCase('es');
    }).join(' ');
  }

  const GEOREF_URL = 'https://apis.datos.gob.ar/georef/api/localidades';
  const GEOREF_MAX_RESULTS = 15;

  /** BRAMUlab_V03.4.2 (§8) — fuente PRINCIPAL: localidades reales de Argentina vía la API
   *  pública GeoRef (sin autenticación, CORS abierto — pensada para consumo público desde el
   *  navegador). `signal` es un `AbortSignal` opcional (ver app.js: cancela una búsqueda vieja
   *  cuando el usuario ya tipeó una nueva, para no pintar una respuesta fuera de orden). Nunca
   *  atrapa errores acá adentro — los deja subir tal cual (red caída, timeout, HTTP no-2xx) para
   *  que quien llama decida el fallback (§8: "no inventar resultados"), esta función solo sabe
   *  pedir y traducir la forma de la respuesta. */
  async function searchLocationsRemote(query, options) {
    const opts = options || {};
    const q = (query || '').trim();
    if (!q) return [];
    const url = `${GEOREF_URL}?nombre=${encodeURIComponent(q)}&max=${opts.max || GEOREF_MAX_RESULTS}&campos=nombre,provincia&orden=nombre`;
    const res = await fetch(url, { signal: opts.signal });
    if (!res.ok) throw new Error(`georef-http-${res.status}`);
    const data = await res.json();
    const seen = new Set();
    const results = [];
    (data && data.localidades ? data.localidades : []).forEach((loc) => {
      if (!loc || !loc.nombre) return;
      const locality = toTitleCaseEs(loc.nombre);
      const region = loc.provincia && loc.provincia.nombre ? toTitleCaseEs(loc.provincia.nombre) : null;
      const key = normalizeText(`${locality} ${region || ''}`);
      if (seen.has(key)) return;
      seen.add(key);
      results.push({ locality, region, country: COUNTRY });
    });
    return results;
  }

  global.PLLocations = {
    LOCATIONS, searchLocations, searchLocationsRemote, formatLocationLabel, toTitleCaseEs,
  };
})(typeof window !== 'undefined' ? window : globalThis);
