import assert from "node:assert/strict";
import type { PGlite } from "@electric-sql/pglite";

// Explicit allowlist, not a count: additions require review. The trigger-only
// helper is never directly callable by browser or application roles.
export async function assertSocialDefinerBoundary(pg: PGlite) {
  for (const schema of ["private", "beta_private"]) {
    const result = await pg.query<{
      name: string;
      fixed_path: boolean;
      browser: boolean;
      runtime: boolean;
    }>(
      `select p.proname name,
      coalesce(p.proconfig @> array['search_path=""'],false) fixed_path,
      (has_function_privilege('anon',p.oid,'EXECUTE') or has_function_privilege('authenticated',p.oid,'EXECUTE')) browser,
      has_function_privilege($2,p.oid,'EXECUTE') runtime
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname=$1 and p.prosecdef
        and ($1='private' or p.proname like 'social_%' or p.proname='active_member_session')
      order by p.proname`,
      [schema, schema === "private" ? "docked_app" : "docked_beta_app"],
    );
    assert.deepEqual(result.rows, [
      {
        name: "active_member_session",
        fixed_path: true,
        browser: schema === "private",
        runtime: true,
      },
      {
        name: "social_discussion_reply_notice",
        fixed_path: true,
        browser: false,
        runtime: false,
      },
      {
        name: "social_legacy_cards",
        fixed_path: true,
        browser: false,
        runtime: true,
      },
      {
        name: "social_player_exists",
        fixed_path: true,
        browser: false,
        runtime: true,
      },
    ]);
  }
}
