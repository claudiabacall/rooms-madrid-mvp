import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright';

const QA_URL =
  'https://gpfmocptevpyzrwsubkj.supabase.co';

async function freePort() {
  return await new Promise((resolve, reject) => {
    const server = createServer();

    server.once('error', reject);

    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
  });
}

async function waitForServer(url, child) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (child.exitCode !== null) {
      throw new Error('Servidor local terminado antes de arrancar');
    }

    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(1000)
      });

      if (response.ok) return;
    } catch {
      // El servidor todavia no esta escuchando.
    }

    await delay(100);
  }

  throw new Error('Servidor local no disponible');
}

const port = await freePort();
const origin = `http://127.0.0.1:${port}`;

let serverOutput = '';

const server = spawn(process.execPath, ['server.mjs'], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    PORT: String(port),
    ROOMS_SUPABASE_ENV: 'qa'
  },
  stdio: ['ignore', 'pipe', 'pipe']
});

for (const stream of [server.stdout, server.stderr]) {
  stream.on('data', chunk => {
    serverOutput += String(chunk).slice(0, 2000);
    serverOutput = serverOutput.slice(-5000);
  });
}

let browser = null;

try {
  await waitForServer(origin, server);

  console.log('OK Servidor local iniciado en modo QA');

  const configResponse = await fetch(
    `${origin}/assets/js/supabase-config.js`,
    { signal: AbortSignal.timeout(5000) }
  );

  assert.equal(
    configResponse.status,
    200,
    'Configuracion QA no disponible'
  );

  const configBody = await configResponse.text();

  assert.ok(
    configBody.includes(QA_URL),
    'El frontend no apunta al QA esperado'
  );

  assert.match(
    configBody,
    /window\.ROOMS_SUPABASE\s*=/
  );

  assert.ok(
    configBody.includes('"key"'),
    'Falta clave publica de QA'
  );

  console.log('OK Configuracion frontend QA confirmada');
  console.log('OK Sin mostrar credenciales');

  const htmlResponse = await fetch(origin);
  assert.equal(htmlResponse.status, 200);

  const html = await htmlResponse.text();

  const ordered = [
    'listing-photo-cache.js',
    'listing-photo-presentation.js',
    'listing-photo-dom-guard.js',
    'listing-photo-renewal.js',
    'supabase-app.js'
  ];

  let previous = -1;

  for (const name of ordered) {
    const position = html.indexOf(`/${name}"`);

    assert.ok(
      position > previous,
      `Orden de carga incorrecto: ${name}`
    );

    previous = position;
  }

  console.log('OK Orden real de scripts correcto');

  browser = await chromium.launch({ headless: true });

  const context = await browser.newContext({
    serviceWorkers: 'block'
  });

  const page = await context.newPage();

  const pageErrors = [];
  const blockedSupabase = [];
  const failedLocal = [];

  page.on('pageerror', error => {
    pageErrors.push(error.message);
  });

  page.on('requestfailed', request => {
    if (
      request.url().startsWith(origin) &&
      request.failure()
    ) {
      failedLocal.push(request.url());
    }
  });

  await page.route('**/*', async route => {
    const requestUrl = route.request().url();

    let url;

    try {
      url = new URL(requestUrl);
    } catch {
      return route.abort();
    }

    if (
      url.hostname === 'supabase.co' ||
      url.hostname.endsWith('.supabase.co')
    ) {
      blockedSupabase.push(
        `${route.request().method()} ${url.pathname}`
      );

      return route.abort();
    }

    if (
      url.origin === origin ||
      url.protocol === 'data:' ||
      url.hostname === 'cdn.jsdelivr.net' ||
      url.hostname === 'cdnjs.cloudflare.com' ||
      url.hostname === 'unpkg.com'
    ) {
      return route.continue();
    }

    return route.abort();
  });

  await page.goto(origin, {
    waitUntil: 'domcontentloaded',
    timeout: 30000
  });

  await page.waitForFunction(
    () =>
      Boolean(
        window.ROOMS_LISTING_PHOTO_PRESENTATION &&
        window.ROOMS_LISTING_PHOTO_DOM_GUARD &&
        window.ROOMS_LISTING_PHOTO_RENEWAL
      ),
    null,
    { timeout: 20000 }
  );

  console.log('OK Modulos fotograficos cargados en Chromium');

  const status = await page.evaluate(() => {
    const config = window.ROOMS_SUPABASE;

    return {
      qaUrl: config?.url || null,
      authGateExists: Boolean(
        document.querySelector('#authGate')
      ),
      renewalAvailable:
        typeof window.ROOMS_LISTING_PHOTO_RENEWAL?.create ===
        'function',
      guardAvailable:
        typeof window.ROOMS_LISTING_PHOTO_DOM_GUARD?.create ===
        'function',
      presentationAvailable:
        typeof window.ROOMS_LISTING_PHOTO_PRESENTATION?.create ===
        'function'
    };
  });

  assert.equal(status.qaUrl, QA_URL);
  assert.equal(status.authGateExists, true);
  assert.equal(status.renewalAvailable, true);
  assert.equal(status.guardAvailable, true);
  assert.equal(status.presentationAvailable, true);

  console.log('OK Frontend mantiene configuracion QA');
  console.log('OK Pantalla de autenticacion disponible');
  console.log('OK Modulos de renovacion disponibles');

  // Permitir que terminen las tareas de arranque.
  await delay(1500);

  if (pageErrors.length) {
    console.log('ERRORES JS:', pageErrors.slice(0, 8));
  }

  if (failedLocal.length) {
    console.log(
      'PETICIONES LOCALES FALLIDAS:',
      failedLocal.slice(0, 8)
    );
  }

  assert.deepEqual(
    pageErrors,
    [],
    'Errores JavaScript durante el arranque'
  );

  assert.deepEqual(
    failedLocal,
    [],
    'Recursos locales fallidos'
  );

  console.log('OK Sin errores JavaScript');
  console.log('OK Sin recursos locales fallidos');

  if (blockedSupabase.length) {
    console.log(
      'OK Peticiones Supabase bloqueadas:',
      blockedSupabase.length
    );
  } else {
    console.log('OK Sin peticiones a Supabase');
  }

  console.log('OK Sin autenticacion ni escrituras remotas');
  console.log('OK M8.69 ARRANQUE INTEGRAL VALIDADO');

} catch (error) {
  console.error(
    'ERROR M8.69:',
    error?.stack || String(error)
  );

  if (serverOutput) {
    console.log(
      'SALIDA SERVIDOR:',
      serverOutput.slice(-1600)
    );
  }

  process.exitCode = 1;
} finally {
  if (browser) {
    await browser.close().catch(() => {});
  }

  server.kill('SIGTERM');
}
