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

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true
});

let signupRequests = 0;
const pageErrors = [];

page.on('request', request => {
  if (
    new URL(request.url()).pathname.includes('/auth/v1/signup')
  ) {
    signupRequests++;
  }
});

page.on('pageerror', error => {
  pageErrors.push(error.message);
});

try {
  await page.goto('http://127.0.0.1:4173/');

  await page.locator('#authGate')
    .waitFor({ state: 'visible', timeout: 20000 });

  await page.locator('[data-auth-mode="signup"]').click();

  await page.locator('#authSignupLegal')
    .waitFor({ state: 'visible' });

  assert.equal(
    await page.locator('#authAcceptTerms').isChecked(),
    false
  );

  console.log('OK Aviso legal visible en registro');

  await page.locator('#authName').fill('Prueba Legal');
  await page.locator('#authEmail')
    .fill('rooms-legal-test@example.invalid');
  await page.locator('#authPassword')
    .fill('PruebaSegura123!');

  await page.locator('#authAcceptTerms').check();
  await page.locator('#authSubmit').click();

  await page.locator('#authMessage')
    .getByText(/registro está temporalmente cerrado/i)
    .waitFor({ state: 'visible' });

  assert.equal(signupRequests, 0);
  console.log('OK Registro bloqueado sin peticion a Supabase');

  await page.locator('[data-auth-mode="login"]').click();

  await page.locator('#authSignupLegal')
    .waitFor({ state: 'hidden' });

  await page.locator('#authEmail')
    .fill(env.ROOMS_TEST_EMAIL);

  await page.locator('#authPassword')
    .fill(env.ROOMS_TEST_PASSWORD);

  await page.locator('#authSubmit').click();

  await page.locator('#authGate')
    .waitFor({ state: 'hidden', timeout: 30000 });

  await page.locator('.feed-main')
    .waitFor({ state: 'visible', timeout: 30000 });

  assert.equal(signupRequests, 0);
  assert.deepEqual(pageErrors, []);

  console.log('OK Login de cuenta QA sigue funcionando');
  console.log('OK Sin errores JavaScript');
  console.log('ROOMS M4 - REGISTRO LEGAL UI SUPERADO');

} catch (error) {
  console.error('FALLO:', error.message);
  console.error('Peticiones signup:', signupRequests);
  console.error('Errores JS:', JSON.stringify(pageErrors));
  process.exitCode = 1;
} finally {
  await browser.close();
}
