const toast=document.querySelector('#toast');

const onboarding=document.querySelector('#onboarding');
const onboardingContinue=document.querySelector('#onboardingContinue');
const onboardingBack=document.querySelector('#onboardingBack');
const roomsDna=window.ROOMS_DNA;

let onboardingStep=1;

const dnaState={
  thisOrThat:{},
  scenarios:{},
  importance:{},
  dealbreakers:{},
  homePreferences:{},
  interests:new Set(),
  traits:new Set(),
  intents:new Set()
};

/*
  ROOMS DNA V2 — CANONICAL ANSWERS

  Esta será la única fuente de verdad del nuevo
  onboarding. Durante la migración convivirá
  temporalmente con dnaState v1.
*/
const roomsDnaV2Answers={};

function setRoomsDnaV2Answer(
  interactionId,
  value
){
  if(
    !interactionId ||
    value===undefined ||
    value===null
  ){
    return;
  }

  roomsDnaV2Answers[
    interactionId
  ]=value;
}

function removeRoomsDnaV2Answer(
  interactionId
){
  delete roomsDnaV2Answers[
    interactionId
  ];
}

function getRoomsDnaV2Answers(){
  return structuredClone(
    roomsDnaV2Answers
  );
}

/*
  Temporal para inspección durante desarrollo.
*/
window.__roomsDnaV2Answers=
  roomsDnaV2Answers;

function toggleSetButton(button,set,value){
  const active=button.getAttribute('aria-pressed')==='true';
  button.setAttribute('aria-pressed',String(!active));
  button.classList.toggle('selected',!active);

  if(active)set.delete(value);
  else set.add(value);

  updateOnboardingContinue();
}

function selectSingle(selector,current){
  document.querySelectorAll(selector).forEach(button=>{
    const active=button===current;
    button.setAttribute('aria-pressed',String(active));
    button.classList.toggle('selected',active);
  });
}

let dnaThisIndex=0;

function getRoomsDnaV2VibeQuestions(){
  return (
    window.ROOMS_DNA_V2
      ?.interactions || []
  ).filter(
    interaction=>
      interaction.act==='vibe' &&
      interaction.type==='forced_choice'
  );
}

function thisOrThatComplete(){
  const questions=
    getRoomsDnaV2VibeQuestions();

  return (
    questions.length>0 &&
    questions.every(
      question=>Boolean(
        roomsDnaV2Answers[
          question.id
        ]
      )
    )
  );
}

function renderRoomsDnaGlobalProgress(
  current,
  chapter
){
  const total=10;

  const pieces=
    Array.from(
      {length:total},
      (_,index)=>{
        const position=index+1;

        const state=
          position<current
            ? 'is-done'
            : position===current
              ? 'is-current'
              : '';

        return `
          <i
            class="${state}"
            aria-hidden="true">
          </i>
        `;
      }
    ).join('');

  return `
    <header class="dna-global-run">
      <div class="dna-global-run-copy">
        <small>
          ROOMS DNA · ${chapter}
        </small>

        <span>
          ${String(current).padStart(2,'0')}
          /
          ${String(total).padStart(2,'0')}
        </span>
      </div>

      <div
        class="dna-global-strip"
        aria-label="Paso ${current} de ${total}">
        ${pieces}
      </div>
    </header>
  `;
}


function renderThisOrThat(){
  const host=
    document.querySelector(
      '#dnaThisOrThat'
    );

  const questions=
    getRoomsDnaV2VibeQuestions();

  if(
    !host ||
    !questions.length
  )return;

  if(
    dnaThisIndex>=
    questions.length
  ){
    host.innerHTML=`
      <div class="dna-vibe-complete">
        <div class="dna-vibe-complete-mark">
          ✦
        </div>

        <small>
          VIBE COMPLETADO
        </small>

        <strong>
          Primera capa desbloqueada.
        </strong>

        <button
          type="button"
          data-dna-review-this>
          Revisar VIBE
        </button>
      </div>
    `;

    updateOnboardingContinue();
    return;
  }

  const question=
    questions[dnaThisIndex];

  const left=
    question.options?.[0];

  const right=
    question.options?.[1];

  if(!left||!right)return;

  host.innerHTML=`
    <div
      class="dna-vibe-stage dna-swipe-stage"
      data-dna-swipe-stage
      tabindex="0"
      aria-label="${question.prompt}">

      ${renderRoomsDnaGlobalProgress(
        dnaThisIndex+1,
        'VIBE'
      )}

      <div class="dna-vibe-question">
        <small>
          ${question.eyebrow}
        </small>

        <h2>
          ${question.prompt}
        </h2>

        <p>
          Elige por instinto.
        </p>
      </div>

      <div
        class="dna-vibe-choices"
        role="group"
        aria-label="${question.prompt}">

        <button
          class="
            dna-vibe-choice
            dna-vibe-choice-a
            dna-swipe-choice
          "
          type="button"
          data-dna-this="${question.id}"
          data-dna-value="${left.id}"
          data-dna-swipe-choice="left"
          aria-label="${left.label}">

          <span class="dna-vibe-choice-code">
            A
          </span>

          <strong>
            ${left.label}
          </strong>

          <span class="dna-vibe-choice-arrow">
            ↙
          </span>
        </button>

        <div
          class="dna-vibe-versus"
          aria-hidden="true">
          OR
        </div>

        <button
          class="
            dna-vibe-choice
            dna-vibe-choice-b
            dna-swipe-choice
          "
          type="button"
          data-dna-this="${question.id}"
          data-dna-value="${right.id}"
          data-dna-swipe-choice="right"
          aria-label="${right.label}">

          <span class="dna-vibe-choice-code">
            B
          </span>

          <strong>
            ${right.label}
          </strong>

          <span class="dna-vibe-choice-arrow">
            ↘
          </span>
        </button>
      </div>

      <footer class="dna-vibe-footer">
        <span>
          ← A
        </span>

        <b>
          NO LO PIENSES DEMASIADO
        </b>

        <span>
          B →
        </span>
      </footer>

    </div>
  `;

  bindThisOrThatGesture();
}

function commitThisOrThat(side){
  const questions=
    getRoomsDnaV2VibeQuestions();

  const question=
    questions[dnaThisIndex];

  if(!question)return;

  const option=
    side==='left'
      ? question.options?.[0]
      : question.options?.[1];

  if(!option)return;

  /*
    Escritura DIRECTA V2.
    Ya no pasa por dnaState.thisOrThat.
  */
  setRoomsDnaV2Answer(
    question.id,
    option.id
  );

  const card=
    document.querySelector(
      '[data-dna-swipe-card]'
    );

  const stage=
    document.querySelector(
      '[data-dna-swipe-stage]'
    );

  const choice=
    document.querySelector(
      `[data-dna-swipe-choice="${side}"]`
    );

  if(stage){
    stage.classList.remove(
      'is-committed-left',
      'is-committed-right'
    );

    stage.classList.add(
      side==='left'
        ? 'is-committed-left'
        : 'is-committed-right'
    );
  }

  if(choice){
    choice.classList.add(
      'is-selected'
    );
  }

  if(card){
    card.classList.add(
      side==='left'
        ? 'swipe-out-left'
        : 'swipe-out-right'
    );
  }

  updateOnboardingContinue();

  window.setTimeout(()=>{
    dnaThisIndex+=1;
    renderThisOrThat();
  },260);
}

function bindThisOrThatGesture(){
  const stage=
    document.querySelector(
      '[data-dna-swipe-stage]'
    );

  if(!stage)return;

  stage.addEventListener(
    'keydown',
    event=>{
      if(
        event.key==='ArrowLeft' ||
        event.key.toLowerCase()==='a'
      ){
        event.preventDefault();
        commitThisOrThat('left');
      }

      if(
        event.key==='ArrowRight' ||
        event.key.toLowerCase()==='b'
      ){
        event.preventDefault();
        commitThisOrThat('right');
      }
    }
  );
}


function renderScaleQuestions(hostSelector,questions,scale,dataAttr,stateKey){
  const host=document.querySelector(hostSelector);
  if(!host||!roomsDna)return;

  host.innerHTML=questions.map(question=>`
    <section class="dna-question">
      <h2>${question.title||question.label}</h2>
      <div class="dna-scale" role="group" aria-label="${question.title||question.label}">
        ${scale.map(option=>`
          <button type="button"
            ${dataAttr}="${question.id}"
            data-dna-value="${option.id}"
            aria-pressed="${dnaState[stateKey][question.id]===option.id}">
            ${option.label}
          </button>
        `).join('')}
      </div>
    </section>
  `).join('');
}

let dnaHomeSelected=null;
let dnaHomePointer=null;

const dnaHomeSymbols={
  natural_light:'☀',
  terrace:'↗',
  exterior:'◯',
  private_bathroom:'◇',
  transport:'⌁'
};

function getRoomsDnaV2HomeQuestion(){
  return (
    window.ROOMS_DNA_V2
      ?.interactions || []
  ).find(
    interaction=>
      interaction.id==='home_priorities' &&
      interaction.act==='home' &&
      interaction.type==='priority_board'
  ) || null;
}

function getRoomsDnaV2HomeAnswers(){
  return (
    roomsDnaV2Answers
      .home_priorities || {}
  );
}

function homePrioritiesComplete(){
  const question=
    getRoomsDnaV2HomeQuestion();

  if(!question)return false;

  const answers=
    getRoomsDnaV2HomeAnswers();

  return question.items.every(
    item=>Boolean(
      answers[item.id]
    )
  );
}

