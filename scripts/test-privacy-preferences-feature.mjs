import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';

const previous = execFileSync(
  'git',
  ['show', 'HEAD:assets/js/features/privacy-preferences.js'],
  { encoding: 'utf8' }
);

const previousContext = { window: {} };
vm.runInNewContext(previous, previousContext);

const original =
  previousContext.window.ROOMS_PRIVACY_PREFERENCES
    ?.normalizePreferencesRecord;

assert.equal(typeof original, 'function');

const context = { window: {} };

vm.runInNewContext(
  fs.readFileSync(
    'assets/js/features/privacy-preferences.js',
    'utf8'
  ),
  context
);

const extracted =
  context.window.ROOMS_PRIVACY_PREFERENCES
    ?.normalizePreferencesRecord;

assert.equal(typeof extracted, 'function');

const cases = [
  null,
  {},
  { answers: {} },
  { answers: { privacy: {} } },
  { answers: { privacy: { level: 'public' } } },
  {
    answers: {
      privacy: {
        level: 'balanced',
        controls: {
          habits: true,
          searching: false,
          posts: true,
          communities: false
        }
      }
    }
  },
  {
    answers: {
      privacy: {
        level: 'private',
        controls: {
          living: 'connections',
          search: 'private',
          budget: 'public',
          activity: 'connections'
        }
      },
      living: { noise: 'quiet' }
    }
  },
  {
    answers: {
      privacy: {
        level: 'invalid',
        controls: {
          living: 'invalid',
          search: null,
          budget: 'private'
        }
      }
    }
  }
];

const snapshot = value => JSON.stringify(value);

for (const sample of cases) {
  const input = snapshot(sample);
  const clone = () =>
    input === undefined ? undefined : JSON.parse(input);

  const oldResult = original(clone());
  const newResult = extracted(clone());

  assert.equal(
    snapshot(newResult),
    snapshot(oldResult),
    `Resultado diferente para: ${input}`
  );
}

const html = fs.readFileSync('index.html', 'utf8');
const app = fs.readFileSync(
  'assets/js/supabase-app.js', 'utf8'
);

const moduleTag =
  'src="assets/js/features/privacy-preferences.js"';
const appTag =
  'src="assets/js/supabase-app.js"';

assert.ok(html.includes(moduleTag));
assert.ok(html.indexOf(moduleTag) < html.indexOf(appTag));
assert.ok(app.includes('window.ROOMS_PRIVACY_PREFERENCES'));
assert.doesNotMatch(
  app,
  /function normalizePreferencesRecord\s*\(/
);

console.log('OK  Ocho escenarios equivalentes');
console.log('OK  Preferencias antiguas y nuevas');
console.log('OK  Orden de carga');
console.log('OK  Sin funcion duplicada');
console.log('PRIVACY PREFERENCES TEST OK');
