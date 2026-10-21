import assert from 'node:assert/strict';
import {
  assertDisposableAccount,
  STORAGE_BUCKETS
} from './account-deletion-guards.mjs';

const id = '12345678-1234-4234-8234-123456789abc';

const disposable = {
  id,
  email: 'rooms-delete-qa-test@example.com',
  user_metadata: {
    rooms_deletion_test: true
  }
};

assert.equal(assertDisposableAccount(disposable, id), true);
console.log('OK Cuenta desechable identificada');

assert.throws(
  () => assertDisposableAccount({
    ...disposable,
    user_metadata: { rooms_test_account: true }
  }, id),
  /no esta marcada/
);
console.log('OK Cuenta QA normal rechazada');

assert.throws(
  () => assertDisposableAccount({
    ...disposable,
    email: 'usuario@example.com'
  }, id),
  /Email/
);
console.log('OK Cuenta no desechable rechazada');

assert.throws(
  () => assertDisposableAccount({
    ...disposable,
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  }, id),
  /Identidad/
);
console.log('OK Identidad incorrecta rechazada');

assert.throws(
  () => assertDisposableAccount(disposable, 'no-es-uuid'),
  /UUID/
);
console.log('OK Identificador invalido rechazado');

assert.equal(STORAGE_BUCKETS.length, 4);
console.log('OK Cuatro buckets identificados');

console.log('ROOMS ACCOUNT DELETION GUARDS OK');
