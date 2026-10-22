import { readFileSync } from 'node:fs';
import dotenv from 'dotenv';

import {
  assertDisposableAccount
} from './account-deletion-guards.mjs';

import {
  inventoryUserStorage
} from './account-storage-inventory.mjs';

const TARGET_ID = 'd022e620-aedb-4ee0-8995-c15c4ac5545f';

async function main() {
  console.log('=== ROOMS M4 · STORAGE ADMIN REAL ===');

  const env = dotenv.parse(
    readFileSync('.env.rooms-admin.local')
  );

  const url = env.ROOMS_SUPABASE_URL?.replace(/\/+$/, '');
  const key = env.ROOMS_SUPABASE_SERVICE_ROLE_KEY;

  if (
    !/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url || '') ||
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
      signal: AbortSignal.timeout(15000)
    });

    if (!response.ok) {
      throw new Error(
        `Consulta administrativa fallida: HTTP ${response.status}`
      );
    }

    return response.json();
  }

  const user = await request(
    `/auth/v1/admin/users/${TARGET_ID}`
  );

  assertDisposableAccount(user, TARGET_ID);
  console.log('OK Identidad desechable confirmada');

  const storage = {
    from(bucket) {
      return {
        async list(prefix, options) {
          try {
            const data = await request(
              `/storage/v1/object/list/${encodeURIComponent(bucket)}`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  prefix,
                  limit: options.limit,
                  offset: options.offset,
                  sortBy: options.sortBy
                })
              }
            );

            if (!Array.isArray(data)) {
              throw new Error('Listado inesperado');
            }

            return { data, error: null };
          } catch (error) {
            return {
              data: null,
              error: { message: error.message }
            };
          }
        }
      };
    }
  };

  // Reutilizar inventario recursivo ya probado.
  const inventory = await inventoryUserStorage(
    storage,
    TARGET_ID
  );

  let total = 0;

  for (const [bucket, paths] of Object.entries(inventory)) {
    console.log(`OK ${bucket}: ${paths.length} archivos`);
    total += paths.length;
  }

  console.log('');
  console.log(`Total archivos: ${total}`);

  if (total !== 0) {
    throw new Error('Storage contiene archivos pendientes');
  }

  console.log('STORAGE INVENTORY REAL OK');
  console.log('ELIMINACION: NO AUTORIZADA');
  console.log('Ningun archivo modificado ni eliminado');
}

try {
  await main();
} catch (error) {
  console.error('BLOQUEADO:', error.message);
  process.exitCode = 1;
}
