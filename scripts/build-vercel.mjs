import {
  existsSync, mkdirSync, readdirSync, cpSync, rmSync
} from 'node:fs';
import { join, dirname, extname, relative } from 'node:path';

const allowed = new Set([
  '.html', '.js', '.mjs', '.css', '.json',
  '.png', '.jpg', '.jpeg', '.webp',
  '.gif', '.svg', '.ico', '.avif',
  '.woff', '.woff2', '.ttf', '.otf',
  '.eot', '.wasm', '.mp4', '.webm'
]);

if (!existsSync('index.html') || !existsSync('assets')) {
  throw new Error('Faltan index.html o assets');
}

rmSync('dist', { recursive: true, force: true });
mkdirSync('dist', { recursive: true });
cpSync('index.html', 'dist/index.html');

let total = 0;

function copyAssets(folder) {
  for (const entry of readdirSync(folder, {
    withFileTypes: true
  })) {
    const source = join(folder, entry.name);

    if (entry.name.startsWith('.')) continue;
    if (entry.isSymbolicLink()) {
      throw new Error('Symlink no permitido: ' + source);
    }

    if (entry.isDirectory()) {
      copyAssets(source);
      continue;
    }

    if (!entry.isFile() ||
        !allowed.has(extname(entry.name).toLowerCase())) {
      continue;
    }

    const dest = join('dist', relative('.', source));
    mkdirSync(dirname(dest), { recursive: true });
    cpSync(source, dest);
    total++;
  }
}

copyAssets('assets');

if (total === 0) {
  throw new Error('No se copiaron assets');
}

console.log('OK index.html');
console.log('OK assets publicados:', total);
console.log('OK Solo index.html y assets/');
