import { randomUUID } from 'node:crypto';
import {
  mkdir,
  readFile,
  writeFile
} from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  prepareBetaInvitation
} from './beta-invite-issuer.mjs';

export async function issueLocalBetaInvitation({
  email,
  directory = join(homedir(), '.rooms-beta-invitations'),
  now = new Date()
}) {
  const invitation = prepareBetaInvitation({
    email,
    now
  });

  await mkdir(directory, {
    recursive: true,
    mode: 0o700
  });

  const id = randomUUID();
  const file = join(directory, `${id}.json`);

  const contents = {
    id,
    token: invitation.token,
    record: invitation.record,
    status: 'LOCAL_ONLY_NOT_REGISTERED'
  };

  await writeFile(
    file,
    JSON.stringify(contents, null, 2) + '\n',
    {
      encoding: 'utf8',
      flag: 'wx',
      mode: 0o600
    }
  );

  return {
    id,
    file,
    email: invitation.record.email_normalized,
    expiresAt: invitation.record.expires_at,
    status: contents.status
  };
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) ===
    fileURLToPath(new URL(`file://${process.argv[1]}`).href)
) {
  const email = process.argv[2];

  if (!email) {
    console.error('Uso: node beta-invite-admin-local.mjs correo');
    process.exitCode = 1;
  } else {
    try {
      const result = await issueLocalBetaInvitation({ email });

      console.log('OK Invitacion preparada localmente');
      console.log('Correo:', result.email);
      console.log('Archivo privado:', result.file);
      console.log('Caducidad:', result.expiresAt);
      console.log('Estado:', result.status);
      console.log('NO registrada ni enviada');
    } catch (error) {
      console.error('ERROR:', error.message);
      process.exitCode = 1;
    }
  }
}
