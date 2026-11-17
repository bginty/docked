/* Run once in your Chrome Console on https://docked.com.au.
 * GET requests only, through your own existing browser session. No credential
 * access, password/MFA changes, email, SMS, drill, acknowledgement or resolution.
 * Uses Vercel's fetch deployment pin; address-bar navigation does NOT pin a build.
 * Outputs only status/timing/hash evidence, never cookies or incident details.
 */
(async () => {
  const source = "988ea0ba905e91d3c1cdf0c5e18812849b138968";
  const deployment = "dpl_Du8W6gJRXWBb3d6frPT7oVyhprwd";
  const checks = [];
  const check = (ok, reason) => { if (!ok) throw Error(reason); };
  const hash = async (value) => Array.from(new Uint8Array(await crypto.subtle.digest(
    "SHA-256", new TextEncoder().encode(JSON.stringify(value)),
  ))).map((b) => b.toString(16).padStart(2, "0")).join("");
  async function read(path, html = false) {
    const url = new URL(path, location.origin);
    url.searchParams.set("dpl", deployment);
    const started = performance.now();
    const response = await fetch(url, {
      method: "GET", credentials: "same-origin", cache: "no-store",
      redirect: html ? "manual" : "error", signal: AbortSignal.timeout(30000),
    });
    checks.push({ path, status: response.status, responseType: response.type,
      elapsedMs: Math.round(performance.now() - started) });
    if (html && response.type === "opaqueredirect") return { redirect: true };
    check(response.ok, "Read denied/unavailable: " + path);
    return html ? { html: await response.text() } : await response.json();
  }
  try {
    check(location.origin === "https://docked.com.au", "Use docked.com.au only");
    check(Date.now() < Date.parse("2026-11-18T07:00:00Z"), "Approval expired");
    const release = await read("/api/beta-release");
    check(release.commit === source && release.deploymentId === deployment, "Candidate pin not honoured; STOP");
    check(release.publicRegistration === false, "Registration gate changed; STOP");
    const session = await read("/api/app-session");
    check(session.authenticated === true && session.ownerAccess === true, "Sign in with your retained Owner account first; no credentials should be shared");
    const incidents = await read("/api/admin/incidents");
    const page = await read("/admin/incidents", true);
    check(page.html?.includes("Operational incidents") && page.html.includes("Owner access"), "Owner incident page did not render");
    const entries = [];
    for (const path of ["/app", "/fantasy/play"]) {
      const result = await read(path, true);
      check(result.redirect || (result.html?.includes("NEXT_REDIRECT") && result.html.includes("/admin/incidents")), "Entry did not redirect to Owner administration: " + path);
      entries.push({ path, redirectObserved: true, destinationNeedsNetworkWitness: !!result.redirect });
    }
    const end = await read("/api/beta-release");
    check(end.commit === source && end.deploymentId === deployment, "Candidate changed");
    console.info("DOCKED_OWNER_READONLY_ACCEPTANCE " + JSON.stringify({
      at: new Date().toISOString(), source, deployment, authenticatedAccess: true,
      ownSession: true, mfaAal2: true, incidentsRead: true,
      incidentReportSha256: await hash(incidents), ownerPageRendered: true,
      entries, checks, productionWrites: 0, note: "Existing Owner/MFA enforced by the API; no new challenge claimed. Network redirect and client navigation witnesses are separate.",
    }));
    return "PASSED — Docked Owner read-only acceptance. No account or incident action was performed.";
  } catch (error) {
    console.error("DOCKED_OWNER_READONLY_STOP " + JSON.stringify({
      at: new Date().toISOString(), message: String(error), checks, productionWrites: 0,
    }));
    return "STOPPED — tell Codex the message; do not change any browser protection.";
  }
})();
