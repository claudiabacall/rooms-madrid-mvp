(function () {
  'use strict';

  function create({
    document: doc,
    storageOrigin,
    now = () => Date.now(),
    maxVisibleAgeMs = 15000,
    setIntervalFn = setInterval,
    clearIntervalFn = clearInterval
  }) {
    if (!doc?.querySelectorAll) {
      throw new Error('Rooms: falta documento para fotos');
    }

    let origin;

    try {
      origin = new URL(storageOrigin).origin;
    } catch {
      throw new Error('Rooms: origen Storage invalido');
    }

    const prefix =
      '/storage/v1/object/sign/listing-images/';

    const observed = new WeakMap();
    let timer = null;

    function isManagedSource(source) {
      if (typeof source !== 'string' || !source) {
        return false;
      }

      try {
        const url = new URL(source, doc.baseURI);

        return (
          url.origin === origin &&
          url.pathname.startsWith(prefix) &&
          url.pathname.length > prefix.length &&
          url.searchParams.has('token')
        );
      } catch {
        return false;
      }
    }

    function managedImages() {
      return [...doc.querySelectorAll('img[src]')]
        .filter(img =>
          isManagedSource(img.getAttribute('src'))
        );
    }

    function retire(img) {
      // Retirar el nodo evita conservar la imagen visible.
      img.remove();
    }

    function sweep() {
      let retired = 0;

      for (const img of managedImages()) {
        const source = img.getAttribute('src');

        const previous = observed.get(img);

        if (!previous || previous.source !== source) {
          observed.set(img, {
            source,
            firstSeen: now()
          });
          continue;
        }

        if (
          now() - previous.firstSeen >= maxVisibleAgeMs
        ) {
          retire(img);
          retired++;
        }
      }

      return retired;
    }

    function clear() {
      const images = managedImages();

      for (const img of images) {
        retire(img);
      }

      return images.length;
    }

    function signedPhotoKey(source) {
      if (!isManagedSource(source)) return null;

      const url = new URL(source, doc.baseURI);

      // El token cambia al renovar; la ruta identifica la foto.
      return url.origin + url.pathname;
    }

    function reconcile(authorizedUrls = []) {
      // Reconciliar exclusivamente imagenes previamente firmadas.
      // Ninguna URL publica es una fuente de autorizacion.
      const fresh = new Map();

      for (const source of authorizedUrls) {
        const key = signedPhotoKey(source);

        if (key) {
          fresh.set(key, source);
        }
      }

      const result = {
        updated: 0,
        removed: 0,
        unchanged: 0
      };

      for (const img of managedImages()) {
        const previous = img.getAttribute('src');
        const key = signedPhotoKey(previous);
        const replacement = fresh.get(key);

        if (!replacement) {
          retire(img);
          result.removed++;
          continue;
        }

        if (replacement !== previous) {
          img.setAttribute('src', replacement);

          observed.set(img, {
            source: replacement,
            firstSeen: now()
          });

          result.updated++;
        } else {
          result.unchanged++;
        }
      }

      return result;
    }

    function start() {
      if (timer !== null) return;

      sweep();

      timer = setIntervalFn(
        () => sweep(),
        1000
      );
    }

    function stop() {
      if (timer === null) return;

      clearIntervalFn(timer);
      timer = null;
    }

    return {
      isManagedSource,
      signedPhotoKey,
      reconcile,
      sweep,
      clear,
      start,
      stop
    };
  }

  window.ROOMS_LISTING_PHOTO_DOM_GUARD = { create };
})();
