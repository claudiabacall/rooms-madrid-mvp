window.ROOMS_DNA = {
  version: 1,

  storage: {
    livingSelf: 'living_self',
    livingImportance: 'living_importance',
    dealbreakers: 'dealbreakers',
    homePreferences: 'home_preferences',
    neighborhoodPreferences: 'neighborhood_preferences',
    interests: 'interests',
    traits: 'traits'
  },

  thisOrThat: [
    {
      id: 'sunday_home',
      title: 'Domingo en casa',
      left: {
        id: 'quiet',
        label: 'Sofá, peli y tranquilidad'
      },
      right: {
        id: 'social',
        label: 'Comida larga con gente'
      },
      target: 'living_self'
    },
    {
      id: 'ideal_home_location',
      title: 'Tu casa ideal está…',
      left: {
        id: 'quiet_street',
        label: 'En una calle tranquila'
      },
      right: {
        id: 'active_area',
        label: 'Donde están pasando cosas'
      },
      target: 'neighborhood_preferences'
    },
    {
      id: 'tuesday_2330',
      title: 'Son las 23:30 un martes',
      left: {
        id: 'early',
        label: 'Probablemente durmiendo'
      },
      right: {
        id: 'late',
        label: 'Mi día todavía no ha terminado'
      },
      target: 'living_self'
    },
    {
      id: 'perfect_neighborhood',
      title: 'El barrio perfecto',
      left: {
        id: 'residential',
        label: 'Tranquilo / residencial'
      },
      right: {
        id: 'lively',
        label: 'Energía / planes'
      },
      target: 'neighborhood_preferences'
    }
  ],

  scenarioScale: [
    {
      id: 'fine',
      label: 'Me da igual',
      value: 0
    },
    {
      id: 'depends',
      label: 'Depende',
      value: 1
    },
    {
      id: 'strong',
      label: 'Me mataría',
      value: 2
    }
  ],

  scenarios: [
    {
      id: 'dishes_two_days',
      title: 'Los platos llevan dos días en el fregadero',
      target: 'living_self'
    },
    {
      id: 'six_friends_tonight',
      title: 'Tu compañero trae seis amigos esta noche',
      target: 'living_self'
    },
    {
      id: 'music_while_working',
      title: 'Hay música mientras trabajas',
      target: 'living_self'
    },
    {
      id: 'improvised_dinner',
      title: 'En casa se organiza una cena improvisada',
      target: 'living_self'
    },
    {
      id: 'working_from_home',
      title: 'Trabajar desde casa',
      target: 'living_self'
    }
  ],

  dealbreakerScale: [
    {
      id: 'adapt',
      label: 'Me adapto',
      value: false
    },
    {
      id: 'dealbreaker',
      label: 'Dealbreaker',
      value: true
    }
  ],

  dealbreakers: [
    {
      id: 'smoking_inside',
      label: 'Fumar dentro de casa'
    },
    {
      id: 'pets',
      label: 'Mascotas'
    },
    {
      id: 'frequent_parties',
      label: 'Fiestas frecuentes'
    },
    {
      id: 'very_frequent_visits',
      label: 'Visitas muy frecuentes'
    }
  ],

  homePreferenceScale: [
    {
      id: 'neutral',
      label: 'Me da igual',
      value: 0
    },
    {
      id: 'like',
      label: 'Me gustaría',
      value: 1
    },
    {
      id: 'need',
      label: 'Lo necesito',
      value: 2
    }
  ],

  homePreferences: [
    {
      id: 'natural_light',
      label: 'Luz natural'
    },
    {
      id: 'terrace',
      label: 'Terraza'
    },
    {
      id: 'exterior',
      label: 'Exterior'
    },
    {
      id: 'private_bathroom',
      label: 'Baño privado'
    },
    {
      id: 'transport',
      label: 'Buena conexión / transporte'
    }
  ],

  interests: [
    { id: 'sport', label: 'Deporte' },
    { id: 'music', label: 'Música' },
    { id: 'cooking', label: 'Cocina' },
    { id: 'travel', label: 'Viajes' },
    { id: 'gym', label: 'Gym' },
    { id: 'gaming', label: 'Gaming' },
    { id: 'reading', label: 'Lectura' },
    { id: 'going-out', label: 'Salir' },
    { id: 'quiet-plans', label: 'Planes tranquilos' },
    { id: 'pets', label: 'Mascotas' }
  ],

  traits: [
    { id: 'tidy', label: 'Ordenado' },
    { id: 'social', label: 'Sociable' },
    { id: 'calm', label: 'Tranquilo' },
    { id: 'independent', label: 'Independiente' },
    { id: 'cook', label: 'Cocinillas' },
    { id: 'early', label: 'Madrugador' },
    { id: 'night', label: 'Nocturno' }
  ],

  importanceScale: [
    {
      id: 'adapt',
      label: 'Me adapto'
    },
    {
      id: 'prefer_similar',
      label: 'Preferiría que sí'
    },
    {
      id: 'important',
      label: 'Es importante'
    }
  ],

  dynamicImportance: [
    {
      id: 'cleanliness',
      prompt:
        'Parece que tienes bastante claro cómo quieres encontrar las zonas comunes. ¿Necesitas que la persona con la que vivas sea parecida?'
    },
    {
      id: 'social_energy',
      prompt:
        'Tu forma de vivir la vida social en casa parece bastante definida. ¿Necesitas que la otra persona esté en una onda parecida?'
    },
    {
      id: 'quiet_focus',
      prompt:
        'El ruido y la forma de usar los espacios comunes parecen importantes para ti. ¿Necesitas que la otra persona funcione parecido?'
    },
    {
      id: 'daily_rhythm',
      prompt:
        'Tu ritmo diario parece bastante definido. ¿Necesitas que la persona con la que vivas tenga horarios parecidos?'
    }
  ],

  reveal: {
    title: 'YOUR ROOMS DNA',
    exampleDescriptor: 'Social, but selective'
  }
};
