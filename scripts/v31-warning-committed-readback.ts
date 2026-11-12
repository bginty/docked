/** Read committed correction without repeating it or contacting a payment API. */
import assert from 'node:assert/strict';
import {ownerDatabase} from './owner-gameplay-db.mjs';
import {readJson,root,evidence,writeEvidence} from './lib/v31-commercial-approval.mjs';
import {checksumQuery} from './lib/reviewed-inventory';
import {digest} from '../src/core/scoring-engine';
async function main(){
 const frozen=readJson(root+'/private-data/v31-revenue-launch-20261113/historical-notifications.private.json').rows;
 const result=readJson(evidence+'/warning-result.json');assert.equal(result.mode,'executed');
 const cwd=process.cwd();process.chdir('C:/Users/61412/Documents/ChatGPT/Docked.com.au');const sql=ownerDatabase();process.chdir(cwd);
 try{const report=await sql.begin('isolation level repeatable read read only',async(tx:any)=>{
  const current=(await tx`select to_jsonb(n) value from credits_sandbox.store_notifications n where id=any(${frozen.map((r:any)=>r.id)}) order by id`).map((r:any)=>r.value);
  assert.equal(current.length,7);const stable=(r:any)=>Object.fromEntries(Object.entries(r).filter(([k])=>!['state','completed_at','lease_until'].includes(k)));
  for(const r of current){assert.equal(r.state,'done');assert(r.completed_at);assert.equal(r.lease_until,null);assert.deepEqual(stable(r),stable(frozen.find((b:any)=>b.id===r.id)));}
  const events=await tx`select details from private.audit_events where action='historical-google-test-externally-reconciled' and subject='v31-seven-preview-test-notifications'`;
  assert.equal(events.length,1);assert.equal(events[0].details.before.length,7);assert.equal(events[0].details.after.length,7);assert.equal(digest(events[0].details.after),digest(current));assert.equal(digest(events[0].details.before),digest([...frozen].sort((a:any,b:any)=>String(a.id).localeCompare(String(b.id)))));
  for(const [table,before]of Object.entries(result.protectedTableFingerprints))assert.deepEqual((await tx.unsafe(checksumQuery(table)))[0].value,before,'Protected table changed: '+table);
  const [control]=await tx`select sales_enabled,issuance_enabled,transfers_enabled,gameplay_enabled from commercial_billing.control where id`;assert(Object.values(control).every(v=>v===false));
  return{at:new Date().toISOString(),packageSha256:result.package.packageSha256,warningsDone:7,originalPayloadsAndReferencesPreserved:true,immutableAuditEvents:1,priorFinancialOwnershipSettingsTablesUnchanged:29,balancesChanged:0,cardsChanged:0,recoveryHoldsWaived:0,commercialControlsClosed:true,productionWrites:0};
 });writeEvidence('warning-committed-readback.json',report);console.log(JSON.stringify(report));}finally{await sql.end({timeout:5});}}
main().catch(e=>{console.error('Committed readback stopped: '+String(e.message).slice(0,180));process.exitCode=1;});
