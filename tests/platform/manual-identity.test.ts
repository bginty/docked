import test from "node:test";
import assert from "node:assert/strict";
import { redemptionFixture } from "../fixtures/redemption-state";
import { executeCredits } from "../../src/core/credits-sandbox";
import { prepareRedemption } from "../../src/server/redemption-adapter";
import {
  identityCaseView,
  validateIdentityDocuments,
  type IdentityCaseCommand,
} from "../../src/core/manual-identity";
import {
  IdentityDocumentVault,
  identityFileType,
  retentionCandidates,
} from "../../src/server/identity-documents";
import {
  claimIdentityNotice,
  completeIdentityNotice,
  identityNotification,
  deliverIdentityNotice,
} from "../../src/server/identity-outbox";
const now = Date.parse("2026-10-25T10:00:00Z");

test("manual verification satisfies only identity; withdrawals retain other gates", () => {
  const h = submitted(),
    actor = h.actors.member;
  const withdrawal = {
    action: "submit",
    aud: "100.00",
    destination: h.destination,
    confirmed: true,
  };
  const run = (s: typeof h.state, op: unknown, id: string) =>
    executeCredits(
      s,
      actor,
      id,
      prepareRedemption(s, actor, id, op, now, h.vault),
      now,
    ).state;
  assert.throws(
    () => run(h.state, withdrawal, "unverified"),
    /verified identity/,
  );
  h.run(decision(h), h.actors.staff);
  const state = run(
    h.state,
    {
      action: "bank-save",
      bank: {
        holder: "Synthetic Applicant",
        bsb: "001234",
        account: "00001234",
      },
    },
    h.destination,
  );
  state.redemption!.restrictions[actor.id] = true;
  assert.throws(
    () => run(state, withdrawal, "held"),
    /Account review prevents redemption/,
  );
  delete state.redemption!.restrictions[actor.id];
  delete state.lots["fixture-eligible"].cashEligibility;
  assert.throws(() => run(state, withdrawal, "test-credit"), /Insufficient/);
  assert.equal(Object.keys(state.withdrawals).length, 0);
});

