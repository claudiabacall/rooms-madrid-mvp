import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  mkdtemp,
  readFile,
  stat,
  rm
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  issueLocalBetaInvitation
} from './beta-invite-admin-local.mjs';

test('Emite una invitacion sin exponer el token', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'rooms-invite-'));

  try {
    const result = await issueLocalBetaInvitation({
      email: '  TEST@example.invalid  ',
      directory: dir
    });

    assert.equal(result.email, 'test@example.invalid');
    assert.equal(result.status, 'LOCAL_ONLY_NOT_REGISTERED');
    assert.equal('token' in result, false);

    const saved = JSON.parse(
      await readFile(result.file, 'utf8')
    );

    assert.match(saved.token, /^[A-Za-z0-9_-]{43}$/);
    assert.equal(saved.record.email_normalized, result.email);

    const digest = createHash('sha256')
      .update(saved.token, 'utf8')
      .digest('hex');

    assert.equal(saved.record.token_digest_hex, digest);

    const info = await stat(result.file);
    assert.equal(info.mode & 0o777, 0o600);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('Cada invitacion utiliza un token diferente', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'rooms-invite-'));

  try {
    const first = await issueLocalBetaInvitation({
      email: 'a@example.invalid',
      directory: dir
    });

    const second = await issueLocalBetaInvitation({
      email: 'a@example.invalid',
      directory: dir
    });

    const a = JSON.parse(await readFile(first.file, 'utf8'));
    const b = JSON.parse(await readFile(second.file, 'utf8'));

    assert.notEqual(a.token, b.token);
    assert.notEqual(a.record.token_digest_hex, b.record.token_digest_hex);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('Rechaza correos incorrectos', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'rooms-invite-'));

  try {
    await assert.rejects(
      issueLocalBetaInvitation({
        email: 'correo-invalido',
        directory: dir
      })
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
