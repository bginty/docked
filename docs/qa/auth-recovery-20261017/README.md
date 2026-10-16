# Auth and Android recovery — 17 October 2026

Scope: isolated local fixtures only. No hosted accounts, assets, signing credentials or cloud configuration changed by these checks.

## Environment recovered

The existing Docked Postgres, GoTrue and Kong containers were stopped. Docker's sandbox pipe was denied, but the approved native command could reach Docker Desktop. Only the three `docked-market-http-*` containers were restarted, retaining their existing local test volume. Oura containers and hosted databases were not changed. Local gateway keys were refreshed through the existing local-only infrastructure generator.

## Android

- Installed JDK: 21.0.6. Android SDK platform 36 is present; source uses minSdk24/compileSdk36/targetSdk36.
- Package and signing identity remain unchanged: `au.com.docked.app.preview`, existing sideload signing, source versionCode22 / 1.21-beta.
- `android-regressions.log`: 26/26 manifest, target isolation, signing boundary, artifact preservation, native lifecycle/navigation/offline and avatar-crop tests passed.
- `closed-test-preflight.log`: blocked on the missing current verified Preview receipt. This is a separate store-preparation path, not the approved live-beta sideload route.
- The live-beta receipt still references a 12 October deployment and must be refreshed from actual current live acceptance. Its 24-hour expiry/host-match gate was preserved.
- Elevated `adb devices -l` started the local ADB daemon successfully and found **no connected devices**. No installation or physical-device testing occurred.

## Authenticated journey attempts

`authenticated-attempt1.log` retains an incomplete genuine GoTrue/Next/Postgres run. API login, owner MFA, avatar upload/approval/private retrieval and the preceding local Social/privacy/settlement assertions reached the browser stage. Cold `/profile` compilation took over the default navigation budget; diagnostic artifact failure obscured the original exception. This attempt is **not a pass**. The test now uses an explicit cold-server navigation budget and best-effort diagnostics that preserve the original failure.

`authenticated-attempt2.log` stopped at the existing migration hash guard because another specialist was refining a newly created migration after it had been applied to this local fixture. Frozen final function definitions and empty draft migrations were reconciled only on loopback, transactionally updating the local QA migration registry. The normal hash guard remains enabled; no hosted migration or database reset was performed.

Subsequent genuine avatar acceptance passed upload/crop, owner AAL2 approval, cross-account denial, private authenticated 256px retrieval, anonymous denial, reload persistence, replacement/removal and broken-image initials fallback. `authenticated-attempt3.json` and attempts5/6 preserve these completed assertions. Those full runs were **not passes**: stale copied refresh-token jars, a five-second cold-route expectation and an existing Windows-locked screenshot path interrupted later stages. Fresh real login between independent browser campaigns, explicit cold-server budgets and per-run evidence directories fix those harness defects.

`visual7/receipt.json` is a **passed** genuine authenticated Edge campaign: Social, member collection, communities, offers and packs at1440×960,412×815 and815×412, collection search, dialog Escape/focus restoration, reduced motion, no page overflow/browser exceptions and no serious/critical desktop Axe findings. Screenshots are actual isolated fixture screens, not intercepted UI data. Social desktop/mobile images were inspected; some capture the transient header balance loading state, so these do not certify final balance-readiness appearance.

## Native PostgreSQL defects found and corrected

1. Admin reporting wrappers declared SQL `READ ONLY`, but existing live admission checks acquire `FOR SHARE` locks. Native PostgreSQL correctly rejected the authorization check (`cannot execute SELECT FOR SHARE in a read-only transaction`), causing owner403 even with valid real GoTrue MFA. Seven wrappers now permit the admission locks while retaining SELECT-only reporting branches, role/session/MFA checks, narrow database grants and existing timeouts; the owner dashboard keeps its repeatable-read snapshot. No authorization lock or RLS rule was relaxed.
2. New administrative mutation wrappers passed `JSON.stringify(value)::jsonb`. Native postgres.js inferred JSONB and encoded the string a second time; `jsonb_typeof` was `string`, rather than `object`. The database correctly rejected credit requests400. The wrappers now use `tx.json(value)`; the same correction covers announcement, moderation case, retention, owner health and moderation retention integration. JWT claims passed to text `set_config` remain serialized text. Direct PGlite tests did not expose this driver boundary defect.

