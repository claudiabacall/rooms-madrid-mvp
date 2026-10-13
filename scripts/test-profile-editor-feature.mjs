import fs from 'node:fs';
import { JSDOM } from 'jsdom';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function ok(message) {
  console.log(`OK  ${message}`);
}

const featureSource =
  fs.readFileSync(
    'assets/js/features/profile-editor.js',
    'utf8'
  );

const appSource =
  fs.readFileSync(
    'assets/js/supabase-app.js',
    'utf8'
  );

const htmlSource =
  fs.readFileSync(
    'index.html',
    'utf8'
  );


console.log(
  '\n=== PROFILE EDITOR · INTEGRACION ==='
);

assert(
  htmlSource.includes(
    'assets/js/features/profile-editor.js'
  ),
  'index.html no carga profile-editor.js'
);

assert(
  htmlSource.indexOf(
    'assets/js/features/profile-editor.js'
  ) <
    htmlSource.indexOf(
      'assets/js/supabase-app.js'
    ),
  'profile-editor.js debe cargar antes de supabase-app.js'
);

assert(
  appSource.includes(
    'window.ROOMS_PROFILE_EDITOR_FEATURE?.create'
  ),
  'supabase-app.js no inicializa Profile Editor'
);

for (const fn of [
  'ensureProfileEditorModal',
  'openProfileEditor',
  'uploadProfilePhoto'
]) {
  const regex =
    new RegExp(
      `(?:async\\s+)?function\\s+${fn}\\s*\\(`
    );

  assert(
    !regex.test(appSource),
    `${fn} sigue duplicada en supabase-app.js`
  );
}

const livingSource = fs.readFileSync(
  'assets/js/features/living-editor.js',
  'utf8'
);

