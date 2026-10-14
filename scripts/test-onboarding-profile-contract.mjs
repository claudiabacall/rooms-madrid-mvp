import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = path => fs.readFileSync(path, 'utf8');
const app = read('assets/js/app.js');
const backend = read('assets/js/supabase-app.js');
const own = read('assets/js/features/own-profile.js');
const editor = read('assets/js/features/profile-editor.js');
const living = read('assets/js/features/living-editor.js');

function check(label, expression, source) {
  assert.match(source, expression, label);
  console.log(`OK  ${label}`);
}

console.log('\n=== ONBOARDING V2 -> PERFIL · CONTRATO ===');
check('Snapshot incluye DNA V2', /roomsDna\s*,\s*matchPreferences\s*:/, app);
check('Snapshot incluye datos de perfil', /profile\s*:\s*\{\s*name\s*:/, app);
check('Se persiste perfil provisional antes del DNA', /provisionalProfileResult[\s\S]*?\.from\('match_preferences'\)/, backend);
check('Perfil persiste intereses de adaptador V2', /interests\s*:\s*match\.interests/, backend);
check('Perfil persiste rasgos de adaptador V2', /traits\s*:\s*match\.traits/, backend);
check('DNA V2 se persiste en rooms_dna', /\.from\('rooms_dna'\)\s*\.upsert\(/, backend);
check('Intenciones se persisten separadas', /\.from\('user_intents'\)\s*\.insert\(intentRows\)/, backend);
check('Onboarding solo se completa al final', /\.update\(\{\s*onboarding_completed:\s*true/, backend);
check('Perfil propio lee convivencia del DNA V2', /roomsDnaLivingRows\(\s*state\.roomsDna\s*\)/, own);
check('Editor de convivencia usa DNA V2', /state\.roomsDna/, living);
check('Editor V2 guarda ambas fuentes en una RPC', /db\.rpc\('update_profile_interests_v2'/, editor);
check('Editor V2 verifica revision esperada', /p_expected_revision:\s*openedDnaRevision/, editor);
check('Editor V2 actualiza estado DNA tras guardar', /state\.roomsDna\s*=\s*result\.dna/, editor);
check('Editor legacy conserva actualizacion de profiles', /db\.from\('profiles'\)\.update\(/, editor);

console.log('ATENCION  La escritura atomica V2 requiere la RPC instalada en Supabase.');
console.log('ATENCION  Este contrato verifica conexiones de codigo, no persistencia en Supabase real.');
console.log('ROOMS ONBOARDING PROFILE CONTRACT OK');
