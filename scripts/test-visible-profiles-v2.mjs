import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sql = readFileSync('supabase/migrations/20261014165000_visible_profiles_v2.sql', 'utf8');
const app = readFileSync('assets/js/supabase-app.js', 'utf8');
const profiles = readFileSync('assets/js/features/profiles.js', 'utf8');

assert.match(sql, /create or replace function public\.get_visible_profiles_v2\(/i);
assert.match(sql, /interests text\[\]/i);
assert.match(sql, /jsonb_array_elements_text\(dna\.answers -> 'world_interests'\)/i);
assert.match(sql, /as living_visible/i);
assert.equal((sql.match(/coalesce\(pref\.answers -> 'privacy' -> 'controls' ->> 'living', 'private'\)/g) || []).length, 2, 'Sin preferencia living, la privacidad debe ser private');
assert.doesNotMatch(sql, /coalesce\(pref\.answers -> 'privacy' -> 'controls' ->> 'living', 'public'\)/i);
assert.match(sql, /case when visibility\.living_visible and \(dna\.model_version is distinct from 2\)/i);
assert.match(sql, /not public\.users_are_blocked/i);
assert.match(sql, /p\.onboarding_completed = true/i);
assert.match(sql, /as search_visible/i);
assert.match(sql, /as budget_visible/i);
assert.match(sql, /revoke all on function public\.get_visible_profiles\(uuid\) from public, anon, authenticated/i);
assert.match(sql, /grant execute on function public\.get_visible_profiles_v2\(uuid\) to authenticated/i);
assert.equal((app.match(/'get_visible_profiles_v2'/g) || []).length, 2);
assert.equal((app.match(/'get_visible_profiles'/g) || []).length, 0);
for (const label of ['sport', 'music', 'cinema', 'art', 'nature', 'fashion', 'pets']) {
  assert.match(profiles, new RegExp(`\\b${label}\\b`));
}
assert.match(profiles, /interests\.map\(id => interestLabels\[id\]\)/);
console.log('ROOMS VISIBLE PROFILES V2 CONTRACT OK');

// Exercise the actual foreign-profile renderer without a browser dependency.
const { runInNewContext } = await import('node:vm');
const hero = { innerHTML: '' };
const content = { innerHTML: '' };
const footer = { innerHTML: '', hidden: false };
const modal = { querySelector: selector => ({
  '.profile-hero': hero,
  '.user-profile-content': content,
  '.profile-fixed-actions': footer
})[selector] || null };
const windowStub = {};
runInNewContext(profiles, {
  window: windowStub,
  document: { querySelector: () => modal },
  Intl, Date, Set
});
const state = { targetProfile: null, blockedUsers: new Set(), savedItems: new Set() };
const render = windowStub.ROOMS_PROFILES_FEATURE.create({
  state,
  escapeHtml: value => String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;'),
  initials: () => 'RT',
  labelSeeking: value => value,
  formatBudget: () => 'Sin definir',
  loadConnection: async () => {},
  connectionButtonLabel: () => 'Conectar',
  updateConnectButtons: () => {},
  showModal: () => {}
});
await render.openRealUser({
  id: 'user-target', name: 'Test', interests: ['cinema','art','nature','fashion','music'],
  traits: null, seeking: null, zones: null
});
for (const label of ['Cine', 'Arte', 'Naturaleza', 'Fashion', 'Música']) {
  assert.ok(content.innerHTML.includes(label), `No se mostró el interés ${label}`);
}
assert.ok(!content.innerHTML.includes('<small>CONVIVENCIA</small>'), 'Se mostró convivencia oculta');
await render.openRealUser({ id: 'user-target', name: 'Test', interests: null, traits: null });
assert.ok(!content.innerHTML.includes('class="real-user-profile-chips interests"'), 'Se mostraron intereses ocultos');
console.log('ROOMS VISIBLE PROFILES V2 RENDER OK');
