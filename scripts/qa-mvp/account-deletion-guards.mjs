import { readFileSync } from 'node:fs';
import { validate as isUuid } from './account-deletion-uuid.mjs';

function readProtectedId(file) {
  try {
    const source = readFileSync(file, 'utf8');
    return source.match(/^ROOMS_TEST_USER_ID=(.+)$/m)?.[1]?.trim();
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

export function assertDisposableAccount(user, targetId) {
  if (!isUuid(targetId)) {
    throw new Error('Identificador UUID no valido');
  }

  const protectedIds = [
    readProtectedId('.env.rooms-test.local'),
    readProtectedId('.env.rooms-test-b.local')
  ].filter(Boolean);

  if (protectedIds.includes(targetId)) {
    throw new Error('Cuenta QA permanente protegida');
  }

  if (!user || user.id !== targetId) {
    throw new Error('Identidad de usuario no confirmada');
  }

  if (user.user_metadata?.rooms_deletion_test !== true) {
    throw new Error('La cuenta no esta marcada para pruebas de eliminacion');
  }

  if (!/^rooms-delete-qa-[a-z0-9]+@example\.com$/.test(user.email || '')) {
    throw new Error('Email de cuenta desechable no valido');
  }

  return true;
}

export const STORAGE_BUCKETS = Object.freeze([
  'avatars',
  'listing-images',
  'community-images',
  'community-post-media'
]);
