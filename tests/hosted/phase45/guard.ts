import { readFile, stat } from "node:fs/promises";
import { z } from "zod";
export const origin = "https://docked-preview-s24-briant-ginty.vercel.app";
export const projectRef = "bckkllmndoxzpzdqrevb";
export const organizationId = "ernfnkcbalhyqpsrzdwa";
const accountSchema = z.object({
  kind: z.enum(["qa-a", "qa-b", "seed-a", "seed-b"]),
  email: z.email(),
  password: z.string().min(32).max(128),
  username: z.string().min(3).max(24),
  displayName: z.string().min(3).max(60),
  invitationCode: z.string().min(32).max(100),
  invitationId: z.uuid(),
  disposable: z.boolean(),
});
const fixtureSchema = z.object({
  projectRef: z.literal(projectRef),
  organizationId: z.literal(organizationId),
  origin: z.literal(origin),
  qaFixture: z.literal(true),
  runId: z.uuid(),
  createdAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
  accounts: z.array(accountSchema).length(4),
});
export type BetaFixture = z.infer<typeof fixtureSchema>;
export type BetaAccount = BetaFixture["accounts"][number];
export class CheckpointFailure extends Error {
  constructor(readonly checkpoint: string) {
    super("Preview acceptance checkpoint failed");
  }
}
export function check(value: unknown, checkpoint: string): asserts value {
  if (!value) throw new CheckpointFailure(checkpoint);
}
export function validateFixture(value: unknown, now = Date.now()): BetaFixture {
  const parsed = fixtureSchema.safeParse(value);
  check(parsed.success, "exact-fixture-schema");
  const f = parsed.data,
    created = Date.parse(f.createdAt),
    expiry = Date.parse(f.expiresAt);
  check(
    Number.isFinite(now) &&
      created <= now &&
      now - created < 86400000 &&
      expiry > now + 900000 &&
      expiry - created <= 8 * 86400000,
    "fresh-unexpired-fixture",
  );
  check(
    new Set(f.accounts.map((a) => a.kind)).size === 4 &&
      new Set(f.accounts.map((a) => a.invitationId)).size === 4,
    "distinct-exact-roster",
  );
  for (const a of f.accounts) {
    const expectedName =
      a.kind === "seed-a"
        ? "DEMO Harbour Tester"
        : a.kind === "seed-b"
          ? "DEMO Court Tester"
          : `DEMO ${a.kind.toUpperCase()}`;
    check(
      a.email ===
        `docked-preview-phase45-${a.kind}-${f.runId}@example.invalid` &&
        a.username ===
          `demo_${a.kind.replace("-", "")}_${f.runId.slice(0, 8)}` &&
        a.displayName === expectedName &&
        a.disposable === a.kind.startsWith("qa-"),
      "exact-scoped-test-account",
    );
  }
  return f;
}
export async function loadFixture() {
  check(
    process.env.DOCKED_PHASE45_ACCEPTANCE === projectRef &&
      process.env.DOCKED_PHASE45_WRITES === "INVITED_TEST_ACCOUNTS_ONLY",
    "explicit-preview-write-optins",
  );
  const path = "private-data/phase45-beta/acceptance.json",
    info = await stat(path);
  check(
    info.isFile() && info.size > 0 && info.size < 20000,
    "bounded-private-fixture",
  );
  return validateFixture(JSON.parse(await readFile(path, "utf8")));
}
export type RequestScope = {
  account: BetaAccount;
  profileIds: ReadonlySet<string>;
  postIds: ReadonlySet<string>;
  commentIds: ReadonlySet<string>;
  reviewIds: ReadonlySet<string>;
};
/** Browser-only boundary: no service credentials, provider calls, arbitrary people or ledgers. */
export function allowedRequest(
  urlString: string,
  method: string,
  body: string | null,
  scope: RequestScope,
) {
  let u: URL;
  try {
    u = new URL(urlString);
  } catch {
    return false;
  }
  if (["data:", "blob:"].includes(u.protocol)) return method === "GET";
  if (
    u.origin !== origin ||
    u.username ||
    u.password ||
    [...u.searchParams.keys()].some((k) =>
      /password|token|secret|authorization|email|invitation/i.test(k),
    )
  )
    return false;
  if (
    [
      scope.account.password,
      scope.account.email,
      scope.account.invitationCode,
    ].some(
      (s) => urlString.includes(s) || urlString.includes(encodeURIComponent(s)),
    )
  )
    return false;
  if (["GET", "HEAD"].includes(method)) return true;
  if (method !== "POST" || u.search || !body || body.length > 20000)
    return false;
  let v: Record<string, unknown>;
  try {
    v = JSON.parse(body);
  } catch {
    return false;
  }
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  if (u.pathname === "/api/auth")
    return (
      v.action === "logout" ||
      (v.email === scope.account.email &&
        v.password === scope.account.password &&
        (v.action === "login" ||
          (v.action === "signup" &&
            v.invitationCode === scope.account.invitationCode &&
            v.username === scope.account.username &&
            v.confirmPassword === scope.account.password &&
            v.age === true &&
            v.terms === true &&
            v.privacy === true &&
            v.marketing === false)))
    );
  if (u.pathname === "/api/member")
    return (
      v.action === "app_onboarding" ||
      (v.action === "delete" &&
        scope.account.kind === "qa-b" &&
        scope.account.disposable)
    );
  if (u.pathname === "/api/preview-edges")
    return (
      (v.action === "review" &&
        ["demo-football", "demo-basketball"].includes(String(v.fixtureId))) ||
      (v.action === "submit" &&
        scope.reviewIds.has(String(v.reviewId)) &&
        v.confirmed === true)
    );
  if (u.pathname !== "/api/community") return false;
  if (v.action === "profile")
    return (
      v.handle === scope.account.username &&
      v.displayName === scope.account.displayName
    );
  if (v.action === "post")
    return (
      typeof v.body === "string" &&
      v.body.startsWith("[PREVIEW TEST POST]") &&
      !v.officialTipId &&
      !v.communityEdgeId &&
      (!Array.isArray(v.mediaIds) || v.mediaIds.length === 0)
    );
  if (["follow", "mute", "block"].includes(String(v.action)))
    return scope.profileIds.has(String(v.profileId));
  if (["react", "save"].includes(String(v.action)))
    return scope.postIds.has(String(v.postId));
  if (v.action === "comment")
    return (
      scope.postIds.has(String(v.postId)) &&
      (!v.parentId || scope.commentIds.has(String(v.parentId))) &&
      typeof v.body === "string" &&
      v.body.startsWith("[PREVIEW TEST COMMENT]")
    );
  if (v.action === "report")
    return (
      scope.postIds.has(String(v.postId)) &&
      v.reason === "other" &&
      typeof v.details === "string" &&
      v.details.startsWith("[PREVIEW TEST REPORT]")
    );
  return false;
}
