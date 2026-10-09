(function () {
  'use strict';

  function createFeedCommunityCardFeature({
    state,
    escapeHtml
  }) {
    function renderCommunityCard(community) {
      const memberCount =
        state.communityMemberCounts?.get(community.id) || 0;

      const memberText =
        memberCount === 1
          ? '1 miembro'
          : `${memberCount.toLocaleString('es-ES')} miembros`;

      const visibility =
        community.visibility === 'private'
          ? 'PRIVADA'
          : 'PÚBLICA';

      const description =
        community.description ||
        'Personas que comparten un lugar, una etapa o algo en común.';

      return `
        <article
          class="feed-card home-community-social-card"
          data-feed-type="community"
          data-real-community="${escapeHtml(community.id)}"
        >

          <div class="home-community-graphic">

            <div class="home-community-graphic-top">
              <span>COMUNIDAD</span>
              <small>${visibility}</small>
            </div>

            <div class="home-community-hash">
              #
            </div>

            <div class="home-community-member-stat">
              <strong>${memberCount.toLocaleString('es-ES')}</strong>
              <span>
                ${memberCount === 1 ? 'MIEMBRO' : 'MIEMBROS'}
              </span>
            </div>

          </div>


          <div class="home-community-info">

            <div class="home-community-eyebrow">
              <span>ROOMS COMMUNITY</span>
              <i></i>
            </div>

            <div class="home-community-main-copy">

              <h2>
                ${escapeHtml(community.name)}
              </h2>

              <p>
                ${escapeHtml(description)}
              </p>

            </div>


            <div class="home-community-social-proof">

              <div class="home-community-avatars">
                <span>#</span>
                <span>R</span>
                <span>+</span>
              </div>

              <div>
                <b>${memberText}</b>
                <small>forman parte de esta comunidad</small>
              </div>

            </div>


            <div class="home-community-action">

              <div>
                <small>ESPACIO COMPARTIDO</small>
                <span>Conecta, comparte y participa.</span>
              </div>

              <button
                type="button"
                data-real-community-open="${escapeHtml(community.id)}"
              >
                Entrar
                <b>↗</b>
              </button>

            </div>

          </div>

        </article>
      `;
    }

    return { renderCommunityCard };
  }

  window.ROOMS_FEED_COMMUNITY_CARD_FEATURE = {
    create: createFeedCommunityCardFeature
  };
})();
