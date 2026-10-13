(function () {
  'use strict';

  function createMatchingFeature({
    db,
    state,
    escapeHtml,
    showModal
  }) {
function normalizeMatchValue(value) {
      return String(value || '')
        .trim()
        .toLowerCase();
    }


    function calculateRealMatch(target) {
      const ownProfile = state.profile || {};
      const ownAnswers =
        state.preferences?.answers || {};

      const factors = [];

      /*
       * ZONAS
       */
      const ownZones =
        (ownProfile.zones || [])
          .map(normalizeMatchValue)
          .filter(Boolean);

      const targetZones =
        (target?.zones || [])
          .map(normalizeMatchValue)
          .filter(Boolean);

      if (ownZones.length && targetZones.length) {
        const sharedZones =
          ownZones.filter(zone =>
            targetZones.includes(zone)
          );

        factors.push({
          key: 'zones',
          label: 'Zonas',
          score: sharedZones.length ? 100 : 0,
          detail: sharedZones.length
            ? `Coincidís en ${sharedZones.join(', ')}`
            : 'No hay una zona coincidente'
        });
      }


      /*
       * PRESUPUESTO
       */
      const ownHasBudget =
        ownProfile.budget_min != null ||
        ownProfile.budget_max != null;

      const targetHasBudget =
        target?.budget_min != null ||
        target?.budget_max != null;

      if (ownHasBudget && targetHasBudget) {
        const ownMin =
          Number(ownProfile.budget_min ?? 0);

        const ownMax =
          Number(
            ownProfile.budget_max ??
            Number.MAX_SAFE_INTEGER
          );

        const targetMin =
          Number(target.budget_min ?? 0);

        const targetMax =
          Number(
            target.budget_max ??
            Number.MAX_SAFE_INTEGER
          );

        const overlaps =
          ownMin <= targetMax &&
          targetMin <= ownMax;

        factors.push({
          key: 'budget',
          label: 'Presupuesto',
          score: overlaps ? 100 : 0,
          detail: overlaps
            ? 'Vuestros rangos de presupuesto se solapan'
            : 'Vuestros rangos de presupuesto no se solapan'
        });
      }


      /*
       * FECHA DE ENTRADA
       *
       * <= 31 días: compatible
       * 32–62 días: compatibilidad parcial
       * > 62 días: diferente
       */
      if (
        ownProfile.move_in_date &&
        target?.move_in_date
      ) {
        const ownDate =
          new Date(
            `${ownProfile.move_in_date}T00:00:00`
          );

        const targetDate =
          new Date(
            `${target.move_in_date}T00:00:00`
          );

        const differenceDays =
          Math.round(
            Math.abs(
              ownDate.getTime() -
              targetDate.getTime()
            ) /
            86400000
          );

        let score = 0;

        if (differenceDays <= 31) {
          score = 100;
        } else if (differenceDays <= 62) {
          score = 50;
        }

        factors.push({
          key: 'date',
          label: 'Fecha de entrada',
          score,
          detail:
            differenceDays === 0
              ? 'Buscáis entrar en la misma fecha'
              : `${differenceDays} días de diferencia`
        });
      }


      /*
       * DURACIÓN
       */
      if (
        ownProfile.duration &&
        ownProfile.duration !== 'unknown' &&
        target?.duration &&
        target.duration !== 'unknown'
      ) {
        const sameDuration =
          ownProfile.duration ===
          target.duration;

        factors.push({
          key: 'duration',
          label: 'Duración',
          score: sameDuration ? 100 : 0,
          detail: sameDuration
            ? 'Buscáis una duración similar'
            : 'Buscáis duraciones distintas'
        });
      }


      /*
       * DNA V2: se calcula por separado.
       * Nunca utilizar respuestas V1 como sustituto.
       */
      const ownDna = state.roomsDna;
      const dnaEngine = window.ROOMS_MATCH_V2;

      const targetDnaAllowed =
        target?.living_visible === true &&
        target?.dna_dimensions &&
        typeof target.dna_dimensions === 'object' &&
        !Array.isArray(target.dna_dimensions);

      const livingMatch =
        ownDna?.model_version === 2 &&
        targetDnaAllowed &&
        dnaEngine
          ? dnaEngine.calculate(
              ownDna.dimensions,
              target.dna_dimensions
            )
          : {
              score: null,
              comparedDimensions: 0,
              sufficientEvidence: false,
              factors: []
            };


      /*
       * TIPO DE BÚSQUEDA
       *
       * Lo mostramos como información,
       * pero no entra todavía en la nota:
       * "buscar habitación", "piso" o
       * "compañeros" no determina por sí solo
       * que dos personas sean incompatibles.
       */
      const ownSeeking =
        ownProfile.seeking || [];

      const targetSeeking =
        target?.seeking || [];

      const comparableSeeking =
        ownSeeking.length &&
        targetSeeking.length;

      const seekingInfo =
        comparableSeeking
          ? {
              own: ownSeeking,
              target: targetSeeking
            }
          : null;


      const score =
        factors.length
          ? Math.round(
              factors.reduce(
                (total, factor) =>
                  total + factor.score,
                0
              ) /
              factors.length
            )
          : null;

      return {
        score,
        factors,
        seekingInfo,
        comparedFactors: factors.length,
        livingMatch
      };
    }


    async function loadRealMatchProfile(userId) {
      if (!state.user || !userId) {
        return null;
      }

      const { data, error } =
        await db.rpc(
          'get_match_profile',
          {
            target_user_id: userId
          }
        );

      if (error) {
        console.error(
          'Rooms: error cargando datos de compatibilidad',
          error
        );

        return null;
      }

      return data || null;
    }


    function ensureRealMatchModal() {
      const modal =
        document.querySelector('#matchModal');

      if (!modal) return null;

      modal.innerHTML = `
        <div
          class="backdrop"
          data-close-real-match
        ></div>

        <article class="detail match-detail-shell">

          <button
            type="button"
            class="close match-back"
            data-close-real-match
            aria-label="Volver"
          >
            ←
          </button>

          <div id="realMatchContent"></div>

        </article>
      `;

      return modal;
    }


    async function openRealMatch(profile) {
      if (
        !profile ||
        !state.user ||
        state.blockedUsers?.has(profile.id)
      ) {
        return;
      }

      const modal =
        ensureRealMatchModal();

      if (!modal) return;

      const content =
        modal.querySelector(
          '#realMatchContent'
        );

      content.innerHTML = `
        <div class="real-match-loading">
          Calculando compatibilidad…
        </div>
      `;

      showModal(modal);

      const target =
        await loadRealMatchProfile(
          profile.id
        );

      if (!target) {
        content.innerHTML = `
          <div class="real-empty-state">
            <b>No hay suficientes datos disponibles</b>
            <p>
              La privacidad del perfil o los datos
              disponibles no permiten calcular la
              compatibilidad ahora mismo.
            </p>
          </div>
        `;

        return;
      }

      const match =
        calculateRealMatch(target);

      const name =
        profile.alias ||
        profile.name ||
        'esta persona';

      const scoreLabel =
        match.score == null
          ? '—'
          : `${match.score}%`;

      const livingScoreLabel =
        match.livingMatch?.score == null
          ? 'Datos insuficientes'
          : `${match.livingMatch.score}%`;

      const livingDetail =
        match.livingMatch?.score == null
          ? 'No hay suficientes dimensiones DNA V2 autorizadas y comparables.'
          : `${match.livingMatch.comparedDimensions} dimensiones comparadas en ambas direcciones.`;

      content.innerHTML = `
        <section class="real-match-hero">

          <small>
            COMPATIBILIDAD CON
            ${escapeHtml(name.toUpperCase())}
          </small>

          <h2>Convivencia · ROOMS DNA V2</h2>
          <strong>${escapeHtml(livingScoreLabel)}</strong>
          <p>${escapeHtml(livingDetail)}</p>

          <h2>Viabilidad de búsqueda</h2>
          <strong>${escapeHtml(scoreLabel)}</strong>

          <h2>
            ${
              match.comparedFactors
                ? `Calculado con ${match.comparedFactors} ${
                    match.comparedFactors === 1
                      ? 'factor real'
                      : 'factores reales'
                  }`
                : 'Sin datos suficientes'
            }
          </h2>

          <p>
            Ambos resultados son independientes.
            Solo se utilizan datos disponibles y autorizados
            por la privacidad del perfil.
          </p>

        </section>

        <section class="real-match-factors">

          ${
            match.factors.length
              ? match.factors.map(factor => `
                  <article>
                    <div>
                      <b>
                        ${escapeHtml(factor.label)}
                      </b>

                      <span>
                        ${escapeHtml(factor.detail)}
                      </span>
                    </div>

                    <strong>
                      ${factor.score}%
                    </strong>
                  </article>
                `).join('')
              : `
                  <div class="real-empty-state">
                    <b>No hay factores comparables todavía</b>
                  </div>
                `
          }

        </section>

        ${
          match.seekingInfo
            ? `
              <section class="real-match-note">
                <small>TIPO DE BÚSQUEDA</small>
                <p>
                  Este dato se muestra como contexto,
                  pero no altera el porcentaje hasta
                  que Rooms pueda distinguir mejor
                  el rol de cada persona en la búsqueda.
                </p>
              </section>
            `
            : ''
        }

        <aside class="real-match-method">
          <b>Cómo se calcula</b>
          <p>
            La viabilidad compara zona, presupuesto,
            fecha y duración. La convivencia compara
            dimensiones DNA V2 en ambas direcciones,
            cuando hay evidencia suficiente y autorización.
            No se utilizan respuestas V1 ni datos ocultos.
          </p>
        </aside>

      `;
    }

    return {
      normalizeMatchValue,
      calculateRealMatch,
      loadRealMatchProfile,
      ensureRealMatchModal,
      openRealMatch
    };
  }

  window.ROOMS_MATCHING_FEATURE = {
    create: createMatchingFeature
  };
})();
