import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = 'http://127.0.0.1:4173';
const id = '11111111-1111-4111-8111-111111111111';
const email = 'rooms-offline@example.invalid';
const now = Math.floor(Date.now() / 1000);

const encode = obj =>
  Buffer.from(JSON.stringify(obj)).toString('base64url');

const token = [
  encode({ alg: 'HS256', typ: 'JWT' }),
  encode({
    sub: id,
    aud: 'authenticated',
    role: 'authenticated',
    email,
    iat: now,
    exp: now + 3600
  }),
  'offline-signature'
].join('.');

const user = {
  id, email,
  aud: 'authenticated',
  role: 'authenticated',
  email_confirmed_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
  app_metadata: {
    provider: 'email',
    providers: ['email']
  },
  user_metadata: {}
};

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  serviceWorkers: 'block'
});
const page = await context.newPage();

const errors = [];
const blocked = [];
const writes = [];
let logins = 0;
const database = {
  profiles: [],
  match_preferences: [],
  rooms_dna: [],
  user_intents: []
};
const savedOperations = [];

await context.route('**/*', async route => {
  const request = route.request();
  const url = new URL(request.url());
  const method = request.method();

  if (
    url.origin === base &&
    ['GET', 'HEAD'].includes(method)
  ) {
    return route.continue();
  }

  if (
    url.origin === 'https://cdn.jsdelivr.net' &&
    url.pathname.startsWith('/npm/@supabase/supabase-js@2') &&
    method === 'GET'
  ) {
    return route.continue();
  }

  const respond = (body, status = 200) =>
    route.fulfill({
      status,
      contentType: 'application/json',
      headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-headers': '*'
      },
      body: JSON.stringify(body)
    });

  if (
    url.pathname.endsWith('/auth/v1/token') &&
    url.searchParams.get('grant_type') === 'password'
  ) {
    logins++;
    return respond({
      access_token: token,
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: now + 3600,
      refresh_token: 'offline-refresh-token',
      user
    });
  }

  if (url.pathname.endsWith('/auth/v1/user')) {
    return respond(user);
  }

  if (url.pathname.includes('/rest/v1/rpc/')) {
    if (method === 'POST') {
      return respond([]);
    }
  }

  if (url.pathname.includes('/rest/v1/')) {
    const table = url.pathname.split('/rest/v1/')[1].split('/')[0];
    const accept = request.headers()['accept'] || '';
    const single = accept.includes('application/vnd.pgrst.object+json');
    const rows = database[table];

    if (method === 'GET' || method === 'HEAD') {
      const found = rows || [];
      return respond(single ? (found[0] || null) : found);
    }

    if (rows && ['POST', 'PATCH', 'DELETE'].includes(method)) {
      const body = request.postDataJSON?.() ?? null;
      let result = [];

      if (method === 'DELETE') {
        rows.splice(0);
      } else if (method === 'PATCH') {
        result = rows.map(row => {
          Object.assign(row, body);
          return row;
        });
      } else {
        const incoming = Array.isArray(body) ? body : [body];
        for (const item of incoming) {
          if (table === 'user_intents') {
            rows.push({ ...item });
          } else {
            const key = table === 'profiles' ? 'id' : 'user_id';
            const existing = rows.find(row => row[key] === item[key]);
            if (existing) {
              Object.assign(existing, item);
            } else {
              rows.push({ ...item });
            }
          }
        }
        result = incoming.map(item => ({ ...item }));
      }

      savedOperations.push(`${method} ${table}`);
      return respond(single ? (result[0] || null) : result);
    }
  }

  // Ninguna operación de escritura está autorizada.
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    writes.push(`${method} ${url.pathname}`);
  }

  blocked.push(`${method} ${url.origin}${url.pathname}`);
  return route.abort('blockedbyclient');
});

page.on('pageerror', error => errors.push(error.message));

const step = n => page.locator(`#onboardingStep${n}`);

async function expectStep(n) {
  await step(n).waitFor({
    state: 'visible',
    timeout: 20000
  });
  console.log(`OK Paso ${n} visible`);
}

async function next(n) {
  await page.locator('#onboardingContinue').click({
    timeout: 12000
  });
  await expectStep(n);
}

async function choose(selector) {
  await page.locator(selector).first().click({
    timeout: 10000
  });
}

