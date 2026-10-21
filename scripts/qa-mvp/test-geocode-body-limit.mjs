import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';

const port = 4197;
const base = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ['server.mjs'], {
  env: { ...process.env, PORT: String(port) },
  stdio: ['ignore', 'pipe', 'pipe']
});

let stderr = '';
server.stderr.on('data', chunk => {
  stderr += chunk.toString();
});

async function waitForServer() {
  for (let i = 0; i < 50; i++) {
    if (server.exitCode !== null) {
      throw new Error(`Servidor terminado: ${stderr}`);
    }

    try {
      const response = await fetch(base + '/');
      if (response.ok) return;
    } catch {
      // El servidor puede estar iniciándose.
    }

    await new Promise(resolve => setTimeout(resolve, 100));
  }

  throw new Error(`Servidor no disponible: ${stderr}`);
}

try {
  await waitForServer();

  const oversized = await fetch(base + '/api/geocode', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address: 'x'.repeat(5000) })
  });

  assert.equal(oversized.status, 413);
  console.log('OK Local rechaza peticion superior a 4 KB');

  const invalidAddress = await fetch(base + '/api/geocode', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address: 'abc' })
  });

  assert.equal(invalidAddress.status, 400);
  console.log('OK Local conserva validacion de direcciones');

  const wrongMethod = await fetch(base + '/api/geocode');

  assert.equal(wrongMethod.status, 405);
  console.log('OK Local rechaza metodos no permitidos');

  console.log('ROOMS M4 - LIMITE LOCAL SUPERADO');
} finally {
  server.kill('SIGTERM');
}
