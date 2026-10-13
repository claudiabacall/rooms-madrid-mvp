import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const app = fs.readFileSync(
  'assets/js/supabase-app.js',
  'utf8'
);

const configSource = fs.readFileSync(
  'assets/js/rooms-dna-v2-config.js',
  'utf8'
);

const start = app.indexOf(
  '  function roomsDnaLivingRows(roomsDna) {'
);

const end = app.indexOf(
  '  function updateOwnProfile(',
  start
);

assert(start >= 0 && end > start);

const context = { window: {} };
context.globalThis = context.window;

vm.createContext(context);
vm.runInContext(configSource, context);

const buildRows = vm.runInContext(
  app.slice(start, end) +
  '\nroomsDnaLivingRows;',
  context
);

const version = context.window.ROOMS_DNA_V2.version;

const evidence = [{
  interactionId: 'test',
  rawValue: 0.8,
  sourceWeight: 1
}];

const fixture = {
  model_version: version,
  dimensions: {
    social_energy: {
      self: {
        score: 0.8,
        confidence: 0.8,
        evidence
      }
    },
    privacy: {
      self: {
        score: -0.7,
        confidence: 0.9,
        evidence
      }
    },
    cleanliness: {
      self: {
        score: 0.05,
        confidence: 0.7,
        evidence
      }
    },
    noise_tolerance: {
      self: {
        score: 0.9,
        confidence: 0.1,
        evidence
      }
    },
    visitor_tolerance: {
      self: {
        score: 0.9,
        confidence: 0.9,
        evidence: []
      }
    },
    communication: {
      preferred: {
        score: 0.9,
        confidence: 0.9,
        evidence
      }
    }
  }
};

const rows = buildRows(fixture);
const normalized = JSON.parse(JSON.stringify(rows));

assert.deepEqual(normalized, [
  ['Energía social', 'Muy social'],
  ['Privacidad', 'Muy compartido'],
  ['Orden y limpieza', 'Equilibrado']
]);

console.log('OK  Valores altos, bajos y equilibrados');
console.log('OK  Baja confianza excluida');
console.log('OK  Dimensiones sin evidencia excluidas');
console.log('OK  Preferencias no confundidas con personalidad');

assert.deepEqual(
  JSON.parse(JSON.stringify(buildRows(null))),
  []
);

assert.deepEqual(
  JSON.parse(JSON.stringify(buildRows({
    ...fixture,
    model_version: 1
  }))),
  []
);

console.log('OK  Sin DNA y versiones incompatibles');

assert(
  app.includes('roomsDnaLivingRows(\n          state.roomsDna\n        )'),
  'Vista principal no utiliza DNA V2'
);

const ownProfile = fs.readFileSync(
  'assets/js/features/own-profile.js',
  'utf8'
);

assert(
  ownProfile.includes('state.roomsDna'),
  'Vista pública no utiliza DNA V2'
);

console.log('OK  Ambas vistas conectadas al DNA V2');
console.log('\nROOMS DNA PROFILE V2 OK');
