import fs from 'node:fs';

function assert(
  condition,
  message
) {
  if (!condition) {
    throw new Error(
      message
    );
  }
}

function ok(message) {
  console.log(
    `OK  ${message}`
  );
}

const dir =
  'supabase/migrations';

const files =
  fs.readdirSync(dir)
    .filter(
      file =>
        file.endsWith('.sql')
    )
    .sort();

console.log(
  '\n=== MIGRATION ORDER ==='
);

files.forEach(
  file =>
    console.log(file)
);

assert(
  files[0] ===
    '20260901_initial_schema.sql',
  'El baseline no es la primera migración'
);

ok(
  'Baseline primero'
);

const harden =
  fs.readFileSync(
    `${dir}/20261007_harden_rpc_permissions.sql`,
    'utf8'
  );

const restore =
  fs.readFileSync(
    `${dir}/20261007_restore_core_rpcs.sql`,
    'utf8'
  );

assert(
  !/get_visible_profiles/i.test(
    harden
  ),
  'harden referencia get_visible_profiles antes de crearla'
);

ok(
  'harden no toca get_visible_profiles'
);

assert(
  /create\s+or\s+replace\s+function\s+public\.get_visible_profiles\s*\(/i.test(
    restore
  ),
  'restore no crea get_visible_profiles'
);

ok(
  'restore crea get_visible_profiles'
);

assert(
  /revoke[\s\S]{0,250}get_visible_profiles/i.test(
    restore
  ),
  'restore no revoca permisos de get_visible_profiles'
);

assert(
  /grant[\s\S]{0,250}get_visible_profiles/i.test(
    restore
  ),
  'restore no concede permisos de get_visible_profiles'
);

ok(
  'restore gestiona permisos de get_visible_profiles'
);

const baseline =
  fs.readFileSync(
    `${dir}/20260901_initial_schema.sql`,
    'utf8'
  );

const tables =
  (
    baseline.match(
      /^create table if not exists public\./gmi
    ) || []
  ).length;

const rls =
  (
    baseline.match(
      /^alter table public\..* enable row level security;/gmi
    ) || []
  ).length;

const policies =
  (
    baseline.match(
      /^create policy /gmi
    ) || []
  ).length;

const triggers =
  (
    baseline.match(
      /^create trigger /gmi
    ) || []
  ).length;

assert(
  tables === 27,
  `Tablas inesperadas: ${tables}`
);

assert(
  rls === 27,
  `RLS inesperado: ${rls}`
);

assert(
  policies === 106,
  `Policies inesperadas: ${policies}`
);

assert(
  triggers === 8,
  `Triggers inesperados: ${triggers}`
);

ok(
  'Baseline mantiene estructura esperada'
);

console.log(
  '\nROOMS MIGRATION ORDER OK'
);
