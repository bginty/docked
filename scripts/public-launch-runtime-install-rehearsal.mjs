/** Runs the exact prepared installation only in the existing networkless restore. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const container='docked-commercial-restore-20261117g';
const info=JSON.parse(execFileSync('docker',['inspect',container],{encoding:'utf8',windowsHide:true}))[0];
assert.equal(info.HostConfig.NetworkMode,'none');
assert.equal(Object.keys(info.HostConfig.PortBindings??{}).length,0);
assert(info.HostConfig.Tmpfs['/restore']);
const command=['exec','-i',container,'psql','-h','/restore','-U','postgres','-X','-qAt','-v','ON_ERROR_STOP=1'];
const sql=(body,args=[])=>execFileSync('docker',[...command,...args],{input:body,encoding:'utf8',windowsHide:true,maxBuffer:16e6}).trim();
const digest=sql('select launch_transition.source_digest();');
const file='config/operations/public-runtime-migrations.prepared.sql';
const body=readFileSync(file,'utf8');
const now=new Date().toISOString();
const args=['-v','expected_source_digest='+digest,'-v','preflight_at='+now,'-v','backup_verified_at='+now,'-v','backup_sha256='+ 'b'.repeat(64),'-v','approved_package_sha256='+'c'.repeat(64)];
// These synthetic authority markers exist only inside this networkless rehearsal.
try { sql(body,args); } catch(e) {
  writeFileSync('private-data/public-launch-runtime-20261117/install-error.private.txt',String(e.stderr??e));
  throw Error('Local prepared installation failed; private diagnostic retained');
}
assert.equal(sql('select launch_transition.source_digest();'),digest);
assert.equal(sql("select count(*) from supabase_migrations.schema_migrations where version in('20261116215032','20261117091440');"),'2');
assert.equal(sql('select (select count(*) from sms_delivery.windows)+(select count(*) from sms_delivery.attempts)+(select count(*) from private.owner_support_events)+(select count(*) from private.owner_customer_restrictions);'),'0');
let retryDenied=false;
try {sql(body,args);} catch(e) {retryDenied=String(e.stderr).includes('Already present or unexpected schema');}
assert(retryDenied,'An already committed installation must not be replayed');
assert.equal(sql('select launch_transition.source_digest();'),digest);
const result={at:new Date().toISOString(),container,network:'none',file,sha256:createHash('sha256').update(body).digest('hex'),committedLocally:true,registeredMigrations:2,seededRuntimeRows:0,protectedSourceUnchanged:true,duplicateApplyDenied:true,productionWrites:0,smsSent:0};
writeFileSync('docs/qa/public-launch-runtime-20261117/install-rehearsal.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result));
