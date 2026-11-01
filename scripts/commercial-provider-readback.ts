/** Read-only compatibility check using existing no-charge TEST orders. No new
 * checkout, consumption, refund, customer mutation or raw provider payload log. */
import {writeFileSync} from 'node:fs';
import {googleLabOAuth} from './google-play-lab-oauth';
import {GoogleCommercialVerifier} from '../src/server/google-commercial-verifier';
const base='https://androidpublisher.googleapis.com/androidpublisher/v3/applications/docked.fantasy/';
async function main(){
 const oauth=googleLabOAuth(),auth=await oauth();
 const get=async(path:string)=>{const r=await fetch(base+path,{headers:{Authorization:`Bearer ${auth}`},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('Read-only provider access unavailable');return r.json();};
 const voided=await get('purchases/voidedpurchases?type=0&maxResults=5');
 const checks:Record<string,unknown>[]=[];
 for(const item of voided.voidedPurchases??[]){
  const token=item.purchaseToken;if(typeof token!=='string')continue;
  const p=await get(`purchases/productsv2/tokens/${encodeURIComponent(token)}`);
  if(p.testPurchaseContext?.fopType!=='TEST')continue;
  const sku=p.productLineItem?.[0]?.productId;if(!['docked_credits_4900_v1','docked_credits_9900_v1'].includes(sku))continue;
  let compatibility=false,state:string|undefined,amount:number|null|undefined;
  try{const r=await new GoogleCommercialVerifier('acceptance',oauth).verify(token,p.obfuscatedExternalAccountId);compatibility=true;state=r.state;amount=r.grossCents;}catch{ /* Report schema compatibility without printing provider data. */ }
  let commercialDenied=false;try{await new GoogleCommercialVerifier('commercial',oauth).verify(token,p.obfuscatedExternalAccountId);}catch{commercialDenied=true;}
  checks.push({product:sku,test:true,acceptanceVerifierCompatible:compatibility,commercialVerifierDenied:commercialDenied,state,grossAudCents:amount,purchaseFields:Object.keys(p).sort(),offerFields:Object.keys(p.productLineItem?.[0]?.productOfferDetails??{}).sort()});
 }
 const evidence={at:new Date().toISOString(),mutations:0,newPurchases:0,realSettlement:false,checks};
 writeFileSync('docs/qa/commercial-billing-20261101/provider-readback.json',JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify(evidence));
 if(!checks.length||checks.some(c=>!c.acceptanceVerifierCompatible||!c.commercialVerifierDenied))process.exitCode=1;
}
main().catch(()=>{console.error('Read-only provider compatibility check failed; no secrets logged');process.exitCode=1;});
