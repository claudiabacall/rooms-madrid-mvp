import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { prepareBetaInvitation } from './beta-invite-issuer.mjs';

test('Genera una invitacion privada valida', () => {
  const result = prepareBetaInvitation({
    email: '  FRIEND@Example.com  ',
    now: new Date('2026-10-29T10:00:00Z')
  });

  assert.equal(
    result.record.email_normalized,
    'friend@example.com'
  );

  assert.match(result.token, /^[A-Za-z0-9_-]{43}$/);

  assert.equal(
    result.record.token_digest_hex,
    createHash('sha256')
      .update(result.token)
      .digest('hex')
  );

  assert.equal(
    result.record.expires_at,
    '2026-11-01T10:00:00.000Z'
  );
});

test('No reutiliza tokens', () => {
  const a = prepareBetaInvitation({
    email: 'friend@example.com'
  });

  const b = prepareBetaInvitation({
    email: 'friend@example.com'
  });

  assert.notEqual(a.token, b.token);
  assert.notEqual(
    a.record.token_digest_hex,
    b.record.token_digest_hex
  );
});

test('Rechaza correos invalidos', () => {
  for (const email of ['', 'incorrecto', 'a@', 'a b@example.com']) {
    assert.throws(() =>
      prepareBetaInvitation({ email })
    );
  }
});

test('Limita la caducidad', () => {
  for (const ttlHours of [0, -1, 169, 1.5]) {
    assert.throws(() =>
      prepareBetaInvitation({
        email: 'friend@example.com',
        ttlHours
      })
    );
  }
});

test('Rechaza fechas invalidas', () => {
  assert.throws(() =>
    prepareBetaInvitation({
      email: 'friend@example.com',
      now: new Date('invalid')
    })
  );
});
