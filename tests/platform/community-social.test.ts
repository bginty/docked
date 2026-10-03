import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  boundedCommunityBody,
  protectedIdentity,
  socialHandle,
  socialActionSchema,
  notificationActionSchema,
  decodeSocialCursor,
  encodeSocialCursor,
  canReviewCommunityMedia,
} from "../../src/core/community-social";

test("private quarantine review permits MFA staff including read-only auditors independently of public region activation", () => {
  for (const role of ["owner", "admin", "editor", "auditor"]) {
    assert.equal(canReviewCommunityMedia("aal2", [role]), true);
    assert.equal(canReviewCommunityMedia("aal1", [role]), false);
  }
  for (const roles of [[], ["member"], ["analyst"], ["verified"], ["official"]])
    assert.equal(canReviewCommunityMedia("aal2", roles), false);
});

test("anonymous community upload and notification requests reject before accessing body bytes", () => {
  const script = `
    const assert = require('node:assert/strict');
    const community = require('./src/app/api/community/route.ts');
    const notifications = require('./src/app/api/notifications/route.ts');
    (async () => {
      for (const POST of [community.POST, notifications.POST]) {
        for (const contentType of ['application/json','multipart/form-data; boundary=fixture']) {
          let reads = 0;
          const request = new Request('http://localhost:3000/api/community', {method:'POST',headers:{origin:'http://localhost:3000','content-type':contentType}});
          Object.defineProperty(request, 'body', {get(){reads++;throw new Error('Body must not be read');}});
          const response = await POST(request);
          assert.equal(response.status,403);
          assert.equal(reads,0);
        }
      }
    })().catch(error=>{console.error(error);process.exitCode=1;});
  `;
  execFileSync(
    process.execPath,
    ["--conditions=react-server", "--import", "tsx", "-e", script],
    {
      cwd: process.cwd(),
      timeout: 20000,
      stdio: "pipe",
      env: {
        ...process.env,
        APP_ENV: "preview",
        SITE_URL: "http://localhost:3000",
        DATABASE_URL: "postgres://invalid@127.0.0.1:1/never_connected",
        NEXT_PUBLIC_SUPABASE_URL: "",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "",
      },
    },
  );
});

test("reserved official identity resists case, separator, badge, math, full-width and common Unicode spoofing", () => {
  for (const name of [
    "Docked",
    "docked_team",
    "D0cked",
    "Dоcked",
    "Dockеd",
    "Dοcked",
    "Ｄｏｃｋｅｄ",
    "𝑫𝒐𝒄𝒌𝒆𝒅",
    "Dócked",
    "Docked ✓",
    "Official",
    "admin",
    "SUPPORT",
    "Moderator",
  ])
    assert.equal(protectedIdentity(name), true, name);
  for (const handle of [
    "docked",
    "d0cked",
    "official_amy",
    "dоcked",
    "a\u200db",
    "api",
    "deleted",
  ])
    assert.equal(socialHandle.safeParse(handle).success, false, handle);
  assert.equal(socialHandle.parse("  sport_reader  "), "sport_reader");
  assert.equal(protectedIdentity("Élodie Martin"), false);
  assert.equal(protectedIdentity("山田"), false);
});
test("social-only input cannot supply verification, official ownership, settlement or cash stake fields", () => {
  const value = {
    action: "post",
    kind: "discussion",
    body: "An opinion only",
    idempotencyKey: "00000000-0000-4000-8000-000000000050",
  };
  assert.equal(socialActionSchema.safeParse(value).success, true);
  for (const injected of [
    { verified: true },
    { authorId: "00000000-0000-4000-8000-000000000001" },
    { odds: "25" },
    { result: "won" },
    { cashStake: 100 },
    { kind: "edge" },
  ])
    assert.equal(
      socialActionSchema.safeParse({ ...value, ...injected }).success,
      false,
    );
  assert.equal(
    socialActionSchema.safeParse({ ...value, body: "hi\u202e impersonation" })
      .success,
    false,
  );
});
test("separate in-app preferences cannot enable outbound email or push", () => {
  const value = {
    action: "preferences",
    officialEdges: false,
    followedMembers: false,
    social: true,
    leaderboard: false,
    competitions: false,
    dealsMarketing: false,
    inApp: true,
    email: false,
    push: false,
  };
  assert.equal(notificationActionSchema.safeParse(value).success, true);
  assert.equal(
    notificationActionSchema.safeParse({ ...value, email: true }).success,
    false,
  );
  assert.equal(
    notificationActionSchema.safeParse({ ...value, push: true }).success,
    false,
  );
});
test("following a member does not implicitly opt into individual notifications", () => {
  const basic = socialActionSchema.parse({
    action: "follow",
    profileId: "20000000-0000-4000-8000-000000000002",
    enabled: true,
  });
  assert.equal(basic.action, "follow");
  if (basic.action === "follow") assert.equal(basic.notifications, undefined);
  assert.equal(
    socialActionSchema.safeParse({
      action: "mute",
      profileId: "20000000-0000-4000-8000-000000000002",
      enabled: true,
      notifications: true,
    }).success,
    false,
  );
});
test("social cursor accepts only an exact timestamp and UUID pair", () => {
  const id = "00000000-0000-4000-8000-000000000050",
    at = "2026-10-03T00:00:00.000Z";
  assert.deepEqual(decodeSocialCursor(encodeSocialCursor(at, id)), {
    createdAt: at,
    id,
  });
  for (const input of ["bad", `${at}|${id}|extra`, "now|injection"])
    assert.throws(() => decodeSocialCursor(input));
});
test("body cap counts streamed bytes without relying on missing or forged Content-Length", async () => {
  const make = (chunks: Uint8Array[], length?: string) =>
    new Request("http://localhost/api/community", {
      method: "POST",
      headers: length ? { "Content-Length": length } : {},
      body: new ReadableStream({
        start(c) {
          for (const chunk of chunks) c.enqueue(chunk);
          c.close();
        },
      }),
      duplex: "half",
    } as RequestInit);
  assert.deepEqual(
    [
      ...(await boundedCommunityBody(
        make([new Uint8Array([1, 2]), new Uint8Array([3])]),
        3,
      )),
    ],
    [1, 2, 3],
  );
  await assert.rejects(
    () => boundedCommunityBody(make([new Uint8Array(4)]), 3),
    /too large/,
  );
  await assert.rejects(
    () => boundedCommunityBody(make([new Uint8Array(4)], "1"), 3),
    /too large/,
  );
});
