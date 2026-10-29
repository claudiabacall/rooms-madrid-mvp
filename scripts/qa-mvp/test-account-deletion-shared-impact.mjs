import test from 'node:test';
import assert from 'node:assert/strict';
import {
  inspectSharedCommunicationImpact
} from './account-deletion-shared-impact.mjs';

const targetId = '12345678-1234-4234-8234-123456789abc';

function mockDatabase(responses) {
  const queries = [];

  return {
    queries,
    from(table) {
      return {
        select(columns, options) {
          assert.equal(columns, '*');
          assert.deepEqual(options, { count: 'exact', head: true });

          return {
            async or(filter) {
              queries.push({ table, filter });
              return responses[table];
            }
          };
        }
      };
    }
  };
}

test('Cuenta mensajes y conexiones de ambos sentidos', async () => {
  const db = mockDatabase({
    messages: { count: 3, error: null },
    connections: { count: 2, error: null }
  });

  const result = await inspectSharedCommunicationImpact(db, targetId);

  assert.deepEqual(result, {
    sharedMessagesAffected: 3,
    sharedConnectionsAffected: 2
  });

  assert.deepEqual(db.queries, [
    {
      table: 'messages',
      filter: `sender_id.eq.${targetId},recipient_id.eq.${targetId}`
    },
    {
      table: 'connections',
      filter: `requester_id.eq.${targetId},recipient_id.eq.${targetId}`
    }
  ]);
});

test('Acepta ausencia verificada de relaciones', async () => {
  const db = mockDatabase({
    messages: { count: 0, error: null },
    connections: { count: 0, error: null }
  });

  assert.deepEqual(
    await inspectSharedCommunicationImpact(db, targetId),
    { sharedMessagesAffected: 0, sharedConnectionsAffected: 0 }
  );
});

test('Falla cerrado si no se obtiene el conteo', async () => {
  const db = mockDatabase({
    messages: { count: null, error: null }
  });

  await assert.rejects(
    inspectSharedCommunicationImpact(db, targetId),
    /Inventario administrativo incompleto: messages/
  );
});

test('Falla cerrado ante error de permisos', async () => {
  const db = mockDatabase({
    messages: { count: 0, error: null },
    connections: { count: null, error: { message: 'permission denied' } }
  });

  await assert.rejects(
    inspectSharedCommunicationImpact(db, targetId),
    /Inventario administrativo incompleto: connections/
  );
});

test('Rechaza identificadores invalidos', async () => {
  const db = mockDatabase({});

  await assert.rejects(
    inspectSharedCommunicationImpact(db, 'id-no-valido'),
    /Inventario administrativo no disponible/
  );

  assert.equal(db.queries.length, 0);
});