function setHomePreference(
  preferenceId,
  levelId
){
  const question=
    getRoomsDnaV2HomeQuestion();

  if(!question)return;

  const validPreference=
    question.items.some(
      item=>
        item.id===preferenceId
    );

  const validLevel=
    question.levels.some(
      item=>
        item.id===levelId
    );

  if(
    !validPreference ||
    !validLevel
  )return;

  const current={
    ...getRoomsDnaV2HomeAnswers()
  };

  current[
    preferenceId
  ]=levelId;

  setRoomsDnaV2Answer(
    'home_priorities',
    current
  );

  dnaHomeSelected=null;

  renderHomePreferences();
  updateOnboardingContinue();
}

function homePreferenceCard(
  preference
){
  const question=
    getRoomsDnaV2HomeQuestion();

  const current=
    getRoomsDnaV2HomeAnswers()[
      preference.id
    ];

  const selected=
    dnaHomeSelected===
    preference.id;

  const currentLabel=
    question?.levels
      ?.find(
        option=>
          option.id===current
      )
      ?.label || '';

  return `
    <button
      type="button"
      class="dna-home-card${
        selected
          ? ' is-selected'
          : ''
      }"
      data-home-id="${preference.id}"
      aria-pressed="${selected}"
      aria-label="${preference.label}${
        current
          ? `, ${currentLabel}`
          : ', sin colocar'
      }">

      <span aria-hidden="true">
        ${
          dnaHomeSymbols[
            preference.id
          ] || '✦'
        }
      </span>

      <strong>
        ${preference.label}
      </strong>

      <small>
        ${
          current
            ? 'Cambiar'
            : 'Elegir'
        }
      </small>
    </button>
  `;
}

function bindHomePreferenceBoard(){
  const board=
    document.querySelector(
      '.dna-home-board'
    );

  const experience=
    document.querySelector(
      '.dna-home-experience'
    );

  if(!board||!experience)return;

  experience
    .querySelectorAll(
      '.dna-home-card'
    )
    .forEach(card=>{

      card.addEventListener(
        'pointerdown',
        event=>{
          if(
            event.button!==undefined &&
            event.button!==0
          )return;

          event.preventDefault();

          if(
            card.setPointerCapture
          ){
            try{
              card.setPointerCapture(
                event.pointerId
              );
            }catch(error){}
          }

          const rect=
            card.getBoundingClientRect();

          dnaHomePointer={
            id:event.pointerId,
            preferenceId:
              card.dataset.homeId,
            card,
            startX:event.clientX,
            startY:event.clientY,
            offsetX:
              event.clientX-
              rect.left,
            offsetY:
              event.clientY-
              rect.top,
            moved:false
          };

          card.classList.add(
            'is-dragging'
          );

          card.style.width=
            `${rect.width}px`;

          card.style.height=
            `${rect.height}px`;

          card.style.position=
            'fixed';

          card.style.left=
            `${rect.left}px`;

          card.style.top=
            `${rect.top}px`;

          card.style.margin='0';
          card.style.zIndex='9999';

          document.body.classList.add(
            'dna-home-is-dragging'
          );
        }
      );
    });

  board
    .querySelectorAll(
      '.dna-home-zone'
    )
    .forEach(zone=>{
      zone.addEventListener(
        'click',
        event=>{
          if(
            event.target.closest(
              '.dna-home-card'
            )
          )return;

          if(!dnaHomeSelected)return;

          setHomePreference(
            dnaHomeSelected,
            zone.dataset.homeLevel
          );
        }
      );

      zone.addEventListener(
        'keydown',
        event=>{
          if(
            !dnaHomeSelected ||
            (
              event.key!=='Enter' &&
              event.key!==' '
            )
          )return;

          event.preventDefault();

          setHomePreference(
            dnaHomeSelected,
            zone.dataset.homeLevel
          );
        }
      );
    });
}

function moveHomePreferencePointer(
  event
){
  if(
    !dnaHomePointer ||
    dnaHomePointer.id!==
      event.pointerId
  )return;

  const pointer=
    dnaHomePointer;

  const card=
    pointer.card;

  if(!card)return;

  const dx=
    event.clientX-
    pointer.startX;

  const dy=
    event.clientY-
    pointer.startY;

  if(
    Math.hypot(dx,dy)>5
  ){
    pointer.moved=true;
  }

  if(!pointer.moved)return;

  card.style.left=
    `${
      event.clientX-
      pointer.offsetX
    }px`;

  card.style.top=
    `${
      event.clientY-
      pointer.offsetY
    }px`;

  card.style.transform=
    `rotate(${Math.max(
      -5,
      Math.min(5,dx/35)
    )}deg)`;

  card.style.pointerEvents='none';

  const target=
    document.elementFromPoint(
      event.clientX,
      event.clientY
    );

  card.style.pointerEvents='';

  const hoveredZone=
    target?.closest(
      '.dna-home-zone'
    );

  document
    .querySelectorAll(
      '.dna-home-zone'
    )
    .forEach(zone=>{
      zone.classList.toggle(
        'is-drop-target',
        zone===hoveredZone
      );
    });
}

function finishHomePreferencePointer(
  event
){
  if(
    !dnaHomePointer ||
    dnaHomePointer.id!==
      event.pointerId
  )return;

  const pointer=
    dnaHomePointer;

  const card=
    pointer.card;

  card.style.pointerEvents='none';

  const target=
    document.elementFromPoint(
      event.clientX,
      event.clientY
    );

  card.style.pointerEvents='';

  const zone=
    target?.closest(
      '.dna-home-zone'
    );

  document
    .querySelectorAll(
      '.dna-home-zone'
    )
    .forEach(item=>{
      item.classList.remove(
        'is-drop-target'
      );
    });

  document.body.classList.remove(
    'dna-home-is-dragging'
  );

  dnaHomePointer=null;

  if(
    pointer.moved &&
    zone
  ){
    setHomePreference(
      pointer.preferenceId,
      zone.dataset.homeLevel
    );
    return;
  }

  if(!pointer.moved){
    dnaHomeSelected=
      dnaHomeSelected===
        pointer.preferenceId
        ? null
        : pointer.preferenceId;

    renderHomePreferences();
    return;
  }

  renderHomePreferences();
}

document.addEventListener(
  'pointermove',
  moveHomePreferencePointer
);

document.addEventListener(
  'pointerup',
  finishHomePreferencePointer
);

document.addEventListener(
  'pointercancel',
  event=>{
    if(
      !dnaHomePointer ||
      dnaHomePointer.id!==
        event.pointerId
    )return;

    dnaHomePointer=null;

    document.body.classList.remove(
      'dna-home-is-dragging'
    );

    document
      .querySelectorAll(
        '.dna-home-zone'
      )
      .forEach(zone=>{
        zone.classList.remove(
          'is-drop-target'
        );
      });

    renderHomePreferences();
  }
);

function renderHomePreferences(){
  const host=
    document.querySelector(
      '#dnaHomePreferences'
    );

  const question=
    getRoomsDnaV2HomeQuestion();

  if(!host||!question)return;

  const answers=
    getRoomsDnaV2HomeAnswers();

  const preferences=
    question.items || [];

  const levels=
    question.levels || [];

  const unassigned=
    preferences.filter(
      preference=>
        !answers[
          preference.id
        ]
    );

  const placedCount=
    preferences.length-
    unassigned.length;

  host.innerHTML=`
    <div class="dna-home-experience">

      ${renderRoomsDnaGlobalProgress(
        8,
        'HOME'
      )}

      <div class="dna-home-status">
        <span>
          ${placedCount}
          / ${preferences.length}
          definidas
        </span>

        <div>
          <i style="width:${
            (
              placedCount/
              preferences.length
            )*100
          }%"></i>
        </div>
      </div>

      <div class="dna-home-shelf">
        <div class="dna-home-shelf-head">
          <div>
            <small>
              ${question.eyebrow}
            </small>

            <strong>
              ${
                unassigned.length
                  ? question.prompt
                  : 'Tu casa ideal está lista'
              }
            </strong>
          </div>

          ${
            dnaHomeSelected
              ? `
                <span class="dna-home-selected-note">
                  Ahora elige dónde va ↓
                </span>
              `
              : `
                <span class="dna-home-selected-note">
                  Construye tu casa
                </span>
              `
          }
        </div>

        <div class="dna-home-unassigned">
          ${
            unassigned.length
              ? unassigned
                  .map(
                    homePreferenceCard
                  )
                  .join('')
              : `
                <div class="dna-home-empty">
                  ✦ HOME COMPLETADO
                </div>
              `
          }
        </div>
      </div>

      <div class="dna-home-board">

        ${levels
          .map((level,index)=>{

            const items=
              preferences.filter(
                preference=>
                  answers[
                    preference.id
                  ]===level.id
              );

            return `
              <section
                class="
                  dna-home-zone
                  dna-home-zone-${level.id}
                "
                data-home-level="${level.id}"
                role="button"
                tabindex="0"
                aria-label="Asignar a ${level.label}">

                <header>
                  <span>
                    0${index+1}
                  </span>

                  <div>
                    <small>
                      ${
                        level.id==='neutral'
                          ? 'FLEXIBLE'
                          : level.id==='like'
                            ? 'SUMA'
                            : 'PRIORIDAD'
                      }
                    </small>

                    <strong>
                      ${level.label}
                    </strong>
                  </div>

                  <b>
                    ${items.length}
                  </b>
                </header>

                <div class="dna-home-zone-items">
                  ${
                    items.length
                      ? items
                          .map(
                            homePreferenceCard
                          )
                          .join('')
                      : `
                        <span class="dna-home-drop-hint">
                          Coloca aquí
                        </span>
                      `
                  }
                </div>

              </section>
            `;
          })
          .join('')}

      </div>

      <p class="dna-home-board-tip">
        Arrastra para construir.
        También puedes tocar una ficha
        y después elegir dónde va.
      </p>

    </div>
  `;

  bindHomePreferenceBoard();
}

