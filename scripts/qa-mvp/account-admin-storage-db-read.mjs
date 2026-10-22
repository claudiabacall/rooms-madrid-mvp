import { readFileSync } from 'node:fs';
import dotenv from 'dotenv';

import {
  assertDisposableAccount
} from './account-deletion-guards.mjs';

const TARGET =
  'd022e620-aedb-4ee0-8995-c15c4ac5545f';

const FIELDS = [
  'archivos_encontrados',
  'por_owner',
  'por_owner_id',
  'por_ruta',
  'fuera_de_buckets_previstos',
  'buckets_afectados'
];

async function main() {
  console.log('=== ROOMS M4 · STORAGE DB REAL ===');

  const env = dotenv.parse(
    readFileSync('.env.rooms-admin.local')
  );

  const url = String(
    env.ROOMS_SUPABASE_URL || ''
  ).replace(/\/+$/, '');

  const key = env.ROOMS_SUPABASE_SERVICE_ROLE_KEY;

  if (
    !/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url) ||
    !key
  ) {
    throw new Error('Configuracion administrativa invalida');
  }

  async function request(path, options = {}) {
    const response = await fetch(`${url}${path}`, {
      ...options,
      headers: {
        apikey: key,
        ...(key.startsWith('eyJ')
          ? { Authorization: `Bearer ${key}` }
          : {}),
        ...(options.headers || {})
      },
      signal: AbortSignal.timeout(30000)
    });

    if (!response.ok) {
      throw new Error(
        `Consulta administrativa HTTP ${response.status}`
      );
    }

    return response.json();
  }

  const user = await request(
    `/auth/v1/admin/users/${TARGET}`
  );

  assertDisposableAccount(user, TARGET);
  console.log('OK Cuenta desechable verificada');

  // POST invoca una funcion SQL exclusivamente de lectura.
  const rows = await request(
    '/rest/v1/rpc/rooms_admin_storage_inventory',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        p_target_id: TARGET
      })
    }
  );

  if (!Array.isArray(rows) || rows.length !== 1) {
    throw new Error('Respuesta de Storage incompleta');
  }

  const result = rows[0];

  for (const field of FIELDS) {
    if (
      !Number.isSafeInteger(result?.[field]) ||
      result[field] !== 0
    ) {
      throw new Error(
        `Storage no verificado: ${field}`
      );
    }

    console.log(`OK ${field}: 0`);
  }

  console.log('STORAGE DB INTEGRAL VERIFICADO');
  console.log('ELIMINACION: NO AUTORIZADA');
  console.log('NINGUN DATO MODIFICADO');
}

try {
  await main();
} catch (error) {
  console.error('STORAGE DB BLOQUEADO:', error.message);
  process.exitCode = 1;
}