test("worker failure and retry use mocked transport and one submission-version key", async () => {
  const h = submitted(),
    notice = h.state.redemption!.manualIdentity!.outbox[0];
  let clock = now,
    fail = true;
  const sent: string[] = [];
  const queue = {
    async claim(n: number) {
      return claimIdentityNotice(notice, n) ? structuredClone(notice) : null;
    },
    async finish(_id: string, attempt: number, n: number, success: boolean) {
      completeIdentityNotice(notice, attempt, n, success);
    },
  };
  const transport = {
    async send(message: ReturnType<typeof identityNotification>) {
      sent.push(message.idempotencyKey);
      if (fail) throw Error("Mock delivery failure");
    },
  };
  assert.equal(await deliverIdentityNotice(queue, transport, clock), false);
  clock = notice.nextAttempt;
  fail = false;
  assert.equal(await deliverIdentityNotice(queue, transport, clock), true);
  assert.equal(await deliverIdentityNotice(queue, transport, clock), false);
  assert.equal(new Set(sent).size, 1);
  assert.equal(notice.status, "sent");
});
function harness() {
  const f = redemptionFixture(now, false);
  let state = f.state;
  let n = 0;
  return {
    ...f,
    get state() {
      return state;
    },
    run(
      c: IdentityCaseCommand,
      actor = f.actors.member as typeof f.actors.member | typeof f.actors.staff,
      id = `case-${++n}`,
    ) {
      const command = prepareRedemption(
        state,
        actor,
        id,
        { action: "identity-case", case: c },
        now,
        f.vault,
      );
      const result = executeCredits(state, actor, id, command, now);
      state = result.state;
      return result;
    },
  };
}
const save = {
  action: "save",
  revision: 0,
  legalName: "Synthetic Applicant",
  dob: "1990-01-01",
  documents: ["licence", "passport"],
} as const;
function submitted() {
  const h = harness();
  h.run({ ...save, documents: [...save.documents] });
  h.run({ action: "submit", revision: 1, confirmed: true });
  return h;
}
function decision(h: ReturnType<typeof harness>, revision = 2) {
  return {
    action: "review",
    member: h.actors.member.id,
    revision,
    documentVersion: 1,
    decision: "VERIFIED",
    reason: "Synthetic evidence reviewed",
    internalNote: "Private reviewer note",
    checklist: { name: true, dob: true, readable: true },
  } as const;
}
test("two forms, licence sides, duplicate files and scan gates", () => {
  const h = harness();
  h.run({ ...save, documents: ["licence"] });
  const docs =
    h.state.redemption!.manualIdentity!.cases[h.actors.member.id].documents;
  assert.equal(docs[0].files.length, 2);
  assert.throws(() => validateIdentityDocuments(docs), /two distinct/);
  const s = submitted();
  const full = structuredClone(
    s.state.redemption!.manualIdentity!.cases[s.actors.member.id].documents,
  );
  full[1].files[0].digest = full[0].files[0].digest;
  assert.throws(() => validateIdentityDocuments(full), /same file/);
  full[1].files[0].digest = "new";
  full[0].files[0].scan = "quarantined";
  assert.throws(() => validateIdentityDocuments(full), /security/);
});
test("submission retries, review permissions, stale versions, audit and account privacy", () => {
  const h = harness();
  h.run({ ...save, documents: [...save.documents] }, h.actors.member, "save");
  const submit = { action: "submit", revision: 1, confirmed: true } as const;
  h.run(submit, h.actors.member, "submit");
  h.run(submit, h.actors.member, "submit");
  assert.equal(h.state.redemption!.manualIdentity!.outbox.length, 1);
  assert.throws(
    () => h.run(decision(h), h.actors.staff2),
    /permission|identity/i,
  );
  assert.throws(
    () => h.run({ ...decision(h), documentVersion: 2 }, h.actors.staff),
    /version/,
  );
  h.run(decision(h), h.actors.staff);
  assert.equal(
    h.state.redemption!.identities[h.actors.member.id].status,
    "VERIFIED",
  );
  assert.equal(h.state.journal.length, 2);
  assert.equal(
    identityCaseView(h.state.redemption, h.actors.other).cases.length,
    0,
  );
  assert.ok(
    !JSON.stringify(
      identityCaseView(h.state.redemption, h.actors.member),
    ).includes("Private reviewer note"),
  );
  assert.throws(() => h.run(decision(h), h.actors.staff), /changed/);
  assert.equal(
    h.state.redemption!.manualIdentity!.cases[h.actors.member.id].audit.at(-1)!
      .action,
    "VERIFIED",
  );
});
test("changes and resubmission preserve case and old document version; revoke fails closed", () => {
  const h = submitted();
  h.run(
    { ...decision(h), decision: "MORE_INFORMATION", document: "licence" },
    h.actors.staff,
  );
  const id = h.state.redemption!.manualIdentity!.cases[h.actors.member.id].id;
  h.run({ ...save, revision: 3, documents: ["passport", "secondary"] });
  h.run({ action: "submit", revision: 4, confirmed: true });
  h.run({ ...decision(h, 5), documentVersion: 2 }, h.actors.staff);
  h.run(
    { ...decision(h, 6), documentVersion: 2, decision: "REVOKED" },
    h.actors.staff,
  );
  const c = h.state.redemption!.manualIdentity!.cases[h.actors.member.id];
  assert.equal(c.id, id);
  assert.equal(c.snapshots.length, 2);
  assert.equal(c.status, "REVOKED");
  assert.equal(
    h.state.redemption!.identities[h.actors.member.id].expires,
    undefined,
  );
});
test("self review and real identity details are rejected", () => {
  const h = submitted();
  h.state.redemption!.staff[h.actors.member.id] = ["identity"];
  assert.throws(
    () => h.run(decision(h), { ...h.actors.staff, id: h.actors.member.id }),
    /own case/,
  );
  assert.throws(() =>
    h.run({
      ...save,
      legalName: "Real Name",
      documents: ["licence", "passport"],
    } as never),
  );
});
test("private encrypted quarantine, cross-account denial, scanner and retention fail closed", async () => {
  const rows = new Map<string, Uint8Array>(),
    png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 1]);
  const storage = {
    async put(k: string, v: Uint8Array) {
      rows.set(k, v);
    },
    async get(k: string) {
      return rows.get(k)!;
    },
    async remove(k: string) {
      rows.delete(k);
    },
  };
  let clean = true;
  const vault = new IdentityDocumentVault(storage, Buffer.alloc(32, 9), {
    async scan() {
      return { clean, readable: true, preview: png };
    },
  });
  const r = await vault.quarantine("member-a", png);
  assert.ok(!r.key.includes("member"));
  assert.notDeepEqual(rows.get(r.key), png);
  await assert.rejects(() => vault.inspect({ ...r, owner: "member-b" }));
  assert.deepEqual(await vault.inspect(r), png);
  clean = false;
  await assert.rejects(() => vault.inspect(r), /security/);
  assert.throws(
    () => identityFileType(Buffer.from("%PDF-1.7 /JavaScript (evil)")),
    /Active/,
  );
  assert.throws(() => identityFileType(Buffer.from("fake.jpg")), /Unsupported/);
  assert.throws(() => identityFileType(Buffer.alloc(10485761)), /10 MB/);
  assert.deepEqual(
    retentionCandidates(
      [{ key: r.key, createdAt: 0, hold: false, temporary: true }],
      now,
      null,
    ),
    [],
  );
});
test("notification retries have leases and contain no identity or bearer access", () => {
  const h = submitted(),
    n = h.state.redemption!.manualIdentity!.outbox[0];
  assert.equal(claimIdentityNotice(n, now), true);
  assert.equal(claimIdentityNotice(n, now), false);
  completeIdentityNotice(n, 1, now, false);
  assert.equal(n.status, "failed");
  assert.equal(claimIdentityNotice(n, n.nextAttempt), true);
  assert.throws(() => completeIdentityNotice(n, 1, now, true), /Stale/);
  completeIdentityNotice(n, 2, now, true);
  assert.equal(claimIdentityNotice(n, now + 999999), false);
  const mail = identityNotification(n, "https://docked.com.au");
  assert.ok(mail.text.includes("/admin/identity-verification"));
  assert.ok(!mail.text.includes("Synthetic Applicant"));
  assert.ok(!mail.text.includes("1990"));
  assert.equal(
    h.state.redemption!.manualIdentity!.cases[h.actors.member.id].status,
    "UNDER_REVIEW",
  );
});
