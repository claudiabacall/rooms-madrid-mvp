import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const dom = new JSDOM(`
  <div id="settingsAccountEmail"></div>
  <button id="requestAccountDeletion"></button>
  <p id="accountDeletionStatus"></p>
  <button id="changePassword"></button>
  <button id="realLogoutButton"></button>
`, {
  url: 'http://127.0.0.1:4173/',
  runScripts: 'outside-only'
});

const { window } = dom;
const requests = [];
const notifications = [];
let confirmed = false;
let nextError = null;

const userId = '11111111-1111-4111-8111-111111111111';

const db = {
  auth: {
    resetPasswordForEmail: async () => ({ error: null }),
    signOut: async () => ({ error: null })
  },
  from(table) {
    assert.equal(table, 'account_deletion_requests');
    return {
      async insert(payload) {
        requests.push(payload);
        return { error: nextError };
      }
    };
  }
};

window.confirm = () => confirmed;

window.eval(readFileSync(
  'assets/js/features/account-settings.js', 'utf8'
));

const feature = window.ROOMS_ACCOUNT_SETTINGS_FEATURE.create({
  db,
  state: { user: { id: userId, email: 'qa@example.test' } },
  notify: message => notifications.push(message)
});

assert(feature, 'No se pudo crear Account Settings');

const button = window.document.querySelector(
  '#requestAccountDeletion'
);
const status = window.document.querySelector(
  '#accountDeletionStatus'
);

const flush = () => new Promise(resolve => setImmediate(resolve));

button.click();
await flush();

assert.equal(requests.length, 0);
console.log('OK Cancelar no genera solicitud');

confirmed = true;
button.click();
await flush();

assert.equal(requests.length, 1);
assert.equal(requests[0].user_id, userId);
assert.match(status.textContent, /registrada correctamente/);
assert.equal(button.disabled, false);
console.log('OK Confirmacion registra solicitud del propio usuario');

nextError = { code: '23505', message: 'duplicate key' };
button.click();
await flush();

assert.equal(requests.length, 2);
assert.match(status.textContent, /Ya existe una solicitud/);
console.log('OK Solicitud duplicada controlada');

nextError = { code: '42501', message: 'permission denied' };
const originalConsoleError = window.console.error;
window.console.error = () => {};

try {
  button.click();
  await flush();
} finally {
  window.console.error = originalConsoleError;
}

assert.equal(requests.length, 3);
assert.match(status.textContent, /No se pudo registrar/);
assert.equal(button.disabled, false);
console.log('OK Error de permisos controlado');

assert(notifications.length >= 3);
console.log('OK No se ejecutaron eliminaciones de cuenta');
console.log('ROOMS ACCOUNT DELETION REQUEST UI OK');

dom.window.close();
