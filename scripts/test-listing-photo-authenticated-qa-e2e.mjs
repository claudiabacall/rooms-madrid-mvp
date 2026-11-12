import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import dotenv from 'dotenv';
import { chromium } from 'playwright';

const QA_URL =
  'https://gpfmocptevpyzrwsubkj.supabase.co';

const qa = JSON.parse(
  readFileSync(
    join(homedir(), '.config/rooms/qa-public.json'),
    'utf8'
  )
);

assert.equal(
  qa.url,
  QA_URL,
  'STOP: proyecto Supabase no es QA'
);

const credentials = dotenv.parse(
  readFileSync('.env.rooms-test.local')
);

assert.ok(
  credentials.ROOMS_TEST_EMAIL &&
  credentials.ROOMS_TEST_PASSWORD &&
  credentials.ROOMS_TEST_USER_ID,
  'STOP: faltan credenciales QA'
);

console.log('OK Proyecto y credenciales QA disponibles');

async function freePort() {
  return new Promise((resolve, reject) => {
    const socket = createServer();
    socket.once('error', reject);
    socket.listen(0, '127.0.0.1', () => {
      const port = socket.address().port;
      socket.close(() => resolve(port));
    });
  });
}

async function waitForServer(url, child) {
  for (let i = 0; i < 120; i++) {
    if (child.exitCode !== null) {
      throw new Error('Servidor local terminado');
    }

    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(1000)
      });

      if (response.ok) return;
    } catch {}

    await delay(100);
  }

  throw new Error('Servidor local no disponible');
}

const port = await freePort();
const origin = `http://127.0.0.1:${port}`;

const server = spawn(process.execPath, ['server.mjs'], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    PORT: String(port),
    ROOMS_SUPABASE_ENV: 'qa'
  },
  stdio: 'ignore'
});

let browser;

