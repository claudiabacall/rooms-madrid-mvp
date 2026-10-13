(function () {
  'use strict';

  function create({ db }) {
    if (!db) {
      throw new Error('Rooms: falta cliente Supabase');
    }

    async function loadSessionData(userId) {
      return Promise.all([
      db.from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle(),

      db.from('onboarding_preferences')
        .select('answers,updated_at')
        .eq('user_id', userId)
        .maybeSingle(),

      db.from('match_preferences')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle(),

      db.from('user_intents')
        .select('intent')
        .eq('user_id', userId),

      db.from('rooms_dna')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle()
      ]);
    }

    return { loadSessionData };
  }

  window.ROOMS_SESSION_REPOSITORY = { create };
})();
