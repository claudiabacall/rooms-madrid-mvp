import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const html = fs.readFileSync('index.html', 'utf8');

function setup() {
  const dom = new JSDOM(html, {
    url: 'http://127.0.0.1:4173/',
    pretendToBeVisual: true
  });

  const { window } = dom;
  const { document } = window;

  const state = {
    intent: new Set(),
    searchTypes: new Set(),
    preferredZones: new Set(),
    matesMode: '',
    homeZone: ''
  };

  function setPressed(selector, values, attrName) {
    document.querySelectorAll(selector).forEach(button => {
      const value = button.dataset[attrName];
      const active = values.includes(value);

      button.setAttribute(
        'aria-pressed',
        String(active)
      );
    });
  }

  function evaluateStep2() {
    const housingReady =
      !state.intent.has('housing') ||
      state.searchTypes.size > 0;

    const matesReady =
      !state.intent.has('mates') ||
      Boolean(state.matesMode);

    const needsSearchZones =
      state.intent.has('housing') ||
      (
        state.intent.has('mates') &&
        state.matesMode === 'search-together'
      );

    const needsHomeZone =
      state.intent.has('mates') &&
      state.matesMode === 'have-home';

    const searchZonesReady =
      !needsSearchZones ||
      state.preferredZones.size > 0;

    const homeZoneReady =
      !needsHomeZone ||
      Boolean(state.homeZone);

    return {
      housingReady,
      matesReady,
      needsSearchZones,
      needsHomeZone,
      searchZonesReady,
      homeZoneReady,
      canContinue:
        housingReady &&
        matesReady &&
        searchZonesReady &&
        homeZoneReady
    };
  }

  function renderVisibility() {
    const searchZonesBlock =
      document.querySelector('#searchZonesBlock');

    const homeZoneBlock =
      document.querySelector('#homeZoneBlock');

    const housingBlock =
      document.querySelector('#housingIntentDetails');

    const matesBlock =
      document.querySelector('#matesIntentDetails');

    if (housingBlock) {
      housingBlock.hidden =
        !state.intent.has('housing');
    }

    if (matesBlock) {
      matesBlock.hidden =
        !state.intent.has('mates');
    }

    const result = evaluateStep2();

    if (searchZonesBlock) {
      searchZonesBlock.hidden =
        !result.needsSearchZones;
    }

    if (homeZoneBlock) {
      homeZoneBlock.hidden =
        !result.needsHomeZone;
    }

    return {
      ...result,
      housingBlockVisible:
        housingBlock ? !housingBlock.hidden : null,
      matesBlockVisible:
        matesBlock ? !matesBlock.hidden : null,
      searchZonesVisible:
        searchZonesBlock ? !searchZonesBlock.hidden : null,
      homeZoneVisible:
        homeZoneBlock ? !homeZoneBlock.hidden : null
    };
  }

  return {
    window,
    document,
    state,
    setPressed,
    renderVisibility
  };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function runCase(name, configure, expected) {
  const ctx = setup();

  configure(ctx);

  const result =
    ctx.renderVisibility();

  for (const [key, value] of Object.entries(expected)) {
    assert(
      result[key] === value,
      `${name}: esperado ${key}=${value}, obtenido ${result[key]}`
    );
  }

  console.log(`OK  ${name}`);
}

/* =========================================================
   CASO 1
   Solo vivienda
   ========================================================= */

runCase(
  'Solo vivienda',
  ({ state }) => {
    state.intent.add('housing');
    state.searchTypes.add('room');
    state.preferredZones.add('Chamberí');
  },
  {
    housingBlockVisible: true,
    matesBlockVisible: false,
    searchZonesVisible: true,
    homeZoneVisible: false,
    canContinue: true
  }
);

/* =========================================================
   CASO 2
   Solo compañeros + ya tengo casa
   ========================================================= */

runCase(
  'Compañeros con vivienda',
  ({ state }) => {
    state.intent.add('mates');
    state.matesMode = 'have-home';
    state.homeZone = 'Retiro';
  },
  {
    housingBlockVisible: false,
    matesBlockVisible: true,
    searchZonesVisible: false,
    homeZoneVisible: true,
    canContinue: true
  }
);

/* =========================================================
   CASO 3
   Solo compañeros + buscar juntos
   ========================================================= */

runCase(
  'Compañeros para buscar juntos',
  ({ state }) => {
    state.intent.add('mates');
    state.matesMode = 'search-together';
    state.preferredZones.add('Chamberí');
  },
  {
    housingBlockVisible: false,
    matesBlockVisible: true,
    searchZonesVisible: true,
    homeZoneVisible: false,
    canContinue: true
  }
);

/* =========================================================
   CASO 4
   Vivienda + compañeros + ya tengo casa
   ========================================================= */

runCase(
  'Vivienda y compañeros con casa',
  ({ state }) => {
    state.intent.add('housing');
    state.intent.add('mates');
    state.searchTypes.add('room');
    state.matesMode = 'have-home';
    state.preferredZones.add('Chamberí');
    state.homeZone = 'Retiro';
  },
  {
    housingBlockVisible: true,
    matesBlockVisible: true,
    searchZonesVisible: true,
    homeZoneVisible: true,
    canContinue: true
  }
);

/* =========================================================
   VALIDACIONES NEGATIVAS
   ========================================================= */

runCase(
  'Vivienda sin tipo',
  ({ state }) => {
    state.intent.add('housing');
    state.preferredZones.add('Chamberí');
  },
  {
    canContinue: false
  }
);

runCase(
  'Vivienda sin zonas',
  ({ state }) => {
    state.intent.add('housing');
    state.searchTypes.add('room');
  },
  {
    canContinue: false
  }
);

runCase(
  'Compañeros sin situación',
  ({ state }) => {
    state.intent.add('mates');
  },
  {
    canContinue: false
  }
);

runCase(
  'Ya tengo casa sin zona',
  ({ state }) => {
    state.intent.add('mates');
    state.matesMode = 'have-home';
  },
  {
    canContinue: false
  }
);

console.log('');
console.log('ONBOARDING ROUTES OK');