try {
  console.log('=== M5.13B · OCHO PASOS OFFLINE ===');

  await page.goto(base, {
    waitUntil: 'load',
    timeout: 30000
  });

  await page.locator('#authGate').waitFor({
    state: 'visible'
  });

  await page.locator('#authEmail').fill(email);
  await page.locator('#authPassword').fill('offline-only');
  await page.locator('#authSubmit').click();

  await page.waitForFunction(() => {
    return (
      !!window.roomsBackend?.state?.user &&
      document.querySelector('#authGate')?.hidden === true
    );
  }, null, { timeout: 20000 });

  assert.equal(logins, 1);
  console.log('OK Sesión ficticia iniciada');

  await expectStep(1);
  await next(2);

  const vibeCount = await page.evaluate(() =>
    window.ROOMS_DNA_V2.interactions.filter(
      x => x.act === 'vibe' && x.type === 'forced_choice'
    ).length
  );

  for (let i = 0; i < vibeCount; i++) {
    await choose('[data-dna-swipe-choice="left"]');
    if (i + 1 < vibeCount) {
      await page.waitForTimeout(340);
    }
  }

  await next(3);
  console.log(`OK ${vibeCount} respuestas VIBE`);

  const livingCount = await page.evaluate(() =>
    window.ROOMS_DNA_V2.interactions.filter(
      x => x.act === 'living' && x.type === 'scenario'
    ).length
  );

  for (let i = 0; i < livingCount; i++) {
    await choose('[data-dna-living-choice="0"]');
    if (i + 1 < livingCount) {
      await page.waitForTimeout(340);
    }
  }

  await next(4);
  console.log(`OK ${livingCount} respuestas LIVING`);

  const homeIds = await page.locator(
    '#dnaHomePreferences [data-home-id]'
  ).evaluateAll(nodes =>
    [...new Set(nodes.map(n => n.dataset.homeId))]
  );

  assert(homeIds.length > 0, 'No hay prioridades HOME');

  for (const homeId of homeIds) {
    const card = page.locator(
      `#dnaHomePreferences .dna-home-unassigned [data-home-id="${homeId}"]`
    );

    await card.click();

    const selected = page.locator(
      `#dnaHomePreferences [data-home-id="${homeId}"].is-selected`
    );

    assert(
      (await selected.count()) > 0,
      `HOME ${homeId} no seleccionado`
    );

    await page.locator(
      '#dnaHomePreferences .dna-home-zone[data-home-level] header'
    ).first().click();

    const placed = page.locator(
      `#dnaHomePreferences .dna-home-zone [data-home-id="${homeId}"]`
    );

    assert(
      (await placed.count()) > 0,
      `HOME ${homeId} no colocado`
    );
  }

  await next(5);
  console.log(`OK ${homeIds.length} prioridades HOME`);

  await choose('#dnaInterests [data-dna-interest]');
  await choose('#dnaTraits [data-dna-trait]');
  await next(6);
  console.log('OK Intereses y rasgos WORLD');

  await page.locator('#profileName').fill('Rooms QA Offline');
  await page.locator('#profileBio').fill(
    'Perfil ficticio para pruebas automatizadas.'
  );
  await next(7);
  console.log('OK Perfil ficticio');

  await next(8);
  await choose('[data-onboarding-intent="find_room"]');

  await page.waitForFunction(() =>
    !document.querySelector('#onboardingContinue')?.disabled,
    null,
    { timeout: 10000 }
  );

  console.log('OK Intención seleccionada');

  // Ninguna escritura debe producirse antes de finalizar.
  assert.equal(savedOperations.length, 0,
    'Se guardaron datos antes de finalizar');

  // Finalizar usando respuestas PostgREST simuladas.
  await page.locator('#onboardingContinue').click({
    timeout: 15000
  });

  await page.waitForFunction(() =>
    window.roomsBackend?.state?.profile?.onboarding_completed === true,
    null,
    { timeout: 30000 }
  );

  assert.equal(database.profiles[0]?.onboarding_completed, true);
  assert.equal(database.rooms_dna.length, 1);
  assert.equal(database.match_preferences.length, 1);
  assert(database.user_intents.length > 0);

  console.log('OK Perfil, DNA e intenciones guardados en memoria');
  console.log('OK Onboarding marcado como completado');

  // Comprobar persistencia simulada tras recargar.
  await page.reload({
    waitUntil: 'load',
    timeout: 30000
  });

  await page.waitForFunction(() => {
    const state = window.roomsBackend?.state;
    return (
      !!state?.user &&
      state?.profile?.onboarding_completed === true &&
      !!state?.roomsDna &&
      document.querySelector('#authGate')?.hidden === true
    );
  }, null, { timeout: 30000 });

  assert.equal(
    await page.locator('#onboarding').isVisible(),
    false,
    'El onboarding reaparece después de recargar'
  );

  console.log('OK Sesión y perfil recuperados tras recarga');
  console.log('OK DNA V2 recuperado');
  console.log('OK Onboarding no reaparece');
  console.log('INFO Operaciones simuladas:', savedOperations);

  assert.equal(writes.length, 0,
    'Hay escrituras externas no simuladas');
  assert.deepEqual(errors, [],
    'Errores JavaScript durante onboarding');

  console.log('OK 8 pasos recorridos');
  console.log('OK 0 intentos de escritura');
  console.log('OK 0 errores JavaScript');
  console.log('INFO Peticiones externas bloqueadas:', blocked);
  console.log('ROOMS M5.13B SAVE AND RELOAD OK');

} catch (error) {
  console.error('FALLO M5.13B:', error.message);
  console.error('Solicitudes bloqueadas:', blocked);
  console.error('Escrituras detectadas:', writes);
  console.error('Errores JS:', errors);
  process.exitCode = 1;

} finally {
  await context.close();
  await browser.close();
}
