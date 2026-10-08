import fs from 'node:fs';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const source = fs.readFileSync(
  'assets/js/features/community-create.js',
  'utf8'
);

const app = fs.readFileSync(
  'assets/js/supabase-app.js',
  'utf8'
);

const html = fs.readFileSync('index.html', 'utf8');

console.log('\n=== COMMUNITY CREATE ===');

assert(
  html.includes('assets/js/features/community-create.js'),
  'Falta Community Create en index.html'
);

assert(
  html.indexOf('assets/js/features/community-create.js') <
  html.indexOf('assets/js/supabase-app.js'),
  'Orden de carga incorrecto'
);

assert(
  app.includes('ROOMS_COMMUNITY_CREATE_FEATURE?.create'),
  'Falta inicializacion de Community Create'
);

for (const name of [
  'ensureCreateCommunityModal',
  'openCreateCommunityModal',
  'closeCreateCommunityModal',
  'createCommunity'
]) {
  const regex = new RegExp(
    `(?:async\\s+)?function\\s+${name}\\s*\\(`
  );

  assert(regex.test(source), `Falta ${name} en la feature`);
  assert(!regex.test(app), `${name} sigue en el monolito`);
}

console.log('OK  Integracion y extraccion correctas');

function setup({
  authenticated = true,
  rpcError = false
} = {}) {
  const dom = new JSDOM(
    '<!doctype html><html><body></body></html>',
    {
      runScripts: 'outside-only',
      url: 'http://127.0.0.1/'
    }
  );

  const { window } = dom;
  window.eval(source);

  const notifications = [];
  const calls = [];
  const state = {
    user: authenticated ? { id: 'user-1' } : null,
    communities: new Map()
  };

  const db = {
    async rpc(name, payload) {
      calls.push(['rpc', name, payload]);

      if (rpcError) {
        return {
          data: null,
          error: { message: 'create error' }
        };
      }

      return {
        data: {
          id: 'community-1',
          owner_id: 'user-1',
          name: payload._name,
          description: payload._description,
          visibility: payload._visibility
        },
        error: null
      };
    }
  };

  const feature =
    window.ROOMS_COMMUNITY_CREATE_FEATURE.create({
      db,
      state,
      notify: message => notifications.push(message),
      loadMemberCommunities: async () => {
        calls.push(['loadMembers']);
      },
      renderFilteredExplore: () => {
        calls.push(['renderExplore']);
      }
    });

  return {
    window,
    feature,
    state,
    calls,
    notifications,
    close: () => dom.window.close()
  };
}

async function run() {
  {
    const t = setup();
    const modal = t.feature.ensureCreateCommunityModal();

    assert(modal);
    assert.equal(modal.id, 'createCommunityModal');

    assert(
      modal.querySelector('#createCommunityForm')
    );

    assert.strictEqual(
      t.feature.ensureCreateCommunityModal(),
      modal,
      'El modal debe reutilizarse'
    );

    console.log('OK  Modal creado y reutilizado');

    t.feature.openCreateCommunityModal();

    assert(modal.classList.contains('open'));
    assert.equal(modal.getAttribute('aria-hidden'), 'false');

    t.feature.closeCreateCommunityModal();

    assert(!modal.classList.contains('open'));
    assert.equal(modal.getAttribute('aria-hidden'), 'true');

    console.log('OK  Apertura y cierre correctos');
    t.close();
  }

  {
    const t = setup({ authenticated: false });

    await t.feature.createCommunity({
      preventDefault() {}
    });

    assert.equal(t.calls.length, 0);
    assert(
      t.notifications.includes('Necesitas iniciar sesión')
    );

    console.log('OK  Usuario sin sesion controlado');
    t.close();
  }

  {
    const t = setup();
    const modal = t.feature.ensureCreateCommunityModal();

    modal.querySelector('#createCommunityName').value = '   ';

    await t.feature.createCommunity({
      preventDefault() {}
    });

    assert.equal(t.calls.length, 0);
    assert(
      t.notifications.includes(
        'Pon un nombre a la comunidad'
      )
    );

    console.log('OK  Validacion de nombre');
    t.close();
  }

  {
    const t = setup();
    const modal = t.feature.ensureCreateCommunityModal();

    modal.querySelector('#createCommunityName').value =
      '  Vivir en Chamberí  ';

    modal.querySelector('#createCommunityDescription').value =
      '  Comunidad del barrio  ';

    await t.feature.createCommunity({
      preventDefault() {}
    });

    const rpc = t.calls.find(call => call[0] === 'rpc');

    assert(rpc, 'No se ejecuto RPC');
    assert.equal(rpc[1], 'create_community');

    assert.equal(rpc[2]._name, 'Vivir en Chamberí');
    assert.equal(
      rpc[2]._description,
      'Comunidad del barrio'
    );
    assert.equal(rpc[2]._visibility, 'public');

    assert(t.state.communities.has('community-1'));

    assert(
      t.calls.some(call => call[0] === 'loadMembers')
    );

    assert(
      t.calls.some(call => call[0] === 'renderExplore')
    );

    assert(
      t.notifications.includes('Comunidad creada')
    );

    assert(
      !modal.classList.contains('open')
    );

    console.log('OK  RPC y datos enviados');
    console.log('OK  Estado actualizado');
    console.log('OK  Membership y Explore refrescados');
    console.log('OK  Formulario cerrado tras crear');
    t.close();
  }

  {
    const t = setup({ rpcError: true });
    const modal = t.feature.ensureCreateCommunityModal();

    modal.querySelector('#createCommunityName').value =
      'Comunidad con error';

    await t.feature.createCommunity({
      preventDefault() {}
    });

    assert.equal(t.state.communities.size, 0);

    assert(
      t.notifications.includes(
        'No hemos podido crear la comunidad'
      )
    );

    assert.equal(
      modal.querySelector('.create-community-submit').disabled,
      false
    );

    console.log('OK  Error Supabase controlado');
    t.close();
  }

  console.log('\nROOMS COMMUNITY CREATE FEATURE OK');
}

await run();
