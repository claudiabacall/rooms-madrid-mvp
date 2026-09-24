const toast=document.querySelector('#toast');
const onboarding=document.querySelector('#onboarding'),onboardingContinue=document.querySelector('#onboardingContinue'),onboardingBack=document.querySelector('#onboardingBack'),searchTypes=new Set(),preferredZones=new Set();let onboardingStep=1;
const onboardingBudgetMin=document.querySelector('#onboardingBudgetMin'),onboardingBudgetMax=document.querySelector('#onboardingBudgetMax'),onboardingBudgetMinRange=document.querySelector('#onboardingBudgetMinRange'),onboardingBudgetMaxRange=document.querySelector('#onboardingBudgetMaxRange'),onboardingBudgetRange=document.querySelector('#onboardingBudgetRange');
const ONBOARDING_BUDGET_FLOOR=300,ONBOARDING_BUDGET_CEILING=4000,ONBOARDING_BUDGET_STEP=50;let savedBudgetMax=1000,durationChoice='',activeLivingCategory=0;
const homeFeatures=new Set(),livingPreferences=new Map(),livingWeights=new Map(),socialInterests=new Set(),selfDescriptions=new Set();
const livingCategories=[
 {name:'Limpieza',options:['Muy ordenado','Normal','Flexible']},
 {name:'Horarios',options:['Madrugador','Horario normal','Nocturno']},
 {name:'Ruido',options:['Muy tranquilo','Algo de ambiente','Me adapto']},
 {name:'Visitas',options:['Pocas','Con aviso','Sin problema']},
 {name:'Fiestas en casa',options:['Nunca','Alguna vez','Me da igual']},
 {name:'Teletrabajo / estudio',options:['Mucho','A veces','Casi nunca']},
 {name:'Fumar',options:['No','Solo fuera','Me da igual']},
 {name:'Mascotas',options:['Me encantan','Me da igual','Prefiero no']}
];
const livingImportance=['Imprescindible','Importante','Me da igual'];
const onboardingAreas=['Chamberí','Malasaña','Salamanca','Retiro','Moncloa','La Latina','Lavapiés','Argüelles','Chamartín','Centro'];
document.querySelectorAll('[data-search-type]').forEach(option=>option.addEventListener('click',()=>toggleOnboardingChoice(option,searchTypes,option.dataset.searchType)));
document.querySelectorAll('[data-home-feature]').forEach(option=>option.addEventListener('click',()=>toggleOnboardingChoice(option,homeFeatures,option.dataset.homeFeature)));
document.querySelectorAll('[data-interest]').forEach(option=>option.addEventListener('click',()=>toggleOnboardingChoice(option,socialInterests,option.dataset.interest)));
document.querySelectorAll('[data-self-description]').forEach(option=>option.addEventListener('click',()=>toggleOnboardingChoice(option,selfDescriptions,option.dataset.selfDescription)));
function toggleOnboardingChoice(option,collection,value){const selected=option.getAttribute('aria-pressed')==='true';option.setAttribute('aria-pressed',String(!selected));option.classList.toggle('selected',!selected);if(selected)collection.delete(value);else collection.add(value);updateOnboardingContinue()}
function updateOnboardingContinue(){onboardingContinue.disabled=onboardingStep===1?searchTypes.size===0:onboardingStep===2?preferredZones.size===0:onboardingStep===4?!(document.querySelector('#onboardingMoveDate').value&&durationChoice):onboardingStep===7?!document.querySelector('#profileName').value.trim():false}
function renderOnboardingZones(query=''){const normalized=query.trim().toLocaleLowerCase('es');const areas=[...onboardingAreas,'Estoy abierto a otras zonas'];const visible=areas.filter(area=>area.toLocaleLowerCase('es').includes(normalized));document.querySelector('#onboardingZones').innerHTML=visible.map(area=>`<button class="zone-chip${area.startsWith('Estoy abierto')?' open-zone':''}" type="button" aria-pressed="${preferredZones.has(area)}" data-area="${area}">${area}</button>`).join('');document.querySelector('#zoneEmpty').hidden=visible.length>0;document.querySelectorAll('[data-area]').forEach(option=>option.addEventListener('click',()=>toggleOnboardingChoice(option,preferredZones,option.dataset.area)))}
function renderLivingCategories(){document.querySelector('#livingCategories').innerHTML=livingCategories.map((category,index)=>{const active=index===activeLivingCategory,preference=livingPreferences.get(index),weight=livingWeights.get(index),complete=preference!==undefined&&weight!==undefined,summary=preference===undefined?'Sin responder':category.options[preference];return `<section class="living-category${active?' active':''}${complete?' complete':''}"><button class="living-category-header" type="button" data-living-header="${index}" aria-expanded="${active}"><span><b>${category.name}</b><small>${summary}</small></span><i aria-hidden="true">${active?'−':'+'}</i></button>${active?`<div class="living-category-body"><p>Tu preferencia</p><div class="living-choice-row">${category.options.map((option,optionIndex)=>`<button type="button" data-living-choice="${index}:${optionIndex}" aria-pressed="${preference===optionIndex}">${option}</button>`).join('')}</div><p class="weight-label">¿Cuánto debe pesar en tu match?</p><div class="living-choice-row importance-row">${livingImportance.map((option,optionIndex)=>`<button type="button" data-living-weight="${index}:${optionIndex}" aria-pressed="${weight===optionIndex}">${option}</button>`).join('')}</div></div>`:''}</section>`}).join('')}
function showOnboardingStep(step){onboardingStep=step;document.querySelectorAll('.onboarding-step').forEach((panel,index)=>panel.hidden=index!==step-1);document.querySelector('.onboarding-progress').setAttribute('aria-label',`Paso ${step} de 10`);document.querySelector('.progress-copy').innerHTML=`${step} <i>/ 10</i>`;document.querySelector('.progress-track span').style.width=`${step*10}%`;onboardingBack.hidden=step===1;document.querySelector('#onboardingTagline').hidden=step>1;document.querySelector('#onboardingLater').hidden=step!==9;onboardingContinue.innerHTML=step===10?'Ver mi feed <span aria-hidden="true">→</span>':'Continuar <span aria-hidden="true">→</span>';updateOnboardingContinue();if(step===2)setTimeout(()=>document.querySelector('#onboardingZoneSearch').focus(),80)}
function setOnboardingBudget(min,max,changed){min=Math.max(ONBOARDING_BUDGET_FLOOR,Math.min(ONBOARDING_BUDGET_CEILING-ONBOARDING_BUDGET_STEP,Math.round(min/ONBOARDING_BUDGET_STEP)*ONBOARDING_BUDGET_STEP));max=Math.max(ONBOARDING_BUDGET_FLOOR+ONBOARDING_BUDGET_STEP,Math.min(ONBOARDING_BUDGET_CEILING,Math.round(max/ONBOARDING_BUDGET_STEP)*ONBOARDING_BUDGET_STEP));if(max-min<ONBOARDING_BUDGET_STEP){if(changed==='min')min=max-ONBOARDING_BUDGET_STEP;else max=min+ONBOARDING_BUDGET_STEP}onboardingBudgetMin.value=min;onboardingBudgetMax.value=max;onboardingBudgetMinRange.value=min;onboardingBudgetMaxRange.value=max;const span=ONBOARDING_BUDGET_CEILING-ONBOARDING_BUDGET_FLOOR;onboardingBudgetRange.style.setProperty('--budget-start',`${((min-ONBOARDING_BUDGET_FLOOR)/span)*100}%`);onboardingBudgetRange.style.setProperty('--budget-end',`${((max-ONBOARDING_BUDGET_FLOOR)/span)*100}%`)}
onboardingBudgetMin.addEventListener('change',()=>setOnboardingBudget(Number(onboardingBudgetMin.value)||600,Number(onboardingBudgetMax.value),'min'));
onboardingBudgetMax.addEventListener('change',()=>setOnboardingBudget(Number(onboardingBudgetMin.value),Number(onboardingBudgetMax.value)||1000,'max'));
onboardingBudgetMinRange.addEventListener('input',()=>setOnboardingBudget(Number(onboardingBudgetMinRange.value),Number(onboardingBudgetMaxRange.value),'min'));
onboardingBudgetMaxRange.addEventListener('input',()=>setOnboardingBudget(Number(onboardingBudgetMinRange.value),Number(onboardingBudgetMaxRange.value),'max'));
document.querySelector('#budgetOver4000').addEventListener('click',event=>{const button=event.currentTarget,active=button.getAttribute('aria-pressed')!=='true';button.setAttribute('aria-pressed',String(active));if(active){savedBudgetMax=Number(onboardingBudgetMax.value);setOnboardingBudget(Number(onboardingBudgetMin.value),4000,'max')}onboardingBudgetMax.disabled=active;onboardingBudgetMaxRange.disabled=active;document.querySelector('#onboardingBudgetMaxSuffix').textContent=active?'€+':'€';if(!active)setOnboardingBudget(Number(onboardingBudgetMin.value),savedBudgetMax,'max')});
document.querySelector('#flexibleDate').addEventListener('click',event=>{const button=event.currentTarget;button.setAttribute('aria-pressed',String(button.getAttribute('aria-pressed')!=='true'))});
document.querySelectorAll('[data-duration]').forEach(option=>option.addEventListener('click',()=>{durationChoice=option.dataset.duration;document.querySelectorAll('[data-duration]').forEach(button=>button.setAttribute('aria-pressed',String(button===option)));updateOnboardingContinue()}));
document.querySelector('#onboardingMoveDate').addEventListener('change',updateOnboardingContinue);
document.querySelector('#livingCategories').addEventListener('click',event=>{const header=event.target.closest('[data-living-header]'),choice=event.target.closest('[data-living-choice]'),weight=event.target.closest('[data-living-weight]');if(header){activeLivingCategory=Number(header.dataset.livingHeader);renderLivingCategories();return}if(choice){const [category,option]=choice.dataset.livingChoice.split(':').map(Number);livingPreferences.set(category,option);renderLivingCategories();return}if(weight){const [category,option]=weight.dataset.livingWeight.split(':').map(Number);livingWeights.set(category,option);renderLivingCategories()}});
document.querySelector('#profileName').addEventListener('input',updateOnboardingContinue);
document.querySelector('#profilePhotoInput').addEventListener('change',event=>{const file=event.target.files&&event.target.files[0];if(!file)return;const reader=new FileReader();reader.addEventListener('load',()=>{const image=document.querySelector('#profilePhotoImage');image.src=reader.result;image.hidden=false;document.querySelector('#profilePhotoPlus').hidden=true;document.querySelector('#profilePhotoText').textContent='Cambiar foto'});reader.readAsDataURL(file)});
document.querySelectorAll('[data-privacy-level]').forEach(option=>option.addEventListener('click',()=>{
  document.querySelectorAll('[data-privacy-level]').forEach(button=>{
    button.setAttribute('aria-checked',String(button===option));
  });

  const presets={
    public:{
      habits:true,
      searching:true,
      posts:true,
      communities:true
    },
    balanced:{
      habits:true,
      searching:true,
      posts:true,
      communities:false
    },
    private:{
      habits:false,
      searching:false,
      posts:false,
      communities:false
    }
  };

  const preset=presets[option.dataset.privacyLevel];
  if(!preset)return;

  document.querySelectorAll('[data-privacy-control]').forEach(control=>{
    control.setAttribute(
      'aria-checked',
      String(Boolean(preset[control.dataset.privacyControl]))
    );
  });
}));
document.querySelectorAll('[data-privacy-control]').forEach(control=>control.addEventListener('click',()=>control.setAttribute('aria-checked',String(control.getAttribute('aria-checked')!=='true'))));
document.querySelector('#onboardingZoneSearch').addEventListener('input',event=>renderOnboardingZones(event.target.value));
onboardingBack.addEventListener('click',()=>showOnboardingStep(onboardingStep-1));
document.querySelector('#onboardingLater').addEventListener('click',()=>showOnboardingStep(10));
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
onboardingContinue.addEventListener('click',()=>{if(onboardingStep<10){showOnboardingStep(onboardingStep+1);return}openPersonalizedFeed()});
renderOnboardingZones();
renderLivingCategories();
setOnboardingBudget(600,1000);
function open(el){el.classList.add('open');el.setAttribute('aria-hidden','false');document.body.style.overflow='hidden'}function closeAll(){document.querySelectorAll('.modal').forEach(m=>{m.classList.remove('open');m.setAttribute('aria-hidden','true')});document.body.style.overflow=''}function ping(text){toast.textContent=text;toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),2200)}
const feed=document.querySelector('#personalFeed'),feedMain=document.querySelector('.feed-main'),publishModal=document.querySelector('#publishModal'),publishFlowModal=document.querySelector('#publishFlowModal'),exploreView=document.querySelector('#exploreView'),communitiesView=document.querySelector('#communitiesView'),householdView=document.querySelector('#householdView'),communityView=document.querySelector('#communityView'),ownProfileView=document.querySelector('#ownProfileView'),savedView=document.querySelector('#savedView'),settingsView=document.querySelector('#settingsView'),trustView=document.querySelector('#trustView'),exploreFilterModal=document.querySelector('#exploreFilterModal'),chatInboxModal=document.querySelector('#chatInboxModal'),conversationModal=document.querySelector('#conversationModal'),notificationsModal=document.querySelector('#notificationsModal'),collectionModal=document.querySelector('#collectionModal');let publishType='',publishStep=0;
const publishFlows={
 room:{label:'OFRECER HABITACIÓN',steps:[
  ()=>`<p class="eyebrow">LO IMPRESCINDIBLE</p><h2>Empecemos por lo básico</h2><p class="flow-intro">Con esto ya podemos empezar a calcular el match.</p><div class="publish-form-grid"><label>Zona<input placeholder="Barrio o zona"></label><label>Precio mensual<div class="input-suffix"><input type="number" placeholder="Precio"><span>€</span></div></label><label>Disponible desde<input type="date" ></label><label>Duración<select><option>6–12 meses</option><option>3–6 meses</option><option>Más de 1 año</option><option>Flexible</option></select></label></div><button class="photo-drop" type="button"><span>＋</span><b>Añadir fotos</b><small>Hasta 10 imágenes · Puedes hacerlo después</small></button>`,
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
function renderPublishFlow(){const flow=publishFlows[publishType],content=document.querySelector('#publishFlowContent'),last=publishStep===flow.steps.length-1;document.querySelector('#publishFlowKind').textContent=flow.label;document.querySelector('#publishProgressBar').style.width=`${((publishStep+1)/flow.steps.length)*100}%`;content.innerHTML=flow.steps[publishStep]();document.querySelector('#publishFlowBack').textContent=publishStep?'←':'×';document.querySelector('#publishFlowContinue').textContent=last?(publishType==='external'?'Compartir →':'Publicar →'):'Continuar →'}
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
