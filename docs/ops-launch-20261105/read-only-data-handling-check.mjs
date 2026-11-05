import fs from "node:fs";
const routes = [
  "/api/analytics",
  "/api/identity-verification",
  "/account-deletion",
];
const records = await Promise.all(
  routes.map(async (route) => {
    const response = await fetch("https://docked.com.au" + route, {
      redirect: "follow",
      signal: AbortSignal.timeout(25000),
    });
    const body = await response.text();
    let projected;
    if ((response.headers.get("content-type") ?? "").includes("json")) {
      const data = JSON.parse(body);
      projected = { enabled: data.enabled, error: data.error };
    } else {
      projected = {
        title: /<title[^>]*>([^<]+)<\/title>/.exec(body)?.[1] ?? null,
        accountDeletionContent: /delet(?:e|ion|ed)/i.test(body),
        loginLink: /href="\/login"/.test(body),
      };
    }
    return {
      route,
      method: "GET",
      authenticated: false,
      status: response.status,
      finalUrl: response.url,
      cacheControl: response.headers.get("cache-control"),
      contentType: response.headers.get("content-type"),
      projected,
    };
  }),
);
const report = {
  checkedAt: new Date().toISOString(),
  scope:
    "anonymous GET readback only; no account/auth/document/deletion mutation",
  records,
};
fs.writeFileSync(
  "docs/ops-launch-20261105/data-handling-endpoints-readback.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report, null, 2));
