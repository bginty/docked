import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  writeFile,
  readFile,
  rm,
  realpath,
} from "node:fs/promises";
import path from "node:path";
import { hash, strategyV1 } from "../../src/core/pricing";
import { quotes, rules, now } from "./fixtures";

test("private fictional CLI import/replay/report preserves evidence and detects alteration", async () => {
  const root = await realpath(process.cwd());
  await mkdir(path.join(root, "research-output"), { recursive: true });
  const dir = await mkdtemp(path.join(root, "research-output", "fixture-cli-"));
  try {
    const data = [
      {
        rules,
        startAt: "2026-10-02T12:00:00.000Z",
        snapshots: [{ observedAt: now, quotes: quotes() }],
        result: null,
      },
    ];
    const manifest = {
      datasetId: "FICTIONAL-CLI-TEST",
      evidence: "demo",
      oddsRights: "authored fixture",
      resultsRights: "authored fixture",
      retentionAllowed: true,
      configHash: hash(strategyV1),
      dataHash: hash(data),
      codeCommit: "fixture",
      seed: 1,
      split: "development",
      contaminated: true,
      frozenAt: "2026-01-01",
      from: "2026-10-02",
      to: "2026-10-03",
      historicalUniverseEvidence: "fictional test groups",
    };
    const input = path.join(dir, "fixture.json"),
      mf = path.join(dir, "manifest.json"),
      audit = path.join(dir, "audit.json"),
      replay = path.join(dir, "replay.json"),
      report = path.join(dir, "report.md");
    await writeFile(input, JSON.stringify(data));
    await writeFile(mf, JSON.stringify(manifest));
    const run = (...args: string[]) =>
      execFileSync(
        process.execPath,
        ["--import", "tsx", "scripts/research.ts", ...args],
        {
          cwd: root,
          encoding: "utf8",
          env: { ...process.env, APP_ENV: "preview" },
          stdio: ["ignore", "pipe", "pipe"],
        },
      );
    run("import", input, mf, audit);
    const quality = JSON.parse(await readFile(audit, "utf8"));
    assert.equal(quality.validation.valid, true);
    assert.equal(quality.rows, undefined);
    run("replay", input, mf, replay);
    run("report", replay, report);
    assert.match(await readFile(report, "utf8"), /FICTIONAL SOFTWARE FIXTURE/);
    assert.throws(() => run("replay", input, mf, replay), /EEXIST/);
    const altered = JSON.parse(await readFile(replay, "utf8"));
    altered.immediate.net = "1000.00";
    await writeFile(replay, JSON.stringify(altered));
    assert.throws(
      () => run("report", replay, path.join(dir, "tampered.md")),
      /integrity mismatch/,
    );
  } finally {
    // Delete only this test's newly-created directory after verifying its resolved root.
    const target = await realpath(dir);
    assert.ok(target.startsWith(path.join(root, "research-output") + path.sep));
    await rm(target, { recursive: true });
  }
});