assert(
  /function\s+ensureLivingEditorModal\s*\(/.test(
    livingSource
  ),
  'Living Editor debe estar en su propio modulo'
);

assert(
  !/function\s+ensureLivingEditorModal\s*\(/.test(
    appSource
  ),
  'Living Editor no debe duplicarse'
);

assert(
  appSource.includes(
    'ROOMS_LIVING_EDITOR_FEATURE?.create'
  ),
  'Living Editor debe estar integrado'
);

assert(
  htmlSource.indexOf(
    'assets/js/features/living-editor.js'
  ) <
  htmlSource.indexOf(
    'assets/js/supabase-app.js'
  ),
  'Living Editor debe cargar antes de supabase-app.js'
);

assert(
  appSource.includes(
    'await uploadProfilePhoto('
  ),
  'Onboarding debe seguir consumiendo uploadProfilePhoto'
);

ok(
  'Editor extraído sin arrastrar Living y onboarding sigue conectado'
);


console.log(
  '\n=== PROFILE EDITOR · DOM ==='
);

const dom =
  new JSDOM(
    `<!doctype html>
    <html>
      <body>

        <button id="editOwnProfile">
          Editar
        </button>

        <button id="changeProfilePhoto">
          Foto
        </button>

        <input
          id="ownProfilePhotoInput"
          type="file"
        >

      </body>
    </html>`,
    {
      runScripts:
        'outside-only',

      url:
        'http://127.0.0.1/'
    }
  );

const { window } = dom;

window.eval(
  featureSource
);

assert(
  window.ROOMS_PROFILE_EDITOR_FEATURE?.create,
  'Profile Editor no expone factory'
);

ok(
  'Factory disponible'
);


console.log(
  '\n=== PROFILE EDITOR · FIXTURES ==='
);

const state = {
  user: {
    id:
      'user-me'
  },

  profile: {
    id:
      'user-me',

    name:
      'Claudia',

    alias:
      'Clau',

    age:
      29,

    bio:
      'Bio original',

    interests: [
      'music',
      'travel'
    ],

    avatar_url:
      null
  },

  profiles:
    new Map(),

  preferences: {
    answers: {}
  }
};

const notifications =
  [];

const ownProfileUpdates =
  [];

let profileUpdatePayload =
  null;

let profileUpdateResult = {
  id:
    'user-me',

  name:
    'Clau nueva',

  alias:
    'Clau nueva',

  age:
    30,

  bio:
    'Bio nueva',

  interests: [
    'music',
    'pets'
  ],

  avatar_url:
    null
};

let profileUpdateError =
  null;

let uploadedPath =
  null;

let uploadedOptions =
  null;

let uploadError =
  null;

const db = {
  from(table) {
    assert(
      table === 'profiles',
      `Tabla inesperada: ${table}`
    );

    return {
      update(payload) {
        profileUpdatePayload =
          payload;

        return {
          eq(column, value) {
            assert(
              column === 'id',
              'La actualización debe filtrar por id'
            );

            assert(
              value === state.user.id,
              'Debe actualizar el usuario autenticado'
            );

            return {
              select() {
                return {
                  async single() {
                    return {
                      data:
                        profileUpdateResult,

                      error:
                        profileUpdateError
                    };
                  }
                };
              }
            };
          }
        };
      }
    };
  },

  storage: {
    from(bucket) {
      assert(
        bucket === 'avatars',
        `Bucket inesperado: ${bucket}`
      );

      return {
        async upload(
          path,
          file,
          options
        ) {
          uploadedPath =
            path;

          uploadedOptions =
            options;

          return {
            error:
              uploadError
          };
        },

        getPublicUrl(path) {
          return {
            data: {
              publicUrl:
                `https://cdn.example.com/${path}`
            }
          };
        }
      };
    }
  }
};

const feature =
  window
    .ROOMS_PROFILE_EDITOR_FEATURE
    .create({
      db,
      state,

      notify(message) {
        notifications.push(
          message
        );
      },

      updateOwnProfile(
        profile,
        preferences
      ) {
        ownProfileUpdates.push({
          profile,
          preferences
        });
      }
    });

assert(
  feature?.openProfileEditor,
  'Falta openProfileEditor'
);

assert(
  feature?.uploadProfilePhoto,
  'Falta uploadProfilePhoto'
);

ok(
  'Feature creada'
);


console.log(
  '\n=== PROFILE EDITOR · OPEN ==='
);

feature.openProfileEditor();

const modal =
  window.document.querySelector(
    '#profileEditorModal'
  );

assert(
  modal,
  'No se crea profileEditorModal'
);

assert(
  modal.classList.contains(
    'open'
  ),
  'Editor no se abre'
);

assert(
  modal.getAttribute(
    'aria-hidden'
  ) === 'false',
  'aria-hidden incorrecto al abrir'
);

assert(
  modal.querySelector(
    '#editProfileName'
  ).value ===
    'Clau',
  'No carga alias'
);

assert(
  modal.querySelector(
    '#editProfileAge'
  ).value ===
    '29',
  'No carga edad'
);

assert(
  modal.querySelector(
    '#editProfileBio'
  ).value ===
    'Bio original',
  'No carga bio'
);

assert(
  modal.querySelector(
    '[data-edit-interest="music"]'
  ).classList.contains(
    'active'
  ),
  'Interés music debería estar activo'
);

assert(
  modal.querySelector(
    '[data-edit-interest="travel"]'
  ).classList.contains(
    'active'
  ),
  'Interés travel debería estar activo'
);

ok(
  'Editor carga perfil actual'
);


console.log(
  '\n=== PROFILE EDITOR · INTERESES ==='
);

const petsButton =
  modal.querySelector(
    '[data-edit-interest="pets"]'
  );

petsButton.click();

assert(
  petsButton.classList.contains(
    'active'
  ),
  'Click debe activar interés'
);

assert(
  petsButton.getAttribute(
    'aria-pressed'
  ) === 'true',
  'aria-pressed de interés incorrecto'
);

ok(
  'Intereses interactivos'
);


console.log(
  '\n=== PROFILE EDITOR · GUARDAR ==='
);

modal.querySelector(
  '#editProfileName'
).value =
  'Clau nueva';

modal.querySelector(
  '#editProfileAge'
).value =
  '30';

modal.querySelector(
  '#editProfileBio'
).value =
  'Bio nueva';

modal.querySelector(
  '[data-edit-interest="travel"]'
).click();

const form =
  modal.querySelector(
    '#profileEditorForm'
  );

form.dispatchEvent(
  new window.Event(
    'submit',
    {
      bubbles: true,
      cancelable: true
    }
  )
);

await new Promise(
  resolve =>
    setTimeout(resolve, 0)
);

assert(
  profileUpdatePayload?.name ===
    'Clau nueva',
  'Nombre actualizado incorrecto'
);

assert(
  profileUpdatePayload?.alias ===
    'Clau nueva',
  'Alias actualizado incorrecto'
);

assert(
  profileUpdatePayload?.age ===
    30,
  'Edad actualizada incorrecta'
);

assert(
  profileUpdatePayload?.bio ===
    'Bio nueva',
  'Bio actualizada incorrecta'
);

assert(
  profileUpdatePayload
    ?.interests
    ?.includes(
      'music'
    ),
  'Debe conservar music'
);

assert(
  profileUpdatePayload
    ?.interests
    ?.includes(
      'pets'
    ),
  'Debe guardar pets'
);

assert(
  !profileUpdatePayload
    ?.interests
    ?.includes(
      'travel'
    ),
  'Travel debería haberse desactivado'
);

assert(
  state.profile ===
    profileUpdateResult,
  'state.profile no se actualiza'
);

assert(
  state.profiles.get(
    'user-me'
  ) ===
    profileUpdateResult,
  'state.profiles no se actualiza'
);

assert(
  ownProfileUpdates.length ===
    1,
  'Debe refrescar perfil propio'
);

assert(
  notifications.includes(
    'Perfil actualizado'
  ),
  'Falta notificación de guardado'
);

assert(
  !modal.classList.contains(
    'open'
  ),
  'Modal debe cerrarse tras guardar'
);

ok(
  'Guardado del perfil correcto'
);


console.log(
  '\n=== PROFILE EDITOR · VALIDACION FOTO ==='
);

const invalidType =
  new window.File(
    ['x'],
    'avatar.gif',
    {
      type:
        'image/gif'
    }
  );

const invalidTypeResult =
  await feature.uploadProfilePhoto(
    invalidType
  );

assert(
  invalidTypeResult ===
    false,
  'Formato inválido debe fallar'
);

assert(
  notifications.includes(
    'Usa una imagen JPG, PNG o WEBP'
  ),
  'Falta aviso de formato'
);

const tooLarge =
  new window.File(
    [
      new Uint8Array(
        5 * 1024 * 1024 + 1
      )
    ],
    'avatar.jpg',
    {
      type:
        'image/jpeg'
    }
  );

const tooLargeResult =
  await feature.uploadProfilePhoto(
    tooLarge
  );

assert(
  tooLargeResult ===
    false,
  'Foto >5MB debe fallar'
);

assert(
  notifications.includes(
    'La foto debe pesar menos de 5 MB'
  ),
  'Falta aviso de tamaño'
);

ok(
  'Validación de foto correcta'
);


console.log(
  '\n=== PROFILE EDITOR · SUBIDA FOTO ==='
);

const validFile =
  new window.File(
    ['avatar-data'],
    'avatar.webp',
    {
      type:
        'image/webp'
    }
  );

profileUpdateResult = {
  ...state.profile,

  avatar_url:
    'https://cdn.example.com/user-me/avatar.webp?v=test'
};

const photoResult =
  await feature.uploadProfilePhoto(
    validFile
  );

assert(
  uploadedPath ===
    'user-me/avatar.webp',
  `Ruta de avatar incorrecta: ${uploadedPath}`
);

assert(
  uploadedOptions?.upsert ===
    true,
  'Upload debe usar upsert'
);

assert(
  uploadedOptions?.contentType ===
    'image/webp',
  'contentType incorrecto'
);

assert(
  profileUpdatePayload?.avatar_url?.startsWith(
    'https://cdn.example.com/user-me/avatar.webp?v='
  ),
  'URL pública del avatar incorrecta'
);

assert(
  photoResult ===
    profileUpdateResult,
  'uploadProfilePhoto debe devolver perfil actualizado'
);

assert(
  notifications.includes(
    'Foto de perfil actualizada'
  ),
  'Falta notificación de foto'
);

ok(
  'Subida de foto correcta'
);


console.log(
  '\n=== PROFILE EDITOR · SILENT ==='
);

const notificationsBeforeSilent =
  notifications.length;

const silentBadFile =
  new window.File(
    ['x'],
    'avatar.txt',
    {
      type:
        'text/plain'
    }
  );

const silentResult =
  await feature.uploadProfilePhoto(
    silentBadFile,
    {
      silent:
        true
    }
  );

assert(
  silentResult ===
    false,
  'Archivo inválido silent debe fallar'
);

assert(
  notifications.length ===
    notificationsBeforeSilent,
  'Silent no debe notificar validación'
);

ok(
  'Modo silent correcto'
);


console.log(
  '\n=== PROFILE EDITOR · SIN USUARIO ==='
);

const previousUser =
  state.user;

state.user =
  null;

const noUserResult =
  await feature.uploadProfilePhoto(
    validFile
  );

assert(
  noUserResult ===
    false,
  'Sin usuario debe devolver false'
);

state.user =
  previousUser;

ok(
  'Sin usuario no sube foto'
);


console.log(
  '\nROOMS PROFILE EDITOR FEATURE OK'
);
