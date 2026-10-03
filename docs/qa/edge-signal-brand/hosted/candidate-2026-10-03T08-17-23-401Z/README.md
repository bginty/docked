# Edge Signal hosted candidate smoke

Result: **PASS**, 3 October 2026. This evidence describes the candidate deployment below. It does not establish that the canonical alias was changed.

- Candidate: https://docked-preview-bktyvjl8r-briant-s-projects.vercel.app
- Deployment: `dpl_98W8eekf5UHSkD1oNWNe39wRVUNb`
- Source commit supplied by the deployment coordinator: `5ee5c56b769abb875ee2fe6a00c0519288777841`
- Account: anonymous throughout. No login, forms, account creation, external emails or data mutations.
- Runner: `node scripts/hosted-brand-smoke.mjs`, restricted to this exact candidate. Browser interception rejects non-GET/HEAD and external-origin requests; none occurred.

All six routes passed at both 390px and 1440px: `/`, `/home`, `/login`, `/edges`, `/results`, `/learn/value-versus-winners`. Each check verified the response, candidate origin, loaded Sora font, decoded visible images, supplied logo proportions, absence of logo filters/shadows/transforms, horizontal overflow, browser console/page errors and axe WCAG A/AA findings. There were zero violations or browser failures. These are public/gated pages; no authenticated member workflow was exercised.

Axe retains incomplete contrast checks on image/gradient surfaces: homepage 44 nodes at each width, edges three at each width, and results two at 390px/one at 1440px. These are reported in the JSON, not suppressed; automated checks are not exhaustive accessibility certification. Homepage viewport and mobile edges/results screenshots were visually inspected for readability and layout.

The seven remote asset checks matched local bytes and SHA-256 hashes: primary wordmark, dark wordmark, mark, Sora font, approved banner, `/opengraph-image` banner response and favicon. Separate cookie-free GET checks confirmed `/api/status` reports database health true, feed/strategy/publication false and both provider statuses `NOT_CONFIGURED`; anonymous share access returns 403 and `/api/member` returns 401.

`report.json` contains per-route checks, timings and hashes. Twelve full-page screenshots plus two homepage viewport screenshots capture the actual hosted UI. Both homepage viewport screenshots were visually inspected. Agent-browser also inspected the actual homepage navigation/accessibility snapshot without interaction. The installed full Chrome binary could not start due a local Windows side-by-side configuration issue; the installed Chromium headless shell completed browser verification.

The checks did not change deployment configuration, aliases, DNS, databases or source behavior. Brand asset identity and UI acceptance do not constitute strategy validation or evidence of a sporting edge.
