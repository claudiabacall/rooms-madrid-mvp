import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

function loadEnv(path) {
  const values = Object.fromEntries(readFileSync(path, 'utf8').split(/\r?\n/).filter(x => x.includes('=')).map(line => {
    const i = line.indexOf('='); return [line.slice(0,i), line.slice(i+1)];
  }));
  if (!values.ROOMS_TEST_EMAIL || !values.ROOMS_TEST_PASSWORD) throw Error('Faltan credenciales QA en ' + path);
  return values;
}
const A = loadEnv('.env.rooms-test.local');
const B = loadEnv('.env.rooms-test-b.local');
const base = 'http://127.0.0.1:4173/';
const browser = await chromium.launch({ headless: true });
const ctxA = await browser.newContext();
const ctxB = await browser.newContext();
const a = await ctxA.newPage();
const b = await ctxB.newPage();
const errors = [];
for (const [label,page] of [['A',a],['B',b]]) {
  page.on('pageerror', e => errors.push(`${label}: ${e.message}`));
  page.on('response', async r => {
    if (r.status() >= 400 && /\/rest\/v1\/(household_invitations|household_members|rpc\/(get_household_invitation|accept_household_invitation))/.test(new URL(r.url()).pathname)) {
      let payload = {};
      try { const p = await r.json(); payload = { code:p.code, message:p.message }; } catch {}
      errors.push(`${label}: HTTP ${r.status()} ${new URL(r.url()).pathname} ${JSON.stringify(payload)}`);
    }
  });
}
async function login(page, env, label) {
  await page.goto(base);
  await page.locator('#authGate').waitFor({state:'visible',timeout:20000});
  await page.locator('#authEmail').fill(env.ROOMS_TEST_EMAIL);
  await page.locator('#authPassword').fill(env.ROOMS_TEST_PASSWORD);
  await page.locator('#authSubmit').click();
  await page.locator('#authGate').waitFor({state:'hidden',timeout:30000});
  await page.waitForFunction(() => !!window.roomsBackend?.state?.user, { timeout:30000 });
  console.log(`OK Login ${label}`);
}
try {
  await login(a,A,'A');
  const selected = await a.evaluate(async () => {
    const db = window.roomsBackend.db;
    const { data: auth, error: authError } = await db.auth.getUser();

    if (authError || !auth?.user) {
      throw new Error('Usuario A no autenticado');
    }

    const { data, error } = await db
      .from('households')
      .select('id,name,owner_id')
      .eq('owner_id', auth.user.id)
      .like('name', 'ROOMS QA HOGAR %')
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      throw new Error('Supabase households: ' + error.message);
    }

    return data?.[0]
      ? { id: data[0].id, name: data[0].name }
      : null;
  });
  if (!selected) throw Error('No hay hogar QA propio del usuario A; no se creara ni modificara otro hogar');
  console.log('OK Hogar QA propio localizado');
  await a.locator('[data-bottom-nav="communities"]').click();
  await a.locator(`[data-open-search-group="${selected.id}"]`).click();
  await a.locator('#householdView').waitFor({state:'visible', timeout:20000});
  await a.locator('#inviteRealHouseholdSmall, #inviteRealHouseholdMembers, #inviteRealHousehold').first().click();
  await a.locator('#householdInviteModal.open').waitFor({state:'visible'});
  const createResponse = a.waitForResponse(r => new URL(r.url()).pathname === '/rest/v1/household_invitations' && r.request().method() === 'POST', {timeout:20000});
  await a.locator('#generateHouseholdInvite').click();
  const resp = await createResponse;
  if (!resp.ok()) throw Error(`Creacion invitacion: HTTP ${resp.status()}`);
  const inviteUrl = await a.locator('#householdInviteLink').inputValue();
  if (!inviteUrl || !new URL(inviteUrl).searchParams.get('invite')) throw Error('El enlace de invitacion no contiene token');
  console.log('OK Invitacion creada (token privado, no mostrado)');

  await login(b,B,'B');
  await b.goto(inviteUrl, {waitUntil:'load'});
  await b.locator('#incomingHouseholdInviteModal.open').waitFor({state:'visible',timeout:30000});
  console.log('OK Usuario B recibe invitacion');
  const acceptance = b.waitForResponse(r => new URL(r.url()).pathname === '/rest/v1/rpc/accept_household_invitation', {timeout:30000});
  await b.locator('#acceptHouseholdInvite').click();
  const accepted = await acceptance;
  if (!accepted.ok()) throw Error(`Aceptar invitacion: HTTP ${accepted.status()}`);
  await b.locator('#incomingHouseholdInviteModal').waitFor({state:'hidden',timeout:30000});
  console.log('OK Usuario B acepta invitacion');

  const membership = await b.evaluate(async groupId => {
    const db = window.roomsBackend.db;
    const {data:user,error:userError} = await db.auth.getUser();
    if (userError || !user?.user) return {valid:false, error:userError?.message ?? 'Sin usuario'};
    const {data,error} = await db.from('household_members').select('role,status').eq('household_id',groupId).eq('user_id',user.user.id).maybeSingle();
    return {valid:!!data && data.status === 'accepted',role:data?.role ?? null,status:data?.status ?? null,error:error?.message ?? null};
  }, selected.id);
  console.log('MEMBRESIA B:', JSON.stringify(membership));
  if (!membership.valid) throw Error('No se recupera la membresia aceptada del usuario B');
  await b.reload();
  await b.waitForFunction(() => !!window.roomsBackend?.state?.user, {timeout:30000});
  const persists = await b.evaluate(async groupId => {
    const {data,error} = await window.roomsBackend.db.from('household_members').select('status').eq('household_id',groupId).eq('user_id',window.roomsBackend.state.user.id).maybeSingle();
    return !error && data?.status === 'accepted';
  }, selected.id);
  if (!persists) throw Error('La membresia no persiste despues de recargar');
  console.log('OK Membresia persistente tras recarga');
  if (errors.length) throw Error(errors.join('\n'));
  console.log('RESULTADO: INVITACION REAL A -> B E2E SUPERADA');
} catch (e) {
  console.error('FALLO:', e.message);
  if(errors.length) console.log('ERRORES DETECTADOS:',JSON.stringify(errors));
  process.exitCode = 1;
} finally { await browser.close(); }
