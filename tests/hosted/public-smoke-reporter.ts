import type {
  Reporter,
  TestCase,
  TestResult,
  FullResult,
} from "@playwright/test/reporter";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
export default class PublicSmokeReporter implements Reporter {
  private discovery = process.argv.includes("--list");
  private tests: {
    test: string;
    status: string;
    durationMs: number;
    safeCodes: string[];
  }[] = [];
  onTestEnd(test: TestCase, result: TestResult) {
    const safeCodes = result.errors.flatMap((error) => {
      const match = error.message?.match(
        /^(?:Error: )?Hosted public check failed: ([a-z0-9-]+)$/,
      );
      return match ? [match[1]] : [];
    });
    this.tests.push({
      test: test.title,
      status: result.status,
      durationMs: result.duration,
      safeCodes,
    });
    process.stdout.write(
      `${test.title}: ${result.status}${safeCodes.length ? ` (${safeCodes.join(", ")})` : ""}\n`,
    );
  }
  onStdOut() {}
  onStdErr() {}
  onError() {
    process.stdout.write(
      "Hosted public smoke setup/runtime error; raw details suppressed.\n",
    );
  }
  async onEnd(result: FullResult) {
    if (this.discovery) {
      process.stdout.write(
        "Read-only hosted public smoke discovery only; no browser actions.\n",
      );
      return;
    }
    const directory = path.resolve("docs/qa/hosted-preview");
    await mkdir(directory, { recursive: true });
    await writeFile(
      path.join(directory, "public-smoke-results.json"),
      JSON.stringify(
        {
          recordedAt: new Date().toISOString(),
          projectRef: "bckkllmndoxzpzdqrevb",
          origin: "http://localhost:3000",
          scope:
            "Read-only genuine hosted data; anonymous browsers; no DEMO or account actions",
          status: result.status,
          durationMs: result.duration,
          tests: this.tests,
        },
        null,
        2,
      ),
    );
  }
}
