/* Three read-only same-origin requests. No credentials or personal data are printed. */
(async function(deployment,expires){
 const checks=[];
 const require=(pass,message)=>{if(!pass)throw Error(message)};
 const read=async(path,json=true)=>{
  const url=new URL(path,location.origin);url.searchParams.set('dpl',deployment);
  const t=performance.now();const res=await fetch(url,{credentials:'same-origin',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(30000)});
  const rid=res.headers.get('x-vercel-id');
  checks.push({path,status:res.status,elapsedMs:Math.round(performance.now()-t),requestId:rid});
  require(res.ok&&rid,'Read unavailable on '+path);
  return json?res.json():res.text();
 };
 try{
  require(location.origin==='https://docked.com.au','Open docked.com.au');
  require(Date.now()<Date.parse(expires),'Staging window expired');
  const session=await read('/api/app-session');
  require(session.authenticated&&session.ownerAccess,'Existing Owner session required');
  const doc=new DOMParser().parseFromString(await read('/admin/incidents',false),'text/html');
  const link=Array.from(doc.querySelectorAll('a[href]')).some(el=>el.getAttribute('href')==='/app/verify-phone'&&el.textContent.trim()==='Verify your phone');
  require(link,'Owner verification link unavailable');
  require(doc.body.textContent.toLowerCase().includes('operational incidents'),'Incidents unavailable');
  const incidents=await read('/api/admin/incidents'); require(incidents&&!incidents.error,'Incident read unavailable');
  console.info('DOCKED_SMS_OWNER_READS '+JSON.stringify({at:new Date().toISOString(),deployment,owner:true,link:true,incidents:true,businessMutations:0,checks}));
  return 'Read checks passed. Codex will confirm which deployment served them.';
 }catch(e){console.error('DOCKED_SMS_OWNER_STOP '+JSON.stringify({at:new Date().toISOString(),message:String(e),checks,businessMutations:0}));return 'Stopped. Leave Send Code untouched.';}
})("dpl_yV2vyZb1FQgdTciY2gHk25JtXVt8","2026-11-20T18:37:51.664Z");
