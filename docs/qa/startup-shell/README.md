# Authenticated startup repair — 23 October 2026

## Confirmed causes

1. The authenticated layout rendered `PersistentAppShell` with `loading=true`. The page normally dismissed the document startup overlay, but `SportScope` replaces that page with the private-sport screen. Its ready signal was never mounted. NBA Cards could be fully rendered underneath an inert, hidden shell while the startup overlay eventually reported failure. `before-browser.json` and `before-mobile.png` reproduce the exact layout/page nesting. Earlier standalone-page fixtures did not exercise this nesting.
2. Private-sport Play/Cards requests first loaded the NFL fantasy state on the server, then discarded it when the client selected NBA/AFL/NRL. Production logged a Cards service timeout at the existing 15-second read boundary. Private pack routes likewise loaded the wallet projection on the server and again in the private-sport component.
3. Sport access was requested twice on every tab change. The general endpoint already includes NBA. Navigation preserved NBA in its URLs but not AFL/NRL, while the saved sport was unavailable to server routing.

## Repair

- The shared shell signals ready after the existing server layout verifies identity. Page data loads within visible navigation. Page/API authentication, MFA and sport admission remain enforced.
- Private Play, Cards and Packs route directly to the existing gated client loaders without first loading NFL inventory or duplicating the pack projection. A validated preference cookie is a routing hint only. Explicit NFL links override it; returning to NFL refreshes its server page.
- One capability request per member workspace, with cancellation, resume refresh and a retry state for request failures. Cancel obsolete sport-state requests. All private sports retain their selection through navigation.
- Upgrade the existing SQL-backed NBA browser fixture to include the real startup boundary and persistent layout.

## Evidence and scope

- `after-browser.json`: 28 isolated mobile/desktop checks for NFL/NBA/AFL/NRL startup, Cards/Play/Packs, denied access, service failure, sport-preserving links and return-to-NFL refresh. Deliberately delayed fixture responses verify navigation is not held behind page-data loading. Timings are local fixture timings, not Production performance claims.
- `after-412.png` and `after-1440.png`: isolated empty collection fixtures demonstrating visible navigation after startup. Real-roster gameplay acceptance uses the separate SQL-backed fixture.
- Production diagnostics were read-only: aggregate query timings showed fantasy state calls commonly taking several seconds, with maxima above 10 seconds. No blocked query was present during that single observation. This release removes unnecessary calls; it does not claim every remaining database query is instantaneous.
- No database migrations, balances, ownership, catalogue, scoring, supply or access-policy changes. No real-member test mutations.
- Signed-in Production acceptance requires an available confirmed tester session. Local browser and SQL fixtures do not establish authenticated hosted success.

Deployment and final check results are recorded in `release/` and the final handover.
