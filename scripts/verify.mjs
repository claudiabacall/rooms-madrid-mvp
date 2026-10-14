import fs from 'node:fs';
import { execFileSync, execSync } from 'node:child_process';

const ROOT = process.cwd();

const files = {
  html: 'index.html',
  app: 'assets/js/app.js',
  supabase: 'assets/js/supabase-app.js',
  saved: 'assets/js/features/saved.js',
  moderation: 'assets/js/features/moderation.js',
  connections: 'assets/js/features/connections.js',
  messaging: 'assets/js/features/messaging.js',
  sessions: 'assets/js/features/sessions.js',
  listings: 'assets/js/features/listings.js',
  matching: 'assets/js/features/matching.js',
  profiles: 'assets/js/features/profiles.js',
  profileEditor: 'assets/js/features/profile-editor.js',
  ownProfile: 'assets/js/features/own-profile.js',
  profilePrivacy: 'assets/js/features/profile-privacy.js',
  accountSettings: 'assets/js/features/account-settings.js',
  exploreView: 'assets/js/features/explore-view.js',
  exploreFilters: 'assets/js/features/explore-filters.js',
  exploreController: 'assets/js/features/explore-controller.js',
  householdGroupPicker: 'assets/js/features/household-group-picker.js',
  householdInvites: 'assets/js/features/household-invites.js',
  householdCandidates: 'assets/js/features/household-candidates.js',
  householdCreate: 'assets/js/features/household-create.js',
  householdCore: 'assets/js/features/household-core.js',
  householdEvents: 'assets/js/features/household-events.js',
  communityManagement: 'assets/js/features/community-management.js',
  communityMembership: 'assets/js/features/community-membership.js',
  communityCreate: 'assets/js/features/community-create.js',
  communityInteractions: 'assets/js/features/community-interactions.js',
  communityPosts: 'assets/js/features/community-posts.js',
  communityDetailCore: 'assets/js/features/community-detail-core.js',
  communityDetailRender: 'assets/js/features/community-detail-render.js',
  listingPhotos: 'assets/js/features/listing-photos.js',
  listingEditor: 'assets/js/features/listing-editor.js',
  listingDelete: 'assets/js/features/listing-delete.js',
  publishMedia: 'assets/js/features/publish-media.js',
  publishSteps: 'assets/js/features/publish-steps.js',
  publishCommunityFields: 'assets/js/features/publish-community-fields.js',
  publishComposer: 'assets/js/features/publish-composer.js',
  publishGeocoding: 'assets/js/features/publish-geocoding.js',
  publishSubmit: 'assets/js/features/publish-submit.js',
  feedListingCard: 'assets/js/features/feed-listing-card.js',
  feedPersonCard: 'assets/js/features/feed-person-card.js',
  feedPostCard: 'assets/js/features/feed-post-card.js',
  feedCommunityCard: 'assets/js/features/feed-community-card.js',
  feedCore: 'assets/js/features/feed-core.js',
  exploreCommunities: 'assets/js/features/explore-communities.js',
  explorePeople: 'assets/js/features/explore-people.js',
  exploreMapCard: 'assets/js/features/explore-map-card.js',
  css: 'assets/css/feed.css'
};

let failures = 0;
let warnings = 0;

function title(text) {
  console.log(`\n=== ${text} ===`);
}

function ok(text) {
  console.log(`OK  ${text}`);
}

function fail(text) {
  failures += 1;
  console.error(`FAIL ${text}`);
}

function warn(text) {
  warnings += 1;
  console.warn(`WARN ${text}`);
}

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

title('ARCHIVOS NECESARIOS');

for (const file of Object.values(files)) {
  if (fs.existsSync(file)) {
    ok(file);
  } else {
    fail(`Falta ${file}`);
  }
}

title('SINTAXIS JAVASCRIPT');

for (const file of [
  files.app,
  files.supabase,
  files.saved,
  files.moderation,
  files.connections,
  files.messaging,
  files.sessions,
  files.listings,
  files.matching,
  files.profiles,
  files.profileEditor,
  files.ownProfile,
  files.profilePrivacy,
  files.accountSettings,
  files.exploreView,
  files.exploreFilters,
  files.exploreController,
  files.householdGroupPicker,
  files.householdInvites,
  files.householdCandidates,
  files.householdEvents,
  files.communityManagement,
  files.communityMembership,
  files.communityCreate,
  files.communityInteractions,
  files.communityPosts,
  files.communityDetailCore,
  files.communityDetailRender,
  files.listingPhotos,
  files.listingEditor,
  files.listingDelete,
  files.publishMedia,
  files.publishSteps,
  files.publishCommunityFields,
  files.publishComposer,
  files.publishGeocoding,
  files.publishSubmit,
  files.householdCore,
  files.householdCreate,
  files.feedPersonCard,
  files.feedPostCard,
  files.feedCommunityCard,
  files.feedCore,
  files.exploreCommunities,
  files.explorePeople,
  files.exploreMapCard,
  files.feedListingCard
]) {
  if (!fs.existsSync(file)) continue;

  try {
    execFileSync(
      process.execPath,
      ['--check', file],
      { stdio: 'pipe' }
    );
    ok(file);
  } catch (error) {
    fail(`Error de sintaxis en ${file}`);
    console.error(
      error.stderr?.toString() ||
      error.message
    );
  }
}

title('GIT DIFF');

try {
  execSync(
    'git diff --check',
    { stdio: 'pipe' }
  );
  ok('git diff --check');
} catch (error) {
  fail('git diff --check');
  console.error(
    error.stdout?.toString() ||
    error.stderr?.toString() ||
    error.message
  );
}

title('IDS HTML DUPLICADOS');

if (fs.existsSync(files.html)) {
  const html = read(files.html);

  const ids = [
    ...html.matchAll(/\bid=["']([^"']+)["']/g)
  ].map(match => match[1]);

  const counts = new Map();

  ids.forEach(id => {
    counts.set(
      id,
      (counts.get(id) || 0) + 1
    );
  });

  const duplicates = [
    ...counts.entries()
  ].filter(([, count]) => count > 1);

  if (!duplicates.length) {
    ok('No hay IDs duplicados en index.html');
  } else {
    duplicates.forEach(([id, count]) => {
      fail(
        `ID duplicado "${id}" (${count} veces)`
      );
    });
  }
}

title('REFERENCIAS #ID EN JAVASCRIPT');

