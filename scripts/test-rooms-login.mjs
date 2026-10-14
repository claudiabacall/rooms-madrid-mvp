import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
const env = Object.fromEntries((await readFile('.env.rooms-test.local','utf8')).trim().split('\n').map(line => { const i=line.indexOf('='); return [line.slice(0,i),line.slice(i+1)]; }));
const browser = await chromium.launch({headless:true});
const page = await browser.newPage();
const errors=[];
page.on('pageerror', e => errors.push(e.message));
try {
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'load' });
  await page.locator('#authGate').waitFor({state:'visible',timeout:15000});
  await page.locator('#authEmail').fill(env.ROOMS_TEST_EMAIL);
  await page.locator('#authPassword').fill(env.ROOMS_TEST_PASSWORD);
  await page.locator('#authSubmit').click();
  await page.waitForFunction(() => Boolean(window.roomsBackend?.state?.user), null, {timeout:20000}).catch(()=>{});
  await page.waitForTimeout(2500);
  const status=await page.evaluate(() => ({authenticated: Boolean(window.roomsBackend?.state?.user), onboardingVisible: Boolean(document.querySelector('#onboarding') && !document.querySelector('#onboarding').hidden), authGateHidden: Boolean(document.querySelector('#authGate')?.hidden), authMessage: document.querySelector('#authMessage')?.textContent?.trim() || ''}));
  console.log('=== PRUEBA LOGIN SUPABASE ===');
  console.log(JSON.stringify({...status,jsErrors:errors},null,2));
  if (!status.authenticated || !status.authGateHidden || errors.length) process.exitCode=1;
} catch(error){ console.error('FALLO:',error.message); process.exitCode=1; }
finally{ await browser.close(); }
