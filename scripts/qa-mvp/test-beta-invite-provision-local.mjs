import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { prepareBetaInvitation } from './beta-invite-issuer.mjs';
import { prepareInvitationProvision } from './beta-invite-provision-local.mjs';

test('Prepara SQL sin revelar el token', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'rooms-provision-'));
  try {
    const invitation = prepareBetaInvitation({
      email: 'qa@example.invalid'
    });
    const source = join(dir, 'qa.json');

    await writeFile(source, JSON.stringify({
      token: invitation.token,
      record: invitation.record,
      status: 'LOCAL_ONLY_NOT_REGISTERED'
    }), { mode: 0o600 });

    const result = await prepareInvitationProvision(source);
    const sql = await readFile(result.output, 'utf8');

    assert.match(sql, /rooms_private\.beta_invitations/);
    assert.match(sql, /decode\('[a-f0-9]{64}', 'hex'\)/);
    assert.ok(!sql.includes(invitation.token));
    assert.match(sql, /qa@example\.invalid/);
    assert.match(sql, /NO EJECUTAR SIN AUTORIZACION/);

    const info = await stat(result.output);
    assert.equal(info.mode & 0o777, 0o600);

    await assert.rejects(
      prepareInvitationProvision(source),
      { code: 'EEXIST' }
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('Rechaza un hash manipulado', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'rooms-provision-'));
  try {
    const invitation = prepareBetaInvitation({
      email: 'qa@example.invalid'
    });
    invitation.record.token_digest_hex = '0'.repeat(64);

    const source = join(dir, 'invalid.json');
    await writeFile(source, JSON.stringify({
      token: invitation.token,
      record: invitation.record,
      status: 'LOCAL_ONLY_NOT_REGISTERED'
    }), { mode: 0o600 });

    await assert.rejects(
      prepareInvitationProvision(source),
      /hash no corresponde/
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
