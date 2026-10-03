import type {
  Reporter,
  TestCase,
  TestResult,
  FullResult,
  Suite,
  FullConfig,
  TestError,
} from "@playwright/test/reporter";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
export default class RedactedReporter implements Reporter {
  private readonly discovery = process.argv.includes("--list");
  private results: {
    project: string;
    test: string;
    status: string;
    durationMs: number;
    checkpoints: string[];
    safeCodes: string[];
    blocked: string[];
  }[] = [];
  onBegin(_config: FullConfig, suite: Suite) {
    if (this.discovery)
      process.stdout.write(
        `Hosted discovery only: ${suite.allTests().length} cases; no account actions.\n`,
      );
  }
  onTestEnd(test: TestCase, result: TestResult) {
    const row = {
      project: test.parent.project()?.name ?? "hosted",
      test: test.title,
      status: result.status,
      durationMs: result.duration,
      checkpoints: test.annotations
        .filter(
          (a) =>
            a.type === "checkpoint" &&
            /^[A-Za-z0-9-]+$/.test(a.description ?? ""),
        )
        .map((a) => a.description!),
      safeCodes: result.errors.flatMap((e) => {
        const match =
          e.message?.match(
            /^Error: Hosted acceptance check failed: ([A-Za-z0-9-]+)$/,
          ) ??
          e.message?.match(/^Hosted acceptance check failed: ([A-Za-z0-9-]+)$/);
        return match ? [match[1]] : [];
      }),
      blocked: test.annotations
        .filter(
          (a) =>
            a.type === "skip" &&
            /^BLOCKED: [A-Za-z0-9-]+$/.test(a.description ?? ""),
        )
        .map((a) => a.description!),
    };
    this.results.push(row);
    process.stdout.write(`${row.project}: ${row.test}: ${row.status}\n`);
    for (const code of row.safeCodes)
      process.stdout.write(`Hosted check failed: ${code}\n`);
    for (const reason of row.blocked) process.stdout.write(`${reason}\n`);
    // Retain only anchored static assertion codes, never raw errors, URLs or attachments.
  }
  onError(error: TestError) {
    const code = error.message?.match(
      /^(?:Error: )?Hosted acceptance check failed: ([A-Za-z0-9-]+)$/,
    )?.[1];
    if (code) process.stdout.write(`Hosted check failed: ${code}\n`);
    process.stdout.write(
      "Hosted setup/runtime failure. Inspect only guarded local diagnostics; raw errors are suppressed.\n",
    );
  }
  onStdOut(chunk: string | Buffer) {
    for (const line of chunk.toString().split(/\r?\n/))
      if (/^Hosted checkpoint: [A-Za-z0-9-]+$/.test(line))
        process.stdout.write(`${line}\n`);
  }
  onStdErr() {}
  async onEnd(result: FullResult) {
    if (this.discovery) return;
    const directory = path.resolve("private-data/hosted-preview");
    await mkdir(directory, { recursive: true });
    const summary = JSON.stringify(
      {
        recordedAt: new Date().toISOString(),
        status: result.status,
        durationMs: result.duration,
        tests: this.results,
      },
      null,
      2,
    );
    await writeFile(path.join(directory, "browser-summary.json"), summary, {
      mode: 0o600,
    });
    await writeFile(
      path.join(directory, `browser-run-${Date.now()}.json`),
      summary,
      { mode: 0o600 },
    );
    process.stdout.write(
      `Hosted acceptance: ${result.status}; ${this.results.length} completed cases.\n`,
    );
  }
}
