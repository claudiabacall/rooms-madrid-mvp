import fs from 'node:fs';
import vm from 'node:vm';

const sandbox = {};

vm.runInNewContext(
  fs.readFileSync(
    'assets/js/rooms-dna-v2-config.js',
    'utf8'
  ),
  sandbox
);

vm.runInNewContext(
  fs.readFileSync(
    'assets/js/rooms-dna-engine.js',
    'utf8'
  ),
  sandbox
);

const config =
  sandbox.ROOMS_DNA_V2;

const engine =
  sandbox.ROOMS_DNA_ENGINE;

if(!config){
  throw new Error(
    'Falta ROOMS_DNA_V2'
  );
}

if(
  !engine ||
  typeof engine.calculate !==
    'function'
){
  throw new Error(
    'Falta ROOMS_DNA_ENGINE.calculate'
  );
}

const result =
  engine.calculate({
    friday_night: 'alive',
    day_off: 'rough_plan',
    plans_change: 'tell_me_before'
  });

function approx(
  actual,
  expected,
  tolerance=0.0001
){
  if(
    Math.abs(
      actual - expected
    ) > tolerance
  ){
    throw new Error(
      `Esperaba ${expected}, recibido ${actual}`
    );
  }
}

/*
  Cada dimensión con una sola señal
  debe conservar el score bruto,
  independientemente del sourceWeight,
  porque el peso afecta a confianza
  y combinación entre evidencias.
*/

approx(
  result.dimensions
    .social_energy
    .self
    .score,
  0.75
);

approx(
  result.dimensions
    .home_activity
    .self
    .score,
  0.85
);

approx(
  result.dimensions
    .spontaneity
    .self
    .score,
  -0.775
);

approx(
  result.dimensions
    .communication
    .self
    .score,
  0.60
);

if(
  result.dimensions
    .social_energy
    .self
    .confidence <= 0
){
  throw new Error(
    'Confidence de social_energy debería ser > 0'
  );
}

if(
  result.dimensions
    .social_energy
    .self
    .evidence.length !== 1
){
  throw new Error(
    'social_energy debería tener 1 evidencia'
  );
}

const ignored =
  engine.calculate({
    does_not_exist: 'x'
  });

if(
  ignored.ignoredAnswers.length !== 1
){
  throw new Error(
    'Las respuestas desconocidas deben registrarse'
  );
}

console.log(
  'OK  ROOMS DNA ENGINE disponible'
);

console.log(
  'OK  Scoring ponderado funciona'
);

console.log(
  'OK  Confidence calculada'
);

console.log(
  'OK  Evidencia conservada'
);

console.log(
  'OK  Respuestas desconocidas no rompen el motor'
);

console.log(
  'ROOMS DNA ENGINE OK'
);

/*
  CONVERGENCIA

  Una misma dimensión debe poder recibir
  evidencia desde interacciones distintas.

  Friday night = casa activa
  Friends Tuesday = que vengan

  Ambas alimentan social_energy.
*/

const convergent =
  engine.calculate({
    friday_night: 'alive',
    friends_tuesday: 'love_it'
  });

const social =
  convergent.dimensions
    .social_energy
    .self;

if(
  social.evidence.length !== 2
){
  throw new Error(
    `social_energy debería tener 2 evidencias y tiene ${social.evidence.length}`
  );
}

/*
  forced_choice pesa 0.85
  scenario pesa 1

  Resultado esperado:
  (0.75*0.85 + 0.70*1)
  /
  (0.85 + 1)
*/

const expectedSocial =
  (
    0.75 * 0.85 +
    0.70 * 1
  ) /
  (
    0.85 + 1
  );

approx(
  social.score,
  expectedSocial
);

const singleSocial =
  engine.calculate({
    friday_night: 'alive'
  })
  .dimensions
  .social_energy
  .self;

if(
  social.confidence <=
  singleSocial.confidence
){
  throw new Error(
    'Más evidencia debería aumentar confidence'
  );
}

console.log(
  'OK  Evidencias distintas convergen'
);

console.log(
  'OK  Source weights afectan la combinación'
);

console.log(
  'OK  Más evidencia aumenta confidence'
);

console.log(
  'ROOMS DNA CONVERGENCE OK'
);

