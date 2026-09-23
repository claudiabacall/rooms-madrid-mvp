const listings=[
 {id:1,zone:'Chamberí',street:'Calle de Ponzano',title:'Habitación luminosa con balcón',kind:'Habitación',price:850,match:92,availableFrom:'2026-09-01',rooms:4,baths:2,area:120,furnished:true,img:'assets/images/chamberi-villanueva.jpg',mates:['LA','SO'],tags:['Metro 4 min','Amueblado','Mascotas','Buena luz'],desc:'Piso amplio de techos altos a cinco minutos de Ríos Rosas. Encajáis especialmente bien en horarios, limpieza y forma de convivir.'},
 {id:2,zone:'Malasaña',street:'Corredera Alta',title:'Exterior en piso creativo',price:685,match:93,availableFrom:'2026-09-05',img:'assets/images/arguelles-calle-mayor.jpg',mates:['IN','MA','+1'],tags:['Creativos','LGTBIQ+ friendly','Vida social','Sin mascotas'],desc:'Una casa vivida y bonita en pleno centro. Nos gusta cenar juntos de vez en cuando, pero respetamos mucho el espacio de cada persona.'},
 {id:3,zone:'Retiro',street:'Calle de Narváez',title:'Calma y luz junto al Retiro',kind:'Piso entero',price:1850,match:91,availableFrom:'2026-10-01',rooms:2,baths:1,area:78,furnished:true,img:'assets/images/retiro-piso.jpg',mates:[],tags:['Exterior','Ascensor','Zona tranquila'],desc:'Piso reformado, exterior y muy tranquilo junto al Retiro. Ideal si buscas luz, calma y una vivienda completa para ti.'},
 {id:4,zone:'Lavapiés',street:'Calle de Argumosa',title:'Piso con terraza y mucha vida',kind:'Habitación',price:640,match:89,availableFrom:'2026-09-20',rooms:3,baths:2,area:96,furnished:true,img:'assets/images/lavapies-terraza.jpg',mates:['NO','DI'],tags:['Metro 5 min','Internacional','Terraza'],desc:'Piso desenfadado con una terraza pequeña pero gloriosa. Somos dos personas internacionales que trabajan en cultura y diseño.'},
 {id:5,zone:'Argüelles',street:'Calle de Ferraz',title:'Habitación grande, casa serena',price:830,match:87,availableFrom:'2026-11-01',img:'assets/images/arguelles-calle-mayor.jpg',mates:['CL','JU'],tags:['Madrugadores','Lectura','Limpieza','No mascotas'],desc:'Buscamos una tercera persona para una casa tranquila y muy cuidada. La habitación tiene armario empotrado y mesa de trabajo.'},
 {id:6,zone:'Malasaña',street:'Calle del Barco',title:'Balcón sobre el centro',price:760,match:84,availableFrom:'2026-09-15',img:'assets/images/chamberi-villanueva.jpg',mates:['AL','BE'],tags:['Afterwork','Diseño','Pet friendly','Flexible'],desc:'Un piso clásico madrileño con balcón y mucha luz. Buen equilibrio entre planes compartidos y vida independiente.'}
];
const propertyImages=['assets/images/chamberi-villanueva.jpg','assets/images/arguelles-calle-mayor.jpg','assets/images/arguelles-calle-mayor.jpg','assets/images/retiro-piso.jpg'];
const modal=document.querySelector('#detailModal'),toast=document.querySelector('#toast');
const onboarding=document.querySelector('#onboarding'),onboardingContinue=document.querySelector('#onboardingContinue'),onboardingBack=document.querySelector('#onboardingBack'),searchTypes=new Set(),preferredZones=new Set();let onboardingStep=1;
const onboardingBudgetMin=document.querySelector('#onboardingBudgetMin'),onboardingBudgetMax=document.querySelector('#onboardingBudgetMax'),onboardingBudgetMinRange=document.querySelector('#onboardingBudgetMinRange'),onboardingBudgetMaxRange=document.querySelector('#onboardingBudgetMaxRange'),onboardingBudgetRange=document.querySelector('#onboardingBudgetRange');
const ONBOARDING_BUDGET_FLOOR=300,ONBOARDING_BUDGET_CEILING=4000,ONBOARDING_BUDGET_STEP=50;let savedBudgetMax=1000,durationChoice='',activeLivingCategory=0,lightVerificationComplete=false;
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
function showOnboardingStep(step){onboardingStep=step;document.querySelectorAll('.onboarding-step').forEach((panel,index)=>panel.hidden=index!==step-1);document.querySelector('.onboarding-progress').setAttribute('aria-label',`Paso ${step} de 10`);document.querySelector('.progress-copy').innerHTML=`${step} <i>/ 10</i>`;document.querySelector('.progress-track span').style.width=`${step*10}%`;onboardingBack.hidden=step===1;document.querySelector('#onboardingTagline').hidden=step>1;document.querySelector('#onboardingLater').hidden=step!==9;onboardingContinue.innerHTML=step===9?(lightVerificationComplete?'Continuar <span aria-hidden="true">→</span>':'Verificar ahora <span aria-hidden="true">✓</span>'):step===10?'Ver mi feed <span aria-hidden="true">→</span>':'Continuar <span aria-hidden="true">→</span>';updateOnboardingContinue();if(step===2)setTimeout(()=>document.querySelector('#onboardingZoneSearch').focus(),80)}
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
document.querySelectorAll('[data-privacy-level]').forEach(option=>option.addEventListener('click',()=>document.querySelectorAll('[data-privacy-level]').forEach(button=>button.setAttribute('aria-checked',String(button===option)))));
document.querySelectorAll('[data-privacy-control]').forEach(control=>control.addEventListener('click',()=>control.setAttribute('aria-checked',String(control.getAttribute('aria-checked')!=='true'))));
document.querySelector('#onboardingZoneSearch').addEventListener('input',event=>renderOnboardingZones(event.target.value));
onboardingBack.addEventListener('click',()=>showOnboardingStep(onboardingStep-1));
document.querySelector('#onboardingLater').addEventListener('click',()=>showOnboardingStep(10));
function completeLightVerification(){lightVerificationComplete=true;['phone','photo'].forEach(name=>{const item=document.querySelector(`[data-verification="${name}"]`);item.classList.add('verified');item.querySelector('.verification-icon').textContent='✓';item.querySelector('em').textContent='LISTO'});document.querySelector('#verifiedProfile').hidden=false;onboardingContinue.innerHTML='Continuar <span aria-hidden="true">→</span>'}
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
onboardingContinue.addEventListener('click',()=>{if(onboardingStep===9&&!lightVerificationComplete){completeLightVerification();return}if(onboardingStep<10){showOnboardingStep(onboardingStep+1);return}openPersonalizedFeed()});
renderOnboardingZones();
renderLivingCategories();
setOnboardingBudget(600,1000);
const shortDate=value=>new Intl.DateTimeFormat('es-ES',{day:'numeric',month:'short',timeZone:'UTC'}).format(new Date(`${value}T00:00:00Z`));
function showDetail(x){document.querySelector('#detailContent').innerHTML=`
  <div class="detail-gallery" data-carousel data-index="0">
    <div class="detail-gallery-track">${propertyImages.map((image,index)=>`<img ${index===0?'class="active"':''} data-carousel-slide src="${image}" alt="${['Salón luminoso','Dormitorio amueblado','Zona común','Detalle de la habitación'][index]}">`).join('')}</div>
    <div class="detail-gallery-actions"><button type="button" data-detail-save aria-label="Guardar vivienda">♡</button><button type="button" data-toast="Enlace copiado" aria-label="Compartir vivienda">↗</button><button type="button" data-report="anuncio de ${x.zone}" aria-label="Reportar anuncio">!</button></div>
    <button class="carousel-arrow previous" type="button" data-carousel-prev aria-label="Foto anterior">‹</button><button class="carousel-arrow next" type="button" data-carousel-next aria-label="Foto siguiente">›</button>
    <div class="carousel-dots" aria-label="Imagen 1 de 4">${propertyImages.map((_,index)=>`<i class="${index===0?'active':''}"></i>`).join('')}</div>
  </div>
  <div class="housing-detail-content">
    <section class="detail-main-block"><div><p><b>${x.price} €</b> / mes</p><h2>${x.zone} · ${x.kind||'Habitación'}</h2></div><div class="detail-match"><b>${x.match}%</b><span>MATCH</span><small>MUY FIABLE</small></div></section>
    <div class="detail-key-facts"><span><small>Disponible</small><b>${shortDate(x.availableFrom)}</b></span><span><small>Habitaciones</small><b>${x.rooms||4} hab</b></span><span><small>Baños</small><b>${x.baths||2} baños</b></span><span><small>Superficie</small><b>${x.area||120} m²</b></span><span><small>Estado</small><b>${x.furnished===false?'Sin amueblar':'Amueblado'}</b></span></div>
    <section class="detail-section match-reasons"><div class="detail-section-title"><h3>Por qué encaja contigo</h3><strong>${x.match}% MATCH</strong></div><ul><li class="positive">Zona compatible</li><li class="positive">Precio compatible</li><li class="positive">Fecha de entrada compatible</li><li class="positive">${x.tags[0]}</li><li class="caution">Hay una preferencia secundaria que no coincide del todo</li></ul></section>
    ${x.mates.length?`<section class="detail-section"><div class="detail-section-title"><h3>Quién vive aquí</h3><strong>89% CON EL HOGAR</strong></div><div class="resident-cards"><article><span>M</span><div><b>Marta, 25 <i>✓</i></b><small>91% contigo</small></div></article><article><span>L</span><div><b>Lucía, 24 <i>✓</i></b><small>87% contigo</small></div></article></div></section>`:''}
    <section class="detail-section house-rules"><h3>Normas del hogar</h3><div><span>No fumar</span><span>Visitas con aviso</span><span>Limpieza compartida</span><span class="extra-rule" hidden>Sin fiestas entre semana</span></div><button type="button" data-rule-toggle>Ver todas</button></section>
    <section class="detail-section"><h3>Sobre la vivienda</h3><p>${x.desc} El salón es amplio y exterior, la cocina está totalmente equipada y la habitación cuenta con armario y espacio de trabajo.</p></section>
    <section class="detail-section neighborhood"><h3>El barrio</h3><div class="mini-map" aria-label="Zona aproximada en ${x.zone}"><i></i><b>Zona aproximada</b></div><div class="nearby"><span><b>Metro</b>4 min</span><span><b>Supermercado</b>3 min</span><span><b>Gym</b>7 min</span><span><b>Universidad</b>11 min</span></div></section>
    <section class="detail-section"><h3>Lo que dice la comunidad</h3><div class="community-quotes"><blockquote>“Zona tranquila entre semana”</blockquote><blockquote>“Muy bien conectada”</blockquote><blockquote>“Bastante vida los fines de semana”</blockquote></div></section>
    <section class="detail-section advertiser"><div class="advertiser-avatar">Á</div><div><small>ANUNCIANTE</small><b>Álvaro Martín <i>✓</i></b><span>4,9 · 18 valoraciones</span></div><button type="button" data-toast="Abriendo el perfil de Álvaro">Ver perfil</button></section>
  </div>
  <div class="detail-fixed-cta"><button type="button" data-toast="Solicitud enviada a Álvaro">Me interesa</button><small>El anunciante recibirá una solicitud</small></div>`;open(modal)}
