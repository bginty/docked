/** Explicit GET-only account/pricing inspection. Never sends or changes settings. */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const credentials = JSON.parse(readFileSync('C:/Users/61412/.docked-secrets/docked-production-sms-readiness.json','utf8'));
assert.match(credentials.accountSid ?? '', /^AC[0-9a-f]{32}$/i);
assert.match(credentials.messagingServiceSid ?? '', /^MG[0-9a-f]{32}$/i);
assert(/^[0-9a-f]{32}$/i.test(credentials.authToken ?? ''), 'Private token missing or invalid format');
const auth = 'Basic ' + Buffer.from(credentials.accountSid + ':' + credentials.authToken).toString('base64');
async function get(url) {
  const u = new URL(url);
  assert(['api.twilio.com','pricing.twilio.com','messaging.twilio.com'].includes(u.hostname));
  assert.equal(u.protocol,'https:');
  const response = await fetch(u,{method:'GET',redirect:'error',headers:{Authorization:auth},signal:AbortSignal.timeout(20000)});
  if (!response.ok) throw Error('Read-only Twilio request failed with HTTP ' + response.status + ' at ' + u.hostname);
  return response.json();
}
try {
  const [account,price,service,senders,messages] = await Promise.all([
    get(`https://api.twilio.com/2010-04-01/Accounts/${credentials.accountSid}.json`),
    get('https://pricing.twilio.com/v1/Messaging/Countries/AU'),
    get(`https://messaging.twilio.com/v1/Services/${credentials.messagingServiceSid}`),
    get(`https://messaging.twilio.com/v1/Services/${credentials.messagingServiceSid}/AlphaSenders`),
    get(`https://api.twilio.com/2010-04-01/Accounts/${credentials.accountSid}/Messages.json?PageSize=20&DateSent%3E=2026-11-16`),
  ]);
  assert.equal(account.sid,credentials.accountSid);
  assert.equal(service.account_sid,credentials.accountSid);
  assert.equal(service.sid,credentials.messagingServiceSid);
  assert.equal(price.iso_country,'AU');
  const outbound = price.outbound_sms_prices.map(x=>({mcc:x.mcc,mnc:x.mnc,carrier:x.carrier,prices:x.prices.map(p=>({numberType:p.number_type,currentPrice:p.current_price,basePrice:p.base_price}))}));
  const evidence = {at:new Date().toISOString(),methods:['GET'],productionChanges:0,smsSent:0,accountStatus:account.status,accountType:account.type,accountFingerprint:createHash('sha256').update(account.sid).digest('hex'),sameAccountAndService:true,serviceName:service.friendly_name,senderAttached:senders.alpha_senders.some(s=>s.alpha_sender?.toUpperCase()==='DOCKED'),usecase:service.usecase,smartEncoding:service.smart_encoding,validityPeriod:service.validity_period,currency:price.price_unit,country:'AU',outbound,maximumPublishedAccountRate:Math.max(...outbound.flatMap(x=>x.prices.map(p=>Number(p.currentPrice)))),feeCaveat:'Country rate response does not independently itemise carrier, optional feature, tax or FX charges. Do not treat base rate alone as final all-in cost.'};
  evidence.recentDeliveryCharges = messages.messages.filter(m=>m.messaging_service_sid===credentials.messagingServiceSid).map(m=>({status:m.status,segments:Number(m.num_segments),price:m.price,currency:m.price_unit,sentAt:m.date_sent}));
  writeFileSync('docs/qa/public-launch-runtime-20261117/twilio-account-pricing.json',JSON.stringify(evidence,null,2)+'\n');
  console.log(JSON.stringify({...evidence,outboundRows:outbound.length,outbound:undefined}));
} catch (e) {
  // Provider response bodies and credentials are deliberately never logged.
  console.error(e instanceof Error ? e.message : 'Twilio read-only inspection failed');
  process.exitCode=1;
}
