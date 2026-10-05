import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync('index.html', 'utf8');
const app = fs.readFileSync('assets/js/app.js', 'utf8');
const configSource =
  fs.readFileSync('assets/js/rooms-dna-config.js', 'utf8');

const context = { window: {} };
vm.createContext(context);
vm.runInContext(configSource, context);

const dna = context.window.ROOMS_DNA;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }

  console.log(`OK  ${message}`);
}

console.log('');
console.log('=== ROOMS DNA: CONFIG ===');

assert(Boolean(dna), 'Existe configuración ROOMS DNA');
assert(dna.version === 1, 'ROOMS DNA usa versión 1');

const expectedStorage = [
  'living_self',
  'living_importance',
  'dealbreakers',
  'home_preferences',
  'neighborhood_preferences',
  'interests',
  'traits'
];

for (const field of expectedStorage) {
  assert(
    Object.values(dna.storage).includes(field),
    `Contrato incluye ${field}`
  );
}

console.log('');
console.log('=== ROOMS DNA: CONTENIDO ===');

assert(dna.thisOrThat.length === 4, 'Hay 4 preguntas This or That');
assert(dna.scenarios.length === 5, 'Hay 5 escenarios de convivencia');
assert(dna.dealbreakers.length === 4, 'Hay 4 dealbreakers');
assert(dna.homePreferences.length === 5, 'Hay 5 preferencias de hogar');
assert(dna.dynamicImportance.length > 0, 'Hay preguntas de importancia');
assert(dna.interests.length > 0, 'Hay intereses');
assert(dna.traits.length > 0, 'Hay rasgos');

console.log('');
console.log('=== ROOMS DNA: FLUJO ===');

const step1 =
  html.match(
    /id="onboardingStep1"[\s\S]*?(?=id="onboardingStep2")/
  )?.[0] || '';

const step9 =
  html.match(
    /id="onboardingStep9"[\s\S]*?(?=id="onboardingStep10")/
  )?.[0] || '';

const step10 =
  html.match(
    /id="onboardingStep10"[\s\S]*?(?=<\/div>\s*<\/div>\s*<footer)/
  )?.[0] || '';

assert(
  !step1.includes('data-onboarding-intent'),
  'La intención no gobierna el inicio'
);

assert(
  step9.includes('YOUR ROOMS DNA'),
  'El reveal ocurre antes de la intención'
);

assert(
  step10.includes('data-onboarding-intent'),
  'La intención está después del reveal'
);

assert(
  (html.match(/class="onboarding-step/g) || []).length === 10,
  'El onboarding universal tiene 10 pasos'
);

console.log('');
console.log('=== ROOMS DNA: ESTADO FRONTEND ===');

assert(
  app.includes('dnaState'),
  'Existe estado específico de ROOMS DNA'
);

assert(
  app.includes('thisOrThat'),
  'Frontend recoge This or That'
);

assert(
  app.includes('scenarios'),
  'Frontend recoge escenarios'
);

assert(
  app.includes('importance'),
  'Frontend recoge importancia'
);

assert(
  app.includes('dealbreakers'),
  'Frontend recoge dealbreakers'
);

assert(
  app.includes('homePreferences'),
  'Frontend recoge preferencias de hogar'
);

assert(
  app.includes('intents'),
  'Frontend separa las intenciones'
);

console.log('');
console.log('ROOMS DNA ARCHITECTURE OK');


console.log('');
console.log('=== ROOMS DNA: EDITORES CANÓNICOS ===');

const supabaseApp =
  fs.readFileSync(
    'assets/js/supabase-app.js',
    'utf8'
  );

assert(
  supabaseApp.includes(
    ".from('match_preferences')"
  ),
  'Editores usan match_preferences'
);

assert(
  !supabaseApp.includes(
    'state.preferences?.answers?.living'
  ),
  'Convivencia ya no usa answers.living'
);

assert(
  !supabaseApp.includes(
    'state.preferences.answers.living'
  ),
  'No quedan lecturas directas de answers.living'
);

assert(
  !supabaseApp.includes(
    'answers.homeFeatures'
  ),
  'Preferencias de hogar ya no usan homeFeatures'
);

assert(
  supabaseApp.includes(
    'data-search-intent'
  ),
  'Editor de búsqueda usa intenciones reales'
);

assert(
  supabaseApp.includes(
    'seekingFromIntents'
  ),
  'profiles.seeking es espejo de user_intents'
);

console.log('');
console.log('ROOMS DNA EDITORS OK');
