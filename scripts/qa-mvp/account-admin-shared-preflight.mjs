import { readFileSync } from 'node:fs';
import dotenv from 'dotenv';

import {
  assertDisposableAccount
} from './account-deletion-guards.mjs';

const TARGET_ID =
  'd022e620-aedb-4ee0-8995-c15c4ac5545f';

// Para esta primera baja, se exige ausencia de
// recursos propios capaces de afectar a terceros.
// Esto evita cascadas desde recursos compartidos.
const CHECKS = [
  ['communities', 'owner_id'],
  ['households', 'owner_id'],
  ['listings', 'owner_id'],
  ['posts', 'author_id'],
  ['saved_collections', 'user_id'],
  ['community_members', 'user_id'],
  ['household_members', 'user_id'],
  ['household_person_candidates', 'user_id'],
  ['listing_private_locations', 'owner_id']
];

async function main() {
  console.log('=== ROOMS M4 · PREFLIGHT COMPARTIDO REAL ===');

  const env = dotenv.parse(
    readFileSync('.env.rooms-admin.local')
  );

  const url =
    env.ROOMS_SUPABASE_URL?.replace(/\/+$/, '');

  const key = env.ROOMS_SUPABASE_SERVICE_ROLE_KEY;

  if (
    !/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url || '') ||
    !key
  ) {
    throw new Error('Configuracion administrativa invalida');
  }

  async function request(path, method = 'GET') {
    const response = await fetch(`${url}${path}`, {
      method,
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        ...(method === 'HEAD'
          ? { Prefer: 'count=exact' }
          : {})
      },
      signal: AbortSignal.timeout(15000)
    });

    if (!response.ok) {
      throw new Error(
        `Consulta bloqueada: ${path.split('?')[0]} ` +
        `HTTP ${response.status}`
      );
    }

    return response;
  }

  const auth = await request(
    `/auth/v1/admin/users/${TARGET_ID}`
  );

  const user = await auth.json();

  assertDisposableAccount(user, TARGET_ID);

  console.log('OK Cuenta desechable verificada');

  let total = 0;

  for (const [table, field] of CHECKS) {
    const params = new URLSearchParams({
      select: '*',
      [field]: `eq.${TARGET_ID}`
    });

    const response = await request(
      `/rest/v1/${table}?${params}`,
      'HEAD'
    );

    const match = response.headers
      .get('content-range')
      ?.match(/\/(\d+)$/);

    if (!match) {
      throw new Error(
        `Recuento no verificable: ${table}.${field}`
      );
    }

    const count = Number(match[1]);

    if (!Number.isSafeInteger(count) || count < 0) {
      throw new Error(
        `Recuento invalido: ${table}.${field}`
      );
    }

    console.log(
      `${count === 0 ? 'OK' : 'BLOQUEADO'} ` +
      `${table}.${field}: ${count}`
    );

    total += count;
  }

  console.log('');
  console.log(`Relaciones comprobadas: ${CHECKS.length}`);
  console.log(`Registros con posible impacto: ${total}`);

  if (total !== 0) {
    throw new Error(
      'Existen relaciones que requieren revision'
    );
  }

  console.log('PREFLIGHT COMPARTIDO SUPERADO');
  console.log('COBERTURA: relaciones declaradas en CHECKS');
  console.log('ESQUEMA COMPLETO: aun no certificado');
  console.log('ELIMINACION: NO AUTORIZADA');
  console.log('Ningun dato modificado ni eliminado');
}

try {
  await main();
} catch (error) {
  console.error('PREFLIGHT BLOQUEADO:', error.message);
  console.log('ELIMINACION: NO AUTORIZADA');
  process.exitCode = 1;
}
