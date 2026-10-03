# Production presentation: isolated browser regression

Completed 4 October 2026 (Australia/Sydney). These checks use a loopback application with database, Auth and providers disconnected. They are not production deployment acceptance or genuine account lifecycle evidence. Existing clearly labelled DEMO fixtures remain isolated from application records.

| Check | Result | Build / scope |
| --- | --- | --- |
| [Complete browser suite](browser-final.json) | 79 passed; 0 failed, skipped or flaky; 1,146.973 seconds | `4dz_Dr92x5yICPsKu9mlk`; final backend changes, before the header-only label change |
| [Final header regression](header-final.json) | 3 passed; 0 failed, skipped or flaky; 10.649 seconds | `cKNo4yyY_hO4MjaFIHLUx`; application source `1e2991624125aaea413515c30d3be9b0460533cb` |
| [Separate ApiForm hydration security](auth-hydration.json) | 2 passed; 0 failed, skipped or flaky; 8.002 seconds | Actual shared form rendered server-side and hydrated with production React; all fictional requests intercepted |
| Type checking / lint | Passed | Full checks after application change; typecheck and scoped lint repeated after final test-only spacing correction |
| Optimized build / client boundary | Passed | Final build above; all six server canaries absent from 50 browser assets |
| [Independent credential audit](../final-browser-secret-audit.json) | Passed | 161 final browser/public files; 0 findings or errors |

This is 82 main browser cases across a 79-case broad run and a 3-case final focused run, plus 2 separate hydration cases. It is not a single 82-case run against the final source. The only application change between the two builds was the production closed-registration header label, shortened to **Accounts**. The broad Preview suite is unaffected by that conditional text change.

The broad suite's console, accessibility and overflow assertions passed. The final focused tests inspect the actual rendered header at 320, 390 and 1366 pixels, projecting only the shared production label into it. They preserve the surrounding Preview context, require no overlap or overflow, and pass header axe and console checks. Mobile account links retain at least 44px height and at least 24px width; the unchanged Sign in link is 38.375px wide, so this evidence does **not** claim 44×44px controls. Desktop links satisfy the [WCAG 2.2 target spacing condition](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html), checked conservatively with centered 24px squares.

The initial [production header probe](production-header-probe.json) found 329px document width at a 320px viewport with the longer label. Final geometry is 320px document width, with account controls ending at 304px. The first new focused run incorrectly imposed a height-only desktop target rule; [that failure is retained](header-initial-desktop-target-check.json). An intermediate test edit additionally imposed an unrequested 44px mobile width requirement; [that receipt is retained](header-interim-mobile-width-check.json). Both test-only assumptions were corrected to the actual target-size/spacing requirements without changing application markup, removing the original mobile height assertion, or weakening geometry, axe or console checks.

The separate hydration suite was migrated from a configured-server harness to actual ApiForm SSR/hydration fixtures because the now-explicit unavailable account service correctly keeps real deployment forms disabled. It verifies pre-hydration inertness, one JSON request after hydration, no password in URLs, and POST fallback when JavaScript is disabled. Every request uses intercepted fictional credentials; the production readiness gate was not relaxed.

## Isolation and evidence

- [Broad-run isolation](isolation-main-suite.json) and [final-build isolation](isolation.json): no database, feed, strategy or publication; both providers `NOT_CONFIGURED`; unavailable account APIs return 503.
- `.env.local` was unchanged. All configured environment names were overridden locally, with six fictional build canaries and no real credentials in the test process. A loopback-only application fetch guard recorded **zero external application fetch attempts** during builds and runtime checks. This is not a claim about unrelated operating-system or browser background traffic.
- The final local server was stopped and a loopback connection probe confirmed port 3000 closed. The final `.next` build remains available for independent audit.
- 362 PNG files are retained below this folder, including historical probe and clearly labelled isolated DEMO evidence. Final [320px](production-header/ISOLATED-header-320.png), [390px](production-header/ISOLATED-header-390.png) and [1366px](production-header/ISOLATED-header-1366.png) header captures are current; 320px and desktop captures were visually inspected.
- Production registration remains unavailable until the backend registration decision, authentication email configuration and published consent versions are ready. Operator/support facts still require supplied values. No legal approval, connected feed, historical validation or strategy edge is claimed by these checks.

Machine-readable consolidation: [summary.json](summary.json).
