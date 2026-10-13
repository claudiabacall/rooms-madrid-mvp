(function () {
  'use strict';

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

  window.ROOMS_PRIVACY_PREFERENCES = {
    normalizePreferencesRecord
  };
})();
