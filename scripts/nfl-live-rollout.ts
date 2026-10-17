// Explicit operator-only publication. Never uploads a local economy document.
import { readFile, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { ownerDatabase } from "./owner-gameplay-db.mjs";
import { cleanTestEconomy } from "../src/core/nfl-test-cleanup";
import { digest } from "../src/core/scoring-engine";
import { nflCardEligibility } from "../src/core/nfl-card-eligibility";
import type { CreditsState } from "../src/core/credits-sandbox";

async function main() {
  const apply = process.argv[2] === "--apply";
  assert.ok(apply || process.argv[2] === "--check");
  const dir = process.argv[3];
  assert.ok(dir?.startsWith("private-data/nfl-live-recovery-"));
  const read = async (file: string) => JSON.parse(await readFile(file, "utf8"));
  const receipt = await read(`${dir}/receipt.json`);
  const raw = await readFile(`${dir}/snapshot.json`);
  assert.equal(createHash("sha256").update(raw).digest("hex"), receipt.sha256);
  const drill = await read(`${dir}/restore-drill.json`);
  assert.equal(drill.snapshotSha256, receipt.sha256);
  assert.equal(drill.passed, true);
  const preflight = await read(`${dir}/cleanup-preflight.json`);
  assert.equal(preflight.snapshotSha256, receipt.sha256);
  const audit = await read(
    "docs/qa/nfl-roster-reconciliation/reconciliation.json",
  );
  const bridge = await read(
    "docs/qa/nfl-roster-reconciliation/reviewed-feed-mappings.json",
  );
  const backup = {
    ...JSON.parse(raw.toString()),
    ...(await read(`${dir}/dependencies.json`)),
  };
  const sql = ownerDatabase();
  const runId = "authorised-nfl-rollout-20261017";
  try {
    const report = await sql.begin(async (tx: any) => {
      await tx`set local lock_timeout='10s'`;
      await tx`set local statement_timeout='60s'`;
      // Match marketplace and scheduled game-lock routines: advisory lock first.
      // Taking dependency table locks first can deadlock their guarded updates.
      await tx`select pg_advisory_xact_lock(71820342)`;
      // Lock dependencies before inspecting them so cleanup cannot race a lineup,
      // offer, purchase or ownership change. Timeout aborts the whole transaction.
      if (apply) {
        for (const name of Object.keys(backup)
          .filter((n) => n !== "auth.user_ids")
          .sort()) {
          const [schema, table] = name.split(".");
          await tx`lock table ${tx(schema)}.${tx(table)} in share row exclusive mode`;
        }
        const prior =
          await tx`select id from nfl_roster.cleanup_runs where id=${runId}`;
        if (prior.length) return { alreadyApplied: true, runId };
      }
      const [row] =
        await tx`select * from credits_sandbox.state where id for update`;
      const before: CreditsState = row.document;
      assert.equal(
        Number(row.revision),
        preflight.revision,
        "Live revision changed: refresh recovery and review",
      );
      assert.equal(
        digest(before),
        preflight.beforeStateHash,
        "Live preimage changed",
      );
      const approved = preflight.approved.map((p: any) => {
        const identity =
          backup["credits_sandbox.state"][0].document.economy.players[
            p.playerId
          ];
        const matches = Object.values(before.economy!.players).filter(
          (x) =>
            x.provider === identity.provider &&
            x.providerId === identity.providerId &&
            x.sport === identity.sport &&
            x.assetKind === identity.assetKind,
        );
        assert.equal(matches.length, 1);
        const ids = Object.values(before.economy!.instances)
          .filter((c) => c.playerId === matches[0].id)
          .map((c) => c.id)
          .sort();
        assert.deepEqual(
          ids,
          [...p.cards].sort(),
          `Current removal scope changed: ${p.name}`,
        );
        return { ...p, playerId: matches[0].id, cards: ids };
      });
      const cleaned = cleanTestEconomy(before, approved);
      assert.equal(cleaned.cardIds.length, 8);
      assert.equal(
        Object.keys(cleaned.archive).length,
        8,
        "Additional dependent records need review",
      );
      const ids = cleaned.cardIds;
      const sorted = (rows: any[]) => rows.map((r) => digest(r)).sort();
      for (const [name, rows] of Object.entries(backup)) {
        if (name === "auth.user_ids") {
          assert.deepEqual(
            (await tx`select id from auth.users`).map((r: any) => r.id).sort(),
            [...(rows as string[])].sort(),
          );
          continue;
        }
        const [schema, table] = name.split(".");
        const live = (
          await tx`select to_jsonb(t) r from ${tx(schema)}.${tx(table)} t`
        ).map((r: any) => r.r);
        // The independent existing roster collector can refresh these projections;
        // we do not write them. All economy/competition dependencies must match.
        if (name !== "sports_feed.nfl_players")
          assert.deepEqual(
            sorted(live),
            sorted(rows as any[]),
            `Recovery dependency changed: ${name}`,
          );
        if (!name.startsWith("credits_sandbox."))
          assert.ok(
            !live.some((r: any) =>
              ids.some((id) => JSON.stringify(r).includes(id)),
            ),
            `Live dependency: ${name}`,
          );
      }
      const after = cleaned.state;
      const statuses: Record<string, any> = {
        eligible: "active",
        unsupported: "active",
        "practice-squad": "practice-squad",
        reserve: "reserve",
        released: "released",
        retired: "retired",
      };
      const evidenceRows: any[] = [];
      for (const p of Object.values(after.economy!.players)) {
        if (p.sport !== "nfl") continue;
        const matches = audit.records.filter(
          (r: any) => r.providerId === p.providerId,
        );
        assert.ok(matches.length <= 1, "Ambiguous audited provider identity");
        const r = matches[0],
          status = statuses[r?.decision];
        if (r?.correctedPosition) {
          assert.ok(
            !Object.values(after.economy!.definitions).some(
              (d) => d.playerId === p.id,
            ),
          );
          p.position = r.correctedPosition;
        }
        const evidence =
          r?.official ??
          (typeof r?.verification === "object"
            ? r.verification
            : r?.transactions.find((t: any) => t.team === r.sourceTeam));
        if (!status || !evidence) {
          delete p.roster;
          p.status = "unknown";
          continue;
        }
        const checkedAt = Date.parse(evidence.checkedAt);
        assert.ok(
          checkedAt <= Date.now() && checkedAt > Date.now() - 72 * 3600000,
          "Roster evidence expired",
        );
        p.roster = {
          policy: "official-nfl-roster-v1",
          playerId: p.id,
          providerId: p.providerId,
          team: r.official?.team ?? r.sourceTeam,
          position: r.official?.position ?? r.position,
          status,
          identityVerified: true,
          sourceUrl: evidence.url,
          sourceHash: evidence.sha256,
          checkedAt,
        };
        p.status =
          status === "active"
            ? "active"
            : status === "retired"
              ? "retired"
              : "inactive";
        p.currentTeam = p.roster.team;
        p.observedAt = checkedAt;
        p.sourceRevision = p.roster.sourceHash;
        evidenceRows.push(p.roster);
      }
      after.economy!.rosterPolicy = "official-nfl-roster-v1";
      const eligible = Object.values(after.economy!.players).filter(
        (p) => nflCardEligibility(p, Date.now()).eligible,
      );
      assert.equal(eligible.length, 493);
      assert.equal(bridge.players.length, 433);
      for (const m of bridge.players) {
        const p = eligible.find((p) => p.providerId === m.verifiedIdentity);
        assert.ok(
          p && p.position === m.position,
          "Mapping no longer matches eligible identity",
        );
        m.docked = p.id;
      }
      for (const key of Object.keys(before))
        if (!["economy", "cards", "commerce"].includes(key))
          assert.equal(
            digest((before as any)[key]),
            digest((after as any)[key]),
            `Unrelated state: ${key}`,
          );
      for (const key of ["definitions", "packs", "products"] as const)
        assert.equal(digest(before.economy![key]), digest(after.economy![key]));
      for (const [id, c] of Object.entries(before.economy!.instances))
        if (!ids.includes(id)) {
          assert.equal(digest(c), digest(after.economy!.instances[id]));
          assert.equal(digest(before.cards[id]), digest(after.cards[id]));
          assert.equal(
            digest(before.commerce.cards[id]),
            digest(after.commerce.cards[id]),
          );
        }
      const aliases =
        await tx`select provider_id,player_id::text alias from sports_feed.nfl_players`;
      const report = {
        runId,
        applied: apply,
        removed: ids.length,
        eligible: eligible.length,
        mappings: bridge.players.length,
        evidence: evidenceRows.length,
        beforeRevision: Number(row.revision),
        afterRevision: Number(row.revision) + 1,
        beforeHash: digest(before),
        afterHash: digest(after),
        backupSha256: receipt.sha256,
      };
      if (apply) {
        for (const id of ids) {
          const a = cleaned.archive[`card:${id}`] as any;
          await tx`insert into nfl_roster.retired_test_cards(card_id,allocation,ownership,history,approval) values(${id},${tx.json(a.allocation)},${tx.json(a.ownership)},${tx.json(a.history)},${tx.json(a.approval)})`;
        }
        for (const e of evidenceRows) {
          const playerIds = [
            e.playerId,
            ...aliases
              .filter((a: any) => a.provider_id === e.providerId)
              .map((a: any) => a.alias),
          ];
          for (const id of new Set(playerIds))
            await tx`insert into nfl_roster.observations values(${id},${e.providerId},${e.team},${e.position},${e.status},true,${e.sourceUrl},${e.sourceHash},${new Date(e.checkedAt)},${tx.json(e)}) on conflict do nothing`;
        }
        for (const m of bridge.players) {
          await tx`insert into nfl_history.mappings(dataset,canonical,docked,position,evidence,reviewed_by) values(${bridge.dataset},${m.canonical},${m.docked},${m.position},${tx.json(m.evidence)},${bridge.reviewer})`;
          for (const a of aliases.filter(
            (a: any) => a.provider_id === m.verifiedIdentity,
          ))
            await tx`insert into nfl_history.aliases(dataset,canonical,alias,evidence) values(${bridge.dataset},${m.canonical},${a.alias},${tx.json(m.evidence)})`;
        }
        await tx`insert into nfl_roster.cleanup_runs(id,manifest,preimage,post_hash) values(${runId},${tx.json({ report, approved })},${tx.json(before as any)},${report.afterHash})`;
        await tx`update credits_sandbox.state set revision=${report.afterRevision},document=${tx.json(after as any)} where id and revision=${report.beforeRevision}`;
        await tx`update nfl_roster.control set enabled=true where id`;
        const [verified] =
          await tx`select document,revision from credits_sandbox.state where id`;
        assert.equal(digest(verified.document), report.afterHash);
        assert.equal(Number(verified.revision), report.afterRevision);
      }
      return report;
    });
    await writeFile(
      `${dir}/${apply ? "applied" : "candidate"}.json`,
      JSON.stringify(report, null, 2),
      { flag: "wx", mode: 0o600 },
    );
    console.log(JSON.stringify(report));
  } finally {
    await sql.end({ timeout: 5 });
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