`admin-authenticated-attempt11.log` passed real GoTrue login/MFA → HTTP → native PostgreSQL: ordinary member and owner AAL1 denial, owner reporting/search/record/announcement/credit reads, no-store and no private email disclosure. Concurrent duplicate credit-review requests returned one identical result; exact retry matched; concurrent same-revision approvals returned200/409. The entire credits/commerce document hash was unchanged. Approval records did not issue credits.

`admin-authenticated-attempt9.log` passed actual owner dashboard rendering at1536 and412px. Both screenshots in `owner-1792189419697/` were inspected. Numbers reflect local fixture data; cash revenue stays unavailable and unmeasured services remain unknown.

Announcement create/exact retry/submit/owner approval/three-event history and member denial passed in attempts13–15. These combined attempts remain **failed**, because health POST503 correctly rejected the old local harness's production-emulation plus loopback origin. A stale listener then satisfied the old readiness check after a failed restart. The harness now checks that its port is unused before launch and offers an explicit `DOCKED_ADMIN_LOCAL_ACCEPTANCE=true` development profile. All existing exact loopback host/port, restricted database role, nondeployable environment, disabled financial/delivery features and secret restrictions remain enforced. `healthOrigin` itself was not relaxed. Local-profile and redemption regressions passed5/5 (`local-profile-tests.log`). Non-elevated runs also preserve their actual loopback EACCES failures; the final authorized elevated run used no alternate network route.

**Final combined native run passed:** `admin-authenticated-attempt16.log` and `admin-authenticated.json`, at2026-10-16T22:45:29Z. It verified genuine owner MFA and ordinary-member/AAL1 denial, all tested reporting reads, draft create/retry/submit/approve/history, health observation POST and identical-key retry, report/case update/hide/restore, moderation removal with retained evidence followed by retention review/restore, and concurrent credit-review create/approve controls. The complete credits/commerce document remained unchanged. Only isolated local social content, review records and health observations were written; no messages were delivered and no credits were issued. Actual local health fetch failures were recorded as failures rather than falsely green services.

The original owned Next listener59228 was stopped after the combined campaign. A single later isolated server was used for the focused role-revocation check below. Docker's existing isolated local data was retained.

**Actual AAL2 role-revocation acceptance passed:** `admin-staff-role.json` and `admin-staff-role.log`, at2026-10-16T22:52:54Z. The genuine local owner session first passed the administrative read checks. Only that isolated QA identity's database role was then changed to auditor; the same real AAL2 session immediately lost beta admission and every tested administrative read, announcement mutation and credit-review mutation returned403. A `finally` block restored the original owner role, verified admission, and the same session regained its authorised read. This verifies current-role revocation; it does **not** claim a separately provisioned staff account or positive staff workspace acceptance.

Positive non-owner staff access remains an explicit policy/activation gate: current friends-beta admission deliberately admits privileged gameplay/administrative access through the designated owner identity, and excludes a non-owner privileged role. It was not weakened to make a staff test pass. A future approved staff-admission policy and genuine staff fixture are required before positive staff workspace acceptance. Physical-device acceptance also remains separate. The final owned listener16816 was stopped after the campaign; its harness exited0. Focused acceptance-script ESLint passed (`staff-role-eslint.log`).

Focused ESLint for changed wrappers and acceptance scripts passed (`focused-eslint-final.log`). Parent coordination owns the final full typecheck, platform/database regressions and build after the local server is released.

Physical S24, Samsung Internet, native shell restoration and current hosted owner/tester journeys remain separate acceptance work. Local fixtures cannot certify those outcomes.
