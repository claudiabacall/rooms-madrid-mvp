import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const schema = readFileSync(
  'supabase/migrations/20260901_initial_schema.sql',
  'utf8'
);

const preflight = readFileSync(
  'scripts/qa-mvp/account-admin-shared-preflight.mjs',
  'utf8'
);

const fkPattern =
  /alter\s+table\s+(?:public\.)?(\w+)\s+add\s+constraint\s+(\w+)\s+foreign\s+key\s*\(([^)]+)\)\s+references\s+((?:auth|public)\.)?(\w+)\s*\(([^)]+)\)\s+on\s+delete\s+(CASCADE|SET\s+NULL|RESTRICT|NO\s+ACTION)/gi;

const edges = new Map();

for (const match of schema.matchAll(fkPattern)) {
  const [, child, , , prefix, parent, , action] = match;

  if (action.toUpperCase() !== 'CASCADE') continue;

  const source = `${prefix || 'public.'}${parent}`.toLowerCase();
  const destination = `public.${child}`.toLowerCase();

  if (!edges.has(source)) edges.set(source, []);
  edges.get(source).push(destination);
}

const paths = [];

function visit(node, route) {
  if (route.length >= 5) return;

  for (const next of edges.get(node) || []) {
    if (route.includes(next)) continue;

    const updated = [...route, next];

    if (updated.length >= 3) {
      paths.push(updated.join(' -> '));
    }

    visit(next, updated);
  }
}

visit('auth.users', ['auth.users']);

const actual = [...new Set(paths)].sort();

const expected = [
  'auth.users -> public.communities -> public.community_members',
  'auth.users -> public.communities -> public.posts',
  'auth.users -> public.households -> public.household_candidate_votes',
  'auth.users -> public.households -> public.household_candidates',
  'auth.users -> public.households -> public.household_invitations',
  'auth.users -> public.households -> public.household_members',
  'auth.users -> public.households -> public.household_person_candidates',
  'auth.users -> public.listings -> public.household_candidates',
  'auth.users -> public.listings -> public.listing_private_locations',
  'auth.users -> public.posts -> public.post_comments',
  'auth.users -> public.posts -> public.post_likes',
  'auth.users -> public.profiles -> public.household_person_candidates',
  'auth.users -> public.profiles -> public.listing_private_locations',
  'auth.users -> public.saved_collections -> public.saved_collection_items',
  'auth.users -> public.saved_items -> public.saved_collection_items',
  'auth.users -> public.communities -> public.posts -> public.post_comments',
  'auth.users -> public.communities -> public.posts -> public.post_likes'
].sort();

assert.deepEqual(
  actual,
  expected,
  'El mapa de cascadas ha cambiado: revisar impacto sobre terceros'
);

const checksSection = preflight.match(
  /const CHECKS = \[([\s\S]*?)\];/
);

assert(checksSection, 'No se encuentra CHECKS en el preflight');

const checks = new Set(
  [...checksSection[1].matchAll(/\['(\w+)',\s*'(\w+)'\]/g)]
    .map(match => `${match[1]}.${match[2]}`)
);

for (const relation of [
  'communities.owner_id',
  'households.owner_id',
  'listings.owner_id',
  'posts.author_id'
]) {
  assert(
    checks.has(relation),
    `Falta barrera para ${relation}`
  );
}

console.log(`OK ${actual.length} rutas indirectas controladas`);
console.log('OK Barreras de comunidad, hogar, anuncio y publicacion');
console.log('AVISO profiles requiere revision de dependencias');
console.log('AVISO Solo esquema inicial, no esquema remoto');
console.log('ROOMS INDIRECT CASCADE CONTRACT OK');
