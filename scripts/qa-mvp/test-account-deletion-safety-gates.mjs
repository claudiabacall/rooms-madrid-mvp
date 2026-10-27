import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(path, 'utf8');

const coordinator = read(
  'scripts/qa-mvp/account-deletion-coordinator.mjs'
);

const completion = read(
  'supabase/migrations/20261021_admin_complete_deleted_account_disabled.sql'
);

const architecture = read(
  'docs/review/deletion-write-barrier-architecture.md'
);

assert.match(
  coordinator,
  /typeof verifyWriteBarrier !== 'function'/
);

assert.match(
  coordinator,
  /barrier\.databaseWritesBlocked !== true/
);

assert.match(
  coordinator,
  /barrier\.storageWritesBlocked !== true/
);

assert.match(
  coordinator,
  /barrier\.inFlightWritesDrained !== true/
);

assert.match(
  completion,
  /Cierre deshabilitado: falta evidencia API Storage/
);

assert.match(
  architecture,
  /Estado actual: NO GO/
);

assert.match(
  architecture,
  /concurrencia real/
);

assert.match(
  architecture,
  /service_role/
);

console.log('OK Coordinador exige barrera independiente');
console.log('OK Base de datos, Storage y concurrencia obligatorios');
console.log('OK Cierre SQL permanece deshabilitado en migracion');
console.log('OK Arquitectura mantiene NO GO');
console.log('ROOMS DELETION SAFETY GATES OK');
