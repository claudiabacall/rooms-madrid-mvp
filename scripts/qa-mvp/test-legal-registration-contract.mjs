import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(
  'assets/js/supabase-app.js',
  'utf8'
);

assert.match(
  source,
  /const ROOMS_LEGAL_REGISTRATION_READY = false/
);
console.log('OK Registro cerrado hasta aprobacion legal');

assert.match(
  source,
  /const ROOMS_TERMS_VERSION = null/
);
console.log('OK Version de condiciones pendiente');

assert.match(source, /id="authAcceptTerms"/);
assert.match(source, /type="checkbox"/);
console.log('OK Casilla de aceptacion preparada');

const guard = source.indexOf(
  "if (!ROOMS_LEGAL_REGISTRATION_READY || !ROOMS_TERMS_VERSION)"
);
const signup = source.indexOf('db.auth.signUp(');

assert(guard >= 0 && signup > guard);
console.log('OK Bloqueo situado antes de signUp');

assert.match(source, /db\.auth\.signInWithPassword/);
console.log('OK Login conservado');

assert.match(
  source,
  /if \(!document\.querySelector\('#authAcceptTerms'\)\.checked\)/
);
console.log('OK Aceptacion obligatoria prevista');

console.log('ROOMS LEGAL REGISTRATION CONTRACT OK');