let dnaTraitPointer=null;

const dnaInterestSymbols={
  sport:'●',
  music:'♫',
  food:'✦',
  travel:'↗',
  nightlife:'✺',
  cinema:'▶',
  gaming:'◫',
  art:'◇',
  reading:'Aa',
  nature:'△',
  fashion:'◐',
  pets:'♡'
};

const dnaTraitSymbols={
  social:'✦',
  calm:'○',
  independent:'↗',
  organised:'⌁',
  spontaneous:'~',
  communicative:'◇',
  homebody:'⌂',
  easygoing:'☼'
};

function getRoomsDnaV2WorldQuestion(
  interactionId
){
  return (
    window.ROOMS_DNA_V2
      ?.interactions || []
  ).find(
    interaction=>
      interaction.id===interactionId &&
      interaction.act==='world'
  ) || null;
}

function getRoomsDnaV2Selection(
  interactionId
){
  const value=
    roomsDnaV2Answers[
      interactionId
    ];

  return Array.isArray(value)
    ? value
    : [];
}

function setRoomsDnaV2Selection(
  interactionId,
  values
){
  setRoomsDnaV2Answer(
    interactionId,
    [...values]
  );
}

function worldComplete(){
  return (
    getRoomsDnaV2Selection(
      'world_interests'
    ).length>0 &&
    getRoomsDnaV2Selection(
      'self_description'
    ).length>0
  );
}

function toggleRoomsDnaV2Selection(
  interactionId,
  optionId
){
  const question=
    getRoomsDnaV2WorldQuestion(
      interactionId
    );

  if(!question)return false;

  const valid=
    question.options.some(
      option=>
        option.id===optionId
    );

  if(!valid)return false;

  const current=
    new Set(
      getRoomsDnaV2Selection(
        interactionId
      )
    );

  if(current.has(optionId)){
    current.delete(optionId);
  }else{
    const maxSelections=
      question.maxSelections ??
      Infinity;

    if(
      current.size>=
      maxSelections
    ){
      return false;
    }

    current.add(optionId);
  }

  setRoomsDnaV2Selection(
    interactionId,
    current
  );

  return true;
}

function renderInterestMosaic(){
  const host=
    document.querySelector(
      '#dnaInterests'
    );

  const question=
    getRoomsDnaV2WorldQuestion(
      'world_interests'
    );

  if(!host||!question)return;

  const selected=
    new Set(
      getRoomsDnaV2Selection(
        'world_interests'
      )
    );

  host.innerHTML=`
    <section class="dna-identity-block dna-interests-block">

      ${renderRoomsDnaGlobalProgress(
        9,
        'WORLD'
      )}

      <header class="dna-identity-section-head">
        <div>
          <small>
            ${question.eyebrow}
          </small>

          <h2>
            ${question.prompt}
          </h2>
        </div>

        <span>
          ${selected.size}
          / ${question.maxSelections}
        </span>
      </header>

      <div class="dna-interest-mosaic">
        ${question.options.map(
          (item,index)=>`
            <button
              type="button"
              class="
                dna-interest-tile
                dna-interest-size-${
                  (index%4)+1
                }
                ${
                  selected.has(
                    item.id
                  )
                    ? 'is-selected'
                    : ''
                }
              "
              data-dna-interest="${item.id}"
              aria-pressed="${
                selected.has(
                  item.id
                )
              }">

              <span aria-hidden="true">
                ${
                  dnaInterestSymbols[
                    item.id
                  ] || '✦'
                }
              </span>

              <strong>
                ${item.label}
              </strong>

              <i aria-hidden="true">
                ${
                  selected.has(
                    item.id
                  )
                    ? '✓'
                    : '+'
                }
              </i>

            </button>
          `
        ).join('')}
      </div>

      <p class="dna-identity-note">
        Elige hasta
        ${question.maxSelections}
        opciones.
      </p>

    </section>
  `;
}

function traitCard(item){
  const selected=
    new Set(
      getRoomsDnaV2Selection(
        'self_description'
      )
    );

  const isSelected=
    selected.has(
      item.id
    );

  return `
    <button
      type="button"
      class="dna-trait-card${
        isSelected
          ? ' is-in-identity'
          : ''
      }"
      data-dna-trait="${item.id}"
      aria-pressed="${isSelected}">

      <span aria-hidden="true">
        ${
          dnaTraitSymbols[
            item.id
          ] || '✦'
        }
      </span>

      <strong>
        ${item.label}
      </strong>

      <small>
        ${
          isSelected
            ? 'Quitar'
            : 'Soy yo'
        }
      </small>
    </button>
  `;
}

function setTraitIdentity(
  traitId,
  selected
){
  const question=
    getRoomsDnaV2WorldQuestion(
      'self_description'
    );

  if(!question)return;

  const valid=
    question.options.some(
      item=>
        item.id===traitId
    );

  if(!valid)return;

  const current=
    new Set(
      getRoomsDnaV2Selection(
        'self_description'
      )
    );

  if(selected){
    if(
      !current.has(traitId) &&
      current.size>=
        question.maxSelections
    ){
      return;
    }

    current.add(
      traitId
    );
  }else{
    current.delete(
      traitId
    );
  }

  setRoomsDnaV2Selection(
    'self_description',
    current
  );

  renderTraitIdentity();
  updateOnboardingContinue();
}

function bindTraitIdentity(){
  const host=
    document.querySelector(
      '#dnaTraits'
    );

  if(!host)return;

  const identityZone=
    host.querySelector(
      '.dna-trait-identity-zone'
    );

  host
    .querySelectorAll(
      '.dna-trait-card'
    )
    .forEach(card=>{

      card.addEventListener(
        'pointerdown',
        event=>{
          if(
            event.button!==undefined &&
            event.button!==0
          )return;

          dnaTraitPointer={
            id:event.pointerId,
            traitId:
              card.dataset.dnaTrait,
            startX:event.clientX,
            startY:event.clientY,
            moved:false
          };

          card.setPointerCapture(
            event.pointerId
          );

          card.classList.add(
            'is-dragging'
          );
        }
      );

      card.addEventListener(
        'pointermove',
        event=>{
          if(
            !dnaTraitPointer ||
            dnaTraitPointer.id!==
              event.pointerId
          )return;

          const dx=
            event.clientX-
            dnaTraitPointer.startX;

          const dy=
            event.clientY-
            dnaTraitPointer.startY;

          if(
            Math.hypot(dx,dy)>6
          ){
            dnaTraitPointer.moved=true;
          }

          if(
            dnaTraitPointer.moved
          ){
            card.style.transform=
              `translate(${dx}px, ${dy}px) rotate(${dx/35}deg)`;
          }

          const rect=
            identityZone
              ?.getBoundingClientRect();

          if(rect){
            const inside=
              event.clientX>=rect.left &&
              event.clientX<=rect.right &&
              event.clientY>=rect.top &&
              event.clientY<=rect.bottom;

            identityZone.classList.toggle(
              'is-hovered',
              inside
            );
          }
        }
      );

      const finishTrait=event=>{
        if(
          !dnaTraitPointer ||
          dnaTraitPointer.id!==
            event.pointerId
        )return;

        const pointer=
          dnaTraitPointer;

        dnaTraitPointer=null;

        card.classList.remove(
          'is-dragging'
        );

        card.style.transform='';

        identityZone?.classList.remove(
          'is-hovered'
        );

        const selected=
          new Set(
            getRoomsDnaV2Selection(
              'self_description'
            )
          );

        if(!pointer.moved){
          setTraitIdentity(
            pointer.traitId,
            !selected.has(
              pointer.traitId
            )
          );
          return;
        }

        const rect=
          identityZone
            ?.getBoundingClientRect();

        const droppedInside=
          rect &&
          event.clientX>=rect.left &&
          event.clientX<=rect.right &&
          event.clientY>=rect.top &&
          event.clientY<=rect.bottom;

        if(droppedInside){
          setTraitIdentity(
            pointer.traitId,
            true
          );
        }
      };

      card.addEventListener(
        'pointerup',
        finishTrait
      );

      card.addEventListener(
        'pointercancel',
        ()=>{
          dnaTraitPointer=null;

          card.classList.remove(
            'is-dragging'
          );

          card.style.transform='';

          identityZone?.classList.remove(
            'is-hovered'
          );
        }
      );
    });
}

