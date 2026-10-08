(function () {
  'use strict';

  function createCommunityMembershipFeature({
    db,
    state,
    notify,
    escapeHtml,
    openRealCommunity
  }) {
    async function loadMemberCommunities() {
      const grid = document.querySelector('#memberCommunitiesGrid');

      if (!grid || !state.user) return;

      const { data: memberships, error } = await db
        .from('community_members')
        .select('community_id,role,status,joined_at')
        .eq('user_id', state.user.id)
        .order('joined_at', { ascending: false });

      if (error) {
        console.error('Rooms: error cargando comunidades del usuario', error);

        grid.innerHTML = `
          <div class="communities-empty-card">
            <span>#</span>
            <h3>No hemos podido cargar tus comunidades</h3>
            <p>Vuelve a intentarlo en unos segundos.</p>
          </div>
        `;

        return;
      }

      state.communityMemberships = memberships || [];

      renderMemberCommunities();
    }


    function renderMemberCommunities() {
      const grid = document.querySelector('#memberCommunitiesGrid');

      if (!grid) return;

      const memberships = state.communityMemberships || [];

      const memberCommunities = memberships
        .map(membership => {
          const community =
            state.communities?.get(membership.community_id);

          if (!community) return null;

          return {
            ...community,
            membershipRole: membership.role,
            membershipStatus: membership.status,
            joinedAt: membership.joined_at
          };
        })
        .filter(Boolean);

      if (!memberCommunities.length) {
        grid.innerHTML = `
          <div class="communities-empty-card">
            <span>#</span>

            <h3>Todavía no perteneces a ninguna comunidad</h3>

            <p>
              Las comunidades a las que te unas desde Explore
              aparecerán aquí.
            </p>
          </div>
        `;

        return;
      }

      grid.innerHTML = memberCommunities
        .map(community => `
          <button
            type="button"
            class="member-community-card"
            data-member-community-open="${escapeHtml(community.id)}"
          >
            <div class="member-community-card-media">
              ${
                community.image_url
                  ? `
                    <img
                      src="${escapeHtml(community.image_url)}"
                      alt="${escapeHtml(community.name)}"
                    >
                  `
                  : `
                    <div class="member-community-placeholder">
                      #
                    </div>
                  `
              }

              <span class="member-community-role">
                ${
                  community.membershipRole === 'owner'
                    ? 'ADMIN'
                    : 'MIEMBRO'
                }
              </span>
            </div>

            <div class="member-community-card-body">
              <small>COMUNIDAD</small>

              <h3>${escapeHtml(community.name)}</h3>

              <p>
                ${escapeHtml(
                  community.description ||
                  'Comunidad de Rooms'
                )}
              </p>

              <div class="member-community-card-footer">
                <span>Entrar</span>
                <b>→</b>
              </div>
            </div>
          </button>
        `)
        .join('');
    }

    async function toggleRealCommunityMembership(
      communityId
    ) {
      if (!state.user) {
        notify('Necesitas iniciar sesión');
        return;
      }

      const community =
        state.communities?.get(communityId);

      if (!community) return;

      const current =
        state.activeCommunityMembership;

      if (current) {

        if (
          current.role === 'owner' ||
          community.owner_id === state.user.id
        ) {
          notify(
            'El propietario no puede salir de su propia comunidad'
          );
          return;
        }

        const { error } = await db
          .from('community_members')
          .delete()
          .eq('community_id', communityId)
          .eq('user_id', state.user.id);

        if (error) {
          console.error(
            'Rooms: error saliendo de comunidad',
            error
          );

          notify('No hemos podido salir de la comunidad');
          return;
        }

        notify('Has salido de la comunidad');

      } else {

        const { error } = await db
          .from('community_members')
          .insert({
            community_id: communityId,
            user_id: state.user.id,
            role: 'member',
            status: 'active'
          });

        if (error) {
          console.error(
            'Rooms: error uniéndose a comunidad',
            error
          );

          notify('No hemos podido unirte a la comunidad');
          return;
        }

        notify('Te has unido a la comunidad');
      }

      await loadMemberCommunities();
      await openRealCommunity(communityId);
    }

    return {
      loadMemberCommunities,
      renderMemberCommunities,
      toggleRealCommunityMembership
    };
  }

  window.ROOMS_COMMUNITY_MEMBERSHIP_FEATURE = {
    create: createCommunityMembershipFeature
  };
})();
