import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(
  'assets/js/features/listing-photo-references.js',
  'utf8'
);

const context = {window: {}, URL};
vm.runInNewContext(source, context);

const create =
  context.window.ROOMS_LISTING_PHOTO_REFERENCES.create;

const qa = 'https://gpfmocptevpyzrwsubkj.supabase.co';
const a = '11111111-1111-4111-8111-111111111111';
const b = '22222222-2222-4222-8222-222222222222';

const service = create({supabaseUrl: qa});
const path = `${a}/${b}/foto-1.png`;
const publicUrl =
  `${qa}/storage/v1/object/public/listing-images/${path}`;

function test(label, fn) {
  fn();
  console.log('OK '+label);
}

test('Extrae ruta de URL publica existente', () => {
  assert.equal(service.parse(publicUrl).path, path);
});

test('Acepta referencia estable sin URL', () => {
  assert.equal(service.parse(path).path, path);
});

test('Conserva compatibilidad con parametros URL', () => {
  assert.equal(
    service.parse(publicUrl+'?version=1').path,
    path
  );
});

test('Rechaza URL de proyecto ajeno', () => {
  assert.equal(
    service.parse(
      `https://otro-proyecto.supabase.co/storage/v1/object/public/listing-images/${path}`
    ),
    null
  );
});

test('Rechaza rutas fuera de listing-images', () => {
  assert.equal(
    service.parse(
      `${qa}/storage/v1/object/public/avatars/${path}`
    ),
    null
  );
});

test('Verifica propietario', () => {
  assert.equal(
    service.parse(publicUrl,{ownerId:b}),
    null
  );
  assert.equal(
    service.parse(publicUrl,{ownerId:a}).path,
    path
  );
});

test('Verifica identificador de vivienda', () => {
  assert.equal(
    service.parse(publicUrl,{listingId:a}),
    null
  );
  assert.equal(
    service.parse(publicUrl,{listingId:b}).path,
    path
  );
});

test('Rechaza rutas malformadas', () => {
  assert.equal(service.parse('../foto.png'),null);
  assert.equal(service.parse('texto'),null);
  assert.equal(service.parse(null),null);
  assert.equal(service.parse(`${a}/${b}/../otro.png`),null);
  assert.equal(service.parse(`${a}/${b}/foto%2Fextra.png`),null);
});

test('Normaliza fotos de un anuncio', () => {
  const refs=service.fromListing({
    id:b,
    owner_id:a,
    photos:[publicUrl,`${a}/${b}/foto-2.png`]
  });
  assert.equal(refs.length,2);
  assert.equal(refs[0].path,path);
  assert.equal(refs[1].path,`${a}/${b}/foto-2.png`);
});

test('No acepta fotos de otro propietario', () => {
  const refs=service.fromListing({
    id:b,
    owner_id:b,
    photos:[publicUrl]
  });
  assert.equal(refs.length,1);
  assert.equal(refs[0],null);
});

console.log(
  'ROOMS M8.25 REFERENCIAS FOTOGRAFICAS OK'
);
