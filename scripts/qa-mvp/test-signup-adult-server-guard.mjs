import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sql = readFileSync(
  'supabase/migrations/20261021_signup_adult_guard.sql',
  'utf8'
);

const app = readFileSync(
  'assets/js/supabase-app.js',
  'utf8'
);

function check(condition, label) {
  assert(condition, label);
  console.log(`OK ${label}`);
}

check(
  /rooms_age_18_confirmed/.test(sql) &&
  /Adult declaration required/.test(sql),
  'Declaracion de mayoria de edad exigida'
);

check(
  /IS DISTINCT FROM 'true'::jsonb/i.test(sql),
  'Declaracion ausente o falsa rechazada'
);

check(
  /rooms_terms_accepted/.test(sql),
  'Aceptacion de condiciones conservada'
);

check(
  /v_version IS DISTINCT FROM v_current_version/.test(sql),
  'Solo se acepta la version vigente'
);

check(
  /INSERT INTO public\.legal_acceptances/i.test(sql),
  'Registro de aceptacion conservado'
);

check(
  /SECURITY DEFINER[\s\S]*?SET search_path = ''/i.test(sql),
  'Funcion con search_path restringido'
);

check(
  /ROOMS_LEGAL_REGISTRATION_READY = false/.test(app),
  'Registro sigue cerrado en interfaz'
);

check(
  /rooms_age_18_confirmed:\s*true/.test(app),
  'Formulario transmite la declaracion'
);

console.log('ROOMS SIGNUP ADULT SERVER CONTRACT OK');
