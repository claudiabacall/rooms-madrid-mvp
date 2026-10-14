(function () {
  'use strict';

  function createProfileEditorFeature({
    db,
    state,
    notify,
    updateOwnProfile
  }) {
    let saving = false;
    let openedDnaRevision = null;
    const worldQuestion = () => window.ROOMS_DNA_V2?.interactions?.find(q => q.id === 'world_interests');
    const v2Available = () => state.roomsDna?.model_version === window.ROOMS_DNA_V2?.version &&
      Array.isArray(state.roomsDna?.answers?.world_interests);
    function selectedInterests() {
      if (v2Available()) return state.roomsDna.answers.world_interests;
      return state.profile?.interests || [];
    }
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
                ${(worldQuestion()?.options || [
                  { id: 'sport', label: 'Deporte' }, { id: 'music', label: 'Música' },
                  { id: 'cooking', label: 'Cocina' }, { id: 'travel', label: 'Viajes' },
                  { id: 'gym', label: 'Gym' }, { id: 'gaming', label: 'Gaming' },
                  { id: 'reading', label: 'Lectura' }, { id: 'going-out', label: 'Salir' },
                  { id: 'quiet-plans', label: 'Planes tranquilos' }, { id: 'pets', label: 'Mascotas' }
                ]).map(option => `
                  <button type="button" data-edit-interest="${option.id}">${option.label}</button>
                `).join('')}
              </div>
            </fieldset>

            <button class="cta" type="submit">Guardar cambios</button>
          </form>
        </article>
      `;

      document.body.appendChild(modal);

      modal.querySelectorAll('[data-edit-interest]').forEach(button => {
        button.addEventListener('click', () => {
          const max = worldQuestion()?.maxSelections || 5;
          if (!button.classList.contains('active') &&
              modal.querySelectorAll('[data-edit-interest].active').length >= max) {
            notify(`Selecciona un máximo de ${max} intereses`);
            return;
          }
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

        if (saving || !state.user) return;
        const userId = state.user.id;
        if (v2Available() && (!Number.isSafeInteger(openedDnaRevision) ||
            openedDnaRevision !== state.roomsDna.revision)) {
          notify('Tu DNA ha cambiado. Reabre el editor.');
          return;
        }
        if (!v2Available()) {
          saving = true;
          try {
            const { data, error } = await db.from('profiles').update({
              name, alias: name, age: ageValue ? Number(ageValue) : null,
              bio, interests
            }).eq('id', userId).select().single();
            if (error || !data) throw error || new Error('Perfil no encontrado');
            if (state.user?.id !== userId) return;
            state.profile = data;
            state.profiles.set(data.id, data);
            updateOwnProfile(state.profile, state.preferences);
            modal.classList.remove('open');
            modal.setAttribute('aria-hidden', 'true');
            document.body.style.overflow = '';
            notify('Perfil actualizado');
          } catch (error) {
            console.error('Rooms: error actualizando perfil', error);
            notify('No se pudo actualizar tu perfil');
          } finally {
            saving = false;
          }
          return;
        }
        const question = worldQuestion();
        if (!question || interests.length > question.maxSelections ||
            new Set(interests).size !== interests.length ||
            interests.some(id => !question.options.some(o => o.id === id))) {
          notify('Revisa los intereses seleccionados');
          return;
        }
        saving = true;
        const submit = modal.querySelector('#profileEditorForm [type="submit"]');
        if (submit) submit.disabled = true;
        try {
          const { data: result, error } = await db.rpc('update_profile_interests_v2', {
            p_expected_revision: openedDnaRevision,
            p_interests: interests,
            p_name: name,
            p_age: ageValue ? Number(ageValue) : null,
            p_bio: bio
          });
          if (error || !result?.dna || !result?.profile) {
            throw error || new Error('Respuesta de guardado incompleta');
          }
          if (state.user?.id !== userId) return;
          state.roomsDna = result.dna;
          state.profile = result.profile;
          state.profiles.set(result.profile.id, result.profile);
          updateOwnProfile(state.profile, state.preferences);
        } catch (error) {
          console.error('Rooms: error guardando intereses DNA', error);
          notify('No se pudo actualizar tu perfil');
          return;
        } finally {
          saving = false;
          if (submit) submit.disabled = false;
        }

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

      openedDnaRevision = v2Available() ? state.roomsDna.revision : null;
      const interests = new Set(selectedInterests());

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
      if (
        event.target.closest(
          '#editOwnProfile,[data-open-profile-editor]'
        )
      ) {
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


    async function uploadProfilePhoto(
      file,
      { silent = false } = {}
    ) {
      if (!file || !state.user) return false;

      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        if (!silent) {
          notify('Usa una imagen JPG, PNG o WEBP');
        }
        return false;
      }

      if (file.size > 5 * 1024 * 1024) {
        if (!silent) {
          notify('La foto debe pesar menos de 5 MB');
        }
        return false;
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
        return false;
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
        return false;
      }

      state.profile = data;
      state.profiles.set(data.id, data);
      updateOwnProfile(
        state.profile,
        state.preferences
      );

      if (!silent) {
        notify('Foto de perfil actualizada');
      }

      return data;
    }

    document.addEventListener('click', event => {
      if (event.target.closest('#changeProfilePhoto')) {
        document.querySelector('#ownProfilePhotoInput')?.click();
      }
    });

    document.querySelector('#ownProfilePhotoInput')?.addEventListener('change', event => {
      const file = event.target.files?.[0];
      if (file) uploadProfilePhoto(file);
      event.target.value = '';
    });

    return {
      ensureProfileEditorModal,
      openProfileEditor,
      uploadProfilePhoto
    };
  }

  window.ROOMS_PROFILE_EDITOR_FEATURE = {
    create: createProfileEditorFeature
  };
})();
