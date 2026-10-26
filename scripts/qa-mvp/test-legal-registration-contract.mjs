import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(
  'assets/js/supabase-app.js',
  'utf8'
);

assert.match(
  source,
  /const ROOMS_LEGAL_REGISTRATION_READY = true/
);
assert.match(
  source,
  /\.from\('legal_document_versions'\)/
);
assert.match(
  source,
  /\.eq\('is_current', true\)/
);
assert.match(
  source,
  /if \(!valid\(terms\) \|\| !valid\(privacy\)\)/
);
console.log('OK Registro condicionado a documentos legales vigentes');

assert.match(
  source,
  /signupTermsVersion\s*=\s*null/
);
assert.match(
  source,
  /signupTermsVersion\s*=\s*terms\.version/
);
console.log('OK Version obtenida de Supabase y no prefijada');

assert.match(source, /id="authAcceptTerms"/);
assert.match(source, /type="checkbox"/);
console.log('OK Casilla de aceptacion preparada');

const guard = source.indexOf(
  "if (!ROOMS_LEGAL_REGISTRATION_READY || !signupTermsVersion)"
);

assert.match(
  source,
  /signupTermsVersion\s*=\s*terms\.version/
);
console.log('OK Version legal obtenida del documento vigente');
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

assert.match(
  source,
  /if \(!document\.querySelector\('#authConfirmAdult'\)\.checked\)/
);
assert.match(
  source,
  /rooms_age_18_confirmed:\s*true/
);
console.log('OK Declaracion de mayoria de edad obligatoria');

console.log('ROOMS LEGAL REGISTRATION CONTRACT OK');
