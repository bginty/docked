# Owner-only hosted fantasy QA — 10 October 2026

This continues `f1ab0133` / `22940ffc` on `pivot/fantasy-cards-preview-v1`. The owner's login and MFA acceptance from `7284abff` remains accepted; no password reset, MFA enrolment, Auth policy change or new invitation was performed. Owner visual approval and physical Samsung S24 acceptance remain **PENDING**.

## Access and data boundary

The owner explicitly authorised protected Preview gameplay for the existing verified owner only. A private database control pins that account ID; accepted admission, owner role, designation, verified email/factor, active session and AAL2 remain required. Other admitted accounts and arbitrary IDs are denied. No user-editable metadata grants access. Anonymous/Data API roles cannot execute gameplay functions; the existing restricted `docked_beta_app` role is used by the web server. No privileged key is deployed or packaged.

Only `beta_private`, `beta_public` and `beta_fantasy` are involved. The initial readback found zero beta holdings/packs/results. The existing catalogue of 36 fictional football players and 180 finite editions was initialised for isolated free play. Existing edition limits were not changed. Eleven non-tradeable starter cards were allocated to the owner QA collection. QA rounds and social content are labelled; they are not real sports performance. Failed test attempts leave their immutable QA entries visible rather than deleting history. No official holdings or records changed; before/after full-table digests verify that boundary.

## Journey results and evidence levels

| Journey | Hosted backend result | Authenticated browser / Android acceptance |
|---|---|---|
| Cards: starter, open, collection, detail/provenance | PASS; eight concurrent requests produce one entitlement, 11 unique serialised cards; receipt replay is idempotent | PENDING normal owner browser/device session |
| Play: owned-card selection and entry | PASS; valid 1 GK / 4 DEF / 4 MID / 2 FWD lineup persists; foreign card and post-lock writes rejected | PENDING |
| Scoring and rankings | PASS for deterministic fictional football simulation; settled results immutable | PENDING; no live/multi-sport scoring claim |
| Market | PASS denial/empty-state checks; trading and purchasing are disabled in hosted free play | Transaction functionality NOT AVAILABLE in this mode |
| Social | PASS owner QA post, comment, reaction and save through restricted runtime; changes persisted | PENDING; cross-member interaction cannot be positively exercised while every other account is denied |
| Profile | PASS owner-scoped collection/results/points returned by backend | PENDING |

These are actual hosted PostgreSQL operator tests through the existing restricted runtime connection, with the existing owner's active session context. No login token was minted or owner browser session fabricated. They are **not** proof that browser → API → database → browser passed as an authenticated owner. The controlled browser has no reusable owner session, and its attempt to attach a new tab failed; normal owner sign-in is the outstanding end-to-end dependency.

See [hosted backend evidence](qa/owner-gameplay/hosted-backend.json), [read-only preflight](qa/owner-gameplay/preflight.json), [atomic setup](qa/owner-gameplay/enable-apply.json) and the exact-owner regression in the disposable PostgreSQL report. Source/rendering and hosted anonymous/denial checks are reported separately.

## Missing implementation and private-beta prerequisites

- Only fictional football scoring exists. Operational sport data needs licensed player/team identities, fixtures, availability and authoritative event statistics/results, mapping, ingestion/health monitoring, sport-specific versioned scoring and audited corrections. Each additional sport requires its own implementation and validation.
- Marketplace transactions remain unavailable in free play. Earlier isolated test-credit trading tests do not establish live trading or payment readiness; this milestone does not enable either.
- Owner-only access prevents meaningful multi-account social/market acceptance. Do not create or admit extra testers to make those checks pass.
- Connected Android QA must retain Vercel protection. Its owner must pass that protection and normal Docked login/MFA; protection credentials are not embedded. Browser and WebView sessions must not be assumed interchangeable.
- A private beta still needs completed owner/device acceptance, a separately approved capped external-admission window, final consent/operational review, moderation/support and transactional account delivery readiness. Public registration, payments, prizes and public launch remain closed.

## Visual evidence

[Screenshots and owner checklist](qa/owner-gameplay/VISUAL_REVIEW.md) distinguish actual hosted access pages from local rendering of the real hosted QA snapshot. Authorised simulated statistics are labelled. Empty/error/loading projections exercise UI states; they are not invented hosted incidents. Final visual approval belongs to the owner.

## Deployment and validation

Protected Preview: https://docked-production-5uwewz9wi-briant-s-projects.vercel.app

Application commit `20c794945ba279d77034715fd8989fc5d779f809`, deployment `dpl_4EBn3fQmnKp3XWkNKGy4tb8j3FZu`, state **READY**. The submitted receipt embedded in the HTTP report records the earlier BUILDING state; the separate final deployment-status receipt confirms READY. No production alias or custom domain was attached. The public holding-page hash remained unchanged.

| Evidence | Actual result |
|---|---|
| Local typecheck / lint | PASS |
| Local platform suite | 191 passed |
| Additional focused staging / Android configuration tests | 9 passed; overlaps existing staging tests, not nine new platform tests |
| Local PGlite migration / RLS tests | 139 passed |
| Disposable real PostgreSQL | 20 scenarios passed |
| Local browser regression suite | 26 passed |
| Additional owner QA snapshot UI tests | 2 passed, covering both sizes and five tabs plus detail/loading/empty/error/success |
| Local optimized web build / Vercel web build | PASS / READY |
| Hosted restricted-role SQL acceptance | 10 passed |
| Hosted HTTP/access-page checks | 31 passed; anonymous/application-denial coverage only |
| Accessibility / browser console | PASS in executed local UI and hosted gated-page checks; initial MFA link issue fixed with an underline |
| Dependency audit | 0 reported vulnerabilities |
| Android connected Preview build | PASS; v11 / 1.10-preview |
| APK inspection / exact known credential scan | PASS; see APK and secret-audit JSON reports |
| Emulator install / cold native launch | PASS after emulator reboot; Chrome first-run/protected handoff reached; authenticated flow PENDING |
| Authenticated owner browser, session persistence and device gameplay | PENDING normal owner session; not implied by SQL tests |
| Owner visual approval / physical S24 | PENDING / PENDING |

The complete acceptance milestone is **not yet passed**. Backend journey checks pass within the stated scope; transaction functionality in Market is unavailable, and authenticated owner browser/device journeys remain unverified. No operational multi-sport scoring is represented by the fictional simulation.

For a strict complete-journey PASS/FAIL gate, Play, Cards, Social and Profile are **FAIL — acceptance incomplete**, despite passing hosted backend checks. Market transactions are **FAIL — not implemented/enabled in hosted free play**; the security denial and honest disabled UI pass. This distinction prevents SQL/operator or local component screenshots from being mistaken for full owner browser acceptance.

Implementation commits: `cf52827d` (exact-owner boundary and connected target), `20c79494` (MFA link accessibility and visual test tooling). Subsequent evidence/configuration documentation does not change the deployed web application.

## Connected Android delivery

See [installation and Android evidence](qa/owner-gameplay/ANDROID_HANDOFF.md). The connected v11 APK loads the protected hosted backend; it is distinct from v10's bundled local QA shell. It contains no protection bypass or privileged credential. Owner login and the existing MFA factor are unchanged.

## Recovery

For a gameplay-only rollback, deploy the same reviewed source with `--owner-auth` (free-play flag false) while retaining the exact-owner database admission boundary and all audit/ownership records. Do not delete the owner gate row or re-enable testers. Disabling the database owner-control row is a full access revocation, including the owner, not merely a gameplay toggle. No historical database retirement is part of this milestone.
