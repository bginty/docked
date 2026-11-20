/* Two same-origin, read-only Owner requests against Docked's protected paid candidate.
   Run once in the existing Docked Owner tab. Prints only HTTP status, request IDs and timing. */
(async () => {
  const deployment = "dpl_77UA5x9izFz4SBAAxoLhZfPhpK4j";
  if (location.origin !== "https://docked.com.au") throw Error("Open the Docked Owner tab first.");
  if (Date.now() >= Date.parse("2026-11-21T01:43:00Z")) throw Error("Staging routing window expired.");
  const checks = [];
  for (const path of ["/api/app-session", "/admin/incidents"]) {
    const url = new URL(path, location.origin);
    url.searchParams.set("dpl", deployment);
    const begin = new Date().toISOString();
    const response = await fetch(url, {method: "GET", credentials: "same-origin", redirect: "error", cache: "no-store", signal: AbortSignal.timeout(30000)});
    if (!response.ok) throw Error("Read unavailable at " + path + " (" + response.status + ")");
    let ownerView;
    if (path === "/api/app-session") {
      const session = await response.json();
      ownerView = session.authenticated === true && session.ownerAccess === true;
    } else {
      const doc = new DOMParser().parseFromString(await response.text(), "text/html");
      ownerView = Array.from(doc.querySelectorAll("h1")).some(h => h.textContent.trim() === "Operational incidents");
    }
    if (!ownerView) throw Error("Existing Owner view required at " + path);
    const requestId = response.headers.get("x-vercel-id");
    if (!requestId) throw Error("Missing provider request ID.");
    checks.push({path,begin,end:new Date().toISOString(),status:response.status,requestId});
  }
  console.info("DOCKED_PAID_OWNER_READS " + JSON.stringify({deployment,checks,businessMutations:0}));
})().catch(error => console.error("DOCKED_PAID_OWNER_STOP " + error.message));
