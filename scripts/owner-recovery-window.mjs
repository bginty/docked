// Supervised owner browser recovery only. Never scheduled; no Auth request or retry.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import postgres from 'postgres';
import {databaseConnectionOptions} from '../src/server/database-tls.ts';
import {flags,secrets,checkFlags} from './owner-mail-window.mjs';
import {dispatchOnce} from './owner-mail-dispatch.mjs';
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const root='private-data/production/';
const receipt=root+'owner-window/recovery-browser-attempt.json';
const approvalPath=root+'owner-window/recovery-browser-approval.json';
const dispatchApprovalPath=root+'microsoft365/owner-dispatch-approval.json';
assert.equal(process.argv[2],'--supervised-once');
assert.equal(existsSync(receipt),false,'Prior attempt exists; reconcile, never repeat');
const approval=read(approvalPath);
assert.equal(approval.approved,true);
assert.equal(approval.ownerBrowserReady,true);
assert.equal(approval.recipient,'support@docked.com.au');
assert.equal(approval.projectRef,'pojoymtniryarxxunyvz');
assert.equal(approval.maximumDispatches,1);
assert.ok(Date.now()-Date.parse(approval.approvedAt)>=0);
assert.ok(Date.now()-Date.parse(approval.approvedAt)<5*60_000);
assert.ok(approval.authority.length>15);
const d=read('docs/qa/beta-isolation/deployment-status.json');
assert.equal(d.id,'dpl_vcRdRDfrqAHPQgZBvvK2mhcRMVyP');
assert.equal(d.effectiveTarget,'preview');assert.equal(d.state,'READY');
const binding=read('docs/qa/owner-acceptance/recovery-binding-readback.json');
assert.equal(binding.deploymentId,d.id);
assert.equal(binding.exactTargetCallbackAllowed,true);
assert.equal(binding.hookPinnedToCurrentDeployment,true);
assert.ok(Date.now()-Date.parse(binding.checkedAt)<30*60_000);
const grants=read('docs/qa/fantasy-production/graph-application-preflight.json');
assert.equal(grants.certificate.matchesPrivateKey,true);
assert.equal(grants.effectiveGrantAudit.complete,true);
assert.deepEqual(grants.effectiveGrantAudit.assignments,[]);
assert.deepEqual(grants.token.observedClaims.roles,[]);
assert.ok(Date.now()-Date.parse(grants.checkedAt)<30*60_000);
const before=secrets();checkFlags(before,false,d.url);
const connection=read(root+'connection.json');
assert.equal(connection.projectRef,approval.projectRef);
assert.equal(connection.organizationId,'otldyeunbqabbcjydjpe');
const url=new URL(readFileSync(root+'provider-config/supabase/.temp/pooler-url','utf8').trim());
assert.equal(url.username,'postgres.'+approval.projectRef);
url.password=read(root+'provision-request.json').databasePassword;
const sql=postgres(url.href,{...databaseConnectionOptions(url.href,{DATABASE_SSL_CA_FILE:resolve('certs/supabase-prod-ca-2021.crt')}),max:1,onnotice:()=>{},connect_timeout:10});
const report={checkedAt:new Date().toISOString(),project:approval.projectRef,deploymentId:d.id,recipient:approval.recipient,authority:approval.authority,operatorAuthRequests:0,dispatchRequests:0,deliveryVerified:false,retryAttempted:false,rateLimitsChanged:false};
let flagsAttempted=false;
try {
  const settings=await fetch(connection.supabaseUrl+'/auth/v1/settings',{headers:{apikey:connection.publishableKey},redirect:'error',signal:AbortSignal.timeout(15000)});
  assert.equal(settings.status,200);
  const auth=await settings.json();assert.equal(auth.disable_signup,true);assert.equal(auth.mailer_autoconfirm,false);
  const [state]=await sql`select (select count(*)::int from private.docked_auth_mail_outbox where state in ('pending','authorizing','dispatching')) pending,(select count(*)::int from cron.job) jobs,(select enabled from private.docked_mail_scheduler) scheduled,(select testers_enabled from beta_private.admission_control) testers,to_regnamespace('net') is not null net,(select count(*)::int from auth.users where email='support@docked.com.au' and email_confirmed_at is not null) owners`;
  assert.deepEqual({...state},{pending:0,jobs:0,scheduled:false,testers:false,net:false,owners:1});
  const baseline=await sql`select id from private.docked_auth_mail_outbox`;
  const known=new Set(baseline.map(r=>r.id));
  writeFileSync(receipt,JSON.stringify({phase:'reserved',...report}),{flag:'wx',mode:0o600});
  flagsAttempted=true;flags(true,d.url);
  console.log(JSON.stringify({windowOpen:true,recipient:approval.recipient,maximumSeconds:150,instruction:'Submit Send reset link once in your current Docked browser; do not repeat.'}));
  const deadline=Date.now()+150_000;
  let job;
  while(Date.now()<deadline){
    const rows=await sql`select id,mode,state,attempts from private.docked_auth_mail_outbox`;
    const added=rows.filter(r=>!known.has(r.id));
    assert.ok(added.length<=1,'More than one request; no dispatch');
    if(added.length){job=added[0];break;}
    await new Promise(r=>setTimeout(r,2000));
  }
  assert.ok(job,'Window expired without one queued request');
  assert.equal(job.mode,'production');assert.equal(job.state,'pending');assert.equal(job.attempts,0);
  const [active]=await sql`select count(*)::int n from private.docked_auth_mail_outbox where state in ('pending','authorizing','dispatching')`;
  assert.equal(active.n,1);
  report.mailReceiptId=job.id;
  const dispatchApproval={enabled:true,projectRef:approval.projectRef,recipient:approval.recipient,serverRecipientMode:'support-test',queueReviewed:true,ownerApprovalReference:approval.authority,expiresAt:new Date(Date.now()+5*60_000).toISOString()};
  writeFileSync(dispatchApprovalPath,JSON.stringify(dispatchApproval),{mode:0o600});
  const secret=readFileSync(root+'microsoft365/hook-disabled.env','utf8').match(/SEND_EMAIL_HOOK_SECRET="(v1,whsec_[^"]+)"/)[1];
  report.dispatchRequests=1;
  report.dispatch=await dispatchOnce({approval:dispatchApproval,secret});
  const [outcome]=await sql`select state,attempts,last_code from private.docked_auth_mail_outbox where id=${job.id}`;
  report.queueOutcome=outcome;
  assert.equal(outcome.state,'accepted');assert.equal(outcome.attempts,1);
  report.status='AWAITING_OWNER_INBOX_AND_PERSONAL_RECOVERY';
}catch{
  report.status='STOPPED_RECONCILE_NO_RETRY';process.exitCode=1;
}finally{
  try{
    if(flagsAttempted)flags(false);
    writeFileSync(dispatchApprovalPath,JSON.stringify({enabled:false,closedAt:new Date().toISOString()}));
    writeFileSync(approvalPath,JSON.stringify({...approval,approved:false,consumedAt:new Date().toISOString()}));
    const after=secrets();checkFlags(after,false,d.url);
    for(const row of before)assert.equal(after.find(x=>x.name===row.name)?.value,row.value);
    report.dispatcherDisabled=true;report.allSecretDigestsRestored=true;
  }catch{report.shutdownRequiresAttention=true;report.dispatcherDisabled=false;process.exitCode=1;}
  try{const [state]=await sql`select count(*)::int outstanding_mail from private.docked_auth_mail_outbox where state in ('pending','authorizing','dispatching')`;report.finalDatabase=state;}catch{report.databaseReadbackUnavailable=true;}
  await sql.end({timeout:5});
  if(existsSync(receipt))writeFileSync(receipt,JSON.stringify(report,null,2),{mode:0o600});
  writeFileSync('docs/qa/owner-acceptance/supervised-recovery.json',JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report));
}
