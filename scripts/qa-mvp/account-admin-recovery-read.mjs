import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import dotenv from 'dotenv';

import {
  assertDisposableAccount
} from './account-deletion-guards.mjs';

const TARGET = 'd022e620-aedb-4ee0-8995-c15c4ac5545f';

const FLAGS = [
  'storage_verified',
  'auth_verified',
  'database_verified',
  'shared_impact_verified'
];

export function classifyDeletionAudit(audit) {
  if (!audit || typeof audit !== 'object') {
    throw new Error('Auditoria ausente');
  }

  const {
    status, claim_token, claimed_at, finished_at
  } = audit;

  if (!['started', 'processing', 'completed', 'failed'].includes(status)) {
    throw new Error('Estado desconocido');
  }

  if (FLAGS.some(field => typeof audit[field] !== 'boolean')) {
    throw new Error('Verificaciones no validas');
  }

  if (status === 'started') {
    if (
      claim_token !== null ||
      claimed_at !== null ||
      finished_at !== null ||
      FLAGS.some(field => audit[field])
    ) {
      throw new Error('Auditoria inicial inconsistente');
    }

    return {
      status,
      classification: 'NOT_CLAIMED',
      manualReviewRequired: false,
      automaticRetryAllowed: false,
      deletionAuthorized: false
    };
  }

  if (status === 'processing') {
    if (!claim_token || !claimed_at || finished_at !== null) {
      throw new Error('Reclamacion inconsistente');
    }

    return {
      status,
      classification: 'IN_PROGRESS_OR_INTERRUPTED',
      manualReviewRequired: true,
      automaticRetryAllowed: false,
      deletionAuthorized: false
    };
  }

  if (finished_at === null) {
    throw new Error('Auditoria finalizada sin fecha');
  }

  if (status === 'completed' && FLAGS.some(field => !audit[field])) {
    throw new Error('Baja completada sin evidencias');
  }

  return {
    status,
    classification: status === 'completed'
      ? 'RECORDED_COMPLETED'
      : 'FAILED_REQUIRES_RECONCILIATION',
    manualReviewRequired: status === 'failed',
    automaticRetryAllowed: false,
    deletionAuthorized: false
  };
}

async function main() {
  console.log('=== ROOMS M4 · INSPECTOR DE RECUPERACION ===');
  console.log('MODO: SOLO LECTURA');

  const env = dotenv.parse(
    readFileSync('.env.rooms-admin.local')
  );
  const url = String(env.ROOMS_SUPABASE_URL || '').replace(/\/+$/, '');
  const key = env.ROOMS_SUPABASE_SERVICE_ROLE_KEY;

  if (
    !/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url) ||
    !key
  ) {
    throw new Error('Configuracion administrativa invalida');
  }

  async function get(path) {
    const response = await fetch(`${url}${path}`, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`
      },
      signal: AbortSignal.timeout(15000)
    });

    if (!response.ok) {
      throw new Error(`Lectura administrativa HTTP ${response.status}`);
    }

    return response.json();
  }

  const user = await get(`/auth/v1/admin/users/${TARGET}`);
  assertDisposableAccount(user, TARGET);

  const params = new URLSearchParams({
    select: [
      'status',
      'claim_token',
      'claimed_at',
      'finished_at',
      ...FLAGS
    ].join(','),
    target_user_id: `eq.${TARGET}`
  });

  const rows = await get(
    `/rest/v1/account_deletion_audit?${params}`
  );

  if (!Array.isArray(rows) || rows.length !== 1) {
    throw new Error('Numero de auditorias inesperado');
  }

  const result = classifyDeletionAudit(rows[0]);

  // No imprimir el claim_token ni la clave administrativa.
  console.log(JSON.stringify(result, null, 2));
  console.log('AUDITORIA CONSULTADA SIN CAMBIOS');
  console.log('ELIMINACION: NO AUTORIZADA');
}

const isMain = process.argv[1] &&
  import.meta.url === pathToFileURL(
    process.argv[1].startsWith('/')
      ? process.argv[1]
      : `${process.cwd()}/${process.argv[1]}`
  ).href;

if (isMain) {
  try {
    await main();
  } catch (error) {
    console.error('INSPECCION BLOQUEADA:', error.message);
    process.exitCode = 1;
  }
}
