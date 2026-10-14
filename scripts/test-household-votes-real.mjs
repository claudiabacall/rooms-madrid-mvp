import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

function env(path) {
  const values = Object.fromEntries(readFileSync(path, 'utf8').split(/\r?\n/).filter(s => s.includes('=')).map(line => { const index = line.indexOf('='); return [line.slice(0, index), line.slice(index + 1)]; }));
  if (!values.ROOMS_TEST_EMAIL || !values.ROOMS_TEST_PASSWORD) throw new Error('Faltan credenciales QA en ' + path);
  return values;
}
const A = env('.env.rooms-test.local');
const B = env('.env.rooms-test-b.local');
const browser = await chromium.launch({ headless: true });
const a = await (await browser.newContext()).newPage();
const b = await (await browser.newContext()).newPage();
const errors = [];
for (const [label, page] of [['A', a], ['B', b]]) {
  page.on('pageerror', e => errors.push(`${label}: ${e.message}`));
}
async function login(page, credentials, label) {
  await page.goto('http://127.0.0.1:4173/');
  await page.locator('#authGate').waitFor({ state: 'visible', timeout: 20000 });
  await page.locator('#authEmail').fill(credentials.ROOMS_TEST_EMAIL);
  await page.locator('#authPassword').fill(credentials.ROOMS_TEST_PASSWORD);
  await page.locator('#authSubmit').click();
  await page.locator('#authGate').waitFor({ state: 'hidden', timeout: 30000 });
  await page.waitForFunction(() => !!window.roomsBackend?.state?.user, { timeout: 30000 });
  console.log('OK Login ' + label);
}
async function query(page, functionText, arg) {
  return page.evaluate(({ source, arg }) => (new Function('arg', `return (${source})(arg)`))(arg), { source: functionText.toString(), arg });
}
async function readVotes(page, groupId, listingId) {
  return page.evaluate(async ({ groupId, listingId }) => {
    const { data, error } = await window.roomsBackend.db.from('household_candidate_votes')
      .select('user_id,vote').eq('household_id', groupId)
      .eq('candidate_type', 'listing').eq('candidate_id', listingId);
    return { votes: data || [], error: error ? { code: error.code, message: error.message } : null };
  }, { groupId, listingId });
}
let groupId, listingId, insertedCandidate = false;
try {
  await login(a, A, 'A');
  await login(b, B, 'B');
  const info = await a.evaluate(async () => {
    const db = window.roomsBackend.db;
    const { data: auth } = await db.auth.getUser();
    const { data: groups, error: groupError } = await db.from('households').select('id,name')
      .eq('owner_id', auth.user.id).like('name', 'ROOMS QA HOGAR %')
      .order('created_at', { ascending: false }).limit(30);
    if (groupError) return { error: groupError.message };
    for (const group of groups || []) {
      const { data: members, error: memberError } = await db.from('household_members')
        .select('user_id,status').eq('household_id', group.id);
      if (memberError) return { error: memberError.message };
      if ((members || []).some(x => x.user_id !== auth.user.id && x.status === 'accepted')) return { groupId: group.id };
    }
    return { error: 'No hay hogar QA con dos miembros aceptados' };
  });
  if (!info.groupId) throw new Error(info.error);
  groupId = info.groupId;
  console.log('OK Hogar QA con dos miembros localizado');

  const candidate = await a.evaluate(async id => {
    const db = window.roomsBackend.db;
    const { data: existing, error: existingError } = await db.from('household_candidates').select('listing_id').eq('household_id', id).limit(1);
    if (existingError) return { error: `Leer candidatos: ${existingError.message}` };
    if (existing?.length) return { listingId: existing[0].listing_id, existing: true };
    const { data: listings, error: listingError } = await db.from('listings').select('id').eq('status', 'published').limit(10);
    if (listingError) return { error: `Leer viviendas: ${listingError.message}` };
    if (!listings?.length) return { error: 'No hay viviendas publicadas para probar' };
    const { data: auth } = await db.auth.getUser();
    const { error } = await db.from('household_candidates').insert({ household_id: id, listing_id: listings[0].id, added_by: auth.user.id });
    return error ? { error: `Insertar candidato: ${error.code} ${error.message}` } : { listingId: listings[0].id, existing: false };
  }, groupId);
  if (!candidate.listingId) throw new Error(candidate.error);
  listingId = candidate.listingId;
  insertedCandidate = !candidate.existing;
  console.log(`OK Candidato de vivienda ${insertedCandidate ? 'anadido' : 'existente'} en hogar QA`);

  async function openGroup(page, label) {
    await page.locator('[data-bottom-nav="communities"]').click();
    await page.locator('#communitiesView').waitFor({ state: 'visible', timeout: 20000 });
    await page.locator(`[data-open-search-group="${groupId}"]`).click();
    await page.locator('#householdView').waitFor({ state: 'visible', timeout: 20000 });
    await page.locator(`[data-household-vote="like"][data-candidate-type="listing"][data-candidate-id="${listingId}"]`).waitFor({ state: 'visible', timeout: 20000 });
    console.log('OK Candidato visible para ' + label);
  }
  await openGroup(a, 'A');
  await openGroup(b, 'B');

  async function castVote(page, expected, label) {
    const selector = `[data-household-vote="${expected}"][data-candidate-type="listing"][data-candidate-id="${listingId}"]`;
    const voteRequest = page.waitForResponse(r => new URL(r.url()).pathname === '/rest/v1/household_candidate_votes' && ['POST','PATCH'].includes(r.request().method()), { timeout: 20000 });
    await page.locator(selector).click();
    const response = await voteRequest;
    if (!response.ok()) {
      let err = {}; try { const data = await response.json(); err = {code:data.code,message:data.message}; } catch {}
      throw new Error(`Voto ${label} HTTP ${response.status()}: ${JSON.stringify(err)}`);
    }
    const user = await page.evaluate(() => window.roomsBackend.state.user.id);
    await page.waitForFunction(async ({ groupId, listingId, user, expected }) => {
      const { data, error } = await window.roomsBackend.db.from('household_candidate_votes').select('vote')
        .eq('household_id',groupId).eq('candidate_type','listing').eq('candidate_id',listingId).eq('user_id',user).maybeSingle();
      return !error && data?.vote === expected;
    }, { groupId, listingId, user, expected }, { timeout: 20000 });
    console.log(`OK ${label} vota ${expected} (HTTP ${response.status()})`);
  }
  // Do not click the same vote twice: that would remove it.
  const oldA = await readVotes(a, groupId, listingId);
  if (oldA.error) throw Error(`Lectura votos: ${oldA.error.message}`);
  const aId = await a.evaluate(() => window.roomsBackend.state.user.id);
  const bId = await b.evaluate(() => window.roomsBackend.state.user.id);
  if (oldA.votes.find(v=>v.user_id===aId)?.vote === 'like' || oldA.votes.find(v=>v.user_id===bId)?.vote === 'maybe') {
    throw Error('El candidato ya tiene uno de los votos previstos. Usa otro hogar/candidato QA para no sobrescribirlos.');
  }
  await castVote(a, 'like', 'A');
  await castVote(b, 'maybe', 'B');
  await a.reload(); await b.reload();
  await Promise.all([a.waitForFunction(() => !!window.roomsBackend?.state?.user), b.waitForFunction(() => !!window.roomsBackend?.state?.user)]);
  const resultA = await readVotes(a, groupId, listingId);
  const resultB = await readVotes(b, groupId, listingId);
  if (resultA.error || resultB.error) throw Error('Falló relectura de votos: ' + JSON.stringify({a:resultA.error,b:resultB.error}));
  for (const [label,result] of [['A', resultA], ['B', resultB]]) {
    if (result.votes.find(x=>x.user_id===aId)?.vote !== 'like' || result.votes.find(x=>x.user_id===bId)?.vote !== 'maybe') {
      throw Error(`No se recuperan ambos votos desde ${label}`);
    }
  }
  console.log('OK Ambos usuarios recuperan los dos votos tras recarga');
  if (errors.length) throw Error('Errores JS: ' + errors.join(' | '));
  console.log('RESULTADO: VOTACIONES A + B E2E SUPERADAS');
} catch (e) {
  console.error('FALLO:', e.message);
  process.exitCode = 1;
} finally {
  await browser.close();
}
