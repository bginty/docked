import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
export const PROJECT = "bckkllmndoxzpzdqrevb";
export const ORGANIZATION = "ernfnkcbalhyqpsrzdwa";
export const ORIGIN = "http://localhost:3000";
export const DIRECTORY = path.resolve("private-data/hosted-preview");
export const LABELS = [
  "memberA",
  "memberB",
  "restricted",
  "analyst",
  "editor",
  "admin",
  "auditor",
] as const;
export type Label = (typeof LABELS)[number];
export type Account = {
  email: string;
  password: string;
  recoveryPassword: string;
  handle: string;
  country: "AU";
  state: "NSW" | "WA";
  unsubscribeToken?: string;
};
export type Fixture = {
  projectRef: string;
  organizationId: string;
  siteOrigin: string;
  supabaseUrl: string;
  runId: string;
  mailHook: {
    verified: boolean;
    verifiedAt: string;
    externalDeliveryDisabled: boolean;
  };
  capabilities: {
    community: boolean;
    privileged: boolean;
    deleteAccounts: boolean;
  };
  accounts: Record<Label, Account>;
};
export type State = {
  accounts: Partial<
    Record<Label, { id: string; passwordVersion: "original" | "recovered" }>
  >;
  postId?: string;
  mediaId?: string;
  sharedAuthRequests?: number[];
};
export function check(value: unknown, safeCode: string): asserts value {
  if (!value) throw new Error(`Hosted acceptance check failed: ${safeCode}`);
}
export async function privateRead<T>(name: string): Promise<T> {
  check(/^[a-z-]+\.json$/.test(name), "private-file-name");
  try {
    return JSON.parse(await readFile(path.join(DIRECTORY, name), "utf8")) as T;
  } catch {
    throw new Error("Hosted acceptance private fixture unavailable or invalid");
  }
}
export async function privateWrite(name: string, data: unknown) {
  check(/^[a-z-]+\.json$/.test(name), "private-file-name");
  await mkdir(DIRECTORY, { recursive: true });
  await writeFile(path.join(DIRECTORY, name), JSON.stringify(data), {
    mode: 0o600,
  });
}
export async function fixture(): Promise<Fixture> {
  check(
    process.env.DOCKED_HOSTED_ACCEPTANCE === PROJECT,
    "explicit-preview-run-guard",
  );
  try {
    execFileSync(
      "git",
      [
        "check-ignore",
        "--quiet",
        "--",
        path.join(DIRECTORY, "acceptance.json"),
      ],
      { stdio: "ignore" },
    );
  } catch {
    throw new Error(
      "Hosted credentials must remain in the ignored private directory",
    );
  }
  check(
    !process.env.DEBUG &&
      !process.env.PWDEBUG &&
      !process.env.PW_TEST_HTML_REPORT_OPEN,
    "debug-output-disabled",
  );
  const f = await privateRead<Fixture>("acceptance.json");
  check(
    f.projectRef === PROJECT && f.organizationId === ORGANIZATION,
    "dedicated-project-identity",
  );
  check(
    f.siteOrigin === ORIGIN &&
      f.supabaseUrl === `https://${PROJECT}.supabase.co`,
    "preview-origins",
  );
  const age = Date.now() - Date.parse(f.mailHook?.verifiedAt);
  check(
    f.mailHook?.verified === true &&
      f.mailHook.externalDeliveryDisabled === true &&
      age >= 0 &&
      age < 86400000,
    "fresh-proven-mail-hook",
  );
  check(/^[a-z0-9-]{6,24}$/.test(f.runId), "safe-run-id");
  check(
    f.capabilities &&
      [
        f.capabilities.community,
        f.capabilities.privileged,
        f.capabilities.deleteAccounts,
      ].every((value) => typeof value === "boolean"),
    "explicit-capability-scope",
  );
  const addresses = new Set<string>();
  for (const label of LABELS) {
    const account = f.accounts?.[label];
    check(
      account &&
        /^docked-preview-[a-z0-9-]+@example\.invalid$/.test(account.email),
      "allowlisted-test-address-format",
    );
    check(!addresses.has(account.email), "unique-test-address");
    addresses.add(account.email);
    check(
      typeof account.password === "string" &&
        account.password.length >= 20 &&
        account.password.length <= 128,
      "password-source",
    );
    check(
      typeof account.recoveryPassword === "string" &&
        account.recoveryPassword.length >= 20 &&
        account.recoveryPassword !== account.password,
      "recovery-password-source",
    );
    check(/^[a-z][a-z0-9_]{2,23}$/.test(account.handle), "profile-handle");
    check(
      account.country === "AU" &&
        account.state === (label === "restricted" ? "WA" : "NSW"),
      "isolated-region-scope",
    );
  }
  return f;
}
export async function state(): Promise<State> {
  try {
    const value = JSON.parse(
      await readFile(path.join(DIRECTORY, "state.json"), "utf8"),
    ) as State;
    check(
      value.accounts && typeof value.accounts === "object",
      "private-state-shape",
    );
    return value;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT")
      return { accounts: {} };
    throw new Error("Hosted acceptance check failed: private-state-unreadable");
  }
}
export async function saveAccount(
  label: Label,
  id: string,
  passwordVersion: "original" | "recovered" = "original",
) {
  check(/^[0-9a-f-]{36}$/.test(id), "actual-account-id");
  const current = await state();
  current.accounts[label] = { id, passwordVersion };
  await privateWrite("state.json", current);
}
