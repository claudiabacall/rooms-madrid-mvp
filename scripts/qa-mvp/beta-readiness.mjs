import { readFileSync, existsSync } from 'node:fs';

function read(path) {
  return existsSync(path) ? readFileSync(path, 'utf8') : '';
}

const app = read('assets/js/supabase-app.js');

const checks = [
  {
    name: 'Base tecnica y recorrido integral',
    status: existsSync('scripts/qa-mvp/test-m3-journey.mjs')
      ? 'IMPLEMENTADO'
      : 'REVISAR',
    detail: 'M3 superado previamente; repetir regresion antes de beta'
  },
  {
    name: 'Solicitudes de baja',
    status: existsSync(
      'supabase/migrations/20261020_account_deletion_requests.sql'
    ) ? 'IMPLEMENTADO' : 'BLOQUEADO',
    detail: 'Solicitud y RLS; no equivale a eliminacion efectiva'
  },
  {
    name: 'Registro protegido en interfaz',
    status: /ROOMS_LEGAL_REGISTRATION_READY\s*=\s*false/.test(app)
      ? 'IMPLEMENTADO'
      : 'REVISAR',
    detail: 'Bloqueo de interfaz; verificar tambien Supabase Auth'
  },
  {
    name: 'Politica de privacidad definitiva',
    status: 'BLOQUEADO',
    detail: 'Borrador pendiente de completar y validar'
  },
  {
    name: 'Condiciones de uso definitivas',
    status: 'BLOQUEADO',
    detail: 'Borrador pendiente de completar y validar'
  },
  {
    name: 'Aceptacion legal verificable',
    status: 'BLOQUEADO',
    detail: 'Falta persistencia segura, version y fecha'
  },
  {
    name: 'Eliminacion real de cuentas',
    status: 'BLOQUEADO',
    detail: 'Falta prueba integral con cuenta desechable y registro de cierre'
  },
  {
    name: 'Restricciones de produccion',
    status: 'PENDIENTE DE VALIDAR',
    detail: 'WAF, limites, secretos, Auth y configuracion de despliegue'
  },
  {
    name: 'Limpieza para pruebas de amigos',
    status: 'RESERVADO PARA M5',
    detail: 'Respaldar antes de limpiar; no borrar datos ahora'
  }
];

console.log('\n=== ROOMS / BETA READINESS ===\n');

for (const check of checks) {
  console.log(`[${check.status}] ${check.name}`);
  console.log(`  ${check.detail}`);
}

const blockers = checks.filter(
  item => item.status === 'BLOQUEADO'
);

console.log('\n=== DECISION ===');
console.log(
  blockers.length
    ? `NO GO - ${blockers.length} requisitos bloqueantes`
    : 'Sin bloqueantes identificados por este control'
);
console.log(
  'Este informe no verifica configuraciones remotas ni constituye una auditoria legal.'
);
console.log('No se ha conectado con Supabase ni modificado ningun dato.');
