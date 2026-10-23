import assert from 'node:assert/strict';
import fs from 'node:fs';

const sql = fs.readFileSync(
  'supabase/migrations/20261023_private_visibility_defaults.sql',
  'utf8'
);

for (const field of ['living', 'search', 'budget', 'activity']) {
  assert.match(sql, new RegExp(
    String.raw`\b${field}_scope text := 'private';`
  ));

  const block = sql.match(new RegExp(
    String.raw`\b${field}_scope\s*:=\s*case\b([\s\S]*?)\n\s*end;`,
    'i'
  ));

  assert.ok(block, `Falta bloque ${field}`);
  assert.match(block[1], /else 'private'\s*$/m);
  assert.doesNotMatch(block[1], /else 'public'\s*$/m);
  assert.match(block[1], new RegExp(
    String.raw`controls \? '${field}'`
  ));

  console.log(`OK  ${field}: privado por defecto`);
}

assert.match(sql, /viewer_id = target_user_id/);
assert.match(sql, /'viewer_scope', 'owner'/);
assert.match(sql, /status = 'accepted'/);
assert.match(sql, /and is_connection/);
assert.match(sql, /to authenticated;/);
assert.match(sql, /from public, anon;/);

console.log('OK  Propietario, conexiones y grants conservados');
console.log('ROOMS M2.1 PRIVACIDAD POR DEFECTO OK');
