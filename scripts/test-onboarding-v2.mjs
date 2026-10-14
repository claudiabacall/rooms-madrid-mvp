import fs from 'node:fs';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';

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

const supabase =
  fs.readFileSync(
    'assets/js/supabase-app.js',
    'utf8'
  );


const profileEditorSource =
  fs.readFileSync(
    'assets/js/features/profile-editor.js',
    'utf8'
  );

const css =
  fs.readFileSync(
    'assets/css/feed.css',
    'utf8'
  );

function assert(
  condition,
  message
) {
  if (!condition) {
    throw new Error(message);
  }
}

function ok(message) {
  console.log(
    `OK  ${message}`
  );
}

console.log(
  '\n=== ONBOARDING V2 · ESTRUCTURA ==='
);

const dom =
  new JSDOM(html);

const {
  document
} = dom.window;

const steps =
  [
    ...document.querySelectorAll(
      '#onboarding .onboarding-step'
    )
  ];

assert(
  steps.length === 8,
  `Esperaba 8 pasos y hay ${steps.length}`
);

ok(
  'El onboarding visible tiene 8 pasos'
);

for (
  let index = 1;
  index <= 8;
  index += 1
) {
  assert(
    document.querySelector(
      `#onboardingStep${index}`
    ),
    `Falta onboardingStep${index}`
  );
}

ok(
  'Existen onboardingStep1 → onboardingStep8'
);

const step6 =
  document.querySelector(
    '#onboardingStep6'
  );

const step7 =
  document.querySelector(
    '#onboardingStep7'
  );

const step8 =
  document.querySelector(
    '#onboardingStep8'
  );

assert(
  step6 &&
  step7 &&
  step8,
  'Faltan PROFILE, REVEAL o INTENT'
);

assert(
  step6.querySelector(
    '#profileName'
  ),
  'PROFILE no tiene nombre'
);

assert(
  step6.querySelector(
    '#profileBio'
  ),
  'PROFILE no tiene bio'
);

const photoInput =
  step6.querySelector(
    '#profilePhotoInput'
  );

assert(
  photoInput,
  'PROFILE no tiene selector de foto'
);

assert(
  photoInput.getAttribute(
    'accept'
  ) ===
    'image/jpeg,image/png,image/webp',
  'PROFILE permite tipos distintos a los soportados'
);

ok(
  'PROFILE tiene nombre, bio y foto compatible'
);

assert(
  html.indexOf(
    'id="onboardingStep7"'
  ) <
  html.indexOf(
    'id="onboardingStep8"'
  ),
  'INTENT aparece antes del REVEAL'
);

assert(
  /dna-reveal/.test(
    step7.innerHTML
  ),
  'Paso 7 no contiene el reveal'
);

assert(
  /data-onboarding-intent/.test(
    step8.innerHTML
  ),
  'Paso 8 no contiene intención'
);

ok(
  'REVEAL ocurre antes de INTENT'
);


console.log(
  '\n=== ONBOARDING V2 · FRONTEND ==='
);

assert(
  app.includes(
    "if(onboardingStep===6)"
  ),
  'No existe validación del PROFILE'
);

assert(
  app.includes(
    "document.querySelector('#profileName')?.value.trim()"
  ),
  'PROFILE no exige nombre'
);

ok(
  'El nombre es obligatorio'
);

assert(
  app.includes(
    "document.querySelector('#profilePhotoInput')"
  ),
  'Frontend no consume profilePhotoInput'
);

assert(
  app.includes(
    'new FileReader()'
  ),
  'No existe preview de foto'
);

assert(
  app.includes(
    'reader.readAsDataURL(file)'
  ),
  'La foto no genera preview'
);

assert(
  app.includes(
    "?.files?.[0]||null"
  ),
  'La foto no entra en el snapshot'
);

ok(
  'La foto genera preview y entra en el snapshot'
);

assert(
  app.includes(
    'function getRoomsDnaOnboardingSnapshot()'
  ),
  'No existe snapshot del onboarding'
);

assert(
  app.includes(
    'window.getRoomsDnaOnboardingSnapshot='
  ),
  'Snapshot no está expuesto a persistencia'
);

ok(
  'Snapshot V2 disponible para persistencia'
);


console.log(
  '\n=== ONBOARDING V2 · DNA ==='
);

const context = {
  window: {},
  globalThis: {}
};

context.globalThis =
  context.window;

vm.createContext(
  context
);

for (
  const file of [
    'assets/js/rooms-dna-v2-config.js',
    'assets/js/rooms-dna-engine.js',
    'assets/js/rooms-dna-archetypes.js'
  ]
) {
  vm.runInContext(
    fs.readFileSync(
      file,
      'utf8'
    ),
    context
  );
}

const config =
  context.window
    .ROOMS_DNA_V2;

const engine =
  context.window
    .ROOMS_DNA_ENGINE;

const archetypes =
  context.window
    .ROOMS_DNA_ARCHETYPES;

