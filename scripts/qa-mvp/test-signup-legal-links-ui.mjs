import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 390, height: 844 }
});

const errors = [];
let signupRequests = 0;
let legalRequests = 0;

page.on('pageerror', error => errors.push(error.message));

page.on('request', request => {
  const pathname = new URL(request.url()).pathname;

  if (pathname.includes('/auth/v1/signup')) {
    signupRequests++;
  }

  if (pathname.includes('/rest/v1/legal_document_versions')) {
    legalRequests++;
  }
});

try {
  await page.goto('http://127.0.0.1:4173/');

  await page.locator('#authGate').waitFor({
    state: 'visible',
    timeout: 20000
  });

  await page.locator('[data-auth-mode="signup"]').click();

  await page.locator('#authLegalNotice').waitFor({
    state: 'visible'
  });

  await page.waitForFunction(() => {
    const notice = document.querySelector('#authLegalNotice');
    return notice &&
      !notice.textContent.includes('Comprobando documentos');
  }, null, { timeout: 20000 });

  assert(legalRequests >= 1);
  console.log('OK Consulta legal enviada a Supabase');

  const notice = await page.locator('#authLegalNotice')
    .textContent();

  assert.match(notice, /registro cerrado/i);
  assert.doesNotMatch(notice, /no podemos verificar/i);

  assert.equal(
    await page.locator('#authTermsLink').isHidden(),
    true
  );

  assert.equal(
    await page.locator('#authPrivacyLink').isHidden(),
    true
  );

  assert.equal(
    await page.locator('#authAcceptTerms').isDisabled(),
    true
  );

  console.log('OK Documentos no publicados permanecen ocultos');
  console.log('OK Aceptacion deshabilitada sin documentos');

  await page.locator('#authName').fill('ROOMS QA');
  await page.locator('#authEmail')
    .fill('rooms-legal-ui@example.invalid');
  await page.locator('#authPassword')
    .fill('PruebaSegura123!');

  await page.locator('#authConfirmAdult').check();
  await page.locator('#authSubmit').click();

  assert.equal(signupRequests, 0);
  console.log('OK Ninguna cuenta nueva creada');

  await page.locator('[data-auth-mode="login"]').click();

  assert.equal(
    await page.locator('#authSignupLegal').isHidden(),
    true
  );

  assert.deepEqual(errors, []);
  console.log('OK Login disponible y sin errores JavaScript');

  console.log('ROOMS LEGAL LINKS UI OK');

} catch (error) {
  console.error('FALLO:', error.message);
  console.error('Errores JS:', errors);
  console.error('Consultas legales:', legalRequests);
  process.exitCode = 1;
} finally {
  await browser.close();
}
