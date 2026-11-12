import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const app = fs.readFileSync(
  'assets/js/supabase-app.js', 'utf8'
);

const detailSource = fs.readFileSync(
  'assets/js/features/listings.js', 'utf8'
);

const presentationSource = fs.readFileSync(
  'assets/js/features/listing-photo-presentation.js',
  'utf8'
);

assert.match(
  app,
  /openRealListingDetail:\s*renderListingDetail/
);

assert.match(
  app,
  /function openPrivateListingDetail\(listing\)/
);

assert.match(
  app,
  /const openRealListingDetail = openPrivateListingDetail;/
);

assert.doesNotMatch(
  app,
  /function openRealListingDetail\s*\(/
);

assert.match(
  app,
  /return renderListingDetail\(\s*listingPhotoPresentation\.get\(listing\)/
);

assert.match(
  app,
  /state\.blockedUsers\?\.has\(listing\.owner_id\)/
);

console.log('OK Todas las aperturas pasan por el detalle seguro');

const dom = new JSDOM(
  '<!doctype html><html><body><div id="detailContent"></div></body></html>',
  {
    url: 'http://127.0.0.1/',
    runScripts: 'outside-only'
  }
);

const { window } = dom;
window.eval(detailSource);
window.eval(presentationSource);

const original = {
  id: 'listing-1',
  owner_id: 'owner-1',
  kind: 'room',
  title: 'Habitacion de prueba',
  zone: 'Madrid',
  price: 750,
  photos: ['https://public.example/photo.jpg']
};

const state = {
  user: { id: 'viewer-1' },
  blockedUsers: new Set(),
  listings: new Map([[original.id, original]])
};

const escapeHtml = value =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');

const feature =
  window.ROOMS_LISTINGS_FEATURE.create({
    state,
    escapeHtml,
    showModal() {}
  });

let permitted = true;

const presentation =
  window.ROOMS_LISTING_PHOTO_PRESENTATION.create({
    cache: {
      async resolve(listing) {
        return {
          ...listing,
          photos: permitted
            ? ['https://signed.example/photo?token=ok']
            : []
        };
      }
    }
  });

function openRealListingDetail(listing) {
  if (!listing) return;

  if (
    listing.owner_id &&
    state.blockedUsers?.has(listing.owner_id)
  ) {
    return;
  }

  return feature.openRealListingDetail(
    presentation.get(listing)
  );
}

const content = () =>
  window.document.querySelector('#detailContent').innerHTML;

{
  openRealListingDetail(original);
  assert.ok(!content().includes('public.example/photo.jpg'));

  console.log('OK Sin preparar no aparece fotografia publica');
}

{
  await presentation.prepare([original]);
  openRealListingDetail(original);

  assert.ok(content().includes('signed.example/photo'));
  assert.ok(!content().includes('public.example/photo.jpg'));

  assert.equal(
    original.photos[0],
    'https://public.example/photo.jpg'
  );

  console.log('OK Detalle muestra URL firmada');
  console.log('OK Referencia original intacta');
}

{
  presentation.invalidate(original.id);
  openRealListingDetail(original);

  assert.ok(!content().includes('signed.example/photo'));
  assert.ok(!content().includes('public.example/photo.jpg'));

  console.log('OK Detalle sin foto tras invalidacion');
}

{
  permitted = false;
  await presentation.prepare([original]);
  openRealListingDetail(original);

  assert.ok(!content().includes('signed.example/photo'));
  assert.ok(!content().includes('public.example/photo.jpg'));

  console.log('OK Acceso denegado sin fallback publico');
}

{
  state.blockedUsers.add(original.owner_id);
  const before = content();

  openRealListingDetail(original);

  assert.equal(content(), before);

  console.log('OK Bloqueo impide nueva apertura');
}

console.log('OK M8.52 DETALLE PRIVADO VALIDADO');