assert(
  config &&
  engine &&
  archetypes,
  'No se cargan módulos DNA V2'
);

assert(
  config.interactions.length === 10,
  `Esperaba 10 interacciones y hay ${config.interactions.length}`
);

ok(
  'DNA V2 tiene 10 interacciones'
);

const answers = {
  friday_night:
    'reset',

  day_off:
    'go_with_flow',

  plans_change:
    'improvise',

  friends_tuesday:
    'love_it',

  dishes_overnight:
    'whatever',

  partner_three_nights:
    'all_good',

  shared_groceries:
    'share_everything',

  home_priorities: {
    natural_light:
      'like',

    terrace:
      'neutral',

    exterior:
      'like',

    private_bathroom:
      'neutral',

    transport:
      'need'
  },

  world_interests: [
    'travel',
    'music',
    'nature'
  ],

  self_description: [
    'spontaneous',
    'easygoing',
    'calm'
  ]
};

assert(
  Object.keys(
    answers
  ).length === 10,
  'Fixture no contiene 10 respuestas'
);

const dna =
  engine.calculate(
    answers,
    config
  );

const classification =
  archetypes.classify(
    dna
  );

assert(
  classification
    ?.primary?.id ===
    'free_spirit',
  `Esperaba free_spirit y salió ${classification?.primary?.id}`
);

ok(
  '10 respuestas producen un reveal coherente'
);


console.log(
  '\n=== ONBOARDING V2 · PERSISTENCIA ==='
);

const onboardingStart =
  supabase.indexOf(
    'async function persistRoomsDnaOnboarding()'
  );

const onboardingEnd =
  supabase.indexOf(
    'window.saveRoomsDnaOnboarding =',
    onboardingStart
  );

assert(
  onboardingStart >= 0 &&
  onboardingEnd > onboardingStart,
  'Existe funcion de guardado del onboarding'
);

const onboardingSave =
  supabase.slice(
    onboardingStart,
    onboardingEnd
  );

const provisionalIndex =
  onboardingSave.indexOf(
    'onboarding_completed: false'
  );

const roomsDnaIndex =
  onboardingSave.indexOf(
    ".from('rooms_dna')"
  );

const intentsIndex =
  onboardingSave.indexOf(
    ".from('user_intents')"
  );

const avatarCallIndex =
  onboardingSave.indexOf(
    'await uploadProfilePhoto('
  );

const finalIndex =
  onboardingSave.indexOf(
    'onboarding_completed: true'
  );

assert(
  provisionalIndex >= 0,
  'No existe perfil provisional'
);

assert(
  roomsDnaIndex >= 0,
  'No se persiste rooms_dna'
);

assert(
  intentsIndex >= 0,
  'No se persisten intenciones'
);

assert(
  avatarCallIndex >= 0,
  'Onboarding no llama al uploader de avatar'
);

assert(
  finalIndex >= 0,
  'No existe finalización del onboarding'
);

assert(
  provisionalIndex <
    roomsDnaIndex,
  'rooms_dna se guarda antes del perfil provisional'
);

assert(
  roomsDnaIndex <
    avatarCallIndex,
  'Avatar se procesa antes que rooms_dna'
);

assert(
  avatarCallIndex <
    finalIndex,
  'onboarding_completed=true ocurre antes de la foto'
);

ok(
  'Persistencia respeta el orden seguro'
);

assert(
  profileEditorSource.includes(
    ".from('avatars')"
  ),
  'Uploader no usa bucket avatars'
);

assert(
  profileEditorSource.includes(
    '.upload(path, file'
  ),
  'Avatar no se sube a Storage'
);

assert(
  profileEditorSource.includes(
    '.getPublicUrl(path)'
  ),
  'Avatar no obtiene URL pública'
);

assert(
  profileEditorSource.includes(
    '.update({ avatar_url: avatarUrl })'
  ),
  'avatar_url no se guarda en profiles'
);

ok(
  'Avatar usa Storage y persiste avatar_url'
);


console.log(
  '\n=== ONBOARDING V2 · RESPONSIVE ==='
);

assert(
  css.includes(
    '#onboarding .profile-basics'
  ),
  'No existen estilos de PROFILE'
);

assert(
  css.includes(
    '@media (max-width:767px)'
  ),
  'No existe breakpoint mobile'
);

const mobileProfileIndex =
  css.lastIndexOf(
    '#onboarding .profile-basics'
  );

const mobileBlockIndex =
  css.lastIndexOf(
    '@media (max-width:767px)'
  );

assert(
  mobileProfileIndex >
    mobileBlockIndex,
  'PROFILE no tiene regla explícita dentro del breakpoint mobile'
);

assert(
  css.includes(
    'grid-template-columns:1fr;'
  ),
  'PROFILE móvil no colapsa a una columna'
);

ok(
  'PROFILE tiene adaptación mobile explícita'
);

console.log(
  '\nROOMS ONBOARDING V2 OK'
);
