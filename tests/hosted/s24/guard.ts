import { readFileSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";

export const PROJECT = "bckkllmndoxzpzdqrevb";
export const publicEvidence = path.resolve(
  "docs/qa/android-https-preview/hosted",
);
export const privateEvidence = path.resolve(
  "private-data/android-preview/hosted",
);
export function check(value: unknown, code: string): asserts value {
  if (!value) throw new Error(`HTTPS acceptance failed: ${code}`);
}
export function previewOrigin() {
  try {
    const manifest = JSON.parse(
      readFileSync("config/hosted-preview.json", "utf8"),
    );
    const url = new URL(manifest.origin);
    check(
      manifest.schemaVersion === 1 &&
        manifest.projectName === "docked-preview" &&
        manifest.target === "preview" &&
        manifest.supabaseProjectRef === PROJECT,
      "preview-manifest-identity",
    );
    check(
      url.origin === manifest.origin &&
        url.protocol === "https:" &&
        !url.port &&
        !url.username &&
        !url.password &&
        /^[a-z0-9-]+\.vercel\.app$/.test(url.hostname),
      "isolated-canonical-https-origin",
    );
    return url.origin;
  } catch {
    throw new Error("HTTPS acceptance failed: preview-manifest-invalid");
  }
}
export const ORIGIN = previewOrigin();
export function executionGuard() {
  check(
    process.env.DOCKED_HTTPS_ACCEPTANCE === PROJECT,
    "explicit-hosted-execution-authority",
  );
  check(
    !process.env.DEBUG &&
      !process.env.PWDEBUG &&
      !process.env.PW_TEST_HTML_REPORT_OPEN,
    "diagnostic-output-disabled",
  );
  check(previewOrigin() === ORIGIN, "manifest-remains-identical");
  try {
    execFileSync(
      "git",
      [
        "check-ignore",
        "--quiet",
        "--",
        path.resolve("private-data/android-preview/acceptance.json"),
      ],
      { stdio: "ignore" },
    );
  } catch {
    throw new Error("HTTPS acceptance failed: private-output-must-be-ignored");
  }
}
export type Account = {
  id: string;
  email: string;
  password: string;
  disposable?: boolean;
};
export function accounts(): { memberA: Account; memberB: Account } {
  executionGuard();
  check(
    process.env.DOCKED_HTTPS_AUTH_ACCEPTANCE === PROJECT,
    "explicit-authenticated-test-authority",
  );
  try {
    const file = path.resolve("private-data/android-preview/acceptance.json");
    const age = Date.now() - statSync(file).mtimeMs;
    check(age >= 0 && age < 86400000, "fresh-disposable-account-fixture");
    const value = JSON.parse(readFileSync(file, "utf8"));
    check(
      value.projectRef === PROJECT &&
        value.qaFixture === true &&
        Date.parse(value.expiresAt) > Date.now(),
      "active-disposable-fixture-project-binding",
    );
    for (const key of ["memberA", "memberB"]) {
      const a = value[key];
      check(
        a &&
          /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
            a.id,
          ),
        "disposable-auth-identity",
      );
      check(
        a.email ===
          `docked-preview-s24-qa-${key === "memberA" ? "a" : "b"}-20261003@example.invalid`,
        "exact-disposable-roster-address",
      );
      check(
        typeof a.password === "string" &&
          a.password.length >= 20 &&
          a.password.length <= 128,
        "private-disposable-password",
      );
    }
    check(
      value.memberA.id !== value.memberB.id &&
        value.memberA.email !== value.memberB.email,
      "distinct-disposable-members",
    );
    check(value.memberB.disposable === true, "explicit-disposable-member-b");
    return value;
  } catch {
    throw new Error("HTTPS acceptance failed: disposable-fixture-unavailable");
  }
}
