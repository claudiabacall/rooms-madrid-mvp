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

  let connectionsFeature;
  let messagingFeature;

  const savedFeature =
    window.ROOMS_SAVED_FEATURE?.create({
      db,
      state,
      escapeHtml,
      notify,
      updateSavedCount,
      connectionButtonLabel:
        userId =>
          connectionsFeature
            ?.connectionButtonLabel(userId) ||
          'Conectar'
    });

  if (!savedFeature) {
    throw new Error(
      'Rooms: no se ha cargado la feature Saved'
    );
  }

  const {
    savedItemPresentation,
    loadSavedCollections,
    createSavedCollection,
    loadSavedItems,
    sortSavedItems,
    ensureCollectionDetailModal,
    openSavedCollection,
    renderSavedCollection,
    showSavedItemsPicker,
    addSavedItemToCollection,
    removeSavedItemFromCollection
  } = savedFeature;

  const listingsFeature =
    window.ROOMS_LISTINGS_FEATURE?.create({
      state,
      escapeHtml,
      showModal
    });

  if (!listingsFeature) {
    throw new Error(
      'Rooms: no se ha cargado la feature Listings'
    );
  }

  const {
    openRealListingDetail
  } = listingsFeature;

  const matchingFeature =
    window.ROOMS_MATCHING_FEATURE?.create({
      db,
      state,
      escapeHtml,
      showModal
    });

  if (!matchingFeature) {
    throw new Error(
      'Rooms: no se ha cargado la feature Matching'
    );
  }

  const {
    normalizeMatchValue,
    calculateRealMatch,
    loadRealMatchProfile,
    ensureRealMatchModal,
    openRealMatch
  } = matchingFeature;

  connectionsFeature =
    window.ROOMS_CONNECTIONS_FEATURE?.create({
      db,
      state,
      notify,
      showModal,
      escapeHtml,
      initials:
        savedFeature.initials,
      labelSeeking,
      updateTrustView,
      openRealConversation:
        profile =>
          messagingFeature
            ?.openRealConversation(profile),
      loadRealNotifications:
        () =>
          messagingFeature
            ?.loadRealNotifications(),
      loadRealInbox:
        () =>
          messagingFeature
            ?.loadRealInbox()
    });

  if (!connectionsFeature) {
    throw new Error(
      'Rooms: no se ha cargado la feature Connections'
    );
  }

  const {
    getConnectionForUser,
    connectionButtonLabel,
    loadAllConnections,
    loadConnection,
    updateConnectButtons,
    handleConnect,
    connectToUser,
    loadIncomingConnections,
    ensureConnectionResponseModal,
    openIncomingConnectionRequest,
    answerIncomingConnection
  } = connectionsFeature;

  messagingFeature =
    window.ROOMS_MESSAGING_FEATURE?.create({
      db,
      state,
      notify,
      showModal,
      hideAllModals,
      escapeHtml,
      initials:
        savedFeature.initials,
      relativeTime,
      fetchProfiles,
      getConnectionForUser,
      loadConnection
    });

  if (!messagingFeature) {
    throw new Error(
      'Rooms: no se ha cargado la feature Messaging'
    );
  }

  const {
    loadConversationPreferences,
    getConversationPreference,
    saveConversationPreference,
    toggleConversationMute,
    deleteConversationForMe,
    loadRealNotifications,
    loadRealInbox,
    ensureConversationOptionsMenu,
    renderConversationOptionsMenu,
    closeConversationOptionsMenu,
    openRealConversation,
    renderMessages,
    messageBubble,
    sendMessage,
    subscribeToMessages
  } = messagingFeature;

  const sessionsFeature =
    window.ROOMS_SESSIONS_FEATURE?.create({
      db,
      state,
      showModal,
      notify
    });

  if (!sessionsFeature) {
    throw new Error(
      'Rooms: no se ha cargado la feature Sessions'
    );
  }

  const {
    ensureSessionsModal,
    openSessionsManager,
    signOutOtherSessions
  } = sessionsFeature;

  const ownProfileFeature =
    window.ROOMS_OWN_PROFILE_FEATURE?.create({
      state,
      escapeHtml,
      formatBudget,
      roomsDnaLivingRows
    });

  if (!ownProfileFeature) {
    throw new Error(
      'Rooms: no se ha cargado la feature Own Profile'
    );
  }

  const {
    ensureOwnPublicProfileModal,
    canShowOwnProfileSection,
    renderOwnPublicProfile,
    openOwnPublicProfile
  } = ownProfileFeature;

  const profileEditorFeature =
    window.ROOMS_PROFILE_EDITOR_FEATURE?.create({
      db,
      state,
      notify,
      updateOwnProfile
    });

  if (!profileEditorFeature) {
    throw new Error(
      'Rooms: no se ha cargado la feature Profile Editor'
    );
  }

  const {
    ensureProfileEditorModal,
    openProfileEditor,
    uploadProfilePhoto
  } = profileEditorFeature;

  const profilesFeature =
    window.ROOMS_PROFILES_FEATURE?.create({
      state,
      escapeHtml,
      initials:
        savedFeature.initials,
      labelSeeking,
      formatBudget,
      loadConnection,
      connectionButtonLabel,
      updateConnectButtons,
      showModal
    });

  if (!profilesFeature) {
    throw new Error(
      'Rooms: no se ha cargado la feature Profiles'
    );
  }

  const {
    openRealUser
  } = profilesFeature;

  let loadHouseholdCandidatesImpl =
    async () => undefined;

  async function loadHouseholdCandidates(...args) {
    return loadHouseholdCandidatesImpl(
      ...args
    );
  }


  const moderationFeature =
    window.ROOMS_MODERATION_FEATURE?.create({
      db,
      state,
      notify,
      showModal,
      hideAllModals,
      escapeHtml,
      initials:
        savedFeature.initials,
      updateConnectButtons,
      loadSavedItems,
      loadHouseholdCandidates,
      loadRealInbox,
      loadRealNotifications,
      openRealUser
    });

  if (!moderationFeature) {
    throw new Error(
      'Rooms: no se ha cargado la feature Moderation'
    );
  }

  const {
    openRealReport,
    submitRealReport,
    showMyRealReports,
    loadUserBlocks,
    updateBlockedUsersCount,
    ensureBlockedUsersModal,
    openBlockedUsersManager,
    openRealBlock,
    removeConnectionWithUser,
    removeBlockedUserFromSavedAndGroups,
    confirmRealBlock,
    unblockRealUser
  } = moderationFeature;

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

  let manualAuthNavigationPending = false;

  function injectAuthGate() {
    const gate = document.createElement('section');
    gate.className = 'auth-gate';
    gate.id = 'authGate';
    gate.hidden = true;
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
            <input id="authPassword" type="password" required autocomplete="current-password">
          </label>

          <button
            class="auth-forgot"
            id="authForgotPassword"
            type="button"
          >
            ¿Has olvidado tu contraseña?
          </button>

          <button class="auth-submit" id="authSubmit" type="submit">Entrar</button>
          <p class="auth-message" id="authMessage" role="status" aria-live="polite"></p>
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

      const passwordInput =
        document.querySelector('#authPassword');

      passwordInput.autocomplete =
        mode === 'signup'
          ? 'new-password'
          : 'current-password';

      if (mode === 'signup') {
        passwordInput.setAttribute('minlength', '6');
      } else {
        passwordInput.removeAttribute('minlength');
      }

      document.querySelector('#authForgotPassword').hidden =
        mode !== 'login';

      document.querySelector('#authSubmit').textContent =
        mode === 'signup'
          ? 'Crear mi cuenta'
          : 'Entrar';

      document.querySelector('#authMessage').textContent = '';
    }));

    document.querySelector('#authForgotPassword').addEventListener('click', async () => {
      const emailInput =
        document.querySelector('#authEmail');

      const message =
        document.querySelector('#authMessage');

      const button =
        document.querySelector('#authForgotPassword');

      const email =
        emailInput.value.trim();

      message.className = 'auth-reset-message';
      message.textContent = '';

      if (!email) {
        message.textContent =
          'Introduce tu email para enviarte el enlace de recuperación.';
        emailInput.focus();
        return;
      }

      if (!emailInput.checkValidity()) {
        message.textContent =
          'Comprueba que el email esté bien escrito.';
        emailInput.focus();
        return;
      }

      button.disabled = true;
      button.textContent = 'Enviando enlace…';

      const { error } =
        await db.auth.resetPasswordForEmail(
          email,
          {
            redirectTo: window.location.origin
          }
        );

      button.disabled = false;
      button.textContent =
        '¿Has olvidado tu contraseña?';

      if (error) {
        console.error(
          'Rooms: error enviando recuperación de contraseña',
          error
        );

        const errorText =
          String(error.message || '').toLowerCase();

        const waitMatch =
          errorText.match(/after\s+(\d+)\s+seconds?/);

        if (
          error.status === 429 ||
          errorText.includes('security purposes')
        ) {
          const seconds =
            waitMatch?.[1] || 'unos';

          message.className =
            'auth-message';

          message.textContent =
            `Ya hemos enviado un enlace recientemente. Espera ${seconds} segundos antes de solicitar otro.`;
          return;
        }

        message.textContent =
          'No hemos podido enviar el enlace. Inténtalo de nuevo.';
        return;
      }

      message.className =
        'auth-message success';

      message.textContent =
        'Te hemos enviado un enlace para crear una nueva contraseña. Revisa tu bandeja de entrada.';
    });


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

      manualAuthNavigationPending = true;

      const result = mode === 'signup'
        ? await db.auth.signUp({ email, password, options: { data: { name, alias: name } } })
        : await db.auth.signInWithPassword({ email, password });

      submit.disabled = false;

      if (result.error) {
        manualAuthNavigationPending = false;
        message.textContent = translateAuthError(result.error.message);
        return;
      }

      if (mode === 'signup' && !result.data.session) {
        manualAuthNavigationPending = false;
        message.className = 'auth-message success';
        message.textContent = 'Cuenta creada. Revisa tu email y confirma el enlace para entrar.';
        return;
      }
      message.className = 'auth-message success';
      message.textContent = 'Cuenta lista. Entrando en Rooms…';
    });
  }

  function ensurePasswordRecoveryModal() {
    let modal =
      document.querySelector('#passwordRecoveryModal');

    if (modal) return modal;

    modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'passwordRecoveryModal';
    modal.setAttribute('aria-hidden', 'true');

    modal.innerHTML = `
      <div class="backdrop"></div>

      <section class="auth-reset-shell">
        <article class="auth-reset-card">
          <small class="auth-reset-eyebrow">
            SEGURIDAD
          </small>

          <h1>
            Crea una nueva contraseña
          </h1>

          <p class="auth-reset-intro">
            Introduce una contraseña nueva para tu cuenta de Rooms.
          </p>

          <form
            id="passwordRecoveryForm"
            class="auth-reset-form"
            novalidate
          >
            <div class="auth-reset-field">
              <label for="recoveryPassword">
                Nueva contraseña
              </label>

              <input
                id="recoveryPassword"
                type="password"
                autocomplete="new-password"
                placeholder="Escribe tu nueva contraseña"
              >
            </div>

            <div class="auth-reset-field">
              <label for="recoveryPasswordConfirm">
                Repetir contraseña
              </label>

              <input
                id="recoveryPasswordConfirm"
                type="password"
                autocomplete="new-password"
                placeholder="Repite la contraseña"
              >
            </div>

            <p class="auth-reset-helper">
              Debe tener al menos 6 caracteres.
            </p>

            <p
              class="auth-reset-message"
              id="passwordRecoveryMessage"
              role="status"
              aria-live="polite"
            ></p>

            <button
              class="auth-reset-submit"
              type="submit"
              id="passwordRecoverySubmit"
            >
              Guardar nueva contraseña
            </button>
          </form>

          <p class="auth-reset-legal">
            Tu contraseña se actualiza de forma segura y privada.
          </p>
        </article>
      </section>
    `;

    document.body.appendChild(modal);

    modal
      .querySelector('#passwordRecoveryForm')
      .addEventListener('submit', async event => {
        event.preventDefault();

        const password =
          modal.querySelector('#recoveryPassword').value;

        const confirmation =
          modal.querySelector('#recoveryPasswordConfirm').value;

        const message =
          modal.querySelector('#passwordRecoveryMessage');

        const submit =
          modal.querySelector('#passwordRecoverySubmit');

        message.textContent = '';
        message.className = 'auth-message';

        if (password.length < 6) {
          message.textContent =
            'La contraseña debe tener al menos 6 caracteres.';
          message.classList.add('error');
          return;
        }

        if (password !== confirmation) {
          message.textContent =
            'Las contraseñas no coinciden.';
          message.classList.add('error');
          return;
        }

        submit.disabled = true;
        submit.textContent = 'Guardando…';

        const { error } =
          await db.auth.updateUser({
            password
          });

        submit.disabled = false;
        submit.textContent =
          'Guardar nueva contraseña';

        if (error) {
          console.error(
            'Rooms: error actualizando contraseña',
            error
          );

          message.textContent =
            'No hemos podido cambiar la contraseña. Inténtalo de nuevo.';
          message.classList.add('error');
          return;
        }

        message.className =
          'auth-reset-message success';

        message.textContent =
          'Contraseña actualizada correctamente.';

        setTimeout(() => {
          modal.classList.remove('open');
          modal.setAttribute(
            'aria-hidden',
            'true'
          );

          document.body.style.overflow = '';

          notify(
            'Contraseña actualizada'
          );
        }, 700);
      });

    return modal;
  }


  function openPasswordRecoveryModal() {
    const modal =
      ensurePasswordRecoveryModal();

    showModal(modal);

    setTimeout(() => {
      modal
        .querySelector('#recoveryPassword')
        ?.focus();
    }, 50);
  }


  function translateAuthError(message) {
    const text = String(message || '').toLowerCase();
    if (text.includes('invalid login')) return 'Email o contraseña incorrectos.';
    if (text.includes('already registered')) return 'Ya existe una cuenta con ese email.';
    if (text.includes('password')) return 'La contraseña debe tener al menos 6 caracteres.';
    if (text.includes('email')) return 'Comprueba que el email esté bien escrito.';
    return 'No hemos podido completar el acceso. Inténtalo de nuevo.';
  }

  function normalizePreferencesRecord(preferences) {
    if (!preferences?.answers) return preferences;

    const answers = {
      ...preferences.answers
    };

    const privacy =
      answers.privacy || {};

    const controls =
      privacy.controls || {};

    const validVisibility =
      value =>
        ['public', 'connections', 'private']
          .includes(value);

    const hasLegacyControls =
      ['habits', 'searching', 'posts', 'communities']
        .some(key => typeof controls[key] === 'boolean');

    const modernControls =
      hasLegacyControls
        ? {
            living:
              controls.habits
                ? 'public'
                : 'private',
            search:
              controls.searching
                ? 'public'
                : 'private',
            budget:
              !controls.searching
                ? 'private'
                : privacy.level === 'balanced'
                  ? 'connections'
                  : privacy.level === 'private'
                    ? 'private'
                    : 'public',
            activity:
              controls.posts
                ? 'public'
                : 'private'
          }
        : {
            living:
              validVisibility(controls.living)
                ? controls.living
                : 'public',
            search:
              validVisibility(controls.search)
                ? controls.search
                : 'public',
            budget:
              validVisibility(controls.budget)
                ? controls.budget
                : 'public',
            activity:
              validVisibility(controls.activity)
                ? controls.activity
                : 'public'
          };

    answers.privacy = {
      ...privacy,
      level:
        privacy.level === 'public'
          ? 'open'
          : ['open', 'balanced', 'private', 'custom']
              .includes(privacy.level)
            ? privacy.level
            : 'balanced',
      controls: modernControls
    };

    return {
      ...preferences,
      answers
    };
  }

  async function startSession(
    session,
    { forceHome = false } = {}
  ) {
    state.user = session.user;

    const authGate =
      document.querySelector('#authGate');

    const [
      { data: profile },
      { data: preferences },
      { data: matchPreferences },
      { data: userIntents }
    ] = await Promise.all([
      db.from('profiles')
        .select('*')
        .eq('id', state.user.id)
        .maybeSingle(),

      db.from('onboarding_preferences')
        .select('answers,updated_at')
        .eq('user_id', state.user.id)
        .maybeSingle(),

      db.from('match_preferences')
        .select('*')
        .eq('user_id', state.user.id)
        .maybeSingle(),

      db.from('user_intents')
        .select('intent')
        .eq('user_id', state.user.id)
    ]);

    state.profile = profile;

    state.preferences =
      normalizePreferencesRecord(preferences);

    state.matchPreferences =
      matchPreferences || null;

    state.userIntents =
      (userIntents || [])
        .map(row => row.intent)
        .filter(Boolean);

    if (profile) {
      state.profiles.set(profile.id, profile);
    }

    updateOwnProfile(
      profile,
      state.preferences
    );

    await loadUserBlocks();
    await loadConversationPreferences();

    /*
      Una cuenta con onboarding completado nunca debe
      volver a mostrar el onboarding al restaurar sesión.

      - Login manual: Home.
      - Refresh/restauración: última vista válida.
      - Sin vista guardada: Home.
    */
    if (profile?.onboarding_completed) {
      const allowedViews = new Set([
        'home',
        'explore',
        'communities',
        'household',
        'profile',
        'saved',
        'settings',
        'trust'
      ]);

      let restoredView = 'home';

      if (!forceHome) {
        try {
          const savedView =
            sessionStorage.getItem(
              'rooms:last-main-view'
            );

          if (allowedViews.has(savedView)) {
            restoredView = savedView;
          }
        } catch (error) {
          console.warn(
            'Rooms: no se pudo restaurar la vista anterior.',
            error
          );
        }
      }

      if (
        typeof window.openPersonalizedFeed ===
        'function'
      ) {
        window.openPersonalizedFeed(
          forceHome ? 'home' : restoredView,
          { animate: false }
        );
      } else if (
        typeof window.showMainView ===
        'function'
      ) {
        window.showMainView(
          forceHome ? 'home' : restoredView
        );
      }
    } else {
      if (authGate) {
        authGate.hidden = true;
      }

      const onboarding =
        document.querySelector('#onboarding');

      if (onboarding) {
        onboarding.hidden = false;
        onboarding.classList.remove('leaving');
      }

      document
        .querySelectorAll('.app-shell')
        .forEach(element => {
          element.hidden = true;
        });

      document.body.classList.remove(
        'app-visible',
        'rooms-booting'
      );

      return;
    }

    if (authGate) {
      authGate.hidden = true;
    }

    try {
      await loadOtherProfile();
      await loadRealContent();

      await Promise.all([
        loadSavedItems(),
        loadSavedCollections(),
        loadRealNotifications(),
        loadRealInbox()
      ]);
    } finally {
      document.body.classList.remove(
        'rooms-booting'
      );
    }

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
    state.householdMembersError = false;
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
    try {
      sessionStorage.removeItem(
        'rooms:last-main-view'
      );
    } catch (error) {
      console.warn(
        'Rooms: no se pudo limpiar la vista anterior.',
        error
      );
    }

    document.body.classList.remove('app-visible');

    const authGate =
      document.querySelector('#authGate');

    if (authGate) {
      authGate.hidden = false;
    }

    document.body.classList.remove(
      'rooms-booting'
    );
  }

  function roomsDnaLivingRows(matchPreferences) {
    const dna = window.ROOMS_DNA;
    const livingSelf =
      matchPreferences?.living_self || {};

    const thisOrThat =
      livingSelf.this_or_that || {};

    const scenarios =
      livingSelf.scenarios || {};

    if (!dna) return [];

    const rows = [];

    dna.thisOrThat
      .filter(question =>
        question.target === 'living_self'
      )
      .forEach(question => {
        const selected =
          thisOrThat[question.id];

        const option =
          question.left.id === selected
            ? question.left.label
            : question.right.id === selected
              ? question.right.label
              : null;

        if (option) {
          rows.push([
            question.title,
            option
          ]);
        }
      });

    dna.scenarios.forEach(question => {
      const selected =
        scenarios[question.id];

      const option =
        dna.scenarioScale
          .find(item =>
            item.id === selected
          );

      if (option) {
        rows.push([
          question.title,
          option.label
        ]);
      }
    });

    return rows;
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
    if (trustBadge) trustBadge.textContent = state.user?.email_confirmed_at ? 'EMAIL VERIFICADO ✓' : 'EMAIL SIN VERIFICAR';

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
    const aboutSection = document.querySelector('#ownProfileView [data-own-profile-about]');
    if (aboutSection) {
      const bio = aboutSection.querySelector(':scope > p');
      if (bio) bio.textContent = profile.bio || 'Aún no has añadido información sobre ti.';
      const chips = aboutSection.querySelector('.profile-interest-chips');
      if (chips) {
        const values = (profile.interests || []).map(value => interestLabels[value]).filter(Boolean);
        chips.innerHTML = values.length ? values.map(value => `<span>${escapeHtml(value)}</span>`).join('') : '<span>Sin intereses añadidos</span>';
      }
    }

    const livingGrid =
      document.querySelector(
        '#ownProfileView .lifestyle-grid'
      );

    if (livingGrid) {
      const rows =
        roomsDnaLivingRows(
          state.matchPreferences
        );

      livingGrid.innerHTML =
        rows.length
          ? rows
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
        ? 'Completar este dato hará que tu perfil tenga más información.'
        : 'Ya tienes añadida la información principal de tu perfil.';
    }

    const completionAction = document.querySelector(
      '#ownProfileView .profile-completion > button'
    );

    if (completionAction) {
      if (!missing) {
        completionAction.hidden = true;
        delete completionAction.dataset.profileCompletionAction;
      } else {
        completionAction.hidden = false;

        const actionLabels = {
          'fecha de entrada': 'Añadir fecha →',
          'bio': 'Añadir bio →',
          'intereses': 'Añadir intereses →'
        };

        completionAction.textContent =
          actionLabels[missing] || 'Completar perfil →';

        completionAction.dataset.profileCompletionAction =
          missing === 'fecha de entrada'
            ? 'search'
            : 'profile';
      }
    }

    const activity = document.querySelector('#ownActivityPreview');
    if (activity && !state.user) activity.innerHTML = '<small>TODAVÍA VACÍO</small><p>Aquí aparecerá tu actividad.</p>';

    updateTrustView();
    updateAccountView();
  }

  function updateTrustView() {
    const profile = state.profile || {};

    const emailVerified =
      Boolean(state.user?.email_confirmed_at);

    const hasPhoto =
      Boolean(profile.avatar_url);

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
      state.matchPreferences?.living_self &&
        Object.keys(
          state.matchPreferences.living_self
        ).length
    ];

    const completion =
      Math.round(
        (
          completionFields.filter(Boolean).length /
          completionFields.length
        ) * 100
      ) || 0;

    const profileComplete =
      completion >= 80;

    const acceptedConnections =
      [...state.connectionsByUser.values()]
        .filter(connection =>
          connection.status === 'accepted'
        )
        .length;

    const hasConnections =
      acceptedConnections > 0;

    const signalCount = [
      emailVerified,
      hasPhoto,
      profileComplete,
      hasConnections
    ].filter(Boolean).length;

    const title =
      document.querySelector(
        '#trustView .subpage-header h1'
      );

    const level =
      document.querySelector(
        '#trustView .trust-level-card strong'
      );

    const copy =
      document.querySelector(
        '#trustView .trust-level-card p'
      );

    if (title) {
      title.textContent =
        'Señales de confianza';
    }

    if (level) {
      level.textContent =
        `${signalCount} de 4 señales`;
    }

    if (copy) {
      copy.textContent =
        'Rooms muestra señales objetivas de tu actividad y perfil. No asignamos una nota personal ni un nivel de fiabilidad.';
    }

    const levels =
      document.querySelector(
        '#trustView .trust-levels'
      );

    if (levels) {
      levels.innerHTML = `
        <span class="${emailVerified ? 'done' : ''}">
          Email ${emailVerified ? '✓' : ''}
        </span>

        <span class="${hasPhoto ? 'done' : ''}">
          Foto ${hasPhoto ? '✓' : ''}
        </span>

        <span class="${profileComplete ? 'done' : ''}">
          Perfil ${profileComplete ? '✓' : ''}
        </span>

        <span class="${hasConnections ? 'done' : ''}">
          Conexiones ${hasConnections ? '✓' : ''}
        </span>
      `;
    }

    const signals =
      document.querySelector(
        '#trustView .trust-signals-grid'
      );

    if (signals) {
      signals.innerHTML = `
        <article>
          <span>${emailVerified ? '✓' : '○'}</span>
          <div>
            <b>Email</b>
            <small>
              ${
                emailVerified
                  ? 'Verificado'
                  : 'Pendiente de verificar'
              }
            </small>
          </div>
        </article>

        <article>
          <span>${hasPhoto ? '✓' : '○'}</span>
          <div>
            <b>Foto de perfil</b>
            <small>
              ${
                hasPhoto
                  ? 'Añadida'
                  : 'Pendiente'
              }
            </small>
          </div>
        </article>

        <article>
          <span>${completion}%</span>
          <div>
            <b>Completitud del perfil</b>
            <small>
              ${
                profileComplete
                  ? 'Información principal añadida'
                  : 'Puedes añadir más información'
              }
            </small>
          </div>
        </article>

        <article>
          <span>${acceptedConnections}</span>
          <div>
            <b>Conexiones aceptadas</b>
            <small>
              ${
                acceptedConnections === 1
                  ? '1 conexión real'
                  : `${acceptedConnections} conexiones reales`
              }
            </small>
          </div>
        </article>
      `;
    }

    const recommendationButton =
      document.querySelector(
        '#trustView .trust-level-card button'
      );

    if (recommendationButton) {
      recommendationButton.id =
        'trustRecommendations';

      const profileComplete =
        completion >= 100;

      recommendationButton.textContent =
        profileComplete
          ? 'Perfil completo ✓'
          : 'Completar perfil →';

      recommendationButton.disabled =
        profileComplete;

      recommendationButton.setAttribute(
        'aria-disabled',
        profileComplete ? 'true' : 'false'
      );
    }

    const reviews =
      document.querySelector(
        '#trustView .reviews-grid'
      );

    if (reviews) {
      reviews.innerHTML = `
        <article class="unverified-review trust-empty-reviews">
          <header>
            <span>SIN RESEÑAS TODAVÍA</span>
          </header>

          <h3>
            Todavía no hay reseñas reales
          </h3>

          <p>
            Cuando Rooms tenga un sistema de reseñas
            verificadas, aparecerán aquí.
          </p>
        </article>
      `;
    }

    const writeReview =
      document.querySelector(
        '#trustView .reviews-heading button'
      );

    if (writeReview) {
      writeReview.hidden = true;
    }

    document
      .querySelectorAll(
        '#ownProfileView [data-open-trust] small'
      )
      .forEach(item => {
        item.textContent =
          `${signalCount} de 4 señales`;
      });
  }

  function updateAccountView() {
    const email = state.user?.email || '';

    const emailNode =
      document.querySelector('#settingsAccountEmail');

    if (emailNode) {
      emailNode.textContent = email || 'Sin email';
    }

    const emailStatus =
      document.querySelector('#settingsEmailStatus');

    if (emailStatus) {
      emailStatus.textContent =
        state.user?.email_confirmed_at
          ? 'Verificado'
          : 'Pendiente de verificar';
    }

    const onboardingEmail =
      document.querySelector('[data-verification="email"]');

    if (onboardingEmail) {
      const verified =
        Boolean(state.user?.email_confirmed_at);

      onboardingEmail.classList.toggle(
        'verified',
        verified
      );

      const icon =
        onboardingEmail.querySelector('.verification-icon');

      const title =
        onboardingEmail.querySelector('b');

      const copy =
        onboardingEmail.querySelector('small');

      const status =
        onboardingEmail.querySelector('em');

      if (icon) {
        icon.textContent = verified ? '✓' : '1';
      }

      if (title) {
        title.textContent =
          verified ? 'Email verificado' : 'Email';
      }

      if (copy) {
        copy.textContent =
          verified
            ? 'Tu correo está confirmado.'
            : 'Tu correo todavía no está confirmado.';
      }

      if (status) {
        status.textContent =
          verified ? 'LISTO' : 'PENDIENTE';
      }
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
     * La compatibilidad puede revelar indirectamente hábitos
     * de convivencia y preferencias de búsqueda.
     * La ocultamos cuando esos datos no son visibles.
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



  const communityCreateFeature =
    window.ROOMS_COMMUNITY_CREATE_FEATURE?.create({
      db,
      state,
      notify,
      loadMemberCommunities,
      renderFilteredExplore
    });

  if (!communityCreateFeature) {
    throw new Error(
      'Rooms: no se ha cargado Community Create'
    );
  }

  const {
    ensureCreateCommunityModal,
    openCreateCommunityModal,
    closeCreateCommunityModal,
    createCommunity
  } = communityCreateFeature;


  async function loadMemberCommunities(...args) {
    if (!communityMembershipFeature) {
      throw new Error(
        'Rooms: Community Membership no inicializado'
      );
    }

    return communityMembershipFeature
      .loadMemberCommunities(...args);
  }

  function renderMemberCommunities(...args) {
    if (!communityMembershipFeature) {
      throw new Error(
        'Rooms: Community Membership no inicializado'
      );
    }

    return communityMembershipFeature
      .renderMemberCommunities(...args);
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

    refreshOwnActivity();
    await loadHousehold();
    await loadMemberCommunities();
    await loadIncomingConnections();
    await loadCommunityPostInteractions();
    await handleIncomingHouseholdInvite();
    handleIncomingListingLink();
  }

  function handleIncomingListingLink() {
    const params =
      new URLSearchParams(window.location.search);

    const listingId =
      params.get('listing');

    if (!listingId) return;

    const listing =
      state.listings?.get(listingId);

    params.delete('listing');

    const nextSearch =
      params.toString();

    const nextUrl =
      `${window.location.pathname}${
        nextSearch ? `?${nextSearch}` : ''
      }${window.location.hash || ''}`;

    window.history.replaceState(
      {},
      '',
      nextUrl
    );

    if (!listing) {
      notify('Esta vivienda ya no está disponible');
      return;
    }

    openRealListingDetail(listing);
  }


  function renderRealFeed(listings, profiles, posts, communities) {
    const feed = document.querySelector('#personalFeed');
    if (!feed) return;

    const visibleProfiles =
      (profiles || []).filter(profile =>
        profile?.id &&
        !state.blockedUsers?.has(profile.id)
      );

    const items = [
      ...listings.map(item => ({
        type: 'listing',
        created_at: item.created_at,
        html: renderListingCard(item)
      })),
      ...visibleProfiles.map(item => ({
        type: 'profile',
        created_at: item.created_at,
        html: renderPersonCard(item)
      })),
      ...communities.map(item => ({
        type: 'community',
        created_at: item.created_at,
        html: renderCommunityCard(item)
      })),
      ...posts.map(item => ({
        type: 'post',
        created_at: item.created_at,
        html: renderPostCard(item)
      }))
    ]
      .filter(item => item.html)
      .sort((a, b) =>
        new Date(b.created_at || 0) -
        new Date(a.created_at || 0)
      );

    const cards = items.map(item => item.html);

    feed.innerHTML = cards.length ? cards.join('') : `
      <section class="real-feed-empty">
        <span>✦</span><h2>Todavía no hay contenido en Rooms</h2>
        <p>Los perfiles, viviendas y publicaciones aparecerán aquí cuando la comunidad los cree.</p>
        <button type="button" data-open-real-publish>Crear lo primero</button>
      </section>`;

    const activeFeedFilter =
      document.querySelector('[data-feed-filter].active');

    const activeFeedType =
      activeFeedFilter?.dataset.feedFilter || 'all';

    document
      .querySelectorAll('#personalFeed [data-feed-type]')
      .forEach(card => {
        card.hidden =
          activeFeedType !== 'all' &&
          card.dataset.feedType !== activeFeedType;
      });
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
      listing.zone || null;

    const title =
      listing.title ||
      (zone
        ? `${kind} en ${zone}`
        : kind);

    const price =
      listing.price != null
        ? Number(listing.price).toLocaleString('es-ES')
        : null;

    const available =
      listing.available_from
        ? new Intl.DateTimeFormat('es-ES', {
            day: 'numeric',
            month: 'short'
          }).format(
            new Date(`${listing.available_from}T00:00:00`)
          )
        : null;

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
              ${
                price
                  ? `
                    <b>${price} €</b>
                    <span>/ mes</span>
                  `
                  : '<b>Precio sin definir</b>'
              }
            </div>
          </div>

          <div class="rooms-home-property-availability">
            ${
              available
                ? `Disponible ${escapeHtml(available)}`
                : 'Disponibilidad sin definir'
            }
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
    const zone = profile.zones?.[0] || null;
    const seeking = labelSeeking(profile.seeking?.[0]);
    const traits = (profile.traits || []).slice(0, 3);
    const traitLabels = { tidy: 'Ordenado', social: 'Sociable', calm: 'Tranquilo', independent: 'Independiente', cook: 'Cocinillas', early: 'Madrugador', night: 'Nocturno' };
    return `<article class="feed-card person-feed-card" data-feed-type="person" data-real-user="${profile.id}" tabindex="0">
      <div class="person-card-photo real-person-photo">
        ${profile.avatar_url ? `<img src="${escapeHtml(profile.avatar_url)}" alt="${escapeHtml(name)}">` : `<div class="real-person-placeholder">${escapeHtml(initials(name))}</div>`}
        <div class="person-card-tools"><button type="button" class="${state.savedItems?.has(`person:${profile.id}`) ? 'saved' : ''}" data-person-save data-save-kind="person" data-save-id="${profile.id}" aria-label="${state.savedItems?.has(`person:${profile.id}`) ? 'Eliminar perfil de Guardados' : 'Guardar perfil'}">${state.savedItems?.has(`person:${profile.id}`) ? '♥' : '♡'}</button></div>
      </div>
      <div class="person-card-body"><h2>${escapeHtml(name)}${profile.age ? `, ${profile.age}` : ''}</h2><p class="person-searching">${escapeHtml(seeking)} · ${escapeHtml(zone || 'Zona sin definir')}</p>
        <div class="person-traits">${traits.length ? traits.map(value => `<span>${escapeHtml(traitLabels[value] || value)}</span>`).join('') : '<span>Sin preferencias de convivencia</span>'}</div>
        <p>${escapeHtml(profile.bio || 'Bio sin completar')}</p>
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
                        ${
                          linkedListing.price != null
                            ? `${Number(
                                linkedListing.price
                              ).toLocaleString('es-ES')} € / mes`
                            : 'Precio sin definir'
                        }
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


  const communityDetailCoreFeature =
    window.ROOMS_COMMUNITY_DETAIL_CORE_FEATURE?.create({
      db,
      state,
      notify,
      renderRealCommunityDetail
    });

  if (!communityDetailCoreFeature) {
    throw new Error(
      'Rooms: no se ha cargado Community Detail Core'
    );
  }

  const {
    openRealCommunity
  } = communityDetailCoreFeature;

  let communityInteractionsFeature = null;

  async function loadCommunityPostInteractions(...args) {
    if (!communityInteractionsFeature) {
      throw new Error(
        'Rooms: Community Interactions no inicializado'
      );
    }

    return communityInteractionsFeature
      .loadCommunityPostInteractions(...args);
  }

  function toggleCommunityPostLike(...args) {
    return communityInteractionsFeature
      .toggleCommunityPostLike(...args);
  }

  function renderCommunityCommentsPanel(...args) {
    return communityInteractionsFeature
      .renderCommunityCommentsPanel(...args);
  }

  function createCommunityPostComment(...args) {
    return communityInteractionsFeature
      .createCommunityPostComment(...args);
  }

  const communityPostsFeature =
    window.ROOMS_COMMUNITY_POSTS_FEATURE?.create({
      state,
      escapeHtml,
      initials: savedFeature.initials,
      relativeTime
    });

  if (!communityPostsFeature) {
    throw new Error(
      'Rooms: no se ha cargado Community Posts'
    );
  }

  const {
    renderCommunityPost
  } = communityPostsFeature;

  communityInteractionsFeature =
    window.ROOMS_COMMUNITY_INTERACTIONS_FEATURE?.create({
      db,
      state,
      notify,
      escapeHtml,
      initials: savedFeature.initials,
      relativeTime,
      renderRealCommunityDetail
    });

  if (!communityInteractionsFeature) {
    throw new Error(
      'Rooms: no se ha cargado Community Interactions'
    );
  }


  let communityDetailRenderFeature = null;

  function renderRealCommunityDetail(...args) {
    if (!communityDetailRenderFeature) {
      throw new Error(
        'Rooms: Community Detail Render no inicializado'
      );
    }

    return communityDetailRenderFeature
      .renderRealCommunityDetail(...args);
  }

  communityDetailRenderFeature =
    window.ROOMS_COMMUNITY_DETAIL_RENDER_FEATURE?.create({
      state,
      escapeHtml,
      initials: savedFeature.initials,
      renderCommunityPost
    });

  if (!communityDetailRenderFeature) {
    throw new Error(
      'Rooms: no se ha cargado Community Detail Render'
    );
  }


  const communityManagementFeature =
    window.ROOMS_COMMUNITY_MANAGEMENT_FEATURE?.create({
      db,
      state,
      notify,
      escapeHtml,
      initials: savedFeature.initials,
      renderRealCommunityDetail,
      loadMemberCommunities,
      renderFilteredExplore,
      renderRealFeed
    });

  if (!communityManagementFeature) {
    throw new Error(
      'Rooms: no se ha cargado Community Management'
    );
  }

  const {
    ensureManageCommunityModal,
    renderManageCommunityMembers,
    openManageCommunityModal,
    closeManageCommunityModal,
    saveCommunityManagement
  } = communityManagementFeature;

  communityMembershipFeature =
    window.ROOMS_COMMUNITY_MEMBERSHIP_FEATURE?.create({
      db,
      state,
      notify,
      escapeHtml,
      openRealCommunity
    });

  if (!communityMembershipFeature) {
    throw new Error(
      'Rooms: no se ha cargado Community Membership'
    );
  }

  const {
    toggleRealCommunityMembership
  } = communityMembershipFeature;

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
    const title =
      item.title ||
      (item.zone
        ? `${item.zone} · ${kind}`
        : kind);

    const specs = [
      item.rooms ? `${item.rooms} hab` : null,
      item.baths ? `${item.baths} baño${Number(item.baths) === 1 ? '' : 's'}` : null,
      item.area ? `${item.area} m²` : null
    ].filter(Boolean);

    const featureChips = Array.isArray(item.features)
      ? item.features.filter(Boolean).slice(0, 3)
      : [];

    let availableLabel = '';

    if (item.available_from) {
      const date = new Date(`${item.available_from}T12:00:00`);

      if (!Number.isNaN(date.getTime())) {
        availableLabel = date.toLocaleDateString('es-ES', {
          day: 'numeric',
          month: 'short'
        });
      }
    }

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

        <h2>${escapeHtml(item.zone || 'Zona sin definir')}</h2>

        <p class="real-map-card-price">
          ${
            item.price != null
              ? `
                <b>${Number(item.price).toLocaleString('es-ES')} €</b>
                <span>/ mes</span>
              `
              : '<b>Precio sin definir</b>'
          }
        </p>

        ${
          specs.length
            ? `<p class="real-map-card-specs">
                ${specs.map(escapeHtml).join(' · ')}
              </p>`
            : ''
        }

        ${
          featureChips.length
            ? `<div class="real-map-card-features">
                ${featureChips.map(feature => `
                  <span>${escapeHtml(feature)}</span>
                `).join('')}
              </div>`
            : ''
        }

        ${
          availableLabel
            ? `<p class="real-map-card-availability">
                Disponible ${escapeHtml(availableLabel)}
              </p>`
            : ''
        }

        <button
          type="button"
          data-real-map-open="${item.id}"
        >
          Ver vivienda →
        </button>
      </div>
    `;
  }

  let exploreLeafletMap = null;
  let exploreLeafletMarkers = new Map();

  function destroyExploreLeafletMap() {
    if (exploreLeafletMap) {
      exploreLeafletMap.remove();
      exploreLeafletMap = null;
    }

    exploreLeafletMarkers.clear();
  }

  function initExploreLeafletMap(listings) {
    const container = document.querySelector('#realExploreMap');

    if (!container || !window.L) return;

    destroyExploreLeafletMap();

    const madridCenter = [40.4168, -3.7038];

    exploreLeafletMap = window.L.map(container, {
      zoomControl: true,
      attributionControl: true
    }).setView(madridCenter, 12);

    window.L.tileLayer(
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
      }
    ).addTo(exploreLeafletMap);

    const validListings = listings.filter(item => {
      const latitude = Number(item.latitude);
      const longitude = Number(item.longitude);

      return (
        Number.isFinite(latitude) &&
        Number.isFinite(longitude) &&
        latitude >= -90 &&
        latitude <= 90 &&
        longitude >= -180 &&
        longitude <= 180
      );
    });

    const bounds = [];

    validListings.forEach((item, index) => {
      const latitude = Number(item.latitude);
      const longitude = Number(item.longitude);
      const price =
        item.price != null
          ? `${Number(item.price).toLocaleString('es-ES')} €`
          : 'Sin precio';

      const icon = window.L.divIcon({
        className:
          `rooms-map-price-marker${index === 0 ? ' active' : ''}`,
        html: `<span>${escapeHtml(price)}</span>`,
        iconSize: null,
        iconAnchor: [0, 0]
      });

      const marker = window.L.marker(
        [latitude, longitude],
        {
          icon,
          title: item.title || item.zone || 'Vivienda'
        }
      ).addTo(exploreLeafletMap);

      marker.on('click', () => {
        const card = document.querySelector('#realMapCard');

        if (card) {
          card.innerHTML = renderRealMapCard(item);
          card.dataset.mapSelected = item.id;
        }

        document
          .querySelectorAll('.rooms-map-price-marker')
          .forEach(element => {
            element.classList.remove('active');
          });

        const markerElement = marker.getElement();
        if (markerElement) {
          markerElement.classList.add('active');
        }
      });

      exploreLeafletMarkers.set(item.id, marker);
      bounds.push([latitude, longitude]);
    });

    if (bounds.length > 1) {
      exploreLeafletMap.fitBounds(bounds, {
        padding: [55, 55],
        maxZoom: 14
      });
    } else if (bounds.length === 1) {
      exploreLeafletMap.setView(bounds[0], 14);
    }

    function updateVisibleMapListings() {
      if (!exploreLeafletMap) return;

      const mapBounds = exploreLeafletMap.getBounds();

      const visibleListings = validListings.filter(item => {
        return mapBounds.contains([
          Number(item.latitude),
          Number(item.longitude)
        ]);
      });

      const count = document.querySelector('#mapVisibleCount');

      if (count) {
        count.textContent =
          `${visibleListings.length} ${
            visibleListings.length === 1
              ? 'vivienda en esta zona'
              : 'viviendas en esta zona'
          }`;

        count.hidden = false;
      }

      const card = document.querySelector('#realMapCard');

      if (!visibleListings.length) {
        if (card) {
          card.hidden = true;
          card.dataset.mapSelected = '';
        }

        document
          .querySelectorAll('.rooms-map-price-marker')
          .forEach(element => {
            element.classList.remove('active');
          });

        return;
      }

      if (card) {
        const selectedId = card.dataset.mapSelected;

        const selectedStillVisible = visibleListings.some(
          item => item.id === selectedId
        );

        if (!selectedStillVisible) {
          const next = visibleListings[0];

          card.hidden = false;
          card.dataset.mapSelected = next.id;
          card.innerHTML = renderRealMapCard(next);

          document
            .querySelectorAll('.rooms-map-price-marker')
            .forEach(element => {
              element.classList.remove('active');
            });

          const marker = exploreLeafletMarkers.get(next.id);
          const markerElement = marker?.getElement();

          if (markerElement) {
            markerElement.classList.add('active');
          }
        } else {
          card.hidden = false;
        }
      }
    }

    exploreLeafletMap.on('moveend zoomend', updateVisibleMapListings);

    window.setTimeout(() => {
      if (exploreLeafletMap) {
        exploreLeafletMap.invalidateSize();
        updateVisibleMapListings();
      }
    }, 80);
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
                        <small>${escapeHtml(item.zone || 'Zona sin definir')}</small>
                        <h2>${escapeHtml(title)}</h2>
                      </div>

                      <p class="explore-property-price">
                        ${
                          item.price != null
                            ? `
                              <b>${Number(item.price).toLocaleString('es-ES')} €</b>
                              <span>/ mes</span>
                            `
                            : '<b>Precio sin definir</b>'
                        }
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
      destroyExploreLeafletMap();

      if (!listings.length) {
        map.innerHTML = `
          <section class="real-feed-empty compact explore-map-pending">
            <span>⌖</span>
            <h2>Sin viviendas en el mapa</h2>
            <p>Cuando haya anuncios publicados aparecerán aquí.</p>
          </section>
        `;
      } else {
        const mappedListings = listings.filter(item => {
          const latitude = Number(item.latitude);
          const longitude = Number(item.longitude);

          return (
            Number.isFinite(latitude) &&
            Number.isFinite(longitude)
          );
        });

        const first = mappedListings[0] || listings[0];

        map.innerHTML = `
          <div class="real-map-layout">
            <div
              class="rooms-leaflet-map"
              id="realExploreMap"
              aria-label="Mapa de viviendas en Madrid"
            ></div>

            <div class="rooms-map-results-count" id="mapVisibleCount"></div>

            <article
              class="real-map-card"
              id="realMapCard"
              data-map-selected="${first?.id || ''}"
            >
              ${renderRealMapCard(first)}
            </article>
          </div>
        `;

        window.setTimeout(() => {
          initExploreLeafletMap(listings);
        }, 0);
      }
    }
  }

  function refreshOwnActivity(type) {
    if (!state.user) return;
    const active = type || document.querySelector('[data-own-activity].active')?.dataset.ownActivity || 'posts';
    const ownListings = [...state.listings.values()].filter(item => item.owner_id === state.user.id);
    const ownPosts = [...state.posts.values()].filter(item => item.author_id === state.user.id);
    const counts = {
      posts: ownPosts.length,
      listings: ownListings.length
    };

    const tabNames = {
      posts: 'Publicaciones',
      listings: 'Anuncios'
    };

    document
      .querySelectorAll('[data-own-activity]')
      .forEach(tab => {
        const type = tab.dataset.ownActivity;

        tab.textContent =
          `${tabNames[type]} (${counts[type] || 0})`;

        tab.classList.toggle(
          'active',
          type === active
        );
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
          <div><small>${escapeHtml(kind)}</small><h3>${
            listing.price != null
              ? `${Number(listing.price).toLocaleString('es-ES')} €/mes`
              : 'Precio sin definir'
          } · ${escapeHtml(listing.zone || 'Zona sin definir')}</h3><p>${escapeHtml(listing.description || 'Sin descripción')}</p><button type="button" data-edit-listing="${listing.id}">Editar anuncio</button></div>
        </article>`;
      }).join('')}</div>`;
      return;
    }
    if (type === 'posts' && ownPosts.length) {
      target.innerHTML = `<div class="own-real-activity-list">${ownPosts.map(post => `<article class="own-real-post"><small>${relativeTime(post.created_at)}</small><p>${escapeHtml(post.body)}</p></article>`).join('')}</div>`;
      return;
    }
    const labels = {
      posts: 'publicaciones',
      listings: 'anuncios'
    };
    target.innerHTML = `<small>TODAVÍA VACÍO</small><p>Aún no tienes ${labels[type] || 'actividad'}.</p><span>Cuando empieces a usar Rooms aparecerá aquí.</span>`;
  }

  const publishTotals = { room: 3, apartment: 3, mate: 2, external: 3, post: 2 };

  const publishCommunityFieldsFeature =
    window.ROOMS_PUBLISH_COMMUNITY_FIELDS_FEATURE?.create({
      state,
      escapeHtml
    });

  if (!publishCommunityFieldsFeature) {
    throw new Error(
      'Rooms: no se ha cargado Publish Community Fields'
    );
  }

  const {
    selectedCommunityPostType,
    renderCommunityPostFields,
    enhanceCommunityPostComposer
  } = publishCommunityFieldsFeature;

  const publishStepsFeature =
    window.ROOMS_PUBLISH_STEPS_FEATURE?.create({
      state,
      publishTotals,
      selectedCommunityPostType
    });

  if (!publishStepsFeature) {
    throw new Error(
      'Rooms: no se ha cargado Publish Steps'
    );
  }

  const {
    currentPublishType,
    currentPublishStep,
    capturePublishStep
  } = publishStepsFeature;

  function prepareListingLocationField(
    content,
    type,
    step,
    saved
  ) {
    if (
      !content ||
      step !== 0 ||
      !['room', 'apartment'].includes(type)
    ) {
      return;
    }

    const existing =
      content.querySelector('[data-exact-address]');

    if (existing) {
      existing.value =
        saved?.meta?.exactAddress || '';
      return;
    }

    const regularFields =
      [...content.querySelectorAll(
        'input:not([type="file"]),textarea,select'
      )];

    const zoneField = regularFields[0];

    if (!zoneField) return;

    const zoneContainer =
      zoneField.closest('label') ||
      zoneField.parentElement;

    if (!zoneContainer) return;

    /*
      Para vivienda, la zona pública se obtiene automáticamente
      desde la dirección exacta geocodificada.
    */
    zoneField.value = '';
    zoneField.removeAttribute('required');
    zoneField.dataset.autoZoneInput = 'true';
    zoneContainer.hidden = true;
    zoneContainer.dataset.autoZoneField = 'true';

    const wrapper =
      document.createElement('div');

    wrapper.className =
      'publish-private-location';

    wrapper.innerHTML = `
      <label class="publish-private-location-field">
        <span>
          Dirección exacta
          <b>Obligatorio</b>
        </span>

        <input
          type="text"
          data-exact-address
          autocomplete="street-address"
          placeholder="Ej. Calle de Serrano 55, Madrid"
          value="${escapeHtml(saved?.meta?.exactAddress || '')}"
        >
      </label>

      <p class="publish-private-location-help">
        <span>⌖</span>
        <span>
          <b>Tu dirección exacta es privada.</b>
          Solo la usamos para situar la vivienda.
          En Rooms se mostrará una ubicación aproximada.
        </span>
      </p>

      <p
        class="publish-detected-zone"
        data-detected-zone
        hidden
      ></p>
    `;

    zoneContainer.insertAdjacentElement(
      'afterend',
      wrapper
    );
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
    const fields = [...content.querySelectorAll(
      'input:not([type="file"]):not([data-exact-address]):not([data-auto-zone-input]),textarea,select'
    )];

    fields.forEach((field, index) => {
      if (saved) field.value = saved.values[index] || '';
      else if (field.tagName !== 'SELECT') field.value = '';
    });

    prepareListingLocationField(
      content,
      type,
      step,
      saved
    );
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
    preview.innerHTML = `<span>VISTA PREVIA</span><h3>${escapeHtml(values[0] || '—')} €/mes</h3><p>${type === 'apartment' ? 'Piso entero' : 'Habitación'} · ${escapeHtml(values[1] || 'Sin definir')}</p><div>${features.map(item => `<i>${escapeHtml(item)}</i>`).join('')}</div>`;
  }

  async function geocodeListingAddress(address) {
    const cleanAddress =
      String(address || '').trim();

    if (cleanAddress.length < 5) {
      throw new Error(
        'Introduce la dirección exacta de la vivienda'
      );
    }

    const response = await fetch(
      '/api/geocode',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          address: cleanAddress
        })
      }
    );

    let payload = {};

    try {
      payload = await response.json();
    } catch {
      payload = {};
    }

    if (!response.ok) {
      throw new Error(
        payload.error ||
        'No hemos podido localizar esa dirección'
      );
    }

    const latitude =
      Number(payload.latitude);

    const longitude =
      Number(payload.longitude);

    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude)
    ) {
      throw new Error(
        'No hemos podido localizar esa dirección'
      );
    }

    const result = {
      latitude,
      longitude,
      formattedAddress:
        payload.formattedAddress ||
        cleanAddress,
      district:
        payload.district || null
    };

    const detectedZone =
      document.querySelector('[data-detected-zone]');

    if (detectedZone) {
      detectedZone.hidden = false;
      detectedZone.textContent =
        result.district
          ? `Ubicación detectada: ${result.district}, Madrid`
          : 'Ubicación detectada: Madrid';
    }

    return result;
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
      const second =
        state.publishDraft.steps[1] ||
        { values: [], selected: [] };

      const finalStep =
        state.publishDraft.steps[
          publishTotals[type] - 1
        ] || { values: [] };

      const price =
        Number(
          String(first.values[0] || '')
            .replace(/\D/g, '')
        );

      const exactAddress =
        first.meta?.exactAddress || '';

      if (!price) {
        return notify(
          'Añade el precio de la vivienda'
        );
      }

      if (!exactAddress) {
        return notify(
          'Añade la dirección exacta de la vivienda'
        );
      }

      let geocodedLocation;

      try {
        geocodedLocation =
          await geocodeListingAddress(
            exactAddress
          );
      } catch (error) {
        console.error(
          'Rooms: error geocodificando vivienda',
          error
        );

        return notify(
          error?.message ||
          'No hemos podido localizar esa dirección'
        );
      }

      const zone =
        geocodedLocation.district ||
        'Madrid';

      const {
        data: listing,
        error
      } = await db
        .from('listings')
        .insert({
          owner_id: state.user.id,
          kind: type,
          title:
            `${type === 'apartment'
              ? 'Piso'
              : 'Habitación'
            } en ${zone}`,
          zone,
          price,
          available_from:
            first.values[1] || null,
          duration:
            first.values[2] || null,
          rooms:
            second.values[0]
              ? Number(second.values[0])
              : null,
          baths:
            second.values[1]
              ? Number(second.values[1])
              : null,
          area:
            second.values[2]
              ? Number(second.values[2])
              : null,
          furnished:
            second.selected.includes(
              'Amueblado'
            ),
          features:
            second.selected,
          description:
            finalStep.values[0] || null,
          photos: [],
          location_precision:
            'approximate'
        })
        .select()
        .single();

      if (error || !listing) {
        console.error(
          'Rooms: error creando vivienda',
          error
        );

        return notify(
          'No se pudo publicar la vivienda'
        );
      }

      const {
        error: locationError
      } = await db.rpc(
        'set_listing_private_location',
        {
          target_listing_id:
            listing.id,

          target_exact_address:
            geocodedLocation.formattedAddress ||
            exactAddress,

          target_exact_latitude:
            geocodedLocation.latitude,

          target_exact_longitude:
            geocodedLocation.longitude
        }
      );

      if (locationError) {
        console.error(
          'Rooms: error guardando ubicación privada',
          locationError
        );

        const {
          error: rollbackError
        } = await db
          .from('listings')
          .delete()
          .eq('id', listing.id)
          .eq('owner_id', state.user.id);

        if (rollbackError) {
          console.error(
            'Rooms: error revirtiendo vivienda',
            rollbackError
          );
        }

        return notify(
          'No se pudo guardar la ubicación de la vivienda'
        );
      }

      if (
        state.publishDraft.files?.length
      ) {
        const photos =
          await uploadListingPhotos(
            listing.id,
            state.publishDraft.files
          );

        if (photos.length) {
          const {
            error: photoError
          } = await db
            .from('listings')
            .update({ photos })
            .eq('id', listing.id);

          if (photoError) {
            notify(
              'La vivienda se publicó, pero no pudimos vincular todas las fotos'
            );
          }
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


  const publishMediaFeature =
    window.ROOMS_PUBLISH_MEDIA_FEATURE?.create({
      db,
      state
    });

  if (!publishMediaFeature) {
    throw new Error(
      'Rooms: no se ha cargado Publish Media'
    );
  }

  const {
    uploadCommunityPostMedia,
    uploadListingPhotos
  } = publishMediaFeature;


  const listingPhotosFeature =
    window.ROOMS_LISTING_PHOTOS_FEATURE?.create({
      state,
      escapeHtml
    });

  if (!listingPhotosFeature) {
    throw new Error(
      'Rooms: no se ha cargado Listing Photos'
    );
  }

  const {
    renderEditListingPhotos,
    moveEditListingPhoto,
    deleteEditListingPhoto,
    makeEditListingPhotoCover
  } = listingPhotosFeature;


  const listingEditorFeature =
    window.ROOMS_LISTING_EDITOR_FEATURE?.create({
      db,
      state,
      notify,
      showModal,
      renderEditListingPhotos,
      uploadListingPhotos,
      loadRealContent,
      loadSavedItems,
      refreshOwnActivity
    });

  if (!listingEditorFeature) {
    throw new Error(
      'Rooms: no se ha cargado Listing Editor'
    );
  }

  const {
    ensureEditListingModal,
    openEditListing,
    saveListingEdits
  } = listingEditorFeature;


  const listingDeleteFeature =
    window.ROOMS_LISTING_DELETE_FEATURE?.create({
      db,
      state,
      notify,
      hideAllModals,
      loadRealContent,
      loadSavedItems
    });

  if (!listingDeleteFeature) {
    throw new Error(
      'Rooms: no se ha cargado Listing Delete'
    );
  }

  const {
    deleteOwnListing
  } = listingDeleteFeature;


  const publishObserver = new MutationObserver(() => preparePublishStep());
  publishObserver.observe(document.querySelector('#publishFlowContent'), { childList: true });

  function applyTargetProfile(profile) {
    const name = profile.alias || profile.name || 'Usuario de Rooms';
    const age = profile.age ? `, ${profile.age}` : '';
    const zone = profile.zones?.[0] || 'Zona sin definir';
    const seeking = labelSeeking(profile.seeking?.[0]);
    const moveDate = profile.move_in_date
      ? new Intl.DateTimeFormat('es-ES', { month: 'long' }).format(new Date(`${profile.move_in_date}T00:00:00`))
      : 'Sin definir';

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
    return (
      {
        room: 'Busca habitación',
        home: 'Busca piso',
        mates: 'Busca compañeros'
      }[value] || 'Sin definir'
    );
  }

  function formatBudget(profile) {
    const hasMin =
      profile?.budget_min != null &&
      profile.budget_min !== '';

    const hasMax =
      profile?.budget_max != null &&
      profile.budget_max !== '';

    if (!hasMin && !hasMax) {
      return 'Sin definir';
    }

    if (hasMin && hasMax) {
      return `${profile.budget_min}–${profile.budget_max} €`;
    }

    if (hasMin) {
      return `Desde ${profile.budget_min} €`;
    }

    return `Hasta ${profile.budget_max} €`;
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

  function seekingFromIntents(intents = []) {
    const seeking =
      new Set();

    intents.forEach(intent => {
      if (intent === 'find_room') {
        seeking.add('room');
      }

      if (intent === 'find_apartment') {
        seeking.add('home');
      }

      if (
        intent === 'find_mates_for_home' ||
        intent === 'find_mates_to_search'
      ) {
        seeking.add('mates');
      }
    });

    return [...seeking];
  }

  async function saveRoomsDnaOnboarding() {
    if (!state.user) {
      notify('Inicia sesión para guardar tu perfil');
      return false;
    }

    if (
      typeof window.getRoomsDnaOnboardingSnapshot !==
      'function'
    ) {
      console.error(
        'Rooms: no existe snapshot de ROOMS DNA.'
      );

      notify(
        'No se pudieron preparar tus preferencias'
      );

      return false;
    }

    const snapshot =
      window.getRoomsDnaOnboardingSnapshot();

    const match =
      snapshot?.matchPreferences;

    if (
      !match ||
      !snapshot.profile?.name ||
      !snapshot.intents?.length
    ) {
      notify(
        'Completa tu Rooms DNA antes de continuar'
      );

      return false;
    }

    /*
     * Primero creamos/actualizamos el perfil sin marcar
     * todavía el onboarding como completado.
     *
     * Solo se activa onboarding_completed al final,
     * cuando DNA + intenciones + perfil han quedado
     * persistidos correctamente.
     */
    const provisionalProfileResult =
      await db
        .from('profiles')
        .upsert(
          {
            id: state.user.id,
            name: snapshot.profile.name,
            alias: snapshot.profile.name,
            bio: snapshot.profile.bio || null,
            interests: match.interests,
            traits: match.traits,
            seeking:
              seekingFromIntents(
                snapshot.intents
              ),
            onboarding_completed: false
          },
          {
            onConflict: 'id'
          }
        )
        .select()
        .single();

    if (provisionalProfileResult.error) {
      console.error(
        'Rooms: error guardando perfil base.',
        provisionalProfileResult.error
      );

      notify(
        'No se pudo guardar tu perfil'
      );

      return false;
    }

    state.profile =
      provisionalProfileResult.data;

    state.profiles.set(
      state.profile.id,
      state.profile
    );

    const matchResult =
      await db
        .from('match_preferences')
        .upsert(
          {
            user_id: state.user.id,
            version: snapshot.version,
            living_self:
              match.living_self,
            living_importance:
              match.living_importance,
            dealbreakers:
              match.dealbreakers,
            home_preferences:
              match.home_preferences,
            neighborhood_preferences:
              match.neighborhood_preferences,
            interests:
              match.interests,
            traits:
              match.traits,
            updated_at:
              new Date().toISOString()
          },
          {
            onConflict: 'user_id'
          }
        )
        .select()
        .single();

    if (matchResult.error) {
      console.error(
        'Rooms: error guardando ROOMS DNA.',
        matchResult.error
      );

      notify(
        'No se pudo guardar tu Rooms DNA'
      );

      return false;
    }

    const roomsDna =
      snapshot.roomsDna;

    if (
      !roomsDna ||
      !roomsDna.modelVersion
    ) {
      console.error(
        'Rooms: snapshot ROOMS DNA V2 no disponible.'
      );

      notify(
        'No se pudo preparar tu Rooms DNA'
      );

      return false;
    }

    const roomsDnaResult =
      await db
        .from('rooms_dna')
        .upsert(
          {
            user_id:
              state.user.id,

            model_version:
              roomsDna.modelVersion,

            answers:
              roomsDna.answers,

            dimensions:
              roomsDna.dimensions,

            categories:
              roomsDna.categories,

            classification:
              roomsDna.classification,

            evidence:
              roomsDna.evidence,

            calculated_at:
              roomsDna.calculatedAt,

            updated_at:
              new Date().toISOString()
          },
          {
            onConflict: 'user_id'
          }
        )
        .select()
        .single();

    if (roomsDnaResult.error) {
      console.error(
        'Rooms: error guardando ROOMS DNA V2.',
        roomsDnaResult.error
      );

      notify(
        'No se pudo guardar tu Rooms DNA'
      );

      return false;
    }

    const deleteIntentsResult =
      await db
        .from('user_intents')
        .delete()
        .eq(
          'user_id',
          state.user.id
        );

    if (deleteIntentsResult.error) {
      console.error(
        'Rooms: error limpiando intenciones.',
        deleteIntentsResult.error
      );

      notify(
        'No se pudo guardar lo que buscas'
      );

      return false;
    }

    const intentRows =
      [...new Set(snapshot.intents)]
        .map(intent => ({
          user_id:
            state.user.id,
          intent
        }));

    const insertIntentsResult =
      await db
        .from('user_intents')
        .insert(intentRows);

    if (insertIntentsResult.error) {
      console.error(
        'Rooms: error guardando intenciones.',
        insertIntentsResult.error
      );

      notify(
        'No se pudo guardar lo que buscas'
      );

      return false;
    }

    state.userIntents =
      [...new Set(snapshot.intents)];

    /*
     * Reutilizamos la infraestructura real del bucket
     * avatars. Si el usuario eligió foto y falla, el
     * onboarding permanece incompleto.
     */
    if (snapshot.profile.photo) {
      const uploaded =
        await uploadProfilePhoto(
          snapshot.profile.photo,
          {
            silent: true
          }
        );

      if (!uploaded) {
        return false;
      }
    }

    const finalProfileResult =
      await db
        .from('profiles')
        .update({
          onboarding_completed: true,
          interests:
            match.interests,
          traits:
            match.traits
        })
        .eq(
          'id',
          state.user.id
        )
        .select()
        .single();

    if (finalProfileResult.error) {
      console.error(
        'Rooms: error completando onboarding.',
        finalProfileResult.error
      );

      notify(
        'No se pudo completar tu onboarding'
      );

      return false;
    }

    state.profile =
      finalProfileResult.data;

    state.matchPreferences =
      matchResult.data;

    state.profiles.set(
      state.profile.id,
      state.profile
    );

    updateOwnProfile(
      state.profile,
      state.preferences
    );

    notify(
      'Tu Rooms DNA se ha guardado'
    );

    await loadOtherProfile();
    await loadRealContent();

    await Promise.all([
      loadSavedItems(),
      loadSavedCollections(),
      loadRealNotifications(),
      loadRealInbox()
    ]);

    return true;
  }

  window.saveRoomsDnaOnboarding =
    saveRoomsDnaOnboarding;


  function savedDescriptor(target) {
    if (target.dataset.saveId && target.dataset.saveKind) {
      return { item_type: target.dataset.saveKind, item_id: target.dataset.saveId };
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

  window.roomsBackend.loadSavedCollections = loadSavedCollections;
  window.roomsBackend.createSavedCollection = createSavedCollection;
  window.roomsBackend.openSavedCollection = openSavedCollection;




  document.addEventListener('click', event => {
    const openMatch =
      event.target.closest(
        '[data-open-real-match]'
      );

    if (openMatch) {
      event.preventDefault();
      event.stopImmediatePropagation();

      const profile =
        state.profiles.get(
          openMatch.dataset.openRealMatch
        ) ||
        state.targetProfile;

      if (profile) {
        openRealMatch(profile);
      }

      return;
    }

    const closeRealMatch =
      event.target.closest(
        '[data-close-real-match]'
      );

    if (closeRealMatch) {
      event.preventDefault();
      event.stopImmediatePropagation();

      const modal =
        document.querySelector(
          '#matchModal'
        );

      if (modal) {
        modal.classList.remove('open');
        modal.setAttribute(
          'aria-hidden',
          'true'
        );
      }

      document.body.style.overflow = '';

      if (state.targetProfile) {
        openRealUser(
          state.targetProfile
        );
      }

      return;
    }

    const manageSessions =
      event.target.closest(
        '#manageSessions'
      );

    if (manageSessions) {
      event.preventDefault();
      event.stopImmediatePropagation();

      openSessionsManager();
      return;
    }

    const closeSessions =
      event.target.closest(
        '[data-close-sessions]'
      );

    if (closeSessions) {
      event.preventDefault();
      event.stopImmediatePropagation();

      const modal =
        document.querySelector(
          '#sessionsModal'
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

    const signOutOthers =
      event.target.closest(
        '#signOutOtherSessions'
      );

    if (signOutOthers) {
      event.preventDefault();
      event.stopImmediatePropagation();

      signOutOtherSessions();
      return;
    }

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
        '[data-community-publish]'
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
        '[data-manage-community]'
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


    const livingChoice =
      event.target.closest('[data-living-choice]');

    if (livingChoice) {
      const [category, option] =
        livingChoice.dataset.livingChoice.split(':');

      state.living[category] = {
        ...(state.living[category] || {}),
        option: Number(option)
      };
    }

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


  /* HOME — keyboard access for real cards */
  document.addEventListener('keydown', event => {
    if (event.key !== 'Enter' && event.key !== ' ') return;

    const listingCard =
      event.target.closest('[data-real-listing][tabindex="0"]');

    if (listingCard) {
      event.preventDefault();

      const listing =
        state.listings.get(listingCard.dataset.realListing);

      if (listing) {
        openRealListingDetail(listing);
      }

      return;
    }

    const userCard =
      event.target.closest('[data-real-user][tabindex="0"]');

    if (userCard) {
      event.preventDefault();

      const profile =
        state.profiles.get(userCard.dataset.realUser);

      if (profile) {
        openRealUser(profile);
      }
    }
  });

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
      if (
        snapshot &&
        snapshot.step === 0 &&
        ['room', 'apartment'].includes(snapshot.type) &&
        (!snapshot.values[0] || !snapshot.meta?.exactAddress)
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
        notify('Añade el precio y la dirección exacta para continuar');
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

  function readAuthUrlError() {
    const hash =
      window.location.hash.startsWith('#')
        ? window.location.hash.slice(1)
        : '';

    if (!hash) return null;

    const params =
      new URLSearchParams(hash);

    const error =
      params.get('error');

    const code =
      params.get('error_code');

    const description =
      params.get('error_description');

    if (!error && !code) {
      return null;
    }

    const result = {
      error,
      code,
      description
    };

    window.history.replaceState(
      {},
      '',
      `${window.location.pathname}${window.location.search}`
    );

    return result;
  }

  const startupAuthUrlError =
    readAuthUrlError();

  db.auth.onAuthStateChange((event, session) => {
    if (
      event === 'PASSWORD_RECOVERY' &&
      session
    ) {
      manualAuthNavigationPending = false;

      startSession(
        session,
        { forceHome: false }
      );

      setTimeout(
        openPasswordRecoveryModal,
        0
      );

      return;
    }

    if (session) {
      const forceHome =
        event === 'SIGNED_IN' &&
        manualAuthNavigationPending;

      manualAuthNavigationPending = false;

      startSession(session, { forceHome });
    } else if (event === 'SIGNED_OUT') {
      manualAuthNavigationPending = false;
      endSession();
    }
  });

  db.auth.getSession().then(async ({ data }) => {
    const expiredAuthLink =
      startupAuthUrlError?.code === 'otp_expired';

    if (data.session) {
      await startSession(data.session, {
        forceHome: false
      });

      if (expiredAuthLink) {
        notify(
          'El enlace de recuperación ha caducado. Tu sesión actual sigue activa.'
        );
      }

      return;
    }

    const authGate =
      document.querySelector('#authGate');

    if (authGate) {
      authGate.hidden = false;
    }

    if (expiredAuthLink) {
      const message =
        document.querySelector('#authMessage');

      if (message) {
        message.className =
          'auth-message';

        message.textContent =
          'Este enlace de recuperación ha caducado. Solicita uno nuevo para cambiar tu contraseña.';
      }
    }

    document.body.classList.remove(
      'rooms-booting'
    );
  });
  function ensureLivingEditorModal() {
    let modal =
      document.querySelector(
        '#livingEditorModal'
      );

    if (modal) return modal;

    const dna =
      window.ROOMS_DNA;

    modal =
      document.createElement('div');

    modal.className = 'modal';
    modal.id = 'livingEditorModal';
    modal.setAttribute(
      'aria-hidden',
      'true'
    );

    modal.innerHTML = `
      <div
        class="backdrop"
        data-close-living-editor>
      </div>

      <article class="detail living-editor-shell">
        <header>
          <div>
            <small>ROOMS DNA</small>
            <h2>Cómo vivo</h2>
            <p>
              Actualiza las respuestas que Rooms utiliza
              para calcular compatibilidad de convivencia.
            </p>
          </div>

          <button
            type="button"
            data-close-living-editor
            aria-label="Cerrar">×</button>
        </header>

        <form id="livingEditorForm">

          <div class="living-editor-groups">

            ${dna.thisOrThat
              .filter(question =>
                question.target === 'living_self'
              )
              .map(question => `
                <section class="living-editor-group">
                  <small>${question.title}</small>

                  <div>
                    <button
                      type="button"
                      data-living-dna-this="${question.id}"
                      data-living-dna-value="${question.left.id}"
                      aria-pressed="false">
                      ${question.left.label}
                    </button>

                    <button
                      type="button"
                      data-living-dna-this="${question.id}"
                      data-living-dna-value="${question.right.id}"
                      aria-pressed="false">
                      ${question.right.label}
                    </button>
                  </div>
                </section>
              `)
              .join('')}

            ${dna.scenarios
              .map(question => `
                <section class="living-editor-group">
                  <small>${question.title}</small>

                  <div>
                    ${dna.scenarioScale
                      .map(option => `
                        <button
                          type="button"
                          data-living-dna-scenario="${question.id}"
                          data-living-dna-value="${option.id}"
                          aria-pressed="false">
                          ${option.label}
                        </button>
                      `)
                      .join('')}
                  </div>
                </section>
              `)
              .join('')}

            ${dna.dynamicImportance
              .map(question => `
                <section class="living-editor-group">
                  <small>${question.prompt}</small>

                  <div>
                    ${dna.importanceScale
                      .map(option => `
                        <button
                          type="button"
                          data-living-dna-importance="${question.id}"
                          data-living-dna-value="${option.id}"
                          aria-pressed="false">
                          ${option.label}
                        </button>
                      `)
                      .join('')}
                  </div>
                </section>
              `)
              .join('')}

            ${dna.dealbreakers
              .map(question => `
                <section class="living-editor-group">
                  <small>${question.label}</small>

                  <div>
                    ${dna.dealbreakerScale
                      .map(option => `
                        <button
                          type="button"
                          data-living-dna-dealbreaker="${question.id}"
                          data-living-dna-value="${option.id}"
                          aria-pressed="false">
                          ${option.label}
                        </button>
                      `)
                      .join('')}
                  </div>
                </section>
              `)
              .join('')}

          </div>

          <button
            class="cta"
            type="submit">
            Guardar cambios
          </button>
        </form>
      </article>
    `;

    document.body.appendChild(modal);

    const selectionGroups = [
      'data-living-dna-this',
      'data-living-dna-scenario',
      'data-living-dna-importance',
      'data-living-dna-dealbreaker'
    ];

    selectionGroups.forEach(attribute => {
      modal
        .querySelectorAll(`[${attribute}]`)
        .forEach(button => {
          button.addEventListener(
            'click',
            () => {
              const value =
                button.getAttribute(attribute);

              modal
                .querySelectorAll(
                  `[${attribute}="${value}"]`
                )
                .forEach(item => {
                  const active =
                    item === button;

                  item.classList.toggle(
                    'active',
                    active
                  );

                  item.setAttribute(
                    'aria-pressed',
                    active
                      ? 'true'
                      : 'false'
                  );
                });
            }
          );
        });
    });

    modal
      .querySelector('#livingEditorForm')
      .addEventListener(
        'submit',
        async event => {
          event.preventDefault();

          const current =
            state.matchPreferences || {};

          const livingSelf = {
            ...(
              current.living_self || {}
            ),

            this_or_that: {
              ...(
                current.living_self
                  ?.this_or_that || {}
              )
            },

            scenarios: {
              ...(
                current.living_self
                  ?.scenarios || {}
              )
            }
          };

          modal
            .querySelectorAll(
              '[data-living-dna-this].active'
            )
            .forEach(button => {
              livingSelf.this_or_that[
                button.dataset.livingDnaThis
              ] =
                button.dataset.livingDnaValue;
            });

          modal
            .querySelectorAll(
              '[data-living-dna-scenario].active'
            )
            .forEach(button => {
              livingSelf.scenarios[
                button.dataset.livingDnaScenario
              ] =
                button.dataset.livingDnaValue;
            });

          const livingImportance = {
            ...(
              current.living_importance ||
              {}
            )
          };

          modal
            .querySelectorAll(
              '[data-living-dna-importance].active'
            )
            .forEach(button => {
              livingImportance[
                button.dataset
                  .livingDnaImportance
              ] =
                button.dataset.livingDnaValue;
            });

          const dealbreakers = {
            ...(
              current.dealbreakers ||
              {}
            )
          };

          modal
            .querySelectorAll(
              '[data-living-dna-dealbreaker].active'
            )
            .forEach(button => {
              dealbreakers[
                button.dataset
                  .livingDnaDealbreaker
              ] =
                button.dataset.livingDnaValue ===
                'dealbreaker';
            });

          const { data, error } =
            await db
              .from('match_preferences')
              .update({
                living_self:
                  livingSelf,

                living_importance:
                  livingImportance,

                dealbreakers,

                updated_at:
                  new Date().toISOString()
              })
              .eq(
                'user_id',
                state.user.id
              )
              .select()
              .single();

          if (error) {
            console.error(
              'Rooms: error actualizando ROOMS DNA',
              error
            );

            notify(
              'No se pudieron guardar tus hábitos'
            );

            return;
          }

          state.matchPreferences =
            data;

          updateOwnProfile(
            state.profile,
            state.preferences
          );

          modal.classList.remove('open');
          modal.setAttribute(
            'aria-hidden',
            'true'
          );

          document.body.style.overflow =
            '';

          notify(
            'Rooms DNA actualizado'
          );
        }
      );

    return modal;
  }

  function openLivingEditor() {
    if (!state.user) return;

    const modal =
      ensureLivingEditorModal();

    const current =
      state.matchPreferences || {};

    const livingSelf =
      current.living_self || {};

    const thisOrThat =
      livingSelf.this_or_that || {};

    const scenarios =
      livingSelf.scenarios || {};

    modal
      .querySelectorAll(
        '[data-living-dna-this]'
      )
      .forEach(button => {
        const active =
          thisOrThat[
            button.dataset.livingDnaThis
          ] ===
          button.dataset.livingDnaValue;

        button.classList.toggle(
          'active',
          active
        );

        button.setAttribute(
          'aria-pressed',
          active ? 'true' : 'false'
        );
      });

    modal
      .querySelectorAll(
        '[data-living-dna-scenario]'
      )
      .forEach(button => {
        const active =
          scenarios[
            button.dataset
              .livingDnaScenario
          ] ===
          button.dataset.livingDnaValue;

        button.classList.toggle(
          'active',
          active
        );

        button.setAttribute(
          'aria-pressed',
          active ? 'true' : 'false'
        );
      });

    modal
      .querySelectorAll(
        '[data-living-dna-importance]'
      )
      .forEach(button => {
        const active =
          current.living_importance?.[
            button.dataset
              .livingDnaImportance
          ] ===
          button.dataset.livingDnaValue;

        button.classList.toggle(
          'active',
          active
        );

        button.setAttribute(
          'aria-pressed',
          active ? 'true' : 'false'
        );
      });

    modal
      .querySelectorAll(
        '[data-living-dna-dealbreaker]'
      )
      .forEach(button => {
        const value =
          Boolean(
            current.dealbreakers?.[
              button.dataset
                .livingDnaDealbreaker
            ]
          )
            ? 'dealbreaker'
            : 'adapt';

        const active =
          value ===
          button.dataset.livingDnaValue;

        button.classList.toggle(
          'active',
          active
        );

        button.setAttribute(
          'aria-pressed',
          active ? 'true' : 'false'
        );
      });

    modal.classList.add('open');
    modal.setAttribute(
      'aria-hidden',
      'false'
    );

    document.body.style.overflow =
      'hidden';
  }

  document.addEventListener('click', event => {
    const livingEdit = event.target.closest('[data-open-living-editor]');

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
    let modal =
      document.querySelector(
        '#searchPreferencesModal'
      );

    if (modal) return modal;

    modal =
      document.createElement('div');

    modal.className = 'modal';
    modal.id =
      'searchPreferencesModal';

    modal.setAttribute(
      'aria-hidden',
      'true'
    );

    modal.innerHTML = `
      <div
        class="backdrop"
        data-close-search-preferences>
      </div>

      <article class="detail search-preferences-shell">
        <header>
          <div>
            <small>TU BÚSQUEDA</small>
            <h2>Qué busco</h2>
            <p>
              Puedes cambiar lo que necesitas ahora
              sin modificar tu Rooms DNA.
            </p>
          </div>

          <button
            type="button"
            data-close-search-preferences
            aria-label="Cerrar">×</button>
        </header>

        <form id="searchPreferencesForm">

          <section class="search-editor-section">
            <small>¿QUÉ QUIERES HACER?</small>

            <div class="search-editor-options">
              <button
                type="button"
                data-search-intent="find_room">
                Encontrar una habitación
              </button>

              <button
                type="button"
                data-search-intent="find_apartment">
                Encontrar un piso
              </button>

              <button
                type="button"
                data-search-intent="find_mates_for_home">
                Compañeros para mi casa
              </button>

              <button
                type="button"
                data-search-intent="find_mates_to_search">
                Compañeros para buscar juntos
              </button>
            </div>
          </section>

          <section class="search-editor-section">
            <label>
              Zonas
              <input
                id="searchZones"
                type="text"
                placeholder="Chamberí, Moncloa, Retiro">
              <small>
                Separa varias zonas con comas.
              </small>
            </label>
          </section>

          <section class="search-editor-section">
            <small>PRESUPUESTO MENSUAL</small>

            <div class="search-budget-grid">
              <label>
                Mínimo
                <input
                  id="searchBudgetMin"
                  type="number"
                  min="0"
                  step="50"
                  placeholder="600">
              </label>

              <label>
                Máximo
                <input
                  id="searchBudgetMax"
                  type="number"
                  min="0"
                  step="50"
                  placeholder="1000">
              </label>
            </div>

            <label class="search-over-budget">
              <input
                id="searchBudgetOpen"
                type="checkbox">
              Estoy abierto/a a más de 4.000 €
            </label>
          </section>

          <section class="search-editor-section">
            <small>ENTRADA</small>

            <div class="search-date-grid">
              <label>
                Fecha
                <input
                  id="searchMoveDate"
                  type="date">
              </label>

              <label class="search-flexible">
                <input
                  id="searchMoveFlexible"
                  type="checkbox">
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

          <button
            class="cta"
            type="submit">
            Guardar búsqueda
          </button>
        </form>
      </article>
    `;

    document.body.appendChild(modal);

    modal
      .querySelectorAll(
        '[data-search-intent]'
      )
      .forEach(button => {
        button.addEventListener(
          'click',
          () => {
            const active =
              !button.classList.contains(
                'active'
              );

            button.classList.toggle(
              'active',
              active
            );

            button.setAttribute(
              'aria-pressed',
              active ? 'true' : 'false'
            );
          }
        );
      });

    modal
      .querySelectorAll(
        '[data-search-duration]'
      )
      .forEach(button => {
        button.addEventListener(
          'click',
          () => {
            modal
              .querySelectorAll(
                '[data-search-duration]'
              )
              .forEach(item => {
                const active =
                  item === button;

                item.classList.toggle(
                  'active',
                  active
                );

                item.setAttribute(
                  'aria-pressed',
                  active
                    ? 'true'
                    : 'false'
                );
              });
          }
        );
      });

    modal
      .querySelector(
        '#searchPreferencesForm'
      )
      .addEventListener(
        'submit',
        async event => {
          event.preventDefault();

          const intents = [
            ...modal.querySelectorAll(
              '[data-search-intent].active'
            )
          ].map(
            button =>
              button.dataset.searchIntent
          );

          if (!intents.length) {
            notify(
              'Selecciona al menos qué estás buscando'
            );
            return;
          }

          const seeking =
            seekingFromIntents(intents);

          const zones =
            modal
              .querySelector('#searchZones')
              .value
              .split(',')
              .map(value => value.trim())
              .filter(Boolean);

          const minValue =
            modal.querySelector(
              '#searchBudgetMin'
            ).value;

          const maxValue =
            modal.querySelector(
              '#searchBudgetMax'
            ).value;

          const over4000 =
            modal.querySelector(
              '#searchBudgetOpen'
            ).checked;

          const budgetMin =
            minValue
              ? Number(minValue)
              : null;

          const budgetMax =
            over4000
              ? null
              : maxValue
                ? Number(maxValue)
                : null;

          if (
            budgetMin &&
            budgetMax &&
            budgetMin > budgetMax
          ) {
            notify(
              'El presupuesto mínimo no puede superar el máximo'
            );
            return;
          }

          const moveDate =
            modal.querySelector(
              '#searchMoveDate'
            ).value || null;

          const flexible =
            modal.querySelector(
              '#searchMoveFlexible'
            ).checked;

          const duration =
            modal.querySelector(
              '[data-search-duration].active'
            )?.dataset.searchDuration ||
            null;

          const answers = {
            ...(state.preferences?.answers || {}),

            seeking,
            zones,

            budget: {
              ...(
                state.preferences
                  ?.answers
                  ?.budget || {}
              ),

              min: budgetMin,
              max: budgetMax,
              over4000
            },

            move: {
              ...(
                state.preferences
                  ?.answers
                  ?.move || {}
              ),

              date: moveDate,
              flexible,
              duration
            }
          };

          const deleteResult =
            await db
              .from('user_intents')
              .delete()
              .eq(
                'user_id',
                state.user.id
              );

          if (deleteResult.error) {
            console.error(
              'Rooms: error limpiando intenciones',
              deleteResult.error
            );

            notify(
              'No se pudo actualizar tu búsqueda'
            );

            return;
          }

          const insertResult =
            await db
              .from('user_intents')
              .insert(
                intents.map(intent => ({
                  user_id:
                    state.user.id,
                  intent
                }))
              );

          if (insertResult.error) {
            console.error(
              'Rooms: error guardando intenciones',
              insertResult.error
            );

            notify(
              'No se pudo actualizar tu búsqueda'
            );

            return;
          }

          const [
            profileResult,
            preferencesResult
          ] =
            await Promise.all([
              db
                .from('profiles')
                .update({
                  seeking,
                  zones,
                  budget_min:
                    budgetMin,
                  budget_max:
                    budgetMax,
                  move_in_date:
                    moveDate,
                  duration
                })
                .eq(
                  'id',
                  state.user.id
                )
                .select()
                .single(),

              db
                .from(
                  'onboarding_preferences'
                )
                .upsert({
                  user_id:
                    state.user.id,
                  answers
                })
            ]);

          if (
            profileResult.error ||
            preferencesResult.error
          ) {
            console.error(
              'Rooms: error actualizando búsqueda',
              profileResult.error,
              preferencesResult.error
            );

            notify(
              'No se pudo actualizar tu búsqueda'
            );

            return;
          }

          state.profile =
            profileResult.data;

          state.preferences = {
            answers
          };

          state.userIntents =
            [...new Set(intents)];

          state.profiles.set(
            state.profile.id,
            state.profile
          );

          updateOwnProfile(
            state.profile,
            state.preferences
          );

          modal.classList.remove('open');
          modal.setAttribute(
            'aria-hidden',
            'true'
          );

          document.body.style.overflow =
            '';

          notify(
            'Tu búsqueda se ha actualizado'
          );
        }
      );

    return modal;
  }

  function openSearchPreferencesEditor() {
    if (!state.profile) return;

    const modal =
      ensureSearchPreferencesModal();

    const intents =
      new Set(
        state.userIntents || []
      );

    modal
      .querySelectorAll(
        '[data-search-intent]'
      )
      .forEach(button => {
        const active =
          intents.has(
            button.dataset.searchIntent
          );

        button.classList.toggle(
          'active',
          active
        );

        button.setAttribute(
          'aria-pressed',
          active ? 'true' : 'false'
        );
      });

    modal.querySelector(
      '#searchZones'
    ).value =
      (state.profile.zones || [])
        .join(', ');

    modal.querySelector(
      '#searchBudgetMin'
    ).value =
      state.profile.budget_min ?? '';

    modal.querySelector(
      '#searchBudgetMax'
    ).value =
      state.profile.budget_max ?? '';

    modal.querySelector(
      '#searchBudgetOpen'
    ).checked =
      Boolean(
        state.preferences
          ?.answers
          ?.budget
          ?.over4000
      );

    modal.querySelector(
      '#searchMoveDate'
    ).value =
      state.profile.move_in_date ||
      '';

    modal.querySelector(
      '#searchMoveFlexible'
    ).checked =
      Boolean(
        state.preferences
          ?.answers
          ?.move
          ?.flexible
      );

    modal
      .querySelectorAll(
        '[data-search-duration]'
      )
      .forEach(button => {
        const active =
          button.dataset
            .searchDuration ===
          state.profile.duration;

        button.classList.toggle(
          'active',
          active
        );

        button.setAttribute(
          'aria-pressed',
          active ? 'true' : 'false'
        );
      });

    modal.classList.add('open');

    modal.setAttribute(
      'aria-hidden',
      'false'
    );

    document.body.style.overflow =
      'hidden';
  }

  document.addEventListener('click', event => {
    if (
      event.target.closest(
        '[data-open-search-preferences]'
      )
    ) {
      event.preventDefault();
      openSearchPreferencesEditor();
      return;
    }

    const completionAction =
      event.target.closest(
        '[data-profile-completion-action]'
      );

    if (completionAction) {
      event.preventDefault();

      if (
        completionAction.dataset
          .profileCompletionAction === 'search'
      ) {
        openSearchPreferencesEditor();
      } else {
        openProfileEditor();
      }
    }
  });


  document.addEventListener('click', event => {
    if (event.target.closest('[data-close-search-preferences]')) {
      const modal = document.querySelector('#searchPreferencesModal');

      if (modal) {
        modal.classList.remove('open');
        modal.setAttribute('aria-hidden', 'true');
      }

      document.body.style.overflow = '';
    }
  });


  function ensureHomePreferencesModal() {
    let modal =
      document.querySelector(
        '#homePreferencesModal'
      );

    if (modal) return modal;

    const dna =
      window.ROOMS_DNA;

    modal =
      document.createElement('div');

    modal.className = 'modal';
    modal.id =
      'homePreferencesModal';

    modal.setAttribute(
      'aria-hidden',
      'true'
    );

    modal.innerHTML = `
      <div
        class="backdrop"
        data-close-home-preferences>
      </div>

      <article class="detail home-preferences-shell">
        <header>
          <div>
            <small>ROOMS DNA</small>
            <h2>Tu vivienda ideal</h2>
            <p>
              Indica cuánto pesa cada característica
              para ti.
            </p>
          </div>

          <button
            type="button"
            data-close-home-preferences
            aria-label="Cerrar">×</button>
        </header>

        <form id="homePreferencesForm">
          <div class="living-editor-groups">

            ${dna.homePreferences
              .map(question => `
                <section class="living-editor-group">
                  <small>${question.label}</small>

                  <div>
                    ${dna.homePreferenceScale
                      .map(option => `
                        <button
                          type="button"
                          data-home-dna="${question.id}"
                          data-home-dna-value="${option.id}"
                          aria-pressed="false">
                          ${option.label}
                        </button>
                      `)
                      .join('')}
                  </div>
                </section>
              `)
              .join('')}

          </div>

          <div class="home-preferences-footer">
            <small>
              Puedes cambiar estas preferencias
              cuando quieras.
            </small>

            <button
              class="cta"
              type="submit">
              Guardar preferencias
            </button>
          </div>
        </form>
      </article>
    `;

    document.body.appendChild(modal);

    modal
      .querySelectorAll(
        '[data-home-dna]'
      )
      .forEach(button => {
        button.addEventListener(
          'click',
          () => {
            const question =
              button.dataset.homeDna;

            modal
              .querySelectorAll(
                `[data-home-dna="${question}"]`
              )
              .forEach(item => {
                const active =
                  item === button;

                item.classList.toggle(
                  'active',
                  active
                );

                item.setAttribute(
                  'aria-pressed',
                  active
                    ? 'true'
                    : 'false'
                );
              });
          }
        );
      });

    modal
      .querySelector(
        '#homePreferencesForm'
      )
      .addEventListener(
        'submit',
        async event => {
          event.preventDefault();

          const homePreferences = {
            ...(
              state.matchPreferences
                ?.home_preferences ||
              {}
            )
          };

          modal
            .querySelectorAll(
              '[data-home-dna].active'
            )
            .forEach(button => {
              homePreferences[
                button.dataset.homeDna
              ] =
                button.dataset.homeDnaValue;
            });

          const { data, error } =
            await db
              .from('match_preferences')
              .update({
                home_preferences:
                  homePreferences,

                updated_at:
                  new Date().toISOString()
              })
              .eq(
                'user_id',
                state.user.id
              )
              .select()
              .single();

          if (error) {
            console.error(
              'Rooms: error actualizando preferencias de hogar',
              error
            );

            notify(
              'No se pudieron guardar tus preferencias'
            );

            return;
          }

          state.matchPreferences =
            data;

          modal.classList.remove('open');

          modal.setAttribute(
            'aria-hidden',
            'true'
          );

          document.body.style.overflow =
            '';

          notify(
            'Preferencias actualizadas'
          );
        }
      );

    return modal;
  }

  function openHomePreferencesEditor() {
    if (!state.user) return;

    const modal =
      ensureHomePreferencesModal();

    const selected =
      state.matchPreferences
        ?.home_preferences || {};

    modal
      .querySelectorAll(
        '[data-home-dna]'
      )
      .forEach(button => {
        const active =
          selected[
            button.dataset.homeDna
          ] ===
          button.dataset.homeDnaValue;

        button.classList.toggle(
          'active',
          active
        );

        button.setAttribute(
          'aria-pressed',
          active ? 'true' : 'false'
        );
      });

    modal.classList.add('open');

    modal.setAttribute(
      'aria-hidden',
      'false'
    );

    document.body.style.overflow =
      'hidden';
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


  const profilePrivacyFeature =
    window.ROOMS_PROFILE_PRIVACY_FEATURE?.create({
      db,
      state,
      notify
    });

  if (!profilePrivacyFeature) {
    throw new Error(
      'Rooms: no se ha cargado la feature Profile Privacy'
    );
  }

  const {
    renderProfilePrivacySettings,
    applyProfilePrivacyControls,
    detectProfilePrivacyLevel,
    renderProfilePrivacyLevel
  } = profilePrivacyFeature;


  const accountSettingsFeature =
    window.ROOMS_ACCOUNT_SETTINGS_FEATURE?.create({
      db,
      state,
      notify
    });

  if (!accountSettingsFeature) {
    throw new Error(
      'Rooms: no se ha cargado la feature Account Settings'
    );
  }

  const {
    renderAccountSettings,
    requestPasswordChange,
    logoutFromRooms
  } = accountSettingsFeature;


  let renderFilteredExploreImpl =
    () => undefined;

  function renderFilteredExplore(...args) {
    return renderFilteredExploreImpl(
      ...args
    );
  }


  const exploreViewFeature =
    window.ROOMS_EXPLORE_VIEW_FEATURE?.create({
      state,
      renderFilteredExplore,
      renderRealMapCard
    });

  if (!exploreViewFeature) {
    throw new Error(
      'Rooms: no se ha cargado la feature Explore View'
    );
  }

  const {
    sortExploreListings
  } = exploreViewFeature;


  const exploreFiltersFeature =
    window.ROOMS_EXPLORE_FILTERS_FEATURE?.create({
      state,
      sortExploreListings,
      renderFilteredExplore,
      hideAllModals,
      notify
    });

  if (!exploreFiltersFeature) {
    throw new Error(
      'Rooms: no se ha cargado la feature Explore Filters'
    );
  }

  const {
    exploreFiltersState,
    normalizeExploreValue,
    readExploreFiltersFromModal,
    listingMatchesExploreFilters,
    getExploreResults,
    updateExploreFilterPreview,
    resetExploreFilters
  } = exploreFiltersFeature;


  const exploreControllerFeature =
    window.ROOMS_EXPLORE_CONTROLLER_FEATURE?.create({
      getExplorePeople,
      renderExplorePeople,
      updateConnectButtons,
      getExploreCommunities,
      renderExploreCommunities,
      getExploreResults,
      renderRealExplore,
      exploreFiltersState
    });

  if (!exploreControllerFeature) {
    throw new Error(
      'Rooms: no se ha cargado la feature Explore Controller'
    );
  }

  renderFilteredExploreImpl =
    exploreControllerFeature.renderFilteredExplore;





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
            Elige un nombre para identificar el grupo.
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

  const householdCoreFeature =
    window.ROOMS_HOUSEHOLD_CORE_FEATURE?.create({
      db,
      state,
      escapeHtml,
      initials: savedFeature.initials,
      loadHouseholdCandidates
    });

  if (!householdCoreFeature) {
    throw new Error(
      'Rooms: no se ha cargado la feature Household Core'
    );
  }

  const {
    renderEmptyHousehold,
    renderSearchGroupsHome,
    renderRealHousehold,
    loadHousehold
  } = householdCoreFeature;

  const householdInvitesFeature =
    window.ROOMS_HOUSEHOLD_INVITES_FEATURE?.create({
      db,
      state,
      notify,
      loadHousehold
    });

  if (!householdInvitesFeature) {
    throw new Error(
      'Rooms: no se ha cargado la feature Household Invites'
    );
  }

  const {
    ensureHouseholdInviteModal,
    openHouseholdInviteModal,
    generateHouseholdInvitation,
    copyHouseholdInvitation,
    ensureIncomingHouseholdInviteModal,
    handleIncomingHouseholdInvite,
    acceptIncomingHouseholdInvite
  } = householdInvitesFeature;


  const householdGroupPickerFeature =
    window.ROOMS_HOUSEHOLD_GROUP_PICKER_FEATURE?.create({
      db,
      state,
      notify,
      escapeHtml,
      loadHouseholdCandidates,
      renderSearchGroupsHome
    });

  if (!householdGroupPickerFeature) {
    throw new Error(
      'Rooms: no se ha cargado la feature Household Group Picker'
    );
  }

  const {
    ensureGroupPickerModal,
    openGroupPicker,
    closeGroupPicker,
    addListingToGroup,
    addPersonToGroup,
    addListingToHousehold
  } = householdGroupPickerFeature;


  const householdCandidatesFeature =
    window.ROOMS_HOUSEHOLD_CANDIDATES_FEATURE?.create({
      db,
      state,
      notify,
      escapeHtml,
      initials:
        savedFeature.initials,
      labelSeeking,
      renderSearchGroupsHome
    });

  if (!householdCandidatesFeature) {
    throw new Error(
      'Rooms: no se ha cargado la feature Household Candidates'
    );
  }

  const {
    addPersonToHousehold,
    renderHouseholdCandidates,
    getHouseholdVoteSummary,
    renderHouseholdVoteControls,
    voteHouseholdCandidate,
    removeHouseholdPersonCandidate,
    removeHouseholdCandidate
  } = householdCandidatesFeature;

  loadHouseholdCandidatesImpl =
    householdCandidatesFeature.loadHouseholdCandidates;


  const householdCreateFeature =
    window.ROOMS_HOUSEHOLD_CREATE_FEATURE?.create({
      db,
      state,
      notify,
      renderRealHousehold
    });

  if (!householdCreateFeature) {
    throw new Error(
      'Rooms: no se ha cargado la feature Household Create'
    );
  }

  const {
    createHousehold
  } = householdCreateFeature;

  const householdEventsFeature =
    window.ROOMS_HOUSEHOLD_EVENTS_FEATURE?.create({
      state,
      notify,
      loadHousehold,
      voteHouseholdCandidate,
      openGroupPicker,
      removeHouseholdPersonCandidate,
      removeHouseholdCandidate,
      acceptIncomingHouseholdInvite,
      openHouseholdInviteModal,
      generateHouseholdInvitation,
      copyHouseholdInvitation,
      ensureCreateHouseholdModal
    });

  if (!householdEventsFeature) {
    throw new Error(
      'Rooms: no se ha cargado la feature Household Events'
    );
  }


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


  document.addEventListener('change', event => {
    if (event.target?.id !== 'savedSort') {
      return;
    }

    sortSavedItems(
      event.target.value
    );
  });


})();
