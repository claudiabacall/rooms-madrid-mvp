import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 390, height: 844 }
});

const errors = [];
let signupRequests = 0;

page.on('pageerror', error => errors.push(error.message));

page.on('request', request => {
  if (
    new URL(request.url()).pathname.includes('/auth/v1/signup')
  ) {
    signupRequests++;
  }
});

try {
  await page.goto('http://127.0.0.1:4173/');

  await page.locator('#authGate')
    .waitFor({ state: 'visible', timeout: 20000 });

  await page.locator('[data-auth-mode="signup"]').click();

  const checkbox = page.locator('#authConfirmAdult');

  await checkbox.waitFor({ state: 'visible' });

  assert.equal(await checkbox.isChecked(), false);
  console.log('OK Casilla visible y desmarcada');

  await checkbox.check();
  assert.equal(await checkbox.isChecked(), true);
  console.log('OK Usuario puede declarar mayoria de edad');

  await page.locator('[data-auth-mode="login"]').click();
  await page.locator('[data-auth-mode="signup"]').click();

  assert.equal(await checkbox.isChecked(), false);
  console.log('OK Declaracion reiniciada al cambiar de modo');

  await page.locator('#authName').fill('ROOMS QA');
  await page.locator('#authEmail')
    .fill('adult-ui-test@example.invalid');
  await page.locator('#authPassword')
    .fill('PruebaSegura123!');

  await page.locator('#authSubmit').click();

  await page.locator('#authMessage')
    .getByText(/registro está temporalmente cerrado/i)
    .waitFor({ state: 'visible' });

  assert.equal(signupRequests, 0);
  console.log('OK Ninguna solicitud de alta enviada');

  await page.locator('[data-auth-mode="login"]').click();

  assert.equal(
    await page.locator('#authSignupLegal').isHidden(),
    true
  );

  assert.deepEqual(errors, []);
  console.log('OK Login disponible y sin errores JavaScript');

  console.log('ROOMS SIGNUP ADULT UI OK');

} catch (error) {
  console.error('FALLO:', error.message);
  console.error('Errores JS:', errors);
  process.exitCode = 1;
} finally {
  await browser.close();
}