/*
  CONSISTENCY / CONTRADICTION

  Caso coherente:
  Friday night = social
  Friends Tuesday = social

  Caso mixto:
  Friday night = social
  Friends Tuesday = no entre semana

  Ambos tienen evidencia,
  pero el primero debe ser
  más consistente.
*/

const consistentProfile =
  engine.calculate({
    friday_night: 'alive',
    friends_tuesday: 'love_it'
  });

const mixedProfile =
  engine.calculate({
    friday_night: 'alive',
    friends_tuesday: 'not_weekdays'
  });

const consistentSocial =
  consistentProfile
    .dimensions
    .social_energy
    .self;

const mixedVisitors =
  mixedProfile
    .dimensions
    .visitor_tolerance
    .self;

const consistentVisitors =
  consistentProfile
    .dimensions
    .visitor_tolerance
    .self;

if(
  consistentSocial.consistency <= 0
){
  throw new Error(
    'Consistency debería ser > 0'
  );
}

if(
  consistentVisitors.consistency <=
  mixedVisitors.consistency
){
  throw new Error(
    'Las señales coherentes deberían tener mayor consistency'
  );
}

if(
  consistentVisitors.confidence <=
  mixedVisitors.confidence
){
  throw new Error(
    'Las señales coherentes deberían producir mayor confidence'
  );
}

console.log(
  'OK  Consistency calculada'
);

console.log(
  'OK  Contradicciones reducen consistency'
);

console.log(
  'OK  Contradicciones moderan confidence'
);

console.log(
  'ROOMS DNA CONSISTENCY OK'
);

/*
  MULTI-LAYER INFERENCE

  Una sola respuesta de convivencia
  debe poder producir simultáneamente:

  - self
  - preferred
  - importance
*/

const multiLayer =
  engine.calculate({
    dishes_overnight: 'needs_cleaning',
    partner_three_nights: 'too_much'
  });

const cleanlinessLayers =
  multiLayer.dimensions
    .cleanliness;

if(
  cleanlinessLayers.self.score <= 0 ||
  cleanlinessLayers.preferred.score <= 0 ||
  cleanlinessLayers.importance.score <= 0
){
  throw new Error(
    'Cleanliness debería producir self + preferred + importance'
  );
}

const privacyLayers =
  multiLayer.dimensions
    .privacy;

if(
  privacyLayers.self.score <= 0 ||
  privacyLayers.preferred.score <= 0 ||
  privacyLayers.importance.score <= 0
){
  throw new Error(
    'Privacy debería producir self + preferred + importance'
  );
}

if(
  cleanlinessLayers.self
    .evidence.length !== 1 ||
  cleanlinessLayers.preferred
    .evidence.length !== 1 ||
  cleanlinessLayers.importance
    .evidence.length !== 1
){
  throw new Error(
    'Cada capa de cleanliness debería conservar su evidencia'
  );
}

console.log(
  'OK  Una respuesta genera varias capas'
);

console.log(
  'OK  Self + preferred + importance funcionan'
);

console.log(
  'OK  Evidencia separada por capa'
);

console.log(
  'ROOMS DNA MULTI-LAYER OK'
);

/*
  MULTI-INPUT ENGINE

  Probamos que el mismo motor pueda entender:
  - selección múltiple
  - tablero de prioridades
*/

const extendedConfig =
  structuredClone(config);

extendedConfig.sourceWeights.multi_select =
  0.45;

extendedConfig.sourceWeights.priority_board =
  0.90;

extendedConfig.interactions.push(
  {
    id: 'test_interests',
    act: 'test',
    type: 'multi_select',
    options: [
      {
        id: 'music',
        signals: [
          {
            dimension:
              'social_energy',
            field: 'self',
            value: 0.20
          }
        ]
      },
      {
        id: 'reading',
        signals: [
          {
            dimension:
              'privacy',
            field: 'self',
            value: 0.25
          }
        ]
      }
    ]
  },
  {
    id: 'test_home_board',
    act: 'test',
    type: 'priority_board',
    options: [
      {
        id: 'light_need',
        itemId: 'natural_light',
        levelId: 'need',
        signals: [
          {
            dimension:
              'home_activity',
            field: 'preferred',
            value: 0.35
          }
        ]
      },
      {
        id: 'terrace_like',
        itemId: 'terrace',
        levelId: 'like',
        signals: [
          {
            dimension:
              'community_orientation',
            field: 'preferred',
            value: 0.20
          }
        ]
      }
    ]
  }
);

