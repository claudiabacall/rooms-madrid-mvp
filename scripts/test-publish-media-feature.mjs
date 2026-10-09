import fs from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const source = fs.readFileSync(
  'assets/js/features/publish-media.js',
  'utf8'
);

const app = fs.readFileSync(
  'assets/js/supabase-app.js',
  'utf8'
);

const html = fs.readFileSync('index.html', 'utf8');

console.log('\n=== PUBLISH MEDIA ===');

assert(
  html.includes('assets/js/features/publish-media.js')
);

assert(
  html.indexOf('assets/js/features/publish-media.js') <
  html.indexOf('assets/js/supabase-app.js')
);

assert(
  app.includes('ROOMS_PUBLISH_MEDIA_FEATURE?.create')
);

for (const name of [
  'uploadCommunityPostMedia',
  'uploadListingPhotos'
]) {
  assert(
    new RegExp(`async function ${name}\\s*\\(`).test(source)
  );
  assert(
    !new RegExp(`async function ${name}\\s*\\(`).test(app)
  );
}

const context = { window: {}, console, Date };
vm.runInNewContext(source, context);

const factory =
  context.window.ROOMS_PUBLISH_MEDIA_FEATURE.create;

assert.equal(typeof factory, 'function');

console.log('OK  Modulo extraido e integrado');

function setup({ fail = [] } = {}) {
  const calls = [];

  const db = {
    storage: {
      from(bucket) {
        return {
          async upload(path, file, options) {
            calls.push(['upload', bucket, path, file, options]);

            return {
              error: fail.includes(file.name)
                ? { message: 'upload error' }
                : null
            };
          },
          getPublicUrl(path) {
            calls.push(['url', bucket, path]);
            return {
              data: {
                publicUrl: `https://example.com/${bucket}/${path}`
              }
            };
          }
        };
      }
    }
  };

  const state = {
    user: { id: 'user-1' }
  };

  return {
    feature: factory({ db, state }),
    calls
  };
}

function file(name, type = 'image/jpeg') {
  return { name, type };
}

{
  const t = setup();

  const urls = await t.feature.uploadCommunityPostMedia(
    'post-1',
    [file('foto.JPG'), file('segunda.png', 'image/png')]
  );

  assert.equal(urls.length, 2);
  assert(urls.every(url => url.includes('community-post-media')));
  assert(urls.every(url => url.includes('user-1/post-1/')));

  const uploads = t.calls.filter(call => call[0] === 'upload');

  assert.equal(uploads.length, 2);
  assert.equal(uploads[0][4].upsert, false);
  assert.equal(uploads[0][4].cacheControl, '3600');

  console.log('OK  Subida de imagenes de comunidad');
}

{
  const t = setup();

  const urls = await t.feature.uploadListingPhotos(
    'listing-1',
    [file('habitacion.webp', 'image/webp')]
  );

  assert.equal(urls.length, 1);
  assert(urls[0].includes('listing-images'));
  assert(urls[0].includes('user-1/listing-1/'));

  console.log('OK  Subida de fotografias de viviendas');
}

{
  const t = setup({ fail: ['error.jpg'] });

  const urls = await t.feature.uploadListingPhotos(
    'listing-1',
    [file('bien.jpg'), file('error.jpg'), file('otra.png')]
  );

  assert.equal(urls.length, 2);
  assert.equal(
    t.calls.filter(call => call[0] === 'upload').length,
    3
  );

  console.log('OK  Error individual no bloquea otras subidas');
}

{
  const t = setup();

  assert.deepEqual(
    Array.from(
      await t.feature.uploadCommunityPostMedia('post-1', [])
    ),
    []
  );

  assert.deepEqual(
    Array.from(
      await t.feature.uploadListingPhotos('listing-1', [])
    ),
    []
  );

  assert.equal(t.calls.length, 0);

  console.log('OK  Sin archivos no realiza operaciones');
}

console.log('\nROOMS PUBLISH MEDIA FEATURE OK');
