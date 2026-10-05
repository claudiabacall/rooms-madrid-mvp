(function(global){

  const ARCHETYPES = [
    {
      id: 'selective_social',

      name: 'THE SELECTIVE SOCIAL',

      tagline:
        'People, plans and your own space.',

      description:
        'Te gusta que haya vida en casa, pero no a cualquier precio. Disfrutas compartir, hacer planes y tener gente alrededor sin renunciar a tus límites ni a tu espacio.',

      imageKey:
        'selective_social',

      anchors: [
        {
          dimension: 'social_energy',
          direction: 1,
          minConfidence: 0.20
        },
        {
          dimension: 'boundaries',
          direction: 1,
          minConfidence: 0.20
        }
      ],

      weights: {
        social_energy: 0.90,
        boundaries: 0.75,
        privacy: 0.45,
        communication: 0.35,
        home_activity: 0.45
      },

      direction: {
        social_energy: 1,
        boundaries: 1,
        privacy: 1,
        communication: 1,
        home_activity: 1
      }
    },

    {
      id: 'open_house',

      name: 'THE OPEN HOUSE',

      tagline:
        'There is always room for one more.',

      description:
        'Tu casa es un lugar para compartir. Te gusta la energía, los planes improvisados y sentir que pasan cosas alrededor.',

      imageKey:
        'open_house',

      anchors: [
        {
          dimension: 'visitor_tolerance',
          direction: 1,
          minConfidence: 0.20
        }
      ],

      weights: {
        social_energy: 0.85,
        visitor_tolerance: 0.90,
        home_activity: 0.85,
        community_orientation: 0.70,
        spontaneity: 0.45,
        privacy: 0.30
      },

      direction: {
        social_energy: 1,
        visitor_tolerance: 1,
        home_activity: 1,
        community_orientation: 1,
        spontaneity: 1,
        privacy: -1
      }
    },

    {
      id: 'peace_keeper',

      name: 'THE PEACE KEEPER',

      tagline:
        'Good vibes. Low drama.',

      description:
        'Buscas una convivencia fácil, tranquila y sin demasiada fricción. Te adaptas, respetas el espacio de los demás y prefieres que la casa sea un lugar donde bajar revoluciones.',

      imageKey:
        'peace_keeper',

      anchors: [
        {
          dimension: 'home_activity',
          direction: -1,
          minConfidence: 0.20
        }
      ],

      weights: {
        home_activity: 0.75,
        noise_tolerance: 0.70,
        boundaries: 0.35,
        communication: 0.30,
        spontaneity: 0.25
      },

      direction: {
        home_activity: -1,
        noise_tolerance: -1,
        boundaries: -1,
        communication: -1,
        spontaneity: 1
      }
    },

    {
      id: 'house_ceo',

      name: 'THE HOUSE CEO',

      tagline:
        'Clear rules. Better living.',

      description:
        'Te gusta que la convivencia funcione. Orden, comunicación y acuerdos claros hacen que puedas relajarte y disfrutar mucho más de compartir casa.',

      imageKey:
        'house_ceo',

      anchors: [
        {
          dimension: 'cleanliness',
          direction: 1,
          minConfidence: 0.20
        }
      ],

      weights: {
        cleanliness: 0.95,
        communication: 0.80,
        boundaries: 0.65,
        community_orientation: 0.55,
        privacy: 0.50
      },

      direction: {
        cleanliness: 1,
        communication: 1,
        boundaries: 1,
        community_orientation: 1,
        privacy: -1
      }
    },

    {
      id: 'free_spirit',

      name: 'THE FREE SPIRIT',

      tagline:
        'Plans change. Life happens.',

      description:
        'Improvisas, te adaptas y no necesitas controlar demasiado el día a día. Para ti convivir funciona mejor cuando hay margen para que cada día sea distinto.',

      imageKey:
        'free_spirit',

      anchors: [
        {
          dimension: 'spontaneity',
          direction: 1,
          minConfidence: 0.20
        }
      ],

      weights: {
        spontaneity: 0.95,
        boundaries: 0.65,
        cleanliness: 0.35,
        visitor_tolerance: 0.35,
        home_activity: 0.30
      },

      direction: {
        spontaneity: 1,
        boundaries: -1,
        cleanliness: -1,
        visitor_tolerance: 1,
        home_activity: 1
      }
    },

    {
      id: 'private_club',

      name: 'THE PRIVATE CLUB',

      tagline:
        'Close door. Recharge.',

      description:
        'Compartir casa no significa compartirlo todo. Valoras la independencia, la tranquilidad y vivir con alguien que entienda perfectamente dónde empiezan tus límites.',

      imageKey:
        'private_club',

      anchors: [
        {
          dimension: 'privacy',
          direction: 1,
          minConfidence: 0.20
        }
      ],

      weights: {
        privacy: 0.95,
        boundaries: 0.80,
        community_orientation: 0.65,
        visitor_tolerance: 0.50,
        sharing_style: 0.45
      },

      direction: {
        privacy: 1,
        boundaries: 1,
        community_orientation: -1,
        visitor_tolerance: -1,
        sharing_style: -1
      }
    }
  ];

  function dimensionScore(
    dna,
    dimension
  ){
    return (
      dna?.dimensions?.[dimension]
        ?.self?.score ?? 0
    );
  }

  function dimensionConfidence(
    dna,
    dimension
  ){
    return (
      dna?.dimensions?.[dimension]
        ?.self?.confidence ?? 0
    );
  }

  function scoreArchetype(
    archetype,
    dna
  ){
    /*
      Anchor dimensions:

      Algunas identidades necesitan una señal
      nuclear para poder competir de verdad.

      Ejemplo:
      HOUSE CEO necesita evidencia real
      de cleanliness. Tener límites claros
      no basta por sí solo.
    */
    for(
      const anchor of
      archetype.anchors || []
    ){
      const confidence =
        dimensionConfidence(
          dna,
          anchor.dimension
        );

      const score =
        dimensionScore(
          dna,
          anchor.dimension
        );

      const direction =
        anchor.direction ?? 1;

      const directedScore =
        score * direction;

      if(
        confidence <
          (
            anchor.minConfidence ??
            0
          ) ||
        directedScore <= 0
      ){
        return 0;
      }
    }

    let total = 0;
    let availableWeight = 0;

    for(
      const [
        dimension,
        weight
      ] of Object.entries(
        archetype.weights
      )
    ){
      const confidence =
        dimensionConfidence(
          dna,
          dimension
        );

      /*
        No dejamos que una dimensión
        sin evidencia decida personalidad.
      */
      if(confidence <= 0){
        continue;
      }

      const score =
        dimensionScore(
          dna,
          dimension
        );

      const direction =
        archetype.direction[
          dimension
        ] ?? 1;

      /*
        Convertimos -1..1 a 0..1
        según la dirección deseada
        por el arquetipo.
      */
      const fit =
        (
          score *
          direction +
          1
        ) / 2;

      const effectiveWeight =
        weight *
        confidence;

      total +=
        fit *
        effectiveWeight;

      availableWeight +=
        effectiveWeight;
    }

    if(
      availableWeight === 0
    ){
      return 0;
    }

    return (
      total /
      availableWeight
    );
  }

  function classify(dna){
    const ranked =
      ARCHETYPES
        .map(
          archetype => ({
            ...archetype,
            fit:
              scoreArchetype(
                archetype,
                dna
              )
          })
        )
        .sort(
          (a,b) =>
            b.fit - a.fit
        );

    const primary =
      ranked[0] || null;

    const secondary =
      ranked[1] || null;

    return {
      primary,
      secondary,
      ranked
    };
  }

  global.ROOMS_DNA_ARCHETYPES = {
    definitions:
      ARCHETYPES,

    classify
  };

})(
  typeof window !== 'undefined'
    ? window
    : globalThis
);
