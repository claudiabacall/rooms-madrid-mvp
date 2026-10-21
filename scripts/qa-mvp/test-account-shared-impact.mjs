import assert from 'node:assert/strict';
import {
  inspectAccountSharedImpact
} from './account-shared-impact.mjs';

const id = '12345678-1234-4234-8234-123456789abc';

function fakeDb(counts = {}) {
  const requests = [];

  return {
    requests,
    from(table) {
      return {
        select(columns, options) {
          assert.equal(columns, '*');
          assert.equal(options.count, 'exact');
          assert.equal(options.head, true);

          return {
            async eq(field, value) {
              requests.push({ table, field, value });

              const result = Object.hasOwn(counts, table)
                ? counts[table]
                : 0;

              return result instanceof Error
                ? {
                    count: null,
                    error: { message: result.message }
                  }
                : { count: result, error: null };
            }
          };
        }
      };
    }
  };
}

const db = fakeDb({
  communities: 1,
  households: 0,
  community_members: 2,
  household_members: 1
});

const impact = await inspectAccountSharedImpact(db, id);

assert.deepEqual(impact, {
  ownedCommunities: 1,
  ownedHouseholds: 0,
  communityMembersAffected: 2,
  householdMembersAffected: 1
});

assert.deepEqual(
  db.requests.map(r => `${r.table}.${r.field}`),
  [
    'communities.owner_id',
    'households.owner_id',
    'community_members.user_id',
    'household_members.user_id'
  ]
);

console.log('OK Cuatro dependencias consultadas');

await assert.rejects(
  inspectAccountSharedImpact(
    fakeDb({ community_members: new Error('Acceso denegado') }),
    id
  ),
  /No se pudo consultar/
);

console.log('OK Errores de Supabase rechazados');

await assert.rejects(
  inspectAccountSharedImpact(
    fakeDb({ households: null }),
    id
  ),
  /Recuento no verificable/
);

console.log('OK Recuentos nulos rechazados');

await assert.rejects(
  inspectAccountSharedImpact(fakeDb(), id),
  /Inspeccion incompleta/
);

console.log('OK Ausencia de relaciones no autoriza baja');

await assert.rejects(
  inspectAccountSharedImpact(fakeDb(), 'invalido'),
  /Identificador de usuario no valido/
);

console.log('OK UUID validado');
console.log('ROOMS ACCOUNT SHARED IMPACT OK');
