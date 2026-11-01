import test from "node:test";
import assert from "node:assert/strict";
import {multiSportDatabase} from "../fixtures/multi-sport-db";
import {sameStoreProducts} from "../../src/server/member-store-purchases";
import draft from "../../config/store-credit-package-drafts.json";
import {storeAdmissionQuery} from "../../src/server/store-admission-query";
test("member Google admission is empty by default, session-bound, revocable and cannot be self-granted",async()=>{
 const d=await multiSportDatabase();try{
  const grant=async()=>(await d.q(storeAdmissionQuery))[0].admission;
  assert.equal(await grant(),null);
  // Isolated invitation transport, while the admission/session/MFA SQL remains real.
  await d.pg.exec(`create or replace function beta_private.admitted(p_user uuid) returns boolean language sql as $$select true$$;
  create or replace function beta_private.active_member_session() returns boolean language sql as $$select exists(select 1 from auth.sessions where id=(auth.jwt()->>'session_id')::uuid and user_id=auth.uid() and (not_after is null or not_after>clock_timestamp()))$$;`);
  const products=draft.products.map(p=>({id:p.id,credits:p.credits,scope:"account" as const,version:draft.version}));
  await d.q("insert into credits_sandbox.store_test_admissions values($1,'qa-grant',false,clock_timestamp()+interval '1 hour',$2,'Explicit isolated test account; no financial purchase')",[d.user,JSON.stringify(products)]);
  assert.equal(await grant(),null);
  await d.q("update credits_sandbox.store_test_admissions set enabled=true where user_id=$1",[d.user]);
  assert.equal(sameStoreProducts((await grant()).products,products),true);
  await d.asUser(d.other);assert.equal(await grant(),null);await d.asUser(d.user);
  await d.q("update credits_sandbox.access set kind='owner' where user_id=$1",[d.user]);
  await d.q("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:d.user,aal:"aal1",session_id:d.sessions[d.user]})]);
  assert.equal(await grant(),null);await d.asUser(d.user);assert.ok(await grant());
  await d.q("update credits_sandbox.store_test_admissions set expires_at=clock_timestamp()-interval '1 second' where user_id=$1",[d.user]);assert.equal(await grant(),null);
  await d.q("update credits_sandbox.store_test_admissions set expires_at=clock_timestamp()+interval '1 hour' where user_id=$1",[d.user]);
  await d.q("delete from auth.sessions where id=$1",[d.sessions[d.user]]);assert.equal(await grant(),null);
  for(const role of ["anon","authenticated","docked_beta_app","service_role"]){
   assert.equal((await d.q("select has_table_privilege($1,'credits_sandbox.store_test_admissions','UPDATE') allowed",[role]))[0].allowed,false);
   if(role!=="docked_beta_app")assert.equal((await d.q("select has_table_privilege($1,'credits_sandbox.store_receipts','SELECT') allowed",[role]))[0].allowed,false);
  }
 }finally{await d.pg.close();}
});
