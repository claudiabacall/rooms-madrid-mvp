(function () {
  'use strict';

  function createHouseholdEventsFeature({
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
  }) {
    document.addEventListener('click', event => {
      const openSearchGroupButton =
        event.target.closest('[data-open-search-group]');

      if (openSearchGroupButton) {
        const householdId =
          openSearchGroupButton.dataset.openSearchGroup;

        if (householdId) {
          loadHousehold(householdId);
        }

        const communities =
          document.querySelector('#communitiesView');

        const household =
          document.querySelector('#householdView');

        if (communities) communities.hidden = true;
        if (household) household.hidden = false;

        document
          .querySelectorAll('[data-bottom-nav]')
          .forEach(item => {
            item.classList.toggle(
              'active',
              item.dataset.bottomNav === 'communities'
            );
          });

        window.scrollTo({
          top: 0,
          behavior: 'smooth'
        });

        return;
      }

      const voteButton =
        event.target.closest('[data-household-vote]');

      if (voteButton) {
        event.preventDefault();
        event.stopPropagation();

        voteHouseholdCandidate(
          voteButton.dataset.candidateType,
          voteButton.dataset.candidateId,
          voteButton.dataset.householdVote
        );

        return;
      }

      const sendPersonHomeButton =
        event.target.closest('[data-send-person-home]');

      if (sendPersonHomeButton) {
        event.preventDefault();
        event.stopImmediatePropagation();

        openGroupPicker(
          'person',
          sendPersonHomeButton.dataset.sendPersonHome
        );

        return;
      }

      const sendHomeButton =
        event.target.closest(
          '[data-send-home], [data-send-home-id]'
        );

      if (sendHomeButton) {
        event.preventDefault();
        event.stopPropagation();

        const listingId =
          sendHomeButton.dataset.sendHomeId ||
          sendHomeButton
            .closest('[data-real-listing]')
            ?.dataset.realListing ||
          sendHomeButton
            .closest('[data-saved-id]')
            ?.dataset.savedId ||
          sendHomeButton
            .closest('[data-save-id]')
            ?.dataset.saveId;

        const listing =
          listingId
            ? state.listings?.get(listingId)
            : null;

        if (!listing?.id) {
          notify('No encuentro esta vivienda');
          return;
        }

        openGroupPicker(
          'listing',
          listing.id
        );

        return;
      }

      const removePersonCandidateButton =
        event.target.closest(
          '[data-remove-household-person]'
        );

      if (removePersonCandidateButton) {
        removeHouseholdPersonCandidate(
          removePersonCandidateButton.dataset.removeHouseholdPerson
        );
        return;
      }

      const removeCandidateButton =
        event.target.closest(
          '[data-remove-household-candidate]'
        );

      if (removeCandidateButton) {
        removeHouseholdCandidate(
          removeCandidateButton.dataset.removeHouseholdCandidate
        );
        return;
      }

      if (event.target.closest('#acceptHouseholdInvite')) {
        acceptIncomingHouseholdInvite();
        return;
      }

      if (event.target.closest('#dismissHouseholdInvite')) {
        const modal =
          document.querySelector('#incomingHouseholdInviteModal');

        if (modal) {
          modal.classList.remove('open');
          modal.setAttribute('aria-hidden', 'true');
        }

        document.body.style.overflow = '';
        return;
      }

      if (
        event.target.closest('#inviteRealHousehold') ||
        event.target.closest('#inviteRealHouseholdSmall') ||
        event.target.closest('#inviteRealHouseholdMembers')
      ) {
        openHouseholdInviteModal();
        return;
      }

      if (event.target.closest('#generateHouseholdInvite')) {
        generateHouseholdInvitation();
        return;
      }

      if (event.target.closest('#copyHouseholdInviteLink')) {
        copyHouseholdInvitation();
        return;
      }

      if (event.target.closest('[data-close-household-invite]')) {
        const modal =
          document.querySelector('#householdInviteModal');

        if (modal) {
          modal.classList.remove('open');
          modal.setAttribute('aria-hidden', 'true');
        }

        document.body.style.overflow = '';
        return;
      }

      if (event.target.closest('#createHouseholdButton')) {
        const modal = ensureCreateHouseholdModal();

        modal.classList.add('open');
        modal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';

        setTimeout(() => {
          modal.querySelector('#createHouseholdName')?.focus();
        }, 50);

        return;
      }

      if (event.target.closest('[data-close-create-household]')) {
        const modal =
          document.querySelector('#createHouseholdModal');

        if (modal) {
          modal.classList.remove('open');
          modal.setAttribute('aria-hidden', 'true');
        }

        document.body.style.overflow = '';
        return;
      }

      const tab =
        event.target.closest('[data-real-household-tab]');

      if (tab && !tab.disabled) {
        const target = tab.dataset.realHouseholdTab;

        document
          .querySelectorAll('[data-real-household-tab]')
          .forEach(button => {
            button.classList.toggle(
              'active',
              button === tab
            );
          });

        document
          .querySelectorAll('[data-real-household-panel]')
          .forEach(panel => {
            panel.hidden =
              panel.dataset.realHouseholdPanel !== target;

            panel.classList.toggle(
              'active',
              panel.dataset.realHouseholdPanel === target
            );
          });

        return;
      }

      if (event.target.closest('[data-household-go-explore]')) {
        const exploreNav =
          document.querySelector('[data-bottom-nav="explore"]');

        if (exploreNav) {
          exploreNav.click();
        }

        return;
      }
    });

    return {};
  }

  window.ROOMS_HOUSEHOLD_EVENTS_FEATURE = {
    create: createHouseholdEventsFeature
  };
})();
