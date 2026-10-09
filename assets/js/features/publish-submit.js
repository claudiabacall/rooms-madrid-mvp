(function () {
  'use strict';

  function createPublishSubmitFeature({
    db,
    state,
    publishTotals,
    notify,
    geocodeListingAddress,
    uploadCommunityPostMedia,
    uploadListingPhotos,
    hideAllModals,
    loadRealContent,
    loadSavedItems,
    openRealCommunity
  }) {
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

    return { publishRealContent };
  }

  window.ROOMS_PUBLISH_SUBMIT_FEATURE = {
    create: createPublishSubmitFeature
  };
})();
