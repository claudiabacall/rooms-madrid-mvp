import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
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

if (!env.ROOMS_TEST_EMAIL || !env.ROOMS_TEST_PASSWORD) {
  throw new Error('Credenciales QA A incompletas');
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
let passed = false;

try {
  await page.goto('http://127.0.0.1:4173/');
  await page.locator('#authGate').waitFor({
    state: 'visible',
    timeout: 20000
  });
  await page.locator('#authEmail').fill(env.ROOMS_TEST_EMAIL);
  await page.locator('#authPassword').fill(env.ROOMS_TEST_PASSWORD);
  await page.locator('#authSubmit').click();
  await page.locator('#authGate').waitFor({
    state: 'hidden',
    timeout: 30000
  });
  await page.waitForFunction(
    () => Boolean(window.roomsBackend?.state?.user),
    null,
    { timeout: 30000 }
  );

  console.log('OK Login QA A');

  const result = await page.evaluate(async candidateId => {
    const db = window.roomsBackend.db;
    const userId = window.roomsBackend.state.user.id;

    const { data: groups, error: groupError } = await db
      .from('households')
      .select('id')
      .eq('owner_id', userId)
      .like('name', 'ROOMS QA HOGAR %')
      .limit(1);

    if (groupError) {
      return { error: groupError.message };
    }

    if (!groups?.length) {
      return { error: 'No hay hogar QA propio' };
    }

    const householdId = groups[0].id;

    const { data, error } = await db
      .from('household_candidate_votes')
      .insert({
        household_id: householdId,
        user_id: userId,
        candidate_type: 'listing',
        candidate_id: candidateId,
        vote: 'like'
      })
      .select('household_id');

    return {
      data,
      error: error
        ? { code: error.code, message: error.message }
        : null
    };
  }, randomUUID());

  if (typeof result.error === 'string') {
    throw new Error(result.error);
  }

  if (!result.error) {
    throw new Error(
      'CRITICO: se ha aceptado un voto con candidato inexistente'
    );
  }

  if (!result.error.message?.includes(
    'Listing candidate does not exist in this household'
  )) {
    throw new Error(
      `Rechazo no atribuible al trigger: ${result.error.code} ${result.error.message}`
    );
  }

  console.log('OK Trigger rechazo candidato inexistente');
  console.log('OK Insercion invalida bloqueada por PostgreSQL');
  passed = true;
} catch (error) {
  console.error('FALLO:', error.message);
  process.exitCode = 1;
} finally {
  await browser.close();
}

if (passed) {
  console.log('RESULTADO: TRIGGER HOUSEHOLD VOTE SUPERADO');
}
