(function () {
  'use strict';

  const MIN_CONFIDENCE = 0.2;
  const MIN_DIMENSIONS = 2;

  const DIMENSIONS = [
    'privacy',
    'cleanliness',
    'visitor_tolerance',
    'sharing_style'
  ];

  function validLayer(layer) {
    return Boolean(
      layer &&
      typeof layer.score === 'number' &&
      Number.isFinite(layer.score) &&
      layer.score >= -1 &&
      layer.score <= 1 &&
      typeof layer.confidence === 'number' &&
      Number.isFinite(layer.confidence) &&
      layer.confidence >= MIN_CONFIDENCE &&
      layer.confidence <= 1
    );
  }

  function directionalFit(person, other) {
    const self = person?.self;
    const preferred = other?.preferred;
    const importance = other?.importance;

    if (
      !validLayer(self) ||
      !validLayer(preferred) ||
      !validLayer(importance)
    ) {
      return null;
    }

    const distance = Math.abs(
      self.score - preferred.score
    );

    const score = Math.max(
      0,
      Math.min(100, 100 - distance * 50)
    );

    // Importancia de -1 a 1.
    // Su peso nunca se reduce a cero.
    const importanceWeight =
      1 + importance.score * 0.5;

    const confidenceWeight =
      Math.min(
        self.confidence,
        preferred.confidence,
        importance.confidence
      );

    return {
      score,
      weight: importanceWeight * confidenceWeight
    };
  }

  function calculate(ownDimensions, targetDimensions) {
    const factors = [];

    for (const dimension of DIMENSIONS) {
      const own = ownDimensions?.[dimension];
      const target = targetDimensions?.[dimension];

      const ownToTarget = directionalFit(
        own,
        target
      );

      const targetToOwn = directionalFit(
        target,
        own
      );

      // Exigimos evidencia en ambas direcciones.
      if (!ownToTarget || !targetToOwn) {
        continue;
      }

      const weight =
        ownToTarget.weight +
        targetToOwn.weight;

      if (weight <= 0) continue;

      const score = (
        ownToTarget.score * ownToTarget.weight +
        targetToOwn.score * targetToOwn.weight
      ) / weight;

      factors.push({
        key: dimension,
        score: Math.round(score),
        weight,
        ownToTarget: Math.round(ownToTarget.score),
        targetToOwn: Math.round(targetToOwn.score)
      });
    }

    if (factors.length < MIN_DIMENSIONS) {
      return {
        score: null,
        comparedDimensions: factors.length,
        sufficientEvidence: false,
        factors
      };
    }

    const totalWeight = factors.reduce(
      (sum, factor) => sum + factor.weight,
      0
    );

    const weightedScore = factors.reduce(
      (sum, factor) =>
        sum + factor.score * factor.weight,
      0
    ) / totalWeight;

    return {
      score: Math.round(weightedScore),
      comparedDimensions: factors.length,
      sufficientEvidence: true,
      factors
    };
  }

  window.ROOMS_MATCH_V2 = Object.freeze({
    calculate,
    dimensions: [...DIMENSIONS],
    minConfidence: MIN_CONFIDENCE,
    minDimensions: MIN_DIMENSIONS
  });
})();
