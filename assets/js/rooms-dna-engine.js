(function(global){

  function clamp(value,min,max){
    return Math.max(
      min,
      Math.min(max,value)
    );
  }

  function createDimensionAccumulator(){
    return {
      self: {
        weightedSum: 0,
        weight: 0,
        evidence: []
      },
      preferred: {
        weightedSum: 0,
        weight: 0,
        evidence: []
      },
      importance: {
        weightedSum: 0,
        weight: 0,
        evidence: []
      }
    };
  }

  function createEmptyResult(config){
    const result = {};

    for(
      const dimension of Object.keys(
        config.dimensions || {}
      )
    ){
      result[dimension] =
        createDimensionAccumulator();
    }

    return result;
  }

  function createCategoricalResult(config){
    const result = {};

    for(
      const category of Object.keys(
        config.categorical || {}
      )
    ){
      result[category] = [];
    }

    return result;
  }

  function addCategoricalValue(
    categorical,
    category,
    value
  ){
    if(
      !Object.prototype.hasOwnProperty.call(
        categorical,
        category
      )
    )return;

    const serialized =
      JSON.stringify(value);

    const exists =
      categorical[category]
        .some(
          current =>
            JSON.stringify(current) ===
            serialized
        );

    if(!exists){
      categorical[category]
        .push(value);
    }
  }

  function collectCategorical(
    categorical,
    option
  ){
    const values =
      option.categorical;

    if(
      !values ||
      typeof values !== 'object'
    )return;

    for(
      const [
        category,
        value
      ] of Object.entries(values)
    ){
      if(Array.isArray(value)){
        for(
          const item of value
        ){
          addCategoricalValue(
            categorical,
            category,
            item
          );
        }
      }else{
        addCategoricalValue(
          categorical,
          category,
          value
        );
      }
    }
  }

  function findInteraction(
    config,
    interactionId
  ){
    return (
      config.interactions || []
    ).find(
      interaction =>
        interaction.id ===
        interactionId
    );
  }

  function findOption(
    interaction,
    optionId
  ){
    return (
      interaction.options || []
    ).find(
      option =>
        option.id === optionId
    );
  }

  function resolveAnswerOptions(
    interaction,
    answer
  ){
    /*
      forced_choice / scenario:
      answer = 'option_id'
    */
    if(
      typeof answer === 'string'
    ){
      const option =
        findOption(
          interaction,
          answer
        );

      return option
        ? [option]
        : [];
    }

    /*
      multi_select:
      answer = ['music','sport',...]
    */
    if(
      Array.isArray(answer)
    ){
      return answer
        .map(
          optionId =>
            findOption(
              interaction,
              optionId
            )
        )
        .filter(Boolean);
    }

    /*
      priority_board:
      answer = {
        natural_light: 'need',
        terrace: 'like'
      }

      Las opciones pueden declarar:
      itemId + levelId.
    */
    if(
      answer &&
      typeof answer === 'object'
    ){
      const resolved = [];

      for(
        const [
          itemId,
          levelId
        ] of Object.entries(answer)
      ){
        const option =
          (
            interaction.options || []
          ).find(
            candidate =>
              candidate.itemId ===
                itemId &&
              candidate.levelId ===
                levelId
          );

        if(option){
          resolved.push(option);
        }
      }

      return resolved;
    }

    return [];
  }

  function applySignal({
    accumulator,
    signal,
    interaction,
    option,
    sourceWeight
  }){
    const dimension =
      accumulator[
        signal.dimension
      ];

    if(!dimension)return;

    const field =
      dimension[
        signal.field
      ];

    if(!field)return;

    const weightedValue =
      signal.value *
      sourceWeight;

    field.weightedSum +=
      weightedValue;

    field.weight +=
      sourceWeight;

    field.evidence.push({
      interactionId:
        interaction.id,

      optionId:
        option.id,

      source:
        interaction.type,

      rawValue:
        signal.value,

      sourceWeight,

      contribution:
        weightedValue
    });
  }

  function finalizeField(
    field,
    config
  ){
    if(
      !field ||
      field.weight === 0
    ){
      return {
        score: 0,
        confidence: 0,
        consistency: 0,
        evidence: []
      };
    }

    const rawScore =
      field.weightedSum /
      field.weight;

    /*
      Evidence confidence:
      aumenta cuando tenemos más señales
      ponderadas sobre la misma dimensión.
    */
    const evidenceConfidence =
      1 -
      Math.exp(
        -field.weight / 1.75
      );

    /*
      Consistency:
      mide cuánto apuntan las evidencias
      en una dirección coherente.

      Si todas las señales son parecidas,
      consistency se acerca a 1.

      Si unas son positivas y otras
      negativas, baja.
    */
    let weightedDeviation = 0;

    for(
      const item of field.evidence
    ){
      weightedDeviation +=
        Math.abs(
          item.rawValue -
          rawScore
        ) *
        item.sourceWeight;
    }

    const meanDeviation =
      weightedDeviation /
      field.weight;

    const consistency =
      clamp(
        1 - meanDeviation,
        0,
        1
      );

    /*
      Confidence final:
      necesitamos evidencia Y coherencia.

      La consistencia modula,
      pero no destruye completamente,
      la confianza acumulada.
    */
    const confidence =
      evidenceConfidence *
      (
        0.35 +
        consistency * 0.65
      );

    return {
      score:
        clamp(
          rawScore,
          config.score.min,
          config.score.max
        ),

      confidence:
        clamp(
          confidence,
          0,
          1
        ),

      consistency,

      evidence:
        [...field.evidence]
    };
  }

  function calculateRoomsDna(
    answers,
    config=
      global.ROOMS_DNA_V2
  ){
    if(!config){
      throw new Error(
        'ROOMS_DNA_V2 no está disponible'
      );
    }

    const accumulator =
      createEmptyResult(config);

    const categorical =
      createCategoricalResult(config);

    const ignoredAnswers = [];

    for(
      const [
        interactionId,
        optionId
      ] of Object.entries(
        answers || {}
      )
    ){
      const interaction =
        findInteraction(
          config,
          interactionId
        );

      if(!interaction){
        ignoredAnswers.push({
          interactionId,
          optionId,
          reason:
            'unknown_interaction'
        });
        continue;
      }

      const options =
        resolveAnswerOptions(
          interaction,
          optionId
        );

      if(!options.length){
        ignoredAnswers.push({
          interactionId,
          optionId,
          reason:
            'unknown_option'
        });
        continue;
      }

      const sourceWeight =
        config.sourceWeights[
          interaction.type
        ] ?? 1;

      for(
        const option of options
      ){
        collectCategorical(
          categorical,
          option
        );

        for(
          const signal of
          option.signals || []
        ){
          applySignal({
            accumulator,
            signal,
            interaction,
            option,
            sourceWeight
          });
        }
      }
    }

    const dimensions = {};

    for(
      const [
        dimension,
        fields
      ] of Object.entries(
        accumulator
      )
    ){
      dimensions[dimension] = {
        self:
          finalizeField(
            fields.self,
            config
          ),

        preferred:
          finalizeField(
            fields.preferred,
            config
          ),

        importance:
          finalizeField(
            fields.importance,
            config
          )
      };
    }

    return {
      version:
        config.version,

      dimensions,

      categorical,

      ignoredAnswers
    };
  }

  global.ROOMS_DNA_ENGINE = {
    calculate:
      calculateRoomsDna
  };

})(
  typeof window !== 'undefined'
    ? window
    : globalThis
);