function open(el){el.classList.add('open');el.setAttribute('aria-hidden','false');document.body.style.overflow='hidden'}function closeAll(){document.querySelectorAll('.modal').forEach(m=>{m.classList.remove('open');m.setAttribute('aria-hidden','true')});document.body.style.overflow=''}function ping(text){toast.textContent=text;toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),2200)}
const feed=document.querySelector('#personalFeed'),feedMain=document.querySelector('.feed-main'),publishModal=document.querySelector('#publishModal'),publishFlowModal=document.querySelector('#publishFlowModal'),feedFilterModal=document.querySelector('#feedFilterModal'),userProfileModal=document.querySelector('#userProfileModal'),matchModal=document.querySelector('#matchModal'),exploreView=document.querySelector('#exploreView'),communitiesView=document.querySelector('#communitiesView'),householdView=document.querySelector('#householdView'),communityView=document.querySelector('#communityView'),ownProfileView=document.querySelector('#ownProfileView'),savedView=document.querySelector('#savedView'),settingsView=document.querySelector('#settingsView'),trustView=document.querySelector('#trustView'),exploreFilterModal=document.querySelector('#exploreFilterModal'),chatInboxModal=document.querySelector('#chatInboxModal'),conversationModal=document.querySelector('#conversationModal'),notificationsModal=document.querySelector('#notificationsModal'),adminModerationModal=document.querySelector('#adminModerationModal'),reportModal=document.querySelector('#reportModal'),blockModal=document.querySelector('#blockModal'),externalInfoModal=document.querySelector('#externalInfoModal'),collectionModal=document.querySelector('#collectionModal');let personConnected=false,communityJoined=false,publishType='',publishStep=0;
const publishFlows={
 room:{label:'OFRECER HABITACIÓN',steps:[
  ()=>`<p class="eyebrow">LO IMPRESCINDIBLE</p><h2>Empecemos por lo básico</h2><p class="flow-intro">Con esto ya podemos empezar a calcular el match.</p><div class="publish-form-grid"><label>Zona<input value="Chamberí" placeholder="Barrio o zona"></label><label>Precio mensual<div class="input-suffix"><input type="number" value="850"><span>€</span></div></label><label>Disponible desde<input type="date" value="2026-09-15"></label><label>Duración<select><option>6–12 meses</option><option>3–6 meses</option><option>Más de 1 año</option><option>Flexible</option></select></label></div><button class="photo-drop" type="button" data-toast="Selector de fotos abierto"><span>＋</span><b>Añadir fotos</b><small>Hasta 10 imágenes · Puedes hacerlo después</small></button>`,
  ()=>`<p class="eyebrow">LA VIVIENDA</p><h2>¿Cómo es el piso?</h2><p class="flow-intro">Añade lo que sepas. Nada de esto bloquea la publicación.</p><div class="publish-form-grid thirds"><label>Habitaciones<input type="number" value="4"></label><label>Baños<input type="number" value="2"></label><label>Superficie<div class="input-suffix"><input type="number" value="120"><span>m²</span></div></label></div><div class="selectable-grid"><button type="button" data-selectable aria-pressed="true">Amueblado</button><button type="button" data-selectable aria-pressed="true">Exterior</button><button type="button" data-selectable aria-pressed="true">Ascensor</button><button type="button" data-selectable aria-pressed="true">Mascotas</button><button type="button" data-selectable aria-pressed="false">Gastos incluidos</button><button type="button" data-selectable aria-pressed="false">Baño privado</button></div>`,
  ()=>`<p class="eyebrow">EL HOGAR</p><h2>¿Con quién va a convivir?</h2><p class="flow-intro">Esta parte hace que Rooms encuentre a la persona adecuada, no solo a alguien que pague.</p><div class="linked-people"><article><span>M</span><div><b>Marta, 25 ✓</b><small>Perfil vinculado</small></div><button type="button" aria-label="Eliminar">×</button></article><article><span>L</span><div><b>Lucía, 24 ✓</b><small>Perfil vinculado</small></div><button type="button" aria-label="Eliminar">×</button></article><button type="button" data-toast="Buscando perfiles para vincular">＋ Vincular otra persona</button></div><label class="full-field">Normas de convivencia<textarea placeholder="No fumar, visitas con aviso, limpieza compartida…">No fumar · Visitas con aviso · Limpieza compartida</textarea></label><label class="full-field">Ambiente del hogar<select><option>Tranquilo, con algún plan juntos</option><option>Muy independiente</option><option>Social y activo</option><option>Flexible</option></select></label>`,
  ()=>`<div class="completion-card"><strong>72%</strong><div><b>Tu anuncio ya puede publicarse</b><span>Completa 3 datos para mejorar la precisión del match.</span></div></div><p class="eyebrow">ÚLTIMO PASO</p><h2>Cuéntalo a tu manera</h2><label class="full-field">Descripción<textarea rows="5">Habitación luminosa en un piso amplio de Chamberí. Buscamos a alguien tranquilo, limpio y con ganas de hacer algún plan en casa.</textarea></label><article class="publish-preview"><span>92% MATCH ESTIMADO</span><h3>850 €/mes · Chamberí</h3><p>Habitación · Disponible 15 sep</p><div><i>Amueblado</i><i>Exterior</i><i>Mascotas</i></div></article>`
 ]},
 flat:{label:'PUBLICAR PISO',steps:[
  ()=>`<p class="eyebrow">LO IMPRESCINDIBLE</p><h2>Publica tu piso en minutos</h2><p class="flow-intro">Solo necesitamos estos datos para crear la primera versión.</p><div class="publish-form-grid"><label>Zona<input value="Retiro"></label><label>Precio mensual<div class="input-suffix"><input type="number" value="1850"><span>€</span></div></label><label>Disponible desde<input type="date" value="2026-10-01"></label><label>Duración<select><option>Más de 1 año</option><option>6–12 meses</option><option>Flexible</option></select></label></div><button class="photo-drop" type="button" data-toast="Selector de fotos abierto"><span>＋</span><b>Añadir fotos del piso</b><small>Puedes reordenarlas más adelante</small></button>`,
  ()=>`<p class="eyebrow">CARACTERÍSTICAS</p><h2>Completa lo que sepas</h2><div class="publish-form-grid thirds"><label>Habitaciones<input type="number" value="2"></label><label>Baños<input type="number" value="1"></label><label>Superficie<div class="input-suffix"><input type="number" value="78"><span>m²</span></div></label></div><div class="selectable-grid"><button type="button" data-selectable aria-pressed="true">Amueblado</button><button type="button" data-selectable aria-pressed="true">Exterior</button><button type="button" data-selectable aria-pressed="true">Ascensor</button><button type="button" data-selectable aria-pressed="false">Mascotas</button><button type="button" data-selectable aria-pressed="false">Gastos incluidos</button><button type="button" data-selectable aria-pressed="false">Aire acondicionado</button></div>`,
  ()=>`<div class="completion-card"><strong>78%</strong><div><b>El anuncio está listo</b><span>Puedes publicarlo ahora o seguir completándolo después.</span></div></div><p class="eyebrow">VISTA PREVIA</p><h2>Así aparecerá en Rooms</h2><label class="full-field">Descripción<textarea rows="5">Piso reformado, exterior y muy tranquilo junto al Retiro. Ideal para una estancia larga.</textarea></label><article class="publish-preview"><span>91% MATCH ESTIMADO</span><h3>1.850 €/mes · Retiro</h3><p>Piso entero · Disponible 1 oct</p><div><i>Exterior</i><i>Ascensor</i><i>Amueblado</i></div></article>`
 ]},
 mate:{label:'BUSCAR COMPAÑERO',steps:[
  ()=>`<p class="eyebrow">ROOMS YA TE CONOCE</p><h2>Confirma qué buscas ahora</h2><p class="flow-intro">Hemos rellenado tus datos desde el onboarding. Solo cambia lo necesario.</p><div class="publish-form-grid"><label>Zonas<input value="Chamberí, Moncloa"></label><label>Presupuesto<div class="input-suffix"><input value="700–950"><span>€</span></div></label><label>Fecha<input type="date" value="2026-09-15"></label><label>Duración<select><option>Más de 1 año</option><option>6–12 meses</option><option>Flexible</option></select></label></div><div class="flow-choice"><span>¿Buscas solo o desde un Hogar?</span><button type="button" data-selectable aria-pressed="true">Por mi cuenta</button><button type="button" data-selectable aria-pressed="false">Desde Buscar piso con Marta</button></div>`,
  ()=>`<div class="completion-card"><strong>91%</strong><div><b>Card social generada</b><span>Usamos tu perfil y tus preferencias actuales.</span></div></div><p class="eyebrow">VISTA PREVIA</p><h2>Tu búsqueda ya tiene forma</h2><article class="mate-preview"><span class="preview-avatar">C</span><div><small>VERIFICADA · 91% PERFIL</small><h3>Claudia busca habitación</h3><p>Chamberí o Moncloa · Septiembre · 700–950 €</p><div><i>Ordenada</i><i>No fuma</i><i>Planes tranquilos</i></div></div></article>`
 ]},
 external:{label:'COMPARTIR UN PISO',steps:[
  ()=>`<p class="eyebrow">FUENTE EXTERNA</p><h2>Pega el enlace del piso</h2><p class="flow-intro">Rooms intentará importar fotos, precio, zona y características. Tú podrás corregirlo todo.</p><label class="external-url"><span>↗</span><input type="url" placeholder="https://…" value="https://idealista.com/inmueble/ponzano"></label><aside class="import-note">Solo utilizaremos la información pública del anuncio. Nunca inventaremos lo que falte.</aside>`,
  ()=>`<div class="completion-card"><strong>84%</strong><div><b>Esto es lo que hemos podido obtener</b><span>Revisa y corrige antes de compartir.</span></div></div><p class="eyebrow">VISTA PREVIA</p><h2>Comprueba que esté bien</h2><article class="imported-listing"><div class="import-image"><span>3 FOTOS</span></div><div><span>FUENTE EXTERNA</span><h3>850 €/mes · Chamberí</h3><p>Habitación · Disponible septiembre</p><div><i>Amueblado</i><i>Exterior</i><i>Metro 4 min</i></div></div></article><div class="import-confidence"><p><b>79% match con la vivienda</b><span>Calculado solo con datos confirmados.</span></p><p><b>Compatibilidad con el hogar no disponible</b><span>La fuente no informa de quién vive allí.</span></p></div><button class="secondary-wide" type="button" data-toast="Datos listos para editar">Corregir o completar datos</button>`,
  ()=>`<p class="eyebrow">TRAZABILIDAD</p><h2>Listo para compartir</h2><p class="flow-intro">La ficha mostrará siempre qué viene del anuncio original y qué aporta después la comunidad.</p><div class="external-publish-summary"><span>✓ Fuente externa visible</span><span>✓ Datos sin completar automáticamente</span><span>✓ Caducidad y disponibilidad activas</span><span>✓ Menor prioridad que un anuncio nativo</span></div><aside class="monetization-rule"><b>Regla Rooms</b><p>Una promoción puede aumentar el alcance, pero nunca mejora la confianza ni permite saltarse filtros imprescindibles.</p></aside>`
 ]},
 post:{label:'CREAR PUBLICACIÓN',steps:[
  ()=>`<p class="eyebrow">COMUNIDAD ROOMS</p><h2>¿Qué quieres compartir?</h2><div class="selectable-grid post-types"><button type="button" data-selectable aria-pressed="true">Pregunta</button><button type="button" data-selectable aria-pressed="false">Recomendación</button><button type="button" data-selectable aria-pressed="false">Barrio</button><button type="button" data-selectable aria-pressed="false">Aviso</button><button type="button" data-selectable aria-pressed="false">Experiencia</button><button type="button" data-selectable aria-pressed="false">Vivienda</button></div><label class="full-field">Tu publicación<textarea rows="6" placeholder="¿Qué quieres contar?">¿Alguien sabe qué tal se vive por Guzmán el Bueno?</textarea></label><button class="secondary-wide" type="button" data-toast="Puedes añadir una vivienda desde Explore">＋ Añadir vivienda o foto</button>`,
  ()=>`<p class="eyebrow">VISTA PREVIA</p><h2>Lista para publicar</h2><article class="post-preview"><header><span>C</span><div><b>Claudia ✓</b><small>Ahora · Pregunta</small></div></header><p>¿Alguien sabe qué tal se vive por Guzmán el Bueno?</p><div><span>○ Comentar</span><span>♡ Guardar</span><span>↗ Compartir</span></div></article><p class="publish-visibility">Visible para la comunidad de Madrid · Puedes cambiarlo desde Privacidad.</p>`
 ]}
};
function renderPublishFlow(){const flow=publishFlows[publishType],content=document.querySelector('#publishFlowContent'),last=publishStep===flow.steps.length-1;document.querySelector('#publishFlowKind').textContent=flow.label;document.querySelector('#publishProgressBar').style.width=`${((publishStep+1)/flow.steps.length)*100}%`;content.innerHTML=flow.steps[publishStep]();document.querySelector('#publishFlowBack').textContent=publishStep?'←':'×';document.querySelector('#publishFlowContinue').textContent=last?(publishType==='external'?'Compartir →':'Publicar →'):'Continuar →'}
function openPublishFlow(type){publishType=type;publishStep=0;publishModal.classList.remove('open');publishModal.setAttribute('aria-hidden','true');renderPublishFlow();open(publishFlowModal)}
function advanceCarousel(carousel,direction){const slides=[...carousel.querySelectorAll('[data-carousel-slide]')],dots=[...carousel.querySelectorAll('.carousel-dots i')];let index=Number(carousel.dataset.index||0);index=(index+direction+slides.length)%slides.length;carousel.dataset.index=index;slides.forEach((slide,i)=>slide.classList.toggle('active',i===index));dots.forEach((dot,i)=>dot.classList.toggle('active',i===index));carousel.querySelector('.carousel-dots').setAttribute('aria-label',`Imagen ${index+1} de ${slides.length}`)}
document.querySelectorAll('[data-feed-filter]').forEach(button=>button.addEventListener('click',()=>{const filter=button.dataset.feedFilter;document.querySelectorAll('[data-feed-filter]').forEach(item=>item.classList.toggle('active',item===button));document.querySelectorAll('[data-feed-type]').forEach(item=>item.hidden=filter!=='all'&&item.dataset.feedType!==filter);ping(filter==='all'?'Mostrando todo':`Feed: ${button.textContent}`)}));
document.querySelector('#feedFilters').addEventListener('click',()=>open(feedFilterModal));
document.querySelectorAll('.feed-modal-options button').forEach(button=>button.addEventListener('click',()=>button.setAttribute('aria-pressed',String(button.getAttribute('aria-pressed')!=='true'))));
document.querySelector('#mobilePublish').addEventListener('click',()=>open(publishModal));
document.querySelectorAll('[data-publish-type]').forEach(button=>button.addEventListener('click',()=>openPublishFlow(button.dataset.publishType)));
document.querySelector('#publishFlowBack').addEventListener('click',()=>{if(publishStep){publishStep--;renderPublishFlow();return}publishFlowModal.classList.remove('open');publishFlowModal.setAttribute('aria-hidden','true');open(publishModal)});
document.querySelector('#publishFlowContinue').addEventListener('click',()=>{const flow=publishFlows[publishType];if(publishStep<flow.steps.length-1){publishStep++;renderPublishFlow();return}closeAll();ping(publishType==='external'?'Piso compartido con tu Hogar':publishType==='post'?'Publicación creada':'Publicado en Rooms')});
document.querySelector('#savePublishDraft').addEventListener('click',()=>{closeAll();ping('Borrador guardado · Puedes continuar después')});
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
document.querySelectorAll('[data-bottom-nav]').forEach(button=>button.addEventListener('click',()=>{const view=button.dataset.bottomNav;if(['home','explore','communities','profile'].includes(view)){showMainView(view);return}ping(`${button.textContent.trim()} estará disponible muy pronto`)}));
document.querySelector('#openChats').addEventListener('click',()=>open(chatInboxModal));
document.querySelector('#openNotifications').addEventListener('click',()=>open(notificationsModal));
document.querySelectorAll('[data-chat-filter]').forEach(button=>button.addEventListener('click',()=>{const filter=button.dataset.chatFilter;document.querySelectorAll('[data-chat-filter]').forEach(item=>item.classList.toggle('active',item===button));document.querySelectorAll('[data-chat-type]').forEach(item=>item.hidden=filter!=='all'&&item.dataset.chatType!==filter)}));
document.querySelector('#conversationBack').addEventListener('click',()=>{conversationModal.classList.remove('open');conversationModal.setAttribute('aria-hidden','true');open(chatInboxModal)});



