/* Run once in Chrome DevTools Console on https://docked.com.au using your
 * existing founder session. GET requests only; no credential access, purchases,
 * grants, pack opening, account changes, aliases or configuration writes.
 * Prints only hashes/counts and request timing, never tokens or card details.
 */
(async () => {
  const source = "76df44ba1adef012c5ec2119563cbc05ff9e3c0b";
  const deployment = "dpl_Fnb75vUFUaDd4WL6pnkQDttKoQoh";
  const check = (ok, reason) => { if (!ok) throw Error(reason); };
  check(location.origin === "https://docked.com.au", "Use docked.com.au only");
  check(Date.now() < Date.parse("2026-11-17T10:27:20Z"), "Approval expired");
  const hash = async (value) => Array.from(new Uint8Array(await crypto.subtle.digest(
    "SHA-256", new TextEncoder().encode(JSON.stringify(value)),
  ))).map((b) => b.toString(16).padStart(2, "0")).join("");
  const timings = [];
  async function read(path, pinned = true) {
    const url = new URL(path, location.origin);
    if (pinned) url.searchParams.set("dpl", deployment);
    const start = performance.now();
    const response = await fetch(url, {
      method: "GET", credentials: "same-origin", cache: "no-store", redirect: "error",
      signal: AbortSignal.timeout(45000),
    });
    const data = await response.json();
    timings.push({ path, pinned, status: response.status,
      elapsedMs: Math.round(performance.now() - start),
      requestId: response.headers.get("x-vercel-id"),
      cacheControl: response.headers.get("cache-control"),
      serverTiming: response.headers.get("server-timing") });
    check(response.ok, "Read denied or unavailable: " + path);
    return data;
  }
  try {
    const live = await read("/api/beta-release", false);
    check(live.commit === "12ccfd5879ae83f1bd62210ee16a3feb6907d9ef", "Live release changed; stop");
    const candidate = await read("/api/beta-release");
    check(candidate.commit === source && candidate.deploymentId === deployment, "Request did not reach approved candidate");
    check(candidate.publicRegistration === false, "Registration gate changed");
    const result = await read("/api/test-wallet?view=packs");
    const state = result.state;
    check(state && typeof state.member === "string", "No authenticated member view");
    const receipts = state.packs.filter((p) => p.status === "OPENED" && p.receipt?.cards?.length > 0);
    check(receipts.length > 0, "No previously opened saved receipt available");
    const receiptEvidence = [];
    for (const pack of receipts) {
      const ids = pack.receipt.cards.map((c) => c.id).sort();
      check(ids.every((id) => typeof id === "string") && new Set(ids).size === ids.length, "Invalid saved receipt card IDs");
      receiptEvidence.push({ packSha256: await hash(pack.id), cardCount: ids.length,
        cardIdsSha256: await hash(ids), sport: pack.sport ?? null });
    }
    const end = await read("/api/beta-release");
    check(end.commit === source && end.deploymentId === deployment, "Candidate route changed");
    const proof = { at: new Date().toISOString(), source, deployment,
      authenticatedAccess: true, existingReceiptRecovered: true,
      memberSha256: await hash(state.member), receipts: receiptEvidence,
      method: "same-origin authenticated GET with Vercel deployment pin",
      purchases: 0, grants: 0, openingRequests: 0, timings,
      liveDomainStillPrevious: true, physicalAndroidTest: false };
    console.info("DOCKED_READONLY_ACCEPTANCE " + JSON.stringify(proof));
    return "Docked read-only check PASSED. No purchase or pack opening was requested.";
  } catch (error) {
    console.error("DOCKED_READONLY_ACCEPTANCE_STOP " + JSON.stringify({
      at: new Date().toISOString(), message: String(error), timings,
      purchases: 0, grants: 0, openingRequests: 0,
    }));
    return "Docked read-only check stopped. No purchase or pack opening was requested.";
  }
})();