function renderTraitIdentity(){
  const host=
    document.querySelector(
      '#dnaTraits'
    );

  const question=
    getRoomsDnaV2WorldQuestion(
      'self_description'
    );

  if(!host||!question)return;

  const selected=
    new Set(
      getRoomsDnaV2Selection(
        'self_description'
      )
    );

  const outside=
    question.options.filter(
      item=>
        !selected.has(
          item.id
        )
    );

  const inside=
    question.options.filter(
      item=>
        selected.has(
          item.id
        )
    );

  host.innerHTML=`
    <section class="dna-identity-block dna-traits-block">

      ${renderRoomsDnaGlobalProgress(
        10,
        'WORLD'
      )}

      <header class="dna-identity-section-head">
        <div>
          <small>
            ${question.eyebrow}
          </small>

          <h2>
            ${question.prompt}
          </h2>
        </div>

        <span>
          ${inside.length}
          / ${question.maxSelections}
        </span>
      </header>

      <div class="dna-trait-workspace">

        <div class="dna-trait-pool">
          <small>
            ELIGE LO QUE MÁS TE DEFINE
          </small>

          <div>
            ${
              outside.length
                ? outside
                    .map(traitCard)
                    .join('')
                : `
                  <span class="dna-trait-pool-empty">
                    Ya los has colocado todos.
                  </span>
                `
            }
          </div>
        </div>

        <div
          class="dna-trait-identity-zone"
          tabindex="0"
          aria-label="Esto soy yo">

          <div class="dna-trait-zone-title">
            <span aria-hidden="true">
              ✦
            </span>

            <div>
              <small>
                ESTO
              </small>

              <strong>
                SOY YO
              </strong>
            </div>
          </div>

          <div class="dna-trait-zone-items">
            ${
              inside.length
                ? inside
                    .map(traitCard)
                    .join('')
                : `
                  <span class="dna-trait-empty">
                    Arrastra aquí los rasgos
                    que más te representan.
                  </span>
                `
            }
          </div>

        </div>

      </div>

      <p class="dna-identity-note">
        Elige hasta
        ${question.maxSelections}
        rasgos.
      </p>

    </section>
  `;

  bindTraitIdentity();
}

function renderIdentityChips(){
  renderInterestMosaic();
  renderTraitIdentity();
}


function getRoomsDnaV2LivingQuestions(){
  return (
    window.ROOMS_DNA_V2
      ?.interactions || []
  ).filter(
    interaction=>
      interaction.act==='living' &&
      interaction.type==='scenario'
  );
}

function livingComplete(){
  const questions=
    getRoomsDnaV2LivingQuestions();

  return (
    questions.length>0 &&
    questions.every(
      question=>
        Boolean(
          roomsDnaV2Answers[
            question.id
          ]
        )
    )
  );
}


let dnaScenarioIndex=0;
let dnaScenarioLocked=false;

function commitScenarioReaction(index){
  if(dnaScenarioLocked)return;

  const questions=
    getRoomsDnaV2LivingQuestions();

  const question=
    questions[dnaScenarioIndex];

  const option=
    question?.options?.[index];

  if(!question||!option)return;

  dnaScenarioLocked=true;

  setRoomsDnaV2Answer(
    question.id,
    option.id
  );

  const stage=
    document.querySelector(
      '[data-dna-living-stage]'
    );

  const choice=
    document.querySelector(
      `[data-dna-living-choice="${index}"]`
    );

  if(stage){
    stage.classList.add(
      'is-committed'
    );
  }

  if(choice){
    choice.classList.add(
      'is-selected'
    );
  }

  updateOnboardingContinue();

  window.setTimeout(
    ()=>{
      dnaScenarioIndex+=1;
      dnaScenarioLocked=false;
      renderScenarios();
    },
    260
  );
}

function bindLivingGame(){
  const stage=
    document.querySelector(
      '[data-dna-living-stage]'
    );

  if(!stage)return;

  stage
    .querySelectorAll(
      '[data-dna-living-choice]'
    )
    .forEach(
      button=>{
        button.addEventListener(
          'click',
          ()=>{
            commitScenarioReaction(
              Number(
                button.dataset
                  .dnaLivingChoice
              )
            );
          }
        );
      }
    );

  stage.addEventListener(
    'keydown',
    event=>{
      if(dnaScenarioLocked)return;

      const numeric=
        Number(event.key);

      if(
        Number.isInteger(numeric) &&
        numeric>=1 &&
        numeric<=3
      ){
        event.preventDefault();

        commitScenarioReaction(
          numeric-1
        );
      }
    }
  );
}

function renderScenarios(){
  const host=
    document.querySelector(
      '#dnaScenarios'
    );

  const questions=
    getRoomsDnaV2LivingQuestions();

  if(
    !host ||
    !questions.length
  )return;

  if(
    dnaScenarioIndex>=
    questions.length
  ){
    host.innerHTML=`
      <div class="dna-living-complete">
        <div class="dna-living-complete-mark">
          ✦
        </div>

        <small>
          LIVING COMPLETADO
        </small>

        <strong>
          Ya sabemos cómo convives.
        </strong>

        <button
          type="button"
          class="dna-reaction-review">
          Revisar LIVING
        </button>
      </div>
    `;

    updateOnboardingContinue();
    return;
  }

  const question=
    questions[
      dnaScenarioIndex
    ];

  const options=
    question.options || [];

  if(options.length<2)return;

  host.innerHTML=`
    <div
      class="dna-living-stage"
      data-dna-living-stage
      tabindex="0"
      aria-label="${question.prompt}">

      ${renderRoomsDnaGlobalProgress(
        dnaScenarioIndex+4,
        'LIVING'
      )}

      <div class="dna-living-scene">
        <small>
          ${question.eyebrow}
        </small>

        <h2>
          ${question.prompt}
        </h2>

        <p>
          ¿Cuál es tu reacción?
        </p>
      </div>

      <div
        class="dna-living-choices"
        role="group"
        aria-label="${question.prompt}">

        ${options.map(
          (option,index)=>`
            <button
              type="button"
              class="dna-living-choice"
              data-dna-living-choice="${index}"
              aria-label="${option.label}">

              <span class="dna-living-choice-number">
                ${String(index+1).padStart(2,'0')}
              </span>

              <strong>
                ${option.label}
              </strong>

              <span
                class="dna-living-choice-mark"
                aria-hidden="true">
                ↗
              </span>
            </button>
          `
        ).join('')}
      </div>

      <footer class="dna-living-footer">
        <span>
          1 — ${options[0]?.label || ''}
        </span>

        <b>
          ELIGE POR INSTINTO
        </b>

        <span>
          ${options.length} — ${
            options[
              options.length-1
            ]?.label || ''
          }
        </span>
      </footer>

    </div>
  `;

  bindLivingGame();
}


function renderDna(){
  renderThisOrThat();

  renderScenarios();

  renderHomePreferences();

  renderIdentityChips();
}

function completeness(object,expected){
  return Object.keys(object).length===expected;
}

function updateOnboardingContinue(){
  let ready=true;

  if(onboardingStep===2){
    ready=
      thisOrThatComplete();
  }

  if(onboardingStep===3){
    ready=
      livingComplete();
  }

  if(onboardingStep===4){
    ready=
      homePrioritiesComplete();
  }

  if(onboardingStep===5){
    ready=
      worldComplete();
  }

  if(onboardingStep===6){
    ready=Boolean(
      document.querySelector('#profileName')?.value.trim()
    );
  }

  if(onboardingStep===8){
    ready=dnaState.intents.size>0;
  }

  onboardingContinue.disabled=!ready;
}

function calculateRoomsDnaV2Reveal(){
  const engine=
    window.ROOMS_DNA_ENGINE;

  const archetypes=
    window.ROOMS_DNA_ARCHETYPES;

  const config=
    window.ROOMS_DNA_V2;

  if(
    !engine ||
    !archetypes ||
    !config
  ){
    return null;
  }

  try{
    /*
      ROOMS DNA V2 nativo.
      El motor consume únicamente
      las respuestas canónicas V2.
    */
    const answers=
      getRoomsDnaV2Answers();

    const dna=
      engine.calculate(
        answers,
        config
      );

    const classification=
      archetypes.classify(
        dna
      );

    if(
      !classification?.primary
    ){
      return null;
    }

    const result={
      answers,
      dna,
      classification
    };

    /*
      Temporalmente lo exponemos para poder
      inspeccionarlo desde DevTools.
    */
    window.__roomsDnaReveal=
      result;

    return result;
  }catch(error){
    console.warn(
      'Rooms DNA v2 reveal fallback',
      error
    );

    return null;
  }
}


function getRoomsDnaTopDimensions(
  dna,
  limit=3
){
  const config=
    window.ROOMS_DNA_V2;

  return Object.entries(
    dna?.dimensions || {}
  )
    .map(
      ([id,value])=>{
        const self=value?.self;

        const score=
          self?.score ?? 0;

        const confidence=
          self?.confidence ?? 0;

        const definition=
          config?.dimensions?.[id];

        const directionalLabel=
          score>=0
            ? definition?.high
            : definition?.low;

        return {
          id,
          score,
          confidence,
          salience:
            Math.abs(score) *
            confidence,

          label:
            directionalLabel ||
            definition?.label ||
            id,

          index:
            Math.round(
              (
                (
                  score + 1
                ) / 2
              ) * 100
            )
        };
      }
    )
    .filter(
      item=>
        item.confidence>0
    )
    .sort(
      (a,b)=>
        b.salience-
        a.salience
    )
    .slice(
      0,
      limit
    );
}


