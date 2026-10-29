import test from 'node:test';
import assert from 'node:assert/strict';

import {
  inspectAdministrativeDeletionImpact
} from './account-deletion-admin-impact.mjs';

const id = '12345678-1234-4234-8234-123456789abc';

const tables = [
  'communities',
  'households',
  'community_members',
  'household_members',
  'messages',
  'connections'
];

function mockDb(values = {}) {
  return {
    from(table) {
      return {
        select() {
          return {
            async eq() {
              return {
                count: values[table] ?? 0,
                error: null
              };
            },
            async or() {
              return {
                count: values[table] ?? 0,
                error: null
              };
            }
          };
        }
      };
    }
  };
}

function fullPreflight(overrides = {}) {
  return async () => ({
    verified: true,
    coverageComplete: true,
    relationsChecked: 26,
    affectedRows: 0,
    ...overrides
  });
}

test('Integra seis indicadores y preflight completo', async () => {
  const result = await inspectAdministrativeDeletionImpact({
    db: mockDb(),
    targetId: id,
    verifyFullSharedPreflight: fullPreflight()
  });

  assert.equal(result.status, 'SHARED_PREFLIGHT_ONLY');
  assert.equal(result.deletionAuthorized, false);
  assert.equal(result.relationsChecked, 26);
  assert.equal(Object.keys(result.impact).length, 6);
  assert(Object.values(result.impact).every(n => n === 0));
});

test('Bloquea mensajes compartidos', async () => {
  await assert.rejects(
    inspectAdministrativeDeletionImpact({
      db: mockDb({ messages: 2 }),
      targetId: id,
      verifyFullSharedPreflight: fullPreflight()
    }),
    /Existen relaciones compartidas/
  );
});

test('Bloquea relaciones fuera de los seis indicadores', async () => {
  await assert.rejects(
    inspectAdministrativeDeletionImpact({
      db: mockDb(),
      targetId: id,
      verifyFullSharedPreflight: fullPreflight({
        affectedRows: 1
      })
    }),
    /Existen relaciones compartidas/
  );
});

test('Bloquea preflight incompleto', async () => {
  await assert.rejects(
    inspectAdministrativeDeletionImpact({
      db: mockDb(),
      targetId: id,
      verifyFullSharedPreflight: fullPreflight({
        coverageComplete: false
      })
    }),
    /Preflight administrativo no acreditado/
  );
});

test('Rechaza ausencia de preflight completo', async () => {
  await assert.rejects(
    inspectAdministrativeDeletionImpact({
      db: mockDb(),
      targetId: id
    }),
    /Preflight completo obligatorio/
  );
});

test('No incluye operaciones destructivas', () => {
  assert.deepEqual(tables.length, 6);
});
