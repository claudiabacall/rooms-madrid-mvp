(function () {
  'use strict';

  function createCommunityDetailCoreFeature({
    db,
    state,
    notify,
    renderRealCommunityDetail
  }) {
    async function openRealCommunity(communityId) {
      const community =
        state.communities?.get(communityId);

      if (!community) {
        notify('No encuentro esta comunidad');
        return;
      }

      state.activeCommunity = community;

      const { data: members, error } = await db
        .from('community_members')
        .select('community_id,user_id,role,status,joined_at')
        .eq('community_id', communityId)
        .eq('status', 'active')
        .order('joined_at', { ascending: true });

      if (error) {
        console.error(
          'Rooms: error cargando miembros de comunidad',
          error
        );
      }

      state.activeCommunityMembers =
        members || [];

      const membership =
        state.activeCommunityMembers.find(
          item => item.user_id === state.user?.id
        ) || null;

      state.activeCommunityMembership =
        membership;

      renderRealCommunityDetail();

      const feedMain =
        document.querySelector('.feed-main');

      const exploreView =
        document.querySelector('#exploreView');

      const communitiesView =
        document.querySelector('#communitiesView');

      const householdView =
        document.querySelector('#householdView');

      const ownProfileView =
        document.querySelector('#ownProfileView');

      const savedView =
        document.querySelector('#savedView');

      const settingsView =
        document.querySelector('#settingsView');

      const trustView =
        document.querySelector('#trustView');

      [
        feedMain,
        exploreView,
        communitiesView,
        householdView,
        ownProfileView,
        savedView,
        settingsView,
        trustView
      ]
        .filter(Boolean)
        .forEach(view => {
          view.hidden = true;
        });

      const communityView =
        document.querySelector('#communityView');

      if (communityView) {
        communityView.hidden = false;
      }

      document
        .querySelectorAll('[data-bottom-nav]')
        .forEach(button => {
          button.classList.toggle(
            'active',
            button.dataset.bottomNav === 'communities'
          );
        });

      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    }

    return {
      openRealCommunity
    };
  }

  window.ROOMS_COMMUNITY_DETAIL_CORE_FEATURE = {
    create: createCommunityDetailCoreFeature
  };
})();
