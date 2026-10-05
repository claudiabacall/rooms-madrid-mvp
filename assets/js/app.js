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
let dnaThisPointer=null;

function thisOrThatComplete(){
  return roomsDna.thisOrThat.every(
    question=>Boolean(
      dnaState.thisOrThat[question.id]
    )
  );
}

function renderThisOrThat(){
  const host=
    document.querySelector('#dnaThisOrThat');

  if(!host||!roomsDna)return;

  if(
    dnaThisIndex>=
    roomsDna.thisOrThat.length
  ){
    host.innerHTML=`
      <div class="dna-swipe-complete">
        <span aria-hidden="true">✦</span>
        <strong>Primera capa lista</strong>
        <small>
          ${roomsDna.thisOrThat.length}
          decisiones guardadas
        </small>

        <button
          type="button"
          data-dna-review-this>
          Revisar respuestas
        </button>
      </div>
    `;

    updateOnboardingContinue();
    return;
  }

  const question=
    roomsDna.thisOrThat[dnaThisIndex];

  const selected=
    dnaState.thisOrThat[question.id];

  host.innerHTML=`
    <div
      class="dna-swipe-stage"
      data-dna-swipe-stage
      tabindex="0"
      aria-label="${question.title}">

      <div class="dna-swipe-meta">
        <span>
          ${dnaThisIndex+1}
          / ${roomsDna.thisOrThat.length}
        </span>

        <div>
          <i style="width:${
            ((dnaThisIndex+1)/
            roomsDna.thisOrThat.length)*100
          }%"></i>
        </div>
      </div>

      <div class="dna-split-question">
        <small>THIS OR THAT</small>
        <h2>${question.title}</h2>
        <p>Elige la opción que más se parece a ti.</p>
      </div>

      <div class="dna-swipe-deck">

        <button
          class="dna-swipe-choice dna-swipe-choice-left"
          type="button"
          data-dna-this="${question.id}"
          data-dna-value="${question.left.id}"
          data-dna-swipe-choice="left"
          aria-label="${question.left.label}">
          <span>←</span>
          <b>${question.left.label}</b>
        </button>

        <button
          class="dna-swipe-choice dna-swipe-choice-right"
          type="button"
          data-dna-this="${question.id}"
          data-dna-value="${question.right.id}"
          data-dna-swipe-choice="right"
          aria-label="${question.right.label}">
          <b>${question.right.label}</b>
          <span>→</span>
        </button>

        <article
          class="dna-swipe-card"
          tabindex="0"
          role="group"
          aria-label="${question.title}"
          data-dna-swipe-card>

          <small>THIS OR THAT</small>

          <h2>${question.title}</h2>

          <p>
            Arrastra hacia la opción
            que más se parece a ti
          </p>

          <div class="dna-swipe-card-hint">
            <span>←</span>
            <em>desliza</em>
            <span>→</span>
          </div>

        </article>
      </div>

      <div class="dna-swipe-mobile-labels">
        <span>${question.left.label}</span>
        <span>${question.right.label}</span>
      </div>

      ${
        selected
          ? `<small class="dna-swipe-saved">
              Respuesta guardada
            </small>`
          : ''
      }
    </div>
  `;

  bindThisOrThatGesture();
}

