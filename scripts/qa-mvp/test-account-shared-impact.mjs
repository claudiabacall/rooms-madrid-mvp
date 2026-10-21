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

const owned = fakeDb({
  communities: 2,
  households: 1
});

const impact = await inspectAccountSharedImpact(owned, id);

assert.equal(impact.ownedCommunities, 2);
assert.equal(impact.ownedHouseholds, 1);

assert.deepEqual(
  owned.requests.map(r => `${r.table}.${r.field}`),
  ['communities.owner_id', 'households.owner_id']
);

console.log('OK Titularidades consultadas');

await assert.rejects(
  inspectAccountSharedImpact(
    fakeDb({ communities: new Error('Acceso denegado') }),
    id
  ),
  /No se pudo consultar/
);

console.log('OK Errores de Supabase bloquean la baja');

await assert.rejects(
  inspectAccountSharedImpact(
    fakeDb({ communities: null }),
    id
  ),
  /Recuento no verificable/
);

console.log('OK Recuentos nulos rechazados');

await assert.rejects(
  inspectAccountSharedImpact(fakeDb(), id),
  /Inspeccion incompleta/
);

console.log('OK Una inspeccion parcial nunca autoriza bajas');

await assert.rejects(
  inspectAccountSharedImpact(fakeDb(), 'usuario-invalido'),
  /Identificador de usuario no valido/
);

console.log('OK UUID validado');

console.log('ROOMS ACCOUNT SHARED IMPACT OK');
