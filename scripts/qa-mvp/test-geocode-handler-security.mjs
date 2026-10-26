import assert from 'node:assert/strict';
import handler from '../../api/geocode.mjs';

const originalFetch = globalThis.fetch;
const originalKey = process.env.GEOAPIFY_API_KEY;

process.env.GEOAPIFY_API_KEY = 'ROOMS_QA_FAKE_KEY';

let calls = 0;
let mode = 'success';

globalThis.fetch = async (url, options) => {
  calls++;

  const parsed = new URL(String(url));

  assert.equal(parsed.hostname, 'api.geoapify.com');
  assert.equal(parsed.searchParams.get('apiKey'), 'ROOMS_QA_FAKE_KEY');
  assert.equal(parsed.searchParams.get('limit'), '1');
  assert.ok(options.signal);

  if (mode === 'error') {
    return { ok: false, status: 503 };
  }

  return {
    ok: true,
    json: async () => ({
      results: mode === 'empty' ? [] : [{
        lat: 40.425,
        lon: -3.687,
        formatted: 'Madrid, España',
        city: 'Madrid',
        rank: { confidence: 0.95 }
      }]
    })
  };
};

function responseMock() {
  return {
    statusCode: 200,
    body: null,
    headers: {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    setHeader(name, value) {
      this.headers[name] = value;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    }
  };
}

async function check(name, request, expected, expectedCalls) {
  calls = 0;

  const response = responseMock();
  await handler(request, response);

  assert.equal(response.statusCode, expected, name);
  assert.equal(calls, expectedCalls, name);
  assert.ok(response.body, name);

  assert.ok(
    !JSON.stringify(response.body).includes('ROOMS_QA_FAKE_KEY'),
    'Clave expuesta en respuesta'
  );

  console.log(`OK ${name}: HTTP ${expected}`);
  return response.body;
}

const address = 'Calle Alcalá 20, Madrid';

try {
  await check(
    'GET rechazado',
    { method: 'GET', headers: {}, body: {} },
    405, 0
  );

  await check(
    'Direccion invalida',
    { method: 'POST', headers: {}, body: { address: 'abc' } },
    400, 0
  );

  await check(
    'Cuerpo excesivo',
    {
      method: 'POST',
      headers: {},
      body: { address: 'x'.repeat(5000) }
    },
    413, 0
  );

  await check(
    'Content-Length excesivo',
    {
      method: 'POST',
      headers: { 'content-length': '9000' },
      body: { address }
    },
    413, 0
  );

  mode = 'success';

  const result = await check(
    'Respuesta correcta',
    { method: 'POST', headers: {}, body: { address } },
    200, 1
  );

  assert.equal(result.city, 'Madrid');
  assert.equal(result.latitude, 40.425);
  assert.equal(result.longitude, -3.687);

  mode = 'empty';

  await check(
    'Sin resultados',
    { method: 'POST', headers: {}, body: { address } },
    404, 1
  );

  mode = 'error';

  const originalError = console.error;
  let loggedErrors = 0;

  console.error = () => {
    loggedErrors++;
  };

  try {
    await check(
      'Proveedor no disponible',
      { method: 'POST', headers: {}, body: { address } },
      500, 1
    );
  } finally {
    console.error = originalError;
  }

  assert.equal(loggedErrors, 1);

  console.log('ROOMS GEOCODE HANDLER SECURITY OK');
  console.log('SIN LLAMADAS EXTERNAS');

} finally {
  globalThis.fetch = originalFetch;

  if (originalKey === undefined) {
    delete process.env.GEOAPIFY_API_KEY;
  } else {
    process.env.GEOAPIFY_API_KEY = originalKey;
  }
}
