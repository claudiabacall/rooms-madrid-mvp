(function () {
  'use strict';

  function createCommunityManagementFeature({
    db,
    state,
    notify,
    escapeHtml,
    initials,
    renderRealCommunityDetail,
    loadMemberCommunities,
    renderFilteredExplore,
    renderRealFeed
  }) {
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
                        disabled
                        aria-disabled="true"
                      >

                      <span>
                        <b>Privada · Próximamente</b>
                        <small>
                          Disponible cuando activemos invitaciones y acceso privado.
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

    return {
      ensureManageCommunityModal,
      renderManageCommunityMembers,
      openManageCommunityModal,
      closeManageCommunityModal,
      saveCommunityManagement
    };
  }

  window.ROOMS_COMMUNITY_MANAGEMENT_FEATURE = {
    create: createCommunityManagementFeature
  };
})();
