import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const shared = readFileSync(
  'scripts/qa-mvp/account-admin-shared-preflight.mjs',
  'utf8'
);

const unified = readFileSync(
  'scripts/qa-mvp/account-admin-unified-preflight.mjs',
  'utf8'
);

const section = shared.match(
  /const CHECKS = \[([\s\S]*?)\];/
);

assert(section, 'No se encuentra CHECKS');

const relations = [
  ...section[1].matchAll(
    /\['(\w+)',\s*'(\w+)'\]/g
  )
];

const total = relations.length;

assert.equal(
  total,
  26,
  'El inventario administrativo ha cambiado'
);

assert(
  unified.includes(`'Relaciones comprobadas: ${total}'`),
  'El contrato unificado no coincide con el preflight'
);

assert(
  unified.includes(`'Relaciones compartidas: ${total}/${total}'`),
  'El resumen unificado esta desactualizado'
);

assert(
  unified.includes("'Registros con posible impacto: 0'"),
  'Falta comprobar ausencia de impacto'
);

assert(
  unified.includes("'PREFLIGHT COMPARTIDO SUPERADO'"),
  'Falta comprobar exito del preflight compartido'
);

assert(
  unified.includes("ELIMINACION: NO AUTORIZADA"),
  'Falta conservar el bloqueo de eliminacion'
);

console.log(`OK ${total} relaciones sincronizadas`);
console.log('OK Marcadores de seguridad conservados');
console.log('ROOMS ADMIN PREFLIGHT CONTRACT OK');