const multiInput =
  engine.calculate(
    {
      test_interests: [
        'music',
        'reading'
      ],

      test_home_board: {
        natural_light: 'need',
        terrace: 'like'
      }
    },
    extendedConfig
  );

if(
  multiInput.dimensions
    .social_energy
    .self
    .evidence.length !== 1
){
  throw new Error(
    'multi_select no aplicó music'
  );
}

if(
  multiInput.dimensions
    .privacy
    .self
    .evidence.length !== 1
){
  throw new Error(
    'multi_select no aplicó reading'
  );
}

if(
  multiInput.dimensions
    .home_activity
    .preferred
    .evidence.length !== 1
){
  throw new Error(
    'priority_board no aplicó natural_light'
  );
}

if(
  multiInput.dimensions
    .community_orientation
    .preferred
    .evidence.length !== 1
){
  throw new Error(
    'priority_board no aplicó terrace'
  );
}

console.log(
  'OK  Engine acepta scalar'
);

console.log(
  'OK  Engine acepta multi_select'
);

console.log(
  'OK  Engine acepta priority_board'
);

console.log(
  'ROOMS DNA MULTI-INPUT OK'
);

/*
  CATEGORICAL DATA

  No toda información debe convertirse
  artificialmente en una dimensión DNA.
*/

const categoricalConfig =
  structuredClone(config);

categoricalConfig.sourceWeights.interest =
  0.25;

categoricalConfig.interactions.push(
  {
    id: 'test_categorical_interests',
    act: 'test',
    type: 'interest',
    options: [
      {
        id: 'music',
        categorical: {
          interests: 'music'
        },
        signals: []
      },
      {
        id: 'travel',
        categorical: {
          interests: 'travel'
        },
        signals: []
      }
    ]
  }
);

const categoricalResult =
  engine.calculate(
    {
      test_categorical_interests: [
        'music',
        'travel'
      ]
    },
    categoricalConfig
  );

if(
  !categoricalResult.categorical
){
  throw new Error(
    'El motor debería devolver categorical'
  );
}

if(
  !categoricalResult
    .categorical
    .interests
    .includes('music') ||
  !categoricalResult
    .categorical
    .interests
    .includes('travel')
){
  throw new Error(
    'Los intereses categóricos no se conservaron'
  );
}

if(
  categoricalResult
    .categorical
    .interests
    .length !== 2
){
  throw new Error(
    'Los categóricos deberían evitar duplicados'
  );
}

console.log(
  'OK  Engine conserva datos categóricos'
);

console.log(
  'OK  Categóricos no requieren inferencias falsas'
);

console.log(
  'ROOMS DNA CATEGORICAL OK'
);

/*
  FINAL ONBOARDING SHAPE
*/

const finalOnboarding =
  engine.calculate({
    shared_groceries: 'ask_first',

    home_priorities: {
      natural_light: 'need',
      terrace: 'like',
      exterior: 'like',
      private_bathroom: 'neutral',
      transport: 'need'
    },

    world_interests: [
      'music',
      'food',
      'travel'
    ],

    self_description: [
      'social',
      'independent',
      'organised'
    ]
  });

if(
  finalOnboarding
    .categorical
    .home_preferences
    .length !== 5
){
  throw new Error(
    'HOME debería conservar 5 preferencias'
  );
}

if(
  finalOnboarding
    .categorical
    .interests
    .length !== 3
){
  throw new Error(
    'WORLD debería conservar 3 intereses'
  );
}

if(
  finalOnboarding
    .categorical
    .traits
    .length !== 3
){
  throw new Error(
    'TRAITS debería conservar 3 rasgos'
  );
}

if(
  finalOnboarding
    .dimensions
    .sharing_style
    .self
    .evidence.length !== 1
){
  throw new Error(
    'La situación de nevera debería alimentar sharing_style'
  );
}

if(
  finalOnboarding
    .dimensions
    .social_energy
    .self
    .evidence.length !== 1
){
  throw new Error(
    'El rasgo social debería alimentar social_energy'
  );
}

console.log(
  'OK  Onboarding final produce DNA + categorías'
);

console.log(
  'OK  HOME conserva preferencias sin inventar personalidad'
);

console.log(
  'OK  WORLD conserva intereses y rasgos'
);

console.log(
  'ROOMS DNA FINAL SHAPE OK'
);
