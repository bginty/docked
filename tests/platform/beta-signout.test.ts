import test from "node:test";
import assert from "node:assert/strict";
import { signOutBetaSession } from "../../src/core/beta-signout";

test("beta logout revokes only the current session and never requests global sign-out", async () => {
  const scopes: string[] = [];
  await signOutBetaSession({ signOut: async ({scope}) => { scopes.push(scope); return {error:null}; } });
  assert.deepEqual(scopes,["local"]);
});
test("beta logout does not report success after a provider rejection or uncertain response", async () => {
  await assert.rejects(()=>signOutBetaSession({signOut:async()=>({error:Error("provider unavailable")})}),/could not be confirmed/);
  await assert.rejects(()=>signOutBetaSession({signOut:async()=>{throw Error("response uncertain");}}),/uncertain/);
});
