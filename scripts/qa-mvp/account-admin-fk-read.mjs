import { readFileSync } from 'node:fs';
import dotenv from 'dotenv';
import {
  assertDisposableAccount
} from './account-deletion-guards.mjs';

const TARGET =
  'd022e620-aedb-4ee0-8995-c15c4ac5545f';

const EXPECTED = new Map([
  ['profiles.id', 1],
  ['user_roles.user_id', 1]
]);

async function main() {
  console.log('=== ROOMS M4 · FK DINAMICAS REAL ===');

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
        Authorization: `Bearer ${key}`,
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
  console.log('OK Identidad desechable verificada');

  // POST invoca una funcion SQL exclusivamente de lectura.
  const rows = await request(
    '/rest/v1/rpc/rooms_admin_user_fk_inventory',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        target_user_id: TARGET
      })
    }
  );

  if (!Array.isArray(rows) || rows.length < 35) {
    throw new Error('Cobertura FK inferior a la comprobada');
  }

  const seen = new Set();

  for (const row of rows) {
    const name = `${row.tabla}.${row.columna}`;
    const expected = EXPECTED.get(name) ?? 0;

    if (
      typeof row.tabla !== 'string' ||
      typeof row.columna !== 'string' ||
      typeof row.referencia !== 'string' ||
      seen.has(name) ||
      !Number.isSafeInteger(row.registros) ||
      row.registros !== expected
    ) {
      throw new Error(`Relacion inesperada: ${name}`);
    }

    seen.add(name);
  }

  for (const name of EXPECTED.keys()) {
    if (!seen.has(name)) {
      throw new Error(`Falta relacion esperada: ${name}`);
    }
  }

  console.log(`Relaciones verificadas: ${rows.length}`);
  console.log('Registros esperados: 2');
  console.log('Relaciones inesperadas: 0');
  console.log('FK DINAMICAS VERIFICADAS');
  console.log('ELIMINACION: NO AUTORIZADA');
}

try {
  await main();
} catch (error) {
  console.error('FK BLOQUEADAS:', error.message);
  console.log('ELIMINACION: NO AUTORIZADA');
  process.exitCode = 1;
}
