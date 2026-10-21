import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync('.env.rooms-test.local', 'utf8')
    .split(/\r?\n/)
    .filter(line => /^[A-Za-z_][A-Za-z_0-9]*=/.test(line))
    .map(line => {
      const i = line.indexOf('=');
      return [
        line.slice(0, i),
        line.slice(i + 1).trim().replace(/^['"]|['"]$/g, '')
      ];
    })
);

const config = readFileSync(
  'assets/js/supabase-config.js',
  'utf8'
);

const url = config.match(
  /url:\s*['"](https:\/\/[^'"]+)['"]/
)?.[1];

const anonKey = config.match(
  /key:\s*['"]([^'"]+)['"]/
)?.[1];

assert(url && anonKey, 'Falta configuracion publica de Supabase');
assert(
  env.ROOMS_TEST_EMAIL && env.ROOMS_TEST_PASSWORD,
  'Faltan credenciales QA'
);

const loginResponse = await fetch(
  `${url}/auth/v1/token?grant_type=password`,
  {
    method: 'POST',
    headers: {
      apikey: anonKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email: env.ROOMS_TEST_EMAIL,
      password: env.ROOMS_TEST_PASSWORD
    })
  }
);

const login = await loginResponse.json();

assert(
  loginResponse.ok && login.access_token,
  'No se pudo autenticar la cuenta QA'
);

console.log('OK Cuenta QA autenticada');

const version = 'rooms-version-inexistente-qa-20261021';

const response = await fetch(
  `${url}/rest/v1/rpc/record_terms_acceptance`,
  {
    method: 'POST',
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${login.access_token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      p_version: version
    })
  }
);

const result = await response.json();

assert(
  !response.ok,
  'ERROR: Supabase ha aceptado una version inexistente'
);

assert.match(
  result.message || '',
  /Terms version not published/
);

console.log('OK Version inexistente rechazada');
console.log('OK No se ha registrado aceptacion');
console.log('ROOMS LEGAL ACCEPTANCE RPC OK');
