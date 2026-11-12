import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const app = fs.readFileSync(
  'assets/js/supabase-app.js',
  'utf8'
);

const presentationSource = fs.readFileSync(
  'assets/js/features/listing-photo-presentation.js',
  'utf8'
);

const feedSource = fs.readFileSync(
  'assets/js/features/feed-listing-card.js',
  'utf8'
);

assert.match(
  app,
  /await listingPhotoPresentation\.prepare\(visibleListings\)/
);

assert.match(
  app,
  /renderRealFeed\(\s*visibleListings,/
);

assert.match(
  app,
  /renderListingCard:\s*listing =>\s*renderListingCard\(\s*listingPhotoPresentation\.get\(listing\)/
);

console.log('OK Feed conectado a presentacion privada');

const window = {};

vm.runInNewContext(presentationSource, {window});
vm.runInNewContext(feedSource, {window});

const listing = {
  id: 'listing-1',
  owner_id: 'owner-1',
  status: 'published',
  kind: 'room',
  title: 'Habitacion de prueba',
  zone: 'Madrid',
  price: 750,
  photos: ['https://public.example/photo.jpg']
};

let grantAccess = true;

const presentation =
  window.ROOMS_LISTING_PHOTO_PRESENTATION.create({
    cache: {
      async resolve(item) {
        return {
          ...item,
          photos: grantAccess
            ? ['https://signed.example/photo?token=ok']
            : []
        };
      }
    }
  });

const feed =
  window.ROOMS_FEED_LISTING_CARD_FEATURE.create({
    state: {blockedUsers: new Set()},
    escapeHtml: value =>
      String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('"', '&quot;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
  });

function render() {
  return feed.renderListingCard(
    presentation.get(listing)
  );
}

{
  const html = render();

  assert.ok(!html.includes('public.example/photo.jpg'));
  console.log('OK Sin preparacion no aparece URL publica');
}

{
  assert.equal(await presentation.prepare([listing]), true);

  const html = render();

  assert.ok(html.includes('signed.example/photo'));
  assert.ok(!html.includes('public.example/photo.jpg'));
  assert.equal(
    listing.photos[0],
    'https://public.example/photo.jpg'
  );

  console.log('OK Feed muestra URL firmada');
  console.log('OK Anuncio original intacto');
}

{
  presentation.invalidate(listing.id);

  const html = render();

  assert.ok(!html.includes('signed.example/photo'));
  assert.ok(!html.includes('public.example/photo.jpg'));

  console.log('OK Invalidez elimina URL del nuevo render');
}

{
  grantAccess = false;
  await presentation.prepare([listing]);

  const html = render();

  assert.ok(!html.includes('signed.example/photo'));
  assert.ok(!html.includes('public.example/photo.jpg'));

  console.log('OK Acceso denegado sin fallback publico');
}

{
  const blockedFeed =
    window.ROOMS_FEED_LISTING_CARD_FEATURE.create({
      state: {
        blockedUsers: new Set(['owner-1'])
      },
      escapeHtml: String
    });

  assert.equal(
    blockedFeed.renderListingCard(
      presentation.get(listing)
    ),
    ''
  );

  console.log('OK Usuario bloqueado excluido');
}

console.log('OK M8.49 INTEGRACION FEED VALIDADA');
