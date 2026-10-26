import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(
  'scripts/qa-mvp/account-admin-shared-preflight.mjs',
  'utf8'
);

const schema = readFileSync(
  'supabase/migrations/20260901_initial_schema.sql',
  'utf8'
);

const section = source.match(/const CHECKS = \[([\s\S]*?)\];/);
assert(section, 'No existe CHECKS');

const checks = [...section[1].matchAll(
  /\['(\w+)',\s*'(\w+)'\]/g
)].map(match => `${match[1]}.${match[2]}`);

assert.equal(
  new Set(checks).size,
  checks.length,
  'Comprobaciones duplicadas'
);

const ownData = new Set([
  'profiles.id',
  'rooms_dna.user_id',
  'match_preferences.user_id',
  'onboarding_preferences.user_id',
  'saved_items.user_id',
  'user_intents.user_id',
  'user_roles.user_id'
]);

const fkPattern = /alter\s+table\s+(?:public\.)?(\w+)\s+add\s+constraint\s+\w+\s+foreign\s+key\s*\((\w+)\)\s+references\s+auth\.users\s*\(id\)\s+on\s+delete\s+(CASCADE|SET\s+NULL|RESTRICT|NO\s+ACTION)/gi;

const relations = [...schema.matchAll(fkPattern)]
  .map(match => `${match[1]}.${match[2]}`);

assert(relations.length > 0, 'No se detectaron relaciones');

const unguarded = relations.filter(
  relation => !checks.includes(relation) && !ownData.has(relation)
);

assert.deepEqual(
  unguarded,
  [],
  'Existen relaciones compartidas sin barrera administrativa'
);

console.log(`OK ${checks.length} comprobaciones administrativas`);
console.log(`OK ${relations.length} relaciones directas analizadas`);
console.log('OK Relaciones compartidas cubiertas');
console.log('OK Datos propios diferenciados');
console.log('ROOMS ADMIN SHARED COVERAGE OK');
