import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sql = readFileSync(
  'docs/review/m511d-beta-invite-consumption-draft.sql',
  'utf8'
);

const executable = sql.replace(/--[^\n]*/g, '');

test('Funcion prevista antes de insertar', () => {
  assert.match(sql, /RETURNS trigger/i);
  assert.match(sql, /TG_OP <> 'INSERT'/);
});

test('Utiliza SHA-256 de Supabase', () => {
  assert.match(
    sql,
    /extensions\.digest\(v_token,\s*'sha256'\)/i
  );
});

test('Asocia invitacion al correo', () => {
  assert.match(
    sql,
    /email_normalized\s*=/i
  );
});

test('Comprueba uso, revocacion y caducidad', () => {
  assert.match(sql, /used_at IS NULL/i);
  assert.match(sql, /revoked_at IS NULL/i);
  assert.match(sql, /expires_at > statement_timestamp\(\)/i);
});

test('Exige documentos y declaracion legal', () => {
  assert.match(sql, /document_type = 'privacy'/i);
  assert.match(sql, /document_type = 'terms'/i);
  assert.match(sql, /rooms_age_18_confirmed/i);
  assert.match(sql, /rooms_terms_accepted/i);
});

test('Consume invitacion mediante UPDATE condicional', () => {
  assert.match(
    sql,
    /UPDATE rooms_private\.beta_invitations/i
  );
  assert.match(sql, /RETURNING id INTO v_invitation_id/i);
});

test('Elimina token de metadatos persistidos', () => {
  assert.match(
    sql,
    /NEW\.raw_user_meta_data\s*:=/i
  );
  assert.match(
    sql,
    /-\s*'rooms_beta_invite_token'/i
  );
});

test('No instala triggers ni abre el registro', () => {
  assert.doesNotMatch(
    executable,
    /\b(?:CREATE|DROP|ALTER)\s+TRIGGER\b/i
  );
  assert.doesNotMatch(
    executable,
    /\bGRANT\b/i
  );
  assert.doesNotMatch(
    executable,
    /\bDROP\s+FUNCTION\b/i
  );
});
