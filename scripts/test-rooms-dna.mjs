import fs from 'node:fs';
import vm from 'node:vm';

const html =
  fs.readFileSync(
    'index.html',
    'utf8'
  );

const app =
  fs.readFileSync(
    'assets/js/app.js',
    'utf8'
  );

const legacyConfigSource =
  fs.readFileSync(
    'assets/js/rooms-dna-config.js',
    'utf8'
  );

const v2ConfigSource =
  fs.readFileSync(
    'assets/js/rooms-dna-v2-config.js',
    'utf8'
  );

const context = {
  window: {},
  globalThis: {}
};

context.globalThis =
  context.window;

vm.createContext(context);

vm.runInContext(
  legacyConfigSource,
  context
);

vm.runInContext(
  v2ConfigSource,
  context
);

const legacy =
  context.window.ROOMS_DNA;

const v2 =
  context.window.ROOMS_DNA_V2;

function assert(
  condition,
  message
){
  if(!condition){
    throw new Error(message);
  }

  console.log(
    `OK  ${message}`
  );
}

console.log('');
console.log(
  '=== ROOMS DNA: V2 ONBOARDING ==='
);

assert(
  Boolean(v2),
  'Existe configuración ROOMS DNA V2'
);

assert(
  v2.version===2,
  'ROOMS DNA onboarding usa versión 2'
);

assert(
  (
    v2.interactions || []
  ).length===10,
  'V2 define 10 interacciones'
);

console.log('');
console.log(
  '=== ROOMS DNA: FLUJO ==='
);

const steps =
  (
    html.match(
      /class="onboarding-step/g
    ) || []
  ).length;

assert(
  steps===8,
  'El onboarding visible tiene 8 pasos'
);

const step1 =
  html.match(
    /id="onboardingStep1"[\s\S]*?(?=id="onboardingStep2")/
  )?.[0] || '';

const step7 =
  html.match(
    /id="onboardingStep7"[\s\S]*?(?=id="onboardingStep8")/
  )?.[0] || '';

const step8 =
  html.match(
    /id="onboardingStep8"[\s\S]*?(?=<\/div>\s*<\/div>\s*<footer)/
  )?.[0] || '';

assert(
  !step1.includes(
    'data-onboarding-intent'
  ),
  'La intención no gobierna el inicio'
);

assert(
  step7.includes(
    'YOUR ROOMS DNA'
  ),
  'El reveal ocurre antes de la intención'
);

assert(
  step8.includes(
    'data-onboarding-intent'
  ),
  'La intención está después del reveal'
);

assert(
  !html.includes(
    'id="dnaImportance"'
  ),
  'Importance V1 ya no está en onboarding'
);

assert(
  !html.includes(
    'id="dnaDealbreakers"'
  ),
  'Dealbreakers V1 ya no están en onboarding'
);

console.log('');
console.log(
  '=== ROOMS DNA: ESTADO FRONTEND ==='
);

assert(
  app.includes(
    'roomsDnaV2Answers'
  ),
  'Frontend usa estado canónico V2'
);

assert(
  app.includes(
    'thisOrThatComplete'
  ),
  'VIBE valida respuestas V2'
);

assert(
  app.includes(
    'livingComplete'
  ),
  'LIVING valida respuestas V2'
);

assert(
  app.includes(
    'homePrioritiesComplete'
  ),
  'HOME valida respuestas V2'
);

assert(
  app.includes(
    'worldComplete'
  ),
  'WORLD valida respuestas V2'
);

assert(
  app.includes(
    'getRoomsDnaPersistenceSnapshot'
  ),
  'Frontend genera snapshot persistible V2'
);

assert(
  app.includes(
    'buildLegacyMatchPreferencesFromV2'
  ),
  'Existe adapter temporal V2 a match_preferences'
);

console.log('');
console.log(
  '=== ROOMS DNA: COMPATIBILIDAD ==='
);

assert(
  Boolean(legacy),
  'Configuración V1 sigue disponible para editores legacy'
);

assert(
  legacy.version===1,
  'V1 permanece aislado como compatibilidad'
);

const supabaseApp =
  fs.readFileSync(
    'assets/js/supabase-app.js',
    'utf8'
  );

assert(
  supabaseApp.includes(
    ".from('rooms_dna')"
  ),
  'Persistencia V2 usa rooms_dna'
);

assert(
  supabaseApp.includes(
    ".from('match_preferences')"
  ),
  'Editores legacy mantienen match_preferences'
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
console.log(
  'ROOMS DNA ARCHITECTURE OK'
);
