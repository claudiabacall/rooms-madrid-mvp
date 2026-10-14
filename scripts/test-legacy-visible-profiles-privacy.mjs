import assert from 'node:assert/strict';
import fs from 'node:fs';

const sql = fs.readFileSync('supabase/migrations/20261014203000_legacy_visible_profiles_privacy.sql', 'utf8');
const check = (label, fn) => { fn(); console.log(`OK  ${label}`); };
check('Legacy RPC signature preserved', () => {
  assert.match(sql, /create or replace function public\.get_visible_profiles\(\s*_target_user_id uuid default null::uuid/);
  assert.doesNotMatch(sql, /create or replace function public\.get_visible_profiles_v2\(/);
});
check('Exactly original 13 return columns', () => {
  const result = sql.match(/returns table\(([\s\S]*?)\)\s*language sql/i)?.[1];
  assert.ok(result);
  const fields = [...result.matchAll(/^\s*(\w+)\s+(?:uuid|text|integer|date|text\[\])/gm)].map(m => m[1]);
  assert.deepEqual(fields, ['id','name','alias','avatar_url','bio','age','seeking','zones','budget_min','budget_max','move_in_date','traits','viewer_scope']);
});
check('Legacy traits gated and private by default', () => {
  assert.match(sql, /case when visibility\.living_visible and \(dna\.model_version is distinct from 2\)\s*then p\.traits else null end as traits/);
  assert.match(sql, /coalesce\(pref\.answers -> 'privacy' -> 'controls' ->> 'living', 'private'\)/);
  assert.match(sql, /= 'connections'/);
  assert.match(sql, /c\.status = 'accepted'/);
});
check('Other protections retained', () => {
  for (const predicate of ['visibility.search_visible','visibility.budget_visible','p.onboarding_completed = true','p.id <> auth.uid()','public.users_are_blocked','_target_user_id is null']) assert.ok(sql.includes(predicate), predicate);
});
check('Access remains authenticated only', () => {
  assert.match(sql, /revoke all on function public\.get_visible_profiles\(uuid\) from public, anon;/);
  assert.match(sql, /grant execute on function public\.get_visible_profiles\(uuid\) to authenticated;/);
});
console.log('ROOMS LEGACY PUBLIC PROFILE PRIVACY CONTRACT OK');
