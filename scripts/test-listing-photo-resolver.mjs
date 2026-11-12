import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const context = { window: {}, URL };

for (const file of [
  'assets/js/features/listing-photo-references.js',
  'assets/js/features/listing-photo-resolver.js'
]) {
  vm.runInNewContext(readFileSync(file, 'utf8'), context);
}

const QA='https://gpfmocptevpyzrwsubkj.supabase.co';
const OWNER='11111111-1111-4111-8111-111111111111';
const LISTING='22222222-2222-4222-8222-222222222222';
const OTHER='33333333-3333-4333-8333-333333333333';

const path=`${OWNER}/${LISTING}/foto.png`;
const publicUrl=
  `${QA}/storage/v1/object/public/listing-images/${path}`;

const references =
  context.window.ROOMS_LISTING_PHOTO_REFERENCES.create({
    supabaseUrl:QA
  });

const create =
  context.window.ROOMS_LISTING_PHOTO_RESOLVER.create;

function setup(signer) {
  const calls=[];
  const db={
    storage:{
      from(bucket){
        assert.equal(bucket,'listing-images');
        return {
          async createSignedUrl(path,seconds){
            calls.push({path,seconds});
            return signer(path);
          }
        };
      }
    }
  };
  return {
    calls,
    resolver:create({db,references})
  };
}

function listing(photos,owner=OWNER){
  return {
    id:LISTING,
    owner_id:owner,
    photos
  };
}

{
  const t=setup(async p=>({
    data:{signedUrl:`https://signed.example/${p}?token=test`},
    error:null
  }));
  const original=listing([publicUrl]);

  const result=await t.resolver.resolveListing(original);

  assert.equal(result.length,1);
  assert.match(result[0],/signed\.example/);
  assert.equal(t.calls.length,1);
  assert.equal(t.calls[0].path,path);
  assert.equal(t.calls[0].seconds,60);
  assert.equal(original.photos[0],publicUrl);

  console.log('OK URL temporal de 60 segundos');
  console.log('OK Referencia original intacta');
}

{
  const t=setup(async()=>({
    data:null,
    error:{message:'denied'}
  }));
  const result=await t.resolver.resolveListing(
    listing([publicUrl])
  );
  assert.equal(result[0],null);
  console.log('OK Error de autorizacion no expone URL publica');
}

{
  const t=setup(async()=>{
    throw Error('network error');
  });
  const result=await t.resolver.resolveListing(
    listing([publicUrl])
  );
  assert.equal(result[0],null);
  console.log('OK Fallo de red controlado');
}

{
  const t=setup(async()=>({
    data:{signedUrl:'https://signed.example/ok'},
    error:null
  }));

  const result=await t.resolver.resolveListing(
    listing([publicUrl],OTHER)
  );

  assert.equal(result[0],null);
  assert.equal(t.calls.length,0);
  console.log('OK Referencia de otro propietario rechazada');
}

{
  const t=setup(async()=>({
    data:{signedUrl:'https://signed.example/ok'},
    error:null
  }));

  const result=await t.resolver.resolveListing(
    listing([
      'https://attacker.example/photo.png',
      `${OWNER}/${OTHER}/photo.png`,
      publicUrl
    ])
  );

  assert.equal(result.length,3);
  assert.equal(result[0],null);
  assert.equal(result[1],null);
  assert.equal(result[2],'https://signed.example/ok');
  assert.equal(t.calls.length,1);

  console.log('OK Rutas ajenas y externas no se firman');
  console.log('OK Orden de fotografias conservado');
}

{
  const t=setup(async()=>({
    data:{signedUrl:'https://signed.example/ok'},
    error:null
  }));

  assert.equal(
    (await t.resolver.resolveListing(listing([]))).length,
    0
  );
  assert.equal(
    (await t.resolver.resolveListing(null)).length,
    0
  );
  assert.equal(t.calls.length,0);
  console.log('OK Anuncios sin fotos controlados');
}

console.log('OK M8.26 RESOLVEDOR VALIDADO');
