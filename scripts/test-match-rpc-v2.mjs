import fs from 'node:fs';
import assert from 'node:assert/strict';

const sql = fs.readFileSync(
  'supabase/migrations/20261013_get_match_profile_v2.sql',
  'utf8'
);

console.log('\n=== MATCH RPC V2 ===');

for (const required of [
  'public.get_match_profile(',
  'security definer',
  'auth.uid()',
  'public.users_are_blocked(',
  'public.get_profile_visibility(',
  'p.onboarding_completed = true',
  'd.model_version = 2',
  "'living_visible'",
  "'dna_dimensions'",
  "'confidence'",
  "'importance'",
  'from public',
  'to authenticated'
]) {
  assert(
    sql.toLowerCase().includes(required.toLowerCase()),
    `Falta control: ${required}`
  );
}

console.log('OK  Autenticacion y bloqueo');
console.log('OK  Visibilidad y modelo V2');
console.log('OK  Permisos restringidos');

assert(!/['"]answers['"]\s*,/i.test(sql));
assert(!/['"]evidence['"]\s*,/i.test(sql));
assert(!/['"]classification['"]\s*,/i.test(sql));

console.log('OK  Sin respuestas, evidencias ni clasificacion');

for (const field of [
  'search',
  'budget',
  'living'
]) {
  assert(sql.includes(`->> '${field}'`));
}

console.log('OK  Permisos por categoria');
console.log('\nROOMS MATCH RPC V2 CONTRACT OK');