try {
  await waitForServer(origin, server);

  const response = await fetch(
    `${origin}/assets/js/supabase-config.js`
  );

  assert.equal(response.status, 200);

  const config = await response.text();
  assert.ok(config.includes(QA_URL));

  console.log('OK Servidor frontend conectado a QA');

  browser = await chromium.launch({ headless: true });

  const context = await browser.newContext({
    serviceWorkers: 'block'
  });

  const page = await context.newPage();

  const pageErrors = [];
  const unsafeRequests = [];
  let qaRequests = 0;
  let signedRequests = 0;

  page.on('pageerror', error => {
    pageErrors.push(error.message);
  });

  await page.route('**/*', route => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();

    const isSupabase =
      url.hostname === 'supabase.co' ||
      url.hostname.endsWith('.supabase.co');

    if (!isSupabase) {
      return route.continue();
    }

    if (url.origin !== QA_URL) {
      unsafeRequests.push('Supabase fuera de QA');
      return route.abort();
    }

    const readOnly =
      method === 'GET' ||
      method === 'HEAD' ||
      method === 'OPTIONS';

    const authToken =
      method === 'POST' &&
      url.pathname === '/auth/v1/token';

    const rpc =
      method === 'POST' &&
      url.pathname.startsWith('/rest/v1/rpc/');

    const rpcName = rpc
      ? decodeURIComponent(url.pathname.split('/').pop())
      : '';

    const prohibitedRpc = rpc &&
      /^(create|update|delete|insert|upsert|set|send|mark|vote|accept|reject|block|unblock|save|record|remove)_/i
        .test(rpcName);

    const signPhoto =
      method === 'POST' &&
      url.pathname.startsWith(
        '/storage/v1/object/sign/listing-images/'
      );

    if (
      !(readOnly || authToken || (rpc && !prohibitedRpc) || signPhoto)
    ) {
      unsafeRequests.push(
        `${method} ${url.pathname}`
      );

      return route.abort();
    }

    qaRequests++;

    if (signPhoto) {
      signedRequests++;
    }

    return route.continue();
  });

  await page.goto(origin, {
    waitUntil: 'domcontentloaded',
    timeout: 30000
  });

  await page.locator('#authGate').waitFor({
    state: 'visible',
    timeout: 20000
  });

  assert.equal(
    await page.evaluate(
      () => window.ROOMS_SUPABASE?.url
    ),
    QA_URL
  );

  console.log('OK Login visible en Chromium');
  console.log('OK Navegador utiliza Supabase QA');

  await page.locator('#authEmail').fill(
    credentials.ROOMS_TEST_EMAIL
  );

  await page.locator('#authPassword').fill(
    credentials.ROOMS_TEST_PASSWORD
  );

  await page.locator('#authSubmit').click();

  await page.locator('#authGate').waitFor({
    state: 'hidden',
    timeout: 30000
  });

  console.log('OK Login desde la interfaz de ROOMS');

  await page.waitForFunction(
    () => !document.body.classList.contains(
      'rooms-booting'
    ),
    null,
    { timeout: 30000 }
  );

  await delay(1200);

  const status = await page.evaluate(() => ({
    onboardingVisible: (() => {
      const el = document.querySelector('#onboarding');
      return Boolean(
        el &&
        !el.hidden &&
        getComputedStyle(el).display !== 'none'
      );
    })(),
    authHidden:
      document.querySelector('#authGate')?.hidden === true,
    photoModulesReady: Boolean(
      window.ROOMS_LISTING_PHOTO_PRESENTATION &&
      window.ROOMS_LISTING_PHOTO_DOM_GUARD &&
      window.ROOMS_LISTING_PHOTO_RENEWAL
    ),
    visibleListingCards:
      document.querySelectorAll(
        '[data-real-listing]'
      ).length,
    signedImages:
      document.querySelectorAll(
        'img[src*="/storage/v1/object/sign/listing-images/"]'
      ).length,
    publicImages:
      document.querySelectorAll(
        'img[src*="/storage/v1/object/public/listing-images/"]'
      ).length
  }));

  console.log('=== ESTADO REAL DEL FRONTEND QA ===');
  console.log(
    'Onboarding visible:',
    status.onboardingVisible
  );
  console.log(
    'Tarjetas de viviendas en DOM:',
    status.visibleListingCards
  );
  console.log(
    'Imagenes firmadas en DOM:',
    status.signedImages
  );
  console.log(
    'Solicitudes de firma a QA:',
    signedRequests
  );
  console.log(
    'Peticiones permitidas a QA:',
    qaRequests
  );

  assert.equal(status.authHidden, true);
  assert.equal(status.photoModulesReady, true);
  assert.equal(status.publicImages, 0);

  console.log('OK Modulos fotograficos disponibles');
  console.log('OK Sin URLs publicas de viviendas en DOM');

  if (unsafeRequests.length) {
    console.log(
      'Peticiones bloqueadas:',
      unsafeRequests
    );
  }

  assert.deepEqual(
    unsafeRequests,
    [],
    'Se detectaron peticiones fuera de QA o no permitidas'
  );

  console.log('OK Sin peticiones fuera de QA');
  console.log('OK Sin escrituras directas detectadas');

  if (pageErrors.length) {
    console.log(
      'Errores JS:',
      pageErrors.slice(0, 8)
    );
  }

  assert.deepEqual(
    pageErrors,
    [],
    'Errores JavaScript durante la sesion'
  );

  console.log('OK Sin errores JavaScript');

  if (status.onboardingVisible) {
    throw new Error(
      'La cuenta QA requiere onboarding; no se valida todavia el feed autenticado'
    );
  }

  console.log('OK Cuenta QA accede sin onboarding');
  console.log('OK M8.72 SESION AUTENTICADA VALIDADA');

  if (!status.signedImages && !signedRequests) {
    console.log(
      'AVISO: sin fotografias QA para validar Storage real'
    );
  }

} catch (error) {
  console.error(
    'ERROR M8.72:',
    error?.message || String(error)
  );

  process.exitCode = 1;
} finally {
  if (browser) {
    await browser.close().catch(() => {});
  }

  server.kill('SIGTERM');
}
