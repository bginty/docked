import { test, expect, type Page } from "@playwright/test";
import { createHmac } from "node:crypto";
import {
  fixture,
  state,
  check,
  privateRead,
  privateWrite,
  saveAccount,
  PROJECT,
  ORIGIN,
  type Label,
  type Account,
} from "./guard";
export {
  fixture,
  state,
  check,
  privateRead,
  privateWrite,
  saveAccount,
  PROJECT,
  ORIGIN,
  expect,
};
export function phase(code: string) {
  test.info().annotations.push({ type: "checkpoint", description: code });
  process.stdout.write(`Hosted checkpoint: ${code}\n`);
}
export async function account(label: Label): Promise<Account> {
  return (await fixture()).accounts[label];
}
export async function login(page: Page, label: Label) {
  const a = await account(label),
    current = await state();
  phase(`login-${label}`);
  await page.goto("/login");
  await page.locator('[name="email"]').fill(a.email);
  await page
    .locator('[name="password"]')
    .fill(
      current.accounts[label]?.passwordVersion === "recovered"
        ? a.recoveryPassword
        : a.password,
    );
  const response = page.waitForResponse(
    (r) => r.url().endsWith("/api/auth") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  const loginResponse = await response;
  check(
    loginResponse.status() === 200 && (await loginResponse.json()).ok === true,
    "login-response",
  );
  phase(`login-accepted-${label}`);
  await expect(page).toHaveURL(/\/dashboard$/);
  check(
    (await page.context().cookies()).some((c) =>
      c.name.startsWith(`sb-${PROJECT}-auth-token`),
    ),
    "genuine-project-session-cookie",
  );
  await expect(
    page.getByRole("heading", { name: "Follow the evidence." }),
  ).toBeVisible();
  phase(`dashboard-ready-${label}`);
}
export async function api(
  page: Page,
  endpoint: string,
  body?: Record<string, unknown>,
) {
  check(
    endpoint.startsWith("/api/") && !endpoint.includes("//"),
    "same-origin-api",
  );
  return page.evaluate(
    async ({ endpoint, body }) => {
      const response = await fetch(
        endpoint,
        body
          ? {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            }
          : { cache: "no-store" },
      );
      return {
        status: response.status,
        cache: response.headers.get("cache-control"),
        json: await response.json().catch(() => null),
      };
    },
    { endpoint, body },
  );
}
export async function verifyCapturedMail(
  page: Page,
  label: Label,
  type: "signup" | "recovery",
  after: number,
) {
  const a = await account(label);
  phase(`awaiting-captured-${type}-${label}`);
  const deadline = Date.now() + 90000;
  while (Date.now() < deadline) {
    let mailbox: {
      projectRef: string;
      messages?: {
        email: string;
        type: string;
        receivedAt: string;
        tokenHash: string;
        redirectTo: string;
      }[];
    } | null = null;
    try {
      mailbox = await privateRead("mailbox.json");
    } catch {}
    if (mailbox) {
      check(mailbox.projectRef === PROJECT, "mailbox-project-identity");
      const mail = mailbox.messages
        ?.filter(
          (m) =>
            m.email === a.email &&
            m.type === type &&
            Date.parse(m.receivedAt) >= after,
        )
        .at(-1);
      if (mail) {
        const redirect = new URL(mail.redirectTo);
        check(
          redirect.origin === ORIGIN && redirect.pathname === "/auth/callback",
          "mail-redirect-origin",
        );
        check(
          type === "signup"
            ? !redirect.searchParams.get("next")
            : redirect.searchParams.get("next") === "/reset-password",
          "mail-redirect-intent",
        );
        check(
          /^[a-zA-Z0-9_-]{20,256}$/.test(mail.tokenHash),
          "captured-token-shape",
        );
        const url = new URL(`https://${PROJECT}.supabase.co/auth/v1/verify`);
        url.searchParams.set("token", mail.tokenHash);
        url.searchParams.set("type", type);
        url.searchParams.set("redirect_to", redirect.toString());
        // Genuine GoTrue verification, in the original PKCE browser context. No synthetic cookies.
        await page.goto(url.toString());
        await expect(page).toHaveURL(
          type === "signup" ? /\/dashboard$/ : /\/reset-password$/,
        );
        return;
      }
    }
    await page.waitForTimeout(1000);
  }
  throw new Error(
    "Hosted capture export unavailable before verification deadline",
  );
}
// The checkpoint and captured events share the hosted database clock. Local
// machine clock skew must not make a fresh genuine message appear stale.
export async function captureCheckpoint(page: Page) {
  const requested = Date.now();
  while (Date.now() - requested < 30000) {
    const mailbox = await privateRead<{
      projectRef: string;
      exportedAt: string;
      databaseNow?: string;
    }>("mailbox.json");
    if (
      mailbox.projectRef === PROJECT &&
      mailbox.databaseNow &&
      Date.parse(mailbox.exportedAt) >= requested
    ) {
      const checkpoint = Date.parse(mailbox.databaseNow);
      check(Number.isFinite(checkpoint), "capture-database-clock");
      return checkpoint;
    }
    await page.waitForTimeout(500);
  }
  throw new Error("Fresh capture clock checkpoint unavailable");
}
export async function rememberIdentity(
  page: Page,
  label: Label,
  passwordVersion: "original" | "recovered" = "original",
) {
  const exported = await api(page, "/api/member");
  check(
    exported.status === 200 && exported.cache?.includes("no-store"),
    "private-account-export",
  );
  const id = exported.json?.profile?.id;
  check(typeof id === "string", "export-account-id");
  await saveAccount(label, id, passwordVersion);
  return exported.json;
}
export async function preferences(page: Page) {
  await page.goto("/dashboard");
  const form = page.locator("#preferences form");
  await form.locator('[name="timezone"]').fill("Australia/Sydney");
  await form.locator('[name="oddsFormat"]').selectOption("decimal");
  await form.locator('[name="sports"]').fill("football,basketball");
  await form.locator('[name="leagues"]').fill("");
  await form.locator('[name="bookmakers"]').fill("");
  await form.locator('[name="digest"]').selectOption("off");
  for (const name of ["edgeAlerts", "education", "analytics", "paused"])
    await form.locator(`[name="${name}"]`).uncheck();
  const response = page.waitForResponse(
    (r) => r.url().endsWith("/api/member") && r.request().method() === "POST",
  );
  await form.getByRole("button", { name: "Save preferences" }).click();
  check((await response).status() === 200, "preference-save");
}
export async function paceSharedAuth(page: Page) {
  const current = await state();
  let times = (current.sharedAuthRequests ?? []).filter(
    (at) => at > Date.now() - 301000,
  );
  while (times.length >= 6) {
    phase("respecting-auth-rate-window");
    await page.waitForTimeout(
      Math.min(30000, Math.max(1000, times[0] + 302000 - Date.now())),
    );
    times = times.filter((at) => at > Date.now() - 301000);
  }
  current.sharedAuthRequests = [...times, Date.now()];
  await privateWrite("state.json", current);
}
export async function logout(page: Page) {
  await paceSharedAuth(page);
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Log out all sessions" }).click();
  await expect(page).toHaveURL(`${ORIGIN}/`);
}
export function totp(secret: string, at = Date.now()) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const character of secret.replace(/=+$/, "").toUpperCase()) {
    const value = alphabet.indexOf(character);
    check(value >= 0, "totp-base32");
    bits += value.toString(2).padStart(5, "0");
  }
  const bytes = [];
  for (let index = 0; index + 8 <= bits.length; index += 8)
    bytes.push(parseInt(bits.slice(index, index + 8), 2));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 30000)));
  const digest = createHmac("sha1", Buffer.from(bytes))
    .update(counter)
    .digest();
  const offset = digest[19] & 15;
  return ((digest.readUInt32BE(offset) & 0x7fffffff) % 1000000)
    .toString()
    .padStart(6, "0");
}
export async function mfa(page: Page, label: Label) {
  await page.goto("/mfa");
  let entries: Partial<
    Record<Label, { factorId: string; secret: string; code?: string }>
  > = {};
  try {
    entries = await privateRead("mfa.json");
  } catch {}
  if (!entries[label]) {
    await paceSharedAuth(page);
    const pending = page.waitForResponse(
      (r) => r.url().endsWith("/api/auth") && r.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Set up authenticator" }).click();
    const response = await pending;
    const payload = await response.json();
    check(
      response.status() === 200 &&
        typeof payload.secret === "string" &&
        typeof payload.factorId === "string",
      "real-mfa-enrollment",
    );
    // Newly issued secrets are immediately retained only in the ignored fixture, never reporter output.
    entries[label] = { factorId: payload.factorId, secret: payload.secret };
    await privateWrite("mfa.json", entries);
  }
  await paceSharedAuth(page);
  if (Date.now() % 30000 > 25000) await page.waitForTimeout(6000);
  entries = await privateRead("mfa.json");
  check(entries[label], "mfa-fixture");
  entries[label]!.code = totp(entries[label]!.secret);
  await privateWrite("mfa.json", entries);
  const fresh = await privateRead<typeof entries>("mfa.json");
  await page.locator('[name="factorId"]').fill(fresh[label]!.factorId);
  await page.locator('[name="code"]').fill(fresh[label]!.code!);
  const pending = page.waitForResponse(
    (r) => r.url().endsWith("/api/auth") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Verify MFA" }).click();
  const response = await pending;
  check(
    response.status() === 200 && (await response.json()).ok === true,
    "real-mfa-challenge",
  );
  await expect(page).toHaveURL(/\/admin$/);
}
