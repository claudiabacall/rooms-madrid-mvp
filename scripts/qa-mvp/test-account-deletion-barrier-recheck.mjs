import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(
  'scripts/qa-mvp/account-deletion-coordinator.mjs',
  'utf8'
);

const storageCheck = source.indexOf(
  'const finalStorage = await verifyStorageEmpty(targetId);'
);

const barrierCheck = source.indexOf(
  'const finalBarrier = await verifyWriteBarrier({'
);

const authDeletion = source.indexOf(
  'const authResult = await deleteAuthUser(targetId);'
);

assert(storageCheck >= 0);
assert(barrierCheck > storageCheck);
assert(authDeletion > barrierCheck);

const finalSection = source.slice(
  barrierCheck,
  authDeletion
);

for (const field of [
  'verified',
  'databaseWritesBlocked',
  'storageWritesBlocked',
  'inFlightWritesDrained'
]) {
  assert.match(
    finalSection,
    new RegExp(`finalBarrier\\.${field} !== true`)
  );
}

assert.match(
  finalSection,
  /throw new Error\(\s*'Barrera revocada antes de eliminar Auth'/
);

console.log('OK Barrera revalidada tras Storage');
console.log('OK Cuatro garantias comprobadas antes de Auth');
console.log('OK Rechazo explicito si falla la revalidacion');
console.log('ROOMS BARRIER RECHECK CONTRACT OK');
