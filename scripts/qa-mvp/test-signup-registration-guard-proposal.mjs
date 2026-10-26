import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sql = readFileSync(
  'supabase/migrations/20261026_signup_registration_guard.sql',
  'utf8'
);

const code = sql.replace(/--[^\n]*/g, '');

function check(condition, label) {
  assert.ok(condition, label);
  console.log('OK ' + label);
}

check(
  /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.capture_signup_terms_acceptance\s*\(\)/i.test(code),
  'Funcion correcta'
);

check(
  /SECURITY\s+DEFINER\s+SET\s+search_path\s*=\s*''/i.test(code),
  'Funcion con search_path restringido'
);

check(
  /document_type\s*=\s*'terms'[\s\S]*?is_current\s*=\s*true[\s\S]*?published_at\s+IS\s+NOT\s+NULL/i.test(code),
  'Condiciones vigentes y publicadas'
);

check(
  /IF\s+v_current_version\s+IS\s+NULL\s+THEN\s+RAISE\s+EXCEPTION/i.test(code),
  'Registro rechazado sin condiciones vigentes'
);

check(
  /rooms_age_18_confirmed[\s\S]*?IS\s+DISTINCT\s+FROM\s+'true'::jsonb[\s\S]*?RAISE\s+EXCEPTION\s+'Adult declaration required'/i.test(code),
  'Mayor de edad obligatoria'
);

check(
  /rooms_terms_accepted[\s\S]*?IS\s+DISTINCT\s+FROM\s+'true'::jsonb[\s\S]*?RAISE\s+EXCEPTION\s+'Terms acceptance required'/i.test(code),
  'Aceptacion expresa obligatoria'
);

check(
  /v_accepted_version\s+IS\s+DISTINCT\s+FROM\s+v_current_version/i.test(code),
  'Version aceptada debe ser la vigente'
);

check(
  /INSERT\s+INTO\s+public\.legal_acceptances/i.test(code),
  'Aceptacion registrada'
);

check(
  /REVOKE\s+ALL\s+ON\s+FUNCTION/i.test(code),
  'Permisos de ejecucion revocados'
);

check(
  !/\b(?:CREATE|DROP)\s+TRIGGER\b/i.test(code),
  'No altera el trigger existente'
);

check(
  !/\b(?:DROP\s+(?:TABLE|SCHEMA)|TRUNCATE|DELETE\s+FROM)\b/i.test(code),
  'No incluye operaciones destructivas'
);

console.log('ROOMS REGISTRATION GUARD PROPOSAL OK');
console.log('AVISO: test estatico; no comprueba Supabase remoto');
