import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(
  'assets/js/supabase-app.js',
  'utf8'
);

console.log('\n=== ROOMS DNA V2 STATE ===');

assert(
  /roomsDna:\s*null/.test(app),
  'Falta estado inicial V2'
);
console.log('OK  Estado inicial');

const session = app.slice(
  app.indexOf('async function startSession('),
  app.indexOf('function endSession()')
);

assert(
  session.includes("db.from('rooms_dna')"),
  'La sesion no consulta rooms_dna'
);

assert(
  session.includes('.maybeSingle()'),
  'Falta lectura opcional'
);

assert(
  session.includes('state.roomsDna ='),
  'La sesion no actualiza el estado V2'
);

assert(
  session.includes('roomsDnaError'),
  'Falta control de error de lectura'
);

console.log('OK  Carga V2 durante la sesion');

const logout = app.slice(
  app.indexOf('function endSession()'),
  app.indexOf('function endSession()') + 2400
);

assert(
  /state\.roomsDna\s*=\s*null/.test(logout),
  'Logout no limpia DNA V2'
);

console.log('OK  Limpieza al cerrar sesion');

const onboarding = app.slice(
  app.indexOf('async function saveRoomsDnaOnboarding()'),
  app.indexOf('window.saveRoomsDnaOnboarding =')
);

assert(
  onboarding.includes(".from('rooms_dna')"),
  'Onboarding no guarda DNA V2'
);

assert(
  onboarding.includes(
    'state.roomsDna = roomsDnaResult.data'
  ),
  'Onboarding no sincroniza el estado'
);

console.log('OK  Sincronizacion tras onboarding');

assert(
  app.includes('state.matchPreferences ='),
  'Compatibilidad temporal V1 eliminada'
);

console.log('OK  Compatibilidad temporal conservada');
console.log('\nROOMS DNA V2 STATE OK');
