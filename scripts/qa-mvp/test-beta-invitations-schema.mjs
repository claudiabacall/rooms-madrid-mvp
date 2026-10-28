import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sql = readFileSync(
  'docs/review/m511c-beta-invitations-draft.sql',
  'utf8'
);

test('Esquema de invitaciones separado', () => {
  assert.match(sql, /CREATE SCHEMA IF NOT EXISTS rooms_private/i);
  assert.match(sql, /rooms_private\.beta_invitations/i);
});

test('Token almacenado como digest', () => {
  assert.match(sql, /token_digest bytea NOT NULL UNIQUE/i);
  assert.match(sql, /octet_length\(token_digest\) = 32/i);
});

test('Caducidad, uso y revocacion', () => {
  assert.match(sql, /expires_at timestamptz NOT NULL/i);
  assert.match(sql, /used_at timestamptz/i);
  assert.match(sql, /revoked_at timestamptz/i);
});

test('Tabla protegida por RLS', () => {
  assert.match(
    sql,
    /ALTER TABLE rooms_private\.beta_invitations\s+ENABLE ROW LEVEL SECURITY/i
  );
  assert.match(
    sql,
    /REVOKE ALL ON rooms_private\.beta_invitations\s+FROM PUBLIC, anon, authenticated/i
  );
});

test('No modifica Auth ni abre el registro', () => {
  const executable = sql.replace(/--[^\n]*/g, '');
  assert.doesNotMatch(
    executable,
    /\b(?:ALTER|INSERT|UPDATE|DELETE)\s+(?:TABLE\s+)?auth\.users\b/i
  );
  assert.doesNotMatch(
    executable,
    /\b(?:DROP|CREATE|ALTER)\s+TRIGGER\b/i
  );
  assert.doesNotMatch(
    executable,
    /rooms_beta_registration_closed/i
  );
});

test('No concede acceso publico', () => {
  const executable = sql.replace(/--[^\n]*/g, '');
  assert.doesNotMatch(
    executable,
    /\bGRANT\b/i
  );
});
