import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { chromium } from 'playwright';

const ROOT = 'http://127.0.0.1:4173/';
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
  throw new Error('Faltan credenciales QA A');
}

const name = `ROOMS QA TRIGGER ${randomUUID()}`;
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
let communityId = null;
let ownerId = null;
let cleaned = false;
let failure = null;

async function dbCall(operation, args) {
  return page.evaluate(async ({ operation, args }) => {
    const db = window.roomsBackend.db;

    if (operation === 'create') {
      const { data, error } = await db.rpc('create_community', {
        _name: args.name,
        _description: 'Prueba temporal del trigger owner',
        _visibility: 'public'
      });
      return { data, error: error?.message || null };
    }

    if (operation === 'find') {
      const { data, error } = await db.from('communities')
        .select('id,owner_id')
        .eq('name', args.name)
        .eq('owner_id', args.ownerId)
        .limit(2);
      return { data, error: error?.message || null };
    }

    if (operation === 'members') {
      const { data, error } = await db.from('community_members')
        .select('user_id,role,status')
        .eq('community_id', args.id);
      return { data, error: error?.message || null };
    }

    if (operation === 'delete') {
      const { data, error } = await db.from('communities')
        .delete()
        .eq('id', args.id)
        .eq('owner_id', args.ownerId)
        .select('id');
      return { data, error: error?.message || null };
    }
  }, { operation, args });
}

function requireOk(result, label) {
  if (result?.error) throw new Error(`${label}: ${result.error}`);
  return result.data;
}

try {
  await page.goto(ROOT);
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

  ownerId = await page.evaluate(
    () => window.roomsBackend.state.user.id
  );
  console.log('OK Login QA A');

  const created = requireOk(
    await dbCall('create', { name }),
    'Crear comunidad'
  );

  communityId = created?.id;
  if (!communityId || created.owner_id !== ownerId) {
    throw new Error('RPC no devolvio comunidad propia valida');
  }
  console.log('OK Comunidad temporal creada');

  const members = requireOk(
    await dbCall('members', { id: communityId }),
    'Consultar miembros'
  );

  if (!members.some(m =>
    m.user_id === ownerId &&
    m.role === 'owner' &&
    m.status === 'active'
  )) {
    throw new Error('Trigger no creo owner activo');
  }

  console.log('OK Trigger creo propietario activo');
} catch (error) {
  failure = error.message;
  console.error('FALLO:', failure);
} finally {
  try {
    if (ownerId) {
      const matches = requireOk(
        await dbCall('find', { name, ownerId }),
        'Localizar comunidad QA para limpieza'
      );

      if (matches.length > 1) {
        throw new Error('Mas de una comunidad con nombre QA unico');
      }

      for (const community of matches) {
        const deleted = requireOk(
          await dbCall('delete', {
            id: community.id,
            ownerId
          }),
          'Eliminar comunidad temporal'
        );

        if (deleted.length !== 1) {
          throw new Error('Eliminacion no confirmada');
        }
      }

      const remaining = requireOk(
        await dbCall('find', { name, ownerId }),
        'Verificar eliminacion'
      );

      if (remaining.length !== 0) {
        throw new Error('Comunidad temporal sigue existiendo');
      }

      if (communityId) {
        const members = requireOk(
          await dbCall('members', { id: communityId }),
          'Verificar membresias eliminadas'
        );

        if (members.length !== 0) {
          throw new Error('Persisten membresias de la comunidad');
        }
      }

      cleaned = true;
      console.log('OK Comunidad temporal eliminada');
      console.log('OK Limpieza verificada');
    }
  } catch (error) {
    failure ||= 'La limpieza no pudo verificarse';
    console.error('CRITICO LIMPIEZA:', error.message);
  }

  await browser.close();
}

if (failure || !cleaned) {
  console.error('RESULTADO: PRUEBA NO SUPERADA');
  process.exitCode = 1;
} else {
  console.log('RESULTADO: TRIGGER COMMUNITY OWNER SUPERADO');
}
