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
    connection: null,
    chatTarget: null,
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
    document.querySelector('#authGate').hidden = true;

    const [{ data: profile }, { data: preferences }] = await Promise.all([
      db.from('profiles').select('*').eq('id', state.user.id).maybeSingle(),
      db.from('onboarding_preferences').select('answers,updated_at').eq('user_id', state.user.id).maybeSingle()
    ]);
    state.profile = profile;
    state.preferences = preferences;
    if (profile) state.profiles.set(profile.id, profile);
    updateOwnProfile(profile, preferences);

    if (profile?.onboarding_completed && !document.body.classList.contains('app-visible')) {
      if (typeof window.openPersonalizedFeed === 'function') window.openPersonalizedFeed();
    }

    await loadOtherProfile();
    await loadRealContent();
    await Promise.all([
      loadSavedItems(),
      loadSavedCollections(),
      loadIncomingConnections(),
      loadRealNotifications(),
      loadRealInbox()
    ]);
    subscribeToMessages();
    showLiveStatus();
  }

  function endSession() {
    state.user = null;
    state.profile = null;
    state.preferences = null;
    state.targetProfile = null;
    state.connection = null;
    state.chatTarget = null;
    if (state.channel) db.removeChannel(state.channel);
    document.querySelector('#authGate').hidden = false;
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

  async function loadRealContent() {
    const [{ data: listings }, { data: profiles }, { data: posts }, { data: communities }] = await Promise.all([
      db.from('listings').select('*').eq('status', 'published').order('created_at', { ascending: false }),
      db.rpc('get_visible_profiles', { _target_user_id: null }),
      db.from('posts').select('*').eq('status', 'published').order('created_at', { ascending: false }),
      db.from('communities').select('*').eq('status', 'active').order('created_at', { ascending: false })
    ]);
    state.listings = new Map((listings || []).map(item => [item.id, item]));
    state.posts = new Map((posts || []).map(item => [item.id, item]));
    state.communities = new Map((communities || []).map(item => [item.id, item]));
    (profiles || []).forEach(profile => state.profiles.set(profile.id, profile));
    if (!state.targetProfile && profiles?.length) state.targetProfile = profiles[0];
    renderRealFeed(listings || [], profiles || [], posts || [], communities || []);
    renderRealExplore(listings || []);
    clearDemoOnlyViews();
    refreshOwnActivity();
  }

  function renderRealFeed(listings, profiles, posts, communities) {
    const feed = document.querySelector('#personalFeed');
    if (!feed) return;
    const cards = [
      ...listings.map(renderListingCard),
      ...profiles.map(renderPersonCard),
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
    const photos = listing.photos || [];
    const kind = listing.kind === 'apartment' ? 'Piso entero' : listing.kind === 'external' ? 'Fuente externa' : 'Habitación';
    const date = listing.available_from ? new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' }).format(new Date(`${listing.available_from}T00:00:00`)) : 'Por confirmar';
    const features = (listing.features || []).slice(0, 4);
    return `<article class="feed-card property-feed-card" data-feed-type="${listing.kind === 'apartment' ? 'flat' : 'home'}" data-real-listing="${listing.id}" tabindex="0">
      <div class="property-feed-gallery real-gallery" ${photos.length ? 'data-carousel data-index="0"' : ''}>
        ${photos.length ? `<div class="property-gallery-track">${photos.map((photo, index) => `<img ${index === 0 ? 'class="active"' : ''} data-carousel-slide src="${escapeHtml(photo)}" alt="${escapeHtml(listing.title)} · foto ${index + 1}">`).join('')}</div>${photos.length > 1 ? '<button class="carousel-arrow previous" type="button" data-carousel-prev aria-label="Foto anterior">‹</button><button class="carousel-arrow next" type="button" data-carousel-next aria-label="Foto siguiente">›</button>' : ''}<div class="carousel-dots" aria-label="Imagen 1 de ${photos.length}">${photos.map((_, index) => `<i class="${index === 0 ? 'active' : ''}"></i>`).join('')}</div>` : '<div class="real-listing-placeholder"><span>rooms.</span><small>FOTOS PENDIENTES</small></div>'}
        ${listing.kind === 'external' ? '<div class="property-badges"><span class="reliability-badge">FUENTE EXTERNA</span></div>' : ''}
        <div class="property-top-actions"><button class="feed-save" type="button" data-save-kind="${listing.kind === 'apartment' ? 'apartment' : 'room'}" data-save-id="${listing.id}" aria-label="Guardar">♡</button></div>
      </div>
      <div class="property-feed-body">
        <div class="property-main"><p><b>${Number(listing.price).toLocaleString('es-ES')} €</b> / mes</p><h2>${escapeHtml(listing.zone)} · ${kind}</h2><span>Disponible ${escapeHtml(date)}</span></div>
        <div class="property-quick-facts"><span>${listing.rooms || '—'} hab</span><span>${listing.baths || '—'} baños</span><span>${listing.area || '—'} m²</span></div>
        <div class="property-tags">${features.length ? features.map(tag => `<span>${escapeHtml(tag)}</span>`).join('') : '<span>Sin características añadidas</span>'}</div>
        <p class="property-fit-copy">${escapeHtml(listing.description || 'El anunciante todavía no ha añadido una descripción.')}</p>
        <div class="feed-actions"><button type="button" data-action="save" data-save-kind="${listing.kind === 'apartment' ? 'apartment' : 'room'}" data-save-id="${listing.id}">♡ <span>Guardar</span></button><button type="button" data-toast="Enlace copiado">↗ <span>Compartir</span></button></div>
      </div>
    </article>`;
  }

  function renderPersonCard(profile) {
    const name = profile.alias || profile.name || 'Usuario de Rooms';
    const zone = profile.zones?.[0] || 'Madrid';
    const seeking = labelSeeking(profile.seeking?.[0]);
    const traits = (profile.traits || []).slice(0, 3);
    const traitLabels = { tidy: 'Ordenado', social: 'Sociable', calm: 'Tranquilo', independent: 'Independiente', cook: 'Cocinillas', early: 'Madrugador', night: 'Nocturno' };
    return `<article class="feed-card person-feed-card" data-feed-type="person" data-real-user="${profile.id}" tabindex="0">
      <div class="person-card-photo real-person-photo">
        ${profile.avatar_url ? `<img src="${escapeHtml(profile.avatar_url)}" alt="${escapeHtml(name)}">` : `<div class="real-person-placeholder">${escapeHtml(initials(name))}</div>`}
        <div class="person-card-tools"><button type="button" data-person-save data-save-kind="person" data-save-id="${profile.id}" aria-label="Guardar perfil">♡</button></div>
      </div>
      <div class="person-card-body"><h2>${escapeHtml(name)}${profile.age ? `, ${profile.age}` : ''}</h2><p class="person-searching">${escapeHtml(seeking)} · ${escapeHtml(zone)}</p>
        <div class="person-traits">${traits.length ? traits.map(value => `<span>${escapeHtml(traitLabels[value] || value)}</span>`).join('') : '<span>Perfil recién creado</span>'}</div>
        <p>${escapeHtml(profile.bio || 'Todavía no ha añadido una bio.')}</p>
        <div class="person-actions"><button type="button" data-connect data-user-id="${profile.id}">Conectar</button></div>
      </div>
    </article>`;
  }

  function renderPostCard(post) {
    const author = state.profiles.get(post.author_id);
    const name = author?.alias || author?.name || 'Usuario de Rooms';
    return `<article class="feed-card social-post-card" data-feed-type="post" data-real-post="${post.id}">
      <header><span>${escapeHtml(initials(name))}</span><div><b>${escapeHtml(name)}</b><small>${relativeTime(post.created_at)}</small></div></header>
      <p>${escapeHtml(post.body)}</p><div class="post-actions"><button type="button" data-save-kind="post" data-save-id="${post.id}">♡ Guardar</button></div>
    </article>`;
  }

  function renderCommunityCard(community) {
    return `<article class="feed-card community-feed-card" data-feed-type="community" data-real-community="${community.id}">
      <div class="community-card-mark">#</div><div><h2>${escapeHtml(community.name)}</h2><p>${escapeHtml(community.description || 'Comunidad de Rooms')}</p><button type="button" data-real-community-open="${community.id}">Ver comunidad</button></div>
    </article>`;
  }

  function renderRealExplore(listings) {
    const list = document.querySelector('#exploreList');
    const map = document.querySelector('#exploreMap');
    if (list) list.innerHTML = listings.length
      ? `<p class="explore-count">${listings.length} ${listings.length === 1 ? 'resultado' : 'resultados'}</p>${listings.map(item => `<article class="compact-property" data-real-listing="${item.id}"><div class="compact-property-copy"><h2>${escapeHtml(item.zone)} · ${item.kind === 'apartment' ? 'Piso entero' : 'Habitación'}</h2><p><b>${Number(item.price).toLocaleString('es-ES')} €</b> / mes</p></div><button type="button" data-save-kind="${item.kind === 'apartment' ? 'apartment' : 'room'}" data-save-id="${item.id}">♡</button></article>`).join('')}`
      : '<section class="real-feed-empty compact"><h2>Todavía no hay viviendas publicadas</h2><p>Cuando alguien publique una, aparecerá aquí.</p></section>';
    if (map) map.innerHTML = '<section class="real-feed-empty compact"><h2>Sin ubicaciones todavía</h2><p>El mapa se activará cuando existan anuncios.</p></section>';
  }

  function clearDemoOnlyViews() {
    const household = document.querySelector('#householdView');
    if (household) household.innerHTML = '<section class="real-page-empty"><span>⌂</span><h1>Todavía no tienes un Hogar</h1><p>Cuando crees o aceptes una invitación a un grupo, aparecerá aquí.</p><button type="button" data-open-real-publish>Buscar vivienda</button></section>';
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
    state.publishDraft.steps[step] = { values, selected };
    return { type, step, values, selected };
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
      const body = first.values[0] || '';
      if (!body) return notify('Escribe el contenido de la publicación');
      const typeLabels = { Pregunta: 'question', Recomendación: 'recommendation', Barrio: 'neighborhood', Aviso: 'warning', Experiencia: 'experience', Vivienda: 'housing' };
      const { error } = await db.from('posts').insert({ author_id: state.user.id, post_type: typeLabels[first.selected[0]] || 'question', body });
      if (error) return notify('No se pudo crear la publicación');
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
    hideAllModals();
    notify(type === 'post' ? 'Publicación creada' : type === 'mate' ? 'Tu búsqueda está activa' : 'Vivienda publicada');
    state.publishDraft = { steps: {}, files: [] };
    await loadRealContent();
    await loadSavedItems();
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
          <label>Añadir fotografías<input id="editListingPhotos" type="file" accept="image/jpeg,image/png,image/webp,image/heic" multiple><small>Las nuevas fotos se añadirán a las actuales.</small></label>
          <p class="edit-listing-message" id="editListingMessage" role="status"></p>
          <div class="edit-listing-actions"><button class="delete-listing-button" type="button" data-delete-listing>Eliminar anuncio</button><button class="edit-listing-save" type="submit">Guardar cambios</button></div>
        </form>
      </article>`;
    document.body.appendChild(modal);
    modal.querySelector('#editListingForm').addEventListener('submit', saveListingEdits);
    return modal;
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
    modal.querySelector('#editListingPhotos').value = '';
    modal.querySelector('#editListingMessage').textContent = '';
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
    let photos = listing.photos || [];
    if (files.length) {
      const uploaded = await uploadListingPhotos(listingId, files);
      photos = [...photos, ...uploaded];
      if (!uploaded.length) message.textContent = 'No se pudieron añadir las fotos, pero guardaremos el resto.';
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
    hideAllModals();
    await loadRealContent();
    await loadSavedItems();
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

  async function loadConnection() {
    if (!state.targetProfile) return;
    const { data } = await db.from('connections').select('*').or(
      `and(requester_id.eq.${state.user.id},recipient_id.eq.${state.targetProfile.id}),and(requester_id.eq.${state.targetProfile.id},recipient_id.eq.${state.user.id})`
    ).maybeSingle();
    state.connection = data || null;
    updateConnectButtons();
  }

  function updateConnectButtons() {
    document.querySelectorAll('[data-connect]').forEach(button => {
      if (!state.targetProfile) button.textContent = 'Conectar';
      else if (!state.connection) button.textContent = 'Conectar';
      else if (state.connection.status === 'accepted') button.textContent = 'Enviar mensaje';
      else if (state.connection.requester_id === state.user.id) button.textContent = 'Solicitud enviada';
      else button.textContent = 'Responder solicitud';
    });
  }

  async function handleConnect() {
    if (!state.targetProfile) {
      notify('Cuando otra persona cree su perfil podrás conectar con ella');
      return;
    }
    if (state.connection?.status === 'accepted') {
      openRealConversation(state.targetProfile);
      return;
    }
    if (state.connection) {
      notify(state.connection.requester_id === state.user.id ? 'La solicitud sigue pendiente' : 'Tienes una solicitud pendiente');
      return;
    }
    const { data, error } = await db.from('connections').insert({
      requester_id: state.user.id,
      recipient_id: state.targetProfile.id
    }).select().single();
    if (error) {
      notify('No se pudo enviar la solicitud');
      return;
    }
    state.connection = data;
    updateConnectButtons();
    notify('Solicitud de conexión enviada');
  }

  async function connectToUser(userId) {
    const profile = state.profiles.get(userId);

    if (profile) {
      state.targetProfile = profile;

      state.targetVisibility =
        await getProfileVisibility(profile.id);

      applyTargetProfile(profile);
      applyTargetPrivacy(
        profile,
        state.targetVisibility
      );
    }

    await loadConnection();
    await handleConnect();
  }

  async function loadIncomingConnections() {
    const { data } = await db.from('connections')
      .select('id,requester_id,status')
      .eq('recipient_id', state.user.id)
      .eq('status', 'pending')
      .limit(1);
    if (!data?.length) return;
    const request = data[0];
    const { data: requesterRows, error: requesterError } = await db.rpc(
      'get_visible_profiles',
      { _target_user_id: request.requester_id }
    );

    if (requesterError) {
      console.error('Rooms: error cargando perfil de solicitud', requesterError);
    }

    const requester = requesterRows?.[0] || null;
    state.incomingRequests.set(request.id, { request, requester });
    showConnectionRequest(request, requester);
  }

  function showConnectionRequest(request, requester) {
    document.querySelector('.connection-request')?.remove();
    const name = requester?.alias || requester?.name || 'Una persona';
    const panel = document.createElement('aside');
    panel.className = 'connection-request';
    panel.innerHTML = `<small>NUEVA CONEXIÓN</small><b>${escapeHtml(name)} quiere conectar contigo</b><div><button type="button" data-request-answer="accepted">Aceptar</button><button type="button" data-request-answer="declined">Ahora no</button></div>`;
    panel.addEventListener('click', async event => {
      const button = event.target.closest('[data-request-answer]');
      if (!button) return;
      const status = button.dataset.requestAnswer;
      const { error } = await db.from('connections').update({ status }).eq('id', request.id);
      if (error) return notify('No se pudo responder la solicitud');
      panel.remove();
      notify(status === 'accepted' ? 'Conexión aceptada' : 'Solicitud rechazada');
      await loadOtherProfile();
      await Promise.all([loadRealNotifications(), loadRealInbox()]);
    });
    document.body.appendChild(panel);
  }

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

  async function loadRealNotifications() {
    if (!state.user) return;
    const [{ data: connections }, { data: messages }] = await Promise.all([
      db.from('connections').select('*').or(`requester_id.eq.${state.user.id},recipient_id.eq.${state.user.id}`).order('created_at', { ascending: false }),
      db.from('messages').select('*').eq('recipient_id', state.user.id).is('read_at', null).order('created_at', { ascending: false }).limit(20)
    ]);
    const relevantConnections = (connections || []).filter(item =>
      (item.recipient_id === state.user.id && item.status === 'pending') ||
      (item.requester_id === state.user.id && item.status === 'accepted')
    );
    const ids = [
      ...relevantConnections.map(item => item.requester_id === state.user.id ? item.recipient_id : item.requester_id),
      ...(messages || []).map(item => item.sender_id)
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
    (messages || []).forEach(message => {
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
    const otherIds = (connections || []).map(item => item.requester_id === state.user.id ? item.recipient_id : item.requester_id);
    const profiles = await fetchProfiles(otherIds);
    const { data: messages } = await db.from('messages').select('*')
      .or(`sender_id.eq.${state.user.id},recipient_id.eq.${state.user.id}`)
      .order('created_at', { ascending: false });
    const latestByUser = new Map();
    (messages || []).forEach(message => {
      const otherId = message.sender_id === state.user.id ? message.recipient_id : message.sender_id;
      if (!latestByUser.has(otherId)) latestByUser.set(otherId, message);
    });
    const list = document.querySelector('#chatInboxModal .conversation-list');
    if (!list) return;
    list.innerHTML = otherIds.length ? otherIds.map(id => {
      const profile = profiles.get(id);
      const name = profile?.alias || profile?.name || 'Usuario de Rooms';
      const last = latestByUser.get(id);
      return `<button type="button" data-real-chat="${id}" data-chat-type="person">
        <span class="home-chat-icon">${escapeHtml(initials(name))}</span>
        <div><b>${escapeHtml(name)}</b><p>${escapeHtml(last?.body || 'Ya podéis empezar a hablar.')}</p><small>CONEXIÓN ROOMS</small></div>
        <time>${last ? relativeTime(last.created_at) : ''}</time>
      </button>`;
    }).join('') : '<div class="real-empty-state"><b>Todavía no tienes conversaciones</b><p>Cuando aceptéis una conexión, el chat aparecerá aquí.</p></div>';
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
        cards.push(`<article class="saved-card saved-person" data-saved-type="person" data-real-user="${person.id}"><div class="saved-text-cover">${escapeHtml(initials(name))}</div><div><small>PERSONA</small><h3>${escapeHtml(name)}</h3><p>${escapeHtml(person.zones?.[0] || 'Madrid')}</p><div class="saved-card-actions"><button type="button" data-connect data-user-id="${person.id}">Conectar</button><button type="button" data-real-remove-saved data-save-kind="person" data-save-id="${person.id}">Eliminar</button></div></div></article>`);
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
    const kind = listing.kind === 'apartment' ? 'Piso entero' : listing.kind === 'external' ? 'Fuente externa' : 'Habitación';
    const date = listing.available_from ? new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${listing.available_from}T00:00:00`)) : 'Por confirmar';
    const photos = listing.photos || [];
    detail.innerHTML = `<div class="detail-gallery real-detail-gallery" ${photos.length ? 'data-carousel data-index="0"' : ''}>${photos.length ? `<div class="detail-gallery-track">${photos.map((photo, index) => `<img ${index === 0 ? 'class="active"' : ''} data-carousel-slide src="${escapeHtml(photo)}" alt="${escapeHtml(listing.title)} · foto ${index + 1}">`).join('')}</div>${photos.length > 1 ? '<button class="carousel-arrow previous" type="button" data-carousel-prev aria-label="Foto anterior">‹</button><button class="carousel-arrow next" type="button" data-carousel-next aria-label="Foto siguiente">›</button>' : ''}<div class="carousel-dots" aria-label="Imagen 1 de ${photos.length}">${photos.map((_, index) => `<i class="${index === 0 ? 'active' : ''}"></i>`).join('')}</div>` : '<div class="real-listing-placeholder"><span>rooms.</span><small>FOTOS PENDIENTES</small></div>'}<div class="detail-gallery-actions"><button type="button" data-detail-save data-save-kind="${listing.kind === 'apartment' ? 'apartment' : 'room'}" data-save-id="${listing.id}" aria-label="Guardar">♡</button></div></div>
      <div class="housing-detail-content"><section class="detail-main-block"><div><p><b>${Number(listing.price).toLocaleString('es-ES')} €</b> / mes</p><h2>${escapeHtml(listing.zone)} · ${kind}</h2></div>${listing.owner_id === state.user.id ? `<button class="edit-own-listing" type="button" data-edit-listing="${listing.id}">Editar anuncio</button>` : ''}</section>
      <div class="detail-key-facts"><span><small>Disponible</small><b>${escapeHtml(date)}</b></span><span><small>Habitaciones</small><b>${listing.rooms || 'Sin añadir'}</b></span><span><small>Baños</small><b>${listing.baths || 'Sin añadir'}</b></span><span><small>Superficie</small><b>${listing.area ? `${listing.area} m²` : 'Sin añadir'}</b></span></div>
      <section class="detail-section"><h3>Sobre la vivienda</h3><p>${escapeHtml(listing.description || 'El anunciante todavía no ha añadido una descripción.')}</p></section>
      <section class="detail-section"><h3>Características</h3><div class="profile-interest-chips">${listing.features?.length ? listing.features.map(item => `<span>${escapeHtml(item)}</span>`).join('') : '<span>Sin características añadidas</span>'}</div></section></div>`;
    showModal(document.querySelector('#detailModal'));
  }

  async function openRealUser(profile) {
    state.targetProfile = profile;
    await loadConnection();
    const modal = document.querySelector('#userProfileModal');
    const name = profile.alias || profile.name || 'Usuario de Rooms';
    const imageBox = modal.querySelector('.profile-hero');
    imageBox.innerHTML = profile.avatar_url ? `<img src="${escapeHtml(profile.avatar_url)}" alt="${escapeHtml(name)}">` : `<div class="real-person-placeholder">${escapeHtml(initials(name))}</div>`;
    modal.querySelector('.user-profile-content').innerHTML = `<section class="user-profile-header"><div class="profile-title"><h2>${escapeHtml(name)}${profile.age ? `, ${profile.age}` : ''}</h2><p>${escapeHtml(profile.bio || 'Todavía no ha añadido una bio.')}</p></div><div class="profile-looking"><span><small>BUSCA AHORA</small><b>${escapeHtml(labelSeeking(profile.seeking?.[0]))}</b></span><span><small>ZONA</small><b>${escapeHtml(profile.zones?.join(' · ') || 'Sin definir')}</b></span><span><small>PRESUPUESTO</small><b>${escapeHtml(formatBudget(profile))}</b></span></div><div class="profile-interest-chips">${profile.interests?.length ? profile.interests.map(item => `<span>${escapeHtml(item)}</span>`).join('') : '<span>Sin intereses visibles</span>'}</div><div class="profile-primary-actions"><button type="button" data-connect data-user-id="${profile.id}">${state.connection?.status === 'accepted' ? 'Enviar mensaje' : 'Conectar'}</button><button type="button" data-person-save data-save-kind="person" data-save-id="${profile.id}">♡ Guardar</button></div></section>`;
    modal.querySelector('.profile-fixed-actions').innerHTML = `<button type="button" data-connect data-user-id="${profile.id}">${state.connection?.status === 'accepted' ? 'Enviar mensaje' : 'Conectar'}</button>`;
    showModal(modal);
  }

  async function openRealConversation(profile) {
    state.chatTarget = profile;
    hideAllModals();
    showModal(document.querySelector('#conversationModal'));
    const name = profile.alias || profile.name || 'Usuario de Rooms';
    document.querySelector('#conversationName').textContent = name;
    document.querySelector('#conversationContext').textContent = 'Conectados en Rooms';
    await renderMessages();
    subscribeToMessages();
  }

  async function renderMessages() {
    if (!state.chatTarget) return;
    const { data, error } = await db.from('messages').select('*').or(
      `and(sender_id.eq.${state.user.id},recipient_id.eq.${state.chatTarget.id}),and(sender_id.eq.${state.chatTarget.id},recipient_id.eq.${state.user.id})`
    ).order('created_at', { ascending: true });
    if (error) return notify('No se pudieron cargar los mensajes');
    const body = document.querySelector('#conversationBody');
    body.innerHTML = `<div class="chat-day">CONVERSACIÓN</div>${(data || []).map(message => messageBubble(message)).join('')}`;
    body.scrollTop = body.scrollHeight;
  }

  function messageBubble(message) {
    const mine = message.sender_id === state.user.id;
    const time = new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' }).format(new Date(message.created_at));
    return `<div class="chat-message ${mine ? 'mine' : 'other'}">${mine ? '' : `<b>${escapeHtml(state.chatTarget.alias || state.chatTarget.name)}</b>`}<p>${escapeHtml(message.body)}</p><small>${time}</small></div>`;
  }

  async function sendMessage(text) {
    if (!state.chatTarget || !text) return;
    const { error } = await db.from('messages').insert({
      sender_id: state.user.id,
      recipient_id: state.chatTarget.id,
      body: text
    });
    if (error) notify('No se pudo enviar el mensaje');
  }

  function subscribeToMessages() {
    if (state.channel) db.removeChannel(state.channel);
    state.channel = db.channel(`messages-${state.user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
        const message = payload.new;
        if (!state.chatTarget) return;
        const participants = [message.sender_id, message.recipient_id];
        if (participants.includes(state.user.id) && state.chatTarget && participants.includes(state.chatTarget.id)) renderMessages();
        if (participants.includes(state.user.id)) Promise.all([loadRealNotifications(), loadRealInbox()]);
      })
      .subscribe();
  }

  document.addEventListener('click', event => {
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
      if (event.target.closest('[data-carousel-prev],[data-carousel-next]')) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const listing = state.listings.get(realListing.dataset.realListing);
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
      showModal(document.querySelector('#publishModal'));
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

    const logout = event.target.closest('.logout-button');
    if (logout) {
      event.preventDefault();
      event.stopImmediatePropagation();
      db.auth.signOut();
    }

    const ownActivity = event.target.closest('[data-own-activity]');
    if (ownActivity) {
      event.preventDefault();
      event.stopImmediatePropagation();
      refreshOwnActivity(ownActivity.dataset.ownActivity);
    }
  }, true);

  document.addEventListener('submit', event => {
    if (event.target.id !== 'conversationForm' || !state.chatTarget) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const input = document.querySelector('#conversationInput');
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    sendMessage(text);
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

    endSession();
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


  document.addEventListener('click', event => {
    const activityTab = event.target.closest('[data-own-activity]');
    if (!activityTab) return;

    event.preventDefault();

    refreshOwnActivity(
      activityTab.dataset.ownActivity
    );
  });


})();
