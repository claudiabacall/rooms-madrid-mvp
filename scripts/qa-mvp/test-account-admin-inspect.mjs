import assert from 'node:assert/strict';
import {
  inspectDisposableAccount
} from './account-admin-inspect.mjs';

const id = '12345678-1234-4234-8234-123456789abc';
const config = {
  url: 'https://example.supabase.co',
  key: 'TEST_ONLY_NOT_A_REAL_KEY'
};

const user = {
  id,
  email: 'rooms-delete-qa-test@example.com',
  user_metadata: { rooms_deletion_test: true }
};

function fixture({
  counts = {},
  account = user,
  failTable = null
} = {}) {
  const calls = [];

  async function fetchImpl(url, options = {}) {
    const parsed = new URL(url);
    const method = options.method || 'GET';

    calls.push({
      method,
      path: parsed.pathname,
      search: parsed.search
    });

    assert(['GET', 'HEAD'].includes(method));
    assert.equal(options.headers.apikey, config.key);

    if (parsed.pathname.startsWith('/auth/v1/admin/users/')) {
      return new Response(JSON.stringify(account), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    }

    if (parsed.pathname.startsWith('/rest/v1/')) {
      const table = parsed.pathname.split('/').at(-1);

      if (table === failTable) {
        return new Response(null, { status: 403 });
      }

      const count = counts[table] ?? 0;

      return new Response(null, {
        status: 200,
        headers: {
          'content-range': `*/${count}`
        }
      });
    }

    throw new Error('Ruta administrativa inesperada');
  }

  return { calls, fetchImpl };
}

const owned = fixture({
  counts: {
    communities: 1,
    households: 0,
    community_members: 0,
    household_members: 0
  }
});

const result = await inspectDisposableAccount({
  targetId: id,
  config,
  fetchImpl: owned.fetchImpl
});

assert.equal(result.mode, 'READ_ONLY');
assert.equal(result.deletionAuthorized, false);
assert.equal(result.impact.ownedCommunities, 1);
assert.equal(owned.calls.length, 5);

assert(
  owned.calls.every(call =>
    ['GET', 'HEAD'].includes(call.method)
  )
);

console.log('OK Solo GET y HEAD; ninguna escritura');
console.log('OK Propietario detectado sin autorizar baja');

const empty = fixture();

const emptyResult = await inspectDisposableAccount({
  targetId: id,
  config,
  fetchImpl: empty.fetchImpl
});

assert.equal(emptyResult.deletionAuthorized, false);
assert.match(emptyResult.blockedReason, /Inspeccion incompleta/);

console.log('OK Cero relaciones no autoriza eliminacion');

const invalid = fixture();

await assert.rejects(
  inspectDisposableAccount({
    targetId: 'invalido',
    config,
    fetchImpl: invalid.fetchImpl
  }),
  /UUID de cuenta no valido/
);

assert.equal(invalid.calls.length, 0);

console.log('OK UUID invalido rechazado sin consultar');

const protectedAccount = fixture({
  account: {
    ...user,
    user_metadata: {}
  }
});

await assert.rejects(
  inspectDisposableAccount({
    targetId: id,
    config,
    fetchImpl: protectedAccount.fetchImpl
  }),
  /marcada para pruebas de eliminacion/
);

assert.equal(protectedAccount.calls.length, 1);

console.log('OK Cuenta no desechable rechazada');

const denied = fixture({ failTable: 'communities' });

const deniedResult = await inspectDisposableAccount({
  targetId: id,
  config,
  fetchImpl: denied.fetchImpl
});

assert.equal(deniedResult.deletionAuthorized, false);
assert.match(
  deniedResult.blockedReason,
  /Consulta administrativa fallida/
);

console.log('OK Error administrativo impide autorizar baja');
console.log('ROOMS ADMIN READ-ONLY INSPECTOR OK');
