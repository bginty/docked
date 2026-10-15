// Dedicated local Auth acceptance extension. No hosted credentials or member data.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type postgres from "postgres";
import { request, type APIRequestContext } from "@playwright/test";
import { redemptionFixture } from "../tests/fixtures/redemption-state";
import { validateCredits } from "../src/core/credits-sandbox";
import { validateRedemption } from "../src/core/redemption";
import { initialMemberTestCredits } from "../src/core/member-test-wallet";

export async function seedRedemptionAuth(
  sql: postgres.Sql,
  users: { id: string }[],
) {
  assert.equal(
    (await sql`select current_database() name`)[0].name,
    "docked_redemption_local_auth",
  );
  const existing = await sql`select document from credits_sandbox.state`;
  if (existing.length) {
    // Repair only an unused synthetic seed from an interrupted local setup.
    const old = existing[0].document;
    if (
      old.events.length === 0 &&
      old.redemption?.version === "synthetic-redemption-v1" &&
      old.policy.version !== initialMemberTestCredits().policy.version
    )
      await sql`update credits_sandbox.state set document=jsonb_set(document,'{policy}',${sql.json(initialMemberTestCredits().policy as any)})`;
    return;
  }
  const f = redemptionFixture(Date.now(), false);
  let encoded = JSON.stringify(f.state);
  for (const [old, next] of [
    [f.actors.member.id, users[0].id],
    [f.actors.other.id, users[1].id],
    [f.actors.staff.id, users[3].id],
    [f.actors.staff2.id, users[2].id],
  ])
    encoded = encoded.replaceAll(old, next);
  const s = JSON.parse(encoded);
  s.policy = initialMemberTestCredits().policy;
  validateCredits(s);
  validateRedemption(s);
  await sql.begin(async (tx) => {
    await tx`insert into credits_sandbox.state values(true,0,${tx.json(s)})`;
    for (const j of s.journal) {
      await tx`insert into credits_sandbox.journal values(${j.id},${tx.json(j)})`;
      for (const [i, l] of j.lines.entries())
        await tx`insert into credits_sandbox.lines values(${j.id},${i},${l.account},${l.credits})`;
    }
    for (const p of ["identity", "review", "payment"])
      await tx`insert into credits_sandbox.redemption_staff values(${users[3].id},${p},true)`;
    // A separately permissioned member cannot acquire staff authority via a query parameter.
    await tx`insert into credits_sandbox.redemption_staff values(${users[2].id},'payment',true)`;
  });
}
export async function runRedemptionAuth({
  sql,
  contexts,
  qa,
  totp,
  origin,
}: {
  sql: postgres.Sql;
  contexts: APIRequestContext[];
  qa: any;
  totp: (s: string) => string;
  origin: string;
}) {
  const checks: string[] = [],
    member = contexts[0],
    other = contexts[1],
    staff = contexts[3];
  const get = async (c: APIRequestContext, admin = false) => {
    const r = await c.get("/api/redemptions" + (admin ? "?admin=true" : ""));
    assert.equal(r.status(), 200, await r.text());
    return r.json();
  };
  const post = async (
    c: APIRequestContext,
    operation: unknown,
    admin = false,
    id = randomUUID(),
  ) => {
    const r = await c.post("/api/redemptions" + (admin ? "?admin=true" : ""), {
      data: { request: id, operation },
    });
    assert.equal(r.status(), 200, await r.text());
    return r.json();
  };
  const anon = await request.newContext({
    baseURL: origin,
    extraHTTPHeaders: { Origin: origin },
  });
  try {
    assert.equal((await anon.get("/api/redemptions")).status(), 403);
    assert.equal(
      (await other.get("/api/redemptions?admin=true")).status(),
      403,
    );
    assert.equal(
      (await contexts[2].get("/api/redemptions?admin=true")).status(),
      403,
      "AAL1 cannot use a payment grant",
    );
    assert.equal(
      (await staff.get("/api/redemptions?admin=true")).status(),
      403,
      "Owner must complete MFA in this HTTP session",
    );
    const mfa = await staff.post("/api/auth", {
      data: { action: "mfa_verify", code: totp(qa.totp.secret), app: true },
    });
    assert.equal(mfa.status(), 200, await mfa.text());
    assert.equal((await mfa.json()).ok, true, "HTTP session TOTP verification");
    await get(staff, true);
    checks.push(
      "Real password login, admission, anonymous denial, member denial, staff permission and real TOTP AAL2 gate",
    );
    if ((await get(member)).identity === "VERIFIED") {
      await post(
        staff,
        {
          action: "identity-review",
          member: qa.users[0].id,
          status: "REVOKED",
          reason: "Isolated fixture re-verification acceptance",
        },
        true,
      );
    }
    await post(member, {
      action: "identity-submit",
      evidence: `fixture-evidence-${qa.users[0].id}`,
    });
    assert.equal((await get(member)).identity, "SUBMITTED");
    const forged = await other.post("/api/redemptions", {
      data: {
        request: randomUUID(),
        operation: {
          action: "identity-review",
          member: qa.users[0].id,
          status: "VERIFIED",
          reason: "forged member approval",
        },
      },
    });
    assert.notEqual(forged.status(), 200);
    await post(
      staff,
      {
        action: "identity-review",
        member: qa.users[0].id,
        status: "VERIFIED",
        reason: "Synthetic local evidence reviewed",
        expires: Date.now() + 86400000,
      },
      true,
    );
    const bankId = randomUUID();
    await post(
      member,
      {
        action: "bank-save",
        bank: { holder: "Alex Example", bsb: "001234", account: "00001234" },
      },
      false,
      bankId,
    );
    const before = await get(member),
      ref = randomUUID(),
      op = {
        action: "submit",
        aud: "100.00",
        destination: bankId,
        confirmed: true,
      };
    // Discard the first response, then recover using exactly the same operation identity.
    await post(member, op, false, ref);
    const recovered = await post(member, op, false, ref);
    assert.equal(recovered.balance.pending, before.balance.pending + 10000);
    assert.equal(recovered.balance.available, before.balance.available - 10000);
    assert.equal(recovered.requests.filter((x: any) => x.id === ref).length, 1);
    assert.ok(!JSON.stringify(recovered).includes("00001234"));
    assert.ok(!(await get(other)).requests.some((x: any) => x.id === ref));
    const theft = await other.post("/api/redemptions", {
      data: {
        request: randomUUID(),
        operation: {
          action: "cancel",
          withdrawal: ref,
          reason: "Cross-account cancellation",
        },
      },
    });
    assert.notEqual(theft.status(), 200);
    checks.push(
      "Evidence cannot approve identity; encrypted leading-zero destination; exact reservation and same-ID lost-response recovery; customer history and mutation isolation",
    );
    for (const action of ["approve", "claim"])
      await post(
        staff,
        { action, withdrawal: ref, reason: "Local acceptance only" },
        true,
      );
    const revealed = await post(
      staff,
      { action: "bank-access", reference: ref },
      true,
    );
    assert.equal(revealed.revealed.bsb, "001234");
    assert.equal(revealed.revealed.account, "00001234");
    for (const action of ["sent", "return"])
      await post(
        staff,
        {
          action,
          withdrawal: ref,
          reason: "Synthetic EFT record; no bank payment",
          reference: `local-${action}-${ref}`,
          confirmed: true,
        },
        true,
      );
    assert.equal(
      (await get(member)).balance.available,
      before.balance.available,
    );
    const state = (await sql`select document from credits_sandbox.state`)[0]
      .document;
    validateCredits(state);
    validateRedemption(state);
    assert.equal(
      state.redemption.access.filter((x: any) => x.reference === ref).length,
      1,
    );
    checks.push(
      "Staff claim, audited bank reveal, synthetic sent and return through actual HTTP/ledger restore exact original eligible funds",
    );
    const saved = await member.storageState();
    await member.post("/api/auth", { data: { action: "logout" } });
    const stale = await request.newContext({
      baseURL: origin,
      storageState: saved,
    });
    try {
      assert.equal((await stale.get("/api/redemptions")).status(), 403);
    } finally {
      await stale.dispose();
    }
    await member.post("/api/auth", {
      data: {
        action: "login",
        email: qa.users[1].email,
        password: qa.password,
        app: true,
      },
    });
    assert.equal((await get(member)).member, qa.users[1].id);
    assert.equal((await get(member)).requests.length, 0);
    checks.push(
      "Logged-out session denied even with retained cookie; account switching cannot show previous member history",
    );
    const persisted = await other.storageState();
    const cookie = persisted.cookies
      .filter((c) => c.name.startsWith("sb-") && c.name.includes("auth-token"))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((c) => c.value)
      .join("");
    const token = JSON.parse(
      Buffer.from(cookie.replace(/^base64-/, ""), "base64url").toString(),
    );
    const claims = JSON.parse(
      Buffer.from(token.access_token.split(".")[1], "base64url").toString(),
    );
    assert.ok(claims.exp * 1000 - Date.now() < 190000);
    console.log(
      "Local authenticated redemption passed; waiting for real short-lived JWT expiry and refresh.",
    );
    while (Date.now() <= claims.exp * 1000 + 1200)
      await new Promise((r) =>
        setTimeout(r, Math.min(15000, claims.exp * 1000 + 1300 - Date.now())),
      );
    const reopen = await request.newContext({
      baseURL: origin,
      storageState: persisted,
    });
    try {
      assert.equal((await get(reopen)).member, qa.users[1].id);
      assert.notDeepEqual(
        (await reopen.storageState()).cookies,
        persisted.cookies,
      );
    } finally {
      await reopen.dispose();
    }
    checks.push(
      "Reopen after genuine JWT expiry refreshes through local GoTrue, retaining correct member identity",
    );
    return checks;
  } finally {
    await anon.dispose();
  }
}