function commitThisOrThat(side){
  const question=
    roomsDna.thisOrThat[dnaThisIndex];

  if(!question)return;

  const option=
    side==='left'
      ? question.left
      : question.right;

  dnaState.thisOrThat[question.id]=
    option.id;

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

function resetSwipeCard(card,stage){
  if(!card)return;

  card.style.transform='';
  card.style.transition='';

  stage?.removeAttribute(
    'data-swipe-direction'
  );

  dnaThisPointer=null;
}

function bindThisOrThatGesture(){
  const card=
    document.querySelector(
      '[data-dna-swipe-card]'
    );

  const stage=
    document.querySelector(
      '[data-dna-swipe-stage]'
    );

  if(!card||!stage)return;

  stage.addEventListener(
    'keydown',
    event=>{
      if(
        event.target!==stage
      )return;

      if(event.key==='ArrowLeft'){
        event.preventDefault();
        commitThisOrThat('left');
      }

      if(event.key==='ArrowRight'){
        event.preventDefault();
        commitThisOrThat('right');
      }
    }
  );

  card.addEventListener(
    'pointerdown',
    event=>{
      dnaThisPointer={
        id:event.pointerId,
        startX:event.clientX,
        deltaX:0
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
        !dnaThisPointer||
        dnaThisPointer.id!==
          event.pointerId
      )return;

      const deltaX=
        event.clientX-
        dnaThisPointer.startX;

      dnaThisPointer.deltaX=
        deltaX;

      const limited=
        Math.max(
          -220,
          Math.min(220,deltaX)
        );

      const rotate=
        limited/24;

      card.style.transform=
        `translateX(${limited}px) rotate(${rotate}deg)`;

      if(deltaX<-35){
        stage.setAttribute(
          'data-swipe-direction',
          'left'
        );
      }else if(deltaX>35){
        stage.setAttribute(
          'data-swipe-direction',
          'right'
        );
      }else{
        stage.removeAttribute(
          'data-swipe-direction'
        );
      }
    }
  );

  const finishPointer=event=>{
    if(
      !dnaThisPointer||
      dnaThisPointer.id!==
        event.pointerId
    )return;

    const deltaX=
      dnaThisPointer.deltaX;

    card.classList.remove(
      'is-dragging'
    );

    if(Math.abs(deltaX)>=85){
      commitThisOrThat(
        deltaX<0
          ? 'left'
          : 'right'
      );
      return;
    }

    resetSwipeCard(
      card,
      stage
    );
  };

  card.addEventListener(
    'pointerup',
    finishPointer
  );

  card.addEventListener(
    'pointercancel',
    event=>{
      card.classList.remove(
        'is-dragging'
      );

      resetSwipeCard(
        card,
        stage
      );
    }
  );

  card.addEventListener(
    'keydown',
    event=>{
      if(event.key==='ArrowLeft'){
        event.preventDefault();
        commitThisOrThat('left');
      }

      if(event.key==='ArrowRight'){
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

let dnaImportanceIndex=0;
let dnaImportanceLocked=false;
let activeImportanceQuestions=[];

function importanceSignalScore(id){
  const scenarios=dnaState.scenarios;
  const thisOrThat=dnaState.thisOrThat;

  const scenarioScore=value=>{
    if(value==='strong')return 3;
    if(value==='depends')return 2;
    if(value==='fine')return 1;
    return 0;
  };

  if(id==='cleanliness'){
    return scenarioScore(
      scenarios.dishes_two_days
    );
  }

  if(id==='social_energy'){
    return Math.max(
      scenarioScore(
        scenarios.six_friends_tonight
      ),
      scenarioScore(
        scenarios.improvised_dinner
      )
    );
  }

  if(id==='quiet_focus'){
    return Math.max(
      scenarioScore(
        scenarios.music_while_working
      ),
      scenarioScore(
        scenarios.working_from_home
      )
    );
  }

  if(id==='daily_rhythm'){
    return thisOrThat.tuesday_2330
      ? 2.5
      : 0;
  }

  return 0;
}

function getActiveImportanceQuestions(){
  const questions=[
    ...roomsDna.dynamicImportance
  ];

  return questions
    .map((question,index)=>({
      ...question,
      signalScore:
        importanceSignalScore(
          question.id
        ),
      originalIndex:index
    }))
    .sort((a,b)=>{
      if(
        b.signalScore!==
        a.signalScore
      ){
        return (
          b.signalScore-
          a.signalScore
        );
      }

      return (
        a.originalIndex-
        b.originalIndex
      );
    })
    .slice(0,3);
}

function importancePosition(index){
  const last=
    roomsDna.importanceScale.length-1;

  if(last<=0)return 50;

  return (index/last)*100;
}

function previewImportance(
  index,
  slider
){
  const option=
    roomsDna.importanceScale[index];

  if(!option||!slider)return;

  slider.style.setProperty(
    '--importance-position',
    `${importancePosition(index)}%`
  );

  slider.setAttribute(
    'aria-valuenow',
    String(index)
  );

  slider.setAttribute(
    'aria-valuetext',
    option.label
  );

  const current=
    slider.querySelector(
      '.dna-importance-current'
    );

  if(current){
    current.textContent=
      option.label;
  }

  slider
    .querySelectorAll(
      '.dna-importance-stop'
    )
    .forEach((stop,stopIndex)=>{
      stop.classList.toggle(
        'is-active',
        stopIndex===index
      );
    });
}

function importanceIndexFromPoint(
  clientX,
  slider
){
  const rect=
    slider.getBoundingClientRect();

  const ratio=Math.max(
    0,
    Math.min(
      1,
      (
        clientX-
        rect.left
      )/
      rect.width
    )
  );

  return Math.round(
    ratio*(
      roomsDna.importanceScale.length-1
    )
  );
}

function commitImportance(
  index
){
  if(dnaImportanceLocked)return;

  const question=
    activeImportanceQuestions[
      dnaImportanceIndex
    ];

  const option=
    roomsDna.importanceScale[index];

  if(!question||!option)return;

  dnaImportanceLocked=true;

  dnaState.importance[
    question.id
  ]=option.id;

  const stage=
    document.querySelector(
      '.dna-importance-stage'
    );

  if(stage){
    stage.classList.add(
      'is-committed'
    );
  }

  updateOnboardingContinue();

  window.setTimeout(()=>{
    dnaImportanceIndex+=1;
    dnaImportanceLocked=false;
    renderImportance();
  },380);
}

function bindImportanceSlider(){
  const slider=
    document.querySelector(
      '.dna-importance-slider'
    );

  if(!slider)return;

  slider.addEventListener(
    'pointermove',
    event=>{
      if(dnaImportanceLocked)return;

      previewImportance(
        importanceIndexFromPoint(
          event.clientX,
          slider
        ),
        slider
      );
    }
  );

  slider.addEventListener(
    'pointerdown',
    event=>{
      if(dnaImportanceLocked)return;

      slider.setPointerCapture(
        event.pointerId
      );

      slider.classList.add(
        'is-dragging'
      );

      previewImportance(
        importanceIndexFromPoint(
          event.clientX,
          slider
        ),
        slider
      );
    }
  );

  slider.addEventListener(
    'pointerup',
    event=>{
      if(dnaImportanceLocked)return;

      slider.classList.remove(
        'is-dragging'
      );

      const index=
        importanceIndexFromPoint(
          event.clientX,
          slider
        );

      previewImportance(
        index,
        slider
      );

      commitImportance(index);
    }
  );

  slider.addEventListener(
    'pointercancel',
    ()=>{
      slider.classList.remove(
        'is-dragging'
      );
    }
  );

  slider.addEventListener(
    'keydown',
    event=>{
      if(dnaImportanceLocked)return;

      const current=
        Number(
          slider.getAttribute(
            'aria-valuenow'
          ) || 1
        );

      if(event.key==='ArrowLeft'){
        event.preventDefault();

        previewImportance(
          Math.max(
            0,
            current-1
          ),
          slider
        );
      }

      if(event.key==='ArrowRight'){
        event.preventDefault();

        previewImportance(
          Math.min(
            roomsDna.importanceScale.length-1,
            current+1
          ),
          slider
        );
      }

      if(
        event.key==='Enter' ||
        event.key===' '
      ){
        event.preventDefault();

        commitImportance(
          Number(
            slider.getAttribute(
              'aria-valuenow'
            ) || 1
          )
        );
      }
    }
  );
}

function renderImportance(){
  const host=
    document.querySelector(
      '#dnaImportance'
    );

  if(!host||!roomsDna)return;

  activeImportanceQuestions=
    getActiveImportanceQuestions();

  /*
    Si las respuestas anteriores han cambiado,
    living_importance solo conserva dimensiones
    activas en este onboarding.
  */
  const activeIds=
    new Set(
      activeImportanceQuestions
        .map(question=>question.id)
    );

  Object.keys(
    dnaState.importance
  ).forEach(id=>{
    if(!activeIds.has(id)){
      delete dnaState.importance[id];
    }
  });

  if(
    dnaImportanceIndex>=
    activeImportanceQuestions.length
  ){
    host.innerHTML=`
      <div class="dna-importance-complete">
        <span aria-hidden="true">✦</span>

        <small>
          ROOMS ESTÁ APRENDIENDO
        </small>

        <strong>
          Ya sabemos qué pesa
          de verdad para ti.
        </strong>

        <button
          type="button"
          class="dna-importance-review">
          Revisar
        </button>
      </div>
    `;

    updateOnboardingContinue();
    return;
  }

  const question=
    activeImportanceQuestions[
      dnaImportanceIndex
    ];

  const saved=
    dnaState.importance[
      question.id
    ];

  let initialIndex=1;

  if(saved){
    const found=
      roomsDna.importanceScale
        .findIndex(
          item=>item.id===saved
        );

    if(found>=0){
      initialIndex=found;
    }
  }

  const initial=
    roomsDna.importanceScale[
      initialIndex
    ];

  host.innerHTML=`
    <div class="dna-importance-stage">

      <div class="dna-importance-meta">
        <span>
          ${dnaImportanceIndex+1}
          / ${activeImportanceQuestions.length}
        </span>

        <div>
          <i style="width:${
            (
              (
                dnaImportanceIndex+1
              )/
              activeImportanceQuestions.length
            )*100
          }%"></i>
        </div>
      </div>

      <div class="dna-importance-insight">
        <span class="dna-importance-signal">
          ✦
        </span>

        <small>
          LO QUE ESTAMOS VIENDO
        </small>

        <h2>
          ${question.prompt}
        </h2>
      </div>

      <div
        class="dna-importance-slider"
        role="slider"
        tabindex="0"
        aria-label="${question.prompt}"
        aria-valuemin="0"
        aria-valuemax="${
          roomsDna.importanceScale.length-1
        }"
        aria-valuenow="${initialIndex}"
        aria-valuetext="${initial.label}"
        style="--importance-position:${
          importancePosition(initialIndex)
        }%">

        <strong
          class="dna-importance-current">
          ${initial.label}
        </strong>

        <div class="dna-importance-line">
          <span></span>
        </div>

        <div class="dna-importance-knob">
          <span></span>
        </div>

        <div class="dna-importance-stops">
          ${roomsDna.importanceScale.map(
            (option,index)=>`
              <div
                class="dna-importance-stop${
                  index===initialIndex
                    ? ' is-active'
                    : ''
                }">
                <i></i>
                <b>${option.label}</b>
              </div>
            `
          ).join('')}
        </div>
      </div>

      <p class="dna-importance-tip">
        Mueve el peso hasta donde
        realmente lo sientas.
      </p>
    </div>
  `;

  bindImportanceSlider();
}


let dnaDealbreakerIndex=0;
let dnaDealbreakerPointer=null;
let dnaDealbreakerLocked=false;

function commitDealbreaker(side){
  if(dnaDealbreakerLocked)return;

  const question=
    roomsDna.dealbreakers[
      dnaDealbreakerIndex
    ];

  if(!question)return;

  const isDealbreaker=
    side==='right';

  dnaDealbreakerLocked=true;

  dnaState.dealbreakers[
    question.id
  ]=isDealbreaker;

  const stage=
    document.querySelector(
      '.dna-dealbreaker-stage'
    );

  const card=
    document.querySelector(
      '.dna-dealbreaker-card'
    );

  if(stage){
    stage.classList.add(
      side==='left'
        ? 'is-adapt'
        : 'is-out'
    );
  }

  if(card){
    card.classList.add(
      side==='left'
        ? 'dealbreaker-out-left'
        : 'dealbreaker-out-right'
    );
  }

  updateOnboardingContinue();

  window.setTimeout(()=>{
    dnaDealbreakerIndex+=1;
    dnaDealbreakerLocked=false;
    renderDealbreakers();
  },360);
}

function resetDealbreakerCard(
  card,
  stage
){
  if(!card)return;

  card.style.transform='';
  card.style.transition='';

  stage?.classList.remove(
    'is-preview-left',
    'is-preview-right'
  );

  dnaDealbreakerPointer=null;
}

function bindDealbreakerCard(){
  const card=
    document.querySelector(
      '.dna-dealbreaker-card'
    );

  const stage=
    document.querySelector(
      '.dna-dealbreaker-stage'
    );

  if(!card||!stage)return;

  card.addEventListener(
    'pointerdown',
    event=>{
      if(dnaDealbreakerLocked)return;

      dnaDealbreakerPointer={
        id:event.pointerId,
        startX:event.clientX,
        deltaX:0
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
        !dnaDealbreakerPointer ||
        dnaDealbreakerPointer.id!==
          event.pointerId
      )return;

      const deltaX=
        event.clientX-
        dnaDealbreakerPointer.startX;

      dnaDealbreakerPointer.deltaX=
        deltaX;

      const limited=
        Math.max(
          -220,
          Math.min(220,deltaX)
        );

      card.style.transform=
        `translateX(${limited}px) rotate(${limited/28}deg)`;

      stage.classList.remove(
        'is-preview-left',
        'is-preview-right'
      );

      if(deltaX<-35){
        stage.classList.add(
          'is-preview-left'
        );
      }

      if(deltaX>35){
        stage.classList.add(
          'is-preview-right'
        );
      }
    }
  );

  const finish=event=>{
    if(
      !dnaDealbreakerPointer ||
      dnaDealbreakerPointer.id!==
        event.pointerId
    )return;

    const deltaX=
      dnaDealbreakerPointer.deltaX;

    card.classList.remove(
      'is-dragging'
    );

    if(Math.abs(deltaX)>=85){
      commitDealbreaker(
        deltaX<0
          ? 'left'
          : 'right'
      );
      return;
    }

    resetDealbreakerCard(
      card,
      stage
    );
  };

  card.addEventListener(
    'pointerup',
    finish
  );

  card.addEventListener(
    'pointercancel',
    ()=>{
      card.classList.remove(
        'is-dragging'
      );

      resetDealbreakerCard(
        card,
        stage
      );
    }
  );

  card.addEventListener(
    'keydown',
    event=>{
      if(event.key==='ArrowLeft'){
        event.preventDefault();
        commitDealbreaker('left');
      }

      if(event.key==='ArrowRight'){
        event.preventDefault();
        commitDealbreaker('right');
      }
    }
  );
}

function renderDealbreakers(){
  const host=
    document.querySelector(
      '#dnaDealbreakers'
    );

  if(!host||!roomsDna)return;

  if(
    dnaDealbreakerIndex>=
    roomsDna.dealbreakers.length
  ){
    host.innerHTML=`
      <div class="dna-dealbreaker-complete">
        <span aria-hidden="true">✦</span>

        <strong>
          Límites claros.
        </strong>

        <small>
          ${roomsDna.dealbreakers.length}
          decisiones guardadas
        </small>

        <button
          type="button"
          class="dna-dealbreaker-review">
          Revisar
        </button>
      </div>
    `;

    updateOnboardingContinue();
    return;
  }

  const question=
    roomsDna.dealbreakers[
      dnaDealbreakerIndex
    ];

  host.innerHTML=`
    <div class="dna-dealbreaker-stage">

      <div class="dna-dealbreaker-meta">
        <span>
          ${dnaDealbreakerIndex+1}
          / ${roomsDna.dealbreakers.length}
        </span>

        <div>
          <i style="width:${
            (
              (
                dnaDealbreakerIndex+1
              )/
              roomsDna.dealbreakers.length
            )*100
          }%"></i>
        </div>
      </div>

      <div class="dna-dealbreaker-copy">
        <small>
          ¿DÓNDE ESTÁ TU LÍMITE?
        </small>

        <p>
          Coloca esta situación donde
          realmente encaje para ti.
        </p>
      </div>

      <div class="dna-dealbreaker-board">

        <button
          type="button"
          class="dna-dealbreaker-zone dna-dealbreaker-zone-left">
          <span>←</span>
          <small>PODRÍA</small>
          <b>ADAPTARME</b>
        </button>

        <button
          type="button"
          class="dna-dealbreaker-zone dna-dealbreaker-zone-right">
          <small>NO ES</small>
          <b>PARA MÍ</b>
          <span>→</span>
        </button>

        <article
          class="dna-dealbreaker-card"
          tabindex="0"
          role="group"
          aria-label="${question.label}">

          <small>
            SITUACIÓN
          </small>

          <h2>
            ${question.label}
          </h2>

          <div>
            <span>←</span>
            <em>arrastra</em>
            <span>→</span>
          </div>

        </article>
      </div>

    </div>
  `;

  bindDealbreakerCard();
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

function setHomePreference(
  preferenceId,
  levelId
){
  const validPreference=
    roomsDna.homePreferences.some(
      item=>item.id===preferenceId
    );

  const validLevel=
    roomsDna.homePreferenceScale.some(
      item=>item.id===levelId
    );

  if(
    !validPreference ||
    !validLevel
  )return;

  dnaState.homePreferences[
    preferenceId
  ]=levelId;

  dnaHomeSelected=null;

  renderHomePreferences();
  updateOnboardingContinue();
}

function homePreferenceCard(
  preference
){
  const current=
    dnaState.homePreferences[
      preference.id
    ];

  const selected=
    dnaHomeSelected===
    preference.id;

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
          ? `, ${
              roomsDna.homePreferenceScale
                .find(
                  option=>
                    option.id===current
                )?.label || ''
            }`
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
            ? 'Mover'
            : 'Colocar'
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

  /*
    Si solo ha sido un toque/click,
    mantenemos el sistema alternativo:
    seleccionar ficha y después nivel.
  */
  if(!pointer.moved){
    dnaHomeSelected=
      dnaHomeSelected===
        pointer.preferenceId
        ? null
        : pointer.preferenceId;

    renderHomePreferences();
    return;
  }

  /*
    Si se arrastra pero se suelta fuera,
    reconstruimos para devolver la ficha
    exactamente a su posición original.
  */
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

  if(!host||!roomsDna)return;

  const unassigned=
    roomsDna.homePreferences
      .filter(
        preference=>
          !dnaState.homePreferences[
            preference.id
          ]
      );

  const placedCount=
    roomsDna.homePreferences.length-
    unassigned.length;

  host.innerHTML=`
    <div class="dna-home-experience">

      <div class="dna-home-status">
        <span>
          ${placedCount}
          / ${roomsDna.homePreferences.length}
          colocadas
        </span>

        <div>
          <i style="width:${
            (
              placedCount/
              roomsDna.homePreferences.length
            )*100
          }%"></i>
        </div>
      </div>

      <div class="dna-home-shelf">
        <div class="dna-home-shelf-head">
          <div>
            <small>
              POR COLOCAR
            </small>

            <strong>
              ${
                unassigned.length
                  ? 'Construye tus prioridades'
                  : 'Tu casa ideal ya tiene forma'
              }
            </strong>
          </div>

          ${
            dnaHomeSelected
              ? `
                <span class="dna-home-selected-note">
                  Ahora elige un nivel ↓
                </span>
              `
              : `
                <span class="dna-home-selected-note">
                  Arrastra una ficha
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
                  ✦ Todo colocado
                </div>
              `
          }
        </div>
      </div>

      <div class="dna-home-board">

        ${roomsDna.homePreferenceScale
          .map((level,index)=>{

            const items=
              roomsDna.homePreferences
                .filter(
                  preference=>
                    dnaState
                      .homePreferences[
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
                          Suelta aquí
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
        Arrastra para ordenar.
        También puedes tocar una ficha
        y después elegir un nivel.
      </p>

    </div>
  `;

  bindHomePreferenceBoard();
}

let dnaTraitPointer=null;

const dnaInterestSymbols={
  sport:'●',
  music:'♫',
  cooking:'✦',
  travel:'↗',
  gym:'↑',
  gaming:'◫',
  reading:'Aa',
  'going-out':'✺',
  'quiet-plans':'☾',
  pets:'♡'
};

const dnaTraitSymbols={
  tidy:'⌁',
  social:'✦',
  calm:'○',
  independent:'↗',
  cook:'◇',
  early:'☀'
};

function renderInterestMosaic(){
  const host=
    document.querySelector(
      '#dnaInterests'
    );

  if(!host||!roomsDna)return;

  host.innerHTML=`
    <section class="dna-identity-block dna-interests-block">

      <header class="dna-identity-section-head">
        <div>
          <small>
            01 · TU MUNDO
          </small>

          <h2>
            ¿Qué forma parte de ti?
          </h2>
        </div>

        <span>
          ${dnaState.interests.size}
          elegidos
        </span>
      </header>

      <div class="dna-interest-mosaic">
        ${roomsDna.interests.map(
          (item,index)=>`
            <button
              type="button"
              class="
                dna-interest-tile
                dna-interest-size-${
                  (index%4)+1
                }
                ${
                  dnaState.interests.has(
                    item.id
                  )
                    ? 'is-selected'
                    : ''
                }
              "
              data-dna-interest="${item.id}"
              aria-pressed="${
                dnaState.interests.has(
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
                  dnaState.interests.has(
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
        Elige todos los que realmente
        formen parte de tu vida.
      </p>

    </section>
  `;
}

function traitCard(item){
  const selected=
    dnaState.traits.has(
      item.id
    );

  return `
    <button
      type="button"
      class="dna-trait-card${
        selected
          ? ' is-in-identity'
          : ''
      }"
      data-dna-trait="${item.id}"
      aria-pressed="${selected}">

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
          selected
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
  const valid=
    roomsDna.traits.some(
      item=>item.id===traitId
    );

  if(!valid)return;

  if(selected){
    dnaState.traits.add(
      traitId
    );
  }else{
    dnaState.traits.delete(
      traitId
    );
  }

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

        if(!pointer.moved){
          setTraitIdentity(
            pointer.traitId,
            !dnaState.traits.has(
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

  if(!host||!roomsDna)return;

  const outside=
    roomsDna.traits.filter(
      item=>
        !dnaState.traits.has(
          item.id
        )
    );

  const inside=
    roomsDna.traits.filter(
      item=>
        dnaState.traits.has(
          item.id
        )
    );

  host.innerHTML=`
    <section class="dna-identity-block dna-traits-block">

      <header class="dna-identity-section-head">
        <div>
          <small>
            02 · CÓMO ERES
          </small>

          <h2>
            ¿Qué te llevas contigo?
          </h2>
        </div>

        <span>
          ${inside.length}
          dentro
        </span>
      </header>

      <div class="dna-trait-workspace">

        <div class="dna-trait-pool">
          <small>
            ARRASTRA LO QUE TE DEFINE
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
        También puedes tocar un rasgo
        para meterlo o sacarlo.
      </p>

    </section>
  `;

  bindTraitIdentity();
}

function renderIdentityChips(){
  renderInterestMosaic();
  renderTraitIdentity();
}


let dnaScenarioIndex=0;
let dnaScenarioPointer=null;
let dnaScenarioLocked=false;

function scenarioScaleIndexFromPoint(
  clientX,
  meter
){
  const rect=meter.getBoundingClientRect();

  const ratio=Math.max(
    0,
    Math.min(
      1,
      (clientX-rect.left)/rect.width
    )
  );

  return Math.round(
    ratio*(
      roomsDna.scenarioScale.length-1
    )
  );
}

function scenarioPosition(index){
  const last=
    roomsDna.scenarioScale.length-1;

  if(last<=0)return 50;

  return (index/last)*100;
}

function previewScenarioReaction(
  index,
  meter
){
  const scale=
    roomsDna.scenarioScale[index];

  if(!scale||!meter)return;

  meter.style.setProperty(
    '--reaction-position',
    `${scenarioPosition(index)}%`
  );

  const value=
    meter.querySelector(
      '.dna-reaction-current'
    );

  if(value){
    value.textContent=scale.label;
  }

  meter
    .querySelectorAll(
      '.dna-reaction-stop'
    )
    .forEach((stop,stopIndex)=>{
      stop.classList.toggle(
        'is-active',
        stopIndex===index
      );
    });

  meter.setAttribute(
    'aria-valuenow',
    String(index)
  );

  meter.setAttribute(
    'aria-valuetext',
    scale.label
  );
}

function commitScenarioReaction(
  index
){
  if(dnaScenarioLocked)return;

  const question=
    roomsDna.scenarios[
      dnaScenarioIndex
    ];

  const scale=
    roomsDna.scenarioScale[index];

  if(!question||!scale)return;

  dnaScenarioLocked=true;

  dnaState.scenarios[
    question.id
  ]=scale.id;

  const stage=
    document.querySelector(
      '.dna-reaction-stage'
    );

  if(stage){
    stage.classList.add(
      'is-committed'
    );
  }

  updateOnboardingContinue();

  window.setTimeout(()=>{
    dnaScenarioIndex+=1;
    dnaScenarioLocked=false;
    renderScenarios();
  },420);
}

function bindScenarioMeter(){
  const meter=
    document.querySelector(
      '.dna-reaction-meter'
    );

  if(!meter)return;

  meter.addEventListener(
    'pointermove',
    event=>{
      if(dnaScenarioLocked)return;

      const index=
        scenarioScaleIndexFromPoint(
          event.clientX,
          meter
        );

      previewScenarioReaction(
        index,
        meter
      );

      if(
        dnaScenarioPointer &&
        dnaScenarioPointer.id===
          event.pointerId
      ){
        dnaScenarioPointer.index=
          index;
      }
    }
  );

  meter.addEventListener(
    'pointerdown',
    event=>{
      if(dnaScenarioLocked)return;

      const index=
        scenarioScaleIndexFromPoint(
          event.clientX,
          meter
        );

      dnaScenarioPointer={
        id:event.pointerId,
        index
      };

      meter.setPointerCapture(
        event.pointerId
      );

      meter.classList.add(
        'is-dragging'
      );

      previewScenarioReaction(
        index,
        meter
      );
    }
  );

  meter.addEventListener(
    'pointerup',
    event=>{
      if(
        !dnaScenarioPointer ||
        dnaScenarioPointer.id!==
          event.pointerId
      )return;

      const index=
        dnaScenarioPointer.index;

      dnaScenarioPointer=null;

      meter.classList.remove(
        'is-dragging'
      );

      commitScenarioReaction(
        index
      );
    }
  );

  meter.addEventListener(
    'pointercancel',
    ()=>{
      dnaScenarioPointer=null;

      meter.classList.remove(
        'is-dragging'
      );
    }
  );

  meter.addEventListener(
    'keydown',
    event=>{
      if(dnaScenarioLocked)return;

      const current=
        Number(
          meter.getAttribute(
            'aria-valuenow'
          ) || 1
        );

      if(
        event.key==='ArrowLeft'
      ){
        event.preventDefault();

        previewScenarioReaction(
          Math.max(
            0,
            current-1
          ),
          meter
        );
      }

      if(
        event.key==='ArrowRight'
      ){
        event.preventDefault();

        previewScenarioReaction(
          Math.min(
            roomsDna.scenarioScale.length-1,
            current+1
          ),
          meter
        );
      }

      if(
        event.key==='Enter' ||
        event.key===' '
      ){
        event.preventDefault();

        commitScenarioReaction(
          Number(
            meter.getAttribute(
              'aria-valuenow'
            ) || 1
          )
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

  if(!host||!roomsDna)return;

  if(
    dnaScenarioIndex>=
    roomsDna.scenarios.length
  ){
    host.innerHTML=`
      <div class="dna-reaction-complete">
        <span aria-hidden="true">✦</span>

        <strong>
          Ya sabemos cómo reaccionas
        </strong>

        <small>
          ${roomsDna.scenarios.length}
          situaciones respondidas
        </small>

        <button
          type="button"
          class="dna-reaction-review">
          Revisar respuestas
        </button>
      </div>
    `;

    updateOnboardingContinue();
    return;
  }

  const question=
    roomsDna.scenarios[
      dnaScenarioIndex
    ];

  const saved=
    dnaState.scenarios[
      question.id
    ];

  let initialIndex=1;

  if(saved){
    const found=
      roomsDna.scenarioScale
        .findIndex(
          item=>item.id===saved
        );

    if(found>=0){
      initialIndex=found;
    }
  }

  const initial=
    roomsDna.scenarioScale[
      initialIndex
    ];

  host.innerHTML=`
    <div class="dna-reaction-stage">

      <div class="dna-reaction-meta">
        <span>
          ${dnaScenarioIndex+1}
          / ${roomsDna.scenarios.length}
        </span>

        <div>
          <i style="width:${
            (
              (
                dnaScenarioIndex+1
              )/
              roomsDna.scenarios.length
            )*100
          }%"></i>
        </div>
      </div>

      <div class="dna-reaction-copy">
        <small>
          ¿CÓMO TE SENTARÍA?
        </small>

        <h2>
          ${question.title}
        </h2>

        <p>
          Muévete por la escala.
          No lo pienses demasiado.
        </p>
      </div>

      <div
        class="dna-reaction-meter"
        role="slider"
        tabindex="0"
        aria-label="${question.title}"
        aria-valuemin="0"
        aria-valuemax="${
          roomsDna.scenarioScale.length-1
        }"
        aria-valuenow="${initialIndex}"
        aria-valuetext="${initial.label}"
        style="--reaction-position:${
          scenarioPosition(initialIndex)
        }%">

        <div class="dna-reaction-track">
          <span></span>
        </div>

        <div class="dna-reaction-orb">
          <span>✦</span>
        </div>

        <strong class="dna-reaction-current">
          ${initial.label}
        </strong>

        <div class="dna-reaction-stops">
          ${roomsDna.scenarioScale.map(
            (item,index)=>`
              <span
                class="dna-reaction-stop${
                  index===initialIndex
                    ? ' is-active'
                    : ''
                }">
                <i></i>
                <b>${item.label}</b>
              </span>
            `
          ).join('')}
        </div>
      </div>

      <small class="dna-reaction-tip">
        Arrastra, mueve el ratón
        o usa ← →
      </small>

    </div>
  `;

  bindScenarioMeter();
}

function renderDna(){
  renderThisOrThat();

  renderScenarios();

  renderImportance();

  renderDealbreakers();

  renderHomePreferences();

  renderIdentityChips();
}

function completeness(object,expected){
  return Object.keys(object).length===expected;
}

function updateOnboardingContinue(){
  let ready=true;

  if(onboardingStep===2){
    ready=completeness(
      dnaState.thisOrThat,
      roomsDna.thisOrThat.length
    );
  }

  if(onboardingStep===3){
    ready=completeness(
      dnaState.scenarios,
      roomsDna.scenarios.length
    );
  }

  if(onboardingStep===4){
    ready=completeness(
      dnaState.importance,
      getActiveImportanceQuestions().length
    );
  }

  if(onboardingStep===5){
    ready=completeness(
      dnaState.dealbreakers,
      roomsDna.dealbreakers.length
    );
  }

  if(onboardingStep===6){
    ready=completeness(
      dnaState.homePreferences,
      roomsDna.homePreferences.length
    );
  }

  if(onboardingStep===7){
    ready=
      dnaState.interests.size>0 &&
      dnaState.traits.size>0;
  }

  if(onboardingStep===8){
    ready=Boolean(
      document.querySelector('#profileName')?.value.trim()
    );
  }

  if(onboardingStep===10){
    ready=dnaState.intents.size>0;
  }

  onboardingContinue.disabled=!ready;
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

function renderReveal(){
  const descriptor=document.querySelector('#dnaRevealDescriptor');
  const summary=document.querySelector('#dnaRevealSummary');

  if(descriptor){
    descriptor.textContent=buildDnaDescriptor();
  }

  if(summary){
    const dealbreakers=Object.values(dnaState.dealbreakers)
      .filter(value=>value==='dealbreaker').length;

    const needs=Object.values(dnaState.homePreferences)
      .filter(value=>value==='need').length;

    summary.innerHTML=`
      <span><b>${roomsDna.scenarios.length}</b><small>señales de convivencia</small></span>
      <span><b>${dealbreakers}</b><small>dealbreakers</small></span>
      <span><b>${needs}</b><small>prioridades de hogar</small></span>
    `;
  }
}

function showOnboardingStep(step){
  onboardingStep=step;

  if(step===4){
    dnaImportanceIndex=0;
    renderImportance();
  }

  document.querySelectorAll('.onboarding-step').forEach(
    (panel,index)=>{
      panel.hidden=index!==step-1;
      panel.classList.toggle('active',index===step-1);
    }
  );

  document.querySelector('.onboarding-progress')
    ?.setAttribute('aria-label',`Paso ${step} de 10`);

  const copy=document.querySelector('.progress-copy');
  if(copy)copy.innerHTML=`${step} <i>/ 10</i>`;

  const progress=document.querySelector('.progress-track span');
  if(progress)progress.style.width=`${step*10}%`;

  onboardingBack.hidden=step===1;

  const tagline=document.querySelector('#onboardingTagline');
  if(tagline)tagline.hidden=step>1;

  if(step===1){
    onboardingContinue.innerHTML=
      'Empezar <span aria-hidden="true">→</span>';
  }else if(step===9){
    renderReveal();
    onboardingContinue.innerHTML=
      'Continuar <span aria-hidden="true">→</span>';
  }else if(step===10){
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

  const reviewImportance=
    event.target.closest(
      '.dna-importance-review'
    );

  if(reviewImportance){
    dnaImportanceIndex=0;
    renderImportance();
    return;
  }

  const dealbreakerZone=
    event.target.closest(
      '.dna-dealbreaker-zone'
    );

  if(dealbreakerZone){
    commitDealbreaker(
      dealbreakerZone.classList.contains(
        'dna-dealbreaker-zone-left'
      )
        ? 'left'
        : 'right'
    );
    return;
  }

  const reviewDealbreakers=
    event.target.closest(
      '.dna-dealbreaker-review'
    );

  if(reviewDealbreakers){
    dnaDealbreakerIndex=0;
    renderDealbreakers();
    return;
  }

  const interest=
    event.target.closest(
      '[data-dna-interest]'
    );

  if(interest){
    const id=
      interest.dataset.dnaInterest;

    if(
      dnaState.interests.has(id)
    ){
      dnaState.interests.delete(id);
    }else{
      dnaState.interests.add(id);
    }

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

function getRoomsDnaOnboardingSnapshot(){
  const livingThisOrThat={};
  const neighborhoodPreferences={};

  roomsDna.thisOrThat.forEach(question=>{
    const value=dnaState.thisOrThat[question.id]||null;

    if(question.target==='living_self'){
      livingThisOrThat[question.id]=value;
    }

    if(question.target==='neighborhood_preferences'){
      neighborhoodPreferences[question.id]=value;
    }
  });

  const dealbreakers={};
  roomsDna.dealbreakers.forEach(question=>{
    dealbreakers[question.id]=
      dnaState.dealbreakers[question.id]==='dealbreaker';
  });

  return {
    version:roomsDna.version,

    matchPreferences:{
      living_self:{
        this_or_that:livingThisOrThat,
        scenarios:{...dnaState.scenarios}
      },

      living_importance:{
        ...dnaState.importance
      },

      dealbreakers,

      home_preferences:{
        ...dnaState.homePreferences
      },

      neighborhood_preferences:
        neighborhoodPreferences,

      interests:[
        ...dnaState.interests
      ],

      traits:[
        ...dnaState.traits
      ]
    },

    intents:[
      ...dnaState.intents
    ],

    profile:{
      name:
        document.querySelector('#profileName')
          ?.value.trim()||'',

      bio:
        document.querySelector('#profileBio')
          ?.value.trim()||'',

      photo:
        document.querySelector('#profilePhotoInput')
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
  if(onboardingStep<10){
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
document.querySelectorAll('[data-feed-filter]').forEach(button=>button.addEventListener('click',()=>{const filter=button.dataset.feedFilter;document.querySelectorAll('[data-feed-filter]').forEach(item=>item.classList.toggle('active',item===button));document.querySelectorAll('[data-feed-type]').forEach(item=>item.hidden=filter!=='all'&&item.dataset.feedType!==filter);ping(filter==='all'?'Mostrando todo':`Feed: ${button.textContent}`)}));
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
