// Explicit operator acceptance only. Real UI/API flows, no fixtures injected into pages.
// No traces, videos, raw browser errors, login captures or saved authentication state.
import {
  chromium,
  type Browser,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { previewSocialSeed } from "../../src/content/preview-social-seed";
import {
  allowedRequest,
  check,
  CheckpointFailure,
  loadFixture,
  origin,
  projectRef,
  type BetaAccount,
  type BetaFixture,
  type RequestScope,
} from "../../tests/hosted/phase45/guard";

type AccountState = {
  userId: string;
  profileId: string;
  posts: string[];
  fixtureId?: string;
  deleted?: boolean;
  deletionState?: "erased" | "revoked_pending";
};
type Journal = {
  runId: string;
  accounts: Partial<Record<BetaAccount["kind"], AccountState>>;
  signupCompleted: Partial<Record<BetaAccount["kind"], boolean>>;
  checkpoints: string[];
};
type Session = {
  context: BrowserContext;
  page: Page;
  scope: RequestScope;
  errors: { console: number; page: number; forbidden: number };
  runtimeErrors: string[];
  deletionRequests: { seen: boolean; statuses: number[] };
};
let stage = "guard",
  browser: Browser | undefined,
  fixture: BetaFixture,
  journal: Journal;
const privateJournal = "private-data/phase45-beta/browser-state.json";
const directory = resolve(
  "docs/qa/phase45/hosted",
  new Date().toISOString().replace(/[:.]/g, "-"),
);
const results: Record<string, unknown>[] = [];
const sessions: Session[] = [];
const verifiedProfiles = new Set<string>(),
  verifiedPosts = new Set<string>();
async function persist() {
  await writeFile(privateJournal, JSON.stringify(journal, null, 2) + "\n", {
    mode: 0o600,
  });
}
async function checkpoint(name: string) {
  journal.checkpoints.push(name);
  await persist();
  console.log(`Passed ${name}.`);
}
async function get(context: BrowserContext, path: string) {
  check(path.startsWith("/api/") && !path.includes("//"), "known-api-path");
  const response = await context.request.get(origin + path, {
    maxRedirects: 0,
  });
  check(new URL(response.url()).origin === origin, "same-origin-api-result");
  return response;
}
async function jsonGet(context: BrowserContext, path: string) {
  const r = await get(context, path);
  check(r.ok(), "authorised-own-api-read");
  return r.json();
}
async function go(page: Page, path: string) {
  check(path.startsWith("/") && !path.startsWith("//"), "known-ui-route");
  await page.goto(origin + path, { waitUntil: "domcontentloaded" });
  check(
    new URL(page.url()).origin === origin &&
      !new URL(page.url()).searchParams.has("password"),
    "same-origin-ui",
  );
}
async function openCompose(s: Session) {
  // This existing client-effect request proves the tab handlers are hydrated;
  // DOMContentLoaded alone can precede the interactive composer on a cold load.
  const ready = s.page.waitForResponse(
    (r) =>
      r.request().method() === "GET" &&
      r.url() === origin + "/api/community-edges?view=options",
  );
  void ready.catch(() => {});
  await go(s.page, "/compose");
  await ready;
}
async function mutation(
  page: Page,
  endpoint: string,
  action: string,
  click: () => Promise<unknown>,
) {
  stage = `ui-${action.replaceAll("_", "-")}`;
  const pending = page.waitForResponse((r) => {
    if (r.url() !== origin + endpoint || r.request().method() !== "POST")
      return false;
    try {
      return r.request().postDataJSON()?.action === action;
    } catch {
      return false;
    }
  });
  // If a UI click fails first, keep the later response timeout from becoming an
  // unhandled raw Playwright exception; the awaited promise still rejects below.
  void pending.catch(() => {});
  await click();
  const response = await pending;
  const value = await response.json();
  check(
    response.ok() && !value.error,
    `accepted-${action.replaceAll("_", "-")}`,
  );
  return value;
}
async function openSession(
  account: BetaAccount,
  phoneScale = 1,
): Promise<Session> {
  const context = await browser!.newContext({
    viewport:
      phoneScale === 3
        ? { width: 360, height: 720 }
        : { width: 412, height: 915 },
    deviceScaleFactor: phoneScale,
    isMobile: true,
    hasTouch: true,
    locale: "en-AU",
    timezoneId: "Australia/Sydney",
    serviceWorkers: "block",
    ignoreHTTPSErrors: false,
  });
  context.setDefaultTimeout(30000);
  context.setDefaultNavigationTimeout(60000);
  const scope: RequestScope = {
    account,
    profileIds: verifiedProfiles,
    postIds: verifiedPosts,
    commentIds: new Set(),
    reviewIds: new Set(),
  };
  const errors = { console: 0, page: 0, forbidden: 0 },
    runtimeErrors: string[] = [];
  await context.route("**/*", (route) => {
    const r = route.request();
    if (!allowedRequest(r.url(), r.method(), r.postData(), scope)) {
      errors.forbidden++;
      return route.abort("blockedbyclient");
    }
    return route.continue();
  });
  const page = await context.newPage();
  page.on("console", (e) => {
    if (e.type() === "error") errors.console++;
  });
  page.on("pageerror", (error) => {
    errors.page++;
    if (runtimeErrors.length < 10)
      runtimeErrors.push(`${new URL(page.url()).pathname}: ${error.message}`);
  });
  const deletionRequests = { seen: false, statuses: [] as number[] };
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      request.url() === origin + "/api/member"
    ) {
      try {
        if (request.postDataJSON()?.action === "delete")
          deletionRequests.seen = true;
      } catch {
        /* no request body retained */
      }
    }
  });
  page.on("response", (response) => {
    if (
      response.request().method() === "POST" &&
      response.url() === origin + "/api/member"
    ) {
      try {
        if (response.request().postDataJSON()?.action === "delete")
          deletionRequests.statuses.push(response.status());
      } catch {
        /* no request body retained */
      }
    }
  });
  const s = { context, page, scope, errors, runtimeErrors, deletionRequests };
  sessions.push(s);
  return s;
}
async function auth(s: Session, account: BetaAccount, signup: boolean) {
  stage = `${signup ? "invited-signup" : "app-login"}-${account.kind}`;
  await go(s.page, signup ? "/app/signup" : "/app/login");
  const form = s.page.locator('form[action="/api/auth"]');
  await s.page.waitForFunction(
    () =>
      document
        .querySelector('form[action="/api/auth"]')
        ?.getAttribute("data-api-ready") === "true",
  );
  check((await form.getAttribute("method")) === "post", "post-auth-form");
  await form.locator('[name="email"]').fill(account.email);
  await form.locator('[name="password"]').fill(account.password);
  if (signup) {
    await form.locator('[name="username"]').fill(account.username);
    await form.locator('[name="confirmPassword"]').fill(account.password);
    await form.locator('[name="country"]').fill("AU");
    await form.locator('[name="state"]').fill("VIC");
    check(
      !(await form.locator('[name="marketing"]').isChecked()),
      "marketing-not-preselected",
    );
    for (const name of ["age", "terms", "privacy"])
      await form.locator(`[name="${name}"]`).check();
    await form
      .getByRole("checkbox", { name: "I have a Preview invitation" })
      .check();
    await form.locator('[name="invitationCode"]').fill(account.invitationCode);
    check(
      (await form.innerText()).includes("not email ownership"),
      "truthful-invitation-verification",
    );
  }
  await mutation(s.page, "/api/auth", signup ? "signup" : "login", () =>
    form
      .getByRole("button", {
        name: signup ? "Create account" : "Log in",
        exact: true,
      })
      .click(),
  );
  if (signup) {
    journal.signupCompleted[account.kind] = true;
    await persist();
  }
  await s.page.waitForURL(
    (url) =>
      url.origin === origin &&
      ["/app/onboarding", "/edges"].includes(url.pathname),
  );
  if (!signup && journal.accounts[account.kind])
    check(
      new URL(s.page.url()).pathname === "/edges",
      "returning-user-skips-onboarding",
    );
  if (new URL(s.page.url()).pathname === "/app/onboarding") {
    stage = `onboarding-${account.kind}`;
    const onboarding = s.page.locator(".app-onboarding");
    await onboarding
      .getByRole("checkbox", { name: "Football", exact: true })
      .check();
    await onboarding
      .getByRole("button", { name: "Continue", exact: true })
      .click();
    await onboarding.getByRole("radio", { name: "Both", exact: true }).check();
    await onboarding
      .getByRole("button", { name: "Continue", exact: true })
      .click();
    await onboarding
      .getByRole("checkbox", { name: "Official Docked Edges", exact: true })
      .uncheck();
    await onboarding
      .getByRole("checkbox", { name: "People I follow", exact: true })
      .check();
    await onboarding
      .getByRole("checkbox", { name: "Replies & comments", exact: true })
      .check();
    await mutation(s.page, "/api/member", "app_onboarding", () =>
      onboarding
        .getByRole("button", { name: "Enter Docked", exact: true })
        .click(),
    );
    await s.page.waitForURL(origin + "/edges");
  }
  const member = await jsonGet(s.context, "/api/member");
  check(
    typeof member.profile?.id === "string" &&
      member.profile.age_attested === true,
    "verified-own-onboarded-identity",
  );
  if (journal.accounts[account.kind])
    check(
      member.profile.id === journal.accounts[account.kind]!.userId,
      "same-known-test-account",
    );
  const cookies = (await s.context.cookies()).filter((c) =>
    c.name.startsWith(`sb-${projectRef}-auth-token`),
  );
  check(
    cookies.length > 0 &&
      cookies.every((c) => c.secure && c.httpOnly && c.sameSite === "Lax"),
    "secure-private-session-cookies",
  );
  await go(s.page, "/app");
  await s.page.waitForURL(origin + "/edges");
  await s.page.reload({ waitUntil: "domcontentloaded" });
  check(
    (await get(s.context, "/api/member")).status() === 200,
    "session-survives-refresh-app-reopen",
  );
  const bio =
    "DEMO / PREVIEW test profile. Authored software-testing activity only; not a genuine public member or performance record.";
  const existing = await jsonGet(s.context, "/api/community?view=profile");
  if (
    existing.profile?.displayName !== account.displayName ||
    existing.profile?.bio !== bio
  ) {
    await go(s.page, "/profile#edit");
    const editor = s.page.locator("#edit");
    await editor.locator('[name="displayName"]').fill(account.displayName);
    await editor.locator('[name="bio"]').fill(bio);
    await mutation(s.page, "/api/community", "profile", () =>
      editor.getByRole("button", { name: "Save profile", exact: true }).click(),
    );
  }
  const own = await jsonGet(s.context, "/api/community?view=profile");
  check(
    own.profile?.isOwn === true && own.profile.handle === account.username,
    "own-labelled-community-profile",
  );
  journal.accounts[account.kind] = {
    ...journal.accounts[account.kind],
    userId: member.profile.id,
    profileId: own.profile.id,
    posts: journal.accounts[account.kind]?.posts ?? [],
  };
  verifiedProfiles.add(own.profile.id);
  for (const postId of journal.accounts[account.kind]!.posts) {
    const record = (
      await jsonGet(s.context, `/api/community?view=post&id=${postId}`)
    ).posts[0];
    check(
      record?.author.id === own.profile.id &&
        record.body.startsWith("[PREVIEW TEST POST]"),
      "journal-post-belongs-to-verified-test-account",
    );
    verifiedPosts.add(postId);
  }
  await checkpoint(`invited-session-onboarding-${account.kind}`);
}
async function makePost(
  s: Session,
  body: string,
  kind = "discussion",
  sport?: string,
) {
  stage = `social-post-readback-${s.scope.account.kind}`;
  const prior = await jsonGet(s.context, "/api/community?view=profile");
  const matches = prior.posts.filter(
    (p: { author: { id: string }; body: string }) =>
      p.author.id === journal.accounts[s.scope.account.kind]!.profileId &&
      p.body === body,
  );
  check(matches.length <= 1, "no-duplicate-authored-seed-body");
  if (matches.length === 1) {
    const id = matches[0].id;
    if (!journal.accounts[s.scope.account.kind]!.posts.includes(id))
      journal.accounts[s.scope.account.kind]!.posts.push(id);
    verifiedPosts.add(id);
    await persist();
    await go(s.page, `/community/posts/${id}`);
    return id;
  }
  stage = `social-compose-open-${s.scope.account.kind}`;
  await openCompose(s);
  await s.page
    .getByRole("button", { name: "Create post", exact: true })
    .click();
  stage = `social-compose-fields-${s.scope.account.kind}`;
  await s.page.locator('[name="kind"]').selectOption(kind);
  if (sport) await s.page.locator('[name="sport"]').selectOption(sport);
  await s.page
    .getByRole("textbox", { name: "Your post", exact: true })
    .fill(body);
  const value = await mutation(s.page, "/api/community", "post", () =>
    s.page
      .getByRole("button", { name: "Publish social post", exact: true })
      .click(),
  );
  const id = value.post?.id ?? value.id;
  check(typeof id === "string", "created-labelled-post-id");
  const actual = (await jsonGet(s.context, `/api/community?view=post&id=${id}`))
    .posts[0];
  check(
    actual?.author.id === journal.accounts[s.scope.account.kind]!.profileId &&
      actual.body === body,
    "actual-labelled-post-readback",
  );
  journal.accounts[s.scope.account.kind]!.posts.push(id);
  (s.scope.postIds as Set<string>).add(id);
  await persist();
  await s.page.waitForURL(origin + `/community/posts/${id}`);
  return id;
}
async function fixtureFlow(s: Session) {
  stage = `preview-edge-${s.scope.account.kind}`;
  const existingId = journal.accounts[s.scope.account.kind]?.fixtureId;
  if (existingId) {
    const stored = await jsonGet(s.context, "/api/preview-edges");
    const exported = await jsonGet(s.context, "/api/member");
    check(
      stored.records.some(
        (record: { id: string; status: string }) =>
          record.id === existingId && record.status === "PREVIEW_ONLY",
      ) &&
        exported.previewFixtureEvidence?.reviews.some(
          (review: { record_id: string | null }) =>
            review.record_id === existingId,
        ),
      "previous-own-preview-record-and-export-preserved",
    );
    await checkpoint(`fixture-preserved-on-resume-${s.scope.account.kind}`);
    return;
  }
  await openCompose(s);
  await s.page
    .getByRole("button", { name: "DEMO Edge flow", exact: true })
    .click();
  for (const [name, value] of [
    ["Sport", "football"],
    ["Event", "demo-football"],
    ["Market", "DEMO regulation result"],
    ["Selection", "DEMO Harbour FC"],
  ])
    await s.page
      .getByRole("combobox", { name, exact: true })
      .selectOption(value);
  const reviewed = await mutation(s.page, "/api/preview-edges", "review", () =>
    s.page
      .getByRole("button", { name: "Review DEMO market reference" })
      .click(),
  );
  check(
    reviewed.review.label === "DEMO / PREVIEW PRICE" &&
      reviewed.review.reference.evidenceMode === "preview" &&
      reviewed.review.reference.fixture === true,
    "synthetic-reference-explicit",
  );
  (s.scope.reviewIds as Set<string>).add(reviewed.review.id);
  const save = s.page.getByRole("button", {
    name: "Save permanent PREVIEW record",
  });
  check(await save.isDisabled(), "permanent-confirmation-required");
  const previewAxe = await new AxeBuilder({ page: s.page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  check(previewAxe.violations.length === 0, "preview-review-accessibility");
  await s.page.screenshot({
    path: resolve(directory, `demo-price-${s.scope.account.kind}-412.png`),
    fullPage: true,
  });
  await s.page.locator(".preview-price-review").getByRole("checkbox").check();
  const submitted = await mutation(s.page, "/api/preview-edges", "submit", () =>
    save.click(),
  );
  check(typeof submitted.id === "string", "permanent-preview-record-created");
  journal.accounts[s.scope.account.kind]!.fixtureId = submitted.id;
  await persist();
  const stored = await jsonGet(s.context, "/api/preview-edges");
  check(
    stored.records.some(
      (r: { id: string; status: string }) =>
        r.id === submitted.id && r.status === "PREVIEW_ONLY",
    ),
    "own-preview-record-retained",
  );
  const exported = await jsonGet(s.context, "/api/member");
  check(
    exported.previewFixtureEvidence?.reviews.some(
      (r: { record_id: string | null }) => r.record_id === submitted.id,
    ),
    "preview-record-in-own-account-export",
  );
  const real = await jsonGet(s.context, "/api/top-docked");
  check(
    real.status === "RESTRICTED" && real.rows.length === 0,
    "real-rankings-still-denied",
  );
  await go(s.page, "/top-docked");
  await s.page
    .getByRole("heading", { name: "A record earns its place.", exact: true })
    .waitFor();
  check(
    (await s.page.locator("body").innerText()).includes(
      "no settlements, points, ROI or ranking",
    ),
    "separate-honest-preview-ranking-view",
  );
  await checkpoint(`fixture-isolation-${s.scope.account.kind}`);
}
async function socialFlow(s: Session, seed: BetaAccount, postId: string) {
  stage = "real-social-actions";
  await go(s.page, `/community/posts/${postId}`);
  await s.page.waitForFunction(
    () =>
      document
        .querySelector(".social-card")
        ?.getAttribute("data-social-ready") === "true",
  );
  // LocalTimestamp's real client rendering gives readiness evidence; no arbitrary
  // sleep and no production handler injection are used for this cold navigation.
  await s.page.waitForFunction(() => {
    const time = document.querySelector(".social-card time");
    const value = time?.getAttribute("datetime");
    return (
      !!value &&
      time?.textContent ===
        new Date(value).toLocaleString(undefined, { timeZoneName: "short" })
    );
  });
  const card = s.page.locator(".social-card").first();
  await mutation(s.page, "/api/community", "react", () =>
    card.getByRole("button", { name: /reactions$/ }).click(),
  );
  await mutation(s.page, "/api/community", "save", () =>
    card.getByRole("button", { name: "Save", exact: true }).click(),
  );
  await card.getByRole("button", { name: /comments$/ }).click();
  await card
    .getByRole("textbox", { name: "Add a comment", exact: true })
    .fill(
      "[PREVIEW TEST COMMENT] Testing a real saved comment on an explicitly labelled demo discussion.",
    );
  const comment = await mutation(s.page, "/api/community", "comment", () =>
    card.getByRole("button", { name: "Post comment", exact: true }).click(),
  );
  const value = await jsonGet(
    s.context,
    `/api/community?view=post&id=${postId}`,
  );
  const ownComment = value.posts[0]?.comments.find(
    (c: { author: { id: string }; body: string }) =>
      c.author.id === journal.accounts[s.scope.account.kind]!.profileId &&
      c.body.startsWith("[PREVIEW TEST COMMENT]"),
  );
  check(ownComment && comment, "actual-comment-readback");
  (s.scope.commentIds as Set<string>).add(ownComment.id);
  const commentView = card
    .locator(".social-comment")
    .filter({ hasText: ownComment.body })
    .first();
  await commentView.getByRole("button", { name: "Reply", exact: true }).click();
  await commentView
    .getByRole("textbox", { name: "Reply", exact: true })
    .fill(
      "[PREVIEW TEST COMMENT] Nested reply test; no sporting claim or advice.",
    );
  await mutation(s.page, "/api/community", "comment", () =>
    commentView
      .getByRole("button", { name: "Post reply", exact: true })
      .click(),
  );
  await card.locator(".social-actions > details > summary").click();
  await card
    .locator(".social-menu")
    .getByRole("button", { name: "Report", exact: true })
    .first()
    .click();
  await card.locator('select[name="reason"]').selectOption("other");
  await card
    .locator('textarea[name="details"]')
    .fill(
      "[PREVIEW TEST REPORT] QA only: testing moderation routing for this explicitly labelled demo post. No abuse allegation.",
    );
  await mutation(s.page, "/api/community", "report", () =>
    card.getByRole("button", { name: "Send report", exact: true }).click(),
  );
  await go(s.page, `/profile/${seed.username}`);
  await s.page.waitForFunction(
    () =>
      document
        .querySelector(".profile-hero [data-profile-actions-ready]")
        ?.getAttribute("data-profile-actions-ready") === "true",
  );
  await mutation(s.page, "/api/community", "follow", () =>
    s.page.getByRole("button", { name: "Follow", exact: true }).first().click(),
  );
  const following = await jsonGet(
    s.context,
    "/api/community?view=feed&tab=following",
  );
  check(
    following.posts.some((p: { id: string }) => p.id === postId),
    "followed-feed-real-readback",
  );
  await mutation(s.page, "/api/community", "follow", () =>
    s.page
      .getByRole("button", { name: "Unfollow", exact: true })
      .first()
      .click(),
  );
  const menu = s.page.locator(".profile-hero details").first();
  await menu.locator("summary").click();
  await mutation(s.page, "/api/community", "mute", () =>
    menu.getByRole("button", { name: "Mute", exact: true }).click(),
  );
  await s.page.reload({ waitUntil: "domcontentloaded" });
  await s.page.waitForFunction(
    () =>
      document
        .querySelector(".profile-hero [data-profile-actions-ready]")
        ?.getAttribute("data-profile-actions-ready") === "true",
  );
  const menuAgain = s.page.locator(".profile-hero details").first();
  await menuAgain.locator("summary").click();
  await mutation(s.page, "/api/community", "mute", () =>
    menuAgain.getByRole("button", { name: "Unmute", exact: true }).click(),
  );
  await checkpoint(
    "comment-reply-like-save-follow-unfollow-mute-unmute-report",
  );
}
async function screenshot(
  s: Session,
  path: string,
  viewport: { width: number; height: number; deviceScaleFactor?: number },
) {
  stage = "screenshots-accessibility";
  await s.page.setViewportSize({
    width: viewport.width,
    height: viewport.height,
  });
  await go(s.page, path);
  await s.page.waitForFunction(
    () =>
      !document.querySelector(".app-screen-loading") &&
      document.querySelectorAll("h1").length === 1 &&
      document.querySelectorAll('[data-authenticated="true"]').length === 1,
  );
  await s.page.locator('[data-authenticated="true"]').waitFor();
  await s.page.evaluate(async () => {
    await document.fonts.ready;
  });
  check(
    await s.page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
    "no-horizontal-overflow",
  );
  const text = await s.page.locator("body").innerText();
  check(
    !fixture.accounts.some((a) =>
      [a.password, a.invitationCode].some((v) => text.includes(v)),
    ),
    "no-private-capture",
  );
  const axe = await new AxeBuilder({ page: s.page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  const name = `${path.replaceAll(/[^a-z0-9]/gi, "-")}-${viewport.width}${viewport.deviceScaleFactor === 3 ? "@3x" : ""}.png`;
  await s.page.screenshot({ path: resolve(directory, name), fullPage: false });
  results.push({
    route: path,
    viewport,
    screenshot: name,
    violations: axe.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      nodes: v.nodes.length,
    })),
  });
  check(axe.violations.length === 0, "no-accessibility-violations");
}
async function logout(s: Session) {
  await go(s.page, "/my-edge");
  const form = s.page.locator(".member-logout form");
  await mutation(s.page, "/api/auth", "logout", () =>
    form.getByRole("button", { name: "Log out", exact: true }).click(),
  );
  check(
    (await get(s.context, "/api/member")).status() === 401,
    "logout-revokes-own-export",
  );
}
async function run() {
  if (process.argv[2] === "--help") {
    console.log(
      "Operator reviewed preview only: --run or --verify-revoked with DOCKED_PHASE45_ACCEPTANCE=<exact Docked ref> and DOCKED_PHASE45_WRITES=INVITED_TEST_ACCOUNTS_ONLY. Fixed private fixture; four invitations, labelled seed/social actions, fixture records, QA-B deletion. No owner, email, provider, trace or token capture.",
    );
    return;
  }
  check(
    process.argv.length === 3 &&
      ["--run", "--verify-revoked"].includes(process.argv[2]),
    "explicit-known-mode",
  );
  fixture = await loadFixture();
  const manifest = JSON.parse(
    await readFile("config/hosted-preview.json", "utf8"),
  );
  check(
    manifest.origin === origin &&
      manifest.supabaseProjectRef === projectRef &&
      manifest.target === "preview" &&
      manifest.projectId === "prj_C3thcg7PjP1Bnn4kR3rk4oRFegYR",
    "verified-preview-manifest",
  );
  try {
    journal = JSON.parse(await readFile(privateJournal, "utf8"));
    check(journal.runId === fixture.runId, "journal-matches-fresh-run");
    journal.signupCompleted ??= {};
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    journal = {
      runId: fixture.runId,
      accounts: {},
      signupCompleted: {},
      checkpoints: [],
    };
  }
  await mkdir(directory, { recursive: true });
  browser = await chromium.launch({ headless: true });
  const preflight = await browser.newContext({
    ignoreHTTPSErrors: false,
    serviceWorkers: "block",
  });
  try {
    const health = await jsonGet(preflight, "/api/status");
    check(
      health.database === true &&
        health.feed === false &&
        health.strategy === false &&
        health.publication === false &&
        health.oddsProviderStatus === "NOT_CONFIGURED" &&
        health.resultsProviderStatus === "NOT_CONFIGURED",
      "database-ready-sporting-services-closed",
    );
    check(
      (await get(preflight, "/api/member")).status() === 401 &&
        (await get(preflight, "/api/preview-edges")).status() === 403,
      "anonymous-private-routes-closed",
    );
  } finally {
    await preflight.close();
  }
  if (process.argv[2] === "--verify-revoked") {
    const a = fixture.accounts.find((a) => a.kind === "qa-a")!,
      s = await openSession(a);
    await go(s.page, "/app/login");
    const f = s.page.locator('form[action="/api/auth"]');
    await s.page.waitForFunction(
      () =>
        document
          .querySelector('form[action="/api/auth"]')
          ?.getAttribute("data-api-ready") === "true",
    );
    await f.locator('[name="email"]').fill(a.email);
    await f.locator('[name="password"]').fill(a.password);
    await mutation(s.page, "/api/auth", "login", () =>
      f.getByRole("button", { name: "Log in", exact: true }).click(),
    );
    const own = await jsonGet(s.context, "/api/member");
    check(
      own.profile?.id === journal.accounts["qa-a"]?.userId,
      "revoked-test-user-still-authenticated",
    );
    check(
      own.previewFixtureEvidence?.reviews.some(
        (r: { record_id: string | null }) =>
          r.record_id === journal.accounts["qa-a"]?.fixtureId,
      ),
      "revoked-tester-retains-own-export-rights",
    );
    check(
      (await get(s.context, "/api/preview-edges")).status() === 403,
      "revoked-fixture-api-denied",
    );
    const deniedInput = {
      action: "review",
      fixtureId: "demo-football",
      selection: "DEMO Harbour FC",
    };
    check(
      allowedRequest(
        origin + "/api/preview-edges",
        "POST",
        JSON.stringify(deniedInput),
        s.scope,
      ),
      "scoped-revoked-write-probe",
    );
    const denied = await s.context.request.post(origin + "/api/preview-edges", {
      data: deniedInput,
      headers: { Origin: origin },
      maxRedirects: 0,
    });
    check(
      denied.status() === 400 && (await denied.json()).ok === false,
      "revoked-fixture-submission-path-denied",
    );
    const feed = await jsonGet(s.context, "/api/community?view=feed");
    check(
      feed.status === "restricted" && feed.posts.length === 0,
      "revoked-social-api-denied",
    );
    check(
      s.errors.page === 0 && s.errors.console === 0 && s.errors.forbidden === 0,
      "revoked-session-browser-and-scope-clean",
    );
    await checkpoint("operator-revocation-enforced");
    return;
  }
  for (const kind of ["seed-a", "seed-b", "qa-b", "qa-a"] as const) {
    const a = fixture.accounts.find((a) => a.kind === kind)!;
    if (journal.accounts[kind]?.deleted) {
      check(kind === "qa-b", "only-disposable-qa-may-be-deleted");
      continue;
    }
    const s = await openSession(a);
    await auth(s, a, !journal.accounts[kind] && !journal.signupCompleted[kind]);
    if (kind.startsWith("seed")) {
      const wanted = previewSocialSeed.slice(
        kind === "seed-a" ? 0 : 2,
        kind === "seed-a" ? 2 : 4,
      );
      for (
        let index = journal.accounts[kind]!.posts.length;
        index < wanted.length;
        index++
      ) {
        const p = wanted[index];
        await makePost(s, p.body, p.kind, "sport" in p ? p.sport : undefined);
      }
      await logout(s);
      await s.context.close();
    } else if (kind === "qa-b") {
      await fixtureFlow(s);
      await go(s.page, "/dashboard");
      const f = s.page
        .locator('form[action="/api/member"]')
        .filter({ has: s.page.locator('[name="confirm"]') });
      await f.waitFor({ state: "visible" });
      await s.page.waitForFunction(() =>
        Array.from(
          document.querySelectorAll('form[action="/api/member"]'),
        ).some(
          (form) =>
            form.querySelector('[name="confirm"]') &&
            form.getAttribute("data-api-ready") === "true",
        ),
      );
      await f.locator('[name="confirm"]').fill("DELETE");
      const deletion = await mutation(s.page, "/api/member", "delete", () =>
        f
          .getByRole("button", { name: "Delete my account", exact: true })
          .click(),
      );
      check(
        (await get(s.context, "/api/member")).status() === 401 &&
          (await get(s.context, "/api/preview-edges")).status() === 403,
        "deleted-account-private-access-denied",
      );
      journal.accounts[kind]!.deleted = true;
      journal.accounts[kind]!.deletionState = deletion.message?.includes(
        "queued",
      )
        ? "revoked_pending"
        : "erased";
      await persist();
      check(
        journal.accounts[kind]!.deletionState === "erased",
        "remote-identity-erasure-completed",
      );
      await checkpoint("qa-b-deleted-after-permanent-fixture");
      await s.context.close();
    } else {
      await fixtureFlow(s);
      const seed = fixture.accounts.find((a) => a.kind === "seed-a")!;
      const post = journal.accounts["seed-a"]!.posts[0];
      if (
        !journal.checkpoints.includes(
          "comment-reply-like-save-follow-unfollow-mute-unmute-report",
        )
      ) {
        await socialFlow(s, seed, post);
      } else {
        const stored = (
          await jsonGet(s.context, `/api/community?view=post&id=${post}`)
        ).posts[0];
        const profile = (
          await jsonGet(
            s.context,
            `/api/community?view=profile&handle=${seed.username}`,
          )
        ).profile;
        check(
          stored?.isReacted &&
            stored?.isSaved &&
            stored.comments.filter(
              (comment: { author: { id: string }; body: string }) =>
                comment.author.id === journal.accounts[a.kind]!.profileId &&
                comment.body.startsWith("[PREVIEW TEST COMMENT]"),
            ).length === 2 &&
            profile &&
            !profile.isFollowing &&
            !profile.isMuted &&
            !profile.isBlocked,
          "completed-social-actions-retained-on-resume",
        );
      }
      await makePost(
        s,
        "[PREVIEW TEST POST] QA flow verification: a real saved discussion in the isolated beta. No fixture, price, advice or performance claim.",
      );
      const screenshotPaths = [
        "/edges",
        "/feed",
        "/following",
        "/points",
        "/my-edge",
        "/compose",
        `/community/posts/${post}`,
        "/profile",
        "/notifications",
        "/dashboard",
      ];
      for (const path of screenshotPaths)
        await screenshot(s, path, { width: 412, height: 915 });
      const playPhone = await openSession(a, 3);
      // Transfer this exact QA session in memory only; no storage-state file or owner credentials.
      await playPhone.context.addCookies(await s.context.cookies());
      check(
        (await jsonGet(playPhone.context, "/api/member")).profile?.id ===
          journal.accounts[a.kind]!.userId,
        "same-qa-session-in-scaled-phone-context",
      );
      for (const path of screenshotPaths)
        await screenshot(playPhone, path, {
          width: 360,
          height: 720,
          deviceScaleFactor: 3,
        });
      await playPhone.context.close();
      await go(s.page, `/profile/${seed.username}`);
      const menu = s.page.locator(".profile-hero details").first();
      await menu.locator("summary").click();
      await mutation(s.page, "/api/community", "block", () =>
        menu.getByRole("button", { name: "Block", exact: true }).click(),
      );
      const blocked = await jsonGet(
        s.context,
        `/api/community?view=profile&handle=${seed.username}`,
      );
      check(blocked.profile === null, "block-hides-social-profile");
      await checkpoint("block-enforced-without-ledger-change");
      await logout(s);
      await auth(s, a, false);
      await checkpoint("returning-app-login-no-onboarding");
      await logout(s);
      await s.context.close();
    }
  }
  check(
    sessions.every(
      (s) =>
        s.errors.forbidden === 0 &&
        s.errors.page === 0 &&
        s.errors.console === 0,
    ),
    "no-browser-or-scope-errors",
  );
}
void run()
  .then(async () => {
    if (!fixture) return;
    await writeFile(
      resolve(directory, "results.json"),
      JSON.stringify(
        {
          status: "PASS",
          origin,
          projectRef,
          runId: fixture.runId,
          recordedAt: new Date().toISOString(),
          mode: process.argv[2],
          ownerUsed: false,
          externalEmail: false,
          fixtureInjection: false,
          checkpoints: journal.checkpoints,
          results,
          browserErrors: sessions.map((s) => ({
            accountKind: s.scope.account.kind,
            ...s.errors,
          })),
          cleanup:
            "QA A awaits operator revocation/cleanup; QA B application deletion tested; two obvious test seed profiles retained.",
        },
        null,
        2,
      ) + "\n",
    );
    console.log(
      "Phase 4.5 hosted acceptance PASS. Sanitized evidence saved; operator cleanup still required.",
    );
  })
  .catch(async (error: unknown) => {
    await mkdir(directory, { recursive: true });
    // Private diagnostics retain the failed static locator without exposing
    // credentials/invitations that Playwright can echo from fill operations.
    if (fixture && error instanceof Error) {
      let diagnostic =
        error.message +
        "\n" +
        JSON.stringify(
          sessions.map((s) => ({
            accountKind: s.scope.account.kind,
            runtimeErrors: s.runtimeErrors,
            deletionRequests: s.deletionRequests,
          })),
        );
      for (const account of fixture.accounts)
        for (const secret of [
          account.password,
          account.email,
          account.invitationCode,
        ])
          diagnostic = diagnostic
            .replaceAll(secret, "[REDACTED]")
            .replaceAll(encodeURIComponent(secret), "[REDACTED]");
      await writeFile(
        "private-data/phase45-beta/browser-diagnostic.txt",
        diagnostic,
        { mode: 0o600 },
      );
    }
    await writeFile(
      resolve(directory, "results.json"),
      JSON.stringify(
        {
          status: "FAIL",
          origin,
          projectRef,
          stage,
          checkpoint:
            error instanceof CheckpointFailure
              ? error.checkpoint
              : "browser-or-operator-error",
          errorKind:
            error instanceof Error &&
            /timeout/i.test(error.name + error.message)
              ? "timeout"
              : "failed-check",
          results,
          ownerUsed: false,
          rawErrorWithheld: true,
          browserErrors: sessions.map((s) => ({
            accountKind: s.scope.account.kind,
            ...s.errors,
          })),
        },
        null,
        2,
      ) + "\n",
    );
    console.error(
      `Preview acceptance stopped at ${stage}. Review sanitized evidence; credentials and raw errors withheld. Do not reprovision accounts.`,
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await browser?.close();
  });
