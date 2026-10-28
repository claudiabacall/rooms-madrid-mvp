import test from 'node:test';
import assert from 'node:assert/strict';
import { checkBetaInvite } from './beta-invite-policy.mjs';

const valid = () => ({
  invite: {
    email: 'invitado@example.com',
    status: 'pending',
    used_at: null,
    expires_at: '2026-12-01T00:00:00Z'
  },
  email: 'invitado@example.com',
  now: '2026-11-01T00:00:00Z',
  registrationOpen: true,
  legalApproved: true,
  adultConfirmed: true,
  termsAccepted: true,
  currentTermsVersion: '1.0',
  acceptedTermsVersion: '1.0'
});

test('Registro cerrado rechaza invitacion', () => {
  assert.equal(
    checkBetaInvite({
      ...valid(),
      registrationOpen: false
    }).allowed, false
  );
});

test('Sin aprobacion legal no hay acceso', () => {
  assert.equal(
    checkBetaInvite({
      ...valid(),
      legalApproved: false
    }).allowed, false
  );
});

test('Correo distinto rechazado', () => {
  assert.equal(
    checkBetaInvite({
      ...valid(),
      email: 'otro@example.com'
    }).reason, 'EMAIL_MISMATCH'
  );
});

test('Invitacion utilizada rechazada', () => {
  const input = valid();
  input.invite.used_at = '2026-10-30T00:00:00Z';
  assert.equal(
    checkBetaInvite(input).reason,
    'INVITE_ALREADY_USED'
  );
});

test('Invitacion caducada rechazada', () => {
  assert.equal(
    checkBetaInvite({
      ...valid(),
      now: '2026-12-02T00:00:00Z'
    }).reason, 'INVITE_EXPIRED'
  );
});

test('Requisitos legales obligatorios', () => {
  assert.equal(
    checkBetaInvite({
      ...valid(),
      adultConfirmed: false
    }).allowed, false
  );
  assert.equal(
    checkBetaInvite({
      ...valid(),
      acceptedTermsVersion: '0.9'
    }).allowed, false
  );
});

test('Invitacion valida solo con apertura autorizada', () => {
  assert.deepEqual(
    checkBetaInvite(valid()),
    { allowed: true, reason: 'ELIGIBLE' }
  );
});

test('Fallo seguro ante datos incompletos', () => {
  assert.equal(
    checkBetaInvite({
      ...valid(),
      invite: null
    }).allowed, false
  );
});
