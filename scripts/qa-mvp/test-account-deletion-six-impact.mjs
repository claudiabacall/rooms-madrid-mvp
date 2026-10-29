import test from 'node:test';
import assert from 'node:assert/strict';
import {
  inspectSixSharedImpact
} from './account-deletion-shared-impact.mjs';

const id = '12345678-1234-4234-8234-123456789abc';

function database(counts, errorTable = null) {
  const queries = [];
  return {
    queries,
    from(table) {
      return {
        select(_fields, options) {
          assert.equal(options.count, 'exact');
          assert.equal(options.head, true);
          return {
            async eq(field, value) {
              queries.push({ table, field, value });
              return {
                count: counts[table] ?? null,
                error: table === errorTable
                  ? { message: 'permission denied' }
                  : null
              };
            },
            async or(filter) {
              queries.push({ table, filter });
              return {
                count: counts[table] ?? null,
                error: table === errorTable
                  ? { message: 'permission denied' }
                  : null
              };
            }
          };
        }
      };
    }
  };
}

const zeros = {
  communities: 0,
  households: 0,
  community_members: 0,
  household_members: 0,
  messages: 0,
  connections: 0
};

test('Combina exactamente seis indicadores', async () => {
  const db = database({
    ...zeros,
    messages: 3,
    connections: 2
  });
  const result = await inspectSixSharedImpact(db, id);
  assert.deepEqual(result, {
    ownedCommunities: 0,
    ownedHouseholds: 0,
    communityMembersAffected: 0,
    householdMembersAffected: 0,
    sharedMessagesAffected: 3,
    sharedConnectionsAffected: 2
  });
  assert.equal(db.queries.length, 6);
});

test('Distingue seis ceros verificados de datos ausentes', async () => {
  const result = await inspectSixSharedImpact(database(zeros), id);
  assert.equal(Object.keys(result).length, 6);
  assert(Object.values(result).every(n => n === 0));

  await assert.rejects(
    inspectSixSharedImpact(database({
      ...zeros,
      messages: undefined
    }), id),
    /Inventario administrativo incompleto/
  );
});

test('Falla cerrado ante error en cualquier consulta', async () => {
  await assert.rejects(
    inspectSixSharedImpact(database(zeros, 'households'), id),
    /No se pudo consultar households/
  );
  await assert.rejects(
    inspectSixSharedImpact(database(zeros, 'connections'), id),
    /Inventario administrativo incompleto: connections/
  );
});

test('No acepta una identidad invalida', async () => {
  await assert.rejects(
    inspectSixSharedImpact(database(zeros), 'incorrecto'),
    /Inventario administrativo no disponible/
  );
});
