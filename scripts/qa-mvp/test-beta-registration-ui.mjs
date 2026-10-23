import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = 'http://127.0.0.1:4173';
const browser = await chromium.launch({ headless: true });

const documents = [
  {
    document_type: 'terms',
    version: 'beta-1.0',
    document_url:
      'https://rooms-madrid-app.vercel.app/assets/legal/condiciones.html',
    document_sha256:
      '452310a6efaa84082cd1fef2bbd0d7cd76ee3f997d124f4f75f8e518a33d12ed'
  },
  {
    document_type: 'privacy',
    version: 'beta-1.0',
    document_url:
      'https://rooms-madrid-app.vercel.app/assets/legal/privacidad.html',
    document_sha256:
      'b5dd80b5af104145fe57334b026e4f0f1bb47541186985a54c1bc2fb1403a75a'
  }
];

async function runScenario(name, rows, expectedEnabled) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }
  });
  const page = await context.newPage();
  const errors = [];
  let legalQueries = 0;
  let signupRequests = 0;

  page.on('pageerror', error => errors.push(error.message));

  await page.route('**/auth/v1/signup**', async route => {
    signupRequests++;
    await route.abort();
  });

  await page.route(
    '**/rest/v1/legal_document_versions**',
    async route => {
      legalQueries++;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(rows)
      });
    }
  );

  try {
    await page.goto(base);

    await page.locator('#authGate').waitFor({
      state: 'visible',
      timeout: 20000
    });

    await page.locator('[data-auth-mode="signup"]').click();

    await page.waitForFunction(() => {
      const notice = document.querySelector('#authLegalNotice');
      const checkbox = document.querySelector('#authAcceptTerms');
      return notice && checkbox &&
        !notice.textContent.includes('Comprobando documentos');
    }, null, { timeout: 20000 });

    assert(legalQueries >= 1, 'Falta consulta legal');

    const terms = page.locator('#authTermsLink');
    const privacy = page.locator('#authPrivacyLink');
    const checkbox = page.locator('#authAcceptTerms');

    assert.equal(await terms.isVisible(), true);
    assert.equal(await privacy.isVisible(), true);

    assert.match(
      await terms.getAttribute('href'),
      /\/assets\/legal\/condiciones\.html$/
    );
    assert.match(
      await privacy.getAttribute('href'),
      /\/assets\/legal\/privacidad\.html$/
    );

    assert.equal(
      await checkbox.isEnabled(),
      expectedEnabled
    );

    assert.equal(
      await page.locator('#authConfirmAdult').isChecked(),
      false
    );

    assert.equal(await checkbox.isChecked(), false);

    if (expectedEnabled) {
      await page.locator('#authLegalNotice').waitFor({
        state: 'hidden',
        timeout: 15000
      });

      await checkbox.check();
      await page.locator('#authConfirmAdult').check();

      assert.equal(await checkbox.isChecked(), true);
      assert.equal(
        await page.locator('#authConfirmAdult').isChecked(),
        true
      );

      console.log('OK Documentos vigentes y consentimiento habilitado');
      console.log('OK Aviso redundante oculto');
    } else {
      await page.locator('#authLegalNotice').waitFor({
        state: 'visible',
        timeout: 15000
      });

      assert.match(
        await page.locator('#authLegalNotice').textContent(),
        /registro cerrado/i
      );

      console.log('OK Registro bloqueado sin documentos vigentes');
      console.log('OK Motivo de bloqueo visible');
    }

    assert.equal(signupRequests, 0);
    assert.deepEqual(errors, []);
    console.log('OK Sin altas reales ni errores JavaScript:', name);

  } finally {
    await context.close();
  }
}

try {
  await runScenario(
    'documentos vigentes',
    documents,
    true
  );

  await runScenario(
    'documentos no vigentes',
    [],
    false
  );

  console.log('ROOMS BETA REGISTRATION UI OK');
} finally {
  await browser.close();
}
