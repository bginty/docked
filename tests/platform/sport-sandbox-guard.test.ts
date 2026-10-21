import {test} from "node:test";
import assert from "node:assert/strict";
import {assertSportSandbox} from "../../src/core/sport-sandbox";
test("multi-sport laboratory cannot bind to production even with its feature flag enabled",()=>{
 const local={FANTASY_CARDS_PREVIEW:'true',APP_ENV:'preview',SUPABASE_ENV:'preview',DOCKED_MULTI_SPORT_SANDBOX:'true',NEXT_PUBLIC_SUPABASE_URL:'http://localhost:54321',DATABASE_URL:'postgres://postgres:local@127.0.0.1:54322/postgres'};
 assert.doesNotThrow(()=>assertSportSandbox(local));
 for(const change of [{APP_ENV:'production'},{VERCEL_ENV:'production'},{DOCKED_HOSTED_PRODUCTION:'true'},{DATABASE_URL:'postgres://postgres:local@db.pojoymtniryarxxunyvz.supabase.co/postgres'},{DOCKED_MULTI_SPORT_SANDBOX:'false'}])assert.throws(()=>assertSportSandbox({...local,...change}));
});
