// Read-only hosted compatibility inspection. No member commands or repairs.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { ownerDatabase, projectRef } from "./owner-gameplay-db.mjs";
import { digest } from "../src/core/scoring-engine";
import { validateCredits } from "../src/core/credits-sandbox";
async function main() {
  const sql = ownerDatabase();
  const directory = "docs/qa/marketplace-release";
  mkdirSync(directory, { recursive: true });
  try {
    const report = await sql.begin("read only", async (tx) => {
      const [row] =
        await tx`select revision,document from credits_sandbox.state where id`;
      validateCredits(row.document);
      const s = row.document,
        issues: string[] = [],
        seen = new Set<string>();
      for (const l of Object.values(s.listings) as any[]) {
        if (
          !Number.isSafeInteger(l.price) ||
          l.price < 1 ||
          l.price > 1e9 ||
          !["OPEN", "SOLD", "CANCELLED"].includes(l.status)
        )
          issues.push("Invalid listing price/state");
        if (l.status === "OPEN") {
          if (seen.has(l.card)) issues.push("Duplicate active listing");
          seen.add(l.card);
          if (
            s.commerce.cards[l.card]?.owner !== l.member ||
            s.cards[l.card]?.version !== l.version
          )
            issues.push("Active listing ownership/version mismatch");
          if (/^[a-f0-9-]{36}$/i.test(l.card)) {
            const [r] =
              await tx`select exists(select 1 from beta_fantasy.entries e join beta_fantasy.competitions c on c.id=e.competition_id, jsonb_array_elements(e.snapshot) p where p->>'card_id'=${l.card} and c.scored_at is null and (c.rules->>'lineup_version' is null or ((p->>'kickoff')::timestamptz>clock_timestamp() and not exists(select 1 from beta_fantasy.slot_locks sl where sl.competition_id=e.competition_id and sl.user_id=e.user_id and sl.slot=p->>'slot')))) reserved`;
            if (r.reserved)
              issues.push(
                "Active listing conflicts with competition reservation",
              );
          }
        }
      }
      const entries =
        await tx`select c.rules,e.snapshot from beta_fantasy.entries e join beta_fantasy.competitions c on c.id=e.competition_id where c.rules->>'lineup_version' is not null`;
      for (const e of entries) {
        if (
          e.snapshot.length !== 7 ||
          new Set(e.snapshot.map((p: any) => p.player_id)).size !== 7
        )
          issues.push("Invalid seven-slot saved snapshot");
        for (const p of e.snapshot)
          if (
            !p.card_id ||
            !p.player_id ||
            !p.slot ||
            !Number.isFinite(Date.parse(p.kickoff))
          )
            issues.push("Malformed reservation/kickoff metadata");
      }
      const [admission] =
        await tx`select enabled,testers_enabled from beta_private.admission_control`;
      const migrations =
        await tx`select version from supabase_migrations.schema_migrations order by version desc limit 5`;
      const functions =
        await tx`select pg_get_functiondef('sports_feed.seven_inventory(uuid)'::regprocedure) inventory,pg_get_functiondef('beta_fantasy.swap_read_state()'::regprocedure) swaps`;
      const [counts] =
        await tx`select (select count(*) from beta_fantasy.entries)::int entries,(select count(*) from beta_fantasy.slot_locks)::int locks,(select count(*) from credits_sandbox.journal)::int journal`;
      const [expired] =
        await tx`select count(*)::int n from beta_fantasy.swaps where state='pending' and expires_at<=clock_timestamp()`;
      return {
        at: new Date().toISOString(),
        projectRef,
        readOnly: true,
        passed: issues.length === 0,
        issues,
        admission,
        migrations,
        aggregateRevision: row.revision,
        aggregateHash: digest(s),
        counts,
        activeListings: seen.size,
        expiredFreeSwaps: expired.n,
        priorFunctionHash: digest(functions),
        memberDataMutated: false,
      };
    });
    writeFileSync(
      directory + "/database-preflight.json",
      JSON.stringify(report, null, 2),
    );
    // Existing exact Vercel project/aliases, no credential values in receipts.
    const auth = JSON.parse(
      readFileSync("private-data/vercel-cli/auth.json", "utf8"),
    );
    const project = "prj_l0rpVDPRuIRp9UcBUkudeyUK5yST",
      team = "team_tf6xweKKyVCj9bTppUKttJ4l";
    const api = async (path: string) => {
      const r = await fetch(
        "https://api.vercel.com" + path + "?teamId=" + team,
        {
          headers: { Authorization: "Bearer " + auth.token },
          signal: AbortSignal.timeout(30000),
        },
      );
      assert.ok(r.ok, "Vercel read HTTP " + r.status);
      return r.json();
    };
    const p = await api("/v9/projects/" + project);
    assert.equal(p.accountId, team);
    assert.equal(p.link.org, "bginty");
    assert.equal(p.link.repo, "docked");
    const aliases = [];
    for (const name of ["docked.com.au", "www.docked.com.au"]) {
      const a = await api("/v4/aliases/" + name);
      assert.equal(a.projectId, project);
      aliases.push({ name, deployment: a.deployment?.id ?? a.deploymentId });
    }
    const source = readFileSync(
      "supabase/migrations/20261014021342_marketplace_phase_one_guards.sql",
      "utf8",
    ).replaceAll("\r\n", "\n");
    const output = {
      ...report,
      project,
      team,
      aliases,
      protection: p.ssoProtection,
      migrationHash: digest(source),
    };
    writeFileSync(
      directory + "/preflight.json",
      JSON.stringify(output, null, 2),
    );
    console.log(JSON.stringify(output));
    if (!report.passed) process.exitCode = 1;
  } finally {
    await sql.end();
  }
}
main().catch((e) => {
  console.error({ error: e.message });
  process.exitCode = 1;
});