function buildDnaDescriptor(){
  const parts=[];

  if(dnaState.thisOrThat.sunday_home==='social'){
    parts.push('Social');
  }else if(dnaState.thisOrThat.sunday_home==='quiet'){
    parts.push('Plan tranquilo');
  }

  if(dnaState.thisOrThat.tuesday_2330==='late'){
    parts.push('Nocturno');
  }else if(dnaState.thisOrThat.tuesday_2330==='early'){
    parts.push('Madrugador');
  }

  if(dnaState.thisOrThat.perfect_neighborhood==='lively'){
    parts.push('Con vida alrededor');
  }else if(dnaState.thisOrThat.perfect_neighborhood==='residential'){
    parts.push('Entorno tranquilo');
  }

  return parts.slice(0,3).join(' · ') || 'Tu forma de vivir';
}


function fitRoomsDnaRevealTitle(){
  const title=
    document.querySelector(
      '#dnaRevealTitle'
    );

  if(!title)return;

  /*
    El tamaño máximo depende del viewport.
    A partir de ahí reducimos únicamente
    si el contenido real lo necesita.
  */
  const maxSize=
    window.innerWidth<=767
      ? 58
      : window.innerWidth<=1200
        ? 64
        : 76;

  const minSize=
    window.innerWidth<=767
      ? 34
      : 38;

  title.style.fontSize=
    `${maxSize}px`;

  /*
    Dejamos que el navegador haga los saltos
    naturales entre palabras. Si alguna línea
    desborda, reducimos progresivamente.
  */
  let size=maxSize;

  while(
    size>minSize &&
    title.scrollWidth>
      title.clientWidth+1
  ){
    size-=1;
    title.style.fontSize=
      `${size}px`;
  }

  /*
    Segunda comprobación:
    cada palabra debe caber completa.
  */
  const words=
    title.textContent
      .trim()
      .split(/\s+/);

  if(!words.length)return;

  const probe=
    document.createElement('span');

  probe.style.position='fixed';
  probe.style.visibility='hidden';
  probe.style.pointerEvents='none';
  probe.style.whiteSpace='nowrap';
  probe.style.fontFamily=
    getComputedStyle(title)
      .fontFamily;
  probe.style.fontWeight=
    getComputedStyle(title)
      .fontWeight;
  probe.style.letterSpacing=
    getComputedStyle(title)
      .letterSpacing;

  document.body.appendChild(probe);

  while(size>minSize){
    probe.style.fontSize=
      `${size}px`;

    const widest=
      Math.max(
        ...words.map(word=>{
          probe.textContent=word;
          return probe
            .getBoundingClientRect()
            .width;
        })
      );

    if(
      widest<=
      title.clientWidth
    ){
      break;
    }

    size-=1;

    title.style.fontSize=
      `${size}px`;
  }

  probe.remove();
}


function renderReveal(){
  const title=
    document.querySelector(
      '#dnaRevealTitle'
    );

  const descriptor=
    document.querySelector(
      '#dnaRevealDescriptor'
    );

  const summary=
    document.querySelector(
      '#dnaRevealSummary'
    );

  const reveal=
    calculateRoomsDnaV2Reveal();

  /*
    Fallback v1:
    si por cualquier motivo el nuevo motor
    no está disponible, el onboarding sigue
    funcionando como antes.
  */
  if(!reveal){
    if(title){
      title.textContent=
        'Tu DNA está listo';
    }

    if(descriptor){
      descriptor.textContent=
        buildDnaDescriptor();
    }

    if(summary){
      const dealbreakers=
        Object.values(
          dnaState.dealbreakers
        )
          .filter(
            value=>
              value==='dealbreaker'
          )
          .length;

      const needs=
        Object.values(
          dnaState.homePreferences
        )
          .filter(
            value=>
              value==='need'
          )
          .length;

      summary.innerHTML=`
        <span>
          <b>
            ${roomsDna.scenarios.length}
          </b>
          <small>
            señales de convivencia
          </small>
        </span>

        <span>
          <b>
            ${dealbreakers}
          </b>
          <small>
            dealbreakers
          </small>
        </span>

        <span>
          <b>
            ${needs}
          </b>
          <small>
            prioridades de hogar
          </small>
        </span>
      `;
    }

    return;
  }

  const {
    dna,
    classification
  }=reveal;

  const primary=
    classification.primary;

  const secondary=
    classification.secondary;

  const topDimensions=
    getRoomsDnaTopDimensions(
      dna,
      3
    );

  if(title){
    title.textContent=
      primary.name;

    requestAnimationFrame(
      fitRoomsDnaRevealTitle
    );
  }

  const revealArt=
    document.querySelector(
      '#dnaRevealArt'
    );

  const revealVisual=
    document.querySelector(
      '.dna-reveal-visual'
    );

  if(revealArt&&revealVisual){
    const archetypeIndex={
      selective_social:'01',
      open_house:'02',
      peace_keeper:'03',
      house_ceo:'04',
      free_spirit:'05',
      private_club:'06'
    };

    const archetypeSymbol={
      selective_social:'✦',
      open_house:'+',
      peace_keeper:'○',
      house_ceo:'⌁',
      free_spirit:'↗',
      private_club:'◇'
    };

    revealVisual.dataset.archetype=
      primary.id;

    revealArt.innerHTML=`
      <span>
        ${
          archetypeSymbol[
            primary.id
          ] || '✦'
        }
      </span>
    `;

    const number=
      revealVisual.querySelector(
        '.dna-reveal-visual-meta span:last-child'
      );

    if(number){
      number.textContent=
        archetypeIndex[
          primary.id
        ] || '01';
    }
  }

  if(descriptor){
    descriptor.textContent=
      primary.tagline;
  }

  if(summary){
    const dimensionsHtml=
      topDimensions
        .map(
          dimension=>`
            <span
              class="dna-reveal-stat">
              <b>
                ${dimension.index}
              </b>
              <small>
                ${dimension.label}
              </small>
            </span>
          `
        )
        .join('');

    const secondaryHtml=
      secondary &&
      secondary.fit>0
        ? `
          <span
            class="
              dna-reveal-stat
              dna-reveal-secondary
            ">
            <b>
              ${
                Math.round(
                  secondary.fit*100
                )
              }%
            </b>
            <small>
              Secondary ·
              ${secondary.name}
            </small>
          </span>
        `
        : '';

    summary.innerHTML=
      dimensionsHtml +
      secondaryHtml;
  }
}

function playRoomsDnaTransition({
  eyebrow='ROOMS DNA',
  title,
  detail=''
}){
  return new Promise(resolve=>{
    const host=
      document.querySelector(
        '#onboarding'
      );

    if(!host){
      resolve();
      return;
    }

    let overlay=
      host.querySelector(
        '.dna-game-transition'
      );

    if(!overlay){
      overlay=
        document.createElement(
          'div'
        );

      overlay.className=
        'dna-game-transition';

      overlay.setAttribute(
        'aria-live',
        'polite'
      );

      host.appendChild(
        overlay
      );
    }

    overlay.innerHTML=`
      <div class="dna-game-transition-inner">

        <div
          class="dna-game-transition-strip"
          aria-hidden="true">

          ${Array.from(
            {length:10},
            (_,index)=>`
              <i style="
                --dna-delay:${
                  index*28
                }ms
              "></i>
            `
          ).join('')}

        </div>

        <small>
          ${eyebrow}
        </small>

        <strong>
          ${title}
        </strong>

        ${
          detail
            ? `
              <span>
                ${detail}
              </span>
            `
            : ''
        }

        <div
          class="dna-game-transition-mark"
          aria-hidden="true">
          ✦
        </div>

      </div>
    `;

    overlay.hidden=false;

    requestAnimationFrame(
      ()=>{
        overlay.classList.add(
          'is-visible'
        );
      }
    );

    window.setTimeout(
      ()=>{
        overlay.classList.add(
          'is-resolving'
        );
      },
      620
    );

    window.setTimeout(
      ()=>{
        overlay.classList.remove(
          'is-visible',
          'is-resolving'
        );

        overlay.hidden=true;

        resolve();
      },
      900
    );
  });
}


function showOnboardingStep(step){
  onboardingStep=step;

  document.querySelectorAll('.onboarding-step').forEach(
    (panel,index)=>{
      panel.hidden=index!==step-1;
      panel.classList.toggle('active',index===step-1);
    }
  );

  document.querySelector('.onboarding-progress')
    ?.setAttribute('aria-label',`Paso ${step} de 8`);

  const copy=document.querySelector('.progress-copy');
  if(copy)copy.innerHTML=`${step} <i>/ 8</i>`;

  const progress=document.querySelector('.progress-track span');
  if(progress)progress.style.width=`${(step/8)*100}%`;

  onboardingBack.hidden=step===1;

  const tagline=document.querySelector('#onboardingTagline');
  if(tagline)tagline.hidden=step>1;

  if(step===1){
    onboardingContinue.innerHTML=
      'Empezar <span aria-hidden="true">→</span>';
  }else if(step===7){
    renderReveal();
    onboardingContinue.innerHTML=
      'Continuar <span aria-hidden="true">→</span>';
  }else if(step===8){
    onboardingContinue.innerHTML=
      'Entrar en Rooms <span aria-hidden="true">→</span>';
  }else{
    onboardingContinue.innerHTML=
      'Continuar <span aria-hidden="true">→</span>';
  }

  updateOnboardingContinue();
}

