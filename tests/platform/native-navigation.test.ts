import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  nativeAuthCallback,
  nativeDeepLink,
  nativeNotificationRoute,
  safeSharePath,
} from "../../src/core/native-navigation";
const id = "00000000-0000-4000-8000-000000000123";
test("native links canonicalize official results and community records without importing session tokens", () => {
  assert.equal(nativeDeepLink(`docked://edges/${id}`), `/tips/${id}`);
  assert.equal(
    nativeDeepLink(`https://docked.com.au/results/${id}`),
    `/tips/${id}`,
  );
  assert.equal(
    nativeDeepLink(`docked://community/${id}`),
    `/community/posts/${id}`,
  );
  assert.equal(
    nativeDeepLink(`docked://community/edges/${id}`),
    `/community/edges/${id}`,
  );
  assert.equal(
    nativeDeepLink("docked://profile/member_one"),
    "/profile/member_one",
  );
  for (const url of [
    "https://evil.example/home",
    "https://docked.com.au.evil.example/home",
    "javascript:alert(1)",
    "docked://home?access_token=private",
    "docked://home#refresh_token=private",
    "https://docked.com.au:444/home",
    "https://user:password@docked.com.au/home",
    "docked://admin",
    "docked://profile/a%2Fb",
  ])
    assert.equal(nativeDeepLink(url), null);
});
test("native auth callbacks accept only a code for the original same-origin PKCE exchange", () => {
  assert.equal(
    nativeAuthCallback(
      "docked://auth/callback?code=valid_code_123&next=%2Freset-password",
    ),
    "/auth/callback?code=valid_code_123&next=%2Freset-password",
  );
  for (const query of [
    "code=valid_code_123&next=https://evil.example",
    "code=valid_code_123&code=secondcode",
    "access_token=private",
    "token_hash=private&type=signup",
    "code=short",
    "code=valid_code_123#access_token=private",
  ])
    assert.equal(nativeAuthCallback(`docked://auth/callback?${query}`), null);
  assert.equal(
    nativeAuthCallback(
      "https://evil.example/auth/callback?code=valid_code_123",
    ),
    null,
  );
});
test("push route groundwork rejects arbitrary payloads and share links discard no hidden sensitive data", () => {
  assert.equal(
    nativeNotificationRoute({ type: "official_edge", path: `/tips/${id}` }),
    `/tips/${id}`,
  );
  assert.equal(
    nativeNotificationRoute({ type: "system", path: "/admin" }),
    null,
  );
  assert.equal(
    nativeNotificationRoute({ type: "unknown", path: "/home" }),
    null,
  );
  assert.equal(nativeNotificationRoute(null), null);
  assert.equal(
    nativeNotificationRoute({
      type: "official_edge",
      path: "/profile/member_one",
    }),
    null,
  );
  assert.equal(
    nativeNotificationRoute({ type: "reply", path: `/community/edges/${id}` }),
    null,
  );
  assert.equal(safeSharePath("//evil.example/home"), null);
  assert.equal(safeSharePath("/home?token=private"), null);
});
test("Android foundation blocks release, backup and arbitrary cleartext, with no Firebase activation", () => {
  const gradle = readFileSync("android/app/build.gradle", "utf8");
  assert.match(gradle, /throw new GradleException\('Docked release is BLOCKED/);
  assert.doesNotMatch(gradle, /apply plugin: 'com.google.gms.google-services'/);
  const manifest = readFileSync(
    "android/app/src/main/AndroidManifest.xml",
    "utf8",
  );
  assert.match(manifest, /android:allowBackup="false"/);
  assert.match(manifest, /android:usesCleartextTraffic="false"/);
  assert.doesNotMatch(
    manifest,
    /POST_NOTIFICATIONS|READ_EXTERNAL_STORAGE|WRITE_EXTERNAL_STORAGE/,
  );
  const config = readFileSync("capacitor.config.ts", "utf8");
  assert.match(config, /preview !== "http:\/\/localhost:3000"/);
  assert.doesNotMatch(config, /allowNavigation|SUPABASE|service_role/);
});
