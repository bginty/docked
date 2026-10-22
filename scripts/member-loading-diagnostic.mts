// ESM read-only operational diagnostics; not a signed-in browser acceptance test.
import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { ownerDatabase, ownerRuntimeDatabase } from "./owner-gameplay-db.mjs";
import { refreshEconomyCatalogue } from "../src/server/economy-catalogue";
import {
  memberTestView,
  memberTestSummary,
} from "../src/core/member-test-wallet";
import {
  validateCredits,
  type CreditsState,
} from "../src/core/credits-sandbox";

async function main() {
  const root = process.cwd();
  process.chdir("C:/Users/61412/Documents/ChatGPT/Docked.com.au");
  const sql = ownerDatabase();
  const report: Record<string, unknown> = {
    at: new Date().toISOString(),
    authenticatedBrowserTesting: false,
  };
  async function time<T>(name: string, fn: () => Promise<T> | T) {
    const start = performance.now();
    try {
      return await fn();
    } finally {
      report[name] = Math.round(performance.now() - start);
    }
  }
  const bytes = (state: unknown) =>
    Buffer.byteLength(JSON.stringify({ state }));
  const ledger = (s: CreditsState) =>
    createHash("sha256")
      .update(
        JSON.stringify({
          lots: s.lots,
          journal: s.journal,
          cards: s.cards,
          commerce: s.commerce,
          listings: s.listings,
          entitlements: s.entitlements,
        }),
      )
      .digest("hex");
  try {
    const { state, member } = await sql.begin(
      "isolation level repeatable read read only",
      async (tx) => {
        await tx`set local statement_timeout='30s'`;
        const [owner] =
          await tx`select user_id::text id from credits_sandbox.access where kind='owner' and enabled order by user_id limit 1`;
        assert(owner);
        const state = await time(
          "readStateMs",
          async () =>
            (await tx`select document from credits_sandbox.state where id`)[0]
              .document as CreditsState,
        );
        await time("validateMs", () => validateCredits(state));
        report.players = Object.keys(state.economy!.players).length;
        const before = ledger(state);
        report.realRosterBefore = Object.values(state.economy!.players).filter(
          (p) =>
            p.inventoryClass === "real-roster-beta-v1" && p.status === "active",
        ).length;
        await time("refreshMs", () => refreshEconomyCatalogue(tx, state));
        report.realRosterAfter = Object.values(state.economy!.players).filter(
          (p) =>
            p.inventoryClass === "real-roster-beta-v1" && p.status === "active",
        ).length;
        assert.equal(ledger(state), before);
        report.projectionPreservesLedgers = true;
        return { state, member: String(owner.id) };
      },
    );
    const view = await time("ownerProjectionMs", () =>
      memberTestView(state, member, [], true, Date.now(), [], {
        catalogue: false,
      }),
    );
    report.responseBytes = bytes(view);
    report.products = view.products.map((p) => ({
      id: p.id,
      sport: p.sport,
      available: p.available,
      eligiblePlayers: p.eligiblePlayers,
      reason: p.availabilityReason,
    }));
    report.packsBytes = bytes(
      await time("packsProjectionMs", () =>
        memberTestView(state, member, [], false, Date.now(), [], {
          catalogue: false,
        }),
      ),
    );
    report.summaryBytes = bytes(
      await time("summaryProjectionMs", () => memberTestSummary(state, member)),
    );
    const runtime = ownerRuntimeDatabase();
    try {
      await runtime.begin(
        "isolation level repeatable read read only",
        async (tx) => {
          const [settings] =
            await tx`select current_setting('transaction_isolation') isolation,current_setting('transaction_read_only') readonly`;
          const rows = await tx`select id from credits_sandbox.state where id`;
          const [capability] =
            await tx`select sports_feed.fixture_commerce_capability('basketball') allowed`;
          assert.equal(settings.readonly, "on");
          assert.equal(rows.length, 1);
          assert.equal(capability.allowed, false);
          report.runtimeReadSnapshot = {
            ...settings,
            stateReadable: true,
            unauthenticatedCapability: false,
          };
        },
      );
    } finally {
      await runtime.end({ timeout: 3 });
    }
    report.passed = true;
  } finally {
    await sql.end({ timeout: 3 });
    await fs.mkdir(root + "/docs/qa/member-loading", { recursive: true });
    await fs.writeFile(
      root + "/docs/qa/member-loading/after.json",
      JSON.stringify(report, null, 2),
    );
  }
  console.log(JSON.stringify(report));
}
void main();
