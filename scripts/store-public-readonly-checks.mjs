import { writeFile } from "node:fs/promises";
const rows = [];
for (const route of [
  "/privacy",
  "/account-deletion",
  "/api/mobile/capabilities",
]) {
  const r = await fetch("https://docked.com.au" + route, {
    signal: AbortSignal.timeout(30000),
    cache: "no-store",
  });
  const html = await r.text();
  rows.push({
    route,
    status: r.status,
    url: r.url,
    privacyVersion:
      route === "/privacy"
        ? (html.match(/2026-10-11-beta-rc3/)?.[0] ?? null)
        : undefined,
    hasDeletionInformation:
      route === "/account-deletion"
        ? html.includes("Delete your account")
        : undefined,
    hasReviewPendingRetention:
      route === "/account-deletion"
        ? html.includes("remain under owner review")
        : undefined,
  });
}
const protectedResponse = await fetch(
  "https://docked-preview-rlbequfzr-briant-s-projects.vercel.app/api/acceptance",
  { redirect: "manual", signal: AbortSignal.timeout(30000) },
);
rows.push({
  route: "private hosted acceptance without authentication",
  status: protectedResponse.status,
});
const evidence = { at: new Date().toISOString(), mutations: 0, rows };
await writeFile(
  "docs/qa/public-play-readiness-20261031/public-readonly-checks.json",
  JSON.stringify(evidence, null, 2),
);
console.log(JSON.stringify(evidence));
