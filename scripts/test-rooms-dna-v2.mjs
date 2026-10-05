import fs from 'node:fs';
import vm from 'node:vm';

const filename =
  'assets/js/rooms-dna-v2-config.js';

const code =
  fs.readFileSync(filename, 'utf8');

const sandbox = {};

vm.runInNewContext(
  code,
  sandbox,
  { filename }
);

const dna =
  sandbox.ROOMS_DNA_V2;

if(!dna){
  throw new Error(
    'ROOMS_DNA_V2 no existe'
  );
}

const dimensions =
  new Set(
    Object.keys(dna.dimensions || {})
  );

const sourceWeights =
  dna.sourceWeights || {};

const allowedFields =
  new Set([
    'self',
    'preferred',
    'importance'
  ]);

const interactions =
  dna.interactions || [];

if(
  interactions.length !== 10
){
  throw new Error(
    `Esperaba 10 interacciones y hay ${interactions.length}`
  );
}

const expectedActs = {
  vibe: 3,
  living: 4,
  home: 1,
  world: 2
};

for(
  const [
    act,
    expected
  ] of Object.entries(
    expectedActs
  )
){
  const actual =
    interactions.filter(
      interaction =>
        interaction.act === act
    ).length;

  if(actual !== expected){
    throw new Error(
      `Esperaba ${expected} interacciones ${act} y hay ${actual}`
    );
  }
}

const ids = new Set();

for(
  const interaction of interactions
){
  if(ids.has(interaction.id)){
    throw new Error(
      `ID duplicado: ${interaction.id}`
    );
  }

  ids.add(interaction.id);

  if(
    !sourceWeights[
      interaction.type
    ]
  ){
    throw new Error(
      `${interaction.id}: source weight inexistente para ${interaction.type}`
    );
  }

  if(
    !Array.isArray(
      interaction.options
    ) ||
    interaction.options.length < 2
  ){
    throw new Error(
      `${interaction.id}: necesita al menos 2 opciones`
    );
  }

  for(
    const option of interaction.options
  ){
    const hasSignals =
      Array.isArray(
        option.signals
      ) &&
      option.signals.length > 0;

    const hasCategorical =
      option.categorical &&
      typeof option.categorical ===
        'object';

    if(
      !hasSignals &&
      !hasCategorical
    ){
      throw new Error(
        `${interaction.id}/${option.id}: sin señales ni datos categóricos`
      );
    }

    for(
      const signal of option.signals || []
    ){
      if(
        !dimensions.has(
          signal.dimension
        )
      ){
        throw new Error(
          `${interaction.id}/${option.id}: dimensión desconocida ${signal.dimension}`
        );
      }

      if(
        !allowedFields.has(
          signal.field
        )
      ){
        throw new Error(
          `${interaction.id}/${option.id}: field inválido ${signal.field}`
        );
      }

      if(
        typeof signal.value !==
          'number' ||
        signal.value < -1 ||
        signal.value > 1
      ){
        throw new Error(
          `${interaction.id}/${option.id}/${signal.dimension}: value fuera de rango`
        );
      }
    }
  }
}

console.log(
  'OK  ROOMS DNA V2 cargado'
);

console.log(
  `OK  ${dimensions.size} dimensiones válidas`
);

console.log(
  `OK  ${interactions.length} interacciones totales`
);

console.log(
  'OK  3 VIBE + 4 LIVING + 1 HOME + 2 WORLD'
);

console.log(
  'OK  Todas las señales apuntan a dimensiones válidas'
);

console.log(
  'OK  Todos los pesos están entre -1 y 1'
);

console.log(
  'ROOMS DNA V2 INTERACTIONS OK'
);
