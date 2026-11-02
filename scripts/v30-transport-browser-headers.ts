import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {isolatedV30Transport} from '../src/server/isolated-v30-transport';
async function main(){
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage();const now=Date.now();
const env={VERCEL_PROJECT_ID:'prj_l0rpVDPRuIRp9UcBUkudeyUK5yST',VERCEL_ENV:'production',SITE_URL:'https://docked.com.au',DOCKED_V30_TRANSPORT:'true',DOCKED_V30_TRANSPORT_UNTIL:new Date(now+3600000).toISOString(),DOCKED_V30_TRANSPORT_KEY:'a'.repeat(64),DOCKED_V30_TRANSPORT_TARGET:'https://docked-preview-fixture-briant-s-projects.vercel.app',DOCKED_V30_TRANSPORT_OIDC:'fixture.'+Buffer.from(JSON.stringify({exp:Math.ceil(now/1000)+7200})).toString('base64url')+'.fixture'};
let accepted=false;
try{
await page.route('https://docked.com.au/**',async route=>{
 const r=route.request();
 if(new URL(r.url()).pathname==='/app/login')return route.fulfill({status:200,body:'TEST login reached'});
 const h=await r.allHeaders();
 if(r.method()==='POST')assert.equal(h.origin,'https://docked.com.au');
 const response=await isolatedV30Transport(new Request(r.url(),{method:r.method(),headers:h,...(r.method()==='POST'?{body:r.postData()!}:{})}),env);
 assert(response);if(r.method()==='POST'){assert.equal(response.status,303);accepted=true;}
 await route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:await response.text()});
});
await page.goto('https://docked.com.au/profile/qa_billing');await page.getByLabel('Operator access code').fill(env.DOCKED_V30_TRANSPORT_KEY);await page.getByRole('button',{name:'Connect to TEST'}).click();await page.waitForURL('**/app/login');assert(accepted);console.log('Real Chromium form navigation preserves Origin and accepts the test-only form; no hosted writes.');
}finally{await browser.close();}
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});

