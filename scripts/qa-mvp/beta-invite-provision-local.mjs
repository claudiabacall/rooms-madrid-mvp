import { createHash } from 'node:crypto';
import { readFile, writeFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

function sqlString(value) {
  return "'" + value.replaceAll("'", "''") + "'";
}

export async function prepareInvitationProvision(file, now = new Date()) {
  if (!file || !Number.isFinite(now.getTime())) {
    throw new Error('Ruta o fecha invalida');
  }

  const source = resolve(file);
  const info = await stat(source);

  if ((info.mode & 0o077) !== 0) {
    throw new Error('Archivo de invitacion sin permisos privados');
  }

  const saved = JSON.parse(await readFile(source, 'utf8'));
  const { token, record } = saved;

  if (saved.status !== 'LOCAL_ONLY_NOT_REGISTERED') {
    throw new Error('Estado de invitacion no permitido');
  }

  if (typeof token !== 'string' ||
      !/^[A-Za-z0-9_-]{43}$/.test(token)) {
    throw new Error('Token invalido');
  }

  if (typeof record?.email_normalized !== 'string' ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(record.email_normalized) ||
      record.email_normalized !== record.email_normalized.toLowerCase()) {
    throw new Error('Correo invalido');
  }

  const digest = createHash('sha256')
    .update(token, 'utf8')
    .digest('hex');

  if (record.token_digest_hex !== digest) {
    throw new Error('El hash no corresponde al token');
  }

  const created = new Date(record.created_at);
  const expires = new Date(record.expires_at);

  if (!Number.isFinite(created.getTime()) ||
      !Number.isFinite(expires.getTime()) ||
      expires <= created ||
      expires <= now) {
    throw new Error('Invitacion caducada o fechas invalidas');
  }

  const output = source.replace(/\.json$/, '') + '.provision-DRAFT.sql';

  if (output === source) {
    throw new Error('Archivo de origen no valido');
  }

  const sql = [
    '-- ROOMS: PROVISION PRIVADA. NO EJECUTAR SIN AUTORIZACION.',
    '-- Contiene solo hash; no incluye token original.',
    'BEGIN;',
    'INSERT INTO rooms_private.beta_invitations',
    '  (email_normalized, token_digest, created_at, expires_at)',
    'VALUES (',
    `  ${sqlString(record.email_normalized)},`,
    `  decode('${digest}', 'hex'),`,
    `  ${sqlString(created.toISOString())}::timestamptz,`,
    `  ${sqlString(expires.toISOString())}::timestamptz`,
    ');',
    'COMMIT;',
    ''
  ].join('\n');

  await writeFile(output, sql, {
    encoding: 'utf8',
    flag: 'wx',
    mode: 0o600
  });

  return { output, email: record.email_normalized };
}

if (process.argv[1] &&
    fileURLToPath(import.meta.url) ===
      fileURLToPath(new URL(`file://${process.argv[1]}`).href)) {
  try {
    const result = await prepareInvitationProvision(process.argv[2]);
    console.log('OK SQL privado preparado:', result.output);
    console.log('Correo:', result.email);
    console.log('NO ejecutado en Supabase');
  } catch (error) {
    console.error('ERROR:', error.message);
    process.exitCode = 1;
  }
}
