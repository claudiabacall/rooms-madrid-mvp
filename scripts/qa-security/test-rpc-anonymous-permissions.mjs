import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sql = readFileSync(
  'supabase/migrations/20261023_restrict_anonymous_rpc_execution.sql',
  'utf8'
);

for (const signature of [
  'accept_household_invitation\\(uuid\\)',
  'get_blocked_profiles\\(\\)'
]) {
  const revoke = new RegExp(
    `REVOKE EXECUTE ON FUNCTION\\s+public\\.${signature}\\s+FROM PUBLIC, anon;`,
    'i'
  );
  const grant = new RegExp(
    `GRANT EXECUTE ON FUNCTION\\s+public\\.${signature}\\s+TO authenticated;`,
    'i'
  );
  assert.match(sql, revoke);
  assert.match(sql, grant);
  console.log(`OK Permisos de ${signature}`);
}

assert.doesNotMatch(
  sql,
  /(?:REVOKE|GRANT) EXECUTE ON FUNCTION\\s+public\\.get_household_invitation/i
);
assert.doesNotMatch(sql, /\\b(?:DROP|DELETE|TRUNCATE|UPDATE|INSERT)\\b/i);

console.log('OK Invitaciones por token sin cambios');
console.log('ROOMS M2.4 PERMISOS RPC OK');