document.querySelector('#conversationBody').addEventListener('click',event=>{const listing=event.target.closest('[data-listing-id]');if(!listing)return;conversationModal.classList.remove('open');conversationModal.setAttribute('aria-hidden','true');showDetail(listings.find(item=>item.id===Number(listing.dataset.listingId)))});
document.querySelector('#notificationSettings').addEventListener('click',()=>{const preferences=document.querySelector('#notificationPreferences');preferences.hidden=!preferences.hidden;preferences.scrollIntoView({behavior:'smooth',block:'start'})});
document.querySelector('#openOwnProfile').addEventListener('click',()=>{closeAll();showMainView('profile')});
document.querySelectorAll('[data-back-profile]').forEach(button=>button.addEventListener('click',()=>showMainView('profile')));
document.querySelectorAll('[data-open-saved]').forEach(button=>button.addEventListener('click',()=>showMainView('saved')));
document.querySelectorAll('[data-open-settings]').forEach(button=>button.addEventListener('click',()=>showMainView('settings')));
document.querySelectorAll('[data-open-trust]').forEach(button=>button.addEventListener('click',()=>showMainView('trust')));

document.querySelectorAll('[data-saved-filter]').forEach(button=>button.addEventListener('click',()=>{const filter=button.dataset.savedFilter;document.querySelectorAll('[data-saved-filter]').forEach(item=>item.classList.toggle('active',item===button));document.querySelectorAll('[data-saved-type]').forEach(card=>card.hidden=filter!=='all'&&card.dataset.savedType!==filter);const count=Number(button.querySelector('i')?.textContent||0);document.querySelector('#savedResultsTitle').textContent=`${count} ${count===1?'elemento':'elementos'}`}));

