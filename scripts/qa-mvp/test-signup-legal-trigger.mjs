import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sql = readFileSync(
  'supabase/migrations/20261021_signup_terms_trigger.sql',
  'utf8'
);

const app = readFileSync(
  'assets/js/supabase-app.js',
  'utf8'
);

function check(condition, message) {
  assert(condition, message);
  console.log(`OK ${message}`);
}

check(
  /after insert on auth\.users/i.test(sql),
  'Trigger vinculado a creacion de usuario'
);

check(
  /security definer[\s\S]*?set search_path = ''/i.test(sql),
  'Funcion con search_path restringido'
);

check(
  /rooms_terms_accepted/.test(sql) &&
  /rooms_terms_version/.test(sql),
  'Declaracion y version verificadas'
);

check(
  /published_at is not null/i.test(sql),
  'Solo versiones publicadas'
);

check(
  /insert into public\.legal_acceptances/i.test(sql) &&
  /now\(\)/i.test(sql),
  'Aceptacion con fecha del servidor'
);

check(
  /raise exception 'Terms acceptance required'/i.test(sql),
  'Registro sin aceptacion rechazado cuando hay condiciones'
);

check(
  /ROOMS_LEGAL_REGISTRATION_READY = false/.test(app),
  'Registro publico permanece cerrado'
);

check(
  /rooms_terms_accepted:\s*true/.test(app) &&
  /rooms_terms_version:\s*signupTermsVersion/.test(app),
  'Cliente envia declaracion y version'
);

check(
  /db\.auth\.signInWithPassword/.test(app),
  'Inicio de sesion conservado'
);

console.log('ROOMS SIGNUP LEGAL TRIGGER CONTRACT OK');
console.log('PENDIENTE: verificar trigger en Supabase real');
