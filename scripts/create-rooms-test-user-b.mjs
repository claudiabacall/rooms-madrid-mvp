import { readFile, writeFile, chmod, access } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';

try { await access('.env.rooms-test-b.local'); console.error('Ya existe .env.rooms-test-b.local: no crear otra cuenta.'); process.exit(1); } catch (e) { if (e.code !== 'ENOENT') throw e; }
const adminKey = process.env.ROOMS_TEST_ADMIN_KEY;
if (!adminKey) {
  console.error('FALTA ROOMS_TEST_ADMIN_KEY. Utiliza una secret/service_role key SOLO en terminal local.');
  process.exit(1);
}
const config = await readFile('assets/js/supabase-config.js', 'utf8');
const url = config.match(/url:\s*['"](https:\/\/[^'"]+)['"]/)?.[1];
if (!url) throw Error('No se detecta la URL de Supabase');
const suffix = randomBytes(7).toString('hex');
const email = `rooms-qa-${suffix}@example.com`;
const password = randomBytes(30).toString('base64url') + 'Aa1!';
const response = await fetch(`${url}/auth/v1/admin/users`, {
  method: 'POST',
  headers: { apikey: adminKey, Authorization: `Bearer ${adminKey}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { name: 'ROOMS QA', alias: 'ROOMS QA', rooms_test_account: true } })
});
const result = await response.json();
if (!response.ok || !result.id) {
  console.error('No se ha podido crear el usuario:', response.status, result.msg || result.message || result.error || 'error desconocido');
  process.exit(1);
}
const path = '.env.rooms-test-b.local';
await writeFile(path, `ROOMS_TEST_EMAIL=${email}\nROOMS_TEST_PASSWORD=${password}\nROOMS_TEST_USER_ID=${result.id}\n`, { mode: 0o600, flag: 'wx' });
await chmod(path, 0o600);
console.log('OK Cuenta QA creada y confirmada en Supabase');
console.log('ID:', result.id);
console.log('Credenciales guardadas SOLO en .env.rooms-test-b.local (no compartir)');
console.log('La clave administrativa NO se ha guardado.');
