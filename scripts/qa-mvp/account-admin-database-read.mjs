import { readFileSync } from 'node:fs';
import dotenv from 'dotenv';

import {
  assertDisposableAccount
} from './account-deletion-guards.mjs';

const ID = 'd022e620-aedb-4ee0-8995-c15c4ac5545f';

const CHECKS = [
  ['profiles', 'id'],
  ['user_roles', 'user_id'],
  ['rooms_dna', 'user_id'],
  ['user_intents', 'user_id'],
  ['match_preferences', 'user_id'],
  ['onboarding_preferences', 'user_id'],
  ['legal_acceptances', 'user_id'],
  ['account_deletion_requests', 'user_id'],
  ['communities', 'owner_id'],
  ['community_members', 'user_id'],
  ['households', 'owner_id'],
  ['household_members', 'user_id'],
  ['listings', 'owner_id'],
  ['posts', 'author_id'],
  ['messages', 'sender_id'],
  ['messages', 'recipient_id'],
  ['connections', 'requester_id'],
  ['connections', 'recipient_id'],
  ['saved_collections', 'user_id'],
  ['saved_items', 'user_id'],
  ['reports', 'reporter_id'],
  ['reports', 'reported_user_id']
];

console.log('=== ROOMS M4 · INVENTARIO BD REAL ===');

try {
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

  async function request(path, method = 'GET') {
    const response = await fetch(`${url}${path}`, {
      method,
      headers: {
        apikey: key,
        ...(key.startsWith('eyJ')
          ? { Authorization: `Bearer ${key}` }
          : {}),
        ...(method === 'HEAD'
          ? { Prefer: 'count=exact' }
          : {})
      },
      signal: AbortSignal.timeout(15000)
    });

    return response;
  }

  const auth = await request(
    `/auth/v1/admin/users/${ID}`
  );

  if (!auth.ok) {
    throw new Error(`Auth: HTTP ${auth.status}`);
  }

  assertDisposableAccount(await auth.json(), ID);
  console.log('OK Identidad desechable verificada');

  let errors = 0;
  let checked = 0;
  const counts = new Map();

  for (const [table, field] of CHECKS) {
    const params = new URLSearchParams({
      select: '*',
      [field]: `eq.${ID}`
    });

    try {
      const response = await request(
        `/rest/v1/${table}?${params}`,
        'HEAD'
      );

      if (!response.ok) {
        console.log(`BLOQUEADO ${table}.${field}: HTTP ${response.status}`);
        errors++;
        continue;
      }

      const raw = response.headers.get('content-range');
      const match = raw?.match(/\/(\d+)$/);

      if (!match) {
        console.log(`BLOQUEADO ${table}.${field}: sin recuento`);
        errors++;
        continue;
      }

      const count = Number(match[1]);

      if (!Number.isSafeInteger(count)) {
        errors++;
        continue;
      }

      checked++;
      counts.set(`${table}.${field}`, count);

      if (count > 0) {
        console.log(`DATOS ${table}.${field}: ${count}`);
      }
    } catch (error) {
      console.log(`BLOQUEADO ${table}.${field}: ${error.name}`);
      errors++;
    }
  }

  console.log('');
  console.log(`Consultas completadas: ${checked}/${CHECKS.length}`);
  console.log(`Consultas bloqueadas: ${errors}`);
  console.log('DEPENDENCIAS INDIRECTAS: NO VERIFICADAS');

  if (errors > 0) {
    console.log('INVENTARIO INCOMPLETO');
    process.exitCode = 1;
  } else {
    console.log('INVENTARIO DIRECTO COMPLETADO');
  }

  console.log('ELIMINACION: NO AUTORIZADA');
  console.log('Ningun registro modificado ni eliminado');

} catch (error) {
  console.error('INVENTARIO BLOQUEADO:', error.message);
  console.log('ELIMINACION: NO AUTORIZADA');
  process.exitCode = 1;
}