if (
  fs.existsSync(files.html) &&
  fs.existsSync(files.app) &&
  fs.existsSync(files.supabase)
) {
  const html = read(files.html);

  const js =
    [
      read(files.app),
      read(files.supabase),
      read(files.saved),
      read(files.moderation),
      read(files.connections),
      read(files.messaging),
      read(files.sessions),
      read(files.listings),
      read(files.matching),
      read(files.profiles),
      read(files.profileEditor),
      read(files.ownProfile),
      read(files.profilePrivacy),
      read(files.accountSettings),
      read(files.exploreView),
      read(files.exploreFilters),
      read(files.exploreController),
      read(files.householdGroupPicker),
      read(files.householdInvites),
      read(files.householdCandidates)
    ].join('\n');

  const declaredIds = new Set([
    ...[
      ...html.matchAll(
        /\bid=["']([^"']+)["']/g
      )
    ].map(match => match[1]),

    ...[
      ...js.matchAll(
        /\bid=["']([^"']+)["']/g
      )
    ].map(match => match[1]),

    ...[
      ...js.matchAll(
        /\.id\s*=\s*['"]([^"']+)['"]/g
      )
    ].map(match => match[1]),

    ...[
      ...js.matchAll(
        /setAttribute\(\s*['"]id['"]\s*,\s*['"]([^"']+)['"]\s*\)/g
      )
    ].map(match => match[1])
  ]);

  const referencedIds = new Set(
    [
      ...js.matchAll(
        /querySelector(?:All)?\(\s*['"]#([A-Za-z0-9_-]+)['"]/g
      )
    ].map(match => match[1])
  );

  const missing = [
    ...referencedIds
  ].filter(id => !declaredIds.has(id));

  if (!missing.length) {
    ok(
      'Todos los #id consultados tienen una declaración detectable'
    );
  } else {
    console.log(
      `INFO ${missing.length} #id no tienen declaración estática detectable; revisar solo si aparece un problema funcional`
    );

    missing
      .sort()
      .forEach(id =>
        console.log(`     #${id}`)
      );
  }
}

title('MARCADORES DE DESARROLLO');

const scanFiles = [
  files.html,
  files.app,
  files.supabase,
  files.css
];

const developmentMarkers = [
  /\b(?:TODO|FIXME|HACK)\b/g,
  /\b(?:mock|fake|demo|simulad[oa]s?)\b/gi
];

let suspiciousFound = 0;

for (const file of scanFiles) {
  if (!fs.existsSync(file)) continue;

  const lines = read(file).split('\n');

  lines.forEach((line, index) => {
    const found =
      developmentMarkers.some(regex => {
        regex.lastIndex = 0;
        return regex.test(line);
      });

    developmentMarkers.forEach(regex => {
      regex.lastIndex = 0;
    });

    if (found) {
      suspiciousFound += 1;
      console.log(
        `${file}:${index + 1}: ${line.trim()}`
      );
    }
  });
}

if (!suspiciousFound) {
  ok(
    'No aparecen TODO/FIXME/mock/fake/demo/simulado'
  );
} else {
  warn(
    `${suspiciousFound} marcador(es) requieren revisión manual`
  );
}

title('FUNCIONES FUTURAS / PROXIMAMENTE');

let futureCount = 0;

for (const file of [
  files.html,
  files.app,
  files.supabase
]) {
  if (!fs.existsSync(file)) continue;

  const lines = read(file).split('\n');

  lines.forEach((line, index) => {
    if (/pr[oó]ximamente/i.test(line)) {
      futureCount += 1;
      console.log(
        `${file}:${index + 1}: ${line.trim()}`
      );
    }
  });
}

console.log(
  `INFO ${futureCount} referencia(s) a funciones futuras`
);

title('FALLBACKS SOSPECHOSOS');

const fallbackPatterns = [
  {
    name: 'Madrid como fallback',
    regex:
      /\|\|\s*['"]Madrid['"]|:\s*['"]Madrid['"]/g
  },
  {
    name: '0 euros visible',
    regex:
      /(?<![\d.])0\s*€(?!\d)|\|\|\s*0(?=[^;\n]{0,20}€)|\?\?\s*0(?=[^;\n]{0,20}€)/g
  },
  {
    name: 'Perfil nuevo',
    regex:
      /PERFIL NUEVO/g
  },
  {
    name: 'Aprendizaje automático por uso',
    regex:
      /mejor te conoceremos/gi
  }
];

for (const rule of fallbackPatterns) {
  let found = [];

  for (const file of [
    files.html,
    files.app,
    files.supabase
  ]) {
    if (!fs.existsSync(file)) continue;

    const lines = read(file).split('\n');

    lines.forEach((line, index) => {
      rule.regex.lastIndex = 0;

      if (rule.regex.test(line)) {
        found.push(
          `${file}:${index + 1}: ${line.trim()}`
        );
      }
    });
  }

  if (!found.length) {
    ok(rule.name);
  } else {
    warn(rule.name);
    found.forEach(line =>
      console.log(`     ${line}`)
    );
  }
}

title('ESTADO GIT');

try {
  const status =
    execSync(
      'git status --short',
      { encoding: 'utf8' }
    ).trim();

  if (status) {
    console.log(status);
    warn(
      'Hay cambios todavía sin commit'
    );
  } else {
    ok('Working tree limpio');
  }
} catch (error) {
  warn('No se pudo consultar git status');
}

title('SERVIDOR LOCAL');

try {
  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () => controller.abort(),
      1500
    );

  const response =
    await fetch(
      'http://127.0.0.1:4173/',
      {
        signal: controller.signal
      }
    );

  clearTimeout(timeout);

  if (response.ok) {
    ok(
      `http://127.0.0.1:4173/ responde ${response.status}`
    );
  } else {
    warn(
      `Servidor local responde ${response.status}`
    );
  }
} catch {
  warn(
    'Servidor local no está levantado; ejecuta npm start para incluir esta comprobación'
  );
}

title('BOTONES ESTATICOS');

if (
  fs.existsSync(files.html) &&
  fs.existsSync(files.app) &&
  fs.existsSync(files.supabase)
) {
  const html = read(files.html);

  const js =
    [
      read(files.app),
      read(files.supabase),
      read(files.saved),
      read(files.moderation),
      read(files.connections),
      read(files.messaging),
      read(files.sessions),
      read(files.listings),
      read(files.matching),
      read(files.profiles),
      read(files.profileEditor),
      read(files.ownProfile),
      read(files.profilePrivacy),
      read(files.accountSettings),
      read(files.exploreView),
      read(files.exploreFilters),
      read(files.exploreController),
      read(files.householdGroupPicker),
      read(files.householdInvites),
      read(files.householdCandidates)
    ].join('\n');

  const buttons = [
    ...html.matchAll(/<button\b([^>]*)>/gi)
  ];

  const unresolved = [];

  for (const match of buttons) {
    const attrs = match[1];

    if (
      /\bdisabled\b/i.test(attrs) ||
      /aria-disabled=["']true["']/i.test(attrs)
    ) {
      continue;
    }

    const id =
      attrs.match(/\bid=["']([^"']+)["']/i)?.[1];

    const dataAttrs = [
      ...attrs.matchAll(
        /\b(data-[a-z0-9_-]+)(?:=["']([^"']*)["'])?/gi
      )
    ];

    const hooks = [];

    if (id) {
      hooks.push(
        `#${id}`,
        `'${id}'`,
        `"${id}"`
      );
    }

    for (const item of dataAttrs) {
      const attr = item[1];

      const camel =
        attr
          .slice(5)
          .replace(
            /-([a-z])/g,
            (_, c) => c.toUpperCase()
          );

      hooks.push(
        attr,
        camel,
        `[${attr}]`
      );
    }

    if (!hooks.length) continue;

    const connected =
      hooks.some(hook =>
        js.includes(hook)
      );

    if (!connected) {
      unresolved.push(
        `index.html:${html.slice(0, match.index).split('\n').length} ${match[0].replace(/\s+/g, ' ').slice(0, 180)}`
      );
    }
  }

  if (!unresolved.length) {
    ok(
      'No se detectan botones estáticos con hook huérfano'
    );
  } else {
    unresolved.forEach(item =>
      console.log(item)
    );

    fail(
      `${unresolved.length} botón(es) estático(s) sin conexión JS detectable`
    );
  }
}


title('FORMULARIOS Y CONTROLES ESTATICOS');

if (
  fs.existsSync(files.html) &&
  fs.existsSync(files.app) &&
  fs.existsSync(files.supabase)
) {
  const html = read(files.html);

  const js =
    [
      read(files.app),
      read(files.supabase),
      read(files.saved),
      read(files.moderation),
      read(files.connections),
      read(files.messaging),
      read(files.sessions),
      read(files.listings),
      read(files.matching),
      read(files.profiles),
      read(files.profileEditor),
      read(files.ownProfile),
      read(files.profilePrivacy),
      read(files.accountSettings),
      read(files.exploreView),
      read(files.exploreFilters),
      read(files.exploreController),
      read(files.householdGroupPicker),
      read(files.householdInvites),
      read(files.householdCandidates)
    ].join('\n');

  const issues = [];

  const forms = [
    ...html.matchAll(/<form\b([^>]*)>/gi)
  ];

  for (const match of forms) {
    const attrs = match[1];

    const id =
      attrs.match(/\bid=["']([^"']+)["']/i)?.[1];

    if (!id) {
      issues.push(
        `index.html:${html.slice(0, match.index).split('\n').length} form sin id`
      );
      continue;
    }

    const connected =
      js.includes(`#${id}`) ||
      js.includes(`'${id}'`) ||
      js.includes(`"${id}"`);

    if (!connected) {
      issues.push(
        `index.html:${html.slice(0, match.index).split('\n').length} #${id}`
      );
    }
  }

  const controls = [
    ...html.matchAll(
      /<(input|textarea|select)\b([^>]*)>/gi
    )
  ];

  for (const match of controls) {
    const attrs = match[2];

    if (
      /\bdisabled\b/i.test(attrs) ||
      /type=["']hidden["']/i.test(attrs)
    ) {
      continue;
    }

    const id =
      attrs.match(/\bid=["']([^"']+)["']/i)?.[1];

    const name =
      attrs.match(/\bname=["']([^"']+)["']/i)?.[1];

    const dataAttrs = [
      ...attrs.matchAll(
        /\b(data-[a-z0-9_-]+)(?:=["']([^"']*)["'])?/gi
      )
    ];

    const hooks = [];

    if (id) {
      hooks.push(
        `#${id}`,
        `'${id}'`,
        `"${id}"`
      );
    }

    if (name) {
      hooks.push(
        name,
        `[name="${name}"]`,
        `[name='${name}']`
      );
    }

    for (const item of dataAttrs) {
      const attr = item[1];

      const camel =
        attr
          .slice(5)
          .replace(
            /-([a-z])/g,
            (_, c) => c.toUpperCase()
          );

      hooks.push(
        attr,
        camel,
        `[${attr}]`
      );
    }

    if (!hooks.length) continue;

    const connected =
      hooks.some(hook =>
        js.includes(hook)
      );

    if (!connected) {
      issues.push(
        `index.html:${html.slice(0, match.index).split('\n').length} ${match[1]} ${id ? `#${id}` : ''}`.trim()
      );
    }
  }

  if (!issues.length) {
    ok(
      'No se detectan formularios o controles estáticos huérfanos'
    );
  } else {
    issues.forEach(item =>
      console.log(item)
    );

    fail(
      `${issues.length} formulario(s) o control(es) sin conexión JS detectable`
    );
  }
}



title('BOTONES DINAMICOS');

if (
  fs.existsSync(files.app) &&
  fs.existsSync(files.supabase)
) {
  const sources = [
    {
      file: files.app,
      text: read(files.app)
    },
    {
      file: files.supabase,
      text: read(files.supabase)
    }
  ];

  const allJs =
    [
    fs.existsSync(files.exploreMapCard)
      ? read(files.exploreMapCard)
      : '',

    fs.existsSync(files.explorePeople)
      ? read(files.explorePeople)
      : '',

    fs.existsSync(files.exploreCommunities)
      ? read(files.exploreCommunities)
      : '',

    fs.existsSync(files.feedCore)
      ? read(files.feedCore)
      : '',

    fs.existsSync(files.feedCommunityCard)
      ? read(files.feedCommunityCard)
      : '',

    fs.existsSync(files.feedPostCard)
      ? read(files.feedPostCard)
      : '',

    fs.existsSync(files.feedPersonCard)
      ? read(files.feedPersonCard)
      : '',

    fs.existsSync(files.feedListingCard)
      ? read(files.feedListingCard)
      : '',

      ...sources.map(item => item.text),
      fs.existsSync(files.exploreView)
        ? read(files.exploreView)
        : '',
      fs.existsSync(files.exploreFilters)
        ? read(files.exploreFilters)
        : '',
      fs.existsSync(files.exploreController)
        ? read(files.exploreController)
        : '',
      fs.existsSync(files.householdGroupPicker)
        ? read(files.householdGroupPicker)
        : '',
      fs.existsSync(files.householdInvites)
        ? read(files.householdInvites)
        : '',
      fs.existsSync(files.householdCandidates)
        ? read(files.householdCandidates)
        : '',
      fs.existsSync(files.householdEvents)
        ? read(files.householdEvents)
        : ''
    ].join('\n');

  const issues = [];

  for (const source of sources) {
    const buttonRegex =
      /<button\b([\s\S]*?)>/gi;

    let match;

    while ((match = buttonRegex.exec(source.text))) {
      const full = match[0];
      const attrs = match[1];

      if (
        /\bdisabled\b/i.test(attrs) ||
        /aria-disabled=["']true["']/i.test(attrs)
      ) {
        continue;
      }

      const hooks = [];

      const id =
        attrs.match(
          /\bid=["']([^"'${}]+)["']/i
        )?.[1];

      if (id) {
        hooks.push({
          type: 'id',
          raw: id
        });
      }

      for (
        const dataMatch of attrs.matchAll(
          /\b(data-[a-z0-9_-]+)(?:=["'][^"']*["'])?/gi
        )
      ) {
        hooks.push({
          type: 'data',
          raw: dataMatch[1]
        });
      }

      if (!hooks.length) continue;

      const withoutCurrent =
        allJs.replace(full, '');

      const connected =
        hooks.some(hook => {
          if (hook.type === 'id') {
            return (
              withoutCurrent.includes(`#${hook.raw}`) ||
              withoutCurrent.includes(`'${hook.raw}'`) ||
              withoutCurrent.includes(`"${hook.raw}"`)
            );
          }

          const camel =
            hook.raw
              .slice(5)
              .replace(
                /-([a-z])/g,
                (_, c) => c.toUpperCase()
              );

          return (
            withoutCurrent.includes(`[${hook.raw}]`) ||
            withoutCurrent.includes(hook.raw) ||
            withoutCurrent.includes(`dataset.${camel}`)
          );
        });

      if (!connected) {
        issues.push(
          `${source.file}:${source.text.slice(0, match.index).split('\n').length}`
        );
      }
    }
  }

  if (!issues.length) {
    ok(
      'No se detectan botones dinámicos con hook huérfano'
    );
  } else {
    issues.forEach(item =>
      console.log(item)
    );

    fail(
      `${issues.length} botón(es) dinámico(s) sin conexión JS detectable`
    );
  }
}


title('CONTROLES DINAMICOS');

if (
  fs.existsSync(files.app) &&
  fs.existsSync(files.supabase)
) {
  const sources = [
    {
      file: files.app,
      text: read(files.app)
    },
    {
      file: files.supabase,
      text: read(files.supabase)
    }
  ];

  const allJs =
    [
    fs.existsSync(files.exploreMapCard)
      ? read(files.exploreMapCard)
      : '',

    fs.existsSync(files.explorePeople)
      ? read(files.explorePeople)
      : '',

    fs.existsSync(files.exploreCommunities)
      ? read(files.exploreCommunities)
      : '',

    fs.existsSync(files.feedCore)
      ? read(files.feedCore)
      : '',

    fs.existsSync(files.feedCommunityCard)
      ? read(files.feedCommunityCard)
      : '',

    fs.existsSync(files.feedPostCard)
      ? read(files.feedPostCard)
      : '',

    fs.existsSync(files.feedPersonCard)
      ? read(files.feedPersonCard)
      : '',

    fs.existsSync(files.feedListingCard)
      ? read(files.feedListingCard)
      : '',

    fs.existsSync(files.publishSteps)
      ? read(files.publishSteps)
      : '',
    fs.existsSync(files.publishCommunityFields)
      ? read(files.publishCommunityFields)
      : '',
    fs.existsSync(files.publishComposer)
      ? read(files.publishComposer)
      : '',
    fs.existsSync(files.publishGeocoding)
      ? read(files.publishGeocoding)
      : '',

      ...sources.map(item => item.text),
      fs.existsSync(files.exploreView)
        ? read(files.exploreView)
        : '',
      fs.existsSync(files.exploreFilters)
        ? read(files.exploreFilters)
        : '',
      fs.existsSync(files.exploreController)
        ? read(files.exploreController)
        : '',
      fs.existsSync(files.householdGroupPicker)
        ? read(files.householdGroupPicker)
        : '',
      fs.existsSync(files.householdInvites)
        ? read(files.householdInvites)
        : '',
      fs.existsSync(files.householdCandidates)
        ? read(files.householdCandidates)
        : ''
    ].join('\n');

  const issues = [];

  for (const source of sources) {
    const controlRegex =
      /<(form|input|textarea|select)\b([\s\S]*?)>/gi;

    let match;

    while ((match = controlRegex.exec(source.text))) {
      const attrs = match[2];
      const full = match[0];

      if (
        /\bdisabled\b/i.test(attrs) ||
        /type=["']hidden["']/i.test(attrs)
      ) {
        continue;
      }

      const hooks = [];

      const id =
        attrs.match(
          /\bid=["']([^"'${}]+)["']/i
        )?.[1];

      const name =
        attrs.match(
          /\bname=["']([^"'${}]+)["']/i
        )?.[1];

      if (id) {
        hooks.push({
          type: 'id',
          raw: id
        });
      }

      if (name) {
        hooks.push({
          type: 'name',
          raw: name
        });
      }

      for (
        const dataMatch of attrs.matchAll(
          /\b(data-[a-z0-9_-]+)(?:=["'][^"']*["'])?/gi
        )
      ) {
        hooks.push({
          type: 'data',
          raw: dataMatch[1]
        });
      }

      if (!hooks.length) continue;

      const withoutCurrent =
        allJs.replace(full, '');

      const connected =
        hooks.some(hook => {
          if (hook.type === 'id') {
            return (
              withoutCurrent.includes(`#${hook.raw}`) ||
              withoutCurrent.includes(`'${hook.raw}'`) ||
              withoutCurrent.includes(`"${hook.raw}"`)
            );
          }

          if (hook.type === 'name') {
            return (
              withoutCurrent.includes(hook.raw) ||
              withoutCurrent.includes(
                `[name="${hook.raw}"]`
              ) ||
              withoutCurrent.includes(
                `[name='${hook.raw}']`
              )
            );
          }

          const camel =
            hook.raw
              .slice(5)
              .replace(
                /-([a-z])/g,
                (_, c) => c.toUpperCase()
              );

          return (
            withoutCurrent.includes(`[${hook.raw}]`) ||
            withoutCurrent.includes(hook.raw) ||
            withoutCurrent.includes(`dataset.${camel}`)
          );
        });

      if (!connected) {
        issues.push(
          `${source.file}:${source.text.slice(0, match.index).split('\n').length}`
        );
      }
    }
  }

  if (!issues.length) {
    ok(
      'No se detectan controles dinámicos con hook huérfano'
    );
  } else {
    issues.forEach(item =>
      console.log(item)
    );

    fail(
      `${issues.length} control(es) dinámico(s) sin conexión JS detectable`
    );
  }
}


title('ATRIBUTOS DATA-*');

if (
  fs.existsSync(files.html) &&
  fs.existsSync(files.app) &&
  fs.existsSync(files.supabase)
) {
  const contents = {
    [files.html]: read(files.html),
    [files.app]: read(files.app),
    [files.supabase]: read(files.supabase)
  };

  const featureDirectory = 'assets/js/features';

  for (const name of fs.readdirSync(featureDirectory).sort()) {
    if (!name.endsWith('.js')) continue;

    const file = `${featureDirectory}/${name}`;
    contents[file] = read(file);
  }

  const js = Object.entries(contents)
    .filter(([file]) => file !== files.html)
    .map(([, content]) => content)
    .join('\n');

  const declared = new Map();

  for (const [file, source] of Object.entries(contents)) {
    const regex =
      /\b(data-[a-z0-9_-]+)(?:=["'][^"']*["'])?/gi;

    let match;

    while ((match = regex.exec(source))) {
      const attr = match[1].toLowerCase();

      if (!declared.has(attr)) {
        declared.set(attr, []);
      }

      declared.get(attr).push({
        file,
        line:
          source.slice(0, match.index)
            .split('\n').length
      });
    }
  }

  const unresolved = [];

  for (const [attr, locations] of declared) {
    const datasetName =
      attr
        .slice(5)
        .replace(
          /-([a-z])/g,
          (_, c) => c.toUpperCase()
        );

    const normalizedJs = js.replace(
      /\\s*\\.\\s*/g,
      '.'
    ).replace(
      /\\s+/g,
      ' '
    );

    const datasetConsumer = new RegExp(
      `\\bdataset\\s*\\.\\s*${datasetName}\\b`
    ).test(js);

    const explicitConsumer =
      datasetConsumer ||
      [
        `dataset.${datasetName}`,
        `dataset['${datasetName}']`,
        `dataset["${datasetName}"]`,
        `getAttribute('${attr}')`,
        `getAttribute("${attr}")`,
        `hasAttribute('${attr}')`,
        `hasAttribute("${attr}")`,
        `closest('[${attr}]')`,
        `closest("[${attr}]")`
      ].some(token => normalizedJs.includes(token));

    const escaped =
      attr.replace(
        /[-/\\^$*+?.()|[\]{}]/g,
        '\\$&'
      );

    const selectorOccurrences =
      (
        js.match(
          new RegExp(
            `\\[${escaped}(?:\\]|=)`,
            'g'
          )
        ) || []
      ).length;

    const rawOccurrences =
      js.split(attr).length - 1;

    const consumed =
      explicitConsumer ||
      selectorOccurrences > 0 ||
      rawOccurrences > 1;

    if (!consumed) {
      unresolved.push({
        attr,
        locations
      });
    }
  }

  if (!unresolved.length) {
    ok(
      `No se detectan atributos data-* huérfanos (${declared.size} únicos revisados)`
    );
  } else {
    for (const item of unresolved) {
      console.log(item.attr);

      for (const location of item.locations) {
        console.log(
          `  ${location.file}:${location.line}`
        );
      }
    }

    fail(
      `${unresolved.length} atributo(s) data-* sin consumidor detectable`
    );
  }
}



title('DNA V2 CONCURRENCY');

try {
  const output = execFileSync(
    process.execPath,
    ['scripts/test-rooms-dna-concurrency.mjs'],
    { encoding: 'utf8' }
  );

  console.log(output);
  ok('Concurrencia DNA V2');
} catch (error) {
  console.log(error.stdout?.toString() || '');
  console.log(error.stderr?.toString() || '');
  fail('Concurrencia DNA V2');
}

title('MATCHING DNA V2');

try {
  const output = execFileSync(
    process.execPath,
    ['scripts/test-rooms-match-v2.mjs'],
    { encoding: 'utf8' }
  );

  console.log(output);
  ok('Motor Matching DNA V2');
} catch (error) {
  console.log(error.stdout?.toString() || '');
  console.log(error.stderr?.toString() || '');
  fail('Motor Matching DNA V2');
}

title('MATCH RPC V2 CONTRACT');

try {
  const output = execFileSync(
    process.execPath,
    ['scripts/test-match-rpc-v2.mjs'],
    { encoding: 'utf8' }
  );

  console.log(output);
  ok('Contrato Matching RPC V2');
} catch (error) {
  console.log(error.stdout?.toString() || '');
  console.log(error.stderr?.toString() || '');
  fail('Contrato Matching RPC V2');
}

title('HOME PREFERENCES V2');

try {
  const output = execFileSync(
    process.execPath,
    ['scripts/test-home-preferences-v2.mjs'],
    { encoding: 'utf8' }
  );

  console.log(output);
  ok('Home Preferences V2');
} catch (error) {
  console.log(error.stdout?.toString() || '');
  console.log(error.stderr?.toString() || '');
  fail('Home Preferences V2');
}

title('AUTH UTILS FEATURE');

try {
  const output = execFileSync(
    process.execPath,
    ['scripts/test-auth-utils-feature.mjs'],
    { encoding: 'utf8' }
  );

  console.log(output.trim());
  ok('Auth Utils feature modular');
} catch (error) {
  console.error(
    error.stdout?.toString() ||
    error.stderr?.toString() ||
    error.message
  );
  fail('Auth Utils feature modular');
}

title('PRIVACY PREFERENCES FEATURE');

try {
  const output = execFileSync(
    process.execPath,
    ['scripts/test-privacy-preferences-feature.mjs'],
    { encoding: 'utf8' }
  );

  console.log(output.trim());
  ok('Privacy Preferences feature modular');
} catch (error) {
  console.error(
    error.stdout?.toString() ||
    error.stderr?.toString() ||
    error.message
  );
  fail('Privacy Preferences feature modular');
}

title('SESSION REPOSITORY');

try {
  const output = execFileSync(
    process.execPath,
    ['scripts/test-session-repository.mjs'],
    { encoding: 'utf8' }
  );

  console.log(output.trim());
  ok('Session Repository');
} catch (error) {
  console.error(
    error.stdout?.toString() ||
    error.stderr?.toString() ||
    error.message
  );
  fail('Session Repository');
}

title('DISCOVERY REPOSITORY');

try {
  const output = execFileSync(
    process.execPath,
    ['scripts/test-discovery-repository.mjs'],
    { encoding: 'utf8' }
  );
  console.log(output.trim());
  ok('Discovery Repository');
} catch (error) {
  console.error(error.stdout?.toString() || error.stderr?.toString() || error.message);
  fail('Discovery Repository');
}

title('LIVING EDITOR FEATURE');

try {
  const output = execFileSync(
    process.execPath,
    ['scripts/test-living-editor-feature.mjs'],
    { encoding: 'utf8' }
  );

  console.log(output);
  ok('Living Editor feature modular');
} catch (error) {
  console.log(error.stdout?.toString() || '');
  console.log(error.stderr?.toString() || '');
  fail('Living Editor feature modular');
}

title('OWN ACTIVITY FEATURE');

try {
  const output = execFileSync(
    process.execPath,
    ['scripts/test-own-activity-feature.mjs'],
    { encoding: 'utf8' }
  );

  console.log(output);
  ok('Own Activity feature modular');
} catch (error) {
  console.log(error.stdout?.toString() || '');
  console.log(error.stderr?.toString() || '');
  fail('Own Activity feature modular');
}

title('EXPLORE RENDER FEATURE');

try {
  const output = execFileSync(
    process.execPath,
    ['scripts/test-explore-render-feature.mjs'],
    { encoding: 'utf8' }
  );

  console.log(output);
  ok('Explore Render feature modular');
} catch (error) {
  console.log(error.stdout?.toString() || '');
  console.log(error.stderr?.toString() || '');
  fail('Explore Render feature modular');
}

title('EXPLORE LEAFLET MAP FEATURE');

try {
  const outputExploreLeafletMap = execFileSync(
    process.execPath,
    ['scripts/test-explore-leaflet-map-feature.mjs'],
    { encoding: 'utf8' }
  );

  console.log(outputExploreLeafletMap);
  ok('Explore Leaflet Map feature modular');
} catch (error) {
  console.log(error.stdout?.toString() || '');
  console.log(error.stderr?.toString() || '');
  fail('Explore Leaflet Map feature modular');
}

title('SUPABASE MIGRATIONS');

try {
  const outputMigrations =
    execFileSync(
      process.execPath,
      ['scripts/test-migration-order.mjs'],
      {
        encoding: 'utf8'
      }
    );

  console.log(
    outputMigrations.trim()
  );

  ok('Supabase migrations order');
} catch (error) {
  fail('Supabase migrations order');

  console.error(
    error.stdout?.toString() ||
    error.stderr?.toString() ||
    error.message
  );
}


title('EXPLORE MAP CARD FEATURE');

try {
  const outputExploreMapCard = execFileSync(
    process.execPath,
    ['scripts/test-explore-map-card-feature.mjs'],
    { encoding: 'utf8' }
  );

  console.log(outputExploreMapCard.trim());
  ok('Explore Map Card feature modular');
} catch (error) {
  fail('Explore Map Card feature modular');
  console.error(
    error.stdout?.toString() ||
    error.stderr?.toString() ||
    error.message
  );
}

title('EXPLORE PEOPLE FEATURE');

try {
  const outputExplorePeople = execFileSync(
    process.execPath,
    ['scripts/test-explore-people-feature.mjs'],
    { encoding: 'utf8' }
  );

  console.log(outputExplorePeople.trim());
  ok('Explore People feature modular');
} catch (error) {
  fail('Explore People feature modular');
  console.error(
    error.stdout?.toString() ||
    error.stderr?.toString() ||
    error.message
  );
}

title('EXPLORE COMMUNITIES FEATURE');

try {
  const outputExploreCommunities = execFileSync(
    process.execPath,
    ['scripts/test-explore-communities-feature.mjs'],
    { encoding: 'utf8' }
  );

  console.log(outputExploreCommunities.trim());
  ok('Explore Communities feature modular');
} catch (error) {
  fail('Explore Communities feature modular');
  console.error(
    error.stdout?.toString() ||
    error.stderr?.toString() ||
    error.message
  );
}

title('FEED CORE FEATURE');

try {
  const outputFeedCore = execFileSync(
    process.execPath,
    ['scripts/test-feed-core-feature.mjs'],
    { encoding: 'utf8' }
  );

  console.log(outputFeedCore.trim());
  ok('Feed Core feature modular');
} catch (error) {
  fail('Feed Core feature modular');
  console.error(
    error.stdout?.toString() ||
    error.stderr?.toString() ||
    error.message
  );
}

title('FEED COMMUNITY CARD FEATURE');

try {
  const outputFeedCommunityCard = execFileSync(
    process.execPath,
    ['scripts/test-feed-community-card-feature.mjs'],
    { encoding: 'utf8' }
  );

  console.log(outputFeedCommunityCard.trim());
  ok('Feed Community Card feature modular');
} catch (error) {
  fail('Feed Community Card feature modular');
  console.error(
    error.stdout?.toString() ||
    error.stderr?.toString() ||
    error.message
  );
}

title('FEED POST CARD FEATURE');

try {
  const outputFeedPostCard = execFileSync(
    process.execPath,
    ['scripts/test-feed-post-card-feature.mjs'],
    { encoding: 'utf8' }
  );

  console.log(outputFeedPostCard.trim());
  ok('Feed Post Card feature modular');
} catch (error) {
  fail('Feed Post Card feature modular');
  console.error(
    error.stdout?.toString() ||
    error.stderr?.toString() ||
    error.message
  );
}

title('FEED PERSON CARD FEATURE');

try {
  const outputFeedPersonCard = execFileSync(
    process.execPath,
    ['scripts/test-feed-person-card-feature.mjs'],
    { encoding: 'utf8' }
  );

  console.log(outputFeedPersonCard.trim());
  ok('Feed Person Card feature modular');
} catch (error) {
  fail('Feed Person Card feature modular');
  console.error(
    error.stdout?.toString() ||
    error.stderr?.toString() ||
    error.message
  );
}

title('FEED LISTING CARD FEATURE');

try {
  const outputFeedListingCard = execFileSync(
    process.execPath,
    ['scripts/test-feed-listing-card-feature.mjs'],
    { encoding: 'utf8' }
  );

  console.log(outputFeedListingCard.trim());
  ok('Feed Listing Card feature modular');
} catch (error) {
  fail('Feed Listing Card feature modular');
  console.error(
    error.stdout?.toString() ||
    error.stderr?.toString() ||
    error.message
  );
}

title('PUBLISH SUBMIT FEATURE');

try {
  const outputPublishSubmit = execFileSync(
    process.execPath,
    ['scripts/test-publish-submit-feature.mjs'],
    { encoding: 'utf8' }
  );

  console.log(outputPublishSubmit.trim());
  ok('Publish Submit feature modular');
} catch (error) {
  fail('Publish Submit feature modular');
  console.error(
    error.stdout?.toString() ||
    error.stderr?.toString() ||
    error.message
  );
}

title('PUBLISH GEOCODING FEATURE');

try {
  const outputPublishGeocoding = execFileSync(
    process.execPath,
    ['scripts/test-publish-geocoding-feature.mjs'],
    { encoding: 'utf8' }
  );

  console.log(outputPublishGeocoding.trim());
  ok('Publish Geocoding feature modular');
} catch (error) {
  fail('Publish Geocoding feature modular');
  console.error(
    error.stdout?.toString() ||
    error.stderr?.toString() ||
    error.message
  );
}

title('PUBLISH COMPOSER FEATURE');

try {
  const outputPublishComposer = execFileSync(
    process.execPath,
    ['scripts/test-publish-composer-feature.mjs'],
    { encoding: 'utf8' }
  );

  console.log(outputPublishComposer.trim());
  ok('Publish Composer feature modular');
} catch (error) {
  fail('Publish Composer feature modular');
  console.error(
    error.stdout?.toString() ||
    error.stderr?.toString() ||
    error.message
  );
}

title('PUBLISH COMMUNITY FIELDS FEATURE');

try {
  const outputCommunityFields = execFileSync(
    process.execPath,
    ['scripts/test-publish-community-fields-feature.mjs'],
    { encoding: 'utf8' }
  );

  console.log(outputCommunityFields.trim());
  ok('Publish Community Fields feature modular');
} catch (error) {
  fail('Publish Community Fields feature modular');
  console.error(
    error.stdout?.toString() ||
    error.stderr?.toString() ||
    error.message
  );
}

title('PUBLISH STEPS FEATURE');

try {
  const outputPublishSteps = execFileSync(
    process.execPath,
    ['scripts/test-publish-steps-feature.mjs'],
    { encoding: 'utf8' }
  );

  console.log(outputPublishSteps.trim());
  ok('Publish Steps feature modular');
} catch (error) {
  fail('Publish Steps feature modular');
  console.error(
    error.stdout?.toString() ||
    error.stderr?.toString() ||
    error.message
  );
}

title('PUBLISH MEDIA FEATURE');

try {
  const outputPublishMedia = execFileSync(
    process.execPath,
    ['scripts/test-publish-media-feature.mjs'],
    { encoding: 'utf8' }
  );

  console.log(outputPublishMedia.trim());
  ok('Publish Media feature modular');
} catch (error) {
  fail('Publish Media feature modular');
  console.error(
    error.stdout?.toString() ||
    error.stderr?.toString() ||
    error.message
  );
}

title('LISTING DELETE FEATURE');

try {
  const outputListingDelete =
    execFileSync(
      process.execPath,
      ['scripts/test-listing-delete-feature.mjs'],
      {
        encoding: 'utf8'
      }
    );

  console.log(outputListingDelete.trim());

  ok('Listing Delete feature modular');
} catch (error) {
  fail('Listing Delete feature modular');
  console.error(
    error.stdout?.toString() ||
    error.stderr?.toString() ||
    error.message
  );
}

title('LISTING EDITOR FEATURE');

try {
  const outputListingEditor =
    execFileSync(
      process.execPath,
      ['scripts/test-listing-editor-feature.mjs'],
      {
        encoding: 'utf8'
      }
    );

  console.log(outputListingEditor.trim());

  ok('Listing Editor feature modular');
} catch (error) {
  fail('Listing Editor feature modular');
  console.error(
    error.stdout?.toString() ||
    error.stderr?.toString() ||
    error.message
  );
}

title('LISTING PHOTOS FEATURE');

try {
  const outputListingPhotos =
    execFileSync(
      process.execPath,
      ['scripts/test-listing-photos-feature.mjs'],
      {
        encoding: 'utf8'
      }
    );

  console.log(outputListingPhotos.trim());

  ok('Listing Photos feature modular');
} catch (error) {
  fail('Listing Photos feature modular');
  console.error(
    error.stdout?.toString() ||
    error.stderr?.toString() ||
    error.message
  );
}

title('COMMUNITY DETAIL RENDER FEATURE');

try {
  const outputCommunityDetailRender =
    execFileSync(
      process.execPath,
      ['scripts/test-community-detail-render-feature.mjs'],
      {
        encoding: 'utf8'
      }
    );

  console.log(outputCommunityDetailRender.trim());

  ok('Community Detail Render feature modular');
} catch (error) {
  fail('Community Detail Render feature modular');
  console.error(
    error.stdout?.toString() ||
    error.stderr?.toString() ||
    error.message
  );
}

title('COMMUNITY DETAIL CORE FEATURE');

try {
  const outputCommunityDetailCore =
    execFileSync(
      process.execPath,
      ['scripts/test-community-detail-core-feature.mjs'],
      {
        encoding: 'utf8'
      }
    );

  console.log(outputCommunityDetailCore.trim());

  ok('Community Detail Core feature modular');
} catch (error) {
  fail('Community Detail Core feature modular');
  console.error(
    error.stdout?.toString() ||
    error.stderr?.toString() ||
    error.message
  );
}

title('COMMUNITY POSTS FEATURE');

try {
  const outputCommunityPosts =
    execFileSync(
      process.execPath,
      ['scripts/test-community-posts-feature.mjs'],
      {
        encoding: 'utf8'
      }
    );

  console.log(outputCommunityPosts.trim());

  ok('Community Posts feature modular');
} catch (error) {
  fail('Community Posts feature modular');
  console.error(
    error.stdout?.toString() ||
    error.stderr?.toString() ||
    error.message
  );
}

title('COMMUNITY INTERACTIONS FEATURE');

try {
  const outputCommunityInteractions =
    execFileSync(
      process.execPath,
      ['scripts/test-community-interactions-feature.mjs'],
      {
        encoding: 'utf8'
      }
    );

  console.log(outputCommunityInteractions.trim());

  ok('Community Interactions feature modular');
} catch (error) {
  fail('Community Interactions feature modular');
  console.error(
    error.stdout?.toString() ||
    error.stderr?.toString() ||
    error.message
  );
}

title('COMMUNITY CREATE FEATURE');

try {
  const outputCommunityCreate =
    execFileSync(
      process.execPath,
      ['scripts/test-community-create-feature.mjs'],
      {
        encoding: 'utf8'
      }
    );

  console.log(outputCommunityCreate.trim());

  ok('Community Create feature modular');
} catch (error) {
  fail('Community Create feature modular');
  console.error(
    error.stdout?.toString() ||
    error.stderr?.toString() ||
    error.message
  );
}

title('COMMUNITY MEMBERSHIP FEATURE');

try {
  const outputCommunityMembership =
    execFileSync(
      process.execPath,
      ['scripts/test-community-membership-feature.mjs'],
      {
        encoding: 'utf8'
      }
    );

  console.log(outputCommunityMembership.trim());

  ok('Community Membership feature modular');
} catch (error) {
  fail('Community Membership feature modular');
  console.error(
    error.stdout?.toString() ||
    error.stderr?.toString() ||
    error.message
  );
}

title('COMMUNITY MANAGEMENT FEATURE');

try {
  const outputCommunityManagement =
    execFileSync(
      process.execPath,
      ['scripts/test-community-management-feature.mjs'],
      {
        encoding: 'utf8'
      }
    );

  console.log(outputCommunityManagement.trim());

  ok('Community Management feature modular');
} catch (error) {
  fail('Community Management feature modular');
  console.error(
    error.stdout?.toString() ||
    error.stderr?.toString() ||
    error.message
  );
}

title('HOUSEHOLD EVENTS FEATURE');

try {
  const outputHouseholdEvents =
    execFileSync(
      process.execPath,
      ['scripts/test-household-events-feature.mjs'],
      {
        encoding: 'utf8'
      }
    );

  console.log(outputHouseholdEvents.trim());

  ok('Household Events feature modular');
} catch (error) {
  fail('Household Events feature modular');
  console.error(
    error.stdout?.toString() ||
    error.stderr?.toString() ||
    error.message
  );
}

title('HOUSEHOLD CORE FEATURE');

try {
  const outputHouseholdCore =
    execFileSync(
      process.execPath,
      ['scripts/test-household-core-feature.mjs'],
      {
        encoding: 'utf8'
      }
    );

  console.log(outputHouseholdCore.trim());

  ok('Household Core feature modular');
} catch (error) {
  fail('Household Core feature modular');
  console.error(
    error.stdout?.toString() || error.message
  );
}

title('HOUSEHOLD CREATE FEATURE');

try {
  const outputHouseholdCreate =
    execFileSync(
      process.execPath,
      ['scripts/test-household-create-feature.mjs'],
      {
        encoding: 'utf8'
      }
    );

  console.log(outputHouseholdCreate.trim());

  ok('Household Create feature modular');
} catch (error) {
  fail('Household Create feature modular');
  console.error(error.stdout?.toString() || error.message);
}

title('HOUSEHOLD CANDIDATES FEATURE');

try {
  const outputHouseholdCandidates =
    execFileSync(
      process.execPath,
      ['scripts/test-household-candidates-feature.mjs'],
      {
        encoding: 'utf8'
      }
    );

  console.log(
    outputHouseholdCandidates.trim()
  );

  ok('Household Candidates feature modular');
} catch (error) {
  fail('Household Candidates feature modular');

  console.error(
    error.stdout?.toString() ||
    error.stderr?.toString() ||
    error.message
  );
}


title('HOUSEHOLD INVITES FEATURE');

try {
  const outputHouseholdInvites =
    execFileSync(
      process.execPath,
      ['scripts/test-household-invites-feature.mjs'],
      {
        encoding: 'utf8'
      }
    );

  console.log(
    outputHouseholdInvites.trim()
  );

  ok('Household Invites feature modular');
} catch (error) {
  fail('Household Invites feature modular');

  console.error(
    error.stdout?.toString() ||
    error.stderr?.toString() ||
    error.message
  );
}


title('HOUSEHOLD GROUP PICKER FEATURE');

try {
  const outputHouseholdGroupPicker =
    execFileSync(
      process.execPath,
      ['scripts/test-household-group-picker-feature.mjs'],
      {
        encoding: 'utf8'
      }
    );

  console.log(
    outputHouseholdGroupPicker.trim()
  );

  ok('Household Group Picker feature modular');
} catch (error) {
  fail('Household Group Picker feature modular');

  console.error(
    error.stdout?.toString() ||
    error.stderr?.toString() ||
    error.message
  );
}


title('EXPLORE CONTROLLER FEATURE');

try {
  const outputExploreController =
    execFileSync(
      process.execPath,
      ['scripts/test-explore-controller-feature.mjs'],
      {
        encoding: 'utf8'
      }
    );

  console.log(
    outputExploreController.trim()
  );

  ok('Explore Controller feature modular');
} catch (error) {
  fail('Explore Controller feature modular');

  console.error(
    error.stdout?.toString() ||
    error.stderr?.toString() ||
    error.message
  );
}


title('EXPLORE FILTERS FEATURE');

try {
  const outputExploreFilters =
    execFileSync(
      process.execPath,
      ['scripts/test-explore-filters-feature.mjs'],
      {
        encoding: 'utf8'
      }
    );

  console.log(
    outputExploreFilters.trim()
  );

  ok('Explore Filters feature modular');
} catch (error) {
  fail('Explore Filters feature modular');

  console.error(
    error.stdout?.toString() ||
    error.stderr?.toString() ||
    error.message
  );
}


title('EXPLORE VIEW FEATURE');

try {
  const outputExploreView =
    execFileSync(
      process.execPath,
      ['scripts/test-explore-view-feature.mjs'],
      {
        encoding: 'utf8'
      }
    );

  console.log(
    outputExploreView.trim()
  );

  ok('Explore View feature modular');
} catch (error) {
  fail('Explore View feature modular');

  console.error(
    error.stdout?.toString() ||
    error.stderr?.toString() ||
    error.message
  );
}


title('ACCOUNT SETTINGS FEATURE');

try {
  const outputAccountSettings =
    execFileSync(
      process.execPath,
      ['scripts/test-account-settings-feature.mjs'],
      {
        encoding: 'utf8'
      }
    );

  console.log(
    outputAccountSettings.trim()
  );

  ok('Account Settings feature modular');
} catch (error) {
  fail('Account Settings feature modular');

  console.error(
    error.stdout?.toString() ||
    error.stderr?.toString() ||
    error.message
  );
}


title('PROFILE PRIVACY FEATURE');

try {
  const outputProfilePrivacy =
    execFileSync(
      process.execPath,
      ['scripts/test-profile-privacy-feature.mjs'],
      {
        encoding: 'utf8'
      }
    );

  console.log(
    outputProfilePrivacy.trim()
  );

  ok('Profile Privacy feature modular');
} catch (error) {
  fail('Profile Privacy feature modular');

  console.error(
    error.stdout?.toString() ||
    error.stderr?.toString() ||
    error.message
  );
}


title('ONBOARDING -> PROFILE CONTRACT');
try {
  const output = execFileSync(process.execPath,
    ['scripts/test-onboarding-profile-contract.mjs'], { encoding: 'utf8' });
  console.log(output.trim());
  ok('Contrato onboarding V2 -> perfil');
} catch (error) {
  fail('Contrato onboarding V2 -> perfil');
  console.error(error.stdout?.toString() || error.message);
}

title('OWN PROFILE DNA INTERESTS');
try {
  console.log(execFileSync(process.execPath,
    ['scripts/test-own-profile-dna-interests.mjs'], { encoding: 'utf8' }).trim());
  ok('Intereses DNA V2 en perfil propio');
} catch (error) {
  fail('Intereses DNA V2 en perfil propio');
  console.error(error.stdout?.toString() || error.message);
}

title('OWN PROFILE FEATURE');

try {
  const outputOwnProfile =
    execFileSync(
      process.execPath,
      ['scripts/test-own-profile-feature.mjs'],
      {
        encoding: 'utf8'
      }
    );

  console.log(
    outputOwnProfile.trim()
  );

  ok('Own Profile feature modular');
} catch (error) {
  fail('Own Profile feature modular');

  console.error(
    error.stdout?.toString() ||
    error.stderr?.toString() ||
    error.message
  );
}


title('PROFILE EDITOR FEATURE');

try {
  const outputProfileEditor =
    execFileSync(
      process.execPath,
      ['scripts/test-profile-editor-feature.mjs'],
      {
        encoding: 'utf8'
      }
    );

  console.log(
    outputProfileEditor.trim()
  );

  ok('Profile Editor feature modular');
} catch (error) {
  fail('Profile Editor feature modular');

  console.error(
    error.stdout?.toString() ||
    error.stderr?.toString() ||
    error.message
  );
}


title('PROFILES FEATURE');

try {
  const outputProfiles =
    execFileSync(
      process.execPath,
      ['scripts/test-profiles-feature.mjs'],
      {
        encoding: 'utf8'
      }
    );

  console.log(
    outputProfiles.trim()
  );

  ok('Profiles feature modular');
} catch (error) {
  fail('Profiles feature modular');

  console.error(
    error.stdout?.toString() ||
    error.stderr?.toString() ||
    error.message
  );
}


title('MATCHING FEATURE');

try {
  const outputMatching =
    execFileSync(
      process.execPath,
      ['scripts/test-matching-feature.mjs'],
      {
        encoding: 'utf8'
      }
    );

  console.log(
    outputMatching.trim()
  );

  ok('Matching feature modular');
} catch (error) {
  fail('Matching feature modular');

  console.error(
    error.stdout?.toString() ||
    error.stderr?.toString() ||
    error.message
  );
}


title('LISTINGS FEATURE');

try {
  const outputListings =
    execFileSync(
      process.execPath,
      ['scripts/test-listings-feature.mjs'],
      {
        encoding: 'utf8'
      }
    );

  console.log(
    outputListings.trim()
  );

  ok('Listings feature modular');
} catch (error) {
  fail('Listings feature modular');

  console.error(
    error.stdout?.toString() ||
    error.stderr?.toString() ||
    error.message
  );
}


title('SESSIONS FEATURE');

try {
  const outputSessions =
    execFileSync(
      process.execPath,
      ['scripts/test-sessions-feature.mjs'],
      {
        encoding: 'utf8'
      }
    );

  console.log(
    outputSessions.trim()
  );

  ok('Sessions feature modular');
} catch (error) {
  fail('Sessions feature modular');

  console.error(
    error.stdout?.toString() ||
    error.stderr?.toString() ||
    error.message
  );
}


title('MESSAGING FEATURE');

try {
  const outputMessaging =
    execFileSync(
      process.execPath,
      ['scripts/test-messaging-feature.mjs'],
      {
        encoding: 'utf8'
      }
    );

  console.log(
    outputMessaging.trim()
  );

  ok('Messaging feature modular');
} catch (error) {
  fail('Messaging feature modular');

  console.error(
    error.stdout?.toString() ||
    error.stderr?.toString() ||
    error.message
  );
}


title('CONNECTIONS FEATURE');

try {
  const outputConnections =
    execFileSync(
      process.execPath,
      ['scripts/test-connections-feature.mjs'],
      {
        encoding: 'utf8'
      }
    );

  console.log(
    outputConnections.trim()
  );

  ok('Connections feature modular');
} catch (error) {
  fail('Connections feature modular');

  console.error(
    error.stdout?.toString() ||
    error.stderr?.toString() ||
    error.message
  );
}


title('MODERATION FEATURE');

try {
  const outputModeration =
    execFileSync(
      process.execPath,
      ['scripts/test-moderation-feature.mjs'],
      {
        encoding: 'utf8'
      }
    );

  console.log(
    outputModeration.trim()
  );

  ok('Moderation feature modular');
} catch (error) {
  fail('Moderation feature modular');

  console.error(
    error.stdout?.toString() ||
    error.stderr?.toString() ||
    error.message
  );
}

title('SAVED FEATURE');

try {
  const outputSaved =
    execFileSync(
      process.execPath,
      ['scripts/test-saved-feature.mjs'],
      {
        encoding: 'utf8'
      }
    );

  console.log(
    outputSaved.trim()
  );

  ok('Saved feature modular');
} catch (error) {
  fail('Saved feature modular');

  console.error(
    error.stdout?.toString() ||
    error.stderr?.toString() ||
    error.message
  );
}

title('ROOMS DNA V2');

console.log('\n=== ROOMS DNA PROFILE V2 ===');

try {
  const output = execFileSync(
    process.execPath,
    ['scripts/test-rooms-dna-profile-v2.mjs'],
    { encoding: 'utf8' }
  );

  console.log(output);
  ok('Perfil ROOMS DNA V2');
} catch (error) {
  console.log(error.stdout?.toString() || '');
  console.log(error.stderr?.toString() || '');
  fail('Perfil ROOMS DNA V2');
}

console.log('\n=== ROOMS DNA V2 STATE ===');

try {
  const output = execFileSync(
    process.execPath,
    ['scripts/test-rooms-dna-state.mjs'],
    { encoding: 'utf8' }
  );

  console.log(output);
  ok('Estado ROOMS DNA V2');
} catch (error) {
  console.log(error.stdout?.toString() || '');
  console.log(error.stderr?.toString() || '');
  fail('Estado ROOMS DNA V2');
}

try {
  const outputV2 =
    execFileSync(
      process.execPath,
      ['scripts/test-rooms-dna-v2.mjs'],
      {
        encoding: 'utf8'
      }
    );

  console.log(
    outputV2.trim()
  );

  const outputOnboardingV2 =
    execFileSync(
      process.execPath,
      ['scripts/test-onboarding-v2.mjs'],
      {
        encoding: 'utf8'
      }
    );

  console.log(
    outputOnboardingV2.trim()
  );

  const outputSaveStability = execFileSync(
    process.execPath,
    ['scripts/test-onboarding-save-stability.mjs'],
    { encoding: 'utf8' }
  );
  console.log(outputSaveStability.trim());

  const outputEngine =
    execFileSync(
      process.execPath,
      ['scripts/test-rooms-dna-engine.mjs'],
      {
        encoding: 'utf8'
      }
    );

  console.log(
    outputEngine.trim()
  );

  const outputArchetypes =
    execFileSync(
      process.execPath,
      ['scripts/test-rooms-dna-archetypes.mjs'],
      {
        encoding: 'utf8'
      }
    );

  console.log(
    outputArchetypes.trim()
  );

  ok('Arquitectura ROOMS DNA V2');
} catch (error) {
  fail('Arquitectura ROOMS DNA V2');

  console.error(
    error.stdout?.toString() ||
    error.stderr?.toString() ||
    error.message
  );
}

title('ROOMS DNA UNIVERSAL');

try {
  const output =
    execFileSync(
      process.execPath,
      ['scripts/test-rooms-dna.mjs'],
      {
        encoding: 'utf8'
      }
    );

  console.log(output.trim());
  ok('Arquitectura ROOMS DNA');
} catch (error) {
  fail('Arquitectura ROOMS DNA');

  console.error(
    error.stdout?.toString() ||
    error.stderr?.toString() ||
    error.message
  );
}

title('RESULTADO');

console.log(
  `Fallos: ${failures} · Avisos: ${warnings}`
);

if (failures > 0) {
  console.error(
    '\nVERIFICACION FALLIDA'
  );
  process.exit(1);
}

console.log(
  '\nVERIFICACION TECNICA SUPERADA'
);
