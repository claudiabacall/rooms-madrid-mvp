import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import dotenv from 'dotenv';

import {
  assertDisposableAccount
} from './account-deletion-guards.mjs';

import { validate as isUuid } from './account-deletion-uuid.mjs';

import {
  inspectAccountSharedImpact
} from './account-shared-impact.mjs';

const envFile = '.env.rooms-admin.local';

function loadAdminConfig() {
  let config;

  try {
    config = dotenv.parse(readFileSync(envFile));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    throw new Error(
      'Falta .env.rooms-admin.local. ' +
      'No se ha conectado a Supabase.'
    );
  }

  const url = String(config.ROOMS_SUPABASE_URL || '')
    .replace(/\/+$/, '');

  const key = config.ROOMS_SUPABASE_SERVICE_ROLE_KEY;

  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url)) {
    throw new Error('URL de Supabase no valida');
  }

  if (!key) {
    throw new Error('Falta clave administrativa privada');
  }

  return { url, key };
}

function makeReadOnlyClient(config, fetchImpl = fetch) {
  async function request(path, options = {}) {
    const response = await fetchImpl(
      `${config.url}${path}`,
      {
        ...options,
        headers: {
          apikey: config.key,
          ...(config.key.startsWith('eyJ')
            ? { Authorization: `Bearer ${config.key}` }
            : {}),
          ...(options.headers || {})
        },
        signal: AbortSignal.timeout(15000)
      }
    );

    if (!response.ok) {
      throw new Error(
        `Consulta administrativa fallida: HTTP ${response.status}`
      );
    }

    return response;
  }

  return {
    async getUser(userId) {
      const response = await request(
        `/auth/v1/admin/users/${encodeURIComponent(userId)}`
      );
      return response.json();
    },

    from(table) {
      return {
        select(_columns, options) {
          assert.equal(options.count, 'exact');
          assert.equal(options.head, true);

          return {
            async eq(field, userId) {
              const params = new URLSearchParams({
                select: '*',
                [field]: `eq.${userId}`
              });

              const response = await request(
                `/rest/v1/${table}?${params}`,
                {
                  method: 'HEAD',
                  headers: { Prefer: 'count=exact' }
                }
              );

              const range = response.headers.get('content-range');
              const total = range?.match(/\/(\d+)$/)?.[1];

              if (total === undefined) {
                return {
                  count: null,
                  error: {
                    message: 'Recuento exacto no disponible'
                  }
                };
              }

              return {
                count: Number(total),
                error: null
              };
            }
          };
        }
      };
    }
  };
}

export async function inspectDisposableAccount({
  targetId,
  config,
  fetchImpl
}) {
  if (!isUuid(targetId)) {
    throw new Error('UUID de cuenta no valido');
  }

  const db = makeReadOnlyClient(config, fetchImpl);
  const user = await db.getUser(targetId);

  // Si no supera esta comprobacion, no consulta sus datos.
  assertDisposableAccount(user, targetId);

  let impact;
  let blockedReason = null;

  try {
    impact = await inspectAccountSharedImpact(db, targetId);
  } catch (error) {
    blockedReason = error.message;
  }

  return {
    mode: 'READ_ONLY',
    userId: targetId,
    impact: impact || null,
    blockedReason,
    deletionAuthorized: false,
    additionalDependencies: 'NOT_VERIFIED'
  };
}

if (
  process.argv[1] &&
  new URL(import.meta.url).pathname ===
    new URL(`file://${process.argv[1].startsWith('/')
      ? process.argv[1]
      : `${process.cwd()}/${process.argv[1]}`}`).pathname
) {
  const targetId = process.argv[2];

  if (!targetId) {
    console.log('ROOMS ADMIN INSPECTOR - SOLO LECTURA');
    console.log('Estado: preparado, sin conexion ni cambios.');
    console.log(
      'Uso futuro: node scripts/qa-mvp/account-admin-inspect.mjs UUID'
    );
  } else {
    try {
      const result = await inspectDisposableAccount({
        targetId,
        config: loadAdminConfig()
      });

      console.log(JSON.stringify(result, null, 2));
    } catch (error) {
      console.error('INSPECCION BLOQUEADA:', error.message);
      process.exitCode = 1;
    }
  }
}
