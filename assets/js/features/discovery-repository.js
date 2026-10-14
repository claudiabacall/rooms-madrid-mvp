(function () {
  'use strict';

  function create({ db }) {
    if (!db) {
      throw new Error('Rooms: falta cliente Supabase');
    }

    function loadDiscoveryData() {
      return Promise.all([
        db.from('listings').select('*').eq('status', 'published').order('created_at', { ascending: false }),
        db.rpc('get_visible_profiles', { _target_user_id: null }),
        db.from('posts').select('*').eq('status', 'published').order('created_at', { ascending: false }),
        db.from('communities').select('*').eq('status', 'active').order('created_at', { ascending: false })
      ]);
    }

    function loadActiveCommunityMembers() {
      return db.from('community_members')
        .select('community_id')
        .eq('status', 'active');
    }

    return { loadDiscoveryData, loadActiveCommunityMembers };
  }

  window.ROOMS_DISCOVERY_REPOSITORY = { create };
})();
