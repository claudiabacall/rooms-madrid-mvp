(function () {
  'use strict';

  function create({
    cache,
    mainPresentation,
    householdPresentation,
    domGuard,
    getMainListings,
    getHouseholdListings,
    getSessionUserId
  }) {
    if (
      typeof cache?.invalidate !== 'function' ||
      typeof mainPresentation?.prepare !== 'function' ||
      typeof mainPresentation?.get !== 'function' ||
      typeof mainPresentation?.invalidate !== 'function' ||
      typeof householdPresentation?.prepare !== 'function' ||
      typeof householdPresentation?.get !== 'function' ||
      typeof householdPresentation?.invalidate !== 'function' ||
      typeof domGuard?.reconcile !== 'function' ||
      typeof getMainListings !== 'function' ||
      typeof getHouseholdListings !== 'function' ||
      typeof getSessionUserId !== 'function'
    ) {
      throw new Error('Rooms: dependencias de renovacion incompletas');
    }

    let generation = 0;
    let running = null;

    function cancel() {
      generation++;
      running = null;
    }

    function collectUrls(presentation, listings) {
      const urls = [];

      for (const listing of listings) {
        const projected = presentation.get(listing);

        if (Array.isArray(projected?.photos)) {
          for (const url of projected.photos) {
            if (typeof url === 'string' && url) {
              urls.push(url);
            }
          }
        }
      }

      return urls;
    }

    function renew() {
      if (running) {
        return running;
      }

      const userId = getSessionUserId();

      if (!userId) {
        return Promise.resolve(false);
      }

      const currentGeneration = ++generation;

      const task = (async () => {
        try {
          const main = getMainListings();
          const household = getHouseholdListings();

          if (!Array.isArray(main) || !Array.isArray(household)) {
            throw new Error('Rooms: listas de fotos invalidas');
          }

          // Obligar a solicitar URLs nuevas, no reutilizar
          // resultados anteriores del cache.
          cache.invalidate();
          mainPresentation.invalidate();
          householdPresentation.invalidate();

          await Promise.all([
            mainPresentation.prepare(main),
            householdPresentation.prepare(household)
          ]);

          // Una respuesta de otra sesion nunca actualiza
          // imagenes visibles.
          if (
            generation !== currentGeneration ||
            getSessionUserId() !== userId
          ) {
            return false;
          }

          const urls = [
            ...collectUrls(mainPresentation, main),
            ...collectUrls(householdPresentation, household)
          ];

          domGuard.reconcile(urls);
          return true;
        } catch {
          if (
            generation === currentGeneration &&
            getSessionUserId() === userId
          ) {
            // Fallo de renovacion: no conservar una
            // autorizacion visual antigua.
            domGuard.reconcile([]);
          }

          return false;
        }
      })();

      running = task;

      task.finally(() => {
        if (running === task) {
          running = null;
        }
      });

      return task;
    }

    return { renew, cancel };
  }

  window.ROOMS_LISTING_PHOTO_RENEWAL = { create };
})();
