import fs from 'node:fs';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const source = fs.readFileSync(
  'assets/js/features/publish-geocoding.js', 'utf8'
);
const app = fs.readFileSync(
  'assets/js/supabase-app.js', 'utf8'
);
const html = fs.readFileSync('index.html', 'utf8');

console.log('\n=== PUBLISH GEOCODING ===');

const script = 'assets/js/features/publish-geocoding.js';
assert(html.includes(`src="${script}"`));
assert(
  html.indexOf(script) <
  html.indexOf('assets/js/supabase-app.js')
);
assert(
  app.includes('ROOMS_PUBLISH_GEOCODING_FEATURE?.create')
);
assert(
  /async function geocodeListingAddress\s*\(/.test(source)
);
assert(
  !/async function geocodeListingAddress\s*\(/.test(app)
);
const submit = fs.readFileSync(
  'assets/js/features/publish-submit.js',
  'utf8'
);

assert(
  /await geocodeListingAddress\s*\(/.test(submit),
  'Publish Submit debe utilizar Publish Geocoding'
);

assert(
  app.includes('ROOMS_PUBLISH_SUBMIT_FEATURE?.create'),
  'Publish Submit debe estar conectado al monolito'
);

console.log('OK  Extraccion e integracion');

function setup({
  ok = true,
  payload = {},
  invalidJson = false,
  withZone = true
} = {}) {
  const dom = new JSDOM(
    `<!doctype html><body>${
      withZone ? '<p data-detected-zone hidden></p>' : ''
    }</body>`,
    {
      url: 'http://127.0.0.1/',
      runScripts: 'outside-only'
    }
  );

  const { window } = dom;
  const requests = [];

  window.fetch = async (url, options) => {
    requests.push({ url, options });
    return {
      ok,
      json: async () => {
        if (invalidJson) {
          throw new Error('Invalid JSON');
        }
        return payload;
      }
    };
  };

  window.eval(source);

  const feature =
    window.ROOMS_PUBLISH_GEOCODING_FEATURE.create();

  return {
    feature,
    requests,
    zone: window.document.querySelector(
      '[data-detected-zone]'
    ),
    close: () => window.close()
  };
}

{
  const t = setup();

  await assert.rejects(
    t.feature.geocodeListingAddress('abc'),
    /Introduce la dirección exacta/
  );

  assert.equal(t.requests.length, 0);

  console.log('OK  Direcciones demasiado cortas rechazadas');
  t.close();
}

{
  const t = setup({
    payload: {
      latitude: '40.425',
      longitude: '-3.690',
      formattedAddress: 'Calle Serrano 55, Madrid',
      district: 'Salamanca'
    }
  });

  const result = await t.feature.geocodeListingAddress(
    '  Calle Serrano 55  '
  );

  assert.equal(result.latitude, 40.425);
  assert.equal(result.longitude, -3.69);
  assert.equal(result.district, 'Salamanca');
  assert.equal(
    result.formattedAddress,
    'Calle Serrano 55, Madrid'
  );

  assert.equal(t.requests.length, 1);
  assert.equal(t.requests[0].url, '/api/geocode');
  assert.equal(t.requests[0].options.method, 'POST');
  assert.deepEqual(
    JSON.parse(t.requests[0].options.body),
    { address: 'Calle Serrano 55' }
  );

  assert.equal(t.zone.hidden, false);
  assert(
    t.zone.textContent.includes('Salamanca, Madrid')
  );

  console.log('OK  Coordenadas y zona detectada');
  console.log('OK  Peticion POST y direccion normalizada');
  t.close();
}

{
  const t = setup({
    payload: {
      latitude: 40.4,
      longitude: -3.7
    }
  });

  const result = await t.feature.geocodeListingAddress(
    'Calle Mayor 1'
  );

  assert.equal(result.formattedAddress, 'Calle Mayor 1');
  assert.equal(result.district, null);
  assert(
    t.zone.textContent.includes(
      'Ubicación detectada: Madrid'
    )
  );

  console.log('OK  Respuesta sin distrito');
  t.close();
}

{
  const t = setup({
    ok: false,
    payload: {
      error: 'Direccion no localizada'
    }
  });

  await assert.rejects(
    t.feature.geocodeListingAddress('Calle Falsa 123'),
    /Direccion no localizada/
  );

  console.log('OK  Error devuelto por la API');
  t.close();
}

{
  const t = setup({
    ok: false,
    invalidJson: true
  });

  await assert.rejects(
    t.feature.geocodeListingAddress('Calle Falsa 123'),
    /No hemos podido localizar/
  );

  console.log('OK  Respuesta HTTP sin JSON valido');
  t.close();
}

{
  const t = setup({
    payload: {
      latitude: 'invalida',
      longitude: -3.7
    }
  });

  await assert.rejects(
    t.feature.geocodeListingAddress('Calle Falsa 123'),
    /No hemos podido localizar/
  );

  console.log('OK  Coordenadas invalidas rechazadas');
  t.close();
}

{
  const t = setup({
    withZone: false,
    payload: {
      latitude: 40.4,
      longitude: -3.7
    }
  });

  const result = await t.feature.geocodeListingAddress(
    'Calle Mayor 1'
  );

  assert.equal(result.latitude, 40.4);

  console.log('OK  Funciona sin indicador DOM');
  t.close();
}

console.log('\nROOMS PUBLISH GEOCODING FEATURE OK');
