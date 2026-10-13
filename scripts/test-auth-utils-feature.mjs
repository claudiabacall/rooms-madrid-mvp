import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(
  'assets/js/features/auth-utils.js', 'utf8'
);
const html = fs.readFileSync('index.html', 'utf8');
const app = fs.readFileSync(
  'assets/js/supabase-app.js', 'utf8'
);

const loaded = [];
const location = {
  hash: '',
  pathname: '/index.html',
  search: '?mode=test'
};

const context = {
  window: {
    location,
    history: {
      replaceState(_state, _title, url) {
        loaded.push(url);
      }
    }
  },
  URLSearchParams
};

vm.runInNewContext(source, context);

const utils = context.window.ROOMS_AUTH_UTILS;

assert.equal(typeof utils?.translateAuthError, 'function');
assert.equal(typeof utils?.readAuthUrlError, 'function');

assert.equal(
  utils.translateAuthError('Invalid login credentials'),
  'Email o contraseña incorrectos.'
);
assert.equal(
  utils.translateAuthError('User already registered'),
  'Ya existe una cuenta con ese email.'
);
assert.equal(
  utils.translateAuthError('Unknown error'),
  'No hemos podido completar el acceso. Inténtalo de nuevo.'
);

assert.equal(utils.readAuthUrlError(), null);

location.hash = '#section';
assert.equal(utils.readAuthUrlError(), null);
assert.equal(loaded.length, 0);

location.hash =
  '#error=access_denied&error_code=otp_expired&error_description=Expired';

const error = utils.readAuthUrlError();
assert.equal(error.error, 'access_denied');
assert.equal(error.code, 'otp_expired');
assert.equal(error.description, 'Expired');
assert.deepEqual(loaded, ['/index.html?mode=test']);

const moduleTag =
  'src="assets/js/features/auth-utils.js"';
const appTag =
  'src="assets/js/supabase-app.js"';

assert.ok(html.indexOf(moduleTag) >= 0);
assert.ok(html.indexOf(moduleTag) < html.indexOf(appTag));

assert.ok(app.includes('window.ROOMS_AUTH_UTILS'));
assert.doesNotMatch(app, /function translateAuthError\s*\(/);
assert.doesNotMatch(app, /function readAuthUrlError\s*\(/);

console.log('OK  Traduccion de errores');
console.log('OK  Lectura de errores de recuperacion');
console.log('OK  Limpieza de URL');
console.log('OK  Orden de carga');
console.log('OK  Sin funciones duplicadas');
console.log('AUTH UTILS TEST OK');
