import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sql = readFileSync(
  'supabase/migrations/20261021_legal_acceptances.sql',
  'utf8'
).toLowerCase();

function check(pattern, label) {
  assert.match(sql, pattern, label);
  console.log(`OK ${label}`);
}

check(
  /create table if not exists public\.legal_document_versions/,
  'Registro de versiones legales'
);

check(
  /create table if not exists public\.legal_acceptances/,
  'Registro de aceptaciones'
);

check(
  /accepted_at timestamptz not null default now\(\)/,
  'Fecha asignada por base de datos'
);

check(
  /primary key \(user_id, document_type, version\)/,
  'Aceptaciones duplicadas restringidas'
);

check(
  /foreign key \(document_type, version\)[\s\S]*?references public\.legal_document_versions/,
  'Version de documento referenciada'
);

check(
  /alter table public\.legal_acceptances\s+enable row level security/,
  'RLS habilitado'
);

check(
  /grant select on public\.legal_acceptances\s+to authenticated/,
  'Usuarios con permiso solo de lectura'
);

check(
  /using \(user_id = \(select auth\.uid\(\)\)\)/,
  'Consulta limitada al usuario autenticado'
);

check(
  /security definer[\s\S]*?set search_path = ''/,
  'Funcion con search_path restringido'
);

check(
  /v_user_id := auth\.uid\(\)/,
  'Identidad obtenida de Auth'
);

check(
  /published_at is not null/,
  'Version publicada obligatoria'
);

check(
  /revoke all on function public\.record_terms_acceptance\(text\)\s+from public, anon/,
  'Ejecucion publica y anonima revocada'
);

check(
  /grant execute on function\s+public\.record_terms_acceptance\(text\)\s+to authenticated/,
  'Ejecucion reservada a usuarios autenticados'
);

assert.doesNotMatch(
  sql,
  /grant\s+(insert|update|delete|all)\s+on public\.legal_acceptances\s+to authenticated/,
  'No deben concederse escrituras directas'
);
console.log('OK Sin permisos directos de escritura');

console.log('');
console.log('ROOMS LEGAL MIGRATION CONTRACT OK');
console.log('PENDIENTE: validar RLS y RPC en Supabase real');
