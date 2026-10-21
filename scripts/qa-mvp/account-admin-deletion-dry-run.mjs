import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const TARGET =
  'd022e620-aedb-4ee0-8995-c15c4ac5545f';

const REQUIRED = Object.freeze([
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
]);

export function validateDryRunPreflight(output) {
  if (typeof output !== 'string') {
    throw new Error('Resultado del preflight invalido');
  }

  for (const marker of REQUIRED) {
    if (!output.includes(marker)) {
      throw new Error(
        'Preflight incompleto: falta ' + marker
      );
    }
  }

  if (
    output.includes('PREFLIGHT BLOQUEADO') ||
    output.includes('PREFLIGHT COMPARTIDO BLOQUEADO')
  ) {
    throw new Error('Preflight bloqueado');
  }

  return Object.freeze({
    mode: 'DRY_RUN',
    targetId: TARGET,
    checksPassed: REQUIRED.length,
    deletionAuthorized: false,
    storageDeletion: 'NOT_EXECUTED',
    authDeletion: 'NOT_EXECUTED',
    databaseDeletion: 'NOT_EXECUTED',
    auditMutation: 'NOT_EXECUTED',
    postDeletionVerification: 'NOT_APPLICABLE'
  });
}

export function runDeletionDryRun() {
  const preflight = fileURLToPath(
    new URL(
      './account-admin-unified-preflight.mjs',
      import.meta.url
    )
  );

  // Sin shell, sin argumentos de eliminacion.
  // Solo ejecuta el preflight de lectura existente.
  const output = execFileSync(
    process.execPath,
    [preflight],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
      timeout: 180000,
      maxBuffer: 2 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe']
    }
  );

  return validateDryRunPreflight(output);
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) ===
    fileURLToPath(
      new URL(
        `file://${process.argv[1].startsWith('/')
          ? process.argv[1]
          : `${process.cwd()}/${process.argv[1]}`}`
      )
    )
) {
  console.log('=== ROOMS M4 · BAJA ADMIN DRY_RUN ===');

  try {
    if (process.argv.length !== 2) {
      throw new Error(
        'Este comando no acepta argumentos'
      );
    }

    const result = runDeletionDryRun();

    console.log(JSON.stringify(result, null, 2));
    console.log('SIMULACION SUPERADA');
    console.log('NINGUNA ELIMINACION EJECUTADA');
    console.log('AUDITORIA SIN MODIFICAR');
  } catch (error) {
    console.error(
      'SIMULACION BLOQUEADA:',
      error.status
        ? 'Preflight no superado'
        : error.message
    );
    console.log('ELIMINACION: NO AUTORIZADA');
    process.exitCode = 1;
  }
}