document.addEventListener('click',event=>{
  const thisButton=
    event.target.closest(
      '[data-dna-swipe-choice]'
    );

  if(thisButton){
    commitThisOrThat(
      thisButton.dataset
        .dnaSwipeChoice
    );
    return;
  }

  const reviewThis=
    event.target.closest(
      '[data-dna-review-this]'
    );

  if(reviewThis){
    dnaThisIndex=0;
    renderThisOrThat();
    return;
  }

  const reviewScenarios=
    event.target.closest(
      '.dna-reaction-review'
    );

  if(reviewScenarios){
    dnaScenarioIndex=0;
    renderScenarios();
    return;
  }

  const interest=
    event.target.closest(
      '[data-dna-interest]'
    );

  if(interest){
    const id=
      interest.dataset.dnaInterest;

    toggleRoomsDnaV2Selection(
      'world_interests',
      id
    );

    renderInterestMosaic();
    updateOnboardingContinue();
    return;
  }

  const intent=event.target.closest('[data-onboarding-intent]');
  if(intent){
    toggleSetButton(
      intent,
      dnaState.intents,
      intent.dataset.onboardingIntent
    );
  }
});

document.querySelector('#profileName')
  ?.addEventListener('input',updateOnboardingContinue);

document.querySelector('#profilePhotoInput')
  ?.addEventListener('change',event=>{
    const file=event.target.files?.[0];
    if(!file)return;

    const reader=new FileReader();

    reader.addEventListener('load',()=>{
      const image=document.querySelector('#profilePhotoImage');
      if(!image)return;

      image.src=reader.result;
      image.hidden=false;

      const plus=document.querySelector('#profilePhotoPlus');
      if(plus)plus.hidden=true;

      const text=document.querySelector('#profilePhotoText');
      if(text)text.textContent='Cambiar foto';
    });

    reader.readAsDataURL(file);
  });

onboardingBack.addEventListener('click',()=>{
  if(onboardingStep>1){
    showOnboardingStep(onboardingStep-1);
  }
});

function getRoomsDnaPersistenceSnapshot(){
  const reveal=
    calculateRoomsDnaV2Reveal();

  if(!reveal){
    return null;
  }

  const {
    answers,
    dna,
    classification
  }=reveal;

  const evidence=[];

  for(
    const [
      dimension,
      layers
    ] of Object.entries(
      dna.dimensions || {}
    )
  ){
    for(
      const layer of [
        'self',
        'preferred',
        'importance'
      ]
    ){
      for(
        const item of
        layers?.[layer]?.evidence || []
      ){
        evidence.push({
          dimension,
          layer,
          ...item
        });
      }
    }
  }

  const compactArchetype=
    archetype=>{
      if(!archetype)return null;

      return {
        id:archetype.id,
        name:archetype.name,
        tagline:archetype.tagline,
        fit:archetype.fit
      };
    };

  return {
    modelVersion:
      dna.version,

    answers,

    dimensions:
      dna.dimensions || {},

    categories:
      dna.categorical || {},

    classification:{
      primary:
        compactArchetype(
          classification.primary
        ),

      secondary:
        compactArchetype(
          classification.secondary
        ),

      ranked:
        (
          classification.ranked || []
        ).map(
          compactArchetype
        )
    },

    evidence,

    calculatedAt:
      new Date().toISOString()
  };
}

window.getRoomsDnaPersistenceSnapshot=
  getRoomsDnaPersistenceSnapshot;


function buildLegacyMatchPreferencesFromV2(){
  const answers=
    getRoomsDnaV2Answers();

  const homePreferences={
    ...(
      answers.home_priorities ||
      {}
    )
  };

  /*
    Compatibilidad temporal con profile.interests.

    Solo traducimos conceptos que tienen
    un equivalente razonable en V1.
  */
  const interestMap={
    sport:'sport',
    music:'music',
    food:'cooking',
    travel:'travel',
    gaming:'gaming',
    reading:'reading',
    nightlife:'going-out',
    pets:'pets'
  };

  const interests=[
    ...new Set(
      (
        answers.world_interests ||
        []
      )
        .map(
          value=>
            interestMap[value]
        )
        .filter(Boolean)
    )
  ];

  /*
    Igual para traits:
    no inferimos rasgos que V1 no conocía.
  */
  const traitMap={
    social:'social',
    calm:'calm',
    independent:'independent',
    organised:'tidy'
  };

  const traits=[
    ...new Set(
      (
        answers.self_description ||
        []
      )
        .map(
          value=>
            traitMap[value]
        )
        .filter(Boolean)
    )
  ];

  const livingSelf={
    this_or_that:{},
    scenarios:{}
  };

  /*
    Friday night es el único forced-choice
    con una equivalencia suficientemente clara
    respecto al antiguo sunday_home.
  */
  if(
    answers.friday_night===
      'reset'
  ){
    livingSelf.this_or_that
      .sunday_home='quiet';
  }

  if(
    answers.friday_night===
      'alive'
  ){
    livingSelf.this_or_that
      .sunday_home='social';
  }

  /*
    Escenarios con equivalencia directa
    o suficientemente próxima.

    No rellenamos music_while_working
    ni working_from_home porque V2
    no pregunta esas situaciones.
  */
  const dishesMap={
    whatever:'fine',
    tomorrow_ok:'depends',
    needs_cleaning:'strong'
  };

  const friendsMap={
    love_it:'fine',
    tell_me:'depends',
    not_weekdays:'strong'
  };

  const plansMap={
    improvise:'fine',
    tell_me_before:'depends'
  };

  if(
    dishesMap[
      answers.dishes_overnight
    ]
  ){
    livingSelf.scenarios
      .dishes_two_days=
        dishesMap[
          answers.dishes_overnight
        ];
  }

  if(
    friendsMap[
      answers.friends_tuesday
    ]
  ){
    livingSelf.scenarios
      .six_friends_tonight=
        friendsMap[
          answers.friends_tuesday
        ];
  }

  if(
    plansMap[
      answers.plans_change
    ]
  ){
    livingSelf.scenarios
      .improvised_dinner=
        plansMap[
          answers.plans_change
        ];
  }

  return {
    living_self:
      livingSelf,

    /*
      V2 ya no pregunta estas dos capas
      mediante las pantallas antiguas.
      No inventamos valores.
    */
    living_importance:{},
    dealbreakers:{},

    home_preferences:
      homePreferences,

    /*
      El onboarding V2 actual no pregunta
      preferencias de barrio.
    */
    neighborhood_preferences:{},

    interests,
    traits
  };
}


function getRoomsDnaOnboardingSnapshot(){
  const roomsDna=
    getRoomsDnaPersistenceSnapshot();

  if(!roomsDna){
    return null;
  }

  return {
    version:
      roomsDna.modelVersion,

    roomsDna,

    matchPreferences:
      buildLegacyMatchPreferencesFromV2(),

    intents:[
      ...dnaState.intents
    ],

    profile:{
      name:
        document.querySelector(
          '#profileName'
        )
          ?.value.trim()||'',

      bio:
        document.querySelector(
          '#profileBio'
        )
          ?.value.trim()||'',

      photo:
        document.querySelector(
          '#profilePhotoInput'
        )
          ?.files?.[0]||null
    }
  };
}

window.getRoomsDnaOnboardingSnapshot=
  getRoomsDnaOnboardingSnapshot;

function openPersonalizedFeed(
  view='home',
  {animate=true}={}
){
  const revealApp=()=>{
    onboarding.hidden=true;
    onboarding.classList.remove('leaving');

    document
      .querySelectorAll('.app-shell')
      .forEach(el=>{
        el.hidden=false;
      });

    document.body.classList.add('app-visible');
    showMainView(view);
  };

  if(animate){
    onboarding.classList.add('leaving');
    setTimeout(revealApp,260);
    return;
  }

  revealApp();
}

window.openPersonalizedFeed=openPersonalizedFeed;

onboardingContinue.addEventListener('click',async()=>{
  if(onboardingStep===5){
    onboardingContinue.disabled=true;

    await playRoomsDnaTransition({
      eyebrow:'10 / 10 · ROOMS DNA',
      title:'DNA COMPLETO',
      detail:'Solo falta ponerte cara.'
    });

    showOnboardingStep(6);
    return;
  }

  if(onboardingStep===6){
    onboardingContinue.disabled=true;

    await playRoomsDnaTransition({
      eyebrow:'ROOMS DNA',
      title:'LEYENDO TU DNA…',
      detail:'Buscando tu forma de vivir.'
    });

    showOnboardingStep(7);
    return;
  }

  if(onboardingStep<8){
    showOnboardingStep(onboardingStep+1);
    return;
  }

  if(
    typeof window.saveRoomsDnaOnboarding!=='function'
  ){
    ping('No se pudo conectar con tu sesión');
    return;
  }

  const previous=
    onboardingContinue.innerHTML;

  onboardingContinue.disabled=true;
  onboardingContinue.textContent='Guardando…';

  const saved=
    await window.saveRoomsDnaOnboarding();

  if(!saved){
    onboardingContinue.disabled=false;
    onboardingContinue.innerHTML=previous;
    return;
  }

  openPersonalizedFeed('home');
});

renderDna();
showOnboardingStep(1);

