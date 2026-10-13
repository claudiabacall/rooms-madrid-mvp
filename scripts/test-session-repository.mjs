import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(
  'assets/js/features/session-repository.js',
  'utf8'
);

const context = { window: {} };
vm.runInNewContext(source, context);

const factory = context.window.ROOMS_SESSION_REPOSITORY?.create;
assert.equal(typeof factory, 'function');

const expected = [
  ['profiles', '*', 'id', 'single'],
  ['onboarding_preferences', 'answers,updated_at', 'user_id', 'single'],
  ['match_preferences', '*', 'user_id', 'single'],
  ['user_intents', 'intent', 'user_id', 'list'],
  ['rooms_dna', '*', 'user_id', 'single']
];

function makeClient(responses, calls) {
  return {
    from(table) {
      const call = { table, select: null, filter: null, mode: 'list' };
      calls.push(call);

      const query = {
        select(columns) {
          call.select = columns;
          return query;
        },
        eq(column, value) {
          call.filter = [column, value];
          return query;
        },
        maybeSingle() {
          call.mode = 'single';
          return Promise.resolve(responses[table]);
        },
        then(resolve, reject) {
          return Promise.resolve(responses[table]).then(resolve, reject);
        }
      };

      return query;
    }
  };
}

const userId = 'test-user-123';
const calls = [];

const responses = Object.fromEntries(
  expected.map(([table]) => [
    table,
    { data: table === 'user_intents' ? [{ intent: 'rent' }] : { table }, error: null }
  ])
);

const repository = factory({
  db: makeClient(responses, calls)
});

const result = await repository.loadSessionData(userId);

assert.equal(result.length, 5);
assert.equal(calls.length, 5);

expected.forEach(([table, columns, key, mode], index) => {
  assert.equal(calls[index].table, table);
  assert.equal(calls[index].select, columns);
  assert.deepEqual(calls[index].filter, [key, userId]);
  assert.equal(calls[index].mode, mode);
  assert.deepEqual(result[index], responses[table]);
});

console.log('OK  Cinco consultas, columnas y filtros');
console.log('OK  Resultados y orden conservados');

const dbError = { message: 'DNA unavailable', code: 'TEST' };
const errorResponses = {
  ...responses,
  rooms_dna: { data: null, error: dbError }
};

const errors = await factory({
  db: makeClient(errorResponses, [])
}).loadSessionData(userId);

assert.strictEqual(errors[4].error, dbError);
assert.deepEqual(errors[0], responses.profiles);

console.log('OK  Error de Supabase conservado');

assert.throws(() => factory({ db: null }), /Supabase/);

console.log('OK  Cliente obligatorio');

const html = fs.readFileSync('index.html', 'utf8');
const app = fs.readFileSync('assets/js/supabase-app.js', 'utf8');

const repoTag = 'src="assets/js/features/session-repository.js"';
const appTag = 'src="assets/js/supabase-app.js"';

assert.ok(html.includes(repoTag));
assert.ok(html.indexOf(repoTag) < html.indexOf(appTag));
assert.ok(app.includes('sessionRepository.loadSessionData(state.user.id)'));

console.log('OK  Integracion y orden de carga');
console.log('SESSION REPOSITORY TEST OK');
