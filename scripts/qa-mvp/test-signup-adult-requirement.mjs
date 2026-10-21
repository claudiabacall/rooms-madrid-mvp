import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(
  'assets/js/supabase-app.js',
  'utf8'
);

function check(condition, label) {
  assert(condition, label);
  console.log(`OK ${label}`);
}

check(
  /id="authConfirmAdult" type="checkbox"/.test(source),
  'Casilla de mayoria de edad'
);

check(
  /Confirmo que tengo 18 años o más/.test(source),
  'Texto visible para el usuario'
);

check(
  /document\.querySelector\('#authConfirmAdult'\)\.checked = false/.test(source),
  'Casilla reiniciada al cambiar de modo'
);

const ageGuard = source.indexOf(
  "if (!document.querySelector('#authConfirmAdult').checked)"
);

const signup = source.indexOf('db.auth.signUp(');

check(
  ageGuard >= 0 && signup > ageGuard,
  'Comprobacion antes de crear la cuenta'
);

check(
  /rooms_age_18_confirmed: true/.test(source),
  'Declaracion transmitida al registro'
);

check(
  /ROOMS_LEGAL_REGISTRATION_READY = false/.test(source),
  'Registro permanece cerrado'
);

check(
  /db\.auth\.signInWithPassword/.test(source),
  'Inicio de sesion conservado'
);

console.log('ROOMS SIGNUP 18+ CONTRACT OK');
