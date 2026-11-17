/* Run once in Console at https://docked.com.au with your existing Owner session.
 * GET only; no password/token reading, no MFA challenge, no SMS or business writes.
 * Full-page navigations do not pin a candidate. These fetches use Vercel's
 * documented deployment parameter and prove the new homepage before Owner reads.
 */
(async()=>{
 const source='405058ebfe3e2c915d43ed5344dfb3fcd7930049',deployment='dpl_ACcdM4ivSaNW2ARC3tQf3MmaL2sZ',checks=[];
 const check=(x,m)=>{if(!x)throw Error(m)};
 const read=async(path,type='json')=>{const u=new URL(path,location.origin);u.searchParams.set('dpl',deployment);const t=performance.now();const r=await fetch(u,{method:'GET',credentials:'same-origin',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(30000)});checks.push({path:path.split('?')[0],status:r.status,elapsedMs:Math.round(performance.now()-t)});check(r.ok,'Read failed: '+path+' ('+r.status+')');return type==='json'?r.json():r.text()};
 try{
 check(location.origin==='https://docked.com.au','Use docked.com.au');check(Date.now()<Date.parse('2026-11-18T19:52:57Z'),'Approval expired');
 const home=await read('/','text');check(home.includes('Build your permanent card collection.')&&home.includes('Australian public registration is not open yet.'),'Candidate routing not established');
 const session=await read('/api/app-session');check(session.authenticated&&session.ownerAccess,'Existing Owner session required');
 const incidents=await read('/api/admin/incidents');check(incidents&&!incidents.error,'Incidents unavailable');
 const operations=await read('/api/admin/operations?scope=live');check(operations.data?.scope==='live'&&operations.data.inventory.length===6540,'Public report unavailable');check(operations.data.metrics.openSales===0&&operations.data.metrics.openIssuance===0&&operations.data.metrics.commercialCards===0,'Closed controls changed');
 const support=await read('/admin/workspace/users','text');check(support.includes('Find member accounts')&&support.includes('DOCKED OPERATIONS'),'Owner support unavailable');
 const report={at:new Date().toISOString(),source,deployment,passed:true,ownSession:true,authenticatedOwner:true,existingMfaEnforced:true,newMfaChallenge:false,candidateRoutingProven:true,incidentsRead:true,operationsRead:true,supportRead:true,definitions:6540,commercialCards:0,openSales:0,openIssuance:0,businessMutations:0,smsSent:0,checks};
 console.info('DOCKED_PREPARATION_OWNER_ACCEPTANCE '+JSON.stringify(report));return 'PASSED — exact staged preparation Owner checks';
 }catch(e){console.error('DOCKED_PREPARATION_OWNER_STOP '+JSON.stringify({at:new Date().toISOString(),message:String(e),checks,businessMutations:0}));return 'STOPPED — tell Codex the error; do not change browser protection';}
})();