function open(el){el.classList.add('open');el.setAttribute('aria-hidden','false');document.body.style.overflow='hidden'}function closeAll(){document.querySelectorAll('.modal').forEach(m=>{m.classList.remove('open');m.setAttribute('aria-hidden','true')});document.body.style.overflow=''}function ping(text){toast.textContent=text;toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),2200)}
const feed=document.querySelector('#personalFeed'),feedMain=document.querySelector('.feed-main'),publishModal=document.querySelector('#publishModal'),publishFlowModal=document.querySelector('#publishFlowModal'),exploreView=document.querySelector('#exploreView'),communitiesView=document.querySelector('#communitiesView'),householdView=document.querySelector('#householdView'),communityView=document.querySelector('#communityView'),ownProfileView=document.querySelector('#ownProfileView'),savedView=document.querySelector('#savedView'),settingsView=document.querySelector('#settingsView'),trustView=document.querySelector('#trustView'),exploreFilterModal=document.querySelector('#exploreFilterModal'),chatInboxModal=document.querySelector('#chatInboxModal'),conversationModal=document.querySelector('#conversationModal'),notificationsModal=document.querySelector('#notificationsModal'),collectionModal=document.querySelector('#collectionModal');let publishType='',publishStep=0;
const publishFlows={
 room:{label:'OFRECER HABITACIÓN',steps:[
  ()=>`<p class="eyebrow">LO IMPRESCINDIBLE</p><h2>Empecemos por lo básico</h2><p class="flow-intro">Con estos datos ya podemos mostrar la información principal del anuncio.</p><div class="publish-form-grid"><label>Zona<input placeholder="Barrio o zona"></label><label>Precio mensual<div class="input-suffix"><input type="number" placeholder="Precio"><span>€</span></div></label><label>Disponible desde<input type="date" ></label><label>Duración<select><option>6–12 meses</option><option>3–6 meses</option><option>Más de 1 año</option><option>Flexible</option></select></label></div><button class="photo-drop" type="button"><span>＋</span><b>Añadir fotos</b><small>Hasta 10 imágenes · Puedes hacerlo después</small></button>`,
  ()=>`<p class="eyebrow">LA VIVIENDA</p><h2>¿Cómo es el piso?</h2><p class="flow-intro">Añade lo que sepas. Nada de esto bloquea la publicación.</p><div class="publish-form-grid thirds"><label>Habitaciones<input type="number" placeholder="Ej. 3"></label><label>Baños<input type="number" placeholder="Ej. 1"></label><label>Superficie<div class="input-suffix"><input type="number" placeholder="Ej. 90"><span>m²</span></div></label></div><div class="selectable-grid"><button type="button" data-selectable aria-pressed="false">Amueblado</button><button type="button" data-selectable aria-pressed="false">Exterior</button><button type="button" data-selectable aria-pressed="false">Ascensor</button><button type="button" data-selectable aria-pressed="false">Mascotas</button><button type="button" data-selectable aria-pressed="false">Gastos incluidos</button><button type="button" data-selectable aria-pressed="false">Baño privado</button></div>`,
  ()=>`<div class="completion-card"><strong>✓</strong><div><b>Revisa tu anuncio</b><span>La publicación se creará únicamente con los datos que hayas añadido.</span></div></div><p class="eyebrow">ÚLTIMO PASO</p><h2>Cuéntalo a tu manera</h2><label class="full-field">Descripción<textarea rows="5"></textarea></label><article class="publish-preview"><span>VISTA PREVIA</span><h3>Completa los datos para ver tu anuncio</h3><p>La vista previa se actualizará con tu información.</p></article>`
 ]},
 flat:{label:'PUBLICAR PISO',steps:[
  ()=>`<p class="eyebrow">LO IMPRESCINDIBLE</p><h2>Publica tu piso en minutos</h2><p class="flow-intro">Solo necesitamos estos datos para crear la primera versión.</p><div class="publish-form-grid"><label>Zona<input placeholder="Barrio o zona"></label><label>Precio mensual<div class="input-suffix"><input type="number" placeholder="Precio"><span>€</span></div></label><label>Disponible desde<input type="date" ></label><label>Duración<select><option>Más de 1 año</option><option>6–12 meses</option><option>Flexible</option></select></label></div><button class="photo-drop" type="button"><span>＋</span><b>Añadir fotos del piso</b><small>Puedes reordenarlas más adelante</small></button>`,
  ()=>`<p class="eyebrow">CARACTERÍSTICAS</p><h2>Completa lo que sepas</h2><div class="publish-form-grid thirds"><label>Habitaciones<input type="number" placeholder="Ej. 2"></label><label>Baños<input type="number" placeholder="Ej. 1"></label><label>Superficie<div class="input-suffix"><input type="number" placeholder="Ej. 80"><span>m²</span></div></label></div><div class="selectable-grid"><button type="button" data-selectable aria-pressed="false">Amueblado</button><button type="button" data-selectable aria-pressed="false">Exterior</button><button type="button" data-selectable aria-pressed="false">Ascensor</button><button type="button" data-selectable aria-pressed="false">Mascotas</button><button type="button" data-selectable aria-pressed="false">Gastos incluidos</button><button type="button" data-selectable aria-pressed="false">Aire acondicionado</button></div>`,
  ()=>`<div class="completion-card"><strong>✓</strong><div><b>Revisa tu anuncio</b><span>La publicación se creará únicamente con los datos que hayas añadido.</span></div></div><p class="eyebrow">VISTA PREVIA</p><h2>Así aparecerá en Rooms</h2><label class="full-field">Descripción<textarea rows="5"></textarea></label><article class="publish-preview"><span>VISTA PREVIA</span><h3>Completa los datos para ver tu anuncio</h3><p>La vista previa se actualizará con tu información.</p></article>`
 ]},
 mate:{label:'BUSCAR COMPAÑERO',steps:[
  ()=>`<p class="eyebrow">ROOMS YA TE CONOCE</p><h2>Confirma qué buscas ahora</h2><p class="flow-intro">Usamos tus preferencias actuales. Puedes cambiarlas antes de activar la búsqueda.</p><div class="publish-form-grid"><label>Zonas<input placeholder="Ej. Chamberí, Moncloa"></label><label>Presupuesto<div class="input-suffix"><input placeholder="Ej. 700–950"><span>€</span></div></label><label>Fecha<input type="date"></label><label>Duración<select><option>Más de 1 año</option><option>6–12 meses</option><option>Flexible</option></select></label></div>`,
  ()=>`<div class="completion-card"><strong>✓</strong><div><b>Revisa tu búsqueda</b><span>Se activará únicamente con la información de tu perfil y los datos que hayas confirmado.</span></div></div><p class="eyebrow">VISTA PREVIA</p><h2>Así aparecerá tu búsqueda</h2><article class="mate-preview"><span class="preview-avatar">R</span><div><h3>Tu búsqueda aparecerá aquí</h3><p>La vista previa se actualizará con tus datos reales.</p></div></article>`
 ]},
 external:{label:'COMPARTIR UN PISO',steps:[
  ()=>`<p class="eyebrow">FUENTE EXTERNA</p><h2>Función en preparación</h2><p class="flow-intro">Más adelante podrás compartir enlaces externos y revisar la información antes de publicarla en Rooms.</p><label class="external-url"><span>↗</span><input type="url" placeholder="https://…"></label><aside class="import-note">La importación de datos externos todavía no está disponible.</aside>`,
  ()=>`<div class="completion-card"><strong>…</strong><div><b>Importación pendiente</b><span>Cuando esta función esté disponible, aquí verás únicamente los datos que Rooms haya podido verificar.</span></div></div><p class="eyebrow">VISTA PREVIA</p><h2>Sin datos importados todavía</h2><article class="imported-listing"><div><span>FUENTE EXTERNA</span><h3>La información del anuncio aparecerá aquí.</h3><p>No se mostrarán datos inventados ni inferidos.</p></div></article>`,
  ()=>`<p class="eyebrow">TRAZABILIDAD</p><h2>Próximamente</h2><p class="flow-intro">Esta función se activará cuando podamos importar y verificar enlaces externos de forma fiable.</p>`
 ]},
 post:{label:'CREAR PUBLICACIÓN',steps:[
  ()=>`<p class="eyebrow">COMUNIDAD ROOMS</p><h2>¿Qué quieres compartir?</h2><div class="selectable-grid post-types"><button type="button" data-selectable aria-pressed="true">Pregunta</button><button type="button" data-selectable aria-pressed="false">Recomendación</button><button type="button" data-selectable aria-pressed="false">Barrio</button><button type="button" data-selectable aria-pressed="false">Aviso</button><button type="button" data-selectable aria-pressed="false">Experiencia</button><button type="button" data-selectable aria-pressed="false">Vivienda</button></div><label class="full-field">Tu publicación<textarea rows="6" placeholder="¿Qué quieres contar?"></textarea></label><button class="secondary-wide photo-drop" type="button"><span>＋</span><b>Añadir foto</b><small>Opcional · Hasta 10 imágenes</small></button>`,
  ()=>`<p class="eyebrow">VISTA PREVIA</p><h2>Lista para publicar</h2><article class="post-preview"><header><span>R</span><div><b>Tu perfil</b><small>Vista previa</small></div></header><p>Tu publicación aparecerá aquí.</p></article><p class="publish-visibility">La publicación se mostrará en Rooms o en la comunidad desde la que la estés creando.</p>`
 ]}
};
function renderPublishFlow(){const flow=publishFlows[publishType],content=document.querySelector('#publishFlowContent'),last=publishStep===flow.steps.length-1,continueButton=document.querySelector('#publishFlowContinue'),externalBlocked=publishType==='external'&&last;document.querySelector('#publishFlowKind').textContent=flow.label;document.querySelector('#publishProgressBar').style.width=`${((publishStep+1)/flow.steps.length)*100}%`;content.innerHTML=flow.steps[publishStep]();document.querySelector('#publishFlowBack').textContent=publishStep?'←':'×';continueButton.textContent=externalBlocked?'Próximamente':last?'Publicar →':'Continuar →';continueButton.disabled=externalBlocked;continueButton.setAttribute('aria-disabled',externalBlocked?'true':'false')}
function openPublishFlow(type){publishType=type;publishStep=0;publishModal.classList.remove('open');publishModal.setAttribute('aria-hidden','true');renderPublishFlow();open(publishFlowModal)}
function advanceCarousel(carousel,direction){const slides=[...carousel.querySelectorAll('[data-carousel-slide]')],dots=[...carousel.querySelectorAll('.carousel-dots i')];let index=Number(carousel.dataset.index||0);index=(index+direction+slides.length)%slides.length;carousel.dataset.index=index;slides.forEach((slide,i)=>slide.classList.toggle('active',i===index));dots.forEach((dot,i)=>dot.classList.toggle('active',i===index));carousel.querySelector('.carousel-dots').setAttribute('aria-label',`Imagen ${index+1} de ${slides.length}`)}
document.querySelectorAll('[data-feed-filter]').forEach(button=>button.addEventListener('click',()=>{const filter=button.dataset.feedFilter;document.querySelectorAll('[data-feed-filter]').forEach(item=>item.classList.toggle('active',item===button));window.ROOMS_HOME_FEED_PAGING?.applyFilter(filter);ping(filter==='all'?'Mostrando todo':`Feed: ${button.textContent}`)}));
document.querySelector('#mobilePublish').addEventListener('click',()=>open(publishModal));
document.querySelectorAll('[data-publish-type]').forEach(button=>button.addEventListener('click',()=>openPublishFlow(button.dataset.publishType)));
document.querySelector('#publishFlowBack').addEventListener('click',()=>{if(publishStep){publishStep--;renderPublishFlow();return}publishFlowModal.classList.remove('open');publishFlowModal.setAttribute('aria-hidden','true');open(publishModal)});
document.querySelector('#publishFlowContinue').addEventListener('click',()=>{const flow=publishFlows[publishType];if(publishStep<flow.steps.length-1){publishStep++;renderPublishFlow();return}});
document.querySelector('#publishFlowContent').addEventListener('click',event=>{const button=event.target.closest('[data-selectable]');if(!button)return;const exclusive=button.closest('.flow-choice,.post-types');if(exclusive)exclusive.querySelectorAll('[data-selectable]').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));else button.setAttribute('aria-pressed',String(button.getAttribute('aria-pressed')!=='true'))});
function showMainView(view){
  const views={
    home:feedMain,
    explore:exploreView,
    communities:communitiesView,
    household:householdView,
    profile:ownProfileView,
    saved:savedView,
    settings:settingsView,
    trust:trustView
  };

  if(!views[view])return;

  Object.values(views).forEach(item=>{
    item.hidden=true;
  });

  communityView.hidden=true;
  views[view].hidden=false;

  try{
    sessionStorage.setItem(
      'rooms:last-main-view',
      view
    );
  }catch(error){
    console.warn(
      'Rooms: no se pudo guardar la vista actual.',
      error
    );
  }

  document.querySelectorAll('[data-bottom-nav]').forEach(item=>{
    const activeView=
      view==='household'
        ?'communities'
        :['saved','settings','trust'].includes(view)
          ?'profile'
          :view;

    item.classList.toggle(
      'active',
      item.dataset.bottomNav===activeView
    );
  });

  window.scrollTo({
    top:0,
    behavior:'smooth'
  });
}
document.querySelectorAll('[data-bottom-nav]').forEach(button=>button.addEventListener('click',()=>{showMainView(button.dataset.bottomNav)}));
// ROOMS HOME WAYFINDING V1 — reuse Explore's existing controller and filters.
document.querySelectorAll('[data-home-discover]').forEach(button => {
  button.addEventListener('click', () => {
    const mode = button.dataset.homeDiscover;
    if (!['homes', 'people', 'communities'].includes(mode)) return;
    showMainView('explore');
    document.querySelector(`[data-explore-mode="${mode}"]`)?.click();
  });
});
document.querySelector('#openChats').addEventListener('click',()=>open(chatInboxModal));
document.querySelector('#openNotifications').addEventListener('click',()=>open(notificationsModal));
document.querySelector('#conversationBack').addEventListener('click',()=>{conversationModal.classList.remove('open');conversationModal.setAttribute('aria-hidden','true');open(chatInboxModal)});

