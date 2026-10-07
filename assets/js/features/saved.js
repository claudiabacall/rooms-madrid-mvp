(function () {
  'use strict';

  function createSavedFeature({
    db,
    state,
    escapeHtml,
    notify,
    updateSavedCount,
    connectionButtonLabel
  }) {
    if (!db) {
      throw new Error(
        'Rooms Saved: falta db'
      );
    }

    if (!state) {
      throw new Error(
        'Rooms Saved: falta state'
      );
    }

    function initials(name) {
      return String(
        name || 'R'
      )
        .split(/\s+/)
        .slice(0, 2)
        .map(part => part[0])
        .join('')
        .toUpperCase();
    }

    function savedItemPresentation(saved) {
      if (!saved) return null;

      if (
        saved.item_type === 'room' ||
        saved.item_type === 'apartment'
      ) {
        const listing =
          state.listings.get(
            saved.item_id
          );

        if (!listing) {
          return null;
        }

        const priceLabel =
          listing.price != null
            ? `${Number(
                listing.price
              ).toLocaleString(
                'es-ES'
              )} €/mes`
            : 'Precio sin definir';

        const zoneLabel =
          listing.zone ||
          'Zona sin definir';

        return {
          title:
            `${priceLabel} · ${zoneLabel}`,

          subtitle:
            listing.kind === 'apartment'
              ? 'Piso entero'
              : 'Habitación',

          mark:
            '⌂',

          image:
            Array.isArray(
              listing.photos
            ) &&
            listing.photos.length
              ? listing.photos[0]
              : null
        };
      }

      if (
        saved.item_type === 'person'
      ) {
        const person =
          state.profiles.get(
            saved.item_id
          );

        if (!person) {
          return null;
        }

        const name =
          person.alias ||
          person.name ||
          'Usuario de Rooms';

        return {
          title: name,

          subtitle:
            person.zones?.[0] ||
            'Zona sin definir',

          mark:
            initials(name)
        };
      }

      if (
        saved.item_type === 'post'
      ) {
        const post =
          state.posts.get(
            saved.item_id
          );

        if (!post) {
          return null;
        }

        return {
          title:
            post.body,

          subtitle:
            'Publicación',

          mark:
            '“'
        };
      }

      if (
        saved.item_type ===
        'community'
      ) {
        const community =
          state.communities.get(
            saved.item_id
          );

        if (!community) {
          return null;
        }

        return {
          title:
            community.name,

          subtitle:
            'Comunidad',

          mark:
            '#'
        };
      }

      return null;
    }

    async function loadSavedCollections() {
      if (!state.user) {
        return;
      }

      const {
        data: collections,
        error
      } = await db
        .from(
          'saved_collections'
        )
        .select(
          'id,user_id,name,visibility,created_at'
        )
        .eq(
          'user_id',
          state.user.id
        )
        .order(
          'created_at',
          {
            ascending: false
          }
        );

      if (error) {
        console.error(
          'Rooms: error cargando colecciones',
          error
        );

        return;
      }

      state.savedCollections.clear();

      (
        collections || []
      ).forEach(
        collection => {
          state.savedCollections.set(
            collection.id,
            collection
          );
        }
      );

      const grid =
        document.querySelector(
          '#savedView .collection-grid'
        );

      if (!grid) {
        return;
      }

      if (
        !collections?.length
      ) {
        grid.innerHTML =
          '<div class="real-empty-state"><b>Todavía no tienes colecciones</b><p>Crea una cuando quieras organizar tus guardados.</p></div>';

        return;
      }

      const ids =
        collections.map(
          collection =>
            collection.id
        );

      const {
        data: items,
        error: itemsError
      } = await db
        .from(
          'saved_collection_items'
        )
        .select(
          'collection_id'
        )
        .in(
          'collection_id',
          ids
        );

      if (itemsError) {
        console.error(
          'Rooms: error cargando elementos de colecciones',
          itemsError
        );
      }

      const counts = {};

      (
        items || []
      ).forEach(item => {
        counts[
          item.collection_id
        ] =
          (
            counts[
              item.collection_id
            ] || 0
          ) + 1;
      });

      const collectionItems = {};

      await Promise.all(
        collections.map(
          async collection => {
            const {
              data: links
            } = await db
              .from(
                'saved_collection_items'
              )
              .select(
                'saved_item_id'
              )
              .eq(
                'collection_id',
                collection.id
              )
              .limit(4);

            if (
              !links?.length
            ) {
              collectionItems[
                collection.id
              ] = [];

              return;
            }

            const savedIds =
              links.map(
                item =>
                  item.saved_item_id
              );

            const {
              data: saved
            } = await db
              .from(
                'saved_items'
              )
              .select(
                'id,item_type,item_id'
              )
              .in(
                'id',
                savedIds
              );

            collectionItems[
              collection.id
            ] =
              (
                saved || []
              )
                .map(item => {
                  const presentation =
                    savedItemPresentation(
                      item
                    );

                  return presentation
                    ? {
                        image:
                          presentation.image ||
                          null,

                        mark:
                          presentation.mark ||
                          '#'
                      }
                    : null;
                })
                .filter(Boolean);
          }
        )
      );

      grid.innerHTML =
        collections
          .map(
            collection => {
              const count =
                counts[
                  collection.id
                ] || 0;

              const initial =
                (
                  collection.name ||
                  '#'
                )
                  .trim()
                  .charAt(0)
                  .toUpperCase() ||
                '#';

              const previews =
                collectionItems[
                  collection.id
                ] || [];

              const cover =
                previews.length
                  ? `<div class="collection-cover collection-cover-${Math.min(
                      previews.length,
                      4
                    )}">
                      ${previews
                        .map(
                          item =>
                            item.image
                              ? `<img src="${escapeHtml(
                                  item.image
                                )}" alt="">`
                              : `<span>${escapeHtml(
                                  item.mark
                                )}</span>`
                        )
                        .join('')}
                    </div>`
                  : `<div class="collection-cover collection-cover-empty"><span>${escapeHtml(
                      initial
                    )}</span></div>`;

              return `<button type="button"
                data-real-collection="${collection.id}">
                ${cover}
                <b>${escapeHtml(
                  collection.name
                )}</b>
                <small>${count} ${
                  count === 1
                    ? 'elemento'
                    : 'elementos'
                }</small>
              </button>`;
            }
          )
          .join('');
    }

    async function createSavedCollection(
      name,
      visibility = 'private'
    ) {
      if (!state.user) {
        return {
          error:
            new Error(
              'No hay sesión activa'
            )
        };
      }

      const cleanName =
        String(
          name || ''
        ).trim();

      if (!cleanName) {
        return {
          error:
            new Error(
              'La colección necesita un nombre'
            )
        };
      }

      const {
        data,
        error
      } = await db
        .from(
          'saved_collections'
        )
        .insert({
          user_id:
            state.user.id,

          name:
            cleanName,

          visibility
        })
        .select()
        .single();

      if (error) {
        console.error(
          'Rooms: error creando colección',
          error
        );

        return {
          error
        };
      }

      await loadSavedCollections();

      return {
        data
      };
    }

    function sortSavedItems(
      mode = 'recent'
    ) {
      const grid =
        document.querySelector(
          '#savedView .saved-grid'
        );

      if (!grid) {
        return;
      }

      const cards =
        [
          ...grid.querySelectorAll(
            '.saved-card'
          )
        ];

      cards.sort(
        (a, b) => {
          if (
            mode ===
            'price-asc'
          ) {
            const aPrice =
              Number(
                a.dataset
                  .savedPrice
              );

            const bPrice =
              Number(
                b.dataset
                  .savedPrice
              );

            const aHasPrice =
              Number.isFinite(
                aPrice
              ) &&
              a.dataset
                .savedPrice !==
                undefined;

            const bHasPrice =
              Number.isFinite(
                bPrice
              ) &&
              b.dataset
                .savedPrice !==
                undefined;

            if (
              !aHasPrice &&
              !bHasPrice
            ) {
              return 0;
            }

            if (!aHasPrice) {
              return 1;
            }

            if (!bHasPrice) {
              return -1;
            }

            return (
              aPrice -
              bPrice
            );
          }

          if (
            mode ===
            'price-desc'
          ) {
            const aPrice =
              Number(
                a.dataset
                  .savedPrice
              );

            const bPrice =
              Number(
                b.dataset
                  .savedPrice
              );

            const aHasPrice =
              Number.isFinite(
                aPrice
              ) &&
              a.dataset
                .savedPrice !==
                undefined;

            const bHasPrice =
              Number.isFinite(
                bPrice
              ) &&
              b.dataset
                .savedPrice !==
                undefined;

            if (
              !aHasPrice &&
              !bHasPrice
            ) {
              return 0;
            }

            if (!aHasPrice) {
              return 1;
            }

            if (!bHasPrice) {
              return -1;
            }

            return (
              bPrice -
              aPrice
            );
          }

          const aDate =
            new Date(
              a.dataset
                .savedCreated ||
                0
            ).getTime();

          const bDate =
            new Date(
              b.dataset
                .savedCreated ||
                0
            ).getTime();

          return (
            bDate -
            aDate
          );
        }
      );

      cards.forEach(
        card =>
          grid.appendChild(
            card
          )
      );
    }

    async function loadSavedItems() {
      if (!state.user) {
        return;
      }

      const {
        data,
        error
      } = await db
        .from(
          'saved_items'
        )
        .select(
          'item_type,item_id,created_at'
        )
        .eq(
          'user_id',
          state.user.id
        )
        .order(
          'created_at',
          {
            ascending: false
          }
        );

      if (error) {
        console.error(
          'Rooms: error cargando guardados',
          error
        );

        return;
      }

      if (!data) {
        return;
      }

      state.savedItems =
        new Set(
          data.map(
            item =>
              `${item.item_type}:${item.item_id}`
          )
        );

      updateSavedCount(
        data.length
      );

      document
        .querySelectorAll(
          '[data-save-id]:not([data-real-remove-saved])'
        )
        .forEach(
          button => {
            button.classList.remove(
              'saved'
            );

            if (
              button.matches(
                '[data-action]'
              )
            ) {
              button.innerHTML =
                '♡ <span>Guardar</span>';
            } else if (
              button.textContent.includes(
                'Guardado'
              )
            ) {
              button.textContent =
                '♡ Guardar';
            } else if (
              button.matches(
                'button'
              )
            ) {
              button.textContent =
                button.textContent.includes(
                  'Guardar'
                )
                  ? '♡ Guardar'
                  : '♡';
            }
          }
        );

      const counts = {
        room: 0,
        flat: 0,
        person: 0,
        post: 0,
        community: 0
      };

      const cards = [];

      data.forEach(item => {
        document
          .querySelectorAll(
            `[data-save-id="${item.item_id}"]`
          )
          .forEach(
            button => {
              button.classList.add(
                'saved'
              );

              button.innerHTML =
                button.matches(
                  '[data-action]'
                )
                  ? '♥ <span>Guardado</span>'
                  : button.textContent.includes(
                        'Guardar'
                      )
                    ? '♥ Guardado'
                    : '♥';
            }
          );

        const listing =
          state.listings.get(
            item.item_id
          );

        const person =
          state.profiles.get(
            item.item_id
          );

        const post =
          state.posts.get(
            item.item_id
          );

        const community =
          state.communities.get(
            item.item_id
          );

        if (listing) {
          const type =
            listing.kind ===
            'apartment'
              ? 'flat'
              : 'room';

          counts[type] += 1;

          cards.push(
            `<article class="saved-card saved-home"
              data-saved-type="${type}"
              data-real-listing="${listing.id}"
              data-saved-created="${escapeHtml(
                item.created_at || ''
              )}"
              data-saved-price="${Number(
                listing.price || 0
              )}">
              ${
                Array.isArray(
                  listing.photos
                ) &&
                listing.photos.length
                  ? `<img src="${escapeHtml(
                      listing.photos[0]
                    )}" alt="${escapeHtml(
                      listing.title ||
                      listing.zone
                    )}">`
                  : '<div class="saved-text-cover">⌂</div>'
              }
              <div>
                <small>${
                  listing.kind ===
                  'apartment'
                    ? 'PISO'
                    : 'HABITACIÓN'
                }</small>
                <h3>${
                  listing.price != null
                    ? `${Number(
                        listing.price
                      ).toLocaleString(
                        'es-ES'
                      )} €/mes`
                    : 'Precio sin definir'
                } · ${escapeHtml(
                  listing.zone ||
                  'Zona sin definir'
                )}</h3>
                <p>${
                  listing.kind ===
                  'apartment'
                    ? 'Piso entero'
                    : 'Habitación'
                }</p>
                <div class="saved-card-actions">
                  <button
                    type="button"
                    data-real-remove-saved
                    data-save-kind="${item.item_type}"
                    data-save-id="${item.item_id}">
                    Eliminar
                  </button>
                </div>
              </div>
            </article>`
          );

          return;
        }

        if (
          person &&
          person.id !==
            state.user.id
        ) {
          counts.person += 1;

          const name =
            person.alias ||
            person.name ||
            'Usuario de Rooms';

          cards.push(
            `<article
              class="saved-card saved-person"
              data-saved-type="person"
              data-real-user="${person.id}"
              data-saved-created="${escapeHtml(
                item.created_at || ''
              )}">
              <div class="saved-text-cover">${escapeHtml(
                initials(name)
              )}</div>
              <div>
                <small>PERSONA</small>
                <h3>${escapeHtml(
                  name
                )}</h3>
                <p>${escapeHtml(
                  person.zones?.[0] ||
                  'Zona sin definir'
                )}</p>
                <div class="saved-card-actions">
                  <button
                    type="button"
                    data-connect
                    data-user-id="${person.id}">
                    ${escapeHtml(
                      connectionButtonLabel(
                        person.id
                      )
                    )}
                  </button>
                  <button
                    type="button"
                    data-real-remove-saved
                    data-save-kind="person"
                    data-save-id="${person.id}">
                    Eliminar
                  </button>
                </div>
              </div>
            </article>`
          );

          return;
        }

        if (post) {
          counts.post += 1;

          cards.push(
            `<article
              class="saved-card saved-post"
              data-saved-type="post"
              data-saved-created="${escapeHtml(
                item.created_at || ''
              )}">
              <div class="saved-text-cover">“</div>
              <div>
                <small>PUBLICACIÓN</small>
                <h3>${escapeHtml(
                  post.body
                )}</h3>
                <div class="saved-card-actions">
                  <button
                    type="button"
                    data-real-remove-saved
                    data-save-kind="post"
                    data-save-id="${post.id}">
                    Eliminar
                  </button>
                </div>
              </div>
            </article>`
          );

          return;
        }

        if (community) {
          counts.community += 1;

          cards.push(
            `<article
              class="saved-card saved-community"
              data-saved-type="community"
              data-saved-created="${escapeHtml(
                item.created_at || ''
              )}">
              <div class="saved-community-cover">#</div>
              <div>
                <small>COMUNIDAD</small>
                <h3>${escapeHtml(
                  community.name
                )}</h3>
                <div class="saved-card-actions">
                  <button
                    type="button"
                    data-real-remove-saved
                    data-save-kind="community"
                    data-save-id="${community.id}">
                    Eliminar
                  </button>
                </div>
              </div>
            </article>`
          );
        }
      });

      const grid =
        document.querySelector(
          '#savedView .saved-grid'
        );

      if (grid) {
        grid.innerHTML =
          cards.length
            ? cards.join('')
            : '<div class="real-empty-state"><b>Todavía no has guardado nada</b><p>Aquí aparecerán las viviendas y personas que quieras volver a mirar.</p></div>';
      }

      Object.entries(
        counts
      ).forEach(
        ([type, count]) => {
          const label =
            document.querySelector(
              `#savedView [data-saved-filter="${type}"] i`
            );

          if (label) {
            label.textContent =
              count;
          }
        }
      );

      const all =
        document.querySelector(
          '#savedView [data-saved-filter="all"] i'
        );

      if (all) {
        all.textContent =
          data.length;
      }

      sortSavedItems(
        document.querySelector(
          '#savedSort'
        )?.value ||
          'recent'
      );

      const activeSavedFilter =
        document.querySelector(
          '#savedView [data-saved-filter].active'
        );

      const activeSavedType =
        activeSavedFilter
          ?.dataset
          .savedFilter ||
        'all';

      const renderedSavedCards =
        document.querySelectorAll(
          '#savedView [data-saved-type]'
        );

      renderedSavedCards.forEach(
        card => {
          card.hidden =
            activeSavedType !==
              'all' &&
            card.dataset
              .savedType !==
              activeSavedType;
        }
      );

      const visibleSavedCount =
        activeSavedType ===
        'all'
          ? renderedSavedCards.length
          : [
              ...renderedSavedCards
            ].filter(
              card =>
                card.dataset
                  .savedType ===
                activeSavedType
            ).length;

      const savedTitle =
        document.querySelector(
          '#savedResultsTitle'
        );

      if (savedTitle) {
        savedTitle.textContent =
          `${visibleSavedCount} ${
            visibleSavedCount === 1
              ? 'elemento'
              : 'elementos'
          }`;
      }
    }

    return {
      initials,
      savedItemPresentation,
      loadSavedCollections,
      createSavedCollection,
      loadSavedItems,
      sortSavedItems
    };
  }

  window.ROOMS_SAVED_FEATURE = {
    create:
      createSavedFeature
  };
})();
