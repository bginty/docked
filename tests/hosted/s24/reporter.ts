import type {
  Reporter,
  TestCase,
  TestResult,
  FullResult,
  TestError,
} from "@playwright/test/reporter";
import { mkdir, writeFile } from "node:fs/promises";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { publicEvidence, privateEvidence, PROJECT, ORIGIN } from "./guard";

export default class SafeReporter implements Reporter {
  private rows: Array<{
    project: string;
    test: string;
    status: string;
    durationMs: number;
    codes: string[];
  }> = [];
  private errors: Array<{ message?: string; stack?: string }> = [];
  onTestEnd(test: TestCase, result: TestResult) {
    const row = {
      project: test.parent.project()?.name ?? "hosted",
      test: test.title,
      status: result.status,
      durationMs: result.duration,
      codes: result.errors.flatMap((e) => {
        const m = e.message?.match(/HTTPS acceptance failed: ([a-z0-9-]+)/);
        return m ? [m[1]] : [];
      }),
    };
    this.rows.push(row);
    this.errors.push(
      ...result.errors.map((e) => ({ message: e.message, stack: e.stack })),
    );
    if (this.errors.length) {
      mkdirSync(privateEvidence, { recursive: true });
      writeFileSync(
        path.join(privateEvidence, "last-errors.json"),
        JSON.stringify(this.errors, null, 2),
        { mode: 0o600 },
      );
    }
    process.stdout.write(
      `${row.project}: ${row.test}: ${row.status}${row.codes.length ? ` (${row.codes.join(", ")})` : ""}\n`,
    );
  }
  onError(error: TestError) {
    this.errors.push({ message: error.message, stack: error.stack });
    process.stdout.write(
      "HTTPS acceptance runtime failure; private diagnostics retained.\n",
    );
  }
  onStdOut() {}
  onStdErr() {}
  async onEnd(result: FullResult) {
    if (process.argv.includes("--list")) {
      process.stdout.write(
        "HTTPS acceptance discovery complete; no network requests.\n",
      );
      return;
    }
    await mkdir(publicEvidence, { recursive: true });
    await mkdir(privateEvidence, { recursive: true });
    const receipt = {
      recordedAt: new Date().toISOString(),
      projectRef: PROJECT,
      origin: ORIGIN,
      status: result.status,
      durationMs: result.duration,
      fixtureInjection: false,
      tests: this.rows,
    };
    await writeFile(
      path.join(publicEvidence, `run-${Date.now()}.json`),
      JSON.stringify(receipt, null, 2),
    );
    if (this.errors.length)
      await writeFile(
        path.join(privateEvidence, "last-errors.json"),
        JSON.stringify(this.errors, null, 2),
        { mode: 0o600 },
      );
    process.stdout.write(
      `HTTPS acceptance ${result.status}: ${this.rows.length} cases.\n`,
    );
  }
}
