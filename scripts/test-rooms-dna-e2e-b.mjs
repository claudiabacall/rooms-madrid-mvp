import { readFile, mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const env = Object.fromEntries((await readFile('.env.rooms-test-b.local','utf8')).split(/\r?\n/).filter(s=>s.includes('=')).map(s=>{const i=s.indexOf('=');return [s.slice(0,i),s.slice(i+1)];}));
if (!env.ROOMS_TEST_EMAIL || !env.ROOMS_TEST_PASSWORD) throw new Error('Faltan credenciales QA locales');
const browser = await chromium.launch({headless:true});
const page = await browser.newPage({viewport:{width:1440,height:900}});
const errors=[]; const log=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error') errors.push(m.text());});
const step = n => page.locator(`#onboardingStep${n}`);
async function expectStep(n){await step(n).waitFor({state:'visible',timeout:20000});log.push(`OK Paso ${n} visible`);}
async function next(n){await page.locator('#onboardingContinue').click({timeout:12000});await expectStep(n);}
async function clickChoice(selector){await page.locator(selector).first().click({timeout:10000});}
try {
 await page.goto('http://127.0.0.1:4173/',{waitUntil:'load'});
 await page.locator('#authGate').waitFor({state:'visible',timeout:15000});
 await page.locator('#authEmail').fill(env.ROOMS_TEST_EMAIL);
 await page.locator('#authPassword').fill(env.ROOMS_TEST_PASSWORD);
 await page.locator('#authSubmit').click();
 await page.locator('#authGate').waitFor({state:'hidden',timeout:20000});
 await expectStep(1);
 await next(2);
 const vibeCount=await page.evaluate(()=>window.ROOMS_DNA_V2.interactions.filter(x=>x.act==='vibe'&&x.type==='forced_choice').length);
 for(let i=0;i<vibeCount;i++){
   await page.locator('[data-dna-swipe-choice="left"]').first().waitFor({state:'visible',timeout:10000});
   await clickChoice('[data-dna-swipe-choice="left"]');
   if(i+1<vibeCount) await page.waitForTimeout(340);
 }
 await page.waitForFunction(()=>!document.querySelector('#onboardingContinue').disabled,{timeout:10000});
 log.push(`OK ${vibeCount} decisiones vibe`);
 await next(3);
 const livingCount=await page.evaluate(()=>window.ROOMS_DNA_V2.interactions.filter(x=>x.act==='living'&&x.type==='scenario').length);
 for(let i=0;i<livingCount;i++){
   await page.locator('[data-dna-living-choice="0"]').first().waitFor({state:'visible',timeout:10000});
   await clickChoice('[data-dna-living-choice="0"]');
   if(i+1<livingCount) await page.waitForTimeout(340);
 }
 await page.waitForFunction(()=>!document.querySelector('#onboardingContinue').disabled,{timeout:10000});
 log.push(`OK ${livingCount} decisiones living`);
 await next(4);
 const homeIds=await page.locator('#dnaHomePreferences [data-home-id]').evaluateAll(nodes=>nodes.map(n=>n.dataset.homeId));
 for(const id of homeIds){
   const card = page.locator(
     `#dnaHomePreferences .dna-home-unassigned [data-home-id="${id}"]`
   );

   await card.click();

   const selected = await page.locator(
     `#dnaHomePreferences [data-home-id="${id}"].is-selected`
   ).count();

   log.push(`HOME ${id}: seleccionada=${selected > 0}`);

   if (!selected) {
     throw new Error(`HOME ${id}: la tarjeta no queda seleccionada`);
   }

   await page.locator(
     '#dnaHomePreferences .dna-home-zone[data-home-level] header'
   ).first().click();

   const placed = await page.locator(
     `#dnaHomePreferences .dna-home-zone [data-home-id="${id}"]`
   ).count();

   log.push(`HOME ${id}: colocada=${placed > 0}`);

   if (!placed) {
     throw new Error(`HOME ${id}: no se guardo la prioridad`);
   }
 }
 await page.waitForFunction(()=>!document.querySelector('#onboardingContinue').disabled,{timeout:10000});
 log.push(`OK ${homeIds.length} prioridades hogar`);
 await next(5);
 await clickChoice('#dnaInterests [data-dna-interest]');
 await clickChoice('#dnaTraits [data-dna-trait]');
 await page.waitForFunction(()=>!document.querySelector('#onboardingContinue').disabled,{timeout:10000});
 log.push('OK intereses y rasgos');
 await next(6);
 await page.locator('#profileName').fill('Rooms QA');
 await page.locator('#profileBio').fill('Perfil automático de pruebas de ROOMS.');
 await next(7);
 await next(8);
 await clickChoice('[data-onboarding-intent="find_room"]');
 await page.waitForFunction(()=>!document.querySelector('#onboardingContinue').disabled,{timeout:10000});
 log.push('OK ocho pasos completados');
 await page.locator('#onboardingContinue').click({timeout:15000});
 await page.waitForFunction(()=>document.querySelector('#onboarding')?.hidden || !!window.roomsBackend?.state?.profile?.onboarding_completed,null,{timeout:40000});
 const before=await page.evaluate(()=>({user:!!window.roomsBackend?.state?.user,completed:window.roomsBackend?.state?.profile?.onboarding_completed===true,dna:!!window.roomsBackend?.state?.roomsDna, intents:window.roomsBackend?.state?.userIntents||[]}));
 log.push('GUARDADO '+JSON.stringify(before));
 if(!before.completed || !before.dna) throw new Error('No se confirmó guardado en estado del cliente');
 await page.reload({waitUntil:'load'});
 await page.waitForFunction(()=>window.roomsBackend?.state?.profile?.onboarding_completed===true,null,{timeout:40000});
 const after=await page.evaluate(()=>({authenticated:!!window.roomsBackend?.state?.user,completed:window.roomsBackend?.state?.profile?.onboarding_completed===true,dna:!!window.roomsBackend?.state?.roomsDna,intents:window.roomsBackend?.state?.userIntents||[],gateHidden:!!document.querySelector('#authGate')?.hidden}));
 log.push('RELECTURA '+JSON.stringify(after));
 if(!after.authenticated||!after.completed||!after.dna||!after.gateHidden) throw new Error('La recarga no restauró perfil y DNA');
 if(errors.length) throw new Error('Errores de consola o JS: '+errors.join(' | ').slice(0,600));
 log.push('RESULTADO: ROOMS DNA E2E SUPERADO');
} catch(e){
 log.push('FALLO: '+e.message);
 await mkdir('test-results',{recursive:true});
 await page.screenshot({path:'test-results/rooms-dna-fallo.png',fullPage:true}).catch(()=>{});
 const status=await page.evaluate(()=>({step:document.querySelector('.onboarding-step.active')?.id,message:document.querySelector('#authMessage')?.textContent,toast:document.querySelector('#toast')?.textContent,buttonDisabled:document.querySelector('#onboardingContinue')?.disabled})).catch(()=>({}));
 log.push('ESTADO '+JSON.stringify(status));
 process.exitCode=1;
} finally {
 log.push('ERRORES_JS '+JSON.stringify(errors.slice(0,12)));
 console.log('\n=== ROOMS DNA E2E ===\n'+log.join('\n'));
 await browser.close();
}
