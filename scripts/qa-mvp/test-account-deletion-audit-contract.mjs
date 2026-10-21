import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sql = readFileSync(
  'supabase/migrations/20261021_account_deletion_audit.sql',
  'utf8'
);

function check(condition, message) {
  assert(condition, message);
  console.log(`OK ${message}`);
}

check(
  /CREATE TABLE IF NOT EXISTS public\.account_deletion_audit/i
    .test(sql),
  'Tabla administrativa definida'
);

check(
  !/REFERENCES\s+auth\.users/i.test(sql),
  'Registro independiente de Auth'
);

check(
  /ENABLE ROW LEVEL SECURITY/i.test(sql),
  'RLS habilitada'
);

check(
  /REVOKE ALL ON public\.account_deletion_audit/i.test(sql),
  'Acceso publico revocado'
);

check(
  !/CREATE POLICY/i.test(sql),
  'Sin politicas de acceso para usuarios'
);

for (const field of [
  'storage_verified',
  'auth_verified',
  'database_verified',
  'shared_impact_verified'
]) {
  check(
    new RegExp(`${field}\\s+boolean\\s+NOT NULL`, 'i')
      .test(sql),
    `Evidencia obligatoria: ${field}`
  );
}

check(
  /status <> 'completed'[\s\S]*storage_verified[\s\S]*auth_verified[\s\S]*database_verified[\s\S]*shared_impact_verified[\s\S]*finished_at IS NOT NULL/i
    .test(sql),
  'No permite cierre sin verificaciones'
);

check(
  !/\bDELETE\s+FROM\b/i.test(sql),
  'Migracion sin borrados'
);

console.log('ROOMS ACCOUNT DELETION AUDIT CONTRACT OK');
