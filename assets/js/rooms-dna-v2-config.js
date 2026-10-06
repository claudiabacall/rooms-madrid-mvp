globalThis.ROOMS_DNA_V2 = {
  version: 2,

  /*
    ROOMS DNA v2

    Principio:
    una interacción visible puede alimentar varias dimensiones.

    Cada dimensión puede contener:
    - self: cómo es la persona
    - preferred: qué tipo de convivencia prefiere
    - importance: cuánto le importa esa compatibilidad
    - confidence: cuánta evidencia tenemos
  */

  score: {
    min: -1,
    neutral: 0,
    max: 1
  },

  dimensions: {
    social_energy: {
      label: 'Energía social',
      low: 'Muy independiente',
      high: 'Muy social'
    },

    privacy: {
      label: 'Privacidad',
      low: 'Muy compartido',
      high: 'Necesita su espacio'
    },

    cleanliness: {
      label: 'Orden y limpieza',
      low: 'Flexible',
      high: 'Muy cuidadoso'
    },

    noise_tolerance: {
      label: 'Tolerancia al ruido',
      low: 'Necesita calma',
      high: 'Tolera actividad'
    },

    visitor_tolerance: {
      label: 'Visitas',
      low: 'Casa muy privada',
      high: 'Casa abierta'
    },

    schedule_style: {
      label: 'Ritmo diario',
      low: 'Early bird',
      high: 'Night owl'
    },

    spontaneity: {
      label: 'Espontaneidad',
      low: 'Prefiere planificar',
      high: 'Improvisa'
    },

    communication: {
      label: 'Comunicación',
      low: 'Muy autónomo',
      high: 'Prefiere hablarlo'
    },

    sharing_style: {
      label: 'Forma de compartir',
      low: 'Cada uno lo suyo',
      high: 'Muy compartido'
    },

    boundaries: {
      label: 'Límites personales',
      low: 'Muy flexible',
      high: 'Límites claros'
    },

    home_activity: {
      label: 'Energía de la casa',
      low: 'Casa refugio',
      high: 'Casa activa'
    },

    community_orientation: {
      label: 'Vida en comunidad',
      low: 'Convivencia independiente',
      high: 'Vida compartida'
    }
  },

  /*
    No todas las fuentes tienen el mismo valor.

    Una situación concreta pesa más que
    una etiqueta que el usuario se adjudica.
  */

  sourceWeights: {
    scenario: 1,
    forced_choice: 0.85,
    priority_board: 0.9,
    self_reported_trait: 0.45,
    interest: 0.25,
    behavior: 0.6
  },

  /*
    Estructura que acabará teniendo cada dimensión calculada.

    Ejemplo:

    social_energy: {
      self: 0.74,
      preferred: 0.42,
      importance: 0.68,
      confidence: 0.81
    }
  */

  dimensionState: {
    self: 0,
    preferred: 0,
    importance: 0,
    confidence: 0
  },

  /*
    Datos que siguen siendo categorías y no dimensiones continuas.
  */

  categorical: {
    home_preferences: [],
    neighborhood_preferences: [],
    interests: [],
    traits: [],
    dealbreakers: []
  },

  /*
    INTERACTIONS

    Cada respuesta puede alimentar varias dimensiones.
    Esto es la materia prima del ROOMS DNA.
  */

  interactions: [
    {
      id: 'friday_night',
      act: 'vibe',
      type: 'forced_choice',
      eyebrow: 'FRIDAY NIGHT',
      prompt: 'Tu casa ideal a las 22:30.',
      options: [
        {
          id: 'alive',
          label: 'Cena, música, gente y algo pasando',
          signals: [
            { dimension: 'social_energy', field: 'self', value: 0.75 },
            { dimension: 'home_activity', field: 'self', value: 0.85 },
            { dimension: 'visitor_tolerance', field: 'self', value: 0.65 },
            { dimension: 'noise_tolerance', field: 'self', value: 0.45 },
            { dimension: 'community_orientation', field: 'self', value: 0.55 },
            { dimension: 'privacy', field: 'self', value: -0.20 }
          ]
        },
        {
          id: 'reset',
          label: 'Sofá, calma y bajar revoluciones',
          signals: [
            { dimension: 'social_energy', field: 'self', value: -0.50 },
            { dimension: 'home_activity', field: 'self', value: -0.80 },
            { dimension: 'visitor_tolerance', field: 'self', value: -0.35 },
            { dimension: 'noise_tolerance', field: 'self', value: -0.55 },
            { dimension: 'privacy', field: 'self', value: 0.65 },
            { dimension: 'community_orientation', field: 'self', value: -0.25 }
          ]
        }
      ]
    },

    {
      id: 'day_off',
      act: 'vibe',
      type: 'forced_choice',
      eyebrow: 'DAY OFF',
      prompt: 'Mañana tienes el día libre.',
      options: [
        {
          id: 'rough_plan',
          label: 'Me gusta tener más o menos un plan.',
          signals: [
            { dimension: 'spontaneity', field: 'self', value: -0.80 },
            { dimension: 'boundaries', field: 'self', value: 0.15 }
          ]
        },
        {
          id: 'go_with_flow',
          label: 'Ya veré dónde acaba el día.',
          signals: [
            { dimension: 'spontaneity', field: 'self', value: 0.90 },
            { dimension: 'boundaries', field: 'self', value: -0.20 }
          ]
        }
      ]
    },

    {
      id: 'plans_change',
      act: 'vibe',
      type: 'forced_choice',
      eyebrow: 'CHANGE OF PLANS',
      prompt: 'El plan cambia una hora antes.',
      options: [
        {
          id: 'improvise',
          label: 'Perfecto. Ya veremos qué hacemos.',
          signals: [
            { dimension: 'spontaneity', field: 'self', value: 0.90 },
            { dimension: 'communication', field: 'self', value: -0.20 },
            { dimension: 'boundaries', field: 'self', value: -0.15 }
          ]
        },
        {
          id: 'tell_me_before',
          label: 'Avísame con tiempo, por favor.',
          signals: [
            { dimension: 'spontaneity', field: 'self', value: -0.75 },
            { dimension: 'communication', field: 'self', value: 0.60 },
            { dimension: 'boundaries', field: 'self', value: 0.35 }
          ]
        }
      ]
    },

    /*
      ACT 2 — LIVING WITH YOU

      Situaciones concretas.
      Tienen más autoridad que una etiqueta
      autodeclarada porque describen comportamiento
      y límites en convivencia real.
    */

    {
      id: 'friends_tuesday',
      act: 'living',
      type: 'scenario',
      eyebrow: 'TUESDAY · 23:00',
      prompt: 'Tu compañero escribe: “Vienen unos amigos ahora”.',
      options: [
        {
          id: 'love_it',
          label: 'Perfecto. Que vengan.',
          signals: [
            { dimension: 'visitor_tolerance', field: 'self', value: 0.95 },
            { dimension: 'visitor_tolerance', field: 'preferred', value: 0.70 },
            { dimension: 'visitor_tolerance', field: 'importance', value: -0.20 },
            { dimension: 'social_energy', field: 'self', value: 0.70 },
            { dimension: 'noise_tolerance', field: 'self', value: 0.70 },
            { dimension: 'home_activity', field: 'self', value: 0.75 },
            { dimension: 'spontaneity', field: 'self', value: 0.65 },
            { dimension: 'boundaries', field: 'self', value: -0.45 }
          ]
        },
        {
          id: 'tell_me',
          label: 'Bien, pero avísame antes.',
          signals: [
            { dimension: 'visitor_tolerance', field: 'self', value: 0.35 },
            { dimension: 'visitor_tolerance', field: 'preferred', value: 0.25 },
            { dimension: 'visitor_tolerance', field: 'importance', value: 0.35 },
            { dimension: 'social_energy', field: 'self', value: 0.20 },
            { dimension: 'communication', field: 'self', value: 0.80 },
            { dimension: 'boundaries', field: 'self', value: 0.45 },
            { dimension: 'spontaneity', field: 'self', value: -0.35 }
          ]
        },
        {
          id: 'not_weekdays',
          label: 'Entre semana prefiero que no.',
          signals: [
            { dimension: 'visitor_tolerance', field: 'self', value: -0.55 },
            { dimension: 'visitor_tolerance', field: 'preferred', value: -0.65 },
            { dimension: 'visitor_tolerance', field: 'importance', value: 0.70 },
            { dimension: 'noise_tolerance', field: 'self', value: -0.70 },
            { dimension: 'schedule_style', field: 'self', value: -0.40 },
            { dimension: 'boundaries', field: 'self', value: 0.75 },
            { dimension: 'communication', field: 'self', value: 0.45 }
          ]
        }
      ]
    },

    {
      id: 'dishes_overnight',
      act: 'living',
      type: 'scenario',
      eyebrow: 'THE SINK',
      prompt: 'Los platos del desayuno siguen ahí por la noche.',
      options: [
        {
          id: 'whatever',
          label: 'Cero drama.',
          signals: [
            { dimension: 'cleanliness', field: 'self', value: -0.75 },
            { dimension: 'cleanliness', field: 'preferred', value: -0.45 },
            { dimension: 'cleanliness', field: 'importance', value: -0.55 },
            { dimension: 'boundaries', field: 'self', value: -0.25 },
            { dimension: 'communication', field: 'self', value: -0.20 },
            { dimension: 'sharing_style', field: 'self', value: 0.20 }
          ]
        },
        {
          id: 'tomorrow_ok',
          label: 'Hoy vale. Mañana, fuera.',
          signals: [
            { dimension: 'cleanliness', field: 'self', value: 0.25 },
            { dimension: 'cleanliness', field: 'preferred', value: 0.35 },
            { dimension: 'cleanliness', field: 'importance', value: 0.15 },
            { dimension: 'boundaries', field: 'self', value: 0.25 },
            { dimension: 'communication', field: 'self', value: 0.20 }
          ]
        },
        {
          id: 'needs_cleaning',
          label: 'No. Las zonas comunes se recogen.',
          signals: [
            { dimension: 'cleanliness', field: 'self', value: 0.95 },
            { dimension: 'cleanliness', field: 'preferred', value: 0.90 },
            { dimension: 'cleanliness', field: 'importance', value: 0.85 },
            { dimension: 'boundaries', field: 'self', value: 0.65 },
            { dimension: 'communication', field: 'self', value: 0.45 },
            { dimension: 'sharing_style', field: 'self', value: -0.20 }
          ]
        }
      ]
    },

    {
      id: 'partner_three_nights',
      act: 'living',
      type: 'scenario',
      eyebrow: 'PLUS ONE',
      prompt: 'La pareja de tu compañero duerme en casa tres noches esta semana.',
      options: [
        {
          id: 'all_good',
          label: 'Mientras estemos a gusto, genial.',
          signals: [
            { dimension: 'visitor_tolerance', field: 'self', value: 0.75 },
            { dimension: 'privacy', field: 'self', value: -0.35 },
            { dimension: 'privacy', field: 'preferred', value: -0.20 },
            { dimension: 'privacy', field: 'importance', value: -0.25 },
            { dimension: 'sharing_style', field: 'self', value: 0.45 },
            { dimension: 'boundaries', field: 'self', value: -0.30 }
          ]
        },
        {
          id: 'sometimes',
          label: 'Alguna vez sí. Tres noches ya es otra cosa.',
          signals: [
            { dimension: 'visitor_tolerance', field: 'self', value: 0.05 },
            { dimension: 'privacy', field: 'self', value: 0.35 },
            { dimension: 'privacy', field: 'preferred', value: 0.45 },
            { dimension: 'privacy', field: 'importance', value: 0.55 },
            { dimension: 'boundaries', field: 'self', value: 0.50 },
            { dimension: 'communication', field: 'self', value: 0.45 }
          ]
        },
        {
          id: 'too_much',
          label: 'Para mí eso ya cambia la convivencia.',
          signals: [
            { dimension: 'visitor_tolerance', field: 'self', value: -0.70 },
            { dimension: 'privacy', field: 'self', value: 0.90 },
            { dimension: 'privacy', field: 'preferred', value: 0.80 },
            { dimension: 'privacy', field: 'importance', value: 0.90 },
            { dimension: 'boundaries', field: 'self', value: 0.90 },
            { dimension: 'communication', field: 'self', value: 0.60 },
            { dimension: 'sharing_style', field: 'self', value: -0.50 }
          ]
        }
      ]
    },

    /*
      ACT 2 — LIVING WITH YOU
      Última situación de convivencia.
    */

    {
      id: 'shared_groceries',
      act: 'living',
      type: 'scenario',
      eyebrow: 'THE FRIDGE',
      prompt: 'Alguien se termina algo tuyo de la nevera.',
      options: [
        {
          id: 'share_everything',
          label: 'Da igual. En casa compartimos.',
          signals: [
            { dimension: 'sharing_style', field: 'self', value: 0.90 },
            { dimension: 'sharing_style', field: 'preferred', value: 0.70 },
            { dimension: 'sharing_style', field: 'importance', value: -0.25 },
            { dimension: 'boundaries', field: 'self', value: -0.55 },
            { dimension: 'communication', field: 'self', value: -0.25 },
            { dimension: 'community_orientation', field: 'self', value: 0.55 }
          ]
        },
        {
          id: 'ask_first',
          label: 'Claro, pero pregúntame antes.',
          signals: [
            { dimension: 'sharing_style', field: 'self', value: 0.30 },
            { dimension: 'sharing_style', field: 'preferred', value: 0.25 },
            { dimension: 'sharing_style', field: 'importance', value: 0.25 },
            { dimension: 'boundaries', field: 'self', value: 0.45 },
            { dimension: 'communication', field: 'self', value: 0.75 }
          ]
        },
        {
          id: 'mine_is_mine',
          label: 'Prefiero que cada uno tenga sus cosas.',
          signals: [
            { dimension: 'sharing_style', field: 'self', value: -0.85 },
            { dimension: 'sharing_style', field: 'preferred', value: -0.70 },
            { dimension: 'sharing_style', field: 'importance', value: 0.60 },
            { dimension: 'boundaries', field: 'self', value: 0.85 },
            { dimension: 'privacy', field: 'self', value: 0.35 },
            { dimension: 'communication', field: 'self', value: 0.35 }
          ]
        }
      ]
    },

    /*
      ACT 3 — YOUR HOME

      Preferencias explícitas.
      No inferimos personalidad de ellas.
    */

    {
      id: 'home_priorities',
      act: 'home',
      type: 'priority_board',
      eyebrow: 'YOUR PLACE',
      prompt: '¿Qué convierte un piso en tu casa?',
      items: [
        { id: 'natural_light', label: 'Luz natural' },
        { id: 'terrace', label: 'Terraza' },
        { id: 'exterior', label: 'Exterior' },
        { id: 'private_bathroom', label: 'Baño privado' },
        { id: 'transport', label: 'Bien conectado' }
      ],
      levels: [
        { id: 'neutral', label: 'Me da igual' },
        { id: 'like', label: 'Me gustaría' },
        { id: 'need', label: 'Lo necesito' }
      ],
      options: [
        {
          id: 'natural_light_neutral',
          itemId: 'natural_light',
          levelId: 'neutral',
          categorical: {
            home_preferences: {
              item: 'natural_light',
              level: 'neutral'
            }
          },
          signals: []
        },
        {
          id: 'natural_light_like',
          itemId: 'natural_light',
          levelId: 'like',
          categorical: {
            home_preferences: {
              item: 'natural_light',
              level: 'like'
            }
          },
          signals: []
        },
        {
          id: 'natural_light_need',
          itemId: 'natural_light',
          levelId: 'need',
          categorical: {
            home_preferences: {
              item: 'natural_light',
              level: 'need'
            }
          },
          signals: []
        },

        {
          id: 'terrace_neutral',
          itemId: 'terrace',
          levelId: 'neutral',
          categorical: {
            home_preferences: {
              item: 'terrace',
              level: 'neutral'
            }
          },
          signals: []
        },
        {
          id: 'terrace_like',
          itemId: 'terrace',
          levelId: 'like',
          categorical: {
            home_preferences: {
              item: 'terrace',
              level: 'like'
            }
          },
          signals: []
        },
        {
          id: 'terrace_need',
          itemId: 'terrace',
          levelId: 'need',
          categorical: {
            home_preferences: {
              item: 'terrace',
              level: 'need'
            }
          },
          signals: []
        },

        {
          id: 'exterior_neutral',
          itemId: 'exterior',
          levelId: 'neutral',
          categorical: {
            home_preferences: {
              item: 'exterior',
              level: 'neutral'
            }
          },
          signals: []
        },
        {
          id: 'exterior_like',
          itemId: 'exterior',
          levelId: 'like',
          categorical: {
            home_preferences: {
              item: 'exterior',
              level: 'like'
            }
          },
          signals: []
        },
        {
          id: 'exterior_need',
          itemId: 'exterior',
          levelId: 'need',
          categorical: {
            home_preferences: {
              item: 'exterior',
              level: 'need'
            }
          },
          signals: []
        },

        {
          id: 'private_bathroom_neutral',
          itemId: 'private_bathroom',
          levelId: 'neutral',
          categorical: {
            home_preferences: {
              item: 'private_bathroom',
              level: 'neutral'
            }
          },
          signals: []
        },
        {
          id: 'private_bathroom_like',
          itemId: 'private_bathroom',
          levelId: 'like',
          categorical: {
            home_preferences: {
              item: 'private_bathroom',
              level: 'like'
            }
          },
          signals: []
        },
        {
          id: 'private_bathroom_need',
          itemId: 'private_bathroom',
          levelId: 'need',
          categorical: {
            home_preferences: {
              item: 'private_bathroom',
              level: 'need'
            }
          },
          signals: []
        },

        {
          id: 'transport_neutral',
          itemId: 'transport',
          levelId: 'neutral',
          categorical: {
            home_preferences: {
              item: 'transport',
              level: 'neutral'
            }
          },
          signals: []
        },
        {
          id: 'transport_like',
          itemId: 'transport',
          levelId: 'like',
          categorical: {
            home_preferences: {
              item: 'transport',
              level: 'like'
            }
          },
          signals: []
        },
        {
          id: 'transport_need',
          itemId: 'transport',
          levelId: 'need',
          categorical: {
            home_preferences: {
              item: 'transport',
              level: 'need'
            }
          },
          signals: []
        }
      ]
    },

    /*
      ACT 4 — YOUR WORLD
    */

    {
      id: 'world_interests',
      act: 'world',
      type: 'interest',
      eyebrow: 'YOUR WORLD',
      prompt: 'Elige lo que forma parte de tu mundo.',
      maxSelections: 5,
      options: [
        { id: 'sport', label: 'Deporte', categorical: { interests: 'sport' }, signals: [] },
        { id: 'music', label: 'Música', categorical: { interests: 'music' }, signals: [] },
        { id: 'food', label: 'Food', categorical: { interests: 'food' }, signals: [] },
        { id: 'travel', label: 'Viajes', categorical: { interests: 'travel' }, signals: [] },
        { id: 'nightlife', label: 'Salir', categorical: { interests: 'nightlife' }, signals: [] },
        { id: 'cinema', label: 'Cine', categorical: { interests: 'cinema' }, signals: [] },
        { id: 'gaming', label: 'Gaming', categorical: { interests: 'gaming' }, signals: [] },
        { id: 'art', label: 'Arte', categorical: { interests: 'art' }, signals: [] },
        { id: 'reading', label: 'Leer', categorical: { interests: 'reading' }, signals: [] },
        { id: 'nature', label: 'Naturaleza', categorical: { interests: 'nature' }, signals: [] },
        { id: 'fashion', label: 'Fashion', categorical: { interests: 'fashion' }, signals: [] },
        { id: 'pets', label: 'Animales', categorical: { interests: 'pets' }, signals: [] }
      ]
    },

    {
      id: 'self_description',
      act: 'world',
      type: 'self_reported_trait',
      eyebrow: 'NO OVERTHINKING',
      prompt: 'Tus amigos dirían que eres…',
      maxSelections: 3,
      options: [
        {
          id: 'social',
          label: 'Sociable',
          categorical: { traits: 'social' },
          signals: [
            { dimension: 'social_energy', field: 'self', value: 0.70 }
          ]
        },
        {
          id: 'calm',
          label: 'Tranquilo/a',
          categorical: { traits: 'calm' },
          signals: [
            { dimension: 'home_activity', field: 'self', value: -0.55 },
            { dimension: 'noise_tolerance', field: 'self', value: -0.35 }
          ]
        },
        {
          id: 'independent',
          label: 'Independiente',
          categorical: { traits: 'independent' },
          signals: [
            { dimension: 'privacy', field: 'self', value: 0.55 },
            { dimension: 'community_orientation', field: 'self', value: -0.35 }
          ]
        },
        {
          id: 'organised',
          label: 'Organizado/a',
          categorical: { traits: 'organised' },
          signals: [
            { dimension: 'cleanliness', field: 'self', value: 0.60 },
            { dimension: 'spontaneity', field: 'self', value: -0.25 }
          ]
        },
        {
          id: 'spontaneous',
          label: 'Espontáneo/a',
          categorical: { traits: 'spontaneous' },
          signals: [
            { dimension: 'spontaneity', field: 'self', value: 0.70 }
          ]
        },
        {
          id: 'communicative',
          label: 'Comunicativo/a',
          categorical: { traits: 'communicative' },
          signals: [
            { dimension: 'communication', field: 'self', value: 0.65 }
          ]
        },
        {
          id: 'homebody',
          label: 'Muy de casa',
          categorical: { traits: 'homebody' },
          signals: [
            { dimension: 'home_activity', field: 'self', value: -0.30 }
          ]
        },
        {
          id: 'easygoing',
          label: 'Easygoing',
          categorical: { traits: 'easygoing' },
          signals: [
            { dimension: 'boundaries', field: 'self', value: -0.30 },
            { dimension: 'spontaneity', field: 'self', value: 0.25 }
          ]
        }
      ]
    }

  ],

  /*
    El reveal NO se calcula todavía aquí.
    Lo conectaremos cuando tengamos scoring real.
  */

  reveal: {
    enabled: true,
    shareable: true,
    archetype: null,
    descriptor: null,
    summary: null,
    imageKey: null
  },

  /*
    Guardaremos también evidencia para poder explicar
    de dónde sale cualquier resultado del DNA.
  */

  evidence: {
    enabled: true,

    example: {
      interactionId: 'example',
      answerId: 'example_answer',
      dimension: 'social_energy',
      field: 'self',
      contribution: 0.7,
      source: 'scenario'
    }
  }
};
