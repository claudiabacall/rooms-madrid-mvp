import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const ROOT = 'http://127.0.0.1:4173/';
function credentials(file) {
  return Object.fromEntries(readFileSync(file, 'utf8').split(/\r?\n/)
    .filter(line => line.includes('='))
    .map(line => { const i = line.indexOf('='); return [line.slice(0, i), line.slice(i + 1)]; }));
}
const users = [credentials('.env.rooms-test.local'), credentials('.env.rooms-test-b.local')];
const browser = await chromium.launch({ headless: true });
const contexts = [];
const errors = [];

async function signIn(creds, label) {
  const context = await browser.newContext();
  contexts.push(context);
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(`${label}: ${error.message}`));
  await page.goto(ROOT);
  await page.locator('#authGate').waitFor({ state: 'visible', timeout: 20000 });
  await page.locator('#authEmail').fill(creds.ROOMS_TEST_EMAIL);
  await page.locator('#authPassword').fill(creds.ROOMS_TEST_PASSWORD);
  await page.locator('#authSubmit').click();
  await page.locator('#authGate').waitFor({ state: 'hidden', timeout: 25000 });
  await page.waitForFunction(() => window.roomsBackend?.state?.user && window.roomsBackend?.state?.roomsDna, { timeout: 25000 });
  console.log(`OK Login ${label} y DNA cargado`);
  return page;
}

async function inspect(page, targetId, label) {
  const result = await page.evaluate(async id => {
    const { db, state } = window.roomsBackend;
    const { data: target, error } = await db.rpc('get_match_profile', { target_user_id: id });
    if (error) return { rpcError: { code: error.code, message: error.message } };
    if (!target) return { targetFound: false };
    const own = state.roomsDna;
    const authorized = target.living_visible === true &&
      !!target.dna_dimensions && typeof target.dna_dimensions === 'object' &&
      !Array.isArray(target.dna_dimensions);
    const computed = own?.model_version === 2 && authorized && window.ROOMS_MATCH_V2
      ? window.ROOMS_MATCH_V2.calculate(own.dimensions, target.dna_dimensions)
      : null;
    return {
      targetFound: true,
      ownDnaVersion: own?.model_version ?? null,
      targetLivingVisible: target.living_visible === true,
      targetDimensionsExposed: authorized ? Object.keys(target.dna_dimensions).length : 0,
      comparedDimensions: computed?.comparedDimensions ?? 0,
      sufficientEvidence: computed?.sufficientEvidence === true,
      livingScore: typeof computed?.score === 'number' ? computed.score : null,
      reason: !authorized ? 'Privacidad o dimensiones no compartidas' :
        !computed?.sufficientEvidence ? 'Evidencia insuficiente' : null
    };
  }, targetId);
  console.log(`${label}: ${JSON.stringify(result)}`);
  if (result.rpcError || !result.targetFound) throw new Error(`${label}: RPC fallida o perfil no disponible`);
  if (result.livingScore !== null && (result.livingScore < 0 || result.livingScore > 100)) {
    throw new Error(`${label}: porcentaje fuera de rango`);
  }
  return result;
}

try {
  const a = await signIn(users[0], 'A');
  const b = await signIn(users[1], 'B');
  const ids = await Promise.all([a, b].map(p => p.evaluate(() => window.roomsBackend.state.user.id)));
  const ab = await inspect(a, ids[1], 'MATCH A -> B');
  const ba = await inspect(b, ids[0], 'MATCH B -> A');
  if (errors.length) throw new Error('Errores JavaScript: ' + errors.join(' | '));
  if (ab.livingScore !== null && ba.livingScore !== null) {
    console.log('RESULTADO: MATCHING REAL BIDIRECCIONAL SUPERADO');
  } else {
    console.log('RESULTADO: RPC SUPERADA; MATCHING NUMERICO PENDIENTE POR PRIVACIDAD/EVIDENCIA');
    process.exitCode = 2;
  }
} catch (e) {
  console.error('FALLO:', e.message);
  process.exitCode = 1;
} finally {
  await Promise.all(contexts.map(c => c.close()));
  await browser.close();
}
