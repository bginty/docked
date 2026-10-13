import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {ownerDatabase} from './owner-gameplay-db.mjs';
import {digest} from '../src/core/scoring-engine';
async function main(){
const sql=ownerDatabase();
try{
 const beforeRevision=JSON.parse(readFileSync('docs/qa/barry-review/migration-applied.json','utf8')).priorRevision;
 const [prior]=await sql`select document from credits_sandbox.history where revision=${beforeRevision}`;
 const [current]=await sql`select revision,document from credits_sandbox.state where id`;
 assert.ok(prior);
 const strip=(v:any)=>{const x=structuredClone(v);delete x.economy.products;delete x.economy.activeProductVersions;return x;};
 assert.equal(digest(strip(prior.document)),digest(strip(current.document)));
 for(const [id,p] of Object.entries(prior.document.economy.products))assert.deepEqual(current.document.economy.products[id],p);
 const report={at:new Date().toISOString(),passed:true,priorRevision:beforeRevision,currentRevision:current.revision,scope:'Full wallet state unchanged except additive product configurations and active offer list; all historical products identical',unchangedFingerprint:digest(strip(current.document))};
 writeFileSync('docs/qa/barry-review/integrity.json',JSON.stringify(report,null,2));console.log(report);
}finally{await sql.end();}

}
main().catch(e=>{console.error(e.message);process.exitCode=1;});

