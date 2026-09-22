(function () {
  'use strict';

  const config = window.ROOMS_SUPABASE;
  if (!config || !config.url || !config.key || !window.supabase) {
    console.error('Rooms: falta la configuración pública de Supabase.');
    return;
  }

  const db = window.supabase.createClient(config.url, config.key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  const state = {
    user: null,
    profile: null,
    preferences: null,
    targetProfile: null,
    reportTarget: null,
    blockTarget: null,
    blockedUsers: new Set(),
    connection: null,
    connectionsByUser: new Map(),
    chatTarget: null,
    conversationPreferences: new Map(),
    channel: null,
    currentListingId: null,
    living: {},
    profiles: new Map(),
    incomingRequests: new Map(),
    listings: new Map(),
    posts: new Map(),
    communities: new Map(),
    savedCollections: new Map()
    ,publishType: null,
    publishDraft: { steps: {}, files: [] }
  };

  window.roomsBackend = { db, state };

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>'"]/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    })[char]);
  }

  function notify(message) {
    if (typeof window.ping === 'function') window.ping(message);
    else console.log(message);
  }

  function showModal(element) {
    if (!element) return;
    element.classList.add('open');
    element.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function hideAllModals() {
    document.querySelectorAll('.modal').forEach(element => {
      element.classList.remove('open');
      element.setAttribute('aria-hidden', 'true');
    });
    document.body.style.overflow = '';
  }

  function injectAuthGate() {
    const gate = document.createElement('section');
    gate.className = 'auth-gate';
    gate.id = 'authGate';
    gate.innerHTML = `
      <article class="auth-panel">
        <span class="auth-brand">rooms<span>.</span></span>
        <h1>Encuentra dónde vivir. Y con quién.</h1>
        <p>Crea tu cuenta para guardar tus preferencias y conectar con otras personas.</p>
        <nav class="auth-tabs" aria-label="Acceso">
          <button class="active" type="button" data-auth-mode="login">Entrar</button>
          <button type="button" data-auth-mode="signup">Crear cuenta</button>
        </nav>
        <form class="auth-form" id="roomsAuthForm">
          <label id="authNameField" hidden>Nombre o alias
            <input id="authName" type="text" maxlength="40" autocomplete="name">
          </label>
          <label>Email
            <input id="authEmail" type="email" required autocomplete="email">
          </label>
          <label>Contraseña
            <input id="authPassword" type="password" minlength="6" required autocomplete="current-password">
          </label>
          <button class="auth-submit" id="authSubmit" type="submit">Entrar</button>
          <p class="auth-message" id="authMessage" role="status"></p>
        </form>
        <p class="auth-legal">Tus datos se guardan de forma privada. Rooms nunca comparte tu email ni tu contraseña con otros usuarios.</p>
      </article>`;
    document.body.appendChild(gate);

    let mode = 'login';
    gate.querySelectorAll('[data-auth-mode]').forEach(button => button.addEventListener('click', () => {
      mode = button.dataset.authMode;
      gate.querySelectorAll('[data-auth-mode]').forEach(item => item.classList.toggle('active', item === button));
      document.querySelector('#authNameField').hidden = mode !== 'signup';
      document.querySelector('#authName').required = mode === 'signup';
      document.querySelector('#authPassword').autocomplete = mode === 'signup' ? 'new-password' : 'current-password';
      document.querySelector('#authSubmit').textContent = mode === 'signup' ? 'Crear mi cuenta' : 'Entrar';
      document.querySelector('#authMessage').textContent = '';
    }));

    document.querySelector('#roomsAuthForm').addEventListener('submit', async event => {
      event.preventDefault();
      const email = document.querySelector('#authEmail').value.trim();
      const password = document.querySelector('#authPassword').value;
      const name = document.querySelector('#authName').value.trim();
      const submit = document.querySelector('#authSubmit');
      const message = document.querySelector('#authMessage');
      submit.disabled = true;
      message.className = 'auth-message';
      message.textContent = mode === 'signup' ? 'Creando tu cuenta…' : 'Entrando…';

      const result = mode === 'signup'
        ? await db.auth.signUp({ email, password, options: { data: { name, alias: name } } })
        : await db.auth.signInWithPassword({ email, password });

      submit.disabled = false;
      if (result.error) {
        message.textContent = translateAuthError(result.error.message);
        return;
      }
      if (mode === 'signup' && !result.data.session) {
        message.className = 'auth-message success';
        message.textContent = 'Cuenta creada. Revisa tu email y confirma el enlace para entrar.';
        return;
      }
      message.className = 'auth-message success';
      message.textContent = 'Cuenta lista. Entrando en Rooms…';
    });
  }

  function translateAuthError(message) {
    const text = String(message || '').toLowerCase();
    if (text.includes('invalid login')) return 'Email o contraseña incorrectos.';
    if (text.includes('already registered')) return 'Ya existe una cuenta con ese email.';
    if (text.includes('password')) return 'La contraseña debe tener al menos 6 caracteres.';
    if (text.includes('email')) return 'Comprueba que el email esté bien escrito.';
    return 'No hemos podido completar el acceso. Inténtalo de nuevo.';
  }

  async function startSession(session) {
    state.user = session.user;

    const authGate =
      document.querySelector('#authGate');

    const [{ data: profile }, { data: preferences }] = await Promise.all([
      db.from('profiles').select('*').eq('id', state.user.id).maybeSingle(),
      db.from('onboarding_preferences').select('answers,updated_at').eq('user_id', state.user.id).maybeSingle()
    ]);
    state.profile = profile;
    state.preferences = preferences;
    if (profile) state.profiles.set(profile.id, profile);
    updateOwnProfile(profile, preferences);

    await loadUserBlocks();
    await loadConversationPreferences();

    /*
      Una cuenta ya configurada siempre entra desde Home.
      Lo hacemos mientras el login sigue cubriendo la app
      para que nunca aparezca fugazmente la última subvista.
    */
    if (profile?.onboarding_completed) {
      if (typeof window.showMainView === 'function') {
        window.showMainView('home');
      }

      if (
        !document.body.classList.contains('app-visible') &&
        typeof window.openPersonalizedFeed === 'function'
      ) {
        window.openPersonalizedFeed();
      }
    }

    if (authGate) {
      authGate.hidden = true;
    }

    await loadOtherProfile();
    await loadRealContent();
    await Promise.all([
      loadSavedItems(),
      loadSavedCollections(),
      loadRealNotifications(),
      loadRealInbox()
    ]);
    subscribeToMessages();
    showLiveStatus();
  }

  function endSession() {
    /*
      Cerrar cualquier suscripción realtime de la sesión anterior.
    */
    if (state.channel) {
      db.removeChannel(state.channel);
    }

    /*
      Identidad y navegación.
    */
    state.user = null;
    state.profile = null;
    state.preferences = null;
    state.targetProfile = null;
    state.reportTarget = null;
    state.blockTarget = null;
    state.blockedUsers = new Set();
    state.targetVisibility = null;
    state.currentListingId = null;
    state.currentCollectionId = null;

    /*
      Conexiones y chat.
    */
    state.connection = null;
    state.connectionsByUser = new Map();
    state.incomingRequests = new Map();
    state.chatTarget = null;
    state.conversationPreferences = new Map();
    state.channel = null;

    /*
      Contenido cargado.
    */
    state.profiles = new Map();
    state.listings = new Map();
    state.posts = new Map();
    state.communities = new Map();

    /*
      Interacciones con publicaciones.
    */
    state.postLikes = new Map();
    state.postComments = new Map();
    state.userPostLikes = new Set();

    /*
      Guardados.
    */
    state.savedItems = new Set();
    state.savedCollections = new Map();

    /*
      Comunidades.
    */
    state.activeCommunity = null;
    state.activeCommunityMembers = [];
    state.activeCommunityMembership = null;
    state.communityMemberships = [];
    state.communityMemberCounts = new Map();
    state.communityPublishTarget = null;

    /*
      Grupos de búsqueda.
    */
    state.household = null;
    state.households = [];
    state.householdMembers = [];
    state.householdCandidates = [];
    state.householdPersonCandidates = [];
    state.householdCandidateVotes = [];
    state.pendingHouseholdInvite = null;
    state.pendingGroupCandidate = null;

    /*
      Publicación y edición.
    */
    state.publishType = null;
    state.publishDraft = {
      steps: {},
      files: []
    };
    state.editListingPhotos = [];
    state.editListingOriginalPhotos = [];

    /*
      Datos temporales del onboarding/perfil.
    */
    state.living = {};

    /*
      Evitar que quede abierto un modal perteneciente
      a la cuenta anterior.
    */
    hideAllModals();

    /*
      La próxima autenticación debe arrancar desde Home,
      no desde la última subvista que quedó abierta.
    */
    document.body.classList.remove('app-visible');

    const authGate =
      document.querySelector('#authGate');

    if (authGate) {
      authGate.hidden = false;
    }
  }

  function updateOwnProfile(profile, preferences = state.preferences) {
    if (!profile) return;
    const answers = preferences?.answers || {};
    const name = profile.alias || profile.name || 'Mi perfil';
    const initials = name.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
    const avatar = document.querySelector('#openOwnProfile');
    if (avatar) {
      if (profile.avatar_url) {
        avatar.innerHTML = `<img src="${escapeHtml(profile.avatar_url)}" alt="${escapeHtml(name)}">`;
        avatar.classList.add('has-photo');
      } else {
        avatar.textContent = initials || 'R';
        avatar.classList.remove('has-photo');
      }
    }
    const ownTitle = document.querySelector('#ownProfileView .own-profile-heading h1');
    if (ownTitle) ownTitle.textContent = name;
    const ownAvatar = document.querySelector('#ownProfileView .own-avatar span');
    if (ownAvatar) {
      if (profile.avatar_url) {
        ownAvatar.innerHTML = `<img src="${escapeHtml(profile.avatar_url)}" alt="${escapeHtml(name)}">`;
        ownAvatar.classList.add('has-photo');
      } else {
        ownAvatar.textContent = initials || 'R';
        ownAvatar.classList.remove('has-photo');
      }
    }
    const ownBio = document.querySelector('#ownProfileView .own-profile-heading p');
    if (ownBio) ownBio.textContent = profile.bio || 'Aún no has añadido una bio.';

    const trustBadge = document.querySelector('#ownProfileView .own-profile-heading small');
    if (trustBadge) trustBadge.textContent = state.user?.email_confirmed_at ? 'EMAIL VERIFICADO ✓' : 'PERFIL NUEVO';

    const seekingLabels = {
      room: 'Busco habitación', home: 'Busco piso entero', mates: 'Busco compañeros'
    };
    const status = document.querySelector('#ownProfileView .current-status');
    if (status) {
      const values = (profile.seeking || []).map(value => seekingLabels[value]).filter(Boolean);
      status.innerHTML = values.length
        ? values.map(value => `<span>${escapeHtml(value)}</span>`).join('')
        : '<span>Sin búsqueda activa</span>';
    }

    const interestLabels = {
      sport: 'Deporte', music: 'Música', cooking: 'Cocina', travel: 'Viajes', gym: 'Gym',
      gaming: 'Gaming', reading: 'Lectura', 'going-out': 'Salir', 'quiet-plans': 'Planes tranquilos', pets: 'Mascotas'
    };
    const aboutSection = document.querySelector('#ownProfileView .own-profile-content > section:nth-child(1)');
    if (aboutSection) {
      const bio = aboutSection.querySelector(':scope > p');
      if (bio) bio.textContent = profile.bio || 'Aún no has añadido información sobre ti.';
      const chips = aboutSection.querySelector('.profile-interest-chips');
      if (chips) {
        const values = (profile.interests || []).map(value => interestLabels[value]).filter(Boolean);
        chips.innerHTML = values.length ? values.map(value => `<span>${escapeHtml(value)}</span>`).join('') : '<span>Sin intereses añadidos</span>';
      }
    }

    const livingNames = ['Limpieza', 'Horarios', 'Ruido', 'Visitas', 'Fiestas en casa', 'Teletrabajo / estudio', 'Fumar', 'Mascotas'];
    const livingOptions = [
      ['Muy ordenado', 'Normal', 'Flexible'], ['Madrugador', 'Horario normal', 'Nocturno'],
      ['Muy tranquilo', 'Algo de ambiente', 'Me adapto'], ['Pocas', 'Con aviso', 'Sin problema'],
      ['Nunca', 'Alguna vez', 'Me da igual'], ['Mucho', 'A veces', 'Casi nunca'],
      ['No', 'Solo fuera', 'Me da igual'], ['Me encantan', 'Me da igual', 'Prefiero no']
    ];
    const livingGrid = document.querySelector('#ownProfileView .lifestyle-grid');
    if (livingGrid) {
      const living = answers.living || {};
      const rows = Object.entries(living).map(([index, value]) => {
        const category = Number(index);
        const label = livingNames[category];
        const option = livingOptions[category]?.[value.option];
        return label && option ? `<span><small>${escapeHtml(label)}</small><b>${escapeHtml(option)}</b></span>` : '';
      }).filter(Boolean);
      livingGrid.innerHTML = rows.length ? rows.join('') : '<span><small>CONVIVENCIA</small><b>Sin datos añadidos</b></span>';
    }

    const durationLabels = {
      '1-3': '1–3 meses', '3-6': '3–6 meses', '6-12': '6–12 meses', '12+': 'Más de 1 año', unknown: 'No lo sé todavía'
    };
    const looking = document.querySelectorAll('#ownProfileView .looking-grid span');
    const seeking = (profile.seeking || []).map(value => seekingLabels[value]?.replace('Busco ', '')).filter(Boolean).join(' · ') || 'Sin definir';
    const zones = (profile.zones || []).join(' · ') || 'Sin definir';
    const budget = profile.budget_min || profile.budget_max ? formatBudget(profile) : 'Sin definir';
    const moveDate = profile.move_in_date
      ? new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${profile.move_in_date}T00:00:00`))
      : 'Sin definir';
    const lookingValues = [seeking, zones, budget, moveDate, durationLabels[profile.duration] || 'Sin definir'];
    looking.forEach((item, index) => {
      const value = item.querySelector('b');
      if (value) value.textContent = lookingValues[index];
    });

    const completedFields = [profile.name, profile.bio, profile.seeking?.length, profile.zones?.length, profile.budget_min, profile.move_in_date, profile.duration, profile.interests?.length].filter(Boolean).length;
    const completion = Math.round((completedFields / 8) * 100);
    const completionNumber = document.querySelector('#ownProfileView .completion-ring b');
    if (completionNumber) completionNumber.textContent = `${completion}%`;
    const completionTitle = document.querySelector('#ownProfileView .profile-completion h2');
    const completionCopy = document.querySelector('#ownProfileView .profile-completion p');
    const missing = !profile.move_in_date ? 'fecha de entrada' : !profile.bio ? 'bio' : !profile.interests?.length ? 'intereses' : null;
    if (completionTitle) {
      completionTitle.textContent = missing
        ? `Añade tu ${missing}`
        : 'Tu perfil está completo';
    }

    if (completionCopy) {
      completionCopy.textContent = missing
        ? 'Completar este dato ayudará a mejorar tus recomendaciones.'
        : 'Ya tenemos los datos principales para personalizar tus matches.';
    }

    const completionAction = document.querySelector(
      '#ownProfileView .profile-completion > button'
    );

    if (completionAction) {
      if (!missing) {
        completionAction.hidden = true;
      } else {
        completionAction.hidden = false;

        const actionLabels = {
          'fecha de entrada': 'Añadir fecha →',
          'bio': 'Añadir bio →',
          'intereses': 'Añadir intereses →'
        };

        completionAction.textContent =
          actionLabels[missing] || 'Completar perfil →';
      }
    }

    const activity = document.querySelector('#ownActivityPreview');
    if (activity && !state.user) activity.innerHTML = '<small>TODAVÍA VACÍO</small><p>Aquí aparecerá tu actividad.</p>';

    updateTrustView();
    updateAccountView();
  }

  function updateTrustView() {
    const profile = state.profile || {};

    const emailVerified = Boolean(state.user?.email_confirmed_at);
    const hasPhoto = Boolean(profile.avatar_url);

    const completionFields = [
      profile.name || profile.alias,
      profile.bio,
      profile.age,
      profile.seeking?.length,
      profile.zones?.length,
      profile.budget_min || profile.budget_max,
      profile.move_in_date,
      profile.duration,
      profile.interests?.length,
      state.preferences?.answers?.living &&
        Object.keys(state.preferences.answers.living).length
    ];

    const completion =
      Math.round(
        (completionFields.filter(Boolean).length / completionFields.length) * 100
      ) || 0;

    const verified = emailVerified;
    const levelName = verified ? 'Verificado' : 'Nuevo';

    const title = document.querySelector('#trustView .subpage-header h1');
    const level = document.querySelector('#trustView .trust-level-card strong');
    const copy = document.querySelector('#trustView .trust-level-card p');

    if (title) title.textContent = levelName;
    if (level) level.textContent = levelName;

    if (copy) {
      copy.textContent = emailVerified
        ? 'Tu email está confirmado. Sigue completando tu perfil y creando relaciones reales para añadir más señales de confianza.'
        : 'Confirma tu email para conseguir tu primera señal de confianza en Rooms.';
    }

    const levels = document.querySelectorAll(
      '#trustView .trust-levels span'
    );

    if (levels[0]) {
      levels[0].textContent = 'Nuevo ✓';
      levels[0].className = 'done';
    }

    if (levels[1]) {
      levels[1].textContent = emailVerified
        ? 'Verificado ✓'
        : 'Verificado';
      levels[1].className = emailVerified ? 'current' : '';
    }

    if (levels[2]) {
      levels[2].textContent = 'Fiable';
      levels[2].className = '';
    }

    if (levels[3]) {
      levels[3].textContent = 'Muy fiable';
      levels[3].className = '';
    }

    const signals = document.querySelectorAll(
      '#trustView .trust-signals-grid article'
    );

    if (signals[0]) {
      signals[0].innerHTML = `
        <span>${emailVerified ? '✓' : '○'}</span>
        <div>
          <b>Email</b>
          <small>${emailVerified ? 'Verificado' : 'Pendiente de verificar'}</small>
        </div>
      `;
    }

    if (signals[1]) {
      signals[1].innerHTML = `
        <span>${hasPhoto ? '✓' : '○'}</span>
        <div>
          <b>Foto de perfil</b>
          <small>${hasPhoto ? 'Añadida' : 'Pendiente'}</small>
        </div>
      `;
    }

    if (signals[2]) {
      signals[2].innerHTML = `
        <span>${completion}%</span>
        <div>
          <b>Perfil completo</b>
          <small>${completion >= 80 ? 'Buen nivel de información' : 'Puedes añadir más información'}</small>
        </div>
      `;
    }

    const recommendationButton = document.querySelector(
      '#trustView .trust-level-card button'
    );

    if (recommendationButton) {
      recommendationButton.removeAttribute('data-toast');
      recommendationButton.id = 'trustRecommendations';
      recommendationButton.textContent = completion < 100
        ? 'Completar perfil →'
        : 'Perfil completo ✓';
    }

    const reviews = document.querySelector('#trustView .reviews-grid');

    if (reviews) {
      reviews.innerHTML = `
        <article class="unverified-review trust-empty-reviews">
          <header>
            <span>SIN RESEÑAS TODAVÍA</span>
          </header>
          <h3>Las reseñas llegarán después de relaciones reales</h3>
          <p>
            Cuando hayas conectado y convivido, alquilado o interactuado
            mediante una relación verificable en Rooms, podrán aparecer aquí.
          </p>
        </article>
      `;
    }

    const writeReview = document.querySelector(
      '#trustView .reviews-heading button'
    );

    if (writeReview) {
      writeReview.hidden = true;
    }

    document
      .querySelectorAll('#ownProfileView [data-open-trust] small')
      .forEach(item => {
        item.textContent = emailVerified
          ? 'Email verificado'
          : 'Perfil nuevo';
      });
  }

  function updateAccountView() {
    const email = state.user?.email || '';

    const emailNode = document.querySelector('#settingsAccountEmail');
    if (emailNode) {
      emailNode.textContent = email || 'Sin email';
    }
  }

  function updateSavedCount(count) {
    document.querySelectorAll('#ownProfileView [data-open-saved] small').forEach(item => item.textContent = `${count} ${count === 1 ? 'elemento' : 'elementos'}`);
    const title = document.querySelector('#savedResultsTitle');
    if (title) title.textContent = `${count} ${count === 1 ? 'elemento' : 'elementos'}`;
  }

  async function getProfileVisibility(userId) {
    if (!userId) {
      return {
        viewer_scope: 'public',
        living: true,
        search: true,
        budget: true,
        activity: true
      };
    }

    const { data, error } = await db.rpc(
      'get_profile_visibility',
      { target_user_id: userId }
    );

    if (error) {
      console.error('Rooms: error cargando privacidad', error);

      /*
       * Ante un error preferimos ocultar información
       * antes que mostrar algo que podría ser privado.
       */
      return {
        viewer_scope: 'public',
        living: false,
        search: false,
        budget: false,
        activity: false
      };
    }

    return data || {};
  }

  function applyTargetPrivacy(profile, visibility) {
    const modal = document.querySelector('#userProfileModal');
    if (!modal || !profile) return;

    const canSeeLiving = visibility?.living !== false;
    const canSeeSearch = visibility?.search !== false;
    const canSeeBudget = visibility?.budget !== false;
    const canSeeActivity = visibility?.activity !== false;

    /*
     * Cabecera: busca / zona / presupuesto
     */
    const topLooking = modal.querySelectorAll('.profile-looking > span');

    if (topLooking[0]) topLooking[0].hidden = !canSeeSearch;
    if (topLooking[1]) topLooking[1].hidden = !canSeeSearch;
    if (topLooking[2]) topLooking[2].hidden = !canSeeBudget;

    /*
     * Secciones principales del perfil.
     * 0 = Sobre mí
     * 1 = Cómo vivo
     * 2 = Qué busco
     */
    const userSections = modal.querySelectorAll(
      '.user-profile-content > section.user-section'
    );

    const livingSection = userSections[1];
    const searchSection = userSections[2];

    if (livingSection) {
      livingSection.hidden = !canSeeLiving;
    }

    if (searchSection) {
      const rows = searchSection.querySelectorAll('.looking-grid > span');

      if (rows[0]) rows[0].hidden = !canSeeSearch;
      if (rows[1]) rows[1].hidden = !canSeeSearch;
      if (rows[2]) rows[2].hidden = !canSeeBudget;
      if (rows[3]) rows[3].hidden = !canSeeSearch;
      if (rows[4]) rows[4].hidden = !canSeeSearch;

      searchSection.hidden = !canSeeSearch && !canSeeBudget;
    }

    /*
     * El match revela indirectamente hábitos de convivencia.
     * Hasta que tengamos el matching real, no lo enseñamos
     * cuando esos datos no son visibles.
     */
    const matchBlock = modal.querySelector('.user-match-block');

    if (matchBlock) {
      matchBlock.hidden = !canSeeLiving || !canSeeSearch;
    }

    /*
     * Actividad
     */
    const activity = modal.querySelector('.activity-section');

    if (activity) {
      activity.hidden = !canSeeActivity;
    }

    modal.dataset.viewerScope =
      visibility?.viewer_scope || 'public';
  }


  async function loadOtherProfile() {
    const { data, error } = await db.rpc(
      'get_visible_profiles',
      { _target_user_id: null }
    );

    if (error) {
      console.error('Rooms: error cargando perfiles seguros', error);
      return;
    }

    state.targetProfile = data?.[0] || null;

    if (!state.targetProfile) return;

    await loadConnection();

    state.targetVisibility =
      await getProfileVisibility(state.targetProfile.id);

    applyTargetProfile(state.targetProfile);

    applyTargetPrivacy(
      state.targetProfile,
      state.targetVisibility
    );
  }



  function ensureCreateCommunityModal() {
    let modal =
      document.querySelector('#createCommunityModal');

    if (modal) return modal;

    modal = document.createElement('div');

    modal.className = 'modal';
    modal.id = 'createCommunityModal';
    modal.setAttribute('aria-hidden', 'true');

    modal.innerHTML = `
      <div
        class="backdrop"
        data-close-create-community
      ></div>

      <article class="create-community-sheet">

        <header class="create-community-header">
          <div>
            <small>NUEVA COMUNIDAD</small>
            <h2>Crea una comunidad</h2>
            <p>
              Crea un espacio para personas que comparten
              zona, universidad, intereses o una misma etapa.
            </p>
          </div>

          <button
            type="button"
            data-close-create-community
            aria-label="Cerrar"
          >
            ×
          </button>
        </header>

        <form id="createCommunityForm">

          <label class="create-community-field">
            <span>Nombre de la comunidad</span>

            <input
              id="createCommunityName"
              type="text"
              maxlength="60"
              placeholder="Ej. Vivir en Chamberí"
              required
            >
          </label>

          <label class="create-community-field">
            <span>Descripción</span>

            <textarea
              id="createCommunityDescription"
              maxlength="280"
              placeholder="¿Qué une a las personas de esta comunidad?"
              rows="4"
            ></textarea>
          </label>

          <fieldset class="create-community-visibility">
            <legend>Visibilidad</legend>

            <label>
              <input
                type="radio"
                name="communityVisibility"
                value="public"
                checked
              >

              <span>
                <b>Pública</b>
                <small>
                  Cualquiera puede encontrarla y solicitar unirse.
                </small>
              </span>
            </label>

            <label>
              <input
                type="radio"
                name="communityVisibility"
                value="private"
              >

              <span>
                <b>Privada</b>
                <small>
                  Visible solo para personas con acceso.
                </small>
              </span>
            </label>
          </fieldset>

          <button
            type="submit"
            class="create-community-submit"
          >
            Crear comunidad
          </button>

        </form>

      </article>
    `;

    document.body.appendChild(modal);

    modal
      .querySelector('#createCommunityForm')
      ?.addEventListener('submit', createCommunity);

    return modal;
  }


  function openCreateCommunityModal() {
    const modal =
      ensureCreateCommunityModal();

    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');

    document.body.style.overflow = 'hidden';

    setTimeout(() => {
      modal
        .querySelector('#createCommunityName')
        ?.focus();
    }, 50);
  }


  function closeCreateCommunityModal() {
    const modal =
      document.querySelector('#createCommunityModal');

    if (!modal) return;

    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');

    document.body.style.overflow = '';
  }


  async function createCommunity(event) {
    event.preventDefault();

    if (!state.user) {
      notify('Necesitas iniciar sesión');
      return;
    }

    const modal =
      ensureCreateCommunityModal();

    const name =
      modal
        .querySelector('#createCommunityName')
        ?.value
        .trim();

    const description =
      modal
        .querySelector('#createCommunityDescription')
        ?.value
        .trim();

    const visibility =
      modal
        .querySelector(
          'input[name="communityVisibility"]:checked'
        )
        ?.value || 'public';

    if (!name) {
      notify('Pon un nombre a la comunidad');
      return;
    }

    const submit =
      modal.querySelector('.create-community-submit');

    if (submit) {
      submit.disabled = true;
      submit.textContent = 'Creando...';
    }

    const { data: community, error } = await db
      .rpc('create_community', {
        _name: name,
        _description: description || null,
        _visibility: visibility
      });

    if (error) {
      console.error(
        'Rooms: error creando comunidad',
        error
      );

      if (submit) {
        submit.disabled = false;
        submit.textContent = 'Crear comunidad';
      }

      notify('No hemos podido crear la comunidad');
      return;
    }

    state.communities.set(
      community.id,
      community
    );

    modal
      .querySelector('#createCommunityForm')
      ?.reset();

    if (submit) {
      submit.disabled = false;
      submit.textContent = 'Crear comunidad';
    }

    closeCreateCommunityModal();

    await loadMemberCommunities();

    renderFilteredExplore();

    notify('Comunidad creada');
  }


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


  async function loadRealContent() {
    await loadAllConnections();
    const [{ data: listings }, { data: profiles }, { data: posts }, { data: communities }] = await Promise.all([
      db.from('listings').select('*').eq('status', 'published').order('created_at', { ascending: false }),
      db.rpc('get_visible_profiles', { _target_user_id: null }),
      db.from('posts').select('*').eq('status', 'published').order('created_at', { ascending: false }),
      db.from('communities').select('*').eq('status', 'active').order('created_at', { ascending: false })
    ]);
    const visibleListings =
      (listings || []).filter(listing =>
        !listing.owner_id ||
        !state.blockedUsers?.has(listing.owner_id)
      );

    const visiblePosts =
      (posts || []).filter(post =>
        !post.author_id ||
        !state.blockedUsers?.has(post.author_id)
      );

    state.listings = new Map(
      visibleListings.map(item => [item.id, item])
    );

    state.posts = new Map(
      visiblePosts.map(item => [item.id, item])
    );

    state.communities = new Map(
      (communities || []).map(item => [item.id, item])
    );

    const visibleProfiles =
      (profiles || []).filter(profile =>
        !state.blockedUsers?.has(profile.id)
      );

    visibleProfiles.forEach(profile =>
      state.profiles.set(profile.id, profile)
    );

    if (
      !state.targetProfile &&
      visibleProfiles.length
    ) {
      state.targetProfile =
        visibleProfiles[0];
    }
    const {
      data: communityMemberRows,
      error: communityMemberCountError
    } = await db
      .from('community_members')
      .select('community_id')
      .eq('status', 'active');

    if (communityMemberCountError) {
      console.error(
        'Rooms: error cargando número de miembros',
        communityMemberCountError
      );
    }

    state.communityMemberCounts = new Map();

    (communityMemberRows || []).forEach(member => {
      const current =
        state.communityMemberCounts.get(member.community_id) || 0;

      state.communityMemberCounts.set(
        member.community_id,
        current + 1
      );
    });

    renderRealFeed(listings || [], profiles || [], posts || [], communities || []);
    renderFilteredExplore();

    // Las cards acaban de recrearse: aplicar ahora
    // el estado real de conexión de cada usuario.
    updateConnectButtons();

    clearDemoOnlyViews();
    refreshOwnActivity();
    await loadHousehold();
    await loadMemberCommunities();
    await loadIncomingConnections();
    await loadCommunityPostInteractions();
    await handleIncomingHouseholdInvite();
  }

  function renderRealFeed(listings, profiles, posts, communities) {
    const feed = document.querySelector('#personalFeed');
    if (!feed) return;

    const visibleProfiles =
      (profiles || []).filter(profile =>
        profile?.id &&
        !state.blockedUsers?.has(profile.id)
      );

    const cards = [
      ...listings.map(renderListingCard),
      ...visibleProfiles.map(renderPersonCard),
      ...communities.map(renderCommunityCard),
      ...posts.map(renderPostCard)
    ];
    feed.innerHTML = cards.length ? cards.join('') : `
      <section class="real-feed-empty">
        <span>✦</span><h2>Todavía no hay contenido en Rooms</h2>
        <p>Los perfiles, viviendas y publicaciones aparecerán aquí cuando la comunidad los cree.</p>
        <button type="button" data-open-real-publish>Crear lo primero</button>
      </section>`;
  }

  function renderListingCard(listing) {
    if (
      !listing ||
      (
        listing.owner_id &&
        state.blockedUsers?.has(listing.owner_id)
      )
    ) {
      return '';
    }

    const photos =
      Array.isArray(listing.photos)
        ? listing.photos
        : [];

    const photoCount = photos.length;

    const kind =
      listing.kind === 'apartment'
        ? 'Piso entero'
        : listing.kind === 'external'
          ? 'Fuente externa'
          : 'Habitación';

    const zone =
      listing.zone || 'Madrid';

    const title =
      listing.title ||
      `${kind} en ${zone}`;

    const price =
      Number(listing.price || 0)
        .toLocaleString('es-ES');

    const available =
      listing.available_from
        ? new Intl.DateTimeFormat('es-ES', {
            day: 'numeric',
            month: 'short'
          }).format(
            new Date(`${listing.available_from}T00:00:00`)
          )
        : 'Flexible';

    const facts = [
      listing.rooms
        ? `${listing.rooms} ${listing.rooms === 1 ? 'hab' : 'hab'}`
        : null,
      listing.baths
        ? `${listing.baths} ${listing.baths === 1 ? 'baño' : 'baños'}`
        : null,
      listing.area
        ? `${listing.area} m²`
        : null
    ].filter(Boolean);

    const features =
      Array.isArray(listing.features)
        ? listing.features.slice(0, 4)
        : [];

    return `
      <article
        class="feed-card rooms-home-property-card"
        data-feed-type="${listing.kind === 'apartment' ? 'flat' : 'home'}"
        data-real-listing="${listing.id}"
        tabindex="0"
      >

        <div
          class="rooms-home-property-media"
          ${photoCount ? 'data-carousel data-index="0"' : ''}
        >

          ${
            photoCount
              ? `
                <div class="rooms-home-gallery-track">
                  ${photos.map((photo, index) => `
                    <img
                      ${index === 0 ? 'class="active"' : ''}
                      data-carousel-slide
                      src="${escapeHtml(photo)}"
                      alt="${escapeHtml(title)} · foto ${index + 1}"
                    >
                  `).join('')}
                </div>

                ${
                  photoCount > 1
                    ? `
                      <button
                        type="button"
                        class="rooms-home-gallery-arrow previous"
                        data-carousel-prev
                        aria-label="Foto anterior"
                      >←</button>

                      <button
                        type="button"
                        class="rooms-home-gallery-arrow next"
                        data-carousel-next
                        aria-label="Foto siguiente"
                      >→</button>
                    `
                    : ''
                }

                <div class="carousel-dots rooms-home-gallery-dots">
                  ${photos.map((_, index) => `
                    <i class="${index === 0 ? 'active' : ''}"></i>
                  `).join('')}
                </div>

                <span class="rooms-home-photo-count">
                  1 / ${photoCount}
                </span>
              `
              : `
                <div class="rooms-home-property-placeholder">
                  <b>rooms.</b>
                  <span>Fotos pendientes</span>
                </div>
              `
          }

          <div class="rooms-home-property-overlay">
            <span class="rooms-home-property-type">
              ${escapeHtml(kind)}
            </span>

            <button
              type="button"
              class="rooms-home-property-save"
              data-save-kind="${listing.kind === 'apartment' ? 'apartment' : 'room'}"
              data-save-id="${listing.id}"
              aria-label="Guardar vivienda"
            >
              ♡
            </button>
          </div>

        </div>


        <div class="rooms-home-property-body">

          <div class="rooms-home-property-heading">
            <div>
              <small>${escapeHtml(zone)}</small>
              <h2>${escapeHtml(title)}</h2>
            </div>

            <div class="rooms-home-property-price">
              <b>${price} €</b>
              <span>/ mes</span>
            </div>
          </div>

          <div class="rooms-home-property-availability">
            Disponible ${escapeHtml(available)}
          </div>

          ${
            facts.length
              ? `
                <div class="rooms-home-property-facts">
                  ${facts.map(fact => `
                    <span>${escapeHtml(fact)}</span>
                  `).join('')}
                </div>
              `
              : ''
          }

          ${
            features.length
              ? `
                <div class="rooms-home-property-features">
                  ${features.map(feature => `
                    <span>${escapeHtml(feature)}</span>
                  `).join('')}
                </div>
              `
              : ''
          }

          ${
            listing.description
              ? `
                <p class="rooms-home-property-description">
                  ${escapeHtml(listing.description)}
                </p>
              `
              : ''
          }

          <div class="rooms-home-property-footer">
            <span>Publicado en Rooms</span>

            <button
              type="button"
              class="rooms-home-property-open"
              data-real-listing="${listing.id}"
            >
              Ver vivienda →
            </button>
          </div>

        </div>

      </article>
    `;
  }

  function renderPersonCard(profile) {
    if (
      !profile ||
      state.blockedUsers?.has(profile.id)
    ) {
      return '';
    }

    const name = profile.alias || profile.name || 'Usuario de Rooms';
    const zone = profile.zones?.[0] || 'Madrid';
    const seeking = labelSeeking(profile.seeking?.[0]);
    const traits = (profile.traits || []).slice(0, 3);
    const traitLabels = { tidy: 'Ordenado', social: 'Sociable', calm: 'Tranquilo', independent: 'Independiente', cook: 'Cocinillas', early: 'Madrugador', night: 'Nocturno' };
    return `<article class="feed-card person-feed-card" data-feed-type="person" data-real-user="${profile.id}" tabindex="0">
      <div class="person-card-photo real-person-photo">
        ${profile.avatar_url ? `<img src="${escapeHtml(profile.avatar_url)}" alt="${escapeHtml(name)}">` : `<div class="real-person-placeholder">${escapeHtml(initials(name))}</div>`}
        <div class="person-card-tools"><button type="button" class="${state.savedItems?.has(`person:${profile.id}`) ? 'saved' : ''}" data-person-save data-save-kind="person" data-save-id="${profile.id}" aria-label="${state.savedItems?.has(`person:${profile.id}`) ? 'Eliminar perfil de Guardados' : 'Guardar perfil'}">${state.savedItems?.has(`person:${profile.id}`) ? '♥' : '♡'}</button></div>
      </div>
      <div class="person-card-body"><h2>${escapeHtml(name)}${profile.age ? `, ${profile.age}` : ''}</h2><p class="person-searching">${escapeHtml(seeking)} · ${escapeHtml(zone)}</p>
        <div class="person-traits">${traits.length ? traits.map(value => `<span>${escapeHtml(traitLabels[value] || value)}</span>`).join('') : '<span>Perfil recién creado</span>'}</div>
        <p>${escapeHtml(profile.bio || 'Todavía no ha añadido una bio.')}</p>
        <div class="person-actions"><button type="button" data-connect data-user-id="${profile.id}">${escapeHtml(connectionButtonLabel(profile.id))}</button></div>
      </div>
    </article>`;
  }

  function renderPostCard(post) {
    if (
      !post ||
      (
        post.author_id &&
        state.blockedUsers?.has(post.author_id)
      )
    ) {
      return '';
    }

    const author =
      state.profiles.get(post.author_id);

    const name =
      author?.alias ||
      author?.name ||
      'Usuario de Rooms';

    const avatar =
      author?.avatar_url;

    const community =
      post.community_id
        ? state.communities?.get(post.community_id)
        : null;

    const linkedListing =
      post.listing_id
        ? state.listings.get(post.listing_id)
        : null;

    const media =
      Array.isArray(post.media_urls)
        ? post.media_urls
        : [];

    const saved =
      state.savedItems?.has(`post:${post.id}`);

    const liked =
      state.userPostLikes?.has(post.id);

    const likeCount =
      state.postLikes?.get(post.id) || 0;

    const commentCount =
      state.postComments?.get(post.id)?.length || 0;

    const typeConfig = {
      question: {
        label: 'PREGUNTA',
        symbol: '?',
        className: 'question',
        action: 'Responder'
      },
      recommendation: {
        label: 'RECOMENDACIÓN',
        symbol: '✦',
        className: 'recommendation',
        action: 'Comentar'
      },
      neighborhood: {
        label: 'BARRIO',
        symbol: '◎',
        className: 'neighborhood',
        action: 'Comentar'
      },
      warning: {
        label: 'AVISO',
        symbol: '!',
        className: 'warning',
        action: 'Comentar'
      },
      experience: {
        label: 'EXPERIENCIA',
        symbol: '↗',
        className: 'experience',
        action: 'Comentar'
      },
      housing: {
        label: 'VIVIENDA',
        symbol: '⌂',
        className: 'housing',
        action: 'Comentar'
      }
    };

    const config =
      typeConfig[post.post_type] ||
      typeConfig.question;

    if (
      post.post_type === 'warning' &&
      post.expires_at &&
      post.expires_at <
        new Date().toISOString().slice(0, 10)
    ) {
      return '';
    }

    return `
      <article
        class="feed-card home-editorial-post home-editorial-post--${config.className}"
        data-feed-type="post"
        data-real-post="${escapeHtml(post.id)}"
      >

        <div class="home-post-accent">
          <span>${config.symbol}</span>
          <small>${config.label}</small>
        </div>


        <div class="home-post-content">

          <header class="home-post-header">

            <div class="home-post-author">

              ${
                avatar
                  ? `
                    <img
                      src="${escapeHtml(avatar)}"
                      alt="${escapeHtml(name)}"
                    >
                  `
                  : `
                    <span>
                      ${escapeHtml(initials(name))}
                    </span>
                  `
              }

              <div>
                <b>${escapeHtml(name)}</b>

                <small>
                  ${escapeHtml(relativeTime(post.created_at))}
                  ${
                    community
                      ? ` · ${escapeHtml(community.name)}`
                      : ''
                  }
                </small>
              </div>

            </div>

            ${
              community
                ? `
                  <button
                    type="button"
                    class="home-post-community-link"
                    data-real-community-open="${escapeHtml(community.id)}"
                  >
                    Ver comunidad ↗
                  </button>
                `
                : ''
            }

          </header>


          <div class="home-post-main">

            ${
              post.zone
                ? `
                  <div class="home-post-zone">
                    ◎ ${escapeHtml(post.zone)}
                  </div>
                `
                : ''
            }

            <p class="home-post-body">
              ${escapeHtml(post.body)}
            </p>


            ${
              media.length
                ? `
                  <div class="home-post-media">
                    <img
                      src="${escapeHtml(media[0])}"
                      alt=""
                    >
                  </div>
                `
                : ''
            }


            ${
              linkedListing
                ? `
                  <button
                    type="button"
                    class="home-post-listing"
                    data-real-listing="${escapeHtml(linkedListing.id)}"
                  >

                    ${
                      Array.isArray(linkedListing.photos) &&
                      linkedListing.photos[0]
                        ? `
                          <img
                            src="${escapeHtml(linkedListing.photos[0])}"
                            alt=""
                          >
                        `
                        : `
                          <span class="home-post-listing-placeholder">
                            ⌂
                          </span>
                        `
                    }

                    <div>
                      <small>VIVIENDA EN ROOMS</small>

                      <b>
                        ${escapeHtml(
                          linkedListing.title ||
                          linkedListing.zone ||
                          'Vivienda'
                        )}
                      </b>

                      <p>
                        ${Number(
                          linkedListing.price || 0
                        ).toLocaleString('es-ES')}
                        € / mes
                      </p>
                    </div>

                    <strong>→</strong>

                  </button>
                `
                : ''
            }


            ${
              post.post_type === 'warning' &&
              post.expires_at
                ? `
                  <div class="home-post-warning-date">
                    <span>VIGENTE HASTA</span>
                    <b>
                      ${escapeHtml(
                        new Intl.DateTimeFormat(
                          'es-ES',
                          {
                            day: 'numeric',
                            month: 'short'
                          }
                        ).format(
                          new Date(
                            `${post.expires_at}T00:00:00`
                          )
                        )
                      )}
                    </b>
                  </div>
                `
                : ''
            }

          </div>


          <div class="real-report-row">
            <button
              type="button"
              class="real-report-button"
              data-real-report
              data-report-type="post"
              data-report-id="${escapeHtml(post.id)}"
              data-report-user="${escapeHtml(post.author_id || '')}"
            >
              Reportar publicación
            </button>
          </div>

          <footer class="home-post-actions">

            <button
              type="button"
              class="${liked ? 'active' : ''}"
              data-community-post-like="${escapeHtml(post.id)}"
            >
              ${liked ? '♥' : '♡'}
              Me gusta
              <span>${likeCount}</span>
            </button>

            <button
              type="button"
              data-community-post-comments="${escapeHtml(post.id)}"
            >
              ○ ${config.action}
              <span>${commentCount}</span>
            </button>

            <button
              type="button"
              class="${saved ? 'saved' : ''}"
              data-save-kind="post"
              data-save-id="${escapeHtml(post.id)}"
            >
              ${saved ? '♥ Guardado' : '♡ Guardar'}
            </button>

          </footer>


          <div
            class="community-post-comments-panel"
            data-community-comments-panel="${escapeHtml(post.id)}"
            hidden
          ></div>

        </div>

      </article>
    `;
  }


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




  async function loadCommunityPostInteractions() {
    const postIds =
      [...state.posts.values()]
        .filter(post => post.community_id)
        .map(post => post.id);

    state.postLikes = new Map();
    state.postComments = new Map();
    state.userPostLikes = new Set();

    if (!postIds.length) return;

    const [
      { data: likes, error: likesError },
      { data: comments, error: commentsError }
    ] = await Promise.all([
      db
        .from('post_likes')
        .select('post_id,user_id,created_at')
        .in('post_id', postIds),

      db
        .from('post_comments')
        .select('id,post_id,author_id,body,status,created_at,updated_at')
        .in('post_id', postIds)
        .eq('status', 'published')
        .order('created_at', { ascending: true })
    ]);

    if (likesError) {
      console.error(
        'Rooms: error cargando likes de posts',
        likesError
      );
    }

    if (commentsError) {
      console.error(
        'Rooms: error cargando comentarios de posts',
        commentsError
      );
    }

    (likes || []).forEach(like => {
      const current =
        state.postLikes.get(like.post_id) || 0;

      state.postLikes.set(
        like.post_id,
        current + 1
      );

      if (like.user_id === state.user?.id) {
        state.userPostLikes.add(like.post_id);
      }
    });

    (comments || []).forEach(comment => {
      const current =
        state.postComments.get(comment.post_id) || [];

      current.push(comment);

      state.postComments.set(
        comment.post_id,
        current
      );
    });
  }


  function renderCommunityPost(post) {
    const profile =
      state.profiles.get(post.author_id);

    const name =
      profile?.alias ||
      profile?.name ||
      (
        post.author_id === state.user?.id
          ? 'Tú'
          : 'Usuario de Rooms'
      );

    const avatar =
      profile?.avatar_url;

    const linkedListing =
      post.listing_id
        ? state.listings.get(post.listing_id)
        : null;

    const media =
      Array.isArray(post.media_urls)
        ? post.media_urls
        : [];

    const typeLabels = {
      question: 'Pregunta',
      recommendation: 'Recomendación',
      neighborhood: 'Barrio',
      warning: 'Aviso',
      experience: 'Experiencia',
      housing: 'Vivienda'
    };

    return `
      <article
        class="community-post real-community-post"
        data-community-post="${escapeHtml(post.id)}"
      >

        <header>

          ${
            avatar
              ? `
                <img
                  class="real-community-post-avatar"
                  src="${escapeHtml(avatar)}"
                  alt="${escapeHtml(name)}"
                >
              `
              : `
                <div class="social-avatar">
                  ${escapeHtml(initials(name))}
                </div>
              `
          }

          <div>
            <b>${escapeHtml(name)}</b>

            <span>
              ${escapeHtml(relativeTime(post.created_at))}
              ·
              ${escapeHtml(
                typeLabels[post.post_type] ||
                'Publicación'
              )}
            </span>
          </div>

          ${
            post.author_id === state.user?.id
              ? `
                <button
                  type="button"
                  data-own-community-post="${escapeHtml(post.id)}"
                  aria-label="Opciones"
                >
                  •••
                </button>
              `
              : ''
          }

        </header>

        ${
          post.zone
            ? `
              <div class="community-post-zone">
                ◎ ${escapeHtml(post.zone)}
              </div>
            `
            : ''
        }

        <p>
          ${escapeHtml(post.body)}
        </p>

        ${
          media.length
            ? `
              <div class="community-post-media">
                <img
                  src="${escapeHtml(media[0])}"
                  alt=""
                >
              </div>
            `
            : ''
        }

        ${
          linkedListing
            ? `
              <button
                type="button"
                class="community-post-linked-listing"
                data-real-listing="${escapeHtml(linkedListing.id)}"
              >

                ${
                  Array.isArray(linkedListing.photos) &&
                  linkedListing.photos[0]
                    ? `
                      <img
                        src="${escapeHtml(linkedListing.photos[0])}"
                        alt=""
                      >
                    `
                    : `
                      <span>⌂</span>
                    `
                }

                <div>
                  <small>VIVIENDA EN ROOMS</small>

                  <b>
                    ${escapeHtml(
                      linkedListing.title ||
                      linkedListing.zone
                    )}
                  </b>

                  <p>
                    ${Number(
                      linkedListing.price || 0
                    ).toLocaleString('es-ES')}
                    € / mes
                  </p>
                </div>

                <strong>→</strong>

              </button>
            `
            : ''
        }

        ${
          post.post_type === 'warning' &&
          post.expires_at
            ? `
              <div class="community-warning-expiry">
                AVISO VIGENTE HASTA
                <b>
                  ${escapeHtml(
                    new Intl.DateTimeFormat(
                      'es-ES',
                      {
                        day: 'numeric',
                        month: 'short'
                      }
                    ).format(
                      new Date(
                        `${post.expires_at}T00:00:00`
                      )
                    )
                  )}
                </b>
              </div>
            `
            : ''
        }

        <div class="real-report-row">
          <button
            type="button"
            class="real-report-button"
            data-real-report
            data-report-type="post"
            data-report-id="${escapeHtml(post.id)}"
            data-report-user="${escapeHtml(post.author_id || '')}"
          >
            Reportar publicación
          </button>
        </div>

        <div class="community-post-actions">

          <button
            type="button"
            class="${
              state.userPostLikes?.has(post.id)
                ? 'active'
                : ''
            }"
            data-community-post-like="${escapeHtml(post.id)}"
          >
            ${
              state.userPostLikes?.has(post.id)
                ? '♥'
                : '♡'
            }
            Me gusta
            <span>
              ${state.postLikes?.get(post.id) || 0}
            </span>
          </button>

          <button
            type="button"
            data-community-post-comments="${escapeHtml(post.id)}"
          >
            ${
              post.post_type === 'question'
                ? '○ Responder'
                : '○ Comentar'
            }
            <span>
              ${
                state.postComments?.get(post.id)?.length || 0
              }
            </span>
          </button>

          <button
            type="button"
            class="${
              state.savedItems?.has(`post:${post.id}`)
                ? 'saved'
                : ''
            }"
            data-save-kind="post"
            data-save-id="${escapeHtml(post.id)}"
          >
            ${
              state.savedItems?.has(`post:${post.id}`)
                ? '♥ Guardado'
                : '♡ Guardar'
            }
          </button>

        </div>

        <div
          class="community-post-comments-panel"
          data-community-comments-panel="${escapeHtml(post.id)}"
          hidden
        ></div>

      </article>
    `;
  }



  async function toggleCommunityPostLike(postId) {
    if (!state.user) return;

    const liked =
      state.userPostLikes?.has(postId);

    if (liked) {
      const { error } = await db
        .from('post_likes')
        .delete()
        .match({
          post_id: postId,
          user_id: state.user.id
        });

      if (error) {
        console.error(
          'Rooms: error quitando like',
          error
        );
        notify('No hemos podido actualizar el Me gusta');
        return;
      }
    } else {
      const { error } = await db
        .from('post_likes')
        .insert({
          post_id: postId,
          user_id: state.user.id
        });

      if (error) {
        console.error(
          'Rooms: error añadiendo like',
          error
        );
        notify('No hemos podido actualizar el Me gusta');
        return;
      }
    }

    await loadCommunityPostInteractions();
    renderRealCommunityDetail();
  }


  function renderCommunityCommentsPanel(postId) {
    const panel =
      document.querySelector(
        `[data-community-comments-panel="${postId}"]`
      );

    if (!panel) return;

    const comments =
      state.postComments?.get(postId) || [];

    panel.innerHTML = `
      <div class="community-comments-list">

        ${
          comments.length
            ? comments.map(comment => {
                const profile =
                  state.profiles.get(comment.author_id);

                const name =
                  profile?.alias ||
                  profile?.name ||
                  (
                    comment.author_id === state.user?.id
                      ? 'Tú'
                      : 'Usuario de Rooms'
                  );

                const avatar =
                  profile?.avatar_url;

                return `
                  <article class="community-comment">

                    ${
                      avatar
                        ? `
                          <img
                            class="community-comment-avatar"
                            src="${escapeHtml(avatar)}"
                            alt="${escapeHtml(name)}"
                          >
                        `
                        : `
                          <span class="community-comment-avatar">
                            ${escapeHtml(initials(name))}
                          </span>
                        `
                    }

                    <div>
                      <header>
                        <b>${escapeHtml(name)}</b>
                        <small>
                          ${escapeHtml(relativeTime(comment.created_at))}
                        </small>
                      </header>

                      <p>
                        ${escapeHtml(comment.body)}
                      </p>
                    </div>

                  </article>
                `;
              }).join('')
            : `
              <div class="community-comments-empty">
                Sé la primera persona en comentar.
              </div>
            `
        }

      </div>

      <form
        class="community-comment-form"
        data-community-comment-form="${escapeHtml(postId)}"
      >
        <input
          type="text"
          maxlength="500"
          placeholder="Escribe un comentario..."
          required
        >

        <button type="submit">
          Enviar
        </button>
      </form>
    `;
  }


  async function createCommunityPostComment(
    postId,
    body
  ) {
    const cleanBody =
      body.trim();

    if (!cleanBody || !state.user) return;

    const { error } = await db
      .from('post_comments')
      .insert({
        post_id: postId,
        author_id: state.user.id,
        body: cleanBody,
        status: 'published'
      });

    if (error) {
      console.error(
        'Rooms: error creando comentario',
        error
      );

      notify(
        'No hemos podido publicar el comentario'
      );

      return;
    }

    await loadCommunityPostInteractions();

    renderRealCommunityDetail();

    setTimeout(() => {
      const panel =
        document.querySelector(
          `[data-community-comments-panel="${postId}"]`
        );

      if (panel) {
        panel.hidden = false;
        renderCommunityCommentsPanel(postId);
      }
    }, 0);
  }


  function getActiveCommunityPosts() {
    const communityId =
      state.activeCommunity?.id;

    if (!communityId) return [];

    const today =
      new Date()
        .toISOString()
        .slice(0, 10);

    return [...state.posts.values()]
      .filter(post =>
        post.community_id === communityId &&
        post.status === 'published' &&
        !(
          post.post_type === 'warning' &&
          post.expires_at &&
          post.expires_at < today
        )
      )
      .sort(
        (a, b) =>
          new Date(b.created_at) -
          new Date(a.created_at)
      );
  }


  function renderRealCommunityDetail() {
    const view =
      document.querySelector('#communityView');

    const community =
      state.activeCommunity;

    if (!view || !community) return;

    const members =
      state.activeCommunityMembers || [];

    const membership =
      state.activeCommunityMembership;

    const isOwner =
      community.owner_id === state.user?.id ||
      membership?.role === 'owner';

    const isMember =
      Boolean(membership);

    const memberLabel =
      members.length === 1
        ? '1 miembro'
        : `${members.length} miembros`;

    const visibility =
      community.visibility === 'private'
        ? 'PRIVADA'
        : 'PÚBLICA';

    view.innerHTML = `
      <button
        class="community-back"
        type="button"
        data-back-real-community
      >
        ← Volver
      </button>

      <header class="community-hero real-community-hero">

        <div class="community-hero-image">
          ${
            community.image_url
              ? `
                <img
                  src="${escapeHtml(community.image_url)}"
                  alt="${escapeHtml(community.name)}"
                >
              `
              : `
                <div class="real-community-image-placeholder">
                  #
                </div>
              `
          }

          <span>${visibility}</span>
        </div>

        <div class="community-hero-copy">

          <small>
            COMUNIDAD · ROOMS
          </small>

          <div class="real-community-title-row">

            <h1>
              ${escapeHtml(community.name)}
            </h1>

            ${
              isOwner
                ? `
                  <span class="real-community-owner-badge">
                    ADMIN
                  </span>
                `
                : `
                  <button
                    type="button"
                    class="${isMember ? 'joined' : ''}"
                    data-toggle-community-membership="${escapeHtml(community.id)}"
                  >
                    ${isMember ? 'Salir de la comunidad' : 'Unirme'}
                  </button>
                `
            }

          </div>

          <p>
            ${escapeHtml(
              community.description ||
              'Comunidad de Rooms'
            )}
          </p>

          <div class="community-meta">

            <span>
              <b>${memberLabel}</b>
            </span>

            <span>
              <b>
                ${
                  community.visibility === 'private'
                    ? 'Acceso privado'
                    : 'Comunidad abierta'
                }
              </b>
            </span>

            ${
              isOwner
                ? `
                  <span>
                    <b>Administras esta comunidad</b>
                  </span>
                `
                : ''
            }

          </div>

        </div>
      </header>


      <nav
        class="community-tabs"
        role="tablist"
      >

        <button
          class="active"
          type="button"
          data-real-community-tab="feed"
        >
          Feed
        </button>

        <button
          type="button"
          data-real-community-tab="members"
        >
          Miembros
        </button>

        ${
          isMember
            ? `
              <button
                class="community-publish"
                type="button"
                data-community-publish-placeholder
              >
                ＋ Publicar
              </button>
            `
            : ''
        }

      </nav>


      <section
        class="community-panel"
        data-real-community-panel="feed"
      >

        <div class="community-feed-layout">

          <div class="community-stream">

            ${
              getActiveCommunityPosts().length
                ? getActiveCommunityPosts()
                    .map(renderCommunityPost)
                    .join('')
                : `
                  <article class="real-community-empty-feed">
                    <span>✦</span>

                    <h2>
                      ${
                        isMember
                          ? 'Todavía no hay publicaciones'
                          : 'Únete para participar'
                      }
                    </h2>

                    <p>
                      ${
                        isMember
                          ? 'Sé la primera persona en publicar algo en esta comunidad.'
                          : 'Forma parte de la comunidad para publicar, comentar y participar.'
                      }
                    </p>
                  </article>
                `
            }

          </div>

          <aside class="community-about">

            <small>
              SOBRE ESTA COMUNIDAD
            </small>

            <p>
              ${escapeHtml(
                community.description ||
                'Espacio compartido dentro de Rooms.'
              )}
            </p>

            <hr>

            <b>Visibilidad</b>

            <span>
              ${
                community.visibility === 'private'
                  ? 'Privada'
                  : 'Pública'
              }
            </span>

            <hr>

            <b>Miembros</b>
            <span>${members.length}</span>

            ${
              isOwner
                ? `
                  <button
                    type="button"
                    data-manage-community-placeholder
                  >
                    Gestionar comunidad
                  </button>
                `
                : ''
            }

          </aside>

        </div>

      </section>


      <section
        class="community-panel"
        data-real-community-panel="members"
        hidden
      >

        <div class="members-header">

          <div>
            <small>
              ${memberLabel.toUpperCase()}
            </small>

            <h2>Miembros</h2>
          </div>

        </div>

        <div class="community-members real-community-members">

          ${
            members.length
              ? members.map(member => {
                  const profile =
                    state.profiles.get(member.user_id);

                  const name =
                    profile?.alias ||
                    profile?.name ||
                    (
                      member.user_id === state.user?.id
                        ? 'Tú'
                        : 'Usuario de Rooms'
                    );

                  const avatar =
                    profile?.avatar_url;

                  const role =
                    member.role === 'owner'
                      ? 'ADMIN'
                      : member.role === 'admin'
                        ? 'ADMIN'
                        : 'MIEMBRO';

                  return `
                    <article>

                      ${
                        avatar
                          ? `
                            <img
                              src="${escapeHtml(avatar)}"
                              alt="${escapeHtml(name)}"
                            >
                          `
                          : `
                            <span class="member-photo">
                              ${escapeHtml(initials(name))}
                            </span>
                          `
                      }

                      <div>

                        <small>
                          ${role}
                        </small>

                        <b>
                          ${escapeHtml(name)}
                        </b>

                        <p>
                          ${
                            member.user_id === state.user?.id
                              ? 'Tu perfil'
                              : 'Miembro de Rooms'
                          }
                        </p>

                      </div>

                    </article>
                  `;
                }).join('')
              : `
                <div class="communities-empty-card">
                  <span>◯</span>
                  <h3>No hay miembros todavía</h3>
                </div>
              `
          }

        </div>

      </section>
    `;
  }



  function ensureManageCommunityModal() {
    let modal =
      document.querySelector('#manageCommunityModal');

    if (modal) return modal;

    modal = document.createElement('div');

    modal.className = 'modal';
    modal.id = 'manageCommunityModal';
    modal.setAttribute('aria-hidden', 'true');

    modal.innerHTML = `
      <div
        class="backdrop"
        data-close-manage-community
      ></div>

      <article class="manage-community-shell">

        <header class="manage-community-header">
          <div>
            <small>ADMINISTRACIÓN</small>
            <h2>Gestionar comunidad</h2>
          </div>

          <button
            type="button"
            data-close-manage-community
            aria-label="Cerrar"
          >
            ×
          </button>
        </header>


        <div class="manage-community-layout">

          <nav class="manage-community-nav">
            <button
              type="button"
              class="active"
              data-manage-community-tab="edit"
            >
              <span>01</span>
              Editar comunidad
            </button>

            <button
              type="button"
              data-manage-community-tab="members"
            >
              <span>02</span>
              Miembros
            </button>
          </nav>


          <div class="manage-community-content">

            <section
              data-manage-community-panel="edit"
            >

              <form id="manageCommunityForm">

                <section class="manage-community-cover-section">

                  <div class="manage-community-section-heading">
                    <div>
                      <small>IDENTIDAD</small>
                      <h3>Foto de portada</h3>
                    </div>

                    <span>
                      JPG, PNG o WebP · máx. 5 MB
                    </span>
                  </div>


                  <div
                    class="manage-community-cover-preview"
                    id="manageCommunityCoverPreview"
                  >
                    <div class="manage-community-cover-empty">
                      <b>#</b>
                      <span>Sin portada</span>
                    </div>
                  </div>


                  <div class="manage-community-cover-actions">

                    <label>
                      Cambiar portada

                      <input
                        type="file"
                        id="manageCommunityCoverInput"
                        accept="image/jpeg,image/png,image/webp"
                        hidden
                      >
                    </label>

                    <button
                      type="button"
                      id="removeCommunityCover"
                    >
                      Eliminar portada
                    </button>

                  </div>

                </section>


                <div class="manage-community-divider"></div>


                <label class="manage-community-field">
                  <span>Nombre de la comunidad</span>

                  <input
                    type="text"
                    id="manageCommunityName"
                    maxlength="60"
                    required
                  >
                </label>


                <label class="manage-community-field">
                  <span>Descripción</span>

                  <textarea
                    id="manageCommunityDescription"
                    maxlength="280"
                    rows="5"
                  ></textarea>
                </label>


                <fieldset class="manage-community-visibility">
                  <legend>Visibilidad</legend>

                  <label>
                    <input
                      type="radio"
                      name="manageCommunityVisibility"
                      value="public"
                    >

                    <span>
                      <b>Pública</b>
                      <small>
                        Puede descubrirse desde Explore.
                      </small>
                    </span>
                  </label>

                  <label>
                    <input
                      type="radio"
                      name="manageCommunityVisibility"
                      value="private"
                    >

                    <span>
                      <b>Privada</b>
                      <small>
                        Solo accesible para personas autorizadas.
                      </small>
                    </span>
                  </label>
                </fieldset>


                <div class="manage-community-save-bar">
                  <button
                    type="submit"
                    class="manage-community-save"
                  >
                    Guardar cambios
                  </button>
                </div>

              </form>

            </section>


            <section
              data-manage-community-panel="members"
              hidden
            >

              <div class="manage-community-members-heading">
                <div>
                  <small>COMUNIDAD</small>
                  <h3>Miembros</h3>
                </div>

                <span id="manageCommunityMemberCount"></span>
              </div>

              <div
                class="manage-community-members-list"
                id="manageCommunityMembersList"
              ></div>

            </section>

          </div>

        </div>

      </article>
    `;

    document.body.appendChild(modal);


    modal
      .querySelector('#manageCommunityForm')
      ?.addEventListener(
        'submit',
        saveCommunityManagement
      );


    modal
      .querySelector('#manageCommunityCoverInput')
      ?.addEventListener('change', event => {
        const file =
          event.target.files?.[0];

        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
          notify('La imagen no puede superar 5 MB');
          event.target.value = '';
          return;
        }

        const preview =
          modal.querySelector(
            '#manageCommunityCoverPreview'
          );

        if (!preview) return;

        const url =
          URL.createObjectURL(file);

        preview.innerHTML = `
          <img
            src="${url}"
            alt="Nueva portada"
          >
        `;

        modal.dataset.removeCover = 'false';
      });


    modal
      .querySelector('#removeCommunityCover')
      ?.addEventListener('click', () => {
        const preview =
          modal.querySelector(
            '#manageCommunityCoverPreview'
          );

        const input =
          modal.querySelector(
            '#manageCommunityCoverInput'
          );

        if (input) input.value = '';

        modal.dataset.removeCover = 'true';

        if (preview) {
          preview.innerHTML = `
            <div class="manage-community-cover-empty">
              <b>#</b>
              <span>Sin portada</span>
            </div>
          `;
        }
      });


    modal.addEventListener('click', event => {
      const tab =
        event.target.closest(
          '[data-manage-community-tab]'
        );

      if (!tab) return;

      const name =
        tab.dataset.manageCommunityTab;

      modal
        .querySelectorAll(
          '[data-manage-community-tab]'
        )
        .forEach(button => {
          button.classList.toggle(
            'active',
            button === tab
          );
        });

      modal
        .querySelectorAll(
          '[data-manage-community-panel]'
        )
        .forEach(panel => {
          panel.hidden =
            panel.dataset.manageCommunityPanel !== name;
        });
    });

    return modal;
  }


  function renderManageCommunityMembers() {
    const modal =
      ensureManageCommunityModal();

    const list =
      modal.querySelector(
        '#manageCommunityMembersList'
      );

    const count =
      modal.querySelector(
        '#manageCommunityMemberCount'
      );

    const members =
      state.activeCommunityMembers || [];

    if (count) {
      count.textContent =
        members.length === 1
          ? '1 miembro'
          : `${members.length} miembros`;
    }

    if (!list) return;

    list.innerHTML = members
      .map(member => {
        const profile =
          state.profiles.get(member.user_id);

        const isMe =
          member.user_id === state.user?.id;

        const name =
          profile?.alias ||
          profile?.name ||
          (isMe ? 'Tú' : 'Usuario de Rooms');

        const avatar =
          profile?.avatar_url;

        const role =
          member.role === 'owner'
            ? 'PROPIETARIO'
            : member.role === 'admin'
              ? 'ADMIN'
              : 'MIEMBRO';

        const joined =
          member.joined_at
            ? new Date(
                member.joined_at
              ).toLocaleDateString(
                'es-ES',
                {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric'
                }
              )
            : '';

        return `
          <article class="manage-community-member">

            ${
              avatar
                ? `
                  <img
                    src="${escapeHtml(avatar)}"
                    alt="${escapeHtml(name)}"
                  >
                `
                : `
                  <span>
                    ${escapeHtml(initials(name))}
                  </span>
                `
            }

            <div>
              <small>${role}</small>

              <b>
                ${escapeHtml(name)}
              </b>

              <p>
                ${
                  joined
                    ? `Desde ${escapeHtml(joined)}`
                    : 'Miembro de la comunidad'
                }
              </p>
            </div>

          </article>
        `;
      })
      .join('');
  }


  function openManageCommunityModal() {
    const community =
      state.activeCommunity;

    if (
      !community ||
      community.owner_id !== state.user?.id
    ) {
      notify(
        'Solo el propietario puede gestionar esta comunidad'
      );
      return;
    }

    const modal =
      ensureManageCommunityModal();

    modal.dataset.removeCover = 'false';

    const name =
      modal.querySelector(
        '#manageCommunityName'
      );

    const description =
      modal.querySelector(
        '#manageCommunityDescription'
      );

    const publicRadio =
      modal.querySelector(
        'input[name="manageCommunityVisibility"][value="public"]'
      );

    const privateRadio =
      modal.querySelector(
        'input[name="manageCommunityVisibility"][value="private"]'
      );

    const cover =
      modal.querySelector(
        '#manageCommunityCoverPreview'
      );

    const input =
      modal.querySelector(
        '#manageCommunityCoverInput'
      );

    if (name) {
      name.value =
        community.name || '';
    }

    if (description) {
      description.value =
        community.description || '';
    }

    if (publicRadio) {
      publicRadio.checked =
        community.visibility !== 'private';
    }

    if (privateRadio) {
      privateRadio.checked =
        community.visibility === 'private';
    }

    if (input) {
      input.value = '';
    }

    if (cover) {
      cover.innerHTML =
        community.image_url
          ? `
            <img
              src="${escapeHtml(community.image_url)}"
              alt="${escapeHtml(community.name)}"
            >
          `
          : `
            <div class="manage-community-cover-empty">
              <b>#</b>
              <span>Sin portada</span>
            </div>
          `;
    }

    renderManageCommunityMembers();

    modal
      .querySelectorAll(
        '[data-manage-community-tab]'
      )
      .forEach(button => {
        button.classList.toggle(
          'active',
          button.dataset.manageCommunityTab === 'edit'
        );
      });

    modal
      .querySelectorAll(
        '[data-manage-community-panel]'
      )
      .forEach(panel => {
        panel.hidden =
          panel.dataset.manageCommunityPanel !== 'edit';
      });

    modal.classList.add('open');
    modal.setAttribute(
      'aria-hidden',
      'false'
    );

    document.body.style.overflow =
      'hidden';
  }


  function closeManageCommunityModal() {
    const modal =
      document.querySelector(
        '#manageCommunityModal'
      );

    if (!modal) return;

    modal.classList.remove('open');

    modal.setAttribute(
      'aria-hidden',
      'true'
    );

    document.body.style.overflow = '';
  }


  async function saveCommunityManagement(event) {
    event.preventDefault();

    const community =
      state.activeCommunity;

    if (
      !community ||
      community.owner_id !== state.user?.id
    ) {
      return;
    }

    const modal =
      ensureManageCommunityModal();

    const submit =
      modal.querySelector(
        '.manage-community-save'
      );

    const name =
      modal
        .querySelector(
          '#manageCommunityName'
        )
        ?.value
        .trim();

    const description =
      modal
        .querySelector(
          '#manageCommunityDescription'
        )
        ?.value
        .trim();

    const visibility =
      modal
        .querySelector(
          'input[name="manageCommunityVisibility"]:checked'
        )
        ?.value || 'public';

    const coverFile =
      modal
        .querySelector(
          '#manageCommunityCoverInput'
        )
        ?.files?.[0];

    if (!name) {
      notify(
        'La comunidad necesita un nombre'
      );
      return;
    }

    if (submit) {
      submit.disabled = true;
      submit.textContent =
        'Guardando...';
    }

    const changes = {
      name,
      description:
        description || null,
      visibility
    };


    if (
      modal.dataset.removeCover === 'true'
    ) {
      changes.image_url = null;
    }


    if (coverFile) {
      const extension =
        (
          coverFile.name
            .split('.')
            .pop() || 'jpg'
        )
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '');

      const storagePath =
        `${state.user.id}/${community.id}/${Date.now()}.${extension}`;

      const {
        error: uploadError
      } = await db.storage
        .from('community-images')
        .upload(
          storagePath,
          coverFile,
          {
            cacheControl: '3600',
            upsert: false,
            contentType:
              coverFile.type
          }
        );

      if (uploadError) {
        console.error(
          'Rooms: error subiendo portada de comunidad',
          uploadError
        );

        if (submit) {
          submit.disabled = false;
          submit.textContent =
            'Guardar cambios';
        }

        notify(
          'No hemos podido subir la portada'
        );

        return;
      }

      const {
        data: publicUrlData
      } = db.storage
        .from('community-images')
        .getPublicUrl(storagePath);

      changes.image_url =
        publicUrlData.publicUrl;
    }


    const {
      data: updatedCommunity,
      error
    } = await db
      .from('communities')
      .update(changes)
      .eq(
        'id',
        community.id
      )
      .eq(
        'owner_id',
        state.user.id
      )
      .select()
      .single();


    if (error) {
      console.error(
        'Rooms: error editando comunidad',
        error
      );

      if (submit) {
        submit.disabled = false;
        submit.textContent =
          'Guardar cambios';
      }

      notify(
        'No hemos podido guardar los cambios'
      );

      return;
    }


    state.communities.set(
      updatedCommunity.id,
      updatedCommunity
    );

    state.activeCommunity =
      updatedCommunity;


    if (submit) {
      submit.disabled = false;
      submit.textContent =
        'Guardar cambios';
    }

    closeManageCommunityModal();

    renderRealCommunityDetail();

    await loadMemberCommunities();

    renderFilteredExplore();

    renderRealFeed(
      [...state.listings.values()],
      [...state.profiles.values()],
      [...state.posts.values()],
      [...state.communities.values()]
    );

    notify(
      'Comunidad actualizada'
    );
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

  function getExploreCommunities() {
    const search =
      document.querySelector('#exploreSearch');

    const query =
      (search?.value || '')
        .trim()
        .toLowerCase();

    const communities =
      [...state.communities.values()];

    if (!query) {
      return communities;
    }

    return communities.filter(community => {
      const haystack = [
        community.name,
        community.description,
        community.visibility
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(query);
    });
  }


  function renderExploreCommunities(communities) {
    const list =
      document.querySelector('#exploreList');

    const map =
      document.querySelector('#exploreMap');

    if (!list) return;

    if (map) map.hidden = true;

    if (!communities.length) {
      list.innerHTML = `
        <section class="real-feed-empty explore-real-empty">
          <span>#</span>
          <h2>No encontramos comunidades</h2>
          <p>
            Prueba con otro nombre, barrio,
            universidad o tipo de comunidad.
          </p>
        </section>
      `;
      return;
    }

    list.innerHTML = `
      <div class="explore-community-results">

        <div class="explore-results-heading">
          <p>
            <strong>${communities.length}</strong>
            ${
              communities.length === 1
                ? 'comunidad'
                : 'comunidades'
            }
          </p>
        </div>

        <div class="explore-community-grid">

          ${communities.map(community => `
            <article
              class="explore-community-card"
              data-real-community="${escapeHtml(community.id)}"
            >

              <div class="explore-community-media">
                ${
                  community.image_url
                    ? `
                      <img
                        src="${escapeHtml(community.image_url)}"
                        alt="${escapeHtml(community.name)}"
                      >
                    `
                    : `
                      <div class="explore-community-placeholder">
                        #
                      </div>
                    `
                }

                <span class="explore-community-type">
                  COMUNIDAD
                </span>
              </div>

              <div class="explore-community-body">

                <small>
                  ${
                    community.visibility === 'private'
                      ? 'PRIVADA'
                      : 'ABIERTA'
                  }
                </small>

                <h2>
                  ${escapeHtml(community.name)}
                </h2>

                <p>
                  ${escapeHtml(
                    community.description ||
                    'Comunidad de Rooms'
                  )}
                </p>

                <button
                  type="button"
                  data-real-community-open="${escapeHtml(community.id)}"
                >
                  Ver comunidad
                  <span>→</span>
                </button>

              </div>

            </article>
          `).join('')}

        </div>

      </div>
    `;
  }


  function renderExplorePeople(profiles) {
    const list = document.querySelector('#exploreList');
    const map = document.querySelector('#exploreMap');

    if (!list) return;

    if (map) map.hidden = true;

    if (!profiles.length) {
      list.innerHTML = `
        <section class="real-feed-empty explore-real-empty">
          <span>◯</span>
          <h2>No encontramos personas con esa búsqueda</h2>
          <p>Prueba con otra zona, nombre o tipo de búsqueda.</p>
        </section>
      `;
      return;
    }

    const traitLabels = {
      tidy: 'Ordenado',
      social: 'Sociable',
      calm: 'Tranquilo',
      independent: 'Independiente',
      cook: 'Cocinillas',
      early: 'Madrugador',
      night: 'Nocturno'
    };

    list.innerHTML = `
      <div class="explore-results-heading">
        <p>
          <strong>${profiles.length}</strong>
          ${profiles.length === 1 ? 'persona' : 'personas'}
        </p>
      </div>

      <div class="explore-people-grid">
        ${profiles.map(profile => {
          const name =
            profile.alias ||
            profile.name ||
            'Usuario de Rooms';

          const zone =
            profile.zones?.[0] ||
            '';

          const seeking =
            profile.seeking?.length
              ? profile.seeking.map(labelSeeking).join(' · ')
              : '';

          const traits =
            (profile.traits || [])
              .slice(0, 3)
              .map(value => traitLabels[value] || value);

          return `
            <article
              class="explore-person-card"
              data-real-user="${profile.id}"
              tabindex="0"
            >
              <div class="explore-person-photo">
                ${
                  profile.avatar_url
                    ? `<img
                        src="${escapeHtml(profile.avatar_url)}"
                        alt="${escapeHtml(name)}"
                      >`
                    : `<div class="explore-person-placeholder">
                        ${escapeHtml(initials(name))}
                      </div>`
                }

                <button
                  type="button"
                  class="explore-person-save"
                  data-save-kind="person"
                  data-save-id="${profile.id}"
                  aria-label="Guardar perfil"
                >♡</button>
              </div>

              <div class="explore-person-body">
                <small>PERSONA</small>

                <h2>
                  ${escapeHtml(name)}
                  ${profile.age ? `, ${profile.age}` : ''}
                </h2>

                ${
                  seeking || zone
                    ? `<p class="explore-person-search">
                        ${escapeHtml(
                          [seeking, zone].filter(Boolean).join(' · ')
                        )}
                      </p>`
                    : `<p class="explore-person-search">
                        Perfil en Rooms
                      </p>`
                }

                ${
                  traits.length
                    ? `<div class="explore-person-traits">
                        ${traits
                          .map(trait => `<span>${escapeHtml(trait)}</span>`)
                          .join('')}
                      </div>`
                    : ''
                }

                <p class="explore-person-bio">
                  ${escapeHtml(
                    profile.bio ||
                    'Todavía no ha añadido una descripción.'
                  )}
                </p>

                <div class="explore-person-actions">
                  <button
                    type="button"
                    class="explore-person-send-home"
                    data-send-person-home="${profile.id}"
                  >
                    ＋ Grupo
                  </button>

                  <button
                    type="button"
                    data-connect
                    data-user-id="${profile.id}"
                  >
                    ${escapeHtml(connectionButtonLabel(profile.id))}
                  </button>

                  <button
                    type="button"
                    data-open-explore-person="${profile.id}"
                  >
                    Ver perfil →
                  </button>
                </div>
              </div>
            </article>
          `;
        }).join('')}
      </div>
    `;
  }

  function getExplorePeople() {
    const query = normalizeExploreValue(
      document.querySelector('#exploreSearch')?.value
    );

    let profiles = [...state.profiles.values()]
      .filter(profile =>
        profile.id &&
        profile.id !== state.user?.id &&
        !state.blockedUsers?.has(profile.id)
      );

    if (query) {
      profiles = profiles.filter(profile => {
        const seeking = (profile.seeking || [])
          .map(labelSeeking);

        const haystack = normalizeExploreValue([
          profile.name,
          profile.alias,
          profile.bio,
          ...(profile.zones || []),
          ...(profile.traits || []),
          ...seeking
        ].join(' '));

        return haystack.includes(query);
      });
    }

    return profiles;
  }

  function renderRealMapCard(item) {
    if (!item) return '';

    const kind = item.kind === 'apartment'
      ? 'Piso entero'
      : 'Habitación';

    const photo = item.photos?.[0] || '';
    const title = item.title || `${item.zone || 'Madrid'} · ${kind}`;

    return `
      <div class="real-map-card-media">
        ${
          photo
            ? `<img src="${escapeHtml(photo)}" alt="${escapeHtml(title)}">`
            : `<div class="real-map-card-placeholder">rooms.</div>`
        }
      </div>

      <div class="real-map-card-copy">
        <small>${escapeHtml(kind)}</small>
        <h2>${escapeHtml(item.zone || 'Madrid')}</h2>

        <p>
          <b>${Number(item.price || 0).toLocaleString('es-ES')} €</b>
          / mes
        </p>

        <button
          type="button"
          data-real-map-open="${item.id}"
        >
          Ver vivienda →
        </button>
      </div>
    `;
  }

  function renderRealExplore(listings) {
    const list = document.querySelector('#exploreList');
    const map = document.querySelector('#exploreMap');

    if (list) {
      if (!listings.length) {
        list.innerHTML = `
          <section class="real-feed-empty explore-real-empty">
            <span>⌕</span>
            <h2>Todavía no hay viviendas publicadas</h2>
            <p>Cuando aparezcan nuevas habitaciones o pisos, los encontrarás aquí.</p>
          </section>
        `;
      } else {
        list.innerHTML = `
          <div class="explore-results-heading">
            <p>
              <strong>${listings.length}</strong>
              ${listings.length === 1 ? 'resultado' : 'resultados'}
            </p>
          </div>

          <div class="explore-real-grid">
            ${listings.map(item => {
              const kind = item.kind === 'apartment'
                ? 'Piso entero'
                : 'Habitación';

              const photo = item.photos?.[0] || '';
              const title = item.title || `${item.zone} · ${kind}`;
              const description = item.description || '';
              const saveKind = item.kind === 'apartment'
                ? 'apartment'
                : 'room';

              return `
                <article
                  class="explore-property-card"
                  data-real-listing="${item.id}"
                  tabindex="0"
                >
                  <div class="explore-property-media">
                    ${
                      photo
                        ? `<img
                            src="${escapeHtml(photo)}"
                            alt="${escapeHtml(title)}"
                          >`
                        : `<div class="explore-property-placeholder">
                            <span>rooms.</span>
                          </div>`
                    }

                    <button
                      type="button"
                      class="explore-property-save"
                      data-save-kind="${saveKind}"
                      data-save-id="${item.id}"
                      aria-label="Guardar vivienda"
                    >♡</button>

                    <span class="explore-property-type">
                      ${escapeHtml(kind)}
                    </span>
                  </div>

                  <div class="explore-property-body">
                    <div class="explore-property-top">
                      <div>
                        <small>${escapeHtml(item.zone || 'Madrid')}</small>
                        <h2>${escapeHtml(title)}</h2>
                      </div>

                      <p class="explore-property-price">
                        <b>${Number(item.price || 0).toLocaleString('es-ES')} €</b>
                        <span>/ mes</span>
                      </p>
                    </div>

                    ${
                      description
                        ? `<p class="explore-property-description">
                            ${escapeHtml(description)}
                          </p>`
                        : ''
                    }

                    <div class="explore-property-footer">
                      <span>Publicado en Rooms</span>

                      <div class="explore-property-actions">
                        <button
                          type="button"
                          class="explore-send-home"
                          data-send-home-id="${item.id}"
                        >
                          ＋ Grupo
                        </button>

                        <button
                          type="button"
                          class="explore-property-open"
                          data-real-listing="${item.id}"
                        >
                          Ver vivienda →
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              `;
            }).join('')}
          </div>
        `;
      }
    }

    if (map) {
      const zonePositions = {
        'Chamberí': [38, 32],
        'Moncloa': [25, 42],
        'Argüelles': [31, 46],
        'Salamanca': [63, 35],
        'Retiro': [66, 52],
        'Centro': [48, 50],
        'Malasaña': [43, 40],
        'La Latina': [42, 61],
        'Lavapiés': [52, 62],
        'Chamartín': [62, 20]
      };

      if (!listings.length) {
        map.innerHTML = `
          <section class="real-feed-empty compact explore-map-pending">
            <span>⌖</span>
            <h2>Sin viviendas en el mapa</h2>
            <p>Cuando haya anuncios publicados aparecerán aquí.</p>
          </section>
        `;
      } else {
        const first = listings[0];

        map.innerHTML = `
          <div class="real-map-layout">
            <div class="real-map-canvas">
              <div class="real-map-grid"></div>

              <span class="real-map-label north">NORTE</span>
              <span class="real-map-label centro">CENTRO</span>
              <span class="real-map-label retiro">RETIRO</span>

              ${listings.map((item, index) => {
                const position =
                  zonePositions[item.zone] ||
                  [35 + ((index * 17) % 40), 28 + ((index * 13) % 45)];

                return `
                  <button
                    type="button"
                    class="real-map-pin ${index === 0 ? 'active' : ''}"
                    style="--x:${position[0]}%;--y:${position[1]}%"
                    data-real-map-pin="${item.id}"
                    aria-label="${escapeHtml(item.zone || 'Madrid')} · ${Number(item.price || 0).toLocaleString('es-ES')} euros"
                  >
                    ${Number(item.price || 0).toLocaleString('es-ES')} €
                  </button>
                `;
              }).join('')}
            </div>

            <article class="real-map-card" id="realMapCard">
              ${renderRealMapCard(first)}
            </article>
          </div>
        `;
      }
    }
  }

  function clearDemoOnlyViews() {

    const collections = document.querySelector('#savedView .collection-grid');
    if (collections) collections.innerHTML = '<div class="real-empty-state"><b>Todavía no tienes colecciones</b><p>Crea una cuando quieras organizar tus guardados.</p></div>';
  }

  function refreshOwnActivity(type) {
    if (!state.user) return;
    const active = type || document.querySelector('[data-own-activity].active')?.dataset.ownActivity || 'posts';
    const ownListings = [...state.listings.values()].filter(item => item.owner_id === state.user.id);
    const ownPosts = [...state.posts.values()].filter(item => item.author_id === state.user.id);
    const counts = { posts: ownPosts.length, listings: ownListings.length, shared: 0, reviews: 0 };
    const tabNames = { posts: 'Publicaciones', listings: 'Anuncios', shared: 'Compartidos', reviews: 'Reseñas' };
    document.querySelectorAll('[data-own-activity]').forEach(tab => {
      tab.textContent = `${tabNames[tab.dataset.ownActivity]} (${counts[tab.dataset.ownActivity] || 0})`;
      tab.classList.toggle('active', tab.dataset.ownActivity === active);
    });
    renderOwnActivity(active, ownListings, ownPosts);
  }

  function renderOwnActivity(type, ownListings, ownPosts) {
    const target = document.querySelector('#ownActivityPreview');
    if (!target) return;
    if (type === 'listings' && ownListings.length) {
      target.innerHTML = `<div class="own-real-activity-list">${ownListings.map(listing => {
        const kind = listing.kind === 'apartment' ? 'Piso entero' : 'Habitación';
        const photo = listing.photos?.[0];
        return `<article class="own-real-listing" data-real-listing="${listing.id}">
          ${photo ? `<img src="${escapeHtml(photo)}" alt="${escapeHtml(listing.title)}">` : '<div class="own-listing-placeholder">rooms.</div>'}
          <div><small>${escapeHtml(kind)}</small><h3>${escapeHtml(listing.zone)} · ${Number(listing.price).toLocaleString('es-ES')} €/mes</h3><p>${escapeHtml(listing.description || 'Sin descripción')}</p><button type="button" data-edit-listing="${listing.id}">Editar anuncio</button></div>
        </article>`;
      }).join('')}</div>`;
      return;
    }
    if (type === 'posts' && ownPosts.length) {
      target.innerHTML = `<div class="own-real-activity-list">${ownPosts.map(post => `<article class="own-real-post"><small>${relativeTime(post.created_at)}</small><p>${escapeHtml(post.body)}</p></article>`).join('')}</div>`;
      return;
    }
    const labels = { posts: 'publicaciones', listings: 'anuncios', shared: 'elementos compartidos', reviews: 'reseñas' };
    target.innerHTML = `<small>TODAVÍA VACÍO</small><p>Aún no tienes ${labels[type] || 'actividad'}.</p><span>Cuando empieces a usar Rooms aparecerá aquí.</span>`;
  }

  const publishTotals = { room: 4, apartment: 3, mate: 2, external: 3, post: 2 };

  function currentPublishType() {
    const label = document.querySelector('#publishFlowKind')?.textContent || '';
    if (label.includes('OFRECER')) return 'room';
    if (label.includes('PUBLICAR PISO')) return 'apartment';
    if (label.includes('COMPAÑERO')) return 'mate';
    if (label.includes('EXTERNA') || label.includes('COMPARTIR')) return 'external';
    if (label.includes('PUBLICACIÓN')) return 'post';
    return null;
  }

  function currentPublishStep(type = currentPublishType()) {
    const width = parseFloat(document.querySelector('#publishProgressBar')?.style.width || '0');
    return Math.max(0, Math.round(width / (100 / (publishTotals[type] || 1))) - 1);
  }

  function capturePublishStep() {
    const type = currentPublishType();
    if (!type) return null;
    if (state.publishType !== type) {
      state.publishType = type;
      state.publishDraft = { steps: {}, files: [] };
    }
    const step = currentPublishStep(type);
    const content = document.querySelector('#publishFlowContent');
    const values = [...content.querySelectorAll('input:not([type="file"]),textarea,select')].map(field => field.value.trim());
    const selected = [...content.querySelectorAll('[data-selectable][aria-pressed="true"]')].map(button => button.textContent.trim());
    const meta =
      type === 'post'
        ? {
            zone:
              content
                .querySelector('[data-post-zone]')
                ?.value
                .trim() || null,

            expiresAt:
              content
                .querySelector('[data-post-expires]')
                ?.value || null,

            listingId:
              content
                .querySelector('[data-post-listing]')
                ?.value || null,

            communityPostType:
              selectedCommunityPostType(content)
          }
        : {};

    state.publishDraft.steps[step] = {
      values,
      selected,
      meta
    };

    return {
      type,
      step,
      values,
      selected,
      meta
    };
  }


  function selectedCommunityPostType(content) {
    const selected =
      [...content.querySelectorAll(
        '[data-selectable][aria-pressed="true"]'
      )]
        .map(button => button.textContent.trim())
        .find(Boolean);

    return selected || 'Pregunta';
  }


  function renderCommunityPostFields(content) {
    if (!content) return;

    const existing =
      content.querySelector('#communityPostExtraFields');

    if (existing) existing.remove();

    const textarea =
      content.querySelector('textarea');

    if (!textarea) return;

    const type =
      selectedCommunityPostType(content);

    const ownListings =
      [...state.listings.values()]
        .filter(
          listing =>
            listing.owner_id === state.user?.id &&
            listing.status === 'published'
        );

    let fields = '';


    if (type === 'Pregunta') {
      fields = `
        <label class="community-post-extra-field">
          <span>Zona <small>Opcional</small></span>
          <input
            type="text"
            data-post-zone
            placeholder="Ej. Chamberí"
          >
        </label>
      `;
    }


    if (type === 'Recomendación') {
      fields = `
        <label class="community-post-extra-field">
          <span>¿Dónde?</span>
          <input
            type="text"
            data-post-zone
            placeholder="Barrio, zona o lugar"
          >
        </label>

        <p class="community-post-extra-help">
          Puedes añadir una foto para dar contexto a tu recomendación.
        </p>
      `;
    }


    if (type === 'Barrio') {
      fields = `
        <label class="community-post-extra-field">
          <span>Barrio o zona <b>Obligatorio</b></span>
          <input
            type="text"
            data-post-zone
            placeholder="Ej. Barrio de Salamanca"
            required
          >
        </label>
      `;
    }


    if (type === 'Aviso') {
      fields = `
        <div class="community-post-extra-grid">

          <label class="community-post-extra-field">
            <span>Zona</span>
            <input
              type="text"
              data-post-zone
              placeholder="¿Dónde ocurre?"
            >
          </label>

          <label class="community-post-extra-field">
            <span>Vigente hasta</span>
            <input
              type="date"
              data-post-expires
            >
          </label>

        </div>

        <p class="community-post-extra-help">
          Cuando finalice la fecha, el aviso dejará de mostrarse
          en el feed de la comunidad.
        </p>
      `;
    }


    if (type === 'Experiencia') {
      fields = `
        <label class="community-post-extra-field">
          <span>¿Dónde ocurrió? <small>Opcional</small></span>
          <input
            type="text"
            data-post-zone
            placeholder="Zona o barrio"
          >
        </label>

        <p class="community-post-extra-help">
          Las experiencias funcionan mejor con una imagen.
        </p>
      `;
    }


    if (type === 'Vivienda') {
      fields = `
        <div class="community-housing-post-fields">

          <div class="community-post-extra-heading">
            <small>VIVIENDA</small>
            <h3>Comparte una vivienda real</h3>
            <p>
              Puedes vincular uno de tus anuncios publicados
              para que los miembros puedan abrirlo directamente.
            </p>
          </div>

          ${
            ownListings.length
              ? `
                <label class="community-post-extra-field">
                  <span>Vivienda de ROOMS</span>

                  <select data-post-listing>
                    <option value="">
                      No vincular vivienda
                    </option>

                    ${ownListings.map(listing => `
                      <option value="${escapeHtml(listing.id)}">
                        ${escapeHtml(listing.title || listing.zone)}
                        · ${Number(listing.price || 0).toLocaleString('es-ES')} €
                      </option>
                    `).join('')}
                  </select>
                </label>
              `
              : `
                <div class="community-post-no-listings">
                  No tienes viviendas publicadas todavía.
                  Puedes compartir el post con una foto.
                </div>
              `
          }

        </div>
      `;
    }


    textarea.insertAdjacentHTML(
      'afterend',
      `
        <div
          id="communityPostExtraFields"
          class="community-post-extra-fields"
          data-community-post-type="${escapeHtml(type)}"
        >
          ${fields}
        </div>
      `
    );
  }


  function enhanceCommunityPostComposer(content) {
    if (!content) return;

    renderCommunityPostFields(content);

    content
      .querySelectorAll('[data-selectable]')
      .forEach(button => {
        if (
          button.dataset.communityTypeListener === 'true'
        ) {
          return;
        }

        button.dataset.communityTypeListener = 'true';

        button.addEventListener('click', () => {
          setTimeout(() => {
            renderCommunityPostFields(content);
          }, 0);
        });
      });
  }


  function preparePublishStep() {
    const type = currentPublishType();
    if (!type) return;
    if (state.publishType !== type) {
      state.publishType = type;
      state.publishDraft = { steps: {}, files: [] };
    }
    const step = currentPublishStep(type);
    const content = document.querySelector('#publishFlowContent');
    const saved = state.publishDraft.steps[step];
    const fields = [...content.querySelectorAll('input:not([type="file"]),textarea,select')];
    fields.forEach((field, index) => {
      if (saved) field.value = saved.values[index] || '';
      else if (field.tagName !== 'SELECT') field.value = '';
    });
    content.querySelectorAll('.linked-people article').forEach(item => item.remove());
    content.querySelectorAll('.completion-card strong').forEach(item => { item.textContent = '✓'; });
    content.querySelectorAll('.completion-card b').forEach(item => { item.textContent = 'Datos del anuncio'; });
    content.querySelectorAll('.completion-card span').forEach(item => { item.textContent = 'La publicación se creará únicamente con lo que hayas añadido.'; });

    if (type === 'mate' && step === 0 && !saved) {
      const inputs = content.querySelectorAll('input');
      if (inputs[0]) inputs[0].value = (state.profile?.zones || []).join(', ');
      if (inputs[1]) inputs[1].value = formatBudget(state.profile || {});
      if (inputs[2]) inputs[2].value = state.profile?.move_in_date || '';
    }
    if (type === 'post' && step === 0) {
      enhanceCommunityPostComposer(content);
    }

    preparePhotoUploader(content);
    renderPublishPreview(type, step, content);
  }

  function preparePhotoUploader(content) {
    const button = content.querySelector('.photo-drop');
    if (!button) return;
    if (button.dataset.realUploader === 'true') return;
    button.dataset.realUploader = 'true';
    button.removeAttribute('data-toast');
    const count = state.publishDraft.files?.length || 0;
    button.innerHTML = `<span>＋</span><b>${count ? `${count} ${count === 1 ? 'foto seleccionada' : 'fotos seleccionadas'}` : 'Añadir fotos'}</b><small>Hasta 10 imágenes · JPG, PNG, WebP o HEIC</small>`;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/webp,image/heic';
    input.multiple = true;
    input.hidden = true;
    button.insertAdjacentElement('afterend', input);
    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      input.click();
    });
    input.addEventListener('change', () => {
      const files = [...input.files].slice(0, 10);
      const tooLarge = files.find(file => file.size > 10 * 1024 * 1024);
      if (tooLarge) {
        notify(`${tooLarge.name} supera el límite de 10 MB`);
        return;
      }
      state.publishDraft.files = files;
      button.innerHTML = `<span>✓</span><b>${files.length} ${files.length === 1 ? 'foto seleccionada' : 'fotos seleccionadas'}</b><small>Pulsa para cambiarlas</small>`;
    });
  }

  function renderPublishPreview(type, step, content) {
    const preview = content.querySelector('.publish-preview,.mate-preview,.post-preview,.imported-listing');
    if (!preview) return;
    if (type === 'post') {
      const body = state.publishDraft.steps[0]?.values?.[0] || '';
      const name = state.profile?.alias || state.profile?.name || 'Mi perfil';
      preview.innerHTML = `<header><span>${escapeHtml(initials(name))}</span><div><b>${escapeHtml(name)}</b><small>Vista previa</small></div></header><p>${escapeHtml(body || 'Tu publicación aparecerá aquí.')}</p>`;
      return;
    }
    if (type === 'mate') {
      const name = state.profile?.alias || state.profile?.name || 'Mi perfil';
      const values = state.publishDraft.steps[0]?.values || [];
      preview.innerHTML = `<span class="preview-avatar">${escapeHtml(initials(name))}</span><div><h3>${escapeHtml(name)} busca compañeros</h3><p>${escapeHtml(values[0] || 'Zonas sin definir')} · ${escapeHtml(values[1] || 'Presupuesto sin definir')}</p></div>`;
      return;
    }
    if (type === 'external') {
      preview.innerHTML = '<div><span>FUENTE EXTERNA</span><h3>La información se mostrará cuando podamos verificar el enlace.</h3><p>Nunca inventaremos precio, zona ni características.</p></div>';
      return;
    }
    const values = state.publishDraft.steps[0]?.values || [];
    const features = state.publishDraft.steps[1]?.selected || [];
    preview.innerHTML = `<span>VISTA PREVIA</span><h3>${escapeHtml(values[1] || '—')} €/mes · ${escapeHtml(values[0] || 'Zona sin definir')}</h3><p>${type === 'apartment' ? 'Piso entero' : 'Habitación'} · ${escapeHtml(values[2] || 'Fecha sin definir')}</p><div>${features.map(item => `<i>${escapeHtml(item)}</i>`).join('')}</div>`;
  }

  async function publishRealContent(type) {
    const first = state.publishDraft.steps[0] || { values: [], selected: [] };
    if (type === 'external') {
      notify('La importación de enlaces externos se activará cuando incorporemos la verificación de datos');
      return;
    }
    if (type === 'post') {
      const body =
        first.values[0] || '';

      if (!body) {
        return notify(
          'Escribe el contenido de la publicación'
        );
      }

      const typeLabels = {
        Pregunta: 'question',
        Recomendación: 'recommendation',
        Barrio: 'neighborhood',
        Aviso: 'warning',
        Experiencia: 'experience',
        Vivienda: 'housing'
      };

      const postType =
        typeLabels[
          first.meta?.communityPostType ||
          first.selected[0]
        ] || 'question';


      if (
        postType === 'neighborhood' &&
        !first.meta?.zone
      ) {
        return notify(
          'Indica el barrio o zona'
        );
      }


      const postPayload = {
        author_id: state.user.id,
        post_type: postType,
        body,
        zone:
          first.meta?.zone || null,
        listing_id:
          first.meta?.listingId || null,
        expires_at:
          first.meta?.expiresAt || null,
        community_id:
          state.communityPublishTarget || null,
        media_urls: []
      };


      const {
        data: createdPost,
        error
      } = await db
        .from('posts')
        .insert(postPayload)
        .select()
        .single();


      if (error) {
        console.error(
          'Rooms: error creando publicación',
          error
        );

        return notify(
          'No se pudo crear la publicación'
        );
      }


      if (
        state.publishDraft.files?.length
      ) {
        const media =
          await uploadCommunityPostMedia(
            createdPost.id,
            state.publishDraft.files
          );

        if (media.length) {
          const { error: mediaError } =
            await db
              .from('posts')
              .update({
                media_urls: media
              })
              .eq(
                'id',
                createdPost.id
              );

          if (mediaError) {
            console.error(
              'Rooms: error vinculando imágenes',
              mediaError
            );
          }
        }
      }
    } else if (type === 'mate') {
      const zones = (first.values[0] || '').split(',').map(item => item.trim()).filter(Boolean);
      const numbers = (first.values[1] || '').match(/\d+/g) || [];
      const { error } = await db.from('profiles').update({
        seeking: [...new Set([...(state.profile?.seeking || []), 'mates'])], zones,
        budget_min: numbers[0] ? Number(numbers[0]) : state.profile?.budget_min,
        budget_max: numbers[1] ? Number(numbers[1]) : state.profile?.budget_max,
        move_in_date: first.values[2] || state.profile?.move_in_date,
        duration: first.values[3] || state.profile?.duration
      }).eq('id', state.user.id);
      if (error) return notify('No se pudo actualizar tu búsqueda');
    } else {
      const second = state.publishDraft.steps[1] || { values: [], selected: [] };
      const finalStep = state.publishDraft.steps[publishTotals[type] - 1] || { values: [] };
      const zone = first.values[0] || '';
      const price = Number(String(first.values[1] || '').replace(/\D/g, ''));
      if (!zone || !price) return notify('Añade al menos la zona y el precio');
      const { data: listing, error } = await db.from('listings').insert({
        owner_id: state.user.id,
        kind: type,
        title: `${type === 'apartment' ? 'Piso' : 'Habitación'} en ${zone}`,
        zone,
        price,
        available_from: first.values[2] || null,
        duration: first.values[3] || null,
        rooms: second.values[0] ? Number(second.values[0]) : null,
        baths: second.values[1] ? Number(second.values[1]) : null,
        area: second.values[2] ? Number(second.values[2]) : null,
        furnished: second.selected.includes('Amueblado'),
        features: second.selected,
        description: finalStep.values[0] || null,
        photos: []
      }).select().single();
      if (error) return notify('No se pudo publicar la vivienda');
      if (state.publishDraft.files?.length) {
        const photos = await uploadListingPhotos(listing.id, state.publishDraft.files);
        if (photos.length) {
          const { error: photoError } = await db.from('listings').update({ photos }).eq('id', listing.id);
          if (photoError) notify('La vivienda se publicó, pero no pudimos vincular todas las fotos');
        }
      }
    }
    const publishedCommunityId =
      type === 'post'
        ? state.communityPublishTarget
        : null;

    hideAllModals();

    notify(
      type === 'post'
        ? 'Publicación creada'
        : type === 'mate'
          ? 'Tu búsqueda está activa'
          : 'Vivienda publicada'
    );

    state.publishDraft = {
      steps: {},
      files: []
    };

    await loadRealContent();
    await loadSavedItems();

    if (publishedCommunityId) {
      state.communityPublishTarget = null;
      await openRealCommunity(
        publishedCommunityId
      );
    }
  }


  async function uploadCommunityPostMedia(
    postId,
    files
  ) {
    const urls = [];

    for (
      const [index, file]
      of files.entries()
    ) {
      const extension =
        (
          file.name.split('.').pop() ||
          'jpg'
        )
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '');

      const storagePath =
        `${state.user.id}/${postId}/${Date.now()}-${index}.${extension}`;

      const { error } =
        await db.storage
          .from('community-post-media')
          .upload(
            storagePath,
            file,
            {
              cacheControl: '3600',
              upsert: false,
              contentType: file.type
            }
          );

      if (error) {
        console.error(
          'Rooms: error subiendo imagen de publicación',
          error
        );
        continue;
      }

      const { data } =
        db.storage
          .from('community-post-media')
          .getPublicUrl(storagePath);

      if (data?.publicUrl) {
        urls.push(data.publicUrl);
      }
    }

    return urls;
  }


  async function uploadListingPhotos(listingId, files) {
    const urls = [];
    for (const [index, file] of files.entries()) {
      const extension = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
      const path = `${state.user.id}/${listingId}/${Date.now()}-${index}.${extension}`;
      const { error } = await db.storage.from('listing-images').upload(path, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type
      });
      if (error) {
        console.error('Rooms: error al subir imagen', error);
        continue;
      }
      const { data } = db.storage.from('listing-images').getPublicUrl(path);
      if (data?.publicUrl) urls.push(data.publicUrl);
    }
    return urls;
  }

  function ensureEditListingModal() {
    let modal = document.querySelector('#editListingModal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'editListingModal';
    modal.setAttribute('aria-hidden', 'true');
    modal.innerHTML = `<div class="backdrop" data-close></div>
      <article class="detail edit-listing-shell">
        <header><div><small>MI ANUNCIO</small><h2>Editar anuncio</h2></div><button type="button" data-close aria-label="Cerrar">×</button></header>
        <form id="editListingForm">
          <input id="editListingId" type="hidden">
          <label>Título<input id="editListingTitle" type="text" maxlength="100" required></label>
          <div class="edit-listing-grid">
            <label>Zona<input id="editListingZone" type="text" maxlength="80" required></label>
            <label>Precio mensual<input id="editListingPrice" type="number" min="1" step="1" required></label>
            <label>Fecha disponible<input id="editListingDate" type="date"></label>
            <label>Duración<input id="editListingDuration" type="text" maxlength="60" placeholder="Ej. Más de 1 año"></label>
            <label>Habitaciones<input id="editListingRooms" type="number" min="0" step="1"></label>
            <label>Baños<input id="editListingBaths" type="number" min="0" step="1"></label>
            <label>Superficie (m²)<input id="editListingArea" type="number" min="0" step="1"></label>
          </div>
          <label>Características<input id="editListingFeatures" type="text" placeholder="Amueblado, Terraza, Mascotas"></label>
          <label>Descripción<textarea id="editListingDescription" rows="5" maxlength="1500"></textarea></label>

          <section class="edit-listing-photo-manager">
            <div class="edit-listing-photo-heading">
              <div>
                <small>FOTOGRAFÍAS</small>
                <h3>Gestiona las fotos del anuncio</h3>
              </div>
              <span>La primera será la portada</span>
            </div>

            <div
              class="edit-listing-photo-grid"
              id="editListingPhotoGrid"
            ></div>

            <label class="edit-listing-add-photos">
              <span>＋ Añadir fotografías</span>
              <small>JPG, PNG, WEBP o HEIC</small>
              <input
                id="editListingPhotos"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic"
                multiple
                hidden
              >
            </label>

            <p
              class="edit-listing-new-photo-count"
              id="editListingNewPhotoCount"
            ></p>
          </section>

          <p class="edit-listing-message" id="editListingMessage" role="status"></p>
          <div class="edit-listing-actions"><button class="delete-listing-button" type="button" data-delete-listing>Eliminar anuncio</button><button class="edit-listing-save" type="submit">Guardar cambios</button></div>
        </form>
      </article>`;
    document.body.appendChild(modal);
    modal.querySelector('#editListingForm').addEventListener('submit', saveListingEdits);
    return modal;
  }


  function renderEditListingPhotos() {
    const grid =
      document.querySelector('#editListingPhotoGrid');

    if (!grid) return;

    const photos =
      state.editListingPhotos || [];

    if (!photos.length) {
      grid.innerHTML = `
        <div class="edit-listing-no-photos">
          <span>⌂</span>
          <b>Este anuncio no tiene fotografías</b>
          <small>Añade una para mejorar el anuncio.</small>
        </div>
      `;
      return;
    }

    grid.innerHTML = `
      <div style="grid-column:1/-1;display:flex;justify-content:space-between;align-items:end;gap:16px;margin-bottom:4px;">
        <div>
          <small style="display:block;font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#7a7a72;margin-bottom:4px;">Fotografías</small>
          <h3 style="margin:0;font-size:22px;line-height:1.05;letter-spacing:-.03em;color:#111;">Reordena, elige portada o elimina</h3>
        </div>
        <p style="margin:0;font-size:13px;font-weight:600;color:#7a7a72;text-align:right;">La primera imagen será la portada del anuncio</p>
      </div>
    ` + photos.map((photo, index) => `
      <article
        class="edit-listing-photo-card"
        draggable="true"
        data-edit-photo-index="${index}"
      >
        <div class="edit-listing-photo-image">
          <img
            src="${escapeHtml(photo)}"
            alt="Foto ${index + 1} del anuncio"
          >

          ${
            index === 0
              ? `<span class="edit-listing-cover-label">
                  PORTADA
                </span>`
              : `<span class="edit-listing-photo-number">
                  ${index + 1}
                </span>`
          }
        </div>

        <div class="edit-listing-photo-actions">
          <button
            type="button"
            data-edit-photo-left="${index}"
            aria-label="Mover foto a la izquierda"
            ${index === 0 ? 'disabled' : ''}
          >
            ←
          </button>

          <button
            type="button"
            data-edit-photo-right="${index}"
            aria-label="Mover foto a la derecha"
            ${index === photos.length - 1 ? 'disabled' : ''}
          >
            →
          </button>

          ${
            index !== 0
              ? `<button
                  type="button"
                  data-edit-photo-cover="${index}"
                >
                  Hacer portada
                </button>`
              : ''
          }

          <button
            type="button"
            class="edit-listing-photo-delete"
            data-edit-photo-delete="${index}"
          >
            Eliminar
          </button>
        </div>
      </article>
    `).join('');
  }

  function moveEditListingPhoto(from, to) {
    const photos =
      [...(state.editListingPhotos || [])];

    if (
      from < 0 ||
      to < 0 ||
      from >= photos.length ||
      to >= photos.length ||
      from === to
    ) return;

    const [photo] = photos.splice(from, 1);
    photos.splice(to, 0, photo);

    state.editListingPhotos = photos;
    renderEditListingPhotos();
  }

  function deleteEditListingPhoto(index) {
    const photos =
      [...(state.editListingPhotos || [])];

    if (index < 0 || index >= photos.length) return;

    photos.splice(index, 1);

    state.editListingPhotos = photos;
    renderEditListingPhotos();
  }

  function makeEditListingPhotoCover(index) {
    const photos =
      [...(state.editListingPhotos || [])];

    if (index <= 0 || index >= photos.length) return;

    const [photo] = photos.splice(index, 1);
    photos.unshift(photo);

    state.editListingPhotos = photos;
    renderEditListingPhotos();
  }

  function openEditListing(listingId) {
    const listing = state.listings.get(listingId);
    if (!listing || listing.owner_id !== state.user.id) return notify('Solo puedes editar tus propios anuncios');
    const modal = ensureEditListingModal();
    modal.querySelector('#editListingId').value = listing.id;
    modal.querySelector('#editListingTitle').value = listing.title || '';
    modal.querySelector('#editListingZone').value = listing.zone || '';
    modal.querySelector('#editListingPrice').value = listing.price || '';
    modal.querySelector('#editListingDate').value = listing.available_from || '';
    modal.querySelector('#editListingDuration').value = listing.duration || '';
    modal.querySelector('#editListingRooms').value = listing.rooms ?? '';
    modal.querySelector('#editListingBaths').value = listing.baths ?? '';
    modal.querySelector('#editListingArea').value = listing.area ?? '';
    modal.querySelector('#editListingFeatures').value = (listing.features || []).join(', ');
    modal.querySelector('#editListingDescription').value = listing.description || '';
    state.editListingOriginalPhotos =
      [...(listing.photos || [])];

    state.editListingPhotos =
      [...(listing.photos || [])];

    modal.querySelector('#editListingPhotos').value = '';
    modal.querySelector('#editListingMessage').textContent = '';

    const newPhotoCount =
      modal.querySelector('#editListingNewPhotoCount');

    if (newPhotoCount) {
      newPhotoCount.textContent = '';
    }

    renderEditListingPhotos();
    showModal(modal);
  }

  async function saveListingEdits(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const listingId = form.querySelector('#editListingId').value;
    const listing = state.listings.get(listingId);
    if (!listing || listing.owner_id !== state.user.id) return;
    const submit = form.querySelector('.edit-listing-save');
    const message = form.querySelector('#editListingMessage');
    const files = [...form.querySelector('#editListingPhotos').files];
    const tooLarge = files.find(file => file.size > 10 * 1024 * 1024);
    if (tooLarge) {
      message.textContent = `${tooLarge.name} supera el límite de 10 MB.`;
      return;
    }
    submit.disabled = true;
    submit.textContent = 'Guardando…';
    message.textContent = '';
    let photos =
      [...(state.editListingPhotos || listing.photos || [])];

    if (files.length) {
      const uploaded =
        await uploadListingPhotos(listingId, files);

      photos = [...photos, ...uploaded];

      if (!uploaded.length) {
        message.textContent =
          'No se pudieron añadir las fotos, pero guardaremos el resto.';
      }
    }
    const numberOrNull = selector => {
      const value = form.querySelector(selector).value;
      return value === '' ? null : Number(value);
    };
    const features = form.querySelector('#editListingFeatures').value.split(',').map(item => item.trim()).filter(Boolean);
    const changes = {
      title: form.querySelector('#editListingTitle').value.trim(),
      zone: form.querySelector('#editListingZone').value.trim(),
      price: numberOrNull('#editListingPrice'),
      available_from: form.querySelector('#editListingDate').value || null,
      duration: form.querySelector('#editListingDuration').value.trim() || null,
      rooms: numberOrNull('#editListingRooms'),
      baths: numberOrNull('#editListingBaths'),
      area: numberOrNull('#editListingArea'),
      features,
      furnished: features.some(item => item.toLowerCase() === 'amueblado'),
      description: form.querySelector('#editListingDescription').value.trim() || null,
      photos
    };
    const { error } = await db.from('listings').update(changes).eq('id', listingId).eq('owner_id', state.user.id);
    submit.disabled = false;
    submit.textContent = 'Guardar cambios';
    if (error) {
      console.error('Rooms: error al editar anuncio', error);
      message.textContent = 'No se pudieron guardar los cambios. Inténtalo de nuevo.';
      return;
    }

    const originalPhotos =
      state.editListingOriginalPhotos || [];

    const removedPhotos =
      originalPhotos.filter(photo => !photos.includes(photo));

    if (removedPhotos.length) {
      const marker =
        '/storage/v1/object/public/listing-images/';

      const storagePaths =
        removedPhotos
          .map(url => {
            const index = url.indexOf(marker);
            if (index === -1) return null;

            return decodeURIComponent(
              url.slice(index + marker.length)
            );
          })
          .filter(Boolean);

      if (storagePaths.length) {
        const { error: storageError } =
          await db.storage
            .from('listing-images')
            .remove(storagePaths);

        if (storageError) {
          console.warn(
            'Rooms: no se pudieron limpiar algunas fotos eliminadas',
            storageError
          );
        }
      }
    }

    const editModal =
      document.querySelector('#editListingModal');

    if (editModal) {
      editModal.classList.remove('open');
      editModal.setAttribute('aria-hidden', 'true');
    }

    document.body.style.overflow = '';

    await loadRealContent();
    await loadSavedItems();

    refreshOwnActivity('listings');

    notify('Anuncio actualizado');
  }

  async function deleteOwnListing(listingId) {
    const listing = state.listings.get(listingId);
    if (!listing || listing.owner_id !== state.user.id) return notify('Solo puedes eliminar tus propios anuncios');
    const confirmed = window.confirm('¿Quieres eliminar este anuncio? Esta acción no se puede deshacer.');
    if (!confirmed) return;
    const button = document.querySelector('#editListingModal [data-delete-listing]');
    const message = document.querySelector('#editListingMessage');
    if (button) {
      button.disabled = true;
      button.textContent = 'Eliminando…';
    }
    if (message) message.textContent = '';
    const { data, error } = await db.from('listings').delete().eq('id', listingId).eq('owner_id', state.user.id).select('id');
    if (error || !data?.length) {
      console.error('Rooms: error al eliminar anuncio', error);
      if (button) {
        button.disabled = false;
        button.textContent = 'Eliminar anuncio';
      }
      if (message) message.textContent = 'No se pudo eliminar el anuncio. Inténtalo de nuevo.';
      return;
    }
    await db.from('saved_items').delete().eq('user_id', state.user.id).eq('item_id', listingId);
    const marker = '/storage/v1/object/public/listing-images/';
    const storagePaths = (listing.photos || []).map(url => {
      const index = String(url).indexOf(marker);
      return index >= 0 ? decodeURIComponent(String(url).slice(index + marker.length)) : null;
    }).filter(Boolean);
    if (storagePaths.length) db.storage.from('listing-images').remove(storagePaths);
    state.currentListingId = null;
    hideAllModals();
    await loadRealContent();
    await loadSavedItems();
    notify('Anuncio eliminado');
  }

  const publishObserver = new MutationObserver(() => preparePublishStep());
  publishObserver.observe(document.querySelector('#publishFlowContent'), { childList: true });

  function applyTargetProfile(profile) {
    const name = profile.alias || profile.name || 'Usuario de Rooms';
    const age = profile.age ? `, ${profile.age}` : '';
    const zone = profile.zones?.[0] || 'Madrid';
    const seeking = labelSeeking(profile.seeking?.[0]);
    const moveDate = profile.move_in_date
      ? new Intl.DateTimeFormat('es-ES', { month: 'long' }).format(new Date(`${profile.move_in_date}T00:00:00`))
      : 'Próximamente';

    document.querySelectorAll('[data-user-card]').forEach(card => {
      card.dataset.userId = profile.id;
      const title = card.querySelector('h2');
      const search = card.querySelector('.person-searching');
      if (title) title.textContent = `${name}${age}`;
      if (search) search.textContent = `${seeking} · ${zone} · ${moveDate}`;
      const image = card.querySelector('img');
      if (image && profile.avatar_url) image.src = profile.avatar_url;
    });

    const modal = document.querySelector('#userProfileModal');
    if (modal) {
      modal.dataset.userId = profile.id;
      const title = modal.querySelector('.profile-title h2');
      const bio = modal.querySelector('.profile-title p');
      const looking = modal.querySelectorAll('.profile-looking b');
      if (title) title.textContent = `${name}${age}`;
      if (bio && profile.bio) bio.textContent = profile.bio;
      if (looking[0]) looking[0].textContent = seeking;
      if (looking[1]) looking[1].textContent = zone;
      if (looking[2]) looking[2].textContent = formatBudget(profile);
      const image = modal.querySelector('.profile-hero img');
      if (image && profile.avatar_url) image.src = profile.avatar_url;
    }
  }

  function labelSeeking(value) {
    return ({ room: 'Busca habitación', home: 'Busca piso', mates: 'Busca compañeros' })[value] || 'Busca vivienda';
  }

  function formatBudget(profile) {
    if (!profile.budget_min && !profile.budget_max) return 'Por definir';
    if (!profile.budget_max) return `Desde ${profile.budget_min || 0} €`;
    return `${profile.budget_min || 0}–${profile.budget_max} €`;
  }

  function getConnectionForUser(userId) {
    if (!userId) return null;

    return (
      state.connectionsByUser?.get(String(userId)) ||
      null
    );
  }

  function connectionButtonLabel(userId) {
    const connection =
      getConnectionForUser(userId);

    if (!connection) {
      return 'Conectar';
    }

    if (connection.status === 'accepted') {
      return 'Enviar mensaje';
    }

    if (connection.status === 'declined') {
      return 'Conectar';
    }

    if (
      connection.status === 'pending' &&
      connection.requester_id === state.user.id
    ) {
      return 'Cancelar solicitud';
    }

    if (
      connection.status === 'pending' &&
      connection.recipient_id === state.user.id
    ) {
      return 'Responder solicitud';
    }

    return 'Conectar';
  }

  async function loadAllConnections() {
    if (!state.user) return;

    const { data, error } = await db
      .from('connections')
      .select('*')
      .or(
        `requester_id.eq.${state.user.id},recipient_id.eq.${state.user.id}`
      );

    if (error) {
      console.error(
        'Rooms: error cargando conexiones',
        error
      );
      return;
    }

    state.connectionsByUser = new Map();

    (data || []).forEach(connection => {
      const otherUserId =
        connection.requester_id === state.user.id
          ? connection.recipient_id
          : connection.requester_id;

      state.connectionsByUser.set(
        String(otherUserId),
        connection
      );
    });

    if (state.targetProfile) {
      state.connection =
        getConnectionForUser(
          state.targetProfile.id
        );
    } else {
      state.connection = null;
    }

    updateConnectButtons();
  }

  async function loadConnection(
    userId = state.targetProfile?.id
  ) {
    if (!userId || !state.user) {
      return null;
    }

    const { data, error } = await db
      .from('connections')
      .select('*')
      .or(
        `and(requester_id.eq.${state.user.id},recipient_id.eq.${userId}),and(requester_id.eq.${userId},recipient_id.eq.${state.user.id})`
      )
      .order('created_at', {
        ascending: false
      })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error(
        'Rooms: error cargando conexión',
        error
      );
      return null;
    }

    if (data) {
      state.connectionsByUser.set(
        String(userId),
        data
      );
    } else {
      state.connectionsByUser.delete(
        String(userId)
      );
    }

    if (
      state.targetProfile?.id === userId
    ) {
      state.connection = data || null;
    }

    updateConnectButtons();

    return data || null;
  }

  function updateConnectButtons() {
    document
      .querySelectorAll('[data-connect]')
      .forEach(button => {
        const userId =
          button.dataset.userId ||
          state.targetProfile?.id;

        if (!userId) {
          button.textContent = 'Conectar';
          return;
        }

        if (
          state.blockedUsers?.has(userId)
        ) {
          button.textContent = 'Bloqueado';
          button.disabled = true;
          button.classList.add(
            'connection-blocked'
          );
          return;
        }

        button.disabled = false;
        button.classList.remove(
          'connection-blocked'
        );

        const connection =
          getConnectionForUser(userId);

        button.textContent =
          connectionButtonLabel(userId);

        button.classList.toggle(
          'connection-pending',
          connection?.status === 'pending' &&
          connection.requester_id === state.user.id
        );

        button.classList.toggle(
          'connection-accepted',
          connection?.status === 'accepted'
        );

        button.classList.toggle(
          'connection-incoming',
          connection?.status === 'pending' &&
          connection.recipient_id === state.user.id
        );
      });
  }

  async function handleConnect(userId) {
    if (!userId || !state.user) return;

    if (
      state.blockedUsers?.has(userId)
    ) {
      notify(
        'Desbloquea a este usuario para poder conectar.'
      );
      return;
    }

    const profile =
      state.profiles.get(userId) ||
      (
        state.targetProfile?.id === userId
          ? state.targetProfile
          : null
      );

    if (!profile) {
      notify('No encuentro este perfil');
      return;
    }

    let connection =
      getConnectionForUser(userId);

    if (!connection) {
      connection =
        await loadConnection(userId);
    }


    // =====================================================
    // CONEXIÓN YA ACEPTADA → ABRIR CONVERSACIÓN
    // =====================================================

    if (
      connection?.status === 'accepted'
    ) {
      openRealConversation(profile);
      return;
    }


    // =====================================================
    // SOLICITUD ENVIADA POR MÍ → CANCELAR
    // =====================================================

    if (
      connection?.status === 'pending' &&
      connection.requester_id === state.user.id
    ) {
      const {
        data: deletedRows,
        error
      } = await db
        .from('connections')
        .delete()
        .eq('id', connection.id)
        .select('id');

      if (error) {
        console.error(
          'Rooms: error cancelando solicitud',
          error
        );

        notify(
          'No se pudo cancelar la solicitud'
        );
        return;
      }

      if (!deletedRows?.length) {
        console.error(
          'Rooms: la solicitud no se eliminó',
          {
            connectionId: connection.id,
            userId,
            connection
          }
        );

        await loadConnection(userId);

        notify(
          'No se pudo cancelar la solicitud'
        );
        return;
      }

      state.connectionsByUser.delete(
        String(userId)
      );

      if (
        state.targetProfile?.id === userId
      ) {
        state.connection = null;
      }

      updateConnectButtons();

      document
        .querySelectorAll(
          `[data-connect][data-user-id="${userId}"]`
        )
        .forEach(button => {
          button.textContent =
            connectionButtonLabel(userId);
        });

      notify(
        'Solicitud cancelada'
      );

      return;
    }


    // =====================================================
    // SOLICITUD RECIBIDA
    // =====================================================

    if (
      connection?.status === 'pending' &&
      connection.recipient_id === state.user.id
    ) {
      await openIncomingConnectionRequest(
        userId
      );

      return;
    }


    // =====================================================
    // SOLICITUD RECHAZADA ANTERIORMENTE → REABRIR
    // =====================================================

    if (
      connection?.status === 'declined'
    ) {
      const {
        data,
        error
      } = await db
        .from('connections')
        .update({
          requester_id: state.user.id,
          recipient_id: userId,
          status: 'pending'
        })
        .eq('id', connection.id)
        .select()
        .single();

      if (error) {
        console.error(
          'Rooms: error reabriendo conexión',
          error
        );

        notify(
          'No se pudo enviar la solicitud'
        );
        return;
      }

      state.connectionsByUser.set(
        String(userId),
        data
      );

      if (
        state.targetProfile?.id === userId
      ) {
        state.connection = data;
      }

      updateConnectButtons();

      notify(
        'Solicitud de conexión enviada'
      );

      return;
    }


    // =====================================================
    // SIN RELACIÓN → CREAR SOLICITUD
    // =====================================================

    const {
      data,
      error
    } = await db
      .from('connections')
      .insert({
        requester_id: state.user.id,
        recipient_id: userId,
        status: 'pending'
      })
      .select()
      .single();

    if (error) {
      console.error(
        'Rooms: error enviando conexión',
        error
      );

      notify(
        'No se pudo enviar la solicitud'
      );
      return;
    }

    state.connectionsByUser.set(
      String(userId),
      data
    );

    if (
      state.targetProfile?.id === userId
    ) {
      state.connection = data;
    }

    updateConnectButtons();

    document
      .querySelectorAll(
        `[data-connect][data-user-id="${userId}"]`
      )
      .forEach(button => {
        button.textContent =
          connectionButtonLabel(userId);
      });

    notify(
      'Solicitud de conexión enviada'
    );
  }

  async function connectToUser(userId) {
    if (!userId) return;

    if (
      state.blockedUsers?.has(userId)
    ) {
      notify(
        'Desbloquea a este usuario para poder conectar.'
      );
      return;
    }

    const profile =
      state.profiles.get(userId);

    if (!profile) {
      notify('No encuentro este perfil');
      return;
    }

    await loadConnection(userId);
    await handleConnect(userId);
  }

  async function loadIncomingConnections() {
    if (!state.user) return;

    const { data, error } = await db
      .from('connections')
      .select('*')
      .eq('recipient_id', state.user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      console.error(
        'Rooms: error cargando solicitudes recibidas',
        error
      );
      return;
    }

    state.incomingRequests =
      new Map();

    (data || []).forEach(request => {
      if (
        state.blockedUsers?.has(
          request.requester_id
        )
      ) {
        return;
      }

      state.incomingRequests.set(
        request.id,
        { request }
      );

      state.connectionsByUser.set(
        String(request.requester_id),
        request
      );
    });

    updateConnectButtons();
  }


  function ensureConnectionResponseModal() {
    let modal =
      document.querySelector('#connectionResponseModal');

    if (modal) return modal;

    modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'connectionResponseModal';
    modal.setAttribute('aria-hidden', 'true');

    modal.innerHTML = `
      <div
        class="backdrop"
        data-close-connection-response
      ></div>

      <article class="connection-response-shell">

        <button
          type="button"
          class="connection-response-close"
          data-close-connection-response
          aria-label="Cerrar"
        >
          ×
        </button>

        <div id="connectionResponseContent"></div>

      </article>
    `;

    document.body.appendChild(modal);

    return modal;
  }


  async function openIncomingConnectionRequest(userId) {
    if (!userId || !state.user) return;

    let connection =
      getConnectionForUser(userId);

    if (!connection) {
      connection =
        await loadConnection(userId);
    }

    if (
      !connection ||
      connection.status !== 'pending' ||
      connection.recipient_id !== state.user.id
    ) {
      notify(
        'Esta solicitud ya no está pendiente'
      );

      await loadAllConnections();
      return;
    }

    const profile =
      state.profiles.get(userId);

    if (!profile) {
      notify(
        'No encuentro el perfil de esta persona'
      );
      return;
    }

    const modal =
      ensureConnectionResponseModal();

    const content =
      modal.querySelector(
        '#connectionResponseContent'
      );

    const name =
      profile.alias ||
      profile.name ||
      'Usuario de Rooms';

    const zone =
      profile.zones?.length
        ? profile.zones.join(' · ')
        : 'Madrid';

    const seeking =
      profile.seeking?.length
        ? profile.seeking
            .map(labelSeeking)
            .join(' · ')
        : 'Busca vivienda';

    content.innerHTML = `
      <section class="connection-response-profile">

        <div class="connection-response-avatar">
          ${
            profile.avatar_url
              ? `
                <img
                  src="${escapeHtml(profile.avatar_url)}"
                  alt="${escapeHtml(name)}"
                >
              `
              : `
                <span>
                  ${escapeHtml(initials(name))}
                </span>
              `
          }
        </div>

        <div class="connection-response-copy">

          <small>SOLICITUD DE CONEXIÓN</small>

          <h2>
            ${escapeHtml(name)}
            ${profile.age ? `, ${profile.age}` : ''}
          </h2>

          <p class="connection-response-meta">
            ${escapeHtml(seeking)}
            ·
            ${escapeHtml(zone)}
          </p>

          <p class="connection-response-bio">
            ${escapeHtml(
              profile.bio ||
              'Quiere conectar contigo en Rooms.'
            )}
          </p>

        </div>

      </section>


      <div class="connection-response-question">
        <small>CONEXIÓN</small>

        <h3>
          ${escapeHtml(name)} quiere conectar contigo
        </h3>

        <p>
          Si aceptas, podréis escribiros directamente
          en Rooms.
        </p>
      </div>


      <div class="connection-response-actions">

        <button
          type="button"
          class="connection-response-accept"
          data-connection-answer="accepted"
          data-connection-id="${connection.id}"
          data-connection-user="${profile.id}"
        >
          Aceptar
        </button>

        <button
          type="button"
          class="connection-response-decline"
          data-connection-answer="declined"
          data-connection-id="${connection.id}"
          data-connection-user="${profile.id}"
        >
          Ahora no
        </button>

      </div>
    `;

    showModal(modal);
  }


  async function answerIncomingConnection(
    connectionId,
    userId,
    status
  ) {
    if (
      !connectionId ||
      !userId ||
      !['accepted', 'declined'].includes(status)
    ) {
      return;
    }

    const { data, error } = await db
      .from('connections')
      .update({
        status
      })
      .eq('id', connectionId)
      .eq('recipient_id', state.user.id)
      .eq('status', 'pending')
      .select()
      .single();

    if (error || !data) {
      console.error(
        'Rooms: error respondiendo solicitud',
        error
      );

      notify(
        'No se pudo responder la solicitud'
      );
      return;
    }

    state.connectionsByUser.set(
      String(userId),
      data
    );

    state.incomingRequests?.delete(
      connectionId
    );

    if (
      state.targetProfile?.id === userId
    ) {
      state.connection = data;
    }

    updateConnectButtons();

    const modal =
      document.querySelector(
        '#connectionResponseModal'
      );

    if (modal) {
      modal.classList.remove('open');
      modal.setAttribute('aria-hidden', 'true');
    }

    document.body.style.overflow = '';

    await Promise.all([
      loadRealNotifications(),
      loadRealInbox()
    ]);

    notify(
      status === 'accepted'
        ? 'Conexión aceptada'
        : 'Solicitud rechazada'
    );
  }


  document.addEventListener('click', event => {
    const close =
      event.target.closest(
        '[data-close-connection-response]'
      );

    if (close) {
      const modal =
        document.querySelector(
          '#connectionResponseModal'
        );

      if (modal) {
        modal.classList.remove('open');
        modal.setAttribute(
          'aria-hidden',
          'true'
        );
      }

      document.body.style.overflow = '';
      return;
    }


    const answer =
      event.target.closest(
        '[data-connection-answer]'
      );

    if (!answer) return;

    event.preventDefault();
    event.stopPropagation();

    const status =
      answer.dataset.connectionAnswer;

    const connectionId =
      answer.dataset.connectionId;

    const userId =
      answer.dataset.connectionUser;

    answer.disabled = true;

    answerIncomingConnection(
      connectionId,
      userId,
      status
    ).finally(() => {
      answer.disabled = false;
    });
  });



  function showLiveStatus() {
    if (document.querySelector('.rooms-live-status')) return;
    const status = document.createElement('span');
    status.className = 'rooms-live-status';
    status.textContent = 'Datos guardados en Rooms';
    document.body.appendChild(status);
    setTimeout(() => status.remove(), 3500);
  }

  function collectPressed(selector, attribute) {
    return [...document.querySelectorAll(`${selector}[aria-pressed="true"]`)].map(item => item.dataset[attribute]);
  }

  function collectOnboarding() {
    const duration = document.querySelector('[data-duration][aria-pressed="true"]');
    const privacy = document.querySelector('[data-privacy-level][aria-checked="true"]');
    const controls = [...document.querySelectorAll('[data-privacy-control]')].reduce((result, item) => {
      result[item.dataset.privacyControl] = item.getAttribute('aria-checked') === 'true';
      return result;
    }, {});
    return {
      seeking: collectPressed('[data-search-type]', 'searchType'),
      zones: collectPressed('[data-area]', 'area'),
      budget: {
        min: Number(document.querySelector('#onboardingBudgetMin')?.value || 0),
        max: Number(document.querySelector('#onboardingBudgetMax')?.value || 0),
        over4000: document.querySelector('#budgetOver4000')?.getAttribute('aria-pressed') === 'true'
      },
      move: {
        date: document.querySelector('#onboardingMoveDate')?.value || null,
        flexible: document.querySelector('#flexibleDate')?.getAttribute('aria-pressed') === 'true',
        duration: duration?.dataset.duration || null
      },
      homeFeatures: collectPressed('[data-home-feature]', 'homeFeature'),
      living: state.living,
      social: {
        interests: collectPressed('[data-interest]', 'interest'),
        traits: collectPressed('[data-self-description]', 'selfDescription')
      },
      privacy: { level: privacy?.dataset.privacyLevel || 'balanced', controls }
    };
  }

  async function saveOnboarding() {
    if (!state.user) return;
    const answers = collectOnboarding();
    const name = document.querySelector('#profileName')?.value.trim() || state.profile?.name || '';
    const bio = document.querySelector('#profileBio')?.value.trim() || '';
    const max = answers.budget.over4000 ? null : answers.budget.max;

    const [profileResult, preferencesResult] = await Promise.all([
      db.from('profiles').update({
        name,
        alias: name,
        bio,
        seeking: answers.seeking,
        zones: answers.zones,
        budget_min: answers.budget.min || null,
        budget_max: max,
        move_in_date: answers.move.date,
        duration: answers.move.duration,
        interests: answers.social.interests,
        traits: answers.social.traits,
        onboarding_completed: true
      }).eq('id', state.user.id).select().single(),
      db.from('onboarding_preferences').upsert({ user_id: state.user.id, answers })
    ]);

    if (profileResult.error || preferencesResult.error) {
      notify('No se pudieron guardar todas tus preferencias');
      return;
    }
    state.profile = profileResult.data;
    state.preferences = { answers };
    updateOwnProfile(state.profile, state.preferences);
    notify('Tu perfil y preferencias se han guardado');
    await loadOtherProfile();
  }

  function savedDescriptor(target) {
    if (target.dataset.saveId && target.dataset.saveKind) {
      return { item_type: target.dataset.saveKind, item_id: target.dataset.saveId };
    }
    const propertyCard = target.closest('[data-listing-id]');
    if (propertyCard) {
      const id = propertyCard.dataset.listingId;
      const listing = window.listings?.find?.(item => String(item.id) === String(id));
      return { item_type: listing?.kind === 'Piso entero' ? 'apartment' : 'room', item_id: `listing-${id}` };
    }
    if (target.matches('[data-detail-save]') && state.currentListingId) {
      return { item_type: 'room', item_id: `listing-${state.currentListingId}` };
    }
    if (target.closest('[data-person-save]') && state.targetProfile) {
      return { item_type: 'person', item_id: state.targetProfile.id };
    }
    return null;
  }

  async function persistSavedItem(target) {
    const item = savedDescriptor(target);
    if (!item || !state.user) return;

    if (
      item.item_type === 'person' &&
      state.blockedUsers?.has(item.item_id)
    ) {
      notify(
        'No puedes guardar a un usuario bloqueado.'
      );
      return;
    }

    const wasSaved = target.classList.contains('saved');
    let result;

    if (wasSaved) {
      result = await db
        .from('saved_items')
        .delete()
        .match({ user_id: state.user.id, ...item });
    } else {
      result = await db
        .from('saved_items')
        .upsert(
          { user_id: state.user.id, ...item },
          { onConflict: 'user_id,item_type,item_id' }
        );
    }

    if (result.error) {
      console.error('Rooms: error guardando elemento', result.error, item);
      notify('No se pudo actualizar Guardados');
      return;
    }

    await loadSavedItems();

    if (
      item.item_type === 'post' &&
      state.activeCommunity
    ) {
      renderRealCommunityDetail();
    }
  }

  async function fetchProfiles(ids) {
    const unique = [...new Set(ids.filter(Boolean))];
    if (!unique.length) return new Map();

    const { data, error } = await db.rpc(
      'get_visible_profiles',
      { _target_user_id: null }
    );

    if (error) {
      console.error('Rooms: error cargando perfiles seguros', error);
      return new Map();
    }

    const wanted = new Set(unique);
    const result = new Map();

    (data || [])
      .filter(profile => wanted.has(profile.id))
      .forEach(profile => {
        result.set(profile.id, profile);
        state.profiles.set(profile.id, profile);
      });

    return result;
  }

  function openRealReport(target) {
    if (!target || !state.user) return;

    state.reportTarget = {
      type: target.dataset.reportType || 'user',
      id: target.dataset.reportId || null,
      userId: target.dataset.reportUser || null
    };

    const modal = document.querySelector('#reportModal');
    const label = document.querySelector('#reportTarget');
    const details = document.querySelector('#reportDetails');
    const submit = document.querySelector('#submitReport');

    if (!modal) return;

    document
      .querySelectorAll('#reportModal .report-reasons button')
      .forEach(button => {
        button.setAttribute('aria-checked', 'false');
      });

    if (details) details.value = '';
    if (submit) submit.disabled = true;

    const labels = {
      profile: 'Este perfil',
      listing: 'Este anuncio',
      post: 'Esta publicación',
      community: 'Esta comunidad',
      message: 'Este mensaje',
      user: 'Este usuario'
    };

    if (label) {
      label.textContent =
        `Sobre: ${labels[state.reportTarget.type] || 'Este contenido'}`;
    }

    showModal(modal);
  }


  async function submitRealReport() {
    if (!state.user || !state.reportTarget) return;

    const modal = document.querySelector('#reportModal');

    const selected =
      modal?.querySelector(
        '.report-reasons button[aria-checked="true"]'
      );

    const details =
      document.querySelector('#reportDetails')?.value.trim() || null;

    const submit =
      document.querySelector('#submitReport');

    if (!selected) {
      notify('Selecciona un motivo para continuar.');
      return;
    }

    if (submit) {
      submit.disabled = true;
      submit.textContent = 'Enviando…';
    }

    const payload = {
      reporter_id: state.user.id,
      reported_user_id:
        state.reportTarget.userId || null,
      target_type:
        state.reportTarget.type,
      target_id:
        state.reportTarget.id || null,
      reason:
        selected.textContent.trim(),
      details,
      status: 'pending'
    };

    const { error } =
      await db
        .from('reports')
        .insert(payload);

    if (submit) {
      submit.textContent = 'Enviar reporte';
    }

    if (error) {
      console.error('Error creando reporte:', error);

      if (submit) {
        submit.disabled = false;
      }

      notify(
        'No hemos podido enviar el reporte. Inténtalo de nuevo.'
      );

      return;
    }

    state.reportTarget = null;

    hideAllModals();

    notify(
      'Reporte enviado. Gracias por ayudarnos a cuidar Rooms.'
    );
  }


  async function showMyRealReports() {
    if (!state.user) return;

    const { data, error } =
      await db
        .from('reports')
        .select('id,status,reason,target_type,created_at')
        .eq('reporter_id', state.user.id)
        .order('created_at', { ascending: false });

    if (error) {
      console.error('Error cargando reportes:', error);
      notify('No hemos podido cargar tus reportes.');
      return;
    }

    const reports = data || [];

    if (!reports.length) {
      notify('No tienes reportes activos.');
      return;
    }

    const pending =
      reports.filter(item =>
        item.status === 'pending' ||
        item.status === 'reviewing'
      ).length;

    notify(
      pending
        ? `${pending} ${pending === 1 ? 'reporte activo' : 'reportes activos'}`
        : `${reports.length} ${reports.length === 1 ? 'reporte enviado' : 'reportes enviados'}`
    );
  }


  async function loadConversationPreferences() {
    if (!state.user) return;

    const { data, error } =
      await db
        .from('conversation_preferences')
        .select(
          'other_user_id,muted,deleted_before,updated_at'
        )
        .eq('user_id', state.user.id);

    if (error) {
      console.error(
        'Rooms: error cargando preferencias de conversación',
        error
      );

      state.conversationPreferences =
        new Map();

      return;
    }

    state.conversationPreferences =
      new Map(
        (data || []).map(item => [
          String(item.other_user_id),
          item
        ])
      );
  }


  function getConversationPreference(userId) {
    return (
      state.conversationPreferences?.get(
        String(userId)
      ) || {
        other_user_id: userId,
        muted: false,
        deleted_before: null
      }
    );
  }


  async function saveConversationPreference(
    userId,
    changes
  ) {
    if (
      !state.user ||
      !userId ||
      userId === state.user.id
    ) {
      return null;
    }

    const current =
      getConversationPreference(userId);

    const payload = {
      user_id: state.user.id,
      other_user_id: userId,
      muted:
        changes.muted ??
        current.muted ??
        false,
      deleted_before:
        changes.deleted_before !== undefined
          ? changes.deleted_before
          : current.deleted_before ?? null,
      updated_at:
        new Date().toISOString()
    };

    const { data, error } =
      await db
        .from('conversation_preferences')
        .upsert(
          payload,
          {
            onConflict:
              'user_id,other_user_id'
          }
        )
        .select(
          'other_user_id,muted,deleted_before,updated_at'
        )
        .single();

    if (error) {
      console.error(
        'Rooms: error guardando preferencias de conversación',
        error
      );

      return null;
    }

    state.conversationPreferences.set(
      String(userId),
      data
    );

    return data;
  }


  async function loadUserBlocks() {
    if (!state.user) return;

    const { data, error } =
      await db
        .from('user_blocks')
        .select('blocked_id')
        .eq('blocker_id', state.user.id);

    if (error) {
      console.error('Rooms: error cargando bloqueos', error);
      state.blockedUsers = new Set();
      return;
    }

    state.blockedUsers =
      new Set(
        (data || []).map(item => item.blocked_id)
      );

    updateBlockedUsersCount();
  }


  function updateBlockedUsersCount() {
    const count =
      state.blockedUsers?.size || 0;

    const label =
      document.querySelector(
        '#blockedUsersCount'
      );

    if (!label) return;

    label.textContent =
      `${count} ${
        count === 1
          ? 'persona'
          : 'personas'
      }`;
  }


  function ensureBlockedUsersModal() {
    let modal =
      document.querySelector(
        '#blockedUsersModal'
      );

    if (modal) return modal;

    modal =
      document.createElement('div');

    modal.className = 'modal';
    modal.id = 'blockedUsersModal';
    modal.setAttribute(
      'aria-hidden',
      'true'
    );

    modal.innerHTML = `
      <div
        class="backdrop"
        data-close-blocked-users
      ></div>

      <article class="blocked-users-shell">

        <button
          type="button"
          class="blocked-users-close"
          data-close-blocked-users
          aria-label="Cerrar"
        >
          ×
        </button>

        <header class="blocked-users-header">
          <small>SEGURIDAD</small>
          <h2>Usuarios bloqueados</h2>
          <p>
            Estas personas no pueden conectar
            ni enviarte mensajes mientras estén
            bloqueadas.
          </p>
        </header>

        <div
          id="blockedUsersList"
          class="blocked-users-list"
        ></div>

      </article>
    `;

    document.body.appendChild(modal);

    return modal;
  }


  async function openBlockedUsersManager() {
    if (!state.user) return;

    const modal =
      ensureBlockedUsersModal();

    const list =
      modal.querySelector(
        '#blockedUsersList'
      );

    list.innerHTML = `
      <div class="blocked-users-loading">
        Cargando...
      </div>
    `;

    showModal(modal);

    const { data, error } =
      await db.rpc(
        'get_blocked_profiles'
      );

    if (error) {
      console.error(
        'Rooms: error cargando usuarios bloqueados',
        error
      );

      list.innerHTML = `
        <div class="real-empty-state">
          <b>No hemos podido cargar esta lista</b>
          <p>Inténtalo de nuevo.</p>
        </div>
      `;

      return;
    }

    const users = data || [];

    if (!users.length) {
      list.innerHTML = `
        <div class="real-empty-state">
          <b>No tienes usuarios bloqueados</b>
          <p>
            Las personas que bloquees
            aparecerán aquí.
          </p>
        </div>
      `;

      return;
    }

    list.innerHTML =
      users.map(user => {
        const name =
          user.alias ||
          user.name ||
          'Usuario de Rooms';

        return `
          <article class="blocked-user-row">

            <div class="blocked-user-avatar">
              ${
                user.avatar_url
                  ? `
                    <img
                      src="${escapeHtml(user.avatar_url)}"
                      alt="${escapeHtml(name)}"
                    >
                  `
                  : `
                    <span>
                      ${escapeHtml(initials(name))}
                    </span>
                  `
              }
            </div>

            <div class="blocked-user-info">
              <b>${escapeHtml(name)}</b>
              <small>Usuario bloqueado</small>
            </div>

            <button
              type="button"
              class="blocked-user-unblock"
              data-unblock-user="${user.id}"
              data-unblock-name="${escapeHtml(name)}"
            >
              Desbloquear
            </button>

          </article>
        `;
      }).join('');
  }


  function openRealBlock(target) {
    if (!state.user || !target) return;

    const userId =
      target.dataset.realBlockUser;

    const name =
      target.dataset.realBlockName ||
      'este usuario';

    if (!userId || userId === state.user.id) return;

    /*
     * Si ya está bloqueado, desbloqueamos directamente
     * desde la misma acción.
     */
    if (state.blockedUsers?.has(userId)) {
      unblockRealUser(userId, name);
      return;
    }

    state.blockTarget = {
      id: userId,
      name
    };

    const modal =
      document.querySelector('#blockModal');

    if (!modal) return;

    const title =
      modal.querySelector('h2');

    if (title) {
      title.textContent =
        `¿Bloquear a ${name}?`;
    }

    showModal(modal);
  }


  async function removeConnectionWithUser(userId) {
    if (!state.user || !userId) {
      return { ok: false };
    }

    const { error } =
      await db
        .from('connections')
        .delete()
        .or(
          `and(requester_id.eq.${state.user.id},recipient_id.eq.${userId}),and(requester_id.eq.${userId},recipient_id.eq.${state.user.id})`
        );

    if (error) {
      console.error(
        'Rooms: error eliminando conexión al bloquear',
        error
      );

      return {
        ok: false,
        error
      };
    }

    state.connectionsByUser.delete(
      String(userId)
    );

    if (
      state.targetProfile?.id === userId
    ) {
      state.connection = null;
    }

    for (
      const [requestId, entry]
      of state.incomingRequests
    ) {
      const requesterId =
        entry?.request?.requester_id;

      if (requesterId === userId) {
        state.incomingRequests.delete(
          requestId
        );
      }
    }

    updateConnectButtons();

    return {
      ok: true
    };
  }


  async function removeBlockedUserFromSavedAndGroups(userId) {
    if (!state.user || !userId) {
      return { ok: false };
    }

    const [
      savedResult,
      groupResult
    ] = await Promise.all([
      db
        .from('saved_items')
        .delete()
        .match({
          user_id: state.user.id,
          item_type: 'person',
          item_id: userId
        }),

      db
        .from('household_person_candidates')
        .delete()
        .eq('user_id', userId)
        .eq('added_by', state.user.id)
    ]);

    if (savedResult.error) {
      console.error(
        'Rooms: error eliminando perfil bloqueado de Guardados',
        savedResult.error
      );

      return {
        ok: false,
        error: savedResult.error
      };
    }

    if (groupResult.error) {
      console.error(
        'Rooms: error eliminando perfil bloqueado de grupos',
        groupResult.error
      );

      return {
        ok: false,
        error: groupResult.error
      };
    }

    state.savedItems?.delete(
      `person:${userId}`
    );

    await loadSavedItems();

    if (state.household) {
      await loadHouseholdCandidates();
    }

    return {
      ok: true
    };
  }


  async function confirmRealBlock() {
    if (!state.user || !state.blockTarget?.id) return;

    const target =
      state.blockTarget;

    const button =
      document.querySelector('#confirmBlock');

    if (button) {
      button.disabled = true;
      button.textContent = 'Bloqueando…';
    }

    const { error } =
      await db
        .from('user_blocks')
        .insert({
          blocker_id: state.user.id,
          blocked_id: target.id
        });

    if (button) {
      button.disabled = false;
      button.textContent = 'Bloquear usuario';
    }

    if (error) {
      console.error(
        'Rooms: error bloqueando usuario',
        error
      );

      notify(
        'No hemos podido bloquear al usuario.'
      );

      return;
    }

    const connectionResult =
      await removeConnectionWithUser(
        target.id
      );

    if (!connectionResult.ok) {
      /*
       * Si no podemos cortar la relación existente,
       * revertimos el bloqueo para no dejar un estado
       * inconsistente.
       */
      await db
        .from('user_blocks')
        .delete()
        .eq('blocker_id', state.user.id)
        .eq('blocked_id', target.id);

      if (button) {
        button.disabled = false;
      }

      notify(
        'No hemos podido completar el bloqueo.'
      );

      return;
    }

    const cleanupResult =
      await removeBlockedUserFromSavedAndGroups(
        target.id
      );

    if (!cleanupResult.ok) {
      await db
        .from('user_blocks')
        .delete()
        .eq('blocker_id', state.user.id)
        .eq('blocked_id', target.id);

      notify(
        'No hemos podido completar el bloqueo.'
      );

      return;
    }

    state.blockedUsers.add(target.id);
    state.blockTarget = null;

    updateConnectButtons();

    await loadRealInbox();
    await loadRealNotifications();

    hideAllModals();

    notify(
      'Usuario bloqueado.'
    );
  }


  async function unblockRealUser(userId, name) {
    if (!state.user || !userId) return;

    const confirmed =
      window.confirm(
        `¿Desbloquear a ${name || 'este usuario'}?`
      );

    if (!confirmed) return;

    const { error } =
      await db
        .from('user_blocks')
        .delete()
        .eq('blocker_id', state.user.id)
        .eq('blocked_id', userId);

    if (error) {
      console.error(
        'Rooms: error desbloqueando usuario',
        error
      );

      notify(
        'No hemos podido desbloquear al usuario.'
      );

      return;
    }

    state.blockedUsers.delete(userId);

    updateBlockedUsersCount();

    if (
      document.querySelector(
        '#blockedUsersModal'
      )?.getAttribute('aria-hidden') === 'false'
    ) {
      await openBlockedUsersManager();
    }

    notify(
      'Usuario desbloqueado.'
    );

    if (
      state.targetProfile?.id === userId
    ) {
      openRealUser(state.targetProfile);
    }
  }


  async function toggleConversationMute() {
    if (
      !state.user ||
      !state.chatTarget
    ) {
      return;
    }

    const userId =
      state.chatTarget.id;

    const current =
      getConversationPreference(
        userId
      );

    const nextMuted =
      !Boolean(current.muted);

    const saved =
      await saveConversationPreference(
        userId,
        {
          muted: nextMuted
        }
      );

    if (!saved) {
      notify(
        'No hemos podido actualizar las notificaciones.'
      );
      return;
    }

    await loadRealNotifications();

    renderConversationOptionsMenu();

    notify(
      nextMuted
        ? 'Conversación silenciada.'
        : 'Notificaciones activadas.'
    );
  }


  async function deleteConversationForMe() {
    if (
      !state.user ||
      !state.chatTarget
    ) {
      return;
    }

    const name =
      state.chatTarget.alias ||
      state.chatTarget.name ||
      'esta persona';

    const confirmed =
      window.confirm(
        `¿Eliminar la conversación con ${name}? Desaparecerá para ti. Si recibes un mensaje nuevo, volverá a aparecer.`
      );

    if (!confirmed) return;

    const deletedBefore =
      new Date().toISOString();

    const saved =
      await saveConversationPreference(
        state.chatTarget.id,
        {
          deleted_before:
            deletedBefore
        }
      );

    if (!saved) {
      notify(
        'No hemos podido eliminar la conversación.'
      );
      return;
    }

    /*
     * Los mensajes anteriores ya no deben seguir
     * apareciendo como pendientes para este usuario.
     */
    const { error: readError } =
      await db
        .from('messages')
        .update({
          read_at:
            new Date().toISOString()
        })
        .eq(
          'sender_id',
          state.chatTarget.id
        )
        .eq(
          'recipient_id',
          state.user.id
        )
        .is(
          'read_at',
          null
        )
        .lte(
          'created_at',
          deletedBefore
        );

    if (readError) {
      console.error(
        'Rooms: error cerrando notificaciones de conversación eliminada',
        readError
      );
    }

    const modal =
      document.querySelector(
        '#conversationModal'
      );

    if (modal) {
      modal.classList.remove('open');
      modal.setAttribute(
        'aria-hidden',
        'true'
      );
    }

    document.body.style.overflow = '';

    state.chatTarget = null;

    await Promise.all([
      loadRealInbox(),
      loadRealNotifications()
    ]);

    notify(
      'Conversación eliminada para ti.'
    );
  }


  async function loadRealNotifications() {
    if (!state.user) return;
    const [{ data: connections }, { data: messages }] = await Promise.all([
      db.from('connections').select('*').or(`requester_id.eq.${state.user.id},recipient_id.eq.${state.user.id}`).order('created_at', { ascending: false }),
      db.from('messages').select('*').eq('recipient_id', state.user.id).is('read_at', null).order('created_at', { ascending: false }).limit(20)
    ]);
    state.incomingRequests = new Map();

    const relevantConnections = (connections || []).filter(item => {
      const otherId =
        item.requester_id === state.user.id
          ? item.recipient_id
          : item.requester_id;

      if (state.blockedUsers?.has(otherId)) {
        return false;
      }

      return (
        (item.recipient_id === state.user.id && item.status === 'pending') ||
        (item.requester_id === state.user.id && item.status === 'accepted')
      );
    });

    const visibleMessages = (messages || []).filter(message => {
      if (
        state.blockedUsers?.has(
          message.sender_id
        )
      ) {
        return false;
      }

      const preference =
        getConversationPreference(
          message.sender_id
        );

      if (preference.muted) {
        return false;
      }

      if (preference.deleted_before) {
        const deletedBefore =
          new Date(
            preference.deleted_before
          ).getTime();

        const messageTime =
          new Date(
            message.created_at
          ).getTime();

        if (messageTime <= deletedBefore) {
          return false;
        }
      }

      return true;
    });

    const ids = [
      ...relevantConnections.map(item =>
        item.requester_id === state.user.id
          ? item.recipient_id
          : item.requester_id
      ),
      ...visibleMessages.map(item => item.sender_id)
    ];
    const profiles = await fetchProfiles(ids);
    const items = [];

    relevantConnections.forEach(connection => {
      const otherId = connection.requester_id === state.user.id ? connection.recipient_id : connection.requester_id;
      const profile = profiles.get(otherId);
      const name = profile?.alias || profile?.name || 'Una persona';
      const pending = connection.status === 'pending';
      items.push({
        kind: pending ? 'request' : 'accepted',
        id: connection.id,
        otherId,
        createdAt: connection.updated_at || connection.created_at,
        icon: pending ? initials(name) : '✓',
        category: 'SOCIAL',
        title: pending ? `${name} quiere conectar contigo` : `${name} ha aceptado tu conexión`,
        copy: pending ? 'Revisa su perfil y responde a la solicitud' : 'Ya podéis enviaros mensajes'
      });
      if (pending) state.incomingRequests.set(connection.id, { request: connection, requester: profile });
    });

    const seenSenders = new Set();
    visibleMessages.forEach(message => {
      if (seenSenders.has(message.sender_id)) return;
      seenSenders.add(message.sender_id);
      const profile = profiles.get(message.sender_id);
      const name = profile?.alias || profile?.name || 'Una persona';
      items.push({
        kind: 'message', id: message.id, otherId: message.sender_id, createdAt: message.created_at,
        icon: initials(name), category: 'MENSAJE', title: `Nuevo mensaje de ${name}`, copy: message.body
      });
    });

    items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const list = document.querySelector('#notificationsModal .notification-list');
    if (list) {
      list.innerHTML = items.length ? items.map(item => `
        <button type="button" data-real-notification="${item.kind}" data-notification-id="${item.id}" data-user-id="${item.otherId}">
          <span class="notification-icon">${escapeHtml(item.icon)}</span>
          <div><small>${escapeHtml(item.category)} · ${relativeTime(item.createdAt)}</small><b>${escapeHtml(item.title)}</b><p>${escapeHtml(item.copy)}</p></div><i></i>
        </button>`).join('') : '<div class="real-empty-state"><b>Estás al día</b><p>Aquí aparecerán tus conexiones y mensajes.</p></div>';
    }
    const dot = document.querySelector('#openNotifications i');
    if (dot) dot.hidden = items.length === 0;
  }

  async function loadRealInbox() {
    if (!state.user) return;
    const { data: connections } = await db.from('connections').select('*')
      .or(`requester_id.eq.${state.user.id},recipient_id.eq.${state.user.id}`)
      .eq('status', 'accepted')
      .order('updated_at', { ascending: false });
    const otherIds = (connections || [])
      .map(item =>
        item.requester_id === state.user.id
          ? item.recipient_id
          : item.requester_id
      )
      .filter(id =>
        !state.blockedUsers?.has(id)
      );

    const profiles = await fetchProfiles(otherIds);
    const { data: messages } = await db.from('messages').select('*')
      .or(`sender_id.eq.${state.user.id},recipient_id.eq.${state.user.id}`)
      .order('created_at', { ascending: false });
    const latestByUser = new Map();

    (messages || []).forEach(message => {
      const otherId =
        message.sender_id === state.user.id
          ? message.recipient_id
          : message.sender_id;

      if (state.blockedUsers?.has(otherId)) {
        return;
      }

      const preference =
        getConversationPreference(otherId);

      const deletedBefore =
        preference.deleted_before
          ? new Date(
              preference.deleted_before
            ).getTime()
          : null;

      if (
        deletedBefore &&
        new Date(
          message.created_at
        ).getTime() <= deletedBefore
      ) {
        return;
      }

      if (!latestByUser.has(otherId)) {
        latestByUser.set(otherId, message);
      }
    });

    const visibleConversationIds =
      otherIds.filter(id => {
        const preference =
          getConversationPreference(id);

        if (!preference.deleted_before) {
          return true;
        }

        return latestByUser.has(id);
      });

    const list =
      document.querySelector(
        '#chatInboxModal .conversation-list'
      );

    if (!list) return;

    list.innerHTML =
      visibleConversationIds.length
        ? visibleConversationIds.map(id => {
      const profile = profiles.get(id);
      const name = profile?.alias || profile?.name || 'Usuario de Rooms';
      const last = latestByUser.get(id);
      return `<button type="button" data-real-chat="${id}" data-chat-type="person">
        <span class="home-chat-icon">${escapeHtml(initials(name))}</span>
        <div><b>${escapeHtml(name)}</b><p>${escapeHtml(last?.body || 'Ya podéis empezar a hablar.')}</p><small>CONEXIÓN ROOMS</small></div>
        <time>${last ? relativeTime(last.created_at) : ''}</time>
      </button>`;
    }).join('')
        : '<div class="real-empty-state"><b>Todavía no tienes conversaciones</b><p>Cuando aceptéis una conexión, el chat aparecerá aquí.</p></div>';
  }

  function initials(name) {
    return String(name || 'R').split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
  }

  function relativeTime(value) {
    const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
    if (seconds < 60) return 'AHORA';
    if (seconds < 3600) return `HACE ${Math.floor(seconds / 60)} MIN`;
    if (seconds < 86400) return `HACE ${Math.floor(seconds / 3600)} H`;
    return `HACE ${Math.floor(seconds / 86400)} D`;
  }

  async function loadSavedCollections() {
    if (!state.user) return;

    const { data: collections, error } = await db
      .from('saved_collections')
      .select('id,user_id,name,visibility,created_at')
      .eq('user_id', state.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Rooms: error cargando colecciones', error);
      return;
    }

    state.savedCollections.clear();
    (collections || []).forEach(collection => {
      state.savedCollections.set(collection.id, collection);
    });

    const grid = document.querySelector('#savedView .collection-grid');
    if (!grid) return;

    if (!collections?.length) {
      grid.innerHTML = '<div class="real-empty-state"><b>Todavía no tienes colecciones</b><p>Crea una cuando quieras organizar tus guardados.</p></div>';
      return;
    }

    const ids = collections.map(collection => collection.id);

    const { data: items, error: itemsError } = await db
      .from('saved_collection_items')
      .select('collection_id')
      .in('collection_id', ids);

    if (itemsError) {
      console.error('Rooms: error cargando elementos de colecciones', itemsError);
    }

    const counts = {};
    (items || []).forEach(item => {
      counts[item.collection_id] = (counts[item.collection_id] || 0) + 1;
    });

    const collectionItems = {};

    await Promise.all(collections.map(async collection => {
      const { data: links } = await db
        .from('saved_collection_items')
        .select('saved_item_id')
        .eq('collection_id', collection.id)
        .limit(4);

      if (!links?.length) {
        collectionItems[collection.id] = [];
        return;
      }

      const savedIds = links.map(item => item.saved_item_id);

      const { data: saved } = await db
        .from('saved_items')
        .select('id,item_type,item_id')
        .in('id', savedIds);

      collectionItems[collection.id] = (saved || []).map(item => {
        const presentation = savedItemPresentation(item);
        return presentation ? {
          image: presentation.image || null,
          mark: presentation.mark || '#'
        } : null;
      }).filter(Boolean);
    }));

    grid.innerHTML = collections.map(collection => {
      const count = counts[collection.id] || 0;
      const initial = (collection.name || '#').trim().charAt(0).toUpperCase() || '#';
      const previews = collectionItems[collection.id] || [];

      const cover = previews.length
        ? `<div class="collection-cover collection-cover-${Math.min(previews.length, 4)}">
            ${previews.map(item => item.image
              ? `<img src="${escapeHtml(item.image)}" alt="">`
              : `<span>${escapeHtml(item.mark)}</span>`
            ).join('')}
          </div>`
        : `<div class="collection-cover collection-cover-empty"><span>${escapeHtml(initial)}</span></div>`;

      return `<button type="button"
        data-real-collection="${collection.id}">
        ${cover}
        <b>${escapeHtml(collection.name)}</b>
        <small>${count} ${count === 1 ? 'elemento' : 'elementos'}</small>
      </button>`;
    }).join('');
  }

  async function createSavedCollection(name, visibility = 'private') {
    if (!state.user) return { error: new Error('No hay sesión activa') };

    const cleanName = String(name || '').trim();
    if (!cleanName) return { error: new Error('La colección necesita un nombre') };

    const { data, error } = await db
      .from('saved_collections')
      .insert({
        user_id: state.user.id,
        name: cleanName,
        visibility
      })
      .select()
      .single();

    if (error) {
      console.error('Rooms: error creando colección', error);
      return { error };
    }

    await loadSavedCollections();
    return { data };
  }

  window.roomsBackend.loadSavedCollections = loadSavedCollections;
  window.roomsBackend.createSavedCollection = createSavedCollection;

  function ensureCollectionDetailModal() {
    let modal = document.querySelector('#collectionDetailModal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'collectionDetailModal';
    modal.setAttribute('aria-hidden', 'true');
    modal.innerHTML = `
      <div class="backdrop" data-close-collection-detail></div>
      <article class="detail collection-detail-shell">
        <header class="collection-detail-header">
          <div>
            <small>COLECCIÓN</small>
            <h2 id="collectionDetailName">Colección</h2>
            <p id="collectionDetailMeta"></p>
          </div>
          <button type="button" data-close-collection-detail aria-label="Cerrar">×</button>
        </header>

        <div class="collection-detail-actions">
          <button type="button" id="addSavedToCollection">＋ Añadir guardados</button>
        </div>

        <div id="collectionDetailContent"></div>
      </article>`;

    document.body.appendChild(modal);
    return modal;
  }

  function savedItemPresentation(saved) {
    if (!saved) return null;

    if (saved.item_type === 'room' || saved.item_type === 'apartment') {
      const listing = state.listings.get(saved.item_id);
      if (!listing) return null;

      return {
        title: `${Number(listing.price).toLocaleString('es-ES')} €/mes · ${listing.zone}`,
        subtitle: listing.kind === 'apartment' ? 'Piso entero' : 'Habitación',
        mark: '⌂',
        image: Array.isArray(listing.photos) && listing.photos.length ? listing.photos[0] : null
      };
    }

    if (saved.item_type === 'person') {
      const person = state.profiles.get(saved.item_id);
      if (!person) return null;

      const name = person.alias || person.name || 'Usuario de Rooms';
      return {
        title: name,
        subtitle: person.zones?.[0] || 'Madrid',
        mark: initials(name)
      };
    }

    if (saved.item_type === 'post') {
      const post = state.posts.get(saved.item_id);
      if (!post) return null;

      return {
        title: post.body,
        subtitle: 'Publicación',
        mark: '“'
      };
    }

    if (saved.item_type === 'community') {
      const community = state.communities.get(saved.item_id);
      if (!community) return null;

      return {
        title: community.name,
        subtitle: 'Comunidad',
        mark: '#'
      };
    }

    return null;
  }

  async function openSavedCollection(collectionId) {
    const collection = state.savedCollections.get(collectionId);
    if (!collection) return;

    state.currentCollectionId = collectionId;

    const modal = ensureCollectionDetailModal();
    const title = modal.querySelector('#collectionDetailName');
    const meta = modal.querySelector('#collectionDetailMeta');

    title.textContent = collection.name;
    meta.textContent = collection.visibility === 'shared'
      ? 'Colección compartida'
      : 'Colección privada';

    await renderSavedCollection(collectionId);

    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  async function renderSavedCollection(collectionId) {
    const container = document.querySelector('#collectionDetailContent');
    if (!container) return;

    container.innerHTML = '<div class="real-empty-state"><b>Cargando colección…</b></div>';

    const { data: links, error } = await db
      .from('saved_collection_items')
      .select('saved_item_id')
      .eq('collection_id', collectionId);

    if (error) {
      console.error('Rooms: error cargando colección', error);
      container.innerHTML = '<div class="real-empty-state"><b>No se pudo cargar la colección</b></div>';
      return;
    }

    if (!links?.length) {
      container.innerHTML = `
        <div class="real-empty-state">
          <b>Esta colección está vacía</b>
          <p>Añade alguno de tus elementos guardados.</p>
        </div>`;
      return;
    }

    const ids = links.map(item => item.saved_item_id);

    const { data: saved, error: savedError } = await db
      .from('saved_items')
      .select('id,item_type,item_id')
      .in('id', ids)
      .eq('user_id', state.user.id);

    if (savedError) {
      console.error('Rooms: error cargando guardados de colección', savedError);
      return;
    }

    const cards = (saved || []).map(item => {
      const presentation = savedItemPresentation(item);
      if (!presentation) return '';

      return `
        <article class="collection-detail-item">
          ${presentation.image
            ? `<img src="${escapeHtml(presentation.image)}" alt="${escapeHtml(presentation.title)}">`
            : `<span>${escapeHtml(presentation.mark)}</span>`}
          <div>
            <b>${escapeHtml(presentation.title)}</b>
            <small>${escapeHtml(presentation.subtitle)}</small>
          </div>
          <button
            type="button"
            data-remove-from-collection="${item.id}"
            aria-label="Quitar de colección">×</button>
        </article>`;
    }).filter(Boolean);

    container.innerHTML = cards.length
      ? `<div class="collection-detail-list">${cards.join('')}</div>`
      : '<div class="real-empty-state"><b>No hay elementos disponibles</b></div>';
  }

  async function showSavedItemsPicker(collectionId) {
    const container = document.querySelector('#collectionDetailContent');
    if (!container) return;

    const [{ data: saved, error }, { data: existing }] = await Promise.all([
      db.from('saved_items')
        .select('id,item_type,item_id')
        .eq('user_id', state.user.id)
        .order('created_at', { ascending: false }),
      db.from('saved_collection_items')
        .select('saved_item_id')
        .eq('collection_id', collectionId)
    ]);

    if (error) {
      console.error('Rooms: error cargando guardados', error);
      notify('No se pudieron cargar tus guardados');
      return;
    }

    const alreadyAdded = new Set((existing || []).map(item => item.saved_item_id));

    const options = (saved || []).map(item => {
      const presentation = savedItemPresentation(item);
      if (!presentation) return '';

      const added = alreadyAdded.has(item.id);

      return `
        <button
          type="button"
          class="collection-picker-item ${added ? 'added' : ''}"
          data-add-to-collection="${item.id}"
          ${added ? 'disabled' : ''}>
          ${presentation.image
            ? `<img src="${escapeHtml(presentation.image)}" alt="${escapeHtml(presentation.title)}">`
            : `<span>${escapeHtml(presentation.mark)}</span>`}
          <div>
            <b>${escapeHtml(presentation.title)}</b>
            <small>${escapeHtml(presentation.subtitle)}</small>
          </div>
          <strong>${added ? '✓ Añadido' : '＋ Añadir'}</strong>
        </button>`;
    }).filter(Boolean);

    container.innerHTML = `
      <div class="collection-picker-head">
        <button type="button" data-back-to-collection>← Volver a la colección</button>
        <span>Elige entre tus guardados</span>
      </div>
      <div class="collection-picker-list">
        ${options.length
          ? options.join('')
          : '<div class="real-empty-state"><b>No tienes guardados todavía</b></div>'}
      </div>`;
  }

  async function addSavedItemToCollection(savedItemId) {
    const collectionId = state.currentCollectionId;
    if (!collectionId) return;

    const { error } = await db
      .from('saved_collection_items')
      .insert({
        collection_id: collectionId,
        saved_item_id: savedItemId
      });

    if (error) {
      console.error('Rooms: error añadiendo a colección', error);
      notify('No se pudo añadir a la colección');
      return;
    }

    await loadSavedCollections();
    await showSavedItemsPicker(collectionId);
    notify('Añadido a la colección');
  }

  async function removeSavedItemFromCollection(savedItemId) {
    const collectionId = state.currentCollectionId;
    if (!collectionId) return;

    const { error } = await db
      .from('saved_collection_items')
      .delete()
      .match({
        collection_id: collectionId,
        saved_item_id: savedItemId
      });

    if (error) {
      console.error('Rooms: error quitando de colección', error);
      notify('No se pudo quitar de la colección');
      return;
    }

    await loadSavedCollections();
    await renderSavedCollection(collectionId);
    notify('Quitado de la colección');
  }

  window.roomsBackend.openSavedCollection = openSavedCollection;

  async function loadSavedItems() {
    const { data } = await db.from('saved_items').select('item_type,item_id').eq('user_id', state.user.id);
    if (!data) return;

    state.savedItems = new Set(
      data.map(item => `${item.item_type}:${item.item_id}`)
    );

    updateSavedCount(data.length);
    document.querySelectorAll('[data-save-id]:not([data-real-remove-saved])').forEach(button => {
      button.classList.remove('saved');
      if (button.matches('[data-action]')) button.innerHTML = '♡ <span>Guardar</span>';
      else if (button.textContent.includes('Guardado')) button.textContent = '♡ Guardar';
      else if (button.matches('button')) button.textContent = button.textContent.includes('Guardar') ? '♡ Guardar' : '♡';
    });
    const counts = { room: 0, flat: 0, person: 0, post: 0, community: 0 };
    const cards = [];
    data.forEach(item => {
      document.querySelectorAll(`[data-save-id="${item.item_id}"]`).forEach(button => {
        button.classList.add('saved');
        button.innerHTML = button.matches('[data-action]') ? '♥ <span>Guardado</span>' : button.textContent.includes('Guardar') ? '♥ Guardado' : '♥';
      });
      const listing = state.listings.get(item.item_id);
      const person = state.profiles.get(item.item_id);
      const post = state.posts.get(item.item_id);
      const community = state.communities.get(item.item_id);
      if (listing) {
        const type = listing.kind === 'apartment' ? 'flat' : 'room';
        counts[type]++;
        cards.push(`<article class="saved-card saved-home" data-saved-type="${type}" data-real-listing="${listing.id}">${Array.isArray(listing.photos) && listing.photos.length ? `<img src="${escapeHtml(listing.photos[0])}" alt="${escapeHtml(listing.title || listing.zone)}">` : '<div class="saved-text-cover">⌂</div>'}<div><small>${listing.kind === 'apartment' ? 'PISO' : 'HABITACIÓN'}</small><h3>${Number(listing.price).toLocaleString('es-ES')} €/mes · ${escapeHtml(listing.zone)}</h3><p>${listing.kind === 'apartment' ? 'Piso entero' : 'Habitación'}</p><div class="saved-card-actions"><button type="button" data-real-remove-saved data-save-kind="${item.item_type}" data-save-id="${item.item_id}">Eliminar</button></div></div></article>`);
      } else if (person && person.id !== state.user.id) {
        counts.person++;
        const name = person.alias || person.name || 'Usuario de Rooms';
        cards.push(`<article class="saved-card saved-person" data-saved-type="person" data-real-user="${person.id}"><div class="saved-text-cover">${escapeHtml(initials(name))}</div><div><small>PERSONA</small><h3>${escapeHtml(name)}</h3><p>${escapeHtml(person.zones?.[0] || 'Madrid')}</p><div class="saved-card-actions"><button type="button" data-connect data-user-id="${person.id}">${escapeHtml(connectionButtonLabel(person.id))}</button><button type="button" data-real-remove-saved data-save-kind="person" data-save-id="${person.id}">Eliminar</button></div></div></article>`);
      } else if (post) {
        counts.post++;
        cards.push(`<article class="saved-card saved-post" data-saved-type="post"><div class="saved-text-cover">“</div><div><small>PUBLICACIÓN</small><h3>${escapeHtml(post.body)}</h3><div class="saved-card-actions"><button type="button" data-real-remove-saved data-save-kind="post" data-save-id="${post.id}">Eliminar</button></div></div></article>`);
      } else if (community) {
        counts.community++;
        cards.push(`<article class="saved-card saved-community" data-saved-type="community"><div class="saved-community-cover">#</div><div><small>COMUNIDAD</small><h3>${escapeHtml(community.name)}</h3><div class="saved-card-actions"><button type="button" data-real-remove-saved data-save-kind="community" data-save-id="${community.id}">Eliminar</button></div></div></article>`);
      }
    });
    const grid = document.querySelector('#savedView .saved-grid');
    if (grid) grid.innerHTML = cards.length ? cards.join('') : '<div class="real-empty-state"><b>Todavía no has guardado nada</b><p>Aquí aparecerán las viviendas y personas que quieras volver a mirar.</p></div>';
    Object.entries(counts).forEach(([type, count]) => {
      const label = document.querySelector(`#savedView [data-saved-filter="${type}"] i`);
      if (label) label.textContent = count;
    });
    const all = document.querySelector('#savedView [data-saved-filter="all"] i');
    if (all) all.textContent = data.length;
  }

  function openRealListingDetail(listing) {
    state.currentListingId = listing.id;

    const detail = document.querySelector('#detailContent');
    if (!detail) return;

    const kind =
      listing.kind === 'apartment'
        ? 'Piso entero'
        : listing.kind === 'external'
          ? 'Fuente externa'
          : 'Habitación';

    const zone = listing.zone || 'Madrid';

    const title =
      listing.title ||
      `${kind} en ${zone}`;

    const price =
      Number(listing.price || 0).toLocaleString('es-ES');

    const date =
      listing.available_from
        ? new Intl.DateTimeFormat('es-ES', {
            day: 'numeric',
            month: 'short'
          }).format(
            new Date(`${listing.available_from}T00:00:00`)
          )
        : 'Flexible';

    const photos =
      Array.isArray(listing.photos)
        ? listing.photos
        : [];

    const features =
      Array.isArray(listing.features)
        ? listing.features
        : [];

    const facts = [
      listing.rooms
        ? { value: listing.rooms, label: listing.rooms === 1 ? 'habitación' : 'habitaciones' }
        : null,

      listing.baths
        ? { value: listing.baths, label: listing.baths === 1 ? 'baño' : 'baños' }
        : null,

      listing.area
        ? { value: `${listing.area}`, label: 'm²' }
        : null
    ].filter(Boolean);

    detail.innerHTML = `
      <article class="rooms-property-sheet">

        <section
          class="rooms-property-gallery"
          ${photos.length ? 'data-carousel data-index="0"' : ''}
        >

          ${
            photos.length
              ? `
                <div class="rooms-property-gallery-track">
                  ${photos.map((photo, index) => `
                    <img
                      ${index === 0 ? 'class="active"' : ''}
                      data-carousel-slide
                      src="${escapeHtml(photo)}"
                      alt="${escapeHtml(title)} · foto ${index + 1}"
                    >
                  `).join('')}
                </div>

                ${
                  photos.length > 1
                    ? `
                      <button
                        type="button"
                        class="rooms-gallery-arrow rooms-gallery-prev"
                        data-carousel-prev
                        aria-label="Foto anterior"
                      >←</button>

                      <button
                        type="button"
                        class="rooms-gallery-arrow rooms-gallery-next"
                        data-carousel-next
                        aria-label="Foto siguiente"
                      >→</button>
                    `
                    : ''
                }

                <div class="carousel-dots rooms-gallery-dots">
                  ${photos.map((_, index) => `
                    <i class="${index === 0 ? 'active' : ''}"></i>
                  `).join('')}
                </div>

                <span class="rooms-gallery-count">
                  1 / ${photos.length}
                </span>
              `
              : `
                <div class="rooms-property-no-photo">
                  <b>rooms.</b>
                  <span>Fotos pendientes</span>
                </div>
              `
          }

          <div class="rooms-gallery-top">
            <span class="rooms-property-type">
              ${escapeHtml(kind)}
            </span>

            <button
              type="button"
              class="rooms-property-heart"
              data-detail-save
              data-save-kind="${listing.kind === 'apartment' ? 'apartment' : 'room'}"
              data-save-id="${listing.id}"
              aria-label="Guardar vivienda"
            >
              ♡
            </button>
          </div>

        </section>


        <section class="rooms-property-info">

          <div class="rooms-property-heading">

            <div class="rooms-property-location">
              <span>${escapeHtml(zone)}</span>
              <i></i>
              <span>${escapeHtml(kind)}</span>
            </div>

            <h1>${escapeHtml(title)}</h1>

            <div class="rooms-property-price">
              <b>${price} €</b>
              <span>/ mes</span>
            </div>

          </div>


          <div class="rooms-property-availability">
            <span>Disponible</span>
            <b>${escapeHtml(date)}</b>
          </div>


          ${
            facts.length
              ? `
                <div class="rooms-property-facts">
                  ${facts.map(fact => `
                    <div>
                      <b>${escapeHtml(String(fact.value))}</b>
                      <span>${escapeHtml(fact.label)}</span>
                    </div>
                  `).join('')}
                </div>
              `
              : ''
          }


          ${
            features.length
              ? `
                <div class="rooms-property-features">
                  ${features.map(feature => `
                    <span>${escapeHtml(feature)}</span>
                  `).join('')}
                </div>
              `
              : ''
          }


          <div class="real-report-row">
            <button
              type="button"
              class="real-report-button"
              data-real-report
              data-report-type="listing"
              data-report-id="${escapeHtml(String(listing.id))}"
              data-report-user="${escapeHtml(String(
                listing.user_id ||
                listing.owner_id ||
                listing.author_id ||
                ''
              ))}"
            >
              Reportar anuncio
            </button>
          </div>

          <div class="rooms-property-copy">
            <small>SOBRE ESTA VIVIENDA</small>

            <p>
              ${escapeHtml(
                listing.description ||
                'El anunciante todavía no ha añadido una descripción.'
              )}
            </p>
          </div>


          <div class="rooms-property-actions">

            <button
              type="button"
              class="rooms-property-action-primary"
              data-detail-save
              data-save-kind="${listing.kind === 'apartment' ? 'apartment' : 'room'}"
              data-save-id="${listing.id}"
            >
              ♡ Guardar
            </button>

            ${
              state.household
                ? `
                  <button
                    type="button"
                    class="rooms-property-action-group"
                    data-send-home-id="${listing.id}"
                  >
                    ＋ Añadir al grupo
                  </button>
                `
                : ''
            }

            <button
              type="button"
              class="rooms-property-action-light"
              data-share-real-listing="${listing.id}"
            >
              Compartir ↗
            </button>

          </div>

          ${
            listing.owner_id === state.user.id
              ? `
                <button
                  type="button"
                  class="rooms-property-edit"
                  data-edit-listing="${listing.id}"
                >
                  Editar mi anuncio
                </button>
              `
              : ''
          }

        </section>

      </article>
    `;

    showModal(document.querySelector('#detailModal'));
  }

  async function openRealUser(profile) {
    if (!profile) return;

    state.targetProfile = profile;

    await loadConnection(profile.id);

    const modal =
      document.querySelector('#userProfileModal');

    if (!modal) return;

    const name =
      profile.alias ||
      profile.name ||
      'Usuario de Rooms';

    const saved =
      state.savedItems?.has(
        `person:${profile.id}`
      );

    const traitLabels = {
      tidy: 'Ordenado',
      social: 'Sociable',
      calm: 'Tranquilo',
      independent: 'Independiente',
      cook: 'Cocinillas',
      early: 'Madrugador',
      night: 'Nocturno'
    };

    const seeking =
      profile.seeking?.length
        ? profile.seeking
            .map(labelSeeking)
            .join(' · ')
        : 'Sin definir';

    const zones =
      profile.zones?.length
        ? profile.zones.join(' · ')
        : 'Sin definir';

    const interests =
      Array.isArray(profile.interests)
        ? profile.interests
        : [];

    const traits =
      Array.isArray(profile.traits)
        ? profile.traits
        : [];

    const moveDate =
      profile.move_in_date
        ? new Intl.DateTimeFormat(
            'es-ES',
            {
              day: 'numeric',
              month: 'long'
            }
          ).format(
            new Date(
              `${profile.move_in_date}T00:00:00`
            )
          )
        : 'Flexible';

    const imageBox =
      modal.querySelector('.profile-hero');

    if (imageBox) {
      imageBox.innerHTML =
        profile.avatar_url
          ? `
            <img
              src="${escapeHtml(profile.avatar_url)}"
              alt="${escapeHtml(name)}"
            >
          `
          : `
            <div class="real-person-placeholder profile-person-placeholder">
              ${escapeHtml(initials(name))}
            </div>
          `;
    }

    const content =
      modal.querySelector('.user-profile-content');

    if (content) {
      content.innerHTML = `
        <section class="real-user-profile-intro">

          <div class="real-report-row">
            <button
              type="button"
              class="real-report-button"
              data-real-report
              data-report-type="profile"
              data-report-id="${escapeHtml(profile.id)}"
              data-report-user="${escapeHtml(profile.id)}"
            >
              Reportar perfil
            </button>

            <button
              type="button"
              class="real-report-button real-block-button"
              data-real-block-user="${escapeHtml(profile.id)}"
              data-real-block-name="${escapeHtml(name)}"
            >
              ${
                state.blockedUsers?.has(profile.id)
                  ? 'Desbloquear usuario'
                  : 'Bloquear usuario'
              }
            </button>
          </div>

          <div class="real-user-profile-eyebrow">
            <span>PERFIL</span>
            <i></i>
            <span>ROOMS</span>
          </div>

          <div class="real-user-profile-title">
            <div>
              <h1>
                ${escapeHtml(name)}
                ${profile.age ? `<small>, ${profile.age}</small>` : ''}
              </h1>

              <p>
                ${escapeHtml(
                  profile.bio ||
                  'Todavía no ha añadido una descripción.'
                )}
              </p>
            </div>
          </div>


          <div class="real-user-profile-facts">

            <div>
              <small>BUSCA</small>
              <b>${escapeHtml(seeking)}</b>
            </div>

            <div>
              <small>ZONAS</small>
              <b>${escapeHtml(zones)}</b>
            </div>

            <div>
              <small>PRESUPUESTO</small>
              <b>${escapeHtml(formatBudget(profile))}</b>
            </div>

            <div>
              <small>ENTRADA</small>
              <b>${escapeHtml(moveDate)}</b>
            </div>

            <div>
              <small>DURACIÓN</small>
              <b>${escapeHtml(profile.duration || 'Flexible')}</b>
            </div>

          </div>


          ${
            traits.length
              ? `
                <div class="real-user-profile-block">
                  <small>CONVIVENCIA</small>

                  <div class="real-user-profile-chips">
                    ${traits.map(item => `
                      <span>
                        ${escapeHtml(
                          traitLabels[item] || item
                        )}
                      </span>
                    `).join('')}
                  </div>
                </div>
              `
              : ''
          }


          ${
            interests.length
              ? `
                <div class="real-user-profile-block">
                  <small>INTERESES</small>

                  <div class="real-user-profile-chips interests">
                    ${interests.map(item => `
                      <span>
                        ${escapeHtml(item)}
                      </span>
                    `).join('')}
                  </div>
                </div>
              `
              : ''
          }


          <div class="real-user-profile-actions">

            <button
              type="button"
              class="real-user-connect ${
                state.blockedUsers?.has(profile.id)
                  ? 'connection-blocked'
                  : ''
              }"
              data-connect
              data-user-id="${profile.id}"
              ${
                state.blockedUsers?.has(profile.id)
                  ? 'disabled'
                  : ''
              }
            >
              ${
                state.blockedUsers?.has(profile.id)
                  ? 'Bloqueado'
                  : escapeHtml(
                      connectionButtonLabel(profile.id)
                    )
              }
            </button>

            ${
              !state.blockedUsers?.has(profile.id)
                ? `
                  <button
                    type="button"
                    class="real-user-group"
                    data-send-person-home="${profile.id}"
                  >
                    + Añadir a grupo
                  </button>

                  <button
                    type="button"
                    class="real-user-save ${saved ? 'saved' : ''}"
                    data-person-save
                    data-save-kind="person"
                    data-save-id="${profile.id}"
                  >
                    ${saved ? '♥ Guardado' : '♡ Guardar'}
                  </button>
                `
                : ''
            }

          </div>

        </section>
      `;
    }

    /*
      Eliminamos el CTA duplicado inferior.
      Todo el perfil consume ahora la misma acción real.
    */
    const fixedActions =
      modal.querySelector('.profile-fixed-actions');

    if (fixedActions) {
      fixedActions.innerHTML = '';
      fixedActions.hidden = true;
    }

    updateConnectButtons();

    showModal(modal);
  }

  function ensureConversationOptionsMenu() {
    const header =
      document.querySelector(
        '#conversationModal .conversation-shell header'
      );

    if (!header) return null;

    let button =
      header.querySelector(
        '[data-real-conversation-options]'
      );

    if (!button) {
      button =
        document.createElement('button');

      button.type = 'button';
      button.className =
        'conversation-options-trigger';

      button.setAttribute(
        'data-real-conversation-options',
        ''
      );

      button.setAttribute(
        'aria-label',
        'Opciones de conversación'
      );

      button.setAttribute(
        'aria-expanded',
        'false'
      );

      button.textContent = '•••';

      header.appendChild(button);
    }

    let menu =
      document.querySelector(
        '#realConversationOptionsMenu'
      );

    if (!menu) {
      menu =
        document.createElement('div');

      menu.id =
        'realConversationOptionsMenu';

      menu.className =
        'real-conversation-options';

      menu.hidden = true;

      header.appendChild(menu);
    }

    return menu;
  }


  function renderConversationOptionsMenu() {
    if (!state.chatTarget) return;

    const menu =
      ensureConversationOptionsMenu();

    if (!menu) return;

    const preference =
      getConversationPreference(
        state.chatTarget.id
      );

    menu.innerHTML = `
      <button
        type="button"
        data-real-chat-action="profile"
      >
        Ver perfil
      </button>

      <button
        type="button"
        data-real-chat-action="mute"
      >
        ${
          preference.muted
            ? 'Activar notificaciones'
            : 'Silenciar conversación'
        }
      </button>

      <button
        type="button"
        data-real-chat-action="report"
      >
        Reportar usuario
      </button>

      <button
        type="button"
        data-real-chat-action="block"
      >
        Bloquear usuario
      </button>

      <hr>

      <button
        type="button"
        class="danger"
        data-real-chat-action="delete"
      >
        Eliminar conversación
      </button>
    `;
  }


  function closeConversationOptionsMenu() {
    const menu =
      document.querySelector(
        '#realConversationOptionsMenu'
      );

    const button =
      document.querySelector(
        '[data-real-conversation-options]'
      );

    if (menu) {
      menu.hidden = true;
    }

    if (button) {
      button.setAttribute(
        'aria-expanded',
        'false'
      );
    }
  }


  async function openRealConversation(profile) {
    if (!profile || !state.user) return;

    if (
      state.blockedUsers?.has(profile.id)
    ) {
      notify(
        'Has bloqueado a este usuario.'
      );
      return;
    }

    const connection =
      getConnectionForUser(profile.id) ||
      await loadConnection(profile.id);

    if (
      !connection ||
      connection.status !== 'accepted'
    ) {
      notify(
        'Necesitáis estar conectados para poder escribiros'
      );
      return;
    }

    state.chatTarget = profile;

    hideAllModals();

    const modal =
      document.querySelector('#conversationModal');

    if (!modal) return;

    const name =
      profile.alias ||
      profile.name ||
      'Usuario de Rooms';

    const nameNode =
      document.querySelector('#conversationName');

    const contextNode =
      document.querySelector('#conversationContext');

    const avatar =
      document.querySelector('#conversationAvatar');

    const symbol =
      document.querySelector('#conversationSymbol');

    const input =
      document.querySelector('#conversationInput');

    if (nameNode) {
      nameNode.textContent = name;
    }

    if (contextNode) {
      contextNode.textContent =
        'Conectados en Rooms';
    }

    if (profile.avatar_url && avatar) {
      avatar.src = profile.avatar_url;
      avatar.alt = name;
      avatar.hidden = false;

      if (symbol) {
        symbol.hidden = true;
      }
    } else {
      if (avatar) {
        avatar.src = '';
        avatar.alt = '';
        avatar.hidden = true;
      }

      if (symbol) {
        symbol.textContent =
          initials(name);

        symbol.hidden = false;
      }
    }

    if (input) {
      input.value = '';
      input.disabled = false;
    }

    showModal(modal);

    ensureConversationOptionsMenu();
    renderConversationOptionsMenu();
    closeConversationOptionsMenu();

    await renderMessages();

    subscribeToMessages();

    setTimeout(() => {
      input?.focus();
    }, 80);
  }


  async function renderMessages() {
    if (
      !state.chatTarget ||
      !state.user
    ) {
      return;
    }

    const body =
      document.querySelector(
        '#conversationBody'
      );

    if (!body) return;

    body.innerHTML = `
      <div class="real-chat-loading">
        Cargando conversación…
      </div>
    `;

    const { data, error } = await db
      .from('messages')
      .select('*')
      .or(
        `and(sender_id.eq.${state.user.id},recipient_id.eq.${state.chatTarget.id}),and(sender_id.eq.${state.chatTarget.id},recipient_id.eq.${state.user.id})`
      )
      .order(
        'created_at',
        { ascending: true }
      );

    if (error) {
      console.error(
        'Rooms: error cargando mensajes',
        error
      );

      body.innerHTML = `
        <div class="real-chat-empty">
          <b>No pudimos cargar la conversación</b>
          <p>Inténtalo de nuevo.</p>
        </div>
      `;

      return;
    }

    const preference =
      getConversationPreference(
        state.chatTarget.id
      );

    const deletedBefore =
      preference.deleted_before
        ? new Date(
            preference.deleted_before
          ).getTime()
        : null;

    const messages =
      (data || []).filter(message =>
        !deletedBefore ||
        new Date(
          message.created_at
        ).getTime() > deletedBefore
      );

    if (!messages.length) {
      const name =
        state.chatTarget.alias ||
        state.chatTarget.name ||
        'esta persona';

      body.innerHTML = `
        <div class="real-chat-empty">
          <span>✦</span>

          <b>
            Empieza la conversación
          </b>

          <p>
            Tú y ${escapeHtml(name)}
            ya estáis conectados en Rooms.
          </p>
        </div>
      `;

      return;
    }

    body.innerHTML = `
      <div class="chat-day">
        CONVERSACIÓN
      </div>

      ${messages
        .map(message => messageBubble(message))
        .join('')}
    `;

    body.scrollTop =
      body.scrollHeight;
  }


  function messageBubble(message) {
    const mine =
      message.sender_id === state.user.id;

    const name =
      state.chatTarget?.alias ||
      state.chatTarget?.name ||
      'Usuario';

    const date =
      new Date(message.created_at);

    const time =
      new Intl.DateTimeFormat(
        'es-ES',
        {
          hour: '2-digit',
          minute: '2-digit'
        }
      ).format(date);

    return `
      <div
        class="chat-message ${mine ? 'mine' : 'other'}"
        data-message-id="${escapeHtml(message.id)}"
      >
        ${
          mine
            ? ''
            : `<b>${escapeHtml(name)}</b>`
        }

        <p>
          ${escapeHtml(message.body)}
        </p>

        <small>
          ${escapeHtml(time)}
        </small>
      </div>
    `;
  }


  async function sendMessage(text) {
    if (
      !state.chatTarget ||
      !state.user ||
      !text
    ) {
      return;
    }

    if (
      state.blockedUsers?.has(
        state.chatTarget.id
      )
    ) {
      notify(
        'Has bloqueado a este usuario.'
      );
      return;
    }

    const connection =
      getConnectionForUser(
        state.chatTarget.id
      ) ||
      await loadConnection(
        state.chatTarget.id
      );

    if (
      !connection ||
      connection.status !== 'accepted'
    ) {
      notify(
        'Esta conexión ya no está activa'
      );

      return;
    }

    const cleanText =
      String(text)
        .trim()
        .slice(0, 2000);

    if (!cleanText) return;

    const { error } = await db
      .from('messages')
      .insert({
        sender_id: state.user.id,
        recipient_id: state.chatTarget.id,
        body: cleanText
      });

    if (error) {
      console.error(
        'Rooms: error enviando mensaje',
        error
      );

      notify(
        'No se pudo enviar el mensaje'
      );

      return;
    }

    /*
      Re-render inmediato para que el envío
      no dependa exclusivamente de Realtime.
    */
    await renderMessages();

    await Promise.all([
      loadRealNotifications(),
      loadRealInbox()
    ]);
  }


  function subscribeToMessages() {
    if (!state.user) return;

    if (state.channel) {
      db.removeChannel(state.channel);
      state.channel = null;
    }

    state.channel =
      db
        .channel(
          `messages-${state.user.id}`
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages'
          },
          payload => {
            const message =
              payload.new;

            const belongsToUser =
              message.sender_id === state.user.id ||
              message.recipient_id === state.user.id;

            if (!belongsToUser) {
              return;
            }

            const belongsToOpenChat =
              state.chatTarget &&
              (
                (
                  message.sender_id === state.user.id &&
                  message.recipient_id === state.chatTarget.id
                ) ||
                (
                  message.sender_id === state.chatTarget.id &&
                  message.recipient_id === state.user.id
                )
              );

            if (belongsToOpenChat) {
              renderMessages();
            }

            Promise.all([
              loadRealNotifications(),
              loadRealInbox()
            ]);
          }
        )
        .subscribe();
  }


  document.addEventListener('click', event => {
    const conversationOptions =
      event.target.closest(
        '[data-real-conversation-options]'
      );

    if (conversationOptions) {
      event.preventDefault();
      event.stopImmediatePropagation();

      const menu =
        ensureConversationOptionsMenu();

      if (!menu) return;

      menu.hidden =
        !menu.hidden;

      conversationOptions.setAttribute(
        'aria-expanded',
        String(!menu.hidden)
      );

      return;
    }

    const conversationAction =
      event.target.closest(
        '[data-real-chat-action]'
      );

    if (conversationAction) {
      event.preventDefault();
      event.stopImmediatePropagation();

      if (!state.chatTarget) return;

      const action =
        conversationAction.dataset.realChatAction;

      const profile =
        state.chatTarget;

      const name =
        profile.alias ||
        profile.name ||
        'este usuario';

      closeConversationOptionsMenu();

      if (action === 'profile') {
        openRealUser(profile);
        return;
      }

      if (action === 'mute') {
        toggleConversationMute();
        return;
      }

      if (action === 'report') {
        openRealReport({
          dataset: {
            reportType: 'user',
            reportId: profile.id,
            reportUser: profile.id
          }
        });
        return;
      }

      if (action === 'block') {
        openRealBlock({
          dataset: {
            realBlockUser: profile.id,
            realBlockName: name
          }
        });
        return;
      }

      if (action === 'delete') {
        deleteConversationForMe();
        return;
      }
    }

    const blockedUsersButton =
      event.target.closest('#blockedUsers');

    if (blockedUsersButton) {
      event.preventDefault();
      event.stopImmediatePropagation();

      openBlockedUsersManager();
      return;
    }

    const closeBlockedUsers =
      event.target.closest(
        '[data-close-blocked-users]'
      );

    if (closeBlockedUsers) {
      event.preventDefault();
      event.stopImmediatePropagation();

      const modal =
        document.querySelector(
          '#blockedUsersModal'
        );

      if (modal) {
        modal.classList.remove('open');
        modal.setAttribute(
          'aria-hidden',
          'true'
        );
      }

      document.body.style.overflow = '';
      return;
    }

    const unblockUser =
      event.target.closest(
        '[data-unblock-user]'
      );

    if (unblockUser) {
      event.preventDefault();
      event.stopImmediatePropagation();

      unblockRealUser(
        unblockUser.dataset.unblockUser,
        unblockUser.dataset.unblockName
      );

      return;
    }

    const realBlock =
      event.target.closest('[data-real-block-user]');

    if (realBlock) {
      event.preventDefault();
      event.stopImmediatePropagation();
      openRealBlock(realBlock);
      return;
    }

    const confirmBlock =
      event.target.closest('#confirmBlock');

    if (confirmBlock) {
      event.preventDefault();
      event.stopImmediatePropagation();
      confirmRealBlock();
      return;
    }

    const realReport =
      event.target.closest('[data-real-report]');

    if (realReport) {
      event.preventDefault();
      event.stopImmediatePropagation();
      openRealReport(realReport);
      return;
    }


    const shareRealListing =
      event.target.closest('[data-share-real-listing]');

    if (shareRealListing) {
      event.preventDefault();
      event.stopImmediatePropagation();

      const listingId =
        shareRealListing.dataset.shareRealListing;

      const shareUrl =
        `${window.location.origin}${window.location.pathname}?listing=${listingId}`;

      if (navigator.share) {
        navigator.share({
          title: 'Vivienda en Rooms',
          url: shareUrl
        }).catch(() => {});
      } else {
        navigator.clipboard
          ?.writeText(shareUrl)
          .then(() => notify('Enlace copiado'))
          .catch(() => notify('No se pudo copiar el enlace'));
      }

      return;
    }

    if (event.target.closest('[data-open-current-home]')) {
      event.preventDefault();
      notify('Mi hogar estará disponible próximamente');
      return;
    }

    /* GROUP PICKER — acciones en el listener principal de captura */

    const groupPickerChoice =
      event.target.closest('[data-pick-group]');

    if (groupPickerChoice) {
      event.preventDefault();
      event.stopImmediatePropagation();

      const householdId =
        groupPickerChoice.dataset.pickGroup;

      const candidate =
        state.pendingGroupCandidate;

      if (!candidate) {
        notify(
          'No encuentro el elemento que quieres añadir'
        );

        closeGroupPicker();
        return;
      }

      /*
        Evita dobles clics mientras Supabase responde.
      */
      groupPickerChoice.disabled = true;

      const originalContent =
        groupPickerChoice.innerHTML;

      const arrow =
        groupPickerChoice.querySelector(
          '.group-picker-option-arrow'
        );

      if (arrow) {
        arrow.textContent = '…';
      }


      if (candidate.type === 'person') {
        addPersonToGroup(
          candidate.id,
          householdId
        )
          .then(success => {
            if (!success) {
              groupPickerChoice.disabled = false;
              groupPickerChoice.innerHTML =
                originalContent;

              return;
            }

            state.pendingGroupCandidate = null;

            closeGroupPicker();
          })
          .catch(error => {
            console.error(
              'Rooms: error en selector de grupo',
              error
            );

            groupPickerChoice.disabled = false;
            groupPickerChoice.innerHTML =
              originalContent;

            notify(
              'No se pudo añadir la persona'
            );
          });

        return;
      }


      if (candidate.type === 'listing') {
        /*
          Conservamos el flujo real existente
          de viviendas.
        */
        addListingToGroup(
          candidate.id,
          householdId
        )
          .then(() => {
            state.pendingGroupCandidate = null;
            closeGroupPicker();
          })
          .catch(error => {
            console.error(
              'Rooms: error añadiendo vivienda al grupo',
              error
            );

            groupPickerChoice.disabled = false;
            groupPickerChoice.innerHTML =
              originalContent;
          });

        return;
      }


      groupPickerChoice.disabled = false;
      groupPickerChoice.innerHTML =
        originalContent;
    }


    const groupPickerClose =
      event.target.closest('[data-close-group-picker]');

    if (groupPickerClose) {
      event.preventDefault();
      event.stopImmediatePropagation();

      closeGroupPicker();
      state.pendingGroupCandidate = null;

      return;
    }


    const openRealCommunityButton =
      event.target.closest(
        '[data-real-community-open], [data-member-community-open]'
      );

    if (openRealCommunityButton) {
      event.preventDefault();
      event.stopImmediatePropagation();

      const communityId =
        openRealCommunityButton.dataset.realCommunityOpen ||
        openRealCommunityButton.dataset.memberCommunityOpen;

      openRealCommunity(communityId);
      return;
    }


    const backRealCommunityButton =
      event.target.closest('[data-back-real-community]');

    if (backRealCommunityButton) {
      event.preventDefault();
      event.stopImmediatePropagation();

      const communityView =
        document.querySelector('#communityView');

      const communitiesView =
        document.querySelector('#communitiesView');

      if (communityView) {
        communityView.hidden = true;
      }

      if (communitiesView) {
        communitiesView.hidden = false;
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

      return;
    }


    const communityMembershipButton =
      event.target.closest(
        '[data-toggle-community-membership]'
      );

    if (communityMembershipButton) {
      event.preventDefault();
      event.stopImmediatePropagation();

      toggleRealCommunityMembership(
        communityMembershipButton.dataset
          .toggleCommunityMembership
      );

      return;
    }


    const realCommunityTab =
      event.target.closest(
        '[data-real-community-tab]'
      );

    if (realCommunityTab) {
      event.preventDefault();
      event.stopImmediatePropagation();

      const tab =
        realCommunityTab.dataset.realCommunityTab;

      document
        .querySelectorAll('[data-real-community-tab]')
        .forEach(button => {
          button.classList.toggle(
            'active',
            button === realCommunityTab
          );
        });

      document
        .querySelectorAll(
          '[data-real-community-panel]'
        )
        .forEach(panel => {
          panel.hidden =
            panel.dataset.realCommunityPanel !== tab;
        });

      return;
    }


    if (
      event.target.closest(
        '[data-community-publish-placeholder]'
      )
    ) {
      event.preventDefault();
      event.stopImmediatePropagation();

      if (!state.activeCommunity?.id) {
        notify('No encuentro la comunidad');
        return;
      }

      state.communityPublishTarget =
        state.activeCommunity.id;

      state.publishType = null;
      state.publishDraft = {
        steps: {},
        files: []
      };

      const publishModal =
        document.querySelector('#publishModal');

      if (publishModal) {
        showModal(publishModal);
      }

      setTimeout(() => {
        const postChoice =
          document.querySelector(
            '[data-publish-type="post"]'
          );

        postChoice?.click();
      }, 50);

      return;
    }


    if (
      event.target.closest(
        '[data-manage-community-placeholder]'
      )
    ) {
      event.preventDefault();
      event.stopImmediatePropagation();

      openManageCommunityModal();

      return;
    }


    if (
      event.target.closest(
        '[data-close-manage-community]'
      )
    ) {
      event.preventDefault();
      event.stopImmediatePropagation();

      closeManageCommunityModal();

      return;
    }


    const communityLikeButton =
      event.target.closest(
        '[data-community-post-like]'
      );

    if (communityLikeButton) {
      event.preventDefault();
      event.stopImmediatePropagation();

      toggleCommunityPostLike(
        communityLikeButton.dataset.communityPostLike
      );

      return;
    }


    const communityCommentsButton =
      event.target.closest(
        '[data-community-post-comments]'
      );

    if (communityCommentsButton) {
      event.preventDefault();
      event.stopImmediatePropagation();

      const postId =
        communityCommentsButton.dataset.communityPostComments;

      const panel =
        document.querySelector(
          `[data-community-comments-panel="${postId}"]`
        );

      if (panel) {
        panel.hidden = !panel.hidden;

        if (!panel.hidden) {
          renderCommunityCommentsPanel(postId);
        }
      }

      return;
    }


    const createCommunityButton =
      event.target.closest('[data-create-community]');

    if (createCommunityButton) {
      event.preventDefault();
      event.stopImmediatePropagation();

      openCreateCommunityModal();
      return;
    }

    const closeCreateCommunityButton =
      event.target.closest('[data-close-create-community]');

    if (closeCreateCommunityButton) {
      event.preventDefault();
      event.stopImmediatePropagation();

      closeCreateCommunityModal();
      return;
    }


    const openEmptySearchGroup =
      event.target.closest('[data-open-search-group-empty]');

    if (openEmptySearchGroup) {
      event.preventDefault();
      event.stopImmediatePropagation();

      const createModal =
        ensureCreateHouseholdModal();

      createModal.classList.add('open');
      createModal.setAttribute('aria-hidden', 'false');

      document.body.style.overflow = 'hidden';

      setTimeout(() => {
        createModal
          .querySelector('#createHouseholdName')
          ?.focus();
      }, 50);

      return;
    }


    const groupPickerCreate =
      event.target.closest('[data-create-group-from-picker]');

    if (groupPickerCreate) {
      event.preventDefault();
      event.stopImmediatePropagation();

      closeGroupPicker();

      const detailModal =
        document.querySelector('#detailModal');

      if (detailModal) {
        detailModal.classList.remove('open');
        detailModal.setAttribute('aria-hidden', 'true');
      }

      const createModal =
        ensureCreateHouseholdModal();

      createModal.classList.add('open');
      createModal.setAttribute('aria-hidden', 'false');

      document.body.style.overflow = 'hidden';

      setTimeout(() => {
        createModal
          .querySelector('#createHouseholdName')
          ?.focus();
      }, 50);

      return;
    }


    const livingChoice = event.target.closest('[data-living-choice]');
    const livingWeight = event.target.closest('[data-living-weight]');
    if (livingChoice) {
      const [category, option] = livingChoice.dataset.livingChoice.split(':');
      state.living[category] = { ...(state.living[category] || {}), option: Number(option) };
    }
    if (livingWeight) {
      const [category, weight] = livingWeight.dataset.livingWeight.split(':');
      state.living[category] = { ...(state.living[category] || {}), weight: Number(weight) };
    }

    const listing = event.target.closest('[data-listing-id]');
    if (listing) state.currentListingId = listing.dataset.listingId;

    const realCollection = event.target.closest('[data-real-collection]');
    if (realCollection) {
      event.preventDefault();
      openSavedCollection(realCollection.dataset.realCollection);
      return;
    }

    const addSavedToCollection = event.target.closest('#addSavedToCollection');
    if (addSavedToCollection && state.currentCollectionId) {
      showSavedItemsPicker(state.currentCollectionId);
      return;
    }

    const addToCollection = event.target.closest('[data-add-to-collection]');
    if (addToCollection) {
      addSavedItemToCollection(addToCollection.dataset.addToCollection);
      return;
    }

    const removeFromCollection = event.target.closest('[data-remove-from-collection]');
    if (removeFromCollection) {
      removeSavedItemFromCollection(removeFromCollection.dataset.removeFromCollection);
      return;
    }

    const backToCollection = event.target.closest('[data-back-to-collection]');
    if (backToCollection && state.currentCollectionId) {
      renderSavedCollection(state.currentCollectionId);
      return;
    }

    const closeCollectionDetail = event.target.closest('[data-close-collection-detail]');
    if (closeCollectionDetail) {
      const modal = document.querySelector('#collectionDetailModal');
      if (modal) {
        modal.classList.remove('open');
        modal.setAttribute('aria-hidden', 'true');
      }
      document.body.style.overflow = '';
      return;
    }

    const myReports =
      event.target.closest('#myReports');

    if (myReports) {
      event.preventDefault();
      event.stopImmediatePropagation();
      showMyRealReports();
      return;
    }

    const reportReason =
      event.target.closest(
        '#reportModal .report-reasons button'
      );

    if (reportReason) {
      event.preventDefault();
      event.stopImmediatePropagation();

      document
        .querySelectorAll(
          '#reportModal .report-reasons button'
        )
        .forEach(button => {
          button.setAttribute(
            'aria-checked',
            String(button === reportReason)
          );
        });

      const submit =
        document.querySelector('#submitReport');

      if (submit) submit.disabled = false;

      return;
    }

    const submitReport =
      event.target.closest('#submitReport');

    if (submitReport) {
      event.preventDefault();
      event.stopImmediatePropagation();
      submitRealReport();
      return;
    }

    const save = event.target.closest('[data-action="save"],.feed-save,[data-detail-save],[data-person-save],[data-save-kind]');
    if (save && save.dataset.saveId && !save.hasAttribute('data-real-remove-saved')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const removing = save.classList.contains('saved');
      persistSavedItem(save).then(() => notify(removing ? 'Eliminado de Guardados' : 'Guardado en Rooms'));
      return;
    }
    if (save) persistSavedItem(save);

    const removeSaved = event.target.closest('[data-real-remove-saved]');
    if (removeSaved) {
      event.preventDefault();
      event.stopImmediatePropagation();
      db.from('saved_items').delete().match({ user_id: state.user.id, item_type: removeSaved.dataset.saveKind, item_id: removeSaved.dataset.saveId })
        .then(() => { loadSavedItems(); notify('Eliminado de Guardados'); });
      return;
    }

    const connect = event.target.closest('[data-connect]');
    if (connect && state.user) {
      event.preventDefault();
      event.stopImmediatePropagation();
      connectToUser(connect.dataset.userId || state.targetProfile?.id);
      return;
    }

    const photoLeft =
      event.target.closest('[data-edit-photo-left]');

    if (photoLeft) {
      event.preventDefault();
      event.stopImmediatePropagation();

      const index =
        Number(photoLeft.dataset.editPhotoLeft);

      moveEditListingPhoto(index, index - 1);
      return;
    }

    const photoRight =
      event.target.closest('[data-edit-photo-right]');

    if (photoRight) {
      event.preventDefault();
      event.stopImmediatePropagation();

      const index =
        Number(photoRight.dataset.editPhotoRight);

      moveEditListingPhoto(index, index + 1);
      return;
    }

    const photoCover =
      event.target.closest('[data-edit-photo-cover]');

    if (photoCover) {
      event.preventDefault();
      event.stopImmediatePropagation();

      makeEditListingPhotoCover(
        Number(photoCover.dataset.editPhotoCover)
      );
      return;
    }

    const photoDelete =
      event.target.closest('[data-edit-photo-delete]');

    if (photoDelete) {
      event.preventDefault();
      event.stopImmediatePropagation();

      deleteEditListingPhoto(
        Number(photoDelete.dataset.editPhotoDelete)
      );
      return;
    }

    const editListing = event.target.closest('[data-edit-listing]');
    if (editListing) {
      event.preventDefault();
      event.stopImmediatePropagation();
      openEditListing(editListing.dataset.editListing);
      return;
    }

    const deleteListing = event.target.closest('[data-delete-listing]');
    if (deleteListing) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const listingId = document.querySelector('#editListingId')?.value;
      if (listingId) deleteOwnListing(listingId);
      return;
    }

    const realListing = event.target.closest('[data-real-listing]');
    if (realListing) {
      if (
        event.target.closest(
          '[data-carousel-prev],[data-carousel-next],[data-send-home-id],[data-send-home]'
        )
      ) return;

      event.preventDefault();
      event.stopImmediatePropagation();

      const listing =
        state.listings.get(realListing.dataset.realListing);

      if (listing) openRealListingDetail(listing);
      return;
    }

    const realUser = event.target.closest('[data-real-user]');
    if (realUser) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const profile = state.profiles.get(realUser.dataset.realUser);
      if (profile) openRealUser(profile);
      return;
    }

    if (event.target.closest('[data-open-real-publish]')) {
      event.preventDefault();
      event.stopImmediatePropagation();

      state.communityPublishTarget = null;

      showModal(
        document.querySelector('#publishModal')
      );

      return;
    }

    const publishChoice = event.target.closest('[data-publish-type]');
    if (publishChoice) {
      state.publishType = null;
      state.publishDraft = { steps: {}, files: [] };
    }

    const publishContinue = event.target.closest('#publishFlowContinue');
    if (publishContinue) {
      const snapshot = capturePublishStep();
      const finalAction = /Publicar|Compartir/.test(publishContinue.textContent);
      if (snapshot && snapshot.step === 0 && ['room', 'apartment'].includes(snapshot.type) && (!snapshot.values[0] || !snapshot.values[1])) {
        event.preventDefault();
        event.stopImmediatePropagation();
        notify('Añade la zona y el precio para continuar');
        return;
      }
      if (finalAction && snapshot) {
        event.preventDefault();
        event.stopImmediatePropagation();
        publishRealContent(snapshot.type);
        return;
      }
    }

    if (event.target.closest('#openNotifications')) loadRealNotifications();
    if (event.target.closest('#openChats')) loadRealInbox();

    const realChat = event.target.closest('[data-real-chat]');
    if (realChat) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const profile = state.profiles.get(realChat.dataset.realChat);
      if (profile) openRealConversation(profile);
      return;
    }

    const realNotification = event.target.closest('[data-real-notification]');
    if (realNotification) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const kind = realNotification.dataset.realNotification;
      const profile = state.profiles.get(realNotification.dataset.userId);
      if (kind === 'request') {
        const entry = state.incomingRequests.get(realNotification.dataset.notificationId);
        if (entry) showConnectionRequest(entry.request, entry.requester);
      } else if (profile) openRealConversation(profile);
      return;
    }

    if (event.target.closest('#markNotificationsRead')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      db.from('messages').update({ read_at: new Date().toISOString() }).eq('recipient_id', state.user.id).is('read_at', null)
        .then(() => { loadRealNotifications(); notify('Mensajes marcados como leídos'); });
      return;
    }

    const finalOnboarding = event.target.closest('#onboardingContinue');
    if (finalOnboarding && finalOnboarding.textContent.includes('Ver mi feed')) saveOnboarding();

    const ownActivity = event.target.closest('[data-own-activity]');
    if (ownActivity) {
      event.preventDefault();
      event.stopImmediatePropagation();
      refreshOwnActivity(ownActivity.dataset.ownActivity);
    }
  }, true);

  document.addEventListener('submit', event => {
    if (
      event.target.id !== 'conversationForm' ||
      !state.chatTarget
    ) {
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();

    const form =
      event.target;

    const input =
      document.querySelector(
        '#conversationInput'
      );

    const button =
      form.querySelector(
        'button[type="submit"]'
      );

    const text =
      input?.value.trim();

    if (!text) return;

    input.disabled = true;

    if (button) {
      button.disabled = true;
      button.textContent = 'Enviando…';
    }

    sendMessage(text)
      .then(() => {
        if (input) {
          input.value = '';
        }
      })
      .finally(() => {
        if (input) {
          input.disabled = false;
          input.focus();
        }

        if (button) {
          button.disabled = false;
          button.textContent = 'Enviar';
        }
      });
  }, true);

  injectAuthGate();

  db.auth.onAuthStateChange((event, session) => {
    if (session) startSession(session);
    else if (event === 'SIGNED_OUT') endSession();
  });

  db.auth.getSession().then(({ data }) => {
    if (data.session) startSession(data.session);
  });
  function ensureProfileEditorModal() {
    let modal = document.querySelector('#profileEditorModal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'profileEditorModal';
    modal.setAttribute('aria-hidden', 'true');

    modal.innerHTML = `
      <div class="backdrop" data-close-profile-editor></div>
      <article class="detail profile-editor-shell">
        <header>
          <div>
            <small>TU PERFIL</small>
            <h2>Editar perfil</h2>
            <p>Estos datos forman parte de tu perfil visible en Rooms.</p>
          </div>
          <button type="button" data-close-profile-editor aria-label="Cerrar">×</button>
        </header>

        <form id="profileEditorForm">
          <div class="profile-editor-grid">
            <label>
              Nombre o alias
              <input id="editProfileName" type="text" maxlength="40" required>
            </label>

            <label>
              Edad
              <input id="editProfileAge" type="number" min="18" max="99">
            </label>
          </div>

          <label>
            Sobre mí
            <textarea id="editProfileBio" rows="5" maxlength="500"></textarea>
          </label>

          <fieldset class="profile-editor-interests">
            <legend>Intereses</legend>
            <div>
              <button type="button" data-edit-interest="sport">Deporte</button>
              <button type="button" data-edit-interest="music">Música</button>
              <button type="button" data-edit-interest="cooking">Cocina</button>
              <button type="button" data-edit-interest="travel">Viajes</button>
              <button type="button" data-edit-interest="gym">Gym</button>
              <button type="button" data-edit-interest="gaming">Gaming</button>
              <button type="button" data-edit-interest="reading">Lectura</button>
              <button type="button" data-edit-interest="going-out">Salir</button>
              <button type="button" data-edit-interest="quiet-plans">Planes tranquilos</button>
              <button type="button" data-edit-interest="pets">Mascotas</button>
            </div>
          </fieldset>

          <button class="cta" type="submit">Guardar cambios</button>
        </form>
      </article>
    `;

    document.body.appendChild(modal);

    modal.querySelectorAll('[data-edit-interest]').forEach(button => {
      button.addEventListener('click', () => {
        button.classList.toggle('active');
        button.setAttribute(
          'aria-pressed',
          button.classList.contains('active') ? 'true' : 'false'
        );
      });
    });

    modal.querySelector('#profileEditorForm').addEventListener('submit', async event => {
      event.preventDefault();

      const name = modal.querySelector('#editProfileName').value.trim();
      const ageValue = modal.querySelector('#editProfileAge').value;
      const bio = modal.querySelector('#editProfileBio').value.trim();

      const interests = [...modal.querySelectorAll('[data-edit-interest].active')]
        .map(button => button.dataset.editInterest);

      const { data, error } = await db
        .from('profiles')
        .update({
          name,
          alias: name,
          age: ageValue ? Number(ageValue) : null,
          bio,
          interests
        })
        .eq('id', state.user.id)
        .select()
        .single();

      if (error) {
        console.error('Rooms: error actualizando perfil', error);
        notify('No se pudo actualizar tu perfil');
        return;
      }

      state.profile = data;
      state.profiles.set(data.id, data);
      updateOwnProfile(state.profile, state.preferences);

      modal.classList.remove('open');
      modal.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';

      notify('Perfil actualizado');
    });

    return modal;
  }

  function openProfileEditor() {
    if (!state.profile) return;

    const modal = ensureProfileEditorModal();

    modal.querySelector('#editProfileName').value =
      state.profile.alias || state.profile.name || '';

    modal.querySelector('#editProfileAge').value =
      state.profile.age || '';

    modal.querySelector('#editProfileBio').value =
      state.profile.bio || '';

    const interests = new Set(state.profile.interests || []);

    modal.querySelectorAll('[data-edit-interest]').forEach(button => {
      const active = interests.has(button.dataset.editInterest);
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });

    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  document.addEventListener('click', event => {
    if (event.target.closest('#editOwnProfile')) {
      openProfileEditor();
      return;
    }

    if (event.target.closest('[data-close-profile-editor]')) {
      const modal = document.querySelector('#profileEditorModal');
      if (modal) {
        modal.classList.remove('open');
        modal.setAttribute('aria-hidden', 'true');
      }
      document.body.style.overflow = '';
    }
  });


  async function uploadProfilePhoto(file) {
    if (!file || !state.user) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      notify('Usa una imagen JPG, PNG o WEBP');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      notify('La foto debe pesar menos de 5 MB');
      return;
    }

    const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const path = `${state.user.id}/avatar.${extension}`;

    const { error: uploadError } = await db.storage
      .from('avatars')
      .upload(path, file, {
        upsert: true,
        contentType: file.type
      });

    if (uploadError) {
      console.error('Rooms: error subiendo avatar', uploadError);
      notify('No se pudo subir la foto');
      return;
    }

    const { data: publicData } = db.storage
      .from('avatars')
      .getPublicUrl(path);

    const avatarUrl = `${publicData.publicUrl}?v=${Date.now()}`;

    const { data, error } = await db
      .from('profiles')
      .update({ avatar_url: avatarUrl })
      .eq('id', state.user.id)
      .select()
      .single();

    if (error) {
      console.error('Rooms: error guardando avatar', error);
      notify('No se pudo actualizar tu perfil');
      return;
    }

    state.profile = data;
    state.profiles.set(data.id, data);
    updateOwnProfile(state.profile, state.preferences);
    notify('Foto de perfil actualizada');
  }

  document.addEventListener('click', event => {
    if (event.target.closest('#changeProfilePhoto')) {
      document.querySelector('#profilePhotoInput')?.click();
    }
  });

  document.querySelector('#profilePhotoInput')?.addEventListener('change', event => {
    const file = event.target.files?.[0];
    if (file) uploadProfilePhoto(file);
    event.target.value = '';
  });


  function ensureLivingEditorModal() {
    let modal = document.querySelector('#livingEditorModal');
    if (modal) return modal;

    const groups = [
      ['Limpieza', ['Muy ordenado', 'Normal', 'Flexible']],
      ['Horarios', ['Madrugador', 'Horario normal', 'Nocturno']],
      ['Ruido', ['Muy tranquilo', 'Algo de ambiente', 'Me adapto']],
      ['Visitas', ['Pocas', 'Con aviso', 'Sin problema']],
      ['Fiestas en casa', ['Nunca', 'Alguna vez', 'Me da igual']],
      ['Teletrabajo / estudio', ['Mucho', 'A veces', 'Casi nunca']],
      ['Fumar', ['No', 'Solo fuera', 'Me da igual']],
      ['Mascotas', ['Me encantan', 'Me da igual', 'Prefiero no']]
    ];

    modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'livingEditorModal';
    modal.setAttribute('aria-hidden', 'true');

    modal.innerHTML = `
      <div class="backdrop" data-close-living-editor></div>
      <article class="detail living-editor-shell">
        <header>
          <div>
            <small>CONVIVENCIA</small>
            <h2>Cómo vivo</h2>
            <p>Estas respuestas ayudan a calcular la compatibilidad con otras personas.</p>
          </div>
          <button type="button" data-close-living-editor aria-label="Cerrar">×</button>
        </header>

        <form id="livingEditorForm">
          <div class="living-editor-groups">
            ${groups.map((group, index) => `
              <section class="living-editor-group" data-living-editor-group="${index}">
                <small>${group[0]}</small>
                <div>
                  ${group[1].map((option, optionIndex) => `
                    <button
                      type="button"
                      data-living-editor-choice="${index}:${optionIndex}"
                      aria-pressed="false">
                      ${option}
                    </button>
                  `).join('')}
                </div>
              </section>
            `).join('')}
          </div>

          <button class="cta" type="submit">Guardar cambios</button>
        </form>
      </article>
    `;

    document.body.appendChild(modal);

    modal.querySelectorAll('[data-living-editor-choice]').forEach(button => {
      button.addEventListener('click', () => {
        const [category] = button.dataset.livingEditorChoice.split(':');

        modal
          .querySelectorAll(`[data-living-editor-choice^="${category}:"]`)
          .forEach(item => {
            item.classList.toggle('active', item === button);
            item.setAttribute('aria-pressed', item === button ? 'true' : 'false');
          });
      });
    });

    modal.querySelector('#livingEditorForm').addEventListener('submit', async event => {
      event.preventDefault();

      const living = {};

      modal.querySelectorAll('[data-living-editor-choice].active').forEach(button => {
        const [category, option] = button.dataset.livingEditorChoice.split(':');
        living[category] = {
          ...(state.preferences?.answers?.living?.[category] || {}),
          option: Number(option)
        };
      });

      const answers = {
        ...(state.preferences?.answers || {}),
        living
      };

      const { error } = await db
        .from('onboarding_preferences')
        .upsert({
          user_id: state.user.id,
          answers
        });

      if (error) {
        console.error('Rooms: error actualizando convivencia', error);
        notify('No se pudieron guardar tus hábitos');
        return;
      }

      state.preferences = { answers };
      updateOwnProfile(state.profile, state.preferences);

      modal.classList.remove('open');
      modal.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';

      notify('Hábitos de convivencia actualizados');
    });

    return modal;
  }

  function openLivingEditor() {
    if (!state.user) return;

    const modal = ensureLivingEditorModal();
    const living = state.preferences?.answers?.living || {};

    modal.querySelectorAll('[data-living-editor-choice]').forEach(button => {
      const [category, option] = button.dataset.livingEditorChoice.split(':');
      const active = Number(living?.[category]?.option) === Number(option);

      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });

    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  document.addEventListener('click', event => {
    const livingEdit = event.target.closest('#ownProfileView .own-profile-content > section:nth-child(2) .manage-section-title button');

    if (livingEdit) {
      event.preventDefault();
      openLivingEditor();
      return;
    }

    if (event.target.closest('[data-close-living-editor]')) {
      const modal = document.querySelector('#livingEditorModal');
      if (modal) {
        modal.classList.remove('open');
        modal.setAttribute('aria-hidden', 'true');
      }
      document.body.style.overflow = '';
    }
  });


  function ensureSearchPreferencesModal() {
    let modal = document.querySelector('#searchPreferencesModal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'searchPreferencesModal';
    modal.setAttribute('aria-hidden', 'true');

    modal.innerHTML = `
      <div class="backdrop" data-close-search-preferences></div>

      <article class="detail search-preferences-shell">
        <header>
          <div>
            <small>TU BÚSQUEDA</small>
            <h2>Qué busco</h2>
            <p>Rooms utiliza estos datos para enseñarte viviendas y personas que realmente encajan contigo.</p>
          </div>
          <button type="button" data-close-search-preferences aria-label="Cerrar">×</button>
        </header>

        <form id="searchPreferencesForm">

          <section class="search-editor-section">
            <small>¿QUÉ BUSCAS?</small>
            <div class="search-editor-options">
              <button type="button" data-search-seeking="room">Habitación</button>
              <button type="button" data-search-seeking="home">Piso entero</button>
              <button type="button" data-search-seeking="mates">Compañeros</button>
            </div>
          </section>

          <section class="search-editor-section">
            <label>
              Zonas
              <input id="searchZones" type="text" placeholder="Chamberí, Moncloa, Retiro">
              <small>Separa varias zonas con comas.</small>
            </label>
          </section>

          <section class="search-editor-section">
            <small>PRESUPUESTO MENSUAL</small>

            <div class="search-budget-grid">
              <label>
                Mínimo
                <input id="searchBudgetMin" type="number" min="0" step="50" placeholder="600">
              </label>

              <label>
                Máximo
                <input id="searchBudgetMax" type="number" min="0" step="50" placeholder="1000">
              </label>
            </div>

            <label class="search-over-budget">
              <input id="searchBudgetOpen" type="checkbox">
              Estoy abierto/a a más de 4.000 €
            </label>
          </section>

          <section class="search-editor-section">
            <small>ENTRADA</small>

            <div class="search-date-grid">
              <label>
                Fecha
                <input id="searchMoveDate" type="date">
              </label>

              <label class="search-flexible">
                <input id="searchMoveFlexible" type="checkbox">
                Soy flexible
              </label>
            </div>
          </section>

          <section class="search-editor-section">
            <small>DURACIÓN</small>

            <div class="search-editor-options search-duration-options">
              <button type="button" data-search-duration="1-3">1–3 meses</button>
              <button type="button" data-search-duration="3-6">3–6 meses</button>
              <button type="button" data-search-duration="6-12">6–12 meses</button>
              <button type="button" data-search-duration="12+">Más de 1 año</button>
              <button type="button" data-search-duration="unknown">No lo sé</button>
            </div>
          </section>

          <button class="cta" type="submit">Guardar búsqueda</button>
        </form>
      </article>
    `;

    document.body.appendChild(modal);

    modal.querySelectorAll('[data-search-seeking]').forEach(button => {
      button.addEventListener('click', () => {
        button.classList.toggle('active');
        button.setAttribute(
          'aria-pressed',
          button.classList.contains('active') ? 'true' : 'false'
        );
      });
    });

    modal.querySelectorAll('[data-search-duration]').forEach(button => {
      button.addEventListener('click', () => {
        modal.querySelectorAll('[data-search-duration]').forEach(item => {
          item.classList.toggle('active', item === button);
          item.setAttribute('aria-pressed', item === button ? 'true' : 'false');
        });
      });
    });

    modal.querySelector('#searchPreferencesForm').addEventListener('submit', async event => {
      event.preventDefault();

      const seeking = [...modal.querySelectorAll('[data-search-seeking].active')]
        .map(button => button.dataset.searchSeeking);

      if (!seeking.length) {
        notify('Selecciona al menos qué estás buscando');
        return;
      }

      const zones = modal.querySelector('#searchZones').value
        .split(',')
        .map(value => value.trim())
        .filter(Boolean);

      const budgetMinValue = modal.querySelector('#searchBudgetMin').value;
      const budgetMaxValue = modal.querySelector('#searchBudgetMax').value;
      const over4000 = modal.querySelector('#searchBudgetOpen').checked;

      const budgetMin = budgetMinValue ? Number(budgetMinValue) : null;
      const budgetMax = over4000
        ? null
        : budgetMaxValue
          ? Number(budgetMaxValue)
          : null;

      if (budgetMin && budgetMax && budgetMin > budgetMax) {
        notify('El presupuesto mínimo no puede superar el máximo');
        return;
      }

      const moveDate = modal.querySelector('#searchMoveDate').value || null;
      const flexible = modal.querySelector('#searchMoveFlexible').checked;

      const duration =
        modal.querySelector('[data-search-duration].active')?.dataset.searchDuration
        || null;

      const answers = {
        ...(state.preferences?.answers || {}),
        seeking,
        zones,
        budget: {
          ...(state.preferences?.answers?.budget || {}),
          min: budgetMin,
          max: budgetMax,
          over4000
        },
        move: {
          ...(state.preferences?.answers?.move || {}),
          date: moveDate,
          flexible,
          duration
        }
      };

      const [profileResult, preferencesResult] = await Promise.all([
        db.from('profiles')
          .update({
            seeking,
            zones,
            budget_min: budgetMin,
            budget_max: budgetMax,
            move_in_date: moveDate,
            duration
          })
          .eq('id', state.user.id)
          .select()
          .single(),

        db.from('onboarding_preferences')
          .upsert({
            user_id: state.user.id,
            answers
          })
      ]);

      if (profileResult.error || preferencesResult.error) {
        console.error(
          'Rooms: error actualizando búsqueda',
          profileResult.error,
          preferencesResult.error
        );
        notify('No se pudo actualizar tu búsqueda');
        return;
      }

      state.profile = profileResult.data;
      state.preferences = { answers };

      state.profiles.set(state.profile.id, state.profile);
      updateOwnProfile(state.profile, state.preferences);

      modal.classList.remove('open');
      modal.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';

      notify('Tu búsqueda se ha actualizado');
    });

    return modal;
  }

  function openSearchPreferencesEditor() {
    if (!state.profile) return;

    const modal = ensureSearchPreferencesModal();

    const seeking = new Set(state.profile.seeking || []);

    modal.querySelectorAll('[data-search-seeking]').forEach(button => {
      const active = seeking.has(button.dataset.searchSeeking);
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });

    modal.querySelector('#searchZones').value =
      (state.profile.zones || []).join(', ');

    modal.querySelector('#searchBudgetMin').value =
      state.profile.budget_min ?? '';

    modal.querySelector('#searchBudgetMax').value =
      state.profile.budget_max ?? '';

    modal.querySelector('#searchBudgetOpen').checked =
      Boolean(state.preferences?.answers?.budget?.over4000);

    modal.querySelector('#searchMoveDate').value =
      state.profile.move_in_date || '';

    modal.querySelector('#searchMoveFlexible').checked =
      Boolean(state.preferences?.answers?.move?.flexible);

    modal.querySelectorAll('[data-search-duration]').forEach(button => {
      const active = button.dataset.searchDuration === state.profile.duration;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });

    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  document.addEventListener('click', event => {
    const searchEdit = event.target.closest(
      '#ownProfileView .own-profile-content > section:nth-child(3) .manage-section-title button'
    );

    if (searchEdit) {
      event.preventDefault();
      openSearchPreferencesEditor();
      return;
    }

    if (event.target.closest('[data-close-search-preferences]')) {
      const modal = document.querySelector('#searchPreferencesModal');

      if (modal) {
        modal.classList.remove('open');
        modal.setAttribute('aria-hidden', 'true');
      }

      document.body.style.overflow = '';
    }
  });


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
      state.user?.email_confirmed_at ? 'VERIFICADO ✓' : 'PERFIL';

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

    const living = answers.living || {};
    const livingRows = Object.entries(living)
      .map(([index, value]) => {
        const category = Number(index);
        const label = livingNames[category];
        const option = livingOptions[category]?.[value.option];

        if (!label || !option) return '';

        return `
          <span>
            <small>${escapeHtml(label)}</small>
            <b>${escapeHtml(option)}</b>
          </span>
        `;
      })
      .filter(Boolean);

    modal.querySelector('#ownPublicLiving').innerHTML =
      livingRows.length
        ? livingRows.join('')
        : '<span><small>CONVIVENCIA</small><b>Sin datos añadidos</b></span>';

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


  function ensureHomePreferencesModal() {
    let modal = document.querySelector('#homePreferencesModal');
    if (modal) return modal;

    const features = [
      'Amueblado',
      'Exterior',
      'Buena luz',
      'Terraza',
      'Ascensor',
      'Mascotas',
      'Cerca del metro',
      'Zona tranquila',
      'Teletrabajo',
      'Baño privado',
      'Aire acondicionado',
      'Almacenamiento'
    ];

    modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'homePreferencesModal';
    modal.setAttribute('aria-hidden', 'true');

    modal.innerHTML = `
      <div class="backdrop" data-close-home-preferences></div>

      <article class="detail home-preferences-shell">
        <header>
          <div>
            <small>PREFERENCIAS</small>
            <h2>Tu vivienda ideal</h2>
            <p>Selecciona lo que valoras. Rooms lo usará para ordenar mejor tus recomendaciones.</p>
          </div>
          <button type="button" data-close-home-preferences aria-label="Cerrar">×</button>
        </header>

        <form id="homePreferencesForm">
          <div class="home-preferences-grid">
            ${features.map(feature => `
              <button
                type="button"
                data-home-preference="${feature}"
                aria-pressed="false">
                <span>${feature}</span>
                <i>＋</i>
              </button>
            `).join('')}
          </div>

          <div class="home-preferences-footer">
            <small>Puedes cambiar estas preferencias cuando quieras.</small>
            <button class="cta" type="submit">Guardar preferencias</button>
          </div>
        </form>
      </article>
    `;

    document.body.appendChild(modal);

    modal.querySelectorAll('[data-home-preference]').forEach(button => {
      button.addEventListener('click', () => {
        const active = !button.classList.contains('active');

        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', active ? 'true' : 'false');

        const icon = button.querySelector('i');
        if (icon) icon.textContent = active ? '✓' : '＋';
      });
    });

    modal.querySelector('#homePreferencesForm').addEventListener('submit', async event => {
      event.preventDefault();

      const homeFeatures = [...modal.querySelectorAll('[data-home-preference].active')]
        .map(button => button.dataset.homePreference);

      const answers = {
        ...(state.preferences?.answers || {}),
        homeFeatures
      };

      const { error } = await db
        .from('onboarding_preferences')
        .upsert({
          user_id: state.user.id,
          answers
        });

      if (error) {
        console.error('Rooms: error actualizando preferencias', error);
        notify('No se pudieron guardar tus preferencias');
        return;
      }

      state.preferences = {
        ...(state.preferences || {}),
        answers
      };

      modal.classList.remove('open');
      modal.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';

      notify('Preferencias actualizadas');
    });

    return modal;
  }

  function openHomePreferencesEditor() {
    if (!state.user) return;

    const modal = ensureHomePreferencesModal();
    const selected = new Set(
      state.preferences?.answers?.homeFeatures || []
    );

    modal.querySelectorAll('[data-home-preference]').forEach(button => {
      const active = selected.has(button.dataset.homePreference);

      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');

      const icon = button.querySelector('i');
      if (icon) icon.textContent = active ? '✓' : '＋';
    });

    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  document.addEventListener('click', event => {
    if (event.target.closest('#editHomePreferences')) {
      openHomePreferencesEditor();
      return;
    }

    if (event.target.closest('[data-close-home-preferences]')) {
      const modal = document.querySelector('#homePreferencesModal');

      if (modal) {
        modal.classList.remove('open');
        modal.setAttribute('aria-hidden', 'true');
      }

      document.body.style.overflow = '';
    }
  });


  document.addEventListener('click', event => {
    if (!event.target.closest('#trustRecommendations')) return;

    const trustView = document.querySelector('#trustView');
    const profileView = document.querySelector('#ownProfileView');

    if (trustView) trustView.hidden = true;
    if (profileView) profileView.hidden = false;

    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  });


  function renderProfilePrivacySettings() {
    const privacy = state.preferences?.answers?.privacy || {};
    const level = privacy.level || 'balanced';
    const controls = privacy.controls || {};

    document.querySelectorAll('[data-profile-privacy-level]').forEach(button => {
      const active = button.dataset.profilePrivacyLevel === level;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });

    document.querySelectorAll('[data-profile-privacy-row]').forEach(row => {
      const key = row.dataset.profilePrivacyRow;
      const value = controls[key] || 'public';

      row.querySelectorAll('[data-privacy-value]').forEach(button => {
        const active = button.dataset.privacyValue === value;
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
    });
  }

  document.addEventListener('click', event => {
    const levelButton = event.target.closest('[data-profile-privacy-level]');
    if (levelButton) {
      document.querySelectorAll('[data-profile-privacy-level]').forEach(button => {
        button.classList.toggle('active', button === levelButton);
        button.setAttribute(
          'aria-pressed',
          button === levelButton ? 'true' : 'false'
        );
      });
      return;
    }

    const privacyButton = event.target.closest('[data-profile-privacy-row] [data-privacy-value]');
    if (privacyButton) {
      const row = privacyButton.closest('[data-profile-privacy-row]');

      row.querySelectorAll('[data-privacy-value]').forEach(button => {
        button.classList.toggle('active', button === privacyButton);
        button.setAttribute(
          'aria-pressed',
          button === privacyButton ? 'true' : 'false'
        );
      });
      return;
    }

    if (event.target.closest('#saveProfilePrivacy')) {
      const level =
        document.querySelector('[data-profile-privacy-level].active')
          ?.dataset.profilePrivacyLevel || 'balanced';

      const controls = {};

      document.querySelectorAll('[data-profile-privacy-row]').forEach(row => {
        const key = row.dataset.profilePrivacyRow;
        const value =
          row.querySelector('[data-privacy-value].active')
            ?.dataset.privacyValue || 'public';

        controls[key] = value;
      });

      const answers = {
        ...(state.preferences?.answers || {}),
        privacy: {
          ...(state.preferences?.answers?.privacy || {}),
          level,
          controls
        }
      };

      db.from('onboarding_preferences')
        .upsert({
          user_id: state.user.id,
          answers
        })
        .then(({ error }) => {
          if (error) {
            console.error('Rooms: error guardando privacidad', error);
            notify('No se pudo guardar tu privacidad');
            return;
          }

          state.preferences = {
            ...(state.preferences || {}),
            answers
          };

          notify('Privacidad actualizada');
        });
    }
  });

  const originalOpenSettings = window.openSettings;
  if (typeof originalOpenSettings === 'function') {
    window.openSettings = (...args) => {
      const result = originalOpenSettings(...args);
      setTimeout(renderProfilePrivacySettings, 0);
      return result;
    };
  }

  setTimeout(renderProfilePrivacySettings, 0);


  function renderAccountSettings() {
    const email = state.user?.email || 'Sin email';
    const emailNode = document.querySelector('#settingsAccountEmail');

    if (emailNode) {
      emailNode.textContent = email;
    }
  }

  async function requestPasswordChange() {
    const email = state.user?.email;

    if (!email) {
      notify('No encontramos el email de tu cuenta');
      return;
    }

    const { error } = await db.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin
    });

    if (error) {
      console.error('Rooms: error enviando cambio de contraseña', error);
      notify('No se pudo enviar el email');
      return;
    }

    notify('Te hemos enviado un email para cambiar tu contraseña');
  }

  async function logoutFromRooms() {
    const { error } = await db.auth.signOut();

    if (error) {
      console.error('Rooms: error cerrando sesión', error);
      notify('No se pudo cerrar la sesión');
      return;
    }

    notify('Sesión cerrada');
  }

  document.addEventListener('click', event => {
    if (event.target.closest('#changePassword')) {
      requestPasswordChange();
      return;
    }

    if (event.target.closest('#realLogoutButton')) {
      logoutFromRooms();
    }
  });

  renderAccountSettings();


  function ensureLanguageModal() {
    let modal = document.querySelector('#languageModal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'languageModal';
    modal.setAttribute('aria-hidden', 'true');

    modal.innerHTML = `
      <div class="backdrop" data-close-language></div>
      <article class="detail language-modal-shell">
        <header>
          <div>
            <small>IDIOMA</small>
            <h2>Idioma de Rooms</h2>
            <p>Selecciona el idioma que prefieres usar.</p>
          </div>
          <button type="button" data-close-language aria-label="Cerrar">×</button>
        </header>

        <div class="language-options">
          <button type="button" data-language-option="es">
            <span>Español</span>
            <i></i>
          </button>

          <button type="button" data-language-option="en">
            <span>English</span>
            <i></i>
          </button>
        </div>
      </article>
    `;

    document.body.appendChild(modal);
    return modal;
  }

  function renderLanguageSetting() {
    const language = state.preferences?.answers?.language || 'es';
    const label = language === 'en' ? 'English' : 'Español';

    const node = document.querySelector('#settingsLanguage');
    if (node) node.textContent = label;
  }

  async function saveLanguage(language) {
    const answers = {
      ...(state.preferences?.answers || {}),
      language
    };

    const { error } = await db
      .from('onboarding_preferences')
      .upsert({
        user_id: state.user.id,
        answers
      });

    if (error) {
      console.error('Rooms: error guardando idioma', error);
      notify('No se pudo guardar el idioma');
      return;
    }

    state.preferences = {
      ...(state.preferences || {}),
      answers
    };

    renderLanguageSetting();

    const modal = document.querySelector('#languageModal');
    if (modal) {
      modal.classList.remove('open');
      modal.setAttribute('aria-hidden', 'true');
    }

    document.body.style.overflow = '';

    notify(language === 'en' ? 'Language updated' : 'Idioma actualizado');
  }

  document.addEventListener('click', event => {
    if (event.target.closest('#changeLanguage')) {
      const modal = ensureLanguageModal();
      const current = state.preferences?.answers?.language || 'es';

      modal.querySelectorAll('[data-language-option]').forEach(button => {
        const active = button.dataset.languageOption === current;
        button.classList.toggle('active', active);

        const icon = button.querySelector('i');
        if (icon) icon.textContent = active ? '✓' : '';
      });

      modal.classList.add('open');
      modal.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      return;
    }

    const languageButton = event.target.closest('[data-language-option]');
    if (languageButton) {
      saveLanguage(languageButton.dataset.languageOption);
      return;
    }

    if (event.target.closest('[data-close-language]')) {
      const modal = document.querySelector('#languageModal');
      if (modal) {
        modal.classList.remove('open');
        modal.setAttribute('aria-hidden', 'true');
      }
      document.body.style.overflow = '';
    }
  });

  renderLanguageSetting();


  function renderContactSettings() {
    const contact = state.preferences?.answers?.contact || {
      connections: 'anyone',
      listingContact: 'request'
    };

    document.querySelectorAll('[data-contact-group]').forEach(group => {
      const key = group.dataset.contactGroup;
      const selected = contact[key];

      group.querySelectorAll('[data-contact-value]').forEach(button => {
        const active = button.dataset.contactValue === selected;
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
    });
  }

  document.addEventListener('click', event => {
    const option = event.target.closest(
      '[data-contact-group] [data-contact-value]'
    );

    if (option) {
      const group = option.closest('[data-contact-group]');

      group.querySelectorAll('[data-contact-value]').forEach(button => {
        const active = button === option;
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', active ? 'true' : 'false');
      });

      return;
    }

    if (event.target.closest('#saveContactSettings')) {
      const contact = {};

      document.querySelectorAll('[data-contact-group]').forEach(group => {
        const key = group.dataset.contactGroup;
        const selected = group.querySelector('[data-contact-value].active');

        contact[key] = selected?.dataset.contactValue || null;
      });

      const answers = {
        ...(state.preferences?.answers || {}),
        contact
      };

      db.from('onboarding_preferences')
        .upsert({
          user_id: state.user.id,
          answers
        })
        .then(({ error }) => {
          if (error) {
            console.error('Rooms: error guardando contacto', error);
            notify('No se pudo guardar la configuración de contacto');
            return;
          }

          state.preferences = {
            ...(state.preferences || {}),
            answers
          };

          notify('Preferencias de contacto actualizadas');
        });
    }
  });

  setTimeout(renderContactSettings, 0);


  function sortExploreListings(listings) {
    const mode = document.querySelector('#exploreSort')?.value || 'recent';
    const result = [...listings];

    if (mode === 'price') {
      result.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
    } else {
      result.sort((a, b) => {
        const aDate = new Date(a.created_at || 0).getTime();
        const bDate = new Date(b.created_at || 0).getTime();
        return bDate - aDate;
      });
    }

    return result;
  }

  document.addEventListener('change', event => {
    if (event.target?.id !== 'exploreSort') return;
    renderFilteredExplore();
  });


  document.addEventListener('click', event => {
    const pin = event.target.closest('[data-real-map-pin]');

    if (pin) {
      event.preventDefault();

      document.querySelectorAll('[data-real-map-pin]').forEach(item => {
        item.classList.toggle('active', item === pin);
      });

      const listing = state.listings.get(pin.dataset.realMapPin);

      if (!listing) return;

      const card = document.querySelector('#realMapCard');
      if (card) {
        card.innerHTML = renderRealMapCard(listing);
      }

      return;
    }

    const openButton = event.target.closest('[data-real-map-open]');

    if (openButton) {
      event.preventDefault();

      const listing = state.listings.get(openButton.dataset.realMapOpen);

      if (!listing) return;

      const matchingCard = document.querySelector(
        `[data-real-listing="${listing.id}"]`
      );

      if (matchingCard) {
        matchingCard.click();
      }
    }
  });


  const exploreFiltersState = {
    zones: [],
    features: [],
    minPrice: null,
    maxPrice: null,
    kind: '',
    date: '',
    duration: '',
    rooms: null
  };

  function normalizeExploreValue(value) {
    return String(value || '')
      .trim()
      .toLocaleLowerCase('es')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  function readExploreFiltersFromModal() {
    return {
      zones: [...document.querySelectorAll('[data-explore-zone][aria-pressed="true"]')]
        .map(button => button.dataset.exploreZone),

      features: [...document.querySelectorAll('[data-explore-feature][aria-pressed="true"]')]
        .map(button => button.dataset.exploreFeature),

      minPrice: Number(document.querySelector('#exploreBudgetMin')?.value) || null,
      maxPrice: Number(document.querySelector('#exploreBudgetMax')?.value) || null,

      kind: document.querySelector('#exploreTypeFilter')?.value || '',
      date: document.querySelector('#exploreDateFilter')?.value || '',
      duration: document.querySelector('#exploreDurationFilter')?.value || '',

      rooms: Number(document.querySelector('#exploreRoomsFilter')?.value) || null
    };
  }

  function listingMatchesExploreFilters(listing, filters) {
    const listingZone = normalizeExploreValue(listing.zone);

    if (filters.zones.length) {
      const matchesZone = filters.zones.some(zone =>
        listingZone.includes(normalizeExploreValue(zone))
      );

      if (!matchesZone) return false;
    }

    const price = Number(listing.price || 0);

    if (filters.minPrice !== null && price < filters.minPrice) {
      return false;
    }

    if (filters.maxPrice !== null && price > filters.maxPrice) {
      return false;
    }

    if (filters.kind && listing.kind !== filters.kind) {
      return false;
    }

    if (filters.date) {
      if (!listing.available_from) return false;

      const available = new Date(`${listing.available_from}T00:00:00`);
      const wanted = new Date(`${filters.date}T00:00:00`);

      if (available > wanted) return false;
    }

    if (filters.duration) {
      if (
        normalizeExploreValue(listing.duration) !==
        normalizeExploreValue(filters.duration)
      ) {
        return false;
      }
    }

    if (
      filters.rooms !== null &&
      Number(listing.rooms || 0) < filters.rooms
    ) {
      return false;
    }

    if (filters.features.length) {
      const listingFeatures = (listing.features || [])
        .map(normalizeExploreValue);

      const matchesAllFeatures = filters.features.every(feature =>
        listingFeatures.includes(normalizeExploreValue(feature))
      );

      if (!matchesAllFeatures) return false;
    }

    return true;
  }

  function getExploreResults(filters = exploreFiltersState) {
    let listings = [...state.listings.values()];

    listings = listings.filter(listing =>
      listingMatchesExploreFilters(listing, filters)
    );

    const query = normalizeExploreValue(
      document.querySelector('#exploreSearch')?.value
    );

    if (query) {
      listings = listings.filter(listing => {
        const haystack = normalizeExploreValue([
          listing.zone,
          listing.title,
          listing.description,
          ...(listing.features || [])
        ].join(' '));

        return haystack.includes(query);
      });
    }

    return sortExploreListings(listings);
  }

  function renderFilteredExplore() {
    const mode =
      document.querySelector('[data-explore-mode].active')
        ?.dataset.exploreMode || 'homes';

    const list = document.querySelector('#exploreList');
    const map = document.querySelector('#exploreMap');
    const empty = document.querySelector('#exploreEmpty');

    if (mode === 'people') {
      const profiles = getExplorePeople();

      if (list) list.hidden = false;
      if (map) map.hidden = true;
      if (empty) empty.hidden = true;

      renderExplorePeople(profiles);
      updateConnectButtons();
      return;
    }

    if (mode === 'communities') {
      const communities =
        getExploreCommunities();

      if (list) list.hidden = false;
      if (map) map.hidden = true;
      if (empty) empty.hidden = true;

      renderExploreCommunities(communities);
      return;
    }

    const listings = getExploreResults();

    renderRealExplore(listings);

    const mapActive =
      document.querySelector('[data-explore-view="map"]')
        ?.classList.contains('active');

    if (list) list.hidden = Boolean(mapActive);
    if (map) map.hidden = !mapActive;

    if (empty) {
      empty.hidden = listings.length !== 0;
    }

    const filterCount =
      document.querySelector('#exploreFilterCount');

    const activeCount =
      exploreFiltersState.zones.length +
      exploreFiltersState.features.length +
      Number(exploreFiltersState.minPrice !== null) +
      Number(exploreFiltersState.maxPrice !== null) +
      Number(Boolean(exploreFiltersState.kind)) +
      Number(Boolean(exploreFiltersState.date)) +
      Number(Boolean(exploreFiltersState.duration)) +
      Number(exploreFiltersState.rooms !== null);

    if (filterCount) {
      filterCount.textContent = activeCount;
      filterCount.hidden = activeCount === 0;
    }
  }

  function updateExploreFilterPreview() {
    const preview = readExploreFiltersFromModal();
    const listings = [...state.listings.values()]
      .filter(listing => listingMatchesExploreFilters(listing, preview));

    const button = document.querySelector('#applyExploreFilters');

    if (button) {
      button.textContent =
        `Ver ${listings.length} ${listings.length === 1 ? 'resultado' : 'resultados'}`;
    }
  }

  function resetExploreFilters() {
    exploreFiltersState.zones = [];
    exploreFiltersState.features = [];
    exploreFiltersState.minPrice = null;
    exploreFiltersState.maxPrice = null;
    exploreFiltersState.kind = '';
    exploreFiltersState.date = '';
    exploreFiltersState.duration = '';
    exploreFiltersState.rooms = null;

    document.querySelectorAll(
      '#exploreFilterModal [aria-pressed]'
    ).forEach(button => {
      button.setAttribute('aria-pressed', 'false');
    });

    [
      '#exploreBudgetMin',
      '#exploreBudgetMax',
      '#exploreDateFilter'
    ].forEach(selector => {
      const field = document.querySelector(selector);
      if (field) field.value = '';
    });

    [
      '#exploreTypeFilter',
      '#exploreDurationFilter',
      '#exploreRoomsFilter'
    ].forEach(selector => {
      const field = document.querySelector(selector);
      if (field) field.value = '';
    });

    renderFilteredExplore();
    updateExploreFilterPreview();
  }

  let realExploreSearchTimer;

  document.addEventListener('input', event => {
    if (event.target?.id === 'exploreSearch') {
      clearTimeout(realExploreSearchTimer);

      realExploreSearchTimer = setTimeout(() => {
        renderFilteredExplore();
      }, 220);

      return;
    }

    if (event.target.closest('#exploreFilterModal')) {
      updateExploreFilterPreview();
    }
  });

  document.addEventListener('change', event => {
    if (event.target.closest('#exploreFilterModal')) {
      updateExploreFilterPreview();
    }
  });

  document.addEventListener('click', event => {
    const zone = event.target.closest('[data-explore-zone]');

    if (zone) {
      const active = zone.getAttribute('aria-pressed') === 'true';
      zone.setAttribute('aria-pressed', String(!active));
      updateExploreFilterPreview();
      return;
    }

    const feature = event.target.closest('[data-explore-feature]');

    if (feature) {
      const active = feature.getAttribute('aria-pressed') === 'true';
      feature.setAttribute('aria-pressed', String(!active));
      updateExploreFilterPreview();
      return;
    }

    if (event.target.closest('#addExploreZone')) {
      const value = window.prompt('¿Qué zona quieres añadir?');

      if (!value?.trim()) return;

      const clean = value.trim();

      const exists = [...document.querySelectorAll('[data-explore-zone]')]
        .some(button =>
          normalizeExploreValue(button.dataset.exploreZone) ===
          normalizeExploreValue(clean)
        );

      if (!exists) {
        const button = document.createElement('button');

        button.type = 'button';
        button.dataset.exploreZone = clean;
        button.setAttribute('aria-pressed', 'true');
        button.textContent = clean;

        document.querySelector('#addExploreZone')
          ?.insertAdjacentElement('beforebegin', button);
      }

      updateExploreFilterPreview();
      return;
    }

    if (event.target.closest('[data-apply-explore-filters]')) {
      Object.assign(
        exploreFiltersState,
        readExploreFiltersFromModal()
      );

      renderFilteredExplore();
      hideAllModals();

      notify('Filtros aplicados');
      return;
    }

    if (event.target.closest('[data-clear-explore-filters]')) {
      resetExploreFilters();
      notify('Filtros eliminados');
    }
  });



  /* COMMUNITY COMMENT SUBMIT — REAL */
  document.addEventListener('submit', event => {
    const form =
      event.target.closest(
        '[data-community-comment-form]'
      );

    if (!form) return;

    event.preventDefault();
    event.stopPropagation();

    const input =
      form.querySelector('input');

    if (!input) return;

    const body =
      input.value.trim();

    if (!body) {
      notify('Escribe un comentario');
      return;
    }

    const postId =
      form.dataset.communityCommentForm;

    const button =
      form.querySelector('button[type="submit"]');

    if (button) {
      button.disabled = true;
      button.textContent = 'Enviando...';
    }

    createCommunityPostComment(
      postId,
      body
    ).finally(() => {
      if (button) {
        button.disabled = false;
        button.textContent = 'Enviar';
      }
    });
  }, true);


  document.addEventListener('click', async event => {
    const modeButton =
      event.target.closest('[data-explore-mode]');

    if (modeButton) {
      const mode = modeButton.dataset.exploreMode;

      document
        .querySelectorAll('[data-explore-mode]')
        .forEach(button => {
          button.classList.toggle(
            'active',
            button === modeButton
          );
        });

      const search =
        document.querySelector('#exploreSearch');

      const filters =
        document.querySelector('#exploreFilters');

      const controls =
        document.querySelector('#exploreView .explore-controls');

      if (mode === 'people') {
        if (search) {
          search.value = '';
          search.placeholder =
            'Busca personas, zonas o perfiles';
        }

        if (filters) filters.hidden = true;
        if (controls) controls.hidden = true;

      } else if (mode === 'communities') {
        if (search) {
          search.value = '';
          search.placeholder =
            'Busca comunidades';
        }

        if (filters) filters.hidden = true;
        if (controls) controls.hidden = true;

      } else {
        if (search) {
          search.value = '';
          search.placeholder =
            '¿Dónde quieres vivir?';
        }

        if (filters) filters.hidden = false;
        if (controls) controls.hidden = false;
      }

      renderFilteredExplore();
      return;
    }

    const openPerson =
      event.target.closest('[data-open-explore-person]');

    if (openPerson) {
      event.preventDefault();
      event.stopPropagation();

      const userId =
        openPerson.dataset.openExplorePerson;

      const profile =
        state.profiles.get(userId);

      if (!profile) return;

      state.targetProfile = profile;

      state.targetVisibility =
        await getProfileVisibility(profile.id);

      applyTargetProfile(profile);

      applyTargetPrivacy(
        profile,
        state.targetVisibility
      );

      await loadConnection();

      const modal =
        document.querySelector('#userProfileModal');

      if (modal) {
        modal.classList.add('open');
        modal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
      }
    }
  });


  function ensureCreateHouseholdModal() {
    let modal = document.querySelector('#createHouseholdModal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'createHouseholdModal';
    modal.setAttribute('aria-hidden', 'true');

    modal.innerHTML = `
      <div class="backdrop" data-close-create-household></div>

      <article class="detail create-household-shell">
        <header>
          <div>
            <small>NUEVO GRUPO DE BÚSQUEDA</small>
            <h2>Crea vuestro grupo de búsqueda</h2>
            <p>
              Organiza personas, viviendas y decisiones en un mismo lugar.
            </p>
          </div>

          <button
            type="button"
            data-close-create-household
            aria-label="Cerrar"
          >×</button>
        </header>

        <form id="createHouseholdForm">
          <label>
            Nombre del grupo
            <input
              id="createHouseholdName"
              type="text"
              maxlength="80"
              placeholder="Ej. Piso con Marta"
              required
            >
          </label>

          <p class="create-household-hint">
            Puedes cambiar el nombre más adelante.
          </p>

          <button type="submit" class="cta">
            Crear grupo
          </button>
        </form>
      </article>
    `;

    document.body.appendChild(modal);

    modal
      .querySelector('#createHouseholdForm')
      .addEventListener('submit', createHousehold);

    return modal;
  }

  function renderEmptyHousehold() {
    const view = document.querySelector('#householdView');
    if (!view) return;

    view.innerHTML = `
      <section class="household-empty-real">
        <div class="household-empty-mark">⌂</div>

        <small>TU HOGAR</small>

        <h1>Busca y decidid juntos.</h1>

        <p>
          Crea un Hogar para organizar compañeros, viviendas candidatas
          y decisiones compartidas.
        </p>

        <button type="button" id="createHouseholdButton">
          Crear grupo
        </button>

        <span>
          También podrás unirte a uno mediante una invitación.
        </span>
      </section>
    `;
  }


  function renderSearchGroupsHome() {
    const grid =
      document.querySelector('#searchGroupsGrid');

    if (!grid) return;

    const households =
      state.households || [];

    if (!households.length) {
      grid.innerHTML = `
        <div class="communities-empty-card">
          <span>⌂</span>

          <h3>Todavía no tienes ningún grupo</h3>

          <p>
            Crea un grupo cuando quieras empezar a buscar
            vivienda con otras personas.
          </p>

          <button
            type="button"
            data-open-search-group-empty
          >
            Crear grupo
          </button>
        </div>
      `;

      return;
    }

    grid.innerHTML = households
      .map(household => {
        const active =
          household.id === state.household?.id;

        return `
          <button
            type="button"
            class="search-group-card ${active ? 'featured' : ''}"
            data-open-search-group="${escapeHtml(household.id)}"
          >
            <div class="search-group-card-top">
              <span class="search-group-icon">⌂</span>

              <small>
                GRUPO DE BÚSQUEDA
              </small>
            </div>

            <div class="search-group-card-copy">
              <h3>
                ${escapeHtml(household.name)}
              </h3>

              <p>
                Espacio privado para buscar y decidir juntos.
              </p>
            </div>

            <div class="search-group-card-footer">
              <span>
                ${active ? 'Grupo activo' : 'Búsqueda compartida'}
              </span>

              <b>Entrar →</b>
            </div>
          </button>
        `;
      })
      .join('');
  }


  function renderRealHousehold(household, members = []) {
    const view = document.querySelector('#householdView');
    if (!view || !household) return;

    const ownerName =
      state.profile?.alias ||
      state.profile?.name ||
      'Tú';

    view.innerHTML = `
      <header class="real-household-hero">
        <div class="real-household-kicker">GRUPO DE BÚSQUEDA</div>

        <div class="real-household-title">
          <div>
            <h1>${escapeHtml(household.name)}</h1>
            <p>
              Grupo privado ·
              ${members.length || 1}
              ${(members.length || 1) === 1 ? 'miembro' : 'miembros'}
            </p>
          </div>

          <button type="button" id="inviteRealHousehold">
            Invitar +
          </button>
        </div>

        <div class="real-household-members">
          <span class="member-you">
            ${escapeHtml(initials(ownerName))}
          </span>

          <button type="button" id="inviteRealHouseholdSmall">
            ＋
          </button>
        </div>
      </header>

      <nav class="real-household-tabs">
        <button class="active" type="button" data-real-household-tab="candidates">
          Candidatos
        </button>

        <button type="button" data-real-household-tab="members">
          Miembros
          <i>${members.length || 1}</i>
        </button>

        <button type="button" data-real-household-tab="chat" disabled>
          Chat
          <small>Próximamente</small>
        </button>
      </nav>

      <section
        class="real-household-panel active"
        data-real-household-panel="candidates"
      >
        <div class="real-household-section-heading">
          <div>
            <small>VIVIENDAS Y PERSONAS</small>
            <h2>Vuestros candidatos</h2>
          </div>
        </div>

        <div class="real-household-empty-section">
          <span>⌂</span>
          <h3>Todavía no habéis añadido viviendas ni personas</h3>
          <p>
            Más adelante podrás enviar viviendas desde Explore y Guardados.
          </p>

          <button type="button" data-household-go-explore>
            Explorar viviendas y personas →
          </button>
        </div>
      </section>

      <section
        class="real-household-panel"
        data-real-household-panel="members"
        hidden
      >
        <div class="real-household-section-heading">
          <div>
            <small>PERSONAS</small>
            <h2>Miembros del Hogar</h2>
          </div>

          <button type="button" id="inviteRealHouseholdMembers">
            Invitar persona
          </button>
        </div>

        <article class="real-household-person">
          <div class="real-household-person-avatar">
            ${escapeHtml(initials(ownerName))}
          </div>

          <div>
            <b>${escapeHtml(ownerName)}</b>
            <span>Administradora</span>
          </div>

          <small>Tú</small>
        </article>
      </section>
    `;
  }

  async function loadHousehold(preferredHouseholdId = null) {
    if (!state.user) return;

    const { data: memberships, error: membershipError } = await db
      .from('household_members')
      .select('household_id, role, status, joined_at')
      .eq('user_id', state.user.id)
      .eq('status', 'accepted')
      .order('joined_at', { ascending: true });

    if (membershipError) {
      console.error(
        'Rooms: error cargando grupos del usuario',
        membershipError
      );
    }

    const memberIds =
      [...new Set(
        (memberships || [])
          .map(item => item.household_id)
          .filter(Boolean)
      )];

    let memberHouseholds = [];

    if (memberIds.length) {
      const { data, error } = await db
        .from('households')
        .select('*')
        .in('id', memberIds)
        .order('created_at', { ascending: true });

      if (error) {
        console.error(
          'Rooms: error cargando grupos compartidos',
          error
        );
      } else {
        memberHouseholds = data || [];
      }
    }

    const { data: ownedHouseholds, error: ownedError } = await db
      .from('households')
      .select('*')
      .eq('owner_id', state.user.id)
      .order('created_at', { ascending: true });

    if (ownedError) {
      console.error(
        'Rooms: error cargando grupos propios',
        ownedError
      );
    }

    const householdMap = new Map();

    [
      ...(memberHouseholds || []),
      ...(ownedHouseholds || [])
    ].forEach(household => {
      if (household?.id) {
        householdMap.set(household.id, household);
      }
    });

    state.households =
      [...householdMap.values()]
        .sort((a, b) =>
          new Date(a.created_at || 0) -
          new Date(b.created_at || 0)
        );

    renderSearchGroupsHome();

    if (!state.households.length) {
      state.household = null;
      state.householdMembers = [];
      state.householdCandidates = [];
      state.householdPersonCandidates = [];
      state.householdCandidateVotes = [];

      renderEmptyHousehold();
      return;
    }

    const currentId =
      preferredHouseholdId ||
      state.household?.id;

    const household =
      state.households.find(
        item => item.id === currentId
      ) ||
      state.households[0];

    state.household = household;

    const { data: members, error: membersError } = await db
      .from('household_members')
      .select('*')
      .eq('household_id', household.id)
      .eq('status', 'accepted')
      .order('joined_at', { ascending: true });

    if (membersError) {
      console.error(
        'Rooms: error cargando miembros del grupo',
        membersError
      );
    }

    state.householdMembers = members || [];

    renderRealHousehold(
      state.household,
      state.householdMembers
    );

    await loadHouseholdCandidates();

    renderSearchGroupsHome();
  }


  function ensureHouseholdInviteModal() {
    let modal = document.querySelector('#householdInviteModal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'householdInviteModal';
    modal.setAttribute('aria-hidden', 'true');

    modal.innerHTML = `
      <div class="backdrop" data-close-household-invite></div>

      <article class="detail household-invite-shell">
        <header>
          <div>
            <small>INVITAR AL HOGAR</small>
            <h2>Busca piso en compañía.</h2>
            <p>
              Comparte un enlace privado para que otra persona
              pueda unirse a vuestro Hogar.
            </p>
          </div>

          <button
            type="button"
            data-close-household-invite
            aria-label="Cerrar"
          >×</button>
        </header>

        <div class="household-invite-content">
          <div
            class="household-invite-link"
            id="householdInviteLinkBox"
            hidden
          >
            <small>ENLACE DE INVITACIÓN</small>

            <div>
              <input
                id="householdInviteLink"
                type="text"
                readonly
                aria-label="Enlace de invitación"
              >

              <button type="button" id="copyHouseholdInviteLink">
                Copiar
              </button>
            </div>

            <p>El enlace caduca en 7 días.</p>
          </div>

          <button
            type="button"
            class="cta"
            id="generateHouseholdInvite"
          >
            Generar invitación
          </button>
        </div>
      </article>
    `;

    document.body.appendChild(modal);
    return modal;
  }

  function openHouseholdInviteModal() {
    if (!state.household) {
      notify('Primero crea un Hogar');
      return;
    }

    const modal = ensureHouseholdInviteModal();

    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  async function generateHouseholdInvitation() {
    if (!state.user || !state.household) return;

    const button =
      document.querySelector('#generateHouseholdInvite');

    if (button) {
      button.disabled = true;
      button.textContent = 'Generando…';
    }

    const { data, error } = await db
      .from('household_invitations')
      .insert({
        household_id: state.household.id,
        invited_by: state.user.id
      })
      .select('id, token, expires_at')
      .single();

    if (button) {
      button.disabled = false;
      button.textContent = 'Generar nueva invitación';
    }

    if (error) {
      console.error(
        'Rooms: error generando invitación',
        error
      );
      notify('No se pudo generar la invitación');
      return;
    }

    const inviteUrl =
      `${window.location.origin}${window.location.pathname}?invite=${data.token}`;

    const box =
      document.querySelector('#householdInviteLinkBox');

    const input =
      document.querySelector('#householdInviteLink');

    if (input) input.value = inviteUrl;
    if (box) box.hidden = false;

    notify('Invitación creada');
  }

  async function copyHouseholdInvitation() {
    const input =
      document.querySelector('#householdInviteLink');

    if (!input?.value) return;

    try {
      await navigator.clipboard.writeText(input.value);
      notify('Enlace copiado');
    } catch {
      input.select();
      document.execCommand('copy');
      notify('Enlace copiado');
    }
  }

  function ensureIncomingHouseholdInviteModal() {
    let modal =
      document.querySelector('#incomingHouseholdInviteModal');

    if (modal) return modal;

    modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'incomingHouseholdInviteModal';
    modal.setAttribute('aria-hidden', 'true');

    modal.innerHTML = `
      <div class="backdrop"></div>

      <article class="detail incoming-household-invite">
        <div class="incoming-household-icon">⌂</div>

        <small>INVITACIÓN A UN HOGAR</small>

        <h2 id="incomingHouseholdName">
          Te han invitado a un Hogar
        </h2>

        <p>
          Al unirte podréis organizar viviendas y tomar decisiones juntos.
        </p>

        <div class="incoming-household-actions">
          <button
            type="button"
            class="cta"
            id="acceptHouseholdInvite"
          >
            Unirme al Hogar
          </button>

          <button
            type="button"
            id="dismissHouseholdInvite"
          >
            Ahora no
          </button>
        </div>
      </article>
    `;

    document.body.appendChild(modal);
    return modal;
  }

  async function handleIncomingHouseholdInvite() {
    if (!state.user) return;

    const params =
      new URLSearchParams(window.location.search);

    const token = params.get('invite');
    if (!token) return;

    const { data, error } = await db.rpc(
      'get_household_invitation',
      { _token: token }
    );

    if (error) {
      console.error(
        'Rooms: error leyendo invitación',
        error
      );
      notify('Esta invitación no está disponible');
      return;
    }

    const invitation =
      Array.isArray(data) ? data[0] : data;

    if (!invitation) {
      notify('Esta invitación no existe');
      return;
    }

    if (invitation.invitation_status !== 'pending') {
      notify('Esta invitación ya no está disponible');
      return;
    }

    if (
      new Date(invitation.expires_at).getTime() <= Date.now()
    ) {
      notify('Esta invitación ha caducado');
      return;
    }

    state.pendingHouseholdInvite = {
      token,
      ...invitation
    };

    const modal =
      ensureIncomingHouseholdInviteModal();

    const title =
      modal.querySelector('#incomingHouseholdName');

    if (title) {
      title.textContent =
        `Te han invitado a ${invitation.household_name}`;
    }

    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  async function acceptIncomingHouseholdInvite() {
    const invitation =
      state.pendingHouseholdInvite;

    if (!invitation?.token) return;

    const button =
      document.querySelector('#acceptHouseholdInvite');

    if (button) {
      button.disabled = true;
      button.textContent = 'Uniéndote…';
    }

    const { error } = await db.rpc(
      'accept_household_invitation',
      { _token: invitation.token }
    );

    if (error) {
      console.error(
        'Rooms: error aceptando invitación',
        error
      );

      if (button) {
        button.disabled = false;
        button.textContent = 'Unirme al Hogar';
      }

      notify('No se pudo aceptar la invitación');
      return;
    }

    state.pendingHouseholdInvite = null;

    const modal =
      document.querySelector('#incomingHouseholdInviteModal');

    if (modal) {
      modal.classList.remove('open');
      modal.setAttribute('aria-hidden', 'true');
    }

    document.body.style.overflow = '';

    const url = new URL(window.location.href);
    url.searchParams.delete('invite');

    window.history.replaceState(
      {},
      '',
      url.pathname + url.search + url.hash
    );

    await loadHousehold();

    notify('Ya formas parte del Hogar');

    document
      .querySelector('[data-main-view="household"]')
      ?.click();
  }



  async function addPersonToHousehold(userId) {
    if (!state.user) return;

    if (!state.household) {
      notify('Primero crea o únete a un Hogar');
      return;
    }

    if (!userId || userId === state.user.id) {
      notify('No puedes añadirte a ti misma');
      return;
    }

    const { error } = await db
      .from('household_person_candidates')
      .insert({
        household_id: state.household.id,
        user_id: userId,
        added_by: state.user.id
      });

    if (error) {
      if (error.code === '23505') {
        notify('Esta persona ya está en vuestro Hogar');
        return;
      }

      console.error(
        'Rooms: error añadiendo persona candidata',
        error
      );

      notify('No se pudo añadir la persona');
      return;
    }

    notify('Persona añadida a vuestro Hogar');
  }


  function ensureGroupPickerModal() {
    let modal =
      document.querySelector('#groupPickerModal');

    if (modal) return modal;

    modal = document.createElement('div');

    modal.className = 'modal';
    modal.id = 'groupPickerModal';
    modal.setAttribute('aria-hidden', 'true');

    modal.innerHTML = `
      <div
        class="backdrop"
        data-close-group-picker
      ></div>

      <article class="group-picker-sheet">

        <div class="group-picker-handle"></div>

        <header class="group-picker-header">
          <div>
            <small>GRUPOS DE BÚSQUEDA</small>
            <h2>¿A qué grupo quieres añadirlo?</h2>
            <p>
              El grupo podrá valorar esta opción y votar juntos.
            </p>
          </div>

          <button
            type="button"
            data-close-group-picker
            aria-label="Cerrar"
          >
            ×
          </button>
        </header>

        <div
          class="group-picker-list"
          id="groupPickerList"
        ></div>

        <button
          type="button"
          class="group-picker-create"
          data-create-group-from-picker
        >
          ＋ Crear nuevo grupo
        </button>

      </article>
    `;

    document.body.appendChild(modal);

    return modal;
  }


  function openGroupPicker(candidateType, candidateId) {
    const households =
      state.households || [];

    if (!households.length) {
      notify('Crea primero un grupo de búsqueda');
      return;
    }

    state.pendingGroupCandidate = {
      type: candidateType,
      id: candidateId
    };

    const modal =
      ensureGroupPickerModal();

    const list =
      modal.querySelector('#groupPickerList');

    list.innerHTML = households
      .map(household => `
        <button
          type="button"
          class="group-picker-option"
          data-pick-group="${escapeHtml(household.id)}"
        >
          <span class="group-picker-option-icon">
            ⌂
          </span>

          <span class="group-picker-option-copy">
            <b>${escapeHtml(household.name)}</b>
            <small>Grupo de búsqueda</small>
          </span>

          <span class="group-picker-option-arrow">
            →
          </span>
        </button>
      `)
      .join('');

    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');

    document.body.style.overflow = 'hidden';
  }


  function closeGroupPicker() {
    const modal =
      document.querySelector('#groupPickerModal');

    if (!modal) return;

    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');

    document.body.style.overflow = '';
  }


  async function addListingToGroup(
    listingId,
    householdId
  ) {
    if (!state.user || !householdId) return;

    const { error } = await db
      .from('household_candidates')
      .insert({
        household_id: householdId,
        listing_id: listingId,
        added_by: state.user.id
      });

    if (error) {
      if (error.code === '23505') {
        notify('Esta vivienda ya está en ese grupo');
        return;
      }

      console.error(
        'Rooms: error añadiendo vivienda al grupo',
        error
      );

      notify('No se pudo añadir la vivienda');
      return;
    }

    if (state.household?.id === householdId) {
      await loadHouseholdCandidates();
    }

    notify('Vivienda añadida al grupo');
  }


  async function addPersonToGroup(
    userId,
    householdId
  ) {
    if (
      !state.user ||
      !householdId ||
      !userId
    ) {
      return false;
    }

    if (
      state.blockedUsers?.has(userId)
    ) {
      notify(
        'No puedes añadir a un usuario bloqueado.'
      );
      return false;
    }

    if (userId === state.user.id) {
      notify('No puedes añadirte a ti misma');
      return false;
    }

    const household =
      (state.households || [])
        .find(item => item.id === householdId);

    if (!household) {
      notify('No encuentro ese grupo de búsqueda');
      return false;
    }

    const { error } = await db
      .from('household_person_candidates')
      .insert({
        household_id: householdId,
        user_id: userId,
        added_by: state.user.id
      });

    if (error) {
      if (error.code === '23505') {
        notify(
          'Esta persona ya está en ese grupo'
        );

        return false;
      }

      console.error(
        'Rooms: error añadiendo persona al grupo',
        error
      );

      notify(
        'No se pudo añadir la persona'
      );

      return false;
    }

    /*
      Si es el grupo que está actualmente abierto,
      refrescamos sus candidatos al instante.
    */
    if (
      state.household?.id === householdId
    ) {
      await loadHouseholdCandidates();
    }

    /*
      Refrescamos las tarjetas de Grupos de búsqueda
      sin cambiar el grupo activo del usuario.
    */
    renderSearchGroupsHome();

    const profile =
      state.profiles.get(userId);

    const personName =
      profile?.alias ||
      profile?.name ||
      'Persona';

    notify(
      `${personName} añadida a ${household.name}`
    );

    return true;
  }


  async function addListingToHousehold(listingId) {
    if (!state.user) return;

    if (!state.household) {
      notify('Primero crea o únete a un Hogar');
      return;
    }

    const { error } = await db
      .from('household_candidates')
      .insert({
        household_id: state.household.id,
        listing_id: listingId,
        added_by: state.user.id
      });

    if (error) {
      if (error.code === '23505') {
        notify('Esta vivienda ya está en vuestro Hogar');
        return;
      }

      console.error(
        'Rooms: error añadiendo candidato',
        error
      );

      notify('No se pudo añadir la vivienda');
      return;
    }

    await loadHouseholdCandidates();
    notify('Añadido a Candidatos de tu Hogar');
  }

  async function loadHouseholdCandidates() {
    if (!state.household) {
      state.householdCandidates = [];
      state.householdPersonCandidates = [];
      return;
    }

    const [
      { data: homes, error: homesError },
      { data: people, error: peopleError }
    ] = await Promise.all([
      db
        .from('household_candidates')
        .select(`
          household_id,
          listing_id,
          added_by,
          created_at,
          listing:listings(*)
        `)
        .eq('household_id', state.household.id)
        .order('created_at', { ascending: false }),

      db
        .from('household_person_candidates')
        .select(`
          household_id,
          user_id,
          added_by,
          created_at
        `)
        .eq('household_id', state.household.id)
        .order('created_at', { ascending: false })
    ]);

    if (homesError) {
      console.error(
        'Rooms: error cargando viviendas candidatas',
        homesError
      );
    }

    if (peopleError) {
      console.error(
        'Rooms: error cargando personas candidatas',
        peopleError
      );
    }

    state.householdCandidates = homes || [];
    state.householdPersonCandidates = people || [];

    const { data: votes, error: votesError } = await db
      .from('household_candidate_votes')
      .select('*')
      .eq('household_id', state.household.id);

    if (votesError) {
      console.error(
        'Rooms: error cargando votos del Hogar',
        votesError
      );
    }

    state.householdCandidateVotes = votes || [];

    renderHouseholdCandidates();
    renderSearchGroupsHome();
  }

  function renderHouseholdCandidates() {
    const panel =
      document.querySelector(
        '[data-real-household-panel="candidates"]'
      );

    if (!panel) return;

    const homes =
      state.householdCandidates || [];

    const people =
      state.householdPersonCandidates || [];

    const total =
      homes.length + people.length;

    const heading = `
      <div class="real-household-section-heading">
        <div>
          <small>VIVIENDAS Y PERSONAS</small>
          <h2>Vuestros candidatos</h2>
        </div>

        ${
          total
            ? `<span class="household-candidate-count">
                ${total}
                ${total === 1 ? 'candidato' : 'candidatos'}
              </span>`
            : ''
        }
      </div>
    `;

    if (!total) {
      panel.innerHTML = `
        ${heading}

        <div class="real-household-empty-section">
          <span>⌂</span>
          <h3>
            Todavía no habéis añadido viviendas ni personas
          </h3>

          <p>
            Añade viviendas o personas desde Explore
            para organizarlas aquí.
          </p>

          <button type="button" data-household-go-explore>
            Explorar viviendas y personas →
          </button>
        </div>
      `;

      return;
    }

    const homeCards = homes.map(item => {
      const listing = item.listing || {};

      const photos =
        Array.isArray(listing.photos)
          ? listing.photos
          : [];

      const image = photos[0] || '';

      const kindLabel =
        listing.kind === 'room'
          ? 'Habitación'
          : listing.kind === 'apartment'
            ? 'Piso entero'
            : 'Vivienda';

      const available =
        listing.available_from
          ? new Date(listing.available_from)
              .toLocaleDateString('es-ES', {
                day: 'numeric',
                month: 'short'
              })
          : 'Fecha flexible';

      return `
        <article class="real-household-candidate">
          <div class="real-household-candidate-media">
            ${
              image
                ? `<img
                    src="${escapeHtml(image)}"
                    alt="${escapeHtml(
                      listing.title || kindLabel
                    )}"
                  >`
                : `<div class="real-household-candidate-placeholder">
                    ⌂
                  </div>`
            }

            <span class="household-candidate-kind">
              VIVIENDA
            </span>
          </div>

          <div class="real-household-candidate-copy">
            <small>${escapeHtml(kindLabel)}</small>

            <h3>
              ${escapeHtml(
                listing.title ||
                `${listing.zone || 'Madrid'} · ${kindLabel}`
              )}
            </h3>

            <p>
              <b>
                ${Number(listing.price || 0)
                  .toLocaleString('es-ES')} €
              </b>
              / mes
            </p>

            <span>
              ${escapeHtml(listing.zone || 'Madrid')}
              · Disponible ${escapeHtml(available)}
            </span>

            <div class="real-household-candidate-meta">
              ${
                listing.rooms
                  ? `<span>${escapeHtml(
                      String(listing.rooms)
                    )} hab</span>`
                  : ''
              }

              ${
                listing.baths
                  ? `<span>${escapeHtml(
                      String(listing.baths)
                    )} baños</span>`
                  : ''
              }

              ${
                listing.area
                  ? `<span>${escapeHtml(
                      String(listing.area)
                    )} m²</span>`
                  : ''
              }
            </div>

            ${renderHouseholdVoteControls(
              'listing',
              listing.id
            )}

            <div class="real-household-candidate-actions">
              <button
                type="button"
                data-real-listing="${escapeHtml(
                  listing.id || ''
                )}"
              >
                Ver vivienda
              </button>

              <button
                type="button"
                data-remove-household-candidate="${escapeHtml(
                  listing.id || ''
                )}"
              >
                Quitar
              </button>
            </div>
          </div>
        </article>
      `;
    }).join('');

    const personCards = people.map(item => {
      const profile =
        state.profiles?.get(item.user_id);

      if (!profile) {
        return `
          <article class="real-household-person-candidate">
            <div class="real-household-person-candidate-avatar">
              ?
            </div>

            <div class="real-household-person-candidate-copy">
              <small>PERSONA</small>
              <h3>Perfil no disponible</h3>
              <p>
                Esta persona ya no está disponible públicamente.
              </p>

              <button
                type="button"
                data-remove-household-person="${escapeHtml(
                  item.user_id
                )}"
              >
                Quitar
              </button>
            </div>
          </article>
        `;
      }

      const name =
        profile.alias ||
        profile.name ||
        'Usuario de Rooms';

      const zone =
        profile.zones?.[0] || '';

      const seeking =
        profile.seeking?.length
          ? profile.seeking
              .map(labelSeeking)
              .join(' · ')
          : '';

      return `
        <article class="real-household-person-candidate">
          <div class="real-household-person-candidate-avatar">
            ${
              profile.avatar_url
                ? `<img
                    src="${escapeHtml(profile.avatar_url)}"
                    alt="${escapeHtml(name)}"
                  >`
                : escapeHtml(initials(name))
            }

            <span class="household-candidate-kind">
              PERSONA
            </span>
          </div>

          <div class="real-household-person-candidate-copy">
            <small>PERSONA</small>

            <h3>
              ${escapeHtml(name)}
              ${profile.age ? `, ${profile.age}` : ''}
            </h3>

            <p>
              ${
                escapeHtml(
                  [seeking, zone]
                    .filter(Boolean)
                    .join(' · ')
                ) || 'Perfil en Rooms'
              }
            </p>

            ${
              profile.bio
                ? `<span>
                    ${escapeHtml(profile.bio)}
                  </span>`
                : ''
            }

            ${renderHouseholdVoteControls(
              'person',
              profile.id
            )}

            <div class="real-household-candidate-actions">
              <button
                type="button"
                data-open-explore-person="${escapeHtml(
                  profile.id
                )}"
              >
                Ver perfil
              </button>

              <button
                type="button"
                data-remove-household-person="${escapeHtml(
                  profile.id
                )}"
              >
                Quitar
              </button>
            </div>
          </div>
        </article>
      `;
    }).join('');

    panel.innerHTML = `
      ${heading}

      ${
        homes.length
          ? `
            <section class="household-candidate-group">
              <div class="household-candidate-group-title">
                <span>VIVIENDAS</span>
                <b>${homes.length}</b>
              </div>

              <div class="real-household-candidates-grid">
                ${homeCards}
              </div>
            </section>
          `
          : ''
      }

      ${
        people.length
          ? `
            <section class="household-candidate-group">
              <div class="household-candidate-group-title">
                <span>PERSONAS</span>
                <b>${people.length}</b>
              </div>

              <div class="real-household-people-grid">
                ${personCards}
              </div>
            </section>
          `
          : ''
      }
    `;
  }




  function getHouseholdVoteSummary(type, candidateId) {
    const votes =
      (state.householdCandidateVotes || [])
        .filter(vote =>
          vote.candidate_type === type &&
          vote.candidate_id === candidateId
        );

    return {
      like: votes.filter(vote => vote.vote === 'like').length,
      maybe: votes.filter(vote => vote.vote === 'maybe').length,
      dislike: votes.filter(vote => vote.vote === 'dislike').length,
      mine:
        votes.find(vote => vote.user_id === state.user?.id)?.vote ||
        ''
    };
  }

  function renderHouseholdVoteControls(type, candidateId) {
    const summary =
      getHouseholdVoteSummary(type, candidateId);

    const options = [
      ['like', '👍', 'Me gusta'],
      ['maybe', '🤔', 'Dudas'],
      ['dislike', '👎', 'No encaja']
    ];

    return `
      <div
        class="household-vote-controls"
        data-vote-candidate="${escapeHtml(candidateId)}"
      >
        ${options.map(([value, emoji, label]) => `
          <button
            type="button"
            class="${summary.mine === value ? 'active' : ''}"
            data-household-vote="${value}"
            data-candidate-type="${type}"
            data-candidate-id="${escapeHtml(candidateId)}"
            aria-pressed="${summary.mine === value}"
          >
            <span>${emoji}</span>
            <b>${label}</b>
            ${
              summary[value]
                ? `<i>${summary[value]}</i>`
                : ''
            }
          </button>
        `).join('')}
      </div>
    `;
  }

  async function voteHouseholdCandidate(
    type,
    candidateId,
    voteValue
  ) {
    if (!state.user || !state.household) return;

    const current =
      (state.householdCandidateVotes || [])
        .find(vote =>
          vote.candidate_type === type &&
          vote.candidate_id === candidateId &&
          vote.user_id === state.user.id
        );

    if (current?.vote === voteValue) {
      const { error } = await db
        .from('household_candidate_votes')
        .delete()
        .eq('household_id', state.household.id)
        .eq('candidate_type', type)
        .eq('candidate_id', candidateId)
        .eq('user_id', state.user.id);

      if (error) {
        console.error(
          'Rooms: error eliminando voto',
          error
        );
        notify('No se pudo actualizar tu voto');
        return;
      }
    } else {
      const { error } = await db
        .from('household_candidate_votes')
        .upsert({
          household_id: state.household.id,
          candidate_type: type,
          candidate_id: candidateId,
          user_id: state.user.id,
          vote: voteValue,
          updated_at: new Date().toISOString()
        }, {
          onConflict:
            'household_id,candidate_type,candidate_id,user_id'
        });

      if (error) {
        console.error(
          'Rooms: error guardando voto',
          error
        );
        notify('No se pudo guardar tu voto');
        return;
      }
    }

    await loadHouseholdCandidates();
  }

  async function removeHouseholdPersonCandidate(userId) {
    if (
      !state.household ||
      !state.user ||
      !userId
    ) {
      return false;
    }

    const profile =
      state.profiles?.get(userId);

    const name =
      profile?.alias ||
      profile?.name ||
      'esta persona';

    const confirmed =
      window.confirm(
        `¿Quieres quitar a ${name} de este grupo de búsqueda?`
      );

    if (!confirmed) {
      return false;
    }

    const {
      data: deletedRows,
      error
    } = await db
      .from('household_person_candidates')
      .delete()
      .eq(
        'household_id',
        state.household.id
      )
      .eq(
        'user_id',
        userId
      )
      .select('user_id');

    if (error) {
      console.error(
        'Rooms: error eliminando persona candidata',
        error
      );

      notify(
        'No se pudo quitar la persona'
      );

      return false;
    }

    if (!deletedRows?.length) {
      notify(
        'Esta persona ya no estaba en el grupo'
      );

      await loadHouseholdCandidates();

      return false;
    }

    /*
      Limpiamos también sus votos dentro de este grupo.
    */
    const { error: voteError } = await db
      .from('household_candidate_votes')
      .delete()
      .eq(
        'household_id',
        state.household.id
      )
      .eq(
        'candidate_type',
        'person'
      )
      .eq(
        'candidate_id',
        userId
      );

    if (voteError) {
      console.error(
        'Rooms: error limpiando votos de persona',
        voteError
      );
    }

    await loadHouseholdCandidates();

    renderSearchGroupsHome();

    notify(
      `${name} eliminada del grupo`
    );

    return true;
  }


  async function removeHouseholdCandidate(listingId) {
    if (!state.household) return;

    const { error } = await db
      .from('household_candidates')
      .delete()
      .eq('household_id', state.household.id)
      .eq('listing_id', listingId);

    if (error) {
      console.error(
        'Rooms: error eliminando candidato',
        error
      );

      notify('No se pudo quitar la vivienda');
      return;
    }

    await loadHouseholdCandidates();
    notify('Vivienda eliminada del Hogar');
  }

  async function createHousehold(event) {
    event.preventDefault();

    if (!state.user) return;

    const input =
      document.querySelector('#createHouseholdName');

    const name = input?.value.trim();

    if (!name) {
      notify('Pon un nombre a vuestro Hogar');
      return;
    }

    const submit =
      event.currentTarget.querySelector('[type="submit"]');

    submit.disabled = true;
    submit.textContent = 'Creando…';

    const householdId = crypto.randomUUID();

    const { error } = await db
      .from('households')
      .insert({
        id: householdId,
        name,
        owner_id: state.user.id
      });

    if (error) {
      console.error('Rooms: error creando Hogar', error);
      submit.disabled = false;
      submit.textContent = 'Crear grupo';
      notify('No se pudo crear el Hogar');
      return;
    }

    const household = {
      id: householdId,
      name,
      owner_id: state.user.id
    };

    const { error: memberError } = await db
      .from('household_members')
      .insert({
        household_id: householdId,
        user_id: state.user.id,
        role: 'owner',
        status: 'accepted'
      });

    if (memberError) {
      console.error(
        'Rooms: error creando miembro propietario',
        memberError
      );
    }

    state.household = household;
    state.householdMembers = [{
      household_id: householdId,
      user_id: state.user.id,
      role: 'owner',
      status: 'accepted'
    }];

    const modal =
      document.querySelector('#createHouseholdModal');

    if (modal) {
      modal.classList.remove('open');
      modal.setAttribute('aria-hidden', 'true');
    }

    document.body.style.overflow = '';

    renderRealHousehold(
      state.household,
      state.householdMembers
    );

    notify('Hogar creado');
  }

  document.addEventListener('click', event => {
    const openSearchGroupButton =
      event.target.closest('[data-open-search-group]');

    if (openSearchGroupButton) {
      const householdId =
        openSearchGroupButton.dataset.openSearchGroup;

      if (householdId) {
        loadHousehold(householdId);
      }

      const communities =
        document.querySelector('#communitiesView');

      const household =
        document.querySelector('#householdView');

      if (communities) communities.hidden = true;
      if (household) household.hidden = false;

      document
        .querySelectorAll('[data-bottom-nav]')
        .forEach(item => {
          item.classList.toggle(
            'active',
            item.dataset.bottomNav === 'communities'
          );
        });

      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });

      return;
    }

    const voteButton =
      event.target.closest('[data-household-vote]');

    if (voteButton) {
      event.preventDefault();
      event.stopPropagation();

      voteHouseholdCandidate(
        voteButton.dataset.candidateType,
        voteButton.dataset.candidateId,
        voteButton.dataset.householdVote
      );

      return;
    }

    const sendPersonHomeButton =
      event.target.closest('[data-send-person-home]');

    if (sendPersonHomeButton) {
      event.preventDefault();
      event.stopImmediatePropagation();

      openGroupPicker(
        'person',
        sendPersonHomeButton.dataset.sendPersonHome
      );

      return;
    }

    const sendHomeButton =
      event.target.closest(
        '[data-send-home], [data-send-home-id]'
      );

    if (sendHomeButton) {
      event.preventDefault();
      event.stopPropagation();

      const listingId =
        sendHomeButton.dataset.sendHomeId ||
        sendHomeButton
          .closest('[data-real-listing]')
          ?.dataset.realListing ||
        sendHomeButton
          .closest('[data-saved-id]')
          ?.dataset.savedId ||
        sendHomeButton
          .closest('[data-save-id]')
          ?.dataset.saveId;

      const listing =
        listingId
          ? state.listings?.get(listingId)
          : null;

      if (!listing?.id) {
        notify('No encuentro esta vivienda');
        return;
      }

      openGroupPicker(
        'listing',
        listing.id
      );

      if (sendHomeButton.closest('#compareModal')) {
        document
          .querySelector('#compareModal [data-close]')
          ?.click();
      }

      return;
    }

    const removePersonCandidateButton =
      event.target.closest(
        '[data-remove-household-person]'
      );

    if (removePersonCandidateButton) {
      removeHouseholdPersonCandidate(
        removePersonCandidateButton.dataset.removeHouseholdPerson
      );
      return;
    }

    const removeCandidateButton =
      event.target.closest(
        '[data-remove-household-candidate]'
      );

    if (removeCandidateButton) {
      removeHouseholdCandidate(
        removeCandidateButton.dataset.removeHouseholdCandidate
      );
      return;
    }

    if (event.target.closest('#acceptHouseholdInvite')) {
      acceptIncomingHouseholdInvite();
      return;
    }

    if (event.target.closest('#dismissHouseholdInvite')) {
      const modal =
        document.querySelector('#incomingHouseholdInviteModal');

      if (modal) {
        modal.classList.remove('open');
        modal.setAttribute('aria-hidden', 'true');
      }

      document.body.style.overflow = '';
      return;
    }

    if (
      event.target.closest('#inviteRealHousehold') ||
      event.target.closest('#inviteRealHouseholdSmall') ||
      event.target.closest('#inviteRealHouseholdMembers')
    ) {
      openHouseholdInviteModal();
      return;
    }

    if (event.target.closest('#generateHouseholdInvite')) {
      generateHouseholdInvitation();
      return;
    }

    if (event.target.closest('#copyHouseholdInviteLink')) {
      copyHouseholdInvitation();
      return;
    }

    if (event.target.closest('[data-close-household-invite]')) {
      const modal =
        document.querySelector('#householdInviteModal');

      if (modal) {
        modal.classList.remove('open');
        modal.setAttribute('aria-hidden', 'true');
      }

      document.body.style.overflow = '';
      return;
    }

    if (event.target.closest('#createHouseholdButton')) {
      const modal = ensureCreateHouseholdModal();

      modal.classList.add('open');
      modal.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';

      setTimeout(() => {
        modal.querySelector('#createHouseholdName')?.focus();
      }, 50);

      return;
    }

    if (event.target.closest('[data-close-create-household]')) {
      const modal =
        document.querySelector('#createHouseholdModal');

      if (modal) {
        modal.classList.remove('open');
        modal.setAttribute('aria-hidden', 'true');
      }

      document.body.style.overflow = '';
      return;
    }

    const tab =
      event.target.closest('[data-real-household-tab]');

    if (tab && !tab.disabled) {
      const target = tab.dataset.realHouseholdTab;

      document
        .querySelectorAll('[data-real-household-tab]')
        .forEach(button => {
          button.classList.toggle(
            'active',
            button === tab
          );
        });

      document
        .querySelectorAll('[data-real-household-panel]')
        .forEach(panel => {
          panel.hidden =
            panel.dataset.realHouseholdPanel !== target;

          panel.classList.toggle(
            'active',
            panel.dataset.realHouseholdPanel === target
          );
        });

      return;
    }

    if (event.target.closest('[data-household-go-explore]')) {
      const exploreNav =
        document.querySelector('[data-bottom-nav="explore"]');

      if (exploreNav) {
        exploreNav.click();
      }

      return;
    }
  });


  let editListingDraggedPhoto = null;

  document.addEventListener('dragstart', event => {
    const card =
      event.target.closest('[data-edit-photo-index]');

    if (!card) return;

    editListingDraggedPhoto =
      Number(card.dataset.editPhotoIndex);

    card.classList.add('dragging');

    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
    }
  });

  document.addEventListener('dragend', event => {
    const card =
      event.target.closest('[data-edit-photo-index]');

    if (card) {
      card.classList.remove('dragging');
    }

    editListingDraggedPhoto = null;
  });

  document.addEventListener('dragover', event => {
    const card =
      event.target.closest('[data-edit-photo-index]');

    if (!card) return;

    event.preventDefault();

    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
  });

  document.addEventListener('drop', event => {
    const card =
      event.target.closest('[data-edit-photo-index]');

    if (
      !card ||
      editListingDraggedPhoto === null
    ) return;

    event.preventDefault();

    moveEditListingPhoto(
      editListingDraggedPhoto,
      Number(card.dataset.editPhotoIndex)
    );

    editListingDraggedPhoto = null;
  });

  document.addEventListener('change', event => {
    if (event.target.id !== 'editListingPhotos') return;

    const count =
      event.target.files?.length || 0;

    const label =
      document.querySelector('#editListingNewPhotoCount');

    if (!label) return;

    label.textContent = count
      ? `${count} ${count === 1
          ? 'foto nueva seleccionada'
          : 'fotos nuevas seleccionadas'}`
      : '';
  });


})();
