import fs from 'node:fs';
import { execFileSync, execSync } from 'node:child_process';

const ROOT = process.cwd();

const files = {
  html: 'index.html',
  app: 'assets/js/app.js',
  supabase: 'assets/js/supabase-app.js',
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

for (const file of [files.app, files.supabase]) {
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
    `${read(files.app)}\n${read(files.supabase)}`;

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
    `${read(files.app)}\n${read(files.supabase)}`;

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
    `${read(files.app)}\n${read(files.supabase)}`;

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
    sources.map(item => item.text).join('\n');

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
    sources.map(item => item.text).join('\n');

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

  const js =
    contents[files.app] +
    '\n' +
    contents[files.supabase];

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

    const explicitConsumer =
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
      ].some(token => js.includes(token));

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
