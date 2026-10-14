// BRAMUlab Web Metrics v1.1 — no confundir accesos a la app con documentos legales.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const source = fs.readFileSync(path.join(root, 'bramulab-web/js/web-metrics.js'), 'utf8');

function harness(hostname = 'bramulab.com') {
  const sent = [];
  const listeners = {};
  const document = {
    readyState: 'complete',
    addEventListener(name, cb) { listeners[name] = cb; },
  };
  const window = { location: { hostname, href: 'https://' + hostname + '/' } };
  const navigator = {
    sendBeacon(url, blob) {
      sent.push({ url, event: JSON.parse(blob.textValue) });
      return true;
    },
  };
  class FakeBlob {
    constructor(parts) { this.textValue = parts.join(''); }
  }
  const fetch = () => { throw new Error('No corresponde usar fetch: sendBeacon fue exitoso'); };
  new Function('window', 'document', 'navigator', 'Blob', 'fetch', 'URL', source)(
    window, document, navigator, FakeBlob, fetch, URL
  );
  return {
    sent,
    click(href, sourceLabel, nested = false) {
      assert.equal(typeof listeners.click, 'function', 'se registró listener de clic');
      const link = { href, dataset: sourceLabel ? { bramuCta: sourceLabel } : {} };
      const event = {
        target: { closest(selector) { assert.equal(selector, 'a[href]'); return nested ? link : link; } },
        preventDefault() { throw new Error('La medición no debe intervenir el enlace'); },
      };
      listeners.click(event);
    },
  };
}

test('Las visitas siguen registrándose, pero no se añade un clic automáticamente', () => {
  const h = harness();
  assert.deepEqual(h.sent.map((m) => m.event), [{ event: 'view', source: 'page' }]);
});

for (const entry of [
  ['https://app.bramulab.com', 'hero'],
  ['https://app.bramulab.com/', 'login'],
  ['https://app.bramulab.com/?from=web', 'instalacion'],
  ['https://app.bramulab.com/#/inicio', 'final'],
  ['https://app.bramulab.com/index.html', 'other'],
]) {
  test('Cuenta acceso real a la app: ' + entry[0], () => {
    const h = harness();
    h.click(entry[0], entry[1]);
    assert.deepEqual(h.sent.map((m) => m.event),
      [{ event: 'view', source: 'page' }, { event: 'click', source: entry[1] }]);
  });
}

for (const legal of [
  'https://app.bramulab.com/terminos/',
  'https://app.bramulab.com/terminos',
  'https://app.bramulab.com/terminos/?foo=bar',
  'https://app.bramulab.com/privacidad/',
  'https://app.bramulab.com/privacidad',
  'https://app.bramulab.com/legal/',
  'https://app.bramulab.com/otras-rutas/',
]) {
  test('No cuenta enlace legal o secundario: ' + legal, () => {
    const h = harness();
    h.click(legal, 'hero'); // incluso mal etiquetado, nunca debe contar
    assert.deepEqual(h.sent.map((m) => m.event), [{ event: 'view', source: 'page' }]);
  });
}

test('No cuenta destinos externos, host suplantado ni esquema inseguro', () => {
  const h = harness();
  h.click('https://instagram.com/bramulab', 'final');
  h.click('https://app.bramulab.com.attacker.test/', 'hero');
  h.click('http://app.bramulab.com/', 'hero');
  assert.equal(h.sent.length, 1);
});

test('CTA sin etiqueta mantiene origen other y un elemento interior es válido', () => {
  const h = harness();
  h.click('https://app.bramulab.com/', undefined, true);
  assert.deepEqual(h.sent[1].event, { event: 'click', source: 'other' });
});

test('El script continúa apagado fuera del dominio público autorizado', () => {
  const h = harness('staging.bramulab.com');
  assert.deepEqual(h.sent, []);
  assert.throws(() => h.click('https://app.bramulab.com/', 'hero'));
});
