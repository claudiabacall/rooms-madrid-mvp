(function () {
  'use strict';

  function createOwnProfileFeature({
    state,
    escapeHtml,
    formatBudget,
    roomsDnaLivingRows
  }) {
function ensureOwnPublicProfileModal() {
      let modal = document.querySelector('#ownPublicProfileModal');
      if (modal) return modal;

      modal = document.createElement('div');
      modal.className = 'modal';
      modal.id = 'ownPublicProfileModal';
      modal.setAttribute('aria-hidden', 'true');

      modal.innerHTML = `
        <div class="backdrop" data-close-own-public-profile></div>

        <article class="detail user-profile-shell own-public-profile-shell">
          <button
            class="close profile-back"
            type="button"
            data-close-own-public-profile
            aria-label="Volver">←</button>

          <div class="profile-hero own-public-profile-hero">
            <div id="ownPublicAvatar" class="own-public-avatar"></div>
          </div>

          <div class="user-profile-content">
            <section class="user-profile-header">
              <div class="profile-title">
                <span id="ownPublicVerification">PERFIL</span>
                <h2 id="ownPublicName">Mi perfil</h2>
                <p id="ownPublicBio"></p>
              </div>

              <div class="profile-looking">
                <span>
                  <small>BUSCA AHORA</small>
                  <b id="ownPublicSeeking">Sin definir</b>
                </span>
                <span>
                  <small>ZONA</small>
                  <b id="ownPublicZones">Sin definir</b>
                </span>
                <span>
                  <small>PRESUPUESTO</small>
                  <b id="ownPublicBudget">Sin definir</b>
                </span>
              </div>
            </section>

            <section class="user-section">
              <h3>Sobre mí</h3>
              <p id="ownPublicAbout"></p>
              <div
                class="profile-interest-chips"
                id="ownPublicInterests">
              </div>
            </section>

            <section class="user-section">
              <h3>Cómo vivo</h3>
              <div
                class="lifestyle-grid"
                id="ownPublicLiving">
              </div>
            </section>

            <section class="user-section">
              <h3>Qué busco</h3>

              <div class="looking-grid">
                <span>
                  <small>TIPO</small>
                  <b id="ownPublicLookingType"></b>
                </span>

                <span>
                  <small>ZONAS</small>
                  <b id="ownPublicLookingZones"></b>
                </span>

                <span>
                  <small>PRESUPUESTO</small>
                  <b id="ownPublicLookingBudget"></b>
                </span>

                <span>
                  <small>FECHA</small>
                  <b id="ownPublicMoveDate"></b>
                </span>

                <span>
                  <small>DURACIÓN</small>
                  <b id="ownPublicDuration"></b>
                </span>
              </div>
            </section>

            <aside class="own-public-preview-note">
              <b>Así ven tu perfil otras personas.</b>
              <p>
                Esta vista solo muestra la información pública de tu perfil.
              </p>
            </aside>
          </div>
        </article>
      `;

      document.body.appendChild(modal);
      return modal;
    }

    function canShowOwnProfileSection(section, viewerType = 'public') {
      const controls = state.preferences?.answers?.privacy?.controls || {};
      const setting = controls[section] || 'public';

      if (setting === 'public') return true;
      if (setting === 'connections') return viewerType === 'connection';
      return false;
    }


    function renderOwnPublicProfile() {
      const profile = state.profile;
      if (!profile) return;

      const modal = ensureOwnPublicProfileModal();
      const answers = state.preferences?.answers || {};

      const name = profile.alias || profile.name || 'Mi perfil';

      const seekingLabels = {
        room: 'Habitación',
        home: 'Piso entero',
        mates: 'Compañeros'
      };

      const interestLabels = {
        sport: 'Deporte',
        music: 'Música',
        cooking: 'Cocina',
        travel: 'Viajes',
        gym: 'Gym',
        gaming: 'Gaming',
        reading: 'Lectura',
        'going-out': 'Salir',
        'quiet-plans': 'Planes tranquilos',
        pets: 'Mascotas'
      };

      const durationLabels = {
        '1-3': '1–3 meses',
        '3-6': '3–6 meses',
        '6-12': '6–12 meses',
        '12+': 'Más de 1 año',
        unknown: 'No lo sé todavía'
      };

      const livingNames = [
        'Limpieza',
        'Horarios',
        'Ruido',
        'Visitas',
        'Fiestas en casa',
        'Teletrabajo / estudio',
        'Fumar',
        'Mascotas'
      ];

      const livingOptions = [
        ['Muy ordenado', 'Normal', 'Flexible'],
        ['Madrugador', 'Horario normal', 'Nocturno'],
        ['Muy tranquilo', 'Algo de ambiente', 'Me adapto'],
        ['Pocas', 'Con aviso', 'Sin problema'],
        ['Nunca', 'Alguna vez', 'Me da igual'],
        ['Mucho', 'A veces', 'Casi nunca'],
        ['No', 'Solo fuera', 'Me da igual'],
        ['Me encantan', 'Me da igual', 'Prefiero no']
      ];

      const initials = name
        .split(/\s+/)
        .slice(0, 2)
        .map(part => part[0])
        .join('')
        .toUpperCase();

      const avatar = modal.querySelector('#ownPublicAvatar');

      avatar.innerHTML = profile.avatar_url
        ? `<img src="${escapeHtml(profile.avatar_url)}" alt="${escapeHtml(name)}">`
        : `<span>${escapeHtml(initials || 'R')}</span>`;

      modal.querySelector('#ownPublicVerification').textContent =
        state.user?.email_confirmed_at ? 'EMAIL VERIFICADO ✓' : 'PERFIL';

      modal.querySelector('#ownPublicName').textContent =
        profile.age ? `${name}, ${profile.age}` : name;

      modal.querySelector('#ownPublicBio').textContent =
        profile.bio || 'Aún no has añadido una bio.';

      modal.querySelector('#ownPublicAbout').textContent =
        profile.bio || 'Aún no has añadido información sobre ti.';

      const interests = (profile.interests || [])
        .map(value => interestLabels[value])
        .filter(Boolean);

      modal.querySelector('#ownPublicInterests').innerHTML =
        interests.length
          ? interests.map(item => `<span>${escapeHtml(item)}</span>`).join('')
          : '<span>Sin intereses añadidos</span>';

      const seeking = (profile.seeking || [])
        .map(value => seekingLabels[value])
        .filter(Boolean);

      const zones = profile.zones || [];

      modal.querySelector('#ownPublicSeeking').textContent =
        seeking.join(' · ') || 'Sin definir';

      modal.querySelector('#ownPublicZones').textContent =
        zones.join(' · ') || 'Sin definir';

      modal.querySelector('#ownPublicBudget').textContent =
        profile.budget_min || profile.budget_max
          ? formatBudget(profile)
          : 'Sin definir';

      modal.querySelector('#ownPublicLookingType').textContent =
        seeking.join(' · ') || 'Sin definir';

      modal.querySelector('#ownPublicLookingZones').textContent =
        zones.join(' · ') || 'Sin definir';

      modal.querySelector('#ownPublicLookingBudget').textContent =
        profile.budget_min || profile.budget_max
          ? formatBudget(profile)
          : 'Sin definir';

      modal.querySelector('#ownPublicMoveDate').textContent =
        profile.move_in_date
          ? new Intl.DateTimeFormat('es-ES', {
              day: 'numeric',
              month: 'long',
              year: 'numeric'
            }).format(
              new Date(`${profile.move_in_date}T00:00:00`)
            )
          : 'Sin definir';

      modal.querySelector('#ownPublicDuration').textContent =
        durationLabels[profile.duration] || 'Sin definir';

      const viewerType = 'public';

      const showLiving = canShowOwnProfileSection('living', viewerType);
      const showSearch = canShowOwnProfileSection('search', viewerType);
      const showBudget = canShowOwnProfileSection('budget', viewerType);

      const livingSection =
        modal.querySelector('#ownPublicLiving')?.closest('.user-section');

      if (livingSection) {
        livingSection.hidden = !showLiving;
      }

      const lookingSection =
        modal.querySelector('#ownPublicLookingType')?.closest('.user-section');

      if (lookingSection) {
        lookingSection.hidden = !showSearch && !showBudget;
      }

      const topSeeking =
        modal.querySelector('#ownPublicSeeking')?.closest('span');

      const topZones =
        modal.querySelector('#ownPublicZones')?.closest('span');

      const topBudget =
        modal.querySelector('#ownPublicBudget')?.closest('span');

      if (topSeeking) topSeeking.hidden = !showSearch;
      if (topZones) topZones.hidden = !showSearch;
      if (topBudget) topBudget.hidden = !showBudget;

      const lowerType =
        modal.querySelector('#ownPublicLookingType')?.closest('span');

      const lowerZones =
        modal.querySelector('#ownPublicLookingZones')?.closest('span');

      const lowerBudget =
        modal.querySelector('#ownPublicLookingBudget')?.closest('span');

      const lowerDate =
        modal.querySelector('#ownPublicMoveDate')?.closest('span');

      const lowerDuration =
        modal.querySelector('#ownPublicDuration')?.closest('span');

      if (lowerType) lowerType.hidden = !showSearch;
      if (lowerZones) lowerZones.hidden = !showSearch;
      if (lowerDate) lowerDate.hidden = !showSearch;
      if (lowerDuration) lowerDuration.hidden = !showSearch;
      if (lowerBudget) lowerBudget.hidden = !showBudget;

      const livingRows =
        roomsDnaLivingRows(
          state.roomsDna
        );

      modal.querySelector(
        '#ownPublicLiving'
      ).innerHTML =
        livingRows.length
          ? livingRows
              .map(([label, option]) => `
                <span>
                  <small>${escapeHtml(label)}</small>
                  <b>${escapeHtml(option)}</b>
                </span>
              `)
              .join('')
          : `
              <span>
                <small>CONVIVENCIA</small>
                <b>Sin datos añadidos</b>
              </span>
            `;

      return modal;
    }

    function openOwnPublicProfile() {
      const modal = renderOwnPublicProfile();
      if (!modal) return;

      modal.classList.add('open');
      modal.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
    }

    document.addEventListener('click', event => {
      if (event.target.closest('#previewOwnPublicProfile')) {
        openOwnPublicProfile();
        return;
      }

      if (event.target.closest('[data-close-own-public-profile]')) {
        const modal = document.querySelector('#ownPublicProfileModal');

        if (modal) {
          modal.classList.remove('open');
          modal.setAttribute('aria-hidden', 'true');
        }

        document.body.style.overflow = '';
      }
    });

    return {
      ensureOwnPublicProfileModal,
      canShowOwnProfileSection,
      renderOwnPublicProfile,
      openOwnPublicProfile
    };
  }

  window.ROOMS_OWN_PROFILE_FEATURE = {
    create: createOwnProfileFeature
  };
})();
