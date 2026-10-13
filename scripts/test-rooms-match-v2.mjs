import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const context = {};
context.window = context;
vm.createContext(context);

vm.runInContext(
  fs.readFileSync(
    'assets/js/rooms-match-v2.js',
    'utf8'
  ),
  context
);

const engine = context.ROOMS_MATCH_V2;

const layer = (score, confidence = 1) => ({
  score,
  confidence
});

const dimension = (
  self,
  preferred,
  importance = 0,
  confidence = 1
) => ({
  self: layer(self, confidence),
  preferred: layer(preferred, confidence),
  importance: layer(importance, confidence)
});

console.log('\n=== MATCHING DNA V2 ===');

assert.equal(engine.dimensions.length, 4);
assert.equal(engine.minDimensions, 2);

console.log('OK  Cuatro dimensiones comparables');

const own = {
  privacy: dimension(0.5, 0.5),
  cleanliness: dimension(1, 1),
  visitor_tolerance: dimension(-0.5, -0.5),
  sharing_style: dimension(0, 0)
};

const compatible = engine.calculate(own, own);

assert.equal(compatible.score, 100);
assert.equal(compatible.comparedDimensions, 4);
assert.equal(compatible.sufficientEvidence, true);

console.log('OK  Compatibilidad completa');

const opposite = {
  privacy: dimension(-0.5, -0.5),
  cleanliness: dimension(-1, -1),
  visitor_tolerance: dimension(0.5, 0.5),
  sharing_style: dimension(1, 1)
};

const different = engine.calculate(
  own,
  opposite
);

assert(different.score < 100);
assert(different.score >= 0);

console.log('OK  Diferencias reducen compatibilidad');

const symmetricA = engine.calculate(
  own,
  opposite
);

const symmetricB = engine.calculate(
  opposite,
  own
);

assert.equal(symmetricA.score, symmetricB.score);

console.log('OK  Resultado simetrico entre personas');

const insufficient = engine.calculate(
  { privacy: own.privacy },
  { privacy: own.privacy }
);

assert.equal(insufficient.score, null);
assert.equal(
  insufficient.sufficientEvidence,
  false
);

console.log('OK  Evidencia insuficiente sin porcentaje');

const lowConfidence = {
  privacy: dimension(0, 0, 0, 0.1),
  cleanliness: dimension(0, 0, 0, 0.1)
};

assert.equal(
  engine.calculate(lowConfidence, lowConfidence).score,
  null
);

console.log('OK  Confianza baja excluida');

assert.equal(
  engine.calculate(null, null).score,
  null
);

console.log('OK  Ausencia de datos segura');

const unavailablePreferences = {
  privacy: {
    self: layer(0.5)
  },
  cleanliness: {
    self: layer(0.5)
  }
};

assert.equal(
  engine.calculate(
    unavailablePreferences,
    unavailablePreferences
  ).score,
  null
);

console.log('OK  No infiere preferencias inexistentes');

const hidden = engine.calculate(
  own,
  null
);

assert.equal(hidden.score, null);

console.log('OK  Privacidad sin datos no genera score');

console.log('\nROOMS MATCHING DNA V2 OK');
