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
      sweep,
      clear,
      start,
      stop
    };
  }

  window.ROOMS_LISTING_PHOTO_DOM_GUARD = { create };
})();
