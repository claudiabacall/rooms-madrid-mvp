import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const env = Object.fromEntries(
  readFileSync('.env.rooms-test.local', 'utf8')
    .split(/\r?\n/)
    .filter(line => /^[A-Za-z_][A-Za-z_0-9]*=/.test(line))
    .map(line => {
      const i = line.indexOf('=');
      return [
        line.slice(0, i),
        line.slice(i + 1).trim().replace(/^['"]|['"]$/g, '')
      ];
    })
);

assert(env.ROOMS_TEST_EMAIL && env.ROOMS_TEST_PASSWORD,
  'Faltan credenciales QA');

const readOnlyRpcs = new Set([
  'get_visible_profiles',
  'get_visible_profiles_v2',
  'get_profile_visibility',
  'get_household_members',
  'get_match_profile'
]);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true
});

const errors = [];
const unexpectedWrites = [];

page.on('pageerror', error => errors.push(error.message));

page.on('request', request => {
  const method = request.method();
  const path = new URL(request.url()).pathname;

  if (!path.startsWith('/rest/v1/')) return;

  const rpc = path.startsWith('/rest/v1/rpc/')
    ? path.split('/').pop()
    : null;

  if (
    !['GET', 'HEAD', 'OPTIONS'].includes(method) &&
    !(method === 'POST' && readOnlyRpcs.has(rpc))
  ) {
    unexpectedWrites.push({ method, path });
  }
});

async function step(name, callback) {
  await callback();
  console.log(`OK ${name}`);
}

try {
  await page.goto('http://127.0.0.1:4173/');

  await step('1. Login real', async () => {
    await page.locator('#authGate')
      .waitFor({ state: 'visible', timeout: 20000 });

    await page.locator('#authEmail')
      .fill(env.ROOMS_TEST_EMAIL);

    await page.locator('#authPassword')
      .fill(env.ROOMS_TEST_PASSWORD);

    await page.locator('#authSubmit').click();

    await page.locator('#authGate')
      .waitFor({ state: 'hidden', timeout: 30000 });
  });

  await step('2. Perfil propio', async () => {
    await page.locator('[data-bottom-nav="profile"]')
      .click();

    await page.locator('.own-profile-main')
      .waitFor({ state: 'visible', timeout: 15000 });
  });

  await step('3. Explorar viviendas', async () => {
    await page.locator('[data-bottom-nav="explore"]')
      .click();

    await page.locator('#exploreView')
      .waitFor({ state: 'visible', timeout: 15000 });

    await page.locator('[data-explore-mode="homes"]')
      .click();

    await page.locator(
      '#exploreList .explore-property-card'
    ).first().waitFor({
      state: 'visible',
      timeout: 15000
    });
  });

  await step('4. Explorar personas', async () => {
    await page.locator('[data-explore-mode="people"]')
      .click();

    await page.locator('[data-real-user]:visible')
      .first().waitFor({
        state: 'visible',
        timeout: 15000
      });
  });

  await step('5. Consultar matching real', async () => {
    await page.locator('[data-real-user]:visible')
      .first().click();

    await page.locator('[data-open-real-match]:visible')
      .first().click();

    await page.locator('#matchModal.open')
      .waitFor({ state: 'visible', timeout: 15000 });

    await page.waitForFunction(() => {
      const content = document.querySelector(
        '#realMatchContent'
      );
      return content &&
        content.textContent.trim().length > 30 &&
        !content.textContent.includes('Calculando compatibilidad');
    }, null, { timeout: 20000 });

    const close = page.locator(
      '#matchModal button.close, #matchModal [data-close]'
    ).first();

    await close.click({ timeout: 10000 });

    await page.locator('#matchModal.open')
      .waitFor({ state: 'hidden', timeout: 10000 });

    // Al cerrar matching, ROOMS restaura el perfil de forma
    // asincrona. Esperamos a que termine antes de cerrarlo.
    await page.waitForFunction(() => {
      const modal = document.querySelector('#userProfileModal');
      return modal?.classList.contains('open') &&
        modal.getAttribute('aria-hidden') === 'false' &&
        modal.querySelector('[data-connect]');
    }, null, { timeout: 15000 });

    await page.locator(
      '#userProfileModal.open button.close.profile-back'
    ).click({ timeout: 10000 });

    await page.locator('#userProfileModal.open')
      .waitFor({ state: 'hidden', timeout: 10000 });
  });

  await step('6. Abrir chat aceptado', async () => {
    const accepted = page.locator(
      '[data-connect]:visible'
    ).filter({
      hasText: 'Enviar mensaje'
    }).first();

    await accepted.waitFor({
      state: 'visible',
      timeout: 15000
    });

    await accepted.click();

    await page.locator('#conversationModal.open')
      .waitFor({ state: 'visible', timeout: 15000 });

    await page.waitForFunction(() => {
      const body = document.querySelector(
        '#conversationBody'
      );
      return body &&
        !body.textContent.includes('Cargando conversación');
    }, null, { timeout: 20000 });

    assert(
      (await page.locator('#conversationBody')
        .innerText()).trim().length > 0,
      'Historial de chat vacío'
    );
  });

  assert.deepEqual(
    unexpectedWrites, [],
    'Se detectaron escrituras no previstas'
  );

  assert.deepEqual(
    errors, [],
    'Se detectaron errores JavaScript'
  );

  console.log('OK Sin escrituras inesperadas');
  console.log('OK Sin errores JavaScript');
  console.log('');
  console.log('ROOMS M3 - RECORRIDO CONTINUO SUPERADO');

} catch (error) {
  console.error('FALLO M3:', error.message);
  console.error(
    'Peticiones no previstas:',
    JSON.stringify(unexpectedWrites)
  );
  console.error('Errores JS:', JSON.stringify(errors));
  process.exitCode = 1;
} finally {
  await browser.close();
}