document.querySelector('#chatInboxSearch').addEventListener('input',event=>{
  const query=event.target.value.trim().toLocaleLowerCase('es');
  const list=document.querySelector('#chatInboxModal .conversation-list');
  const items=[...document.querySelectorAll('#chatInboxModal [data-real-chat]')];

  items.forEach(item=>{
    item.hidden=query&&!item.textContent.toLocaleLowerCase('es').includes(query);
  });

  list?.querySelector('[data-chat-search-empty]')?.remove();

  if(query&&items.length&&!items.some(item=>!item.hidden)){
    list?.insertAdjacentHTML('beforeend','<div class="real-empty-state" data-chat-search-empty><b>No encontramos conversaciones</b><p>Prueba con otro nombre o palabra del último mensaje.</p></div>');
  }
});



document.querySelector('#notificationSettings').addEventListener('click',()=>{const preferences=document.querySelector('#notificationPreferences');preferences.hidden=!preferences.hidden;preferences.scrollIntoView({behavior:'smooth',block:'start'})});
document.querySelector('#openOwnProfile').addEventListener('click',()=>{closeAll();showMainView('profile')});
document.querySelectorAll('[data-back-profile]').forEach(button=>button.addEventListener('click',()=>showMainView('profile')));
document.querySelectorAll('[data-open-saved]').forEach(button=>button.addEventListener('click',()=>showMainView('saved')));
document.querySelectorAll('[data-open-settings]').forEach(button=>button.addEventListener('click',()=>showMainView('settings')));
document.querySelectorAll('[data-open-trust]').forEach(button=>button.addEventListener('click',()=>showMainView('trust')));

document.querySelectorAll('[data-saved-filter]').forEach(button=>button.addEventListener('click',()=>{const filter=button.dataset.savedFilter;document.querySelectorAll('[data-saved-filter]').forEach(item=>item.classList.toggle('active',item===button));document.querySelectorAll('[data-saved-type]').forEach(card=>card.hidden=filter!=='all'&&card.dataset.savedType!==filter);const count=Number(button.querySelector('i')?.textContent||0);document.querySelector('#savedResultsTitle').textContent=`${count} ${count===1?'elemento':'elementos'}`}));

document.querySelector('#createCollection').addEventListener('click',()=>open(collectionModal));
document.querySelector('#saveCollection').addEventListener('click',async()=>{
  const name=document.querySelector('#collectionName').value.trim();
  const visibility='private';

  if(!name){
    ping('Pon un nombre a la colección');
    return;
  }

  const result=await window.roomsBackend?.createSavedCollection?.(name,visibility);

  if(result?.error){
    ping('No se pudo crear la colección');
    return;
  }

  document.querySelector('#collectionName').value='';
  closeAll();
  ping('Colección creada');
});

document.querySelectorAll('[data-settings-tab]').forEach(button=>button.addEventListener('click',()=>{const name=button.dataset.settingsTab;document.querySelectorAll('[data-settings-tab]').forEach(item=>item.classList.toggle('active',item===button));document.querySelectorAll('[data-settings-panel]').forEach(panel=>panel.hidden=panel.dataset.settingsPanel!==name)}));
feed.addEventListener('click',event=>{const carouselControl=event.target.closest('[data-carousel-prev],[data-carousel-next]');if(!carouselControl)return;event.stopPropagation();advanceCarousel(carouselControl.closest('[data-carousel]'),carouselControl.hasAttribute('data-carousel-next')?1:-1)});

document.querySelector('#exploreFilters').addEventListener('click',()=>open(exploreFilterModal));
document.querySelectorAll('[data-empty-action="filters"]').forEach(button=>button.addEventListener('click',()=>open(exploreFilterModal)));
document.querySelectorAll('[data-empty-action="communities"]').forEach(button=>button.addEventListener('click',()=>showMainView('communities')));
const offlineBanner=document.createElement('div');offlineBanner.className='offline-banner';offlineBanner.hidden=true;offlineBanner.innerHTML='<b>Sin conexión</b><span>Algunas funciones no estarán disponibles hasta que recuperes internet.</span>';document.body.appendChild(offlineBanner);window.addEventListener('offline',()=>offlineBanner.hidden=false);window.addEventListener('online',()=>{offlineBanner.hidden=true;ping('Conexión recuperada')});

document.addEventListener('click',event=>{const detailCarouselControl=event.target.closest('#detailModal [data-carousel-prev],#detailModal [data-carousel-next]');if(detailCarouselControl){advanceCarousel(detailCarouselControl.closest('[data-carousel]'),detailCarouselControl.hasAttribute('data-carousel-next')?1:-1);return}if(event.target.closest('[data-close]'))closeAll()});document.addEventListener('keydown',event=>{if(event.key==='Escape')closeAll()});

window.addEventListener(
  'resize',
  ()=>{
    if(
      document.querySelector(
        '#onboardingStep7'
      )?.hidden===false
    ){
      fitRoomsDnaRevealTitle();
    }
  }
);
