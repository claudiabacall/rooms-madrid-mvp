import fs from 'node:fs';
import vm from 'node:vm';

const sandbox = {};

for(
  const file of [
    'assets/js/rooms-dna-v2-config.js',
    'assets/js/rooms-dna-engine.js',
    'assets/js/rooms-dna-archetypes.js'
  ]
){
  vm.runInNewContext(
    fs.readFileSync(
      file,
      'utf8'
    ),
    sandbox,
    { filename: file }
  );
}

const engine =
  sandbox.ROOMS_DNA_ENGINE;

const archetypes =
  sandbox.ROOMS_DNA_ARCHETYPES;

if(
  !archetypes ||
  typeof archetypes.classify !==
    'function'
){
  throw new Error(
    'ROOMS_DNA_ARCHETYPES no disponible'
  );
}

if(
  archetypes.definitions.length !== 6
){
  throw new Error(
    'Esperaba 6 arquetipos'
  );
}

/*
  Perfil social pero con límites.
*/

const selectiveSocialDna =
  engine.calculate({
    friday_night: 'alive',
    friends_tuesday: 'tell_me',
    partner_three_nights: 'sometimes',
    shared_groceries: 'ask_first',
    plans_change: 'tell_me_before'
  });

const selectiveSocial =
  archetypes.classify(
    selectiveSocialDna
  );

if(
  selectiveSocial.primary.id !==
    'selective_social'
){
  throw new Error(
    `Esperaba selective_social y salió ${selectiveSocial.primary.id}`
  );
}

/*
  Perfil muy privado.
*/

const privateDna =
  engine.calculate({
    friday_night: 'reset',
    friends_tuesday: 'not_weekdays',
    partner_three_nights: 'too_much',
    shared_groceries: 'mine_is_mine',
    day_off: 'rough_plan'
  });

const privateResult =
  archetypes.classify(
    privateDna
  );

if(
  privateResult.primary.id !==
    'private_club'
){
  throw new Error(
    `Esperaba private_club y salió ${privateResult.primary.id}`
  );
}

/*
  Debemos conservar ranking,
  no solo una etiqueta.
*/

if(
  selectiveSocial.ranked.length !== 6
){
  throw new Error(
    'El ranking debería contener 6 arquetipos'
  );
}

if(
  selectiveSocial.primary.fit <
  selectiveSocial.secondary.fit
){
  throw new Error(
    'Primary debe superar a secondary'
  );
}

console.log(
  'OK  6 arquetipos definidos'
);

console.log(
  'OK  Selective Social clasifica correctamente'
);

console.log(
  'OK  Private Club clasifica correctamente'
);

console.log(
  'OK  Ranking secundario conservado'
);

console.log(
  'ROOMS DNA ARCHETYPES OK'
);

/*
  HOUSE CEO REAL

  Orden + comunicación + límites,
  pero sin aislamiento social.
*/

const houseCeoDna =
  engine.calculate({
    friday_night: 'alive',
    day_off: 'rough_plan',
    plans_change: 'tell_me_before',
    friends_tuesday: 'tell_me',
    dishes_overnight: 'needs_cleaning',
    partner_three_nights: 'sometimes',
    shared_groceries: 'ask_first'
  });

const houseCeoResult =
  archetypes.classify(
    houseCeoDna
  );

if(
  houseCeoResult.primary.id !==
    'house_ceo'
){
  throw new Error(
    `Esperaba house_ceo y salió ${houseCeoResult.primary.id}`
  );
}

if(
  houseCeoResult.primary.fit <=
  houseCeoResult.secondary.fit
){
  throw new Error(
    'HOUSE CEO debería ganar claramente a su secondary'
  );
}

console.log(
  'OK  House CEO clasifica correctamente'
);

console.log(
  'ROOMS DNA HOUSE CEO OK'
);

/*
  OPEN HOUSE
*/

const openHouseDna =
  engine.calculate({
    friday_night: 'alive',
    friends_tuesday: 'love_it',
    partner_three_nights: 'all_good',
    shared_groceries: 'share_everything',
    plans_change: 'improvise'
  });

const openHouseResult =
  archetypes.classify(
    openHouseDna
  );

if(
  openHouseResult.primary.id !==
    'open_house'
){
  throw new Error(
    `Esperaba open_house y salió ${openHouseResult.primary.id}`
  );
}

console.log(
  'OK  Open House clasifica correctamente'
);


/*
  FREE SPIRIT
*/

const freeSpiritDna =
  engine.calculate({
    plans_change: 'improvise',
    day_off: 'rough_plan',
    dishes_overnight: 'whatever',
    shared_groceries: 'ask_first'
  });

const freeSpiritResult =
  archetypes.classify(
    freeSpiritDna
  );

if(
  freeSpiritResult.primary.id !==
    'free_spirit'
){
  throw new Error(
    `Esperaba free_spirit y salió ${freeSpiritResult.primary.id}`
  );
}

console.log(
  'OK  Free Spirit clasifica correctamente'
);


/*
  PEACE KEEPER
*/

const peaceKeeperDna =
  engine.calculate({
    day_off: 'go_with_flow',
    dishes_overnight: 'tomorrow_ok',

    self_description: [
      'calm',
      'easygoing'
    ]
  });

const peaceKeeperResult =
  archetypes.classify(
    peaceKeeperDna
  );

if(
  peaceKeeperResult.primary.id !==
    'peace_keeper'
){
  throw new Error(
    `Esperaba peace_keeper y salió ${peaceKeeperResult.primary.id}`
  );
}

console.log(
  'OK  Peace Keeper clasifica correctamente'
);

console.log(
  'ROOMS DNA ALL ARCHETYPES OK'
);
