import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('assets/js/features/discovery-repository.js', 'utf8');
const context = { window: {} };
vm.runInNewContext(source, context);
const create = context.window.ROOMS_DISCOVERY_REPOSITORY?.create;
assert.equal(typeof create, 'function');

const calls = [];
const responses = {
  listings: { data: [{ id: 'listing' }], error: null },
  profiles: { data: [{ id: 'profile' }], error: null },
  posts: { data: [{ id: 'post' }], error: null },
  communities: { data: [{ id: 'community' }], error: null },
  community_members: { data: [{ community_id: 'community' }], error: null }
};
const db = {
  from(table) {
    const call = { method: 'from', table };
    calls.push(call);
    const query = {
      select(columns) { call.columns = columns; return query; },
      eq(column, value) { call.filter = [column, value]; return table === 'community_members' ? Promise.resolve(responses[table]) : query; },
      order(column, options) { call.order = [column, options.ascending]; return Promise.resolve(responses[table]); }
    };
    return query;
  },
  rpc(name, args) {
    calls.push({ method: 'rpc', name, args });
    return Promise.resolve(responses.profiles);
  }
};
const result = await create({ db }).loadDiscoveryData();
assert.equal(result.length, 4);
[result[0], result[1], result[2], result[3]].forEach((item, index) => {
  assert.strictEqual(item, [responses.listings, responses.profiles, responses.posts, responses.communities][index]);
});
assert.equal(calls.length, 4);
assert.deepEqual(calls.map(call => call.table || call.name), ['listings', 'get_visible_profiles', 'posts', 'communities']);
for (const [idx, status] of [[0, 'published'], [2, 'published'], [3, 'active']]) {
  assert.equal(calls[idx].columns, '*');
  assert.deepEqual(calls[idx].filter, ['status', status]);
  assert.deepEqual(calls[idx].order, ['created_at', false]);
}
assert.equal(calls[1].args._target_user_id, null);
const activeMembersResult = await create({ db }).loadActiveCommunityMembers();
assert.strictEqual(activeMembersResult, responses.community_members);
assert.deepEqual(calls.at(-1), {
  method: 'from', table: 'community_members', columns: 'community_id', filter: ['status', 'active']
});
assert.throws(() => create({}), /Supabase/);

const app = fs.readFileSync('assets/js/supabase-app.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');
const repoTag = 'src="assets/js/features/discovery-repository.js"';
const appTag = 'src="assets/js/supabase-app.js"';
assert.ok(html.includes(repoTag) && html.indexOf(repoTag) < html.indexOf(appTag));
assert.ok(app.includes('discoveryRepository.loadDiscoveryData()'));
assert.ok(app.includes('discoveryRepository.loadActiveCommunityMembers()'));
assert.ok(!app.includes(".from('community_members')"));
console.log('OK  Consultas, filtros, orden y contrato de respuesta');
console.log('OK  Integracion y orden de carga');
console.log('OK  Conteo de miembros activos delegado a Discovery');
console.log('DISCOVERY REPOSITORY TEST OK');
