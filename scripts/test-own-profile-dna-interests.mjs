import fs from 'node:fs';
import assert from 'node:assert/strict';
const own = fs.readFileSync('assets/js/features/own-profile.js', 'utf8');
const config = fs.readFileSync('assets/js/rooms-dna-v2-config.js', 'utf8');
const onboarding = fs.readFileSync('assets/js/app.js', 'utf8');
assert.match(own, /state\.roomsDna\?\.answers\?\.world_interests/);
assert.match(own, /Array\.isArray\(state\.roomsDna\?\.answers\?\.world_interests\)/);
assert.match(own, /: \(profile\.interests \|\| \[\]\)/);
for (const id of ['food', 'nightlife', 'cinema', 'art', 'nature', 'fashion']) {
  assert.match(own, new RegExp(`\\b${id}:\\s*'`));
  assert.match(config, new RegExp(`id: '${id}'`));
}
assert.match(onboarding, /function buildLegacyMatchPreferencesFromV2\(/);
console.log('OK  El perfil usa intereses canónicos DNA V2 cuando están disponibles');
console.log('OK  Se conserva el fallback legacy y las etiquetas de intereses V2');
