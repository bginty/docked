// Read-only certification snapshot. Never prints credentials or personal balances.
import assert from "node:assert/strict";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { ownerDatabase } from "./owner-gameplay-db.mjs";
import { digest } from "../src/core/scoring-engine";
import {
  validateCredits,
  financialReport,
  type CreditsState,
} from "../src/core/credits-sandbox";
async function main() {
  const db = ownerDatabase();
  try {
    const snapshot = await db.begin(async (tx) => {
      await tx`set transaction isolation level repeatable read, read only`;
      const [r] =
        await tx`select revision,document from credits_sandbox.state where id`;
      const s = r.document as CreditsState;
      validateCredits(s);
      const report = financialReport(s);
      assert.equal(report.circulation.difference, 0);
      const access =
        await tx`select user_id::text,kind,enabled from credits_sandbox.access order by user_id`;
      const identities =
        await tx`select id::text,email_confirmed_at is not null verified from auth.users where id in ('623d1e69-d0f3-493f-9713-108e8c21469a','ef641248-67be-4c32-9b12-9205bfcee15b') order by id`;
      const lines =
        await tx`select journal,account,credits from credits_sandbox.lines order by journal,account,credits`;
      const journals =
        await tx`select * from credits_sandbox.journal order by id`;
      assert.deepEqual(
        journals
          .map((j) => j.document)
          .sort((a, b) => a.id.localeCompare(b.id)),
        [...s.journal].sort((a, b) => a.id.localeCompare(b.id)),
      );
      const normalize = (rows: any[]) =>
        rows
          .map((l) => ({
            journal: l.journal,
            account: l.account,
            credits: Number(l.credits),
          }))
          .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
      assert.deepEqual(
        normalize(lines),
        normalize(
          s.journal.flatMap((j) =>
            j.lines.map((l) => ({ ...l, journal: j.id })),
          ),
        ),
      );
      await assert.rejects(
        () =>
          tx.savepoint(async (nested) => {
            await nested`set local role authenticated`;
            await nested`select document from credits_sandbox.state`;
          }),
        /permission/,
      );
      return {
        revision: r.revision,
        stateHash: digest(s),
        ledgerHash: digest(s.journal),
        sqlLinesHash: digest(lines),
        sqlJournalHash: digest(journals),
        accessHash: digest(access),
        protectedVerifiedAccounts:
          identities.length === 2 && identities.every((x) => x.verified),
        cards: Object.keys(s.cards).length,
        listings: Object.keys(s.listings).length,
        deposits: Object.keys(s.deposits).length,
        withdrawals: Object.keys(s.withdrawals).length,
        mode: s.mode,
        liveEnabled: s.policy.liveEnabled,
        swapFee: s.policy.swapFeeEach,
        windows: s.creditOnly?.windows.length,
        circulationDifference: report.circulation.difference,
        unbalanced: report.unbalancedTransactions,
        sqlMatchesAggregate: true,
        ordinaryDatabaseReadDenied: true,
      };
    });
    const release = await (
      await fetch("https://docked.com.au/api/beta-release")
    ).json();
    const auth = JSON.parse(
      readFileSync("private-data/vercel-cli/auth.json", "utf8"),
    );
    const team = "team_tf6xweKKyVCj9bTppUKttJ4l",
      project = "prj_l0rpVDPRuIRp9UcBUkudeyUK5yST";
    const api = async (path: string) => {
      const r = await fetch(`https://api.vercel.com${path}?teamId=${team}`, {
        headers: { Authorization: `Bearer ${auth.token}` },
      });
      assert.equal(r.status, 200);
      return r.json();
    };
    const p = await api(`/v9/projects/${project}`),
      d = await api(`/v13/deployments/${release.deploymentId}`);
    assert.equal(p.accountId, team);
    assert.equal(d.projectId, project);
    assert.equal(d.meta.githubCommitSha, release.commit);
    const result = {
      at: new Date().toISOString(),
      branch: execFileSync("git", ["branch", "--show-current"])
        .toString()
        .trim(),
      head: execFileSync("git", ["rev-parse", "HEAD"]).toString().trim(),
      snapshot,
      release,
      hosting: {
        project,
        team,
        protection: p.ssoProtection,
        production: d.id,
        preview: p.targets?.preview?.id ?? null,
        state: d.readyState,
      },
    };
    mkdirSync("docs/qa/credit-v2", { recursive: true });
    const name = process.argv.includes("--after") ? "after" : "before";
    writeFileSync(
      `docs/qa/credit-v2/${name}.json`,
      JSON.stringify(result, null, 2) + "\n",
    );
    console.log(
      JSON.stringify({
        name,
        revision: snapshot.revision,
        verified: snapshot.protectedVerifiedAccounts,
        balanced: snapshot.circulationDifference === 0,
        commit: release.commit,
        liveEnabled: snapshot.liveEnabled,
      }),
    );
  } finally {
    await db.end();
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
