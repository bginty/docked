// Read the existing Owner report. Paste only after reviewing this short file.
// Uses the signed-in Docked origin. Does not read credentials or change any record.
(async () => {
  if (location.origin !== "https://docked.com.au") throw Error("Open the signed-in Docked website");
  const deployment = "dpl_VpwKZaEsogGJUrD896CSqH5YyTwu";
  if (Date.now() >= Date.parse("2026-11-22T05:44:00Z")) throw Error("Approval expired");
  const response = await fetch("/api/admin/operations?scope=live", {
    method: "GET", credentials: "same-origin", cache: "no-store", redirect: "error",
    headers: { "x-deployment-id": deployment }
  });
  if (!response.ok) throw Error("Owner report HTTP " + response.status);
  const { data } = await response.json();
  if (!Number.isSafeInteger(data?.metrics?.commercialCards)) throw Error("Missing Owner report");
  console.log("DOCKED_REPORT_READ", response.status, response.headers.get("x-vercel-id"));
})().catch(error => console.log("DOCKED_REPORT_STOP", error.message));
