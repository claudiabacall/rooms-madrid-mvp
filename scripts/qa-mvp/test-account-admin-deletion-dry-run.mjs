import test from 'node:test';
import assert from 'node:assert/strict';

import {
  validateDryRunPreflight
} from './account-admin-deletion-dry-run.mjs';

const successful = [
  'OK Cuenta exclusivamente desechable',
  'OK Auditoria abierta y sin finalizar',
  'OK account-admin-database-read.mjs',
  'OK account-admin-shared-preflight.mjs',
  'OK account-admin-fk-read.mjs',
  'OK account-admin-storage-read.mjs',
  'OK Identidad y auditoria siguen intactas',
  'PREFLIGHT UNIFICADO SUPERADO',
  'ELIMINACION: NO AUTORIZADA',
  'NINGUN DATO MODIFICADO O ELIMINADO'
].join('\n');

test('simulacion validada nunca autoriza borrado', () => {
  const result = validateDryRunPreflight(successful);

  assert.equal(result.mode, 'DRY_RUN');
  assert.equal(result.deletionAuthorized, false);
  assert.equal(result.authDeletion, 'NOT_EXECUTED');
  assert.equal(result.auditMutation, 'NOT_EXECUTED');
});

test('bloquea si faltan verificaciones', () => {
  assert.throws(
    () => validateDryRunPreflight(
      successful.replace(
        'OK account-admin-fk-read.mjs',
        ''
      )
    ),
    /Preflight incompleto/
  );
});

test('bloquea una salida con fallo explicito', () => {
  assert.throws(
    () => validateDryRunPreflight(
      successful + '\nPREFLIGHT BLOQUEADO'
    ),
    /Preflight bloqueado/
  );
});

test('rechaza resultado no textual', () => {
  assert.throws(
    () => validateDryRunPreflight(null),
    /invalido/
  );
});
