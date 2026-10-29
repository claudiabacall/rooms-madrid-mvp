import { randomBytes, createHash } from 'node:crypto';

export function prepareBetaInvitation({
  email,
  ttlHours = 72,
  now = new Date()
}) {
  if (typeof email !== 'string') {
    throw new Error('Correo obligatorio');
  }

  const normalizedEmail = email.trim().toLowerCase();

  if (
    normalizedEmail.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
  ) {
    throw new Error('Correo no valido');
  }

  if (
    !Number.isInteger(ttlHours) ||
    ttlHours < 1 ||
    ttlHours > 168
  ) {
    throw new Error('Caducidad no valida');
  }

  const createdAt = new Date(now);

  if (Number.isNaN(createdAt.getTime())) {
    throw new Error('Fecha no valida');
  }

  const token = randomBytes(32).toString('base64url');

  const tokenDigest = createHash('sha256')
    .update(token, 'utf8')
    .digest('hex');

  const expiresAt = new Date(
    createdAt.getTime() + ttlHours * 3600000
  );

  return {
    // Secreto: entregar una sola vez por canal seguro.
    token,

    // Datos preparados para insercion administrativa.
    record: {
      email_normalized: normalizedEmail,
      token_digest_hex: tokenDigest,
      created_at: createdAt.toISOString(),
      expires_at: expiresAt.toISOString()
    }
  };
}
