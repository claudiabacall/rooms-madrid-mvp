import { validate as isUuid } from './account-deletion-uuid.mjs';
import { STORAGE_BUCKETS } from './account-deletion-guards.mjs';

const PAGE_SIZE = 100;

export async function inventoryUserStorage(storage, userId) {
  if (!isUuid(userId)) {
    throw new Error('UUID de usuario no valido');
  }

  const inventory = {};

  for (const bucket of STORAGE_BUCKETS) {
    const files = [];
    const visited = new Set();

    async function walk(prefix) {
      if (visited.has(prefix)) return;
      visited.add(prefix);

      let offset = 0;

      while (true) {
        const { data, error } = await storage
          .from(bucket)
          .list(prefix, {
            limit: PAGE_SIZE,
            offset,
            sortBy: {
              column: 'name',
              order: 'asc'
            }
          });

        if (error) {
          throw new Error(
            `Error listando ${bucket}/${prefix}: ${error.message}`
          );
        }

        const entries = data || [];

        for (const entry of entries) {
          if (
            typeof entry.name !== 'string' ||
            !entry.name ||
            entry.name === '.' ||
            entry.name === '..' ||
            entry.name.includes('/') ||
            entry.name.includes('\\')
          ) {
            throw new Error('Nombre de archivo o carpeta no seguro');
          }

          const path = `${prefix}/${entry.name}`;

          if (!path.startsWith(`${userId}/`)) {
            throw new Error('Ruta fuera del usuario');
          }

          const isFolder =
            entry.id == null &&
            entry.metadata == null;

          if (isFolder) {
            await walk(path);
          } else {
            files.push(path);
          }
        }

        if (entries.length < PAGE_SIZE) break;
        offset += entries.length;
      }
    }

    await walk(userId);

    inventory[bucket] = files.sort();
  }

  return inventory;
}