document.querySelector('#createCollection').addEventListener('click',()=>open(collectionModal));
document.querySelectorAll('[data-collection-visibility]').forEach(button=>button.addEventListener('click',()=>document.querySelectorAll('[data-collection-visibility]').forEach(item=>item.classList.toggle('active',item===button))));
document.querySelector('#saveCollection').addEventListener('click',async()=>{
  const name=document.querySelector('#collectionName').value.trim();
  const visibility=document.querySelector('[data-collection-visibility].active')?.textContent.trim()==='Compartida'?'shared':'private';

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
document.querySelectorAll('[data-privacy-row]').forEach(row=>row.querySelectorAll('button').forEach(button=>button.addEventListener('click',()=>row.querySelectorAll('button').forEach(item=>item.classList.toggle('active',item===button)))));
document.querySelectorAll('.settings-choice').forEach(group=>group.querySelectorAll('button').forEach(button=>button.addEventListener('click',()=>group.querySelectorAll('button').forEach(item=>item.classList.toggle('active',item===button)))));
feed.addEventListener('click',event=>{const carouselControl=event.target.closest('[data-carousel-prev],[data-carousel-next]');if(!carouselControl)return;event.stopPropagation();advanceCarousel(carouselControl.closest('[data-carousel]'),carouselControl.hasAttribute('data-carousel-next')?1:-1)});

document.querySelector('#exploreFilters').addEventListener('click',()=>open(exploreFilterModal));
document.querySelectorAll('[data-admin-action]').forEach(button=>button.addEventListener('click',()=>{const action=button.dataset.adminAction;if(action==='reports'){openReport('contenido reportado en Vivir en Chamberí');return}const messages={pin:'Publicación fijada',remove:'Contenido eliminado y acción registrada',expel:'Usuario expulsado de la comunidad',requests:'3 solicitudes listas para revisar'};ping(messages[action])}));
document.querySelectorAll('[data-empty-action="filters"]').forEach(button=>button.addEventListener('click',()=>open(exploreFilterModal)));
document.querySelectorAll('[data-empty-action="communities"]').forEach(button=>button.addEventListener('click',()=>showMainView('communities')));
const offlineBanner=document.createElement('div');offlineBanner.className='offline-banner';offlineBanner.hidden=true;offlineBanner.innerHTML='<b>Sin conexión</b><span>Te mostramos el contenido guardado en este dispositivo.</span>';document.body.appendChild(offlineBanner);window.addEventListener('offline',()=>offlineBanner.hidden=false);window.addEventListener('online',()=>{offlineBanner.hidden=true;ping('Conexión recuperada')});
document.addEventListener('click',event=>{const report=event.target.closest('[data-report]'),block=event.target.closest('[data-block-user]'),externalInfo=event.target.closest('[data-external-info]');if(report){event.preventDefault();event.stopPropagation();openReport(report.dataset.report);return}if(block){event.preventDefault();event.stopPropagation();open(blockModal);return}if(externalInfo){event.preventDefault();event.stopPropagation();open(externalInfoModal)}});
document.addEventListener('click',event=>{const detailCarouselControl=event.target.closest('#detailModal [data-carousel-prev],#detailModal [data-carousel-next]'),detailSave=event.target.closest('[data-detail-save]'),ruleToggle=event.target.closest('[data-rule-toggle]'),toastTarget=event.target.closest('[data-toast]');if(detailCarouselControl){advanceCarousel(detailCarouselControl.closest('[data-carousel]'),detailCarouselControl.hasAttribute('data-carousel-next')?1:-1);return}if(detailSave){detailSave.classList.toggle('saved');detailSave.textContent=detailSave.classList.contains('saved')?'♥':'♡';ping(detailSave.classList.contains('saved')?'Guardado en tus favoritos':'Eliminado de favoritos');return}if(ruleToggle){const extra=document.querySelector('.extra-rule'),showing=extra.hidden;extra.hidden=!showing;ruleToggle.textContent=showing?'Ver menos':'Ver todas';return}if(event.target.closest('[data-close]'))closeAll();if(toastTarget){ping(toastTarget.dataset.toast);if(toastTarget.closest('#publishModal,#feedFilterModal,.detail-fixed-cta'))closeAll()}});document.addEventListener('keydown',event=>{if(event.key==='Escape')closeAll()});
