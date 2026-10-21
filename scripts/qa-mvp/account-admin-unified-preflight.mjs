import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import dotenv from 'dotenv';

import {
  assertDisposableAccount
} from './account-deletion-guards.mjs';

const TARGET =
  'd022e620-aedb-4ee0-8995-c15c4ac5545f';

const CHECKS = [
  {
    file: 'account-admin-database-read.mjs',
    success: [
      'Consultas completadas: 22/22',
      'Consultas bloqueadas: 0',
      'INVENTARIO DIRECTO COMPLETADO'
    ]
  },
  {
    file: 'account-admin-shared-preflight.mjs',
    success: [
      'Relaciones comprobadas: 9',
      'Registros con posible impacto: 0',
      'PREFLIGHT COMPARTIDO SUPERADO'
    ]
  },
  {
    file: 'account-admin-fk-read.mjs',
    success: [
      'Registros esperados: 2',
      'Relaciones inesperadas: 0',
      'FK DINAMICAS VERIFICADAS'
    ]
  },
  {
    file: 'account-admin-storage-read.mjs',
    success: [
      'Total archivos: 0',
      'STORAGE INVENTORY REAL OK'
    ]
  }
];

function runExistingCheck(check) {
  const filePath = new URL(check.file, import.meta.url);
  const source = readFileSync(filePath, 'utf8');

  // Impedir combinar accidentalmente comprobaciones
  // dirigidas a distintas cuentas de prueba.
  if (!source.includes(`'${TARGET}'`)) {
    throw new Error(
      `Identificador no coincide: ${check.file}`
    );
  }

  const output = execFileSync(
    process.execPath,
    [filePath.pathname],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
      timeout: 90000,
      maxBuffer: 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe']
    }
  );

  for (const marker of check.success) {
    if (!output.includes(marker)) {
      throw new Error(
        `Resultado incompleto: ${check.file}`
      );
    }
  }

  console.log(`OK ${check.file}`);
}

async function main() {
  console.log('=== ROOMS M4 · PREFLIGHT ADMINISTRATIVO ===');
  console.log('MODO: SOLO LECTURA');

  const config = dotenv.parse(
    readFileSync('.env.rooms-admin.local')
  );

  const url = String(
    config.ROOMS_SUPABASE_URL || ''
  ).replace(/\/+$/, '');

  const key = config.ROOMS_SUPABASE_SERVICE_ROLE_KEY;

  if (
    !/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url) ||
    !key
  ) {
    throw new Error('Configuracion administrativa invalida');
  }

  async function read(path) {
    const response = await fetch(`${url}${path}`, {
      method: 'GET',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`
      },
      signal: AbortSignal.timeout(15000)
    });

    if (!response.ok) {
      throw new Error(
        `Consulta administrativa HTTP ${response.status}`
      );
    }

    return response.json();
  }

  // Primera barrera: identidad del usuario.
  const user = await read(
    `/auth/v1/admin/users/${TARGET}`
  );

  assertDisposableAccount(user, TARGET);
  console.log('OK Cuenta exclusivamente desechable');

  // Segunda barrera: registro administrativo abierto.
  const params = new URLSearchParams({
    select: [
      'id',
      'operator_id',
      'status',
      'storage_verified',
      'auth_verified',
      'database_verified',
      'shared_impact_verified',
      'finished_at'
    ].join(','),
    target_user_id: `eq.${TARGET}`
  });

  const audits = await read(
    `/rest/v1/account_deletion_audit?${params}`
  );

  if (!Array.isArray(audits) || audits.length !== 1) {
    throw new Error(
      'Debe existir exactamente una auditoria'
    );
  }

  const audit = audits[0];

  if (
    audit.status !== 'started' ||
    !audit.operator_id ||
    audit.operator_id === TARGET ||
    audit.finished_at !== null ||
    [
      'storage_verified',
      'auth_verified',
      'database_verified',
      'shared_impact_verified'
    ].some(field => audit[field] !== false)
  ) {
    throw new Error(
      'Estado de auditoria incompatible'
    );
  }

  console.log('OK Auditoria abierta y sin finalizar');

  // Reutilizar las comprobaciones reales ya probadas.
  for (const check of CHECKS) {
    runExistingCheck(check);
  }

  // Detectar cambios de estado durante el preflight.
  const userAfter = await read(
    `/auth/v1/admin/users/${TARGET}`
  );
  assertDisposableAccount(userAfter, TARGET);

  const auditsAfter = await read(
    `/rest/v1/account_deletion_audit?${params}`
  );

  if (
    !Array.isArray(auditsAfter) ||
    auditsAfter.length !== 1 ||
    JSON.stringify(auditsAfter[0]) !== JSON.stringify(audit)
  ) {
    throw new Error(
      'Auditoria modificada durante el preflight'
    );
  }

  console.log('OK Identidad y auditoria siguen intactas');

  console.log('');
  console.log('PREFLIGHT UNIFICADO SUPERADO');
  console.log('Inventario directo: 22/22');
  console.log('Relaciones compartidas: 9/9');
  console.log('Storage: 4 buckets, 0 archivos');
  console.log('Auditoria: started');
  console.log('Cobertura FK directa: verificada dinamicamente');
  console.log('Triggers externos y otras funciones: no certificados');
  console.log('Resultado no atomico: requiere revision final');
  console.log('ELIMINACION: NO AUTORIZADA');
  console.log('NINGUN DATO MODIFICADO O ELIMINADO');
}

try {
  await main();
} catch (error) {
  console.error('PREFLIGHT BLOQUEADO:', error.message);
  console.log('ELIMINACION: NO AUTORIZADA');
  process.exitCode = 1;
}
