# Isolated private Preview — 16 October 2026

This continues the Social/profile-photo release at `3b6cbe25`. Production and its member assets are unchanged. The separate Preview is being prepared for the owner, Barry and Luke; a deployed owner setup page is not acceptance of member gameplay.

**Deployed:** `cae26d29b26047d3decf76062c5404d513ea3ce2`, deployment `dpl_4qvuSUiN9w1tzuAfCREGiWKP1dW1`, READY. Stable protected URL: https://docked-preview-s24-briant-ginty.vercel.app/app/login. Source pushed to the existing `codex/vercel-beta-review` branch; main and Production were not changed.

The exact-owner setup email was submitted through the existing Docked mailbox to `support@docked.com.au` at 22:20:50 UTC on 15 October (09:20:50 Sydney on 16 October). Microsoft Graph returned 202; inbox receipt is not independently confirmed. Open the invitation, authenticate to Vercel if requested, choose a Preview password and verify the authenticator. Do not share passwords/codes in chat. Barry/Luke invitations remain unsent. **This is not yet a playable three-person beta.**

Hosted evidence: eight candidate checks and 14 stable-origin checks passed, including Vercel protection, account screens, anonymous owner-page redirect, invalid invitation, denied unauthorised signup/login/MFA and foreign-origin requests, empty sign-in-required community data, and 1440px/412px browser screenshots. No member session or gameplay/social transaction was performed. Initial assertions expected an HTTP redirect and a 403 feed response; actual safe contracts are Next.js streamed login redirect and HTTP 200 with `sign_in_required`, null viewer and empty arrays. Verification was corrected; application security was not weakened.

The Preview runtime no longer carries its old privileged Supabase web key or retired odds credentials. Only Preview-scoped variables were changed. Owner invitation generation and mail credentials remain operator-only and outside the exported source.

## Completed infrastructure preparation

- Verified Vercel `docked-preview`, project `prj_C3thcg7PjP1Bnn4kR3rk4oRFegYR`, team `team_tf6xweKKyVCj9bTppUKttJ4l`, protection on all deployments and no Production domains.
- Isolated Supabase `bckkllmndoxzpzdqrevb`, distinct from Production `pojoymtniryarxxunyvz`.
- Private custom-format backup covers application, Auth and migration schemas. Archive listing and decoding passed. Storage objects are excluded; no full disaster-recovery restore is claimed. SHA-256 and scope: `qa/private-preview-release/backup.json`.
- Rehearsed all 41 missing migrations against a separate local PostgreSQL cluster restored from schema only, then applied the reviewed chain in one transaction to Preview. No member rows or QA fixture data were copied. Migration hashes: `qa/private-preview-release/migration-applied.json`.
- Created only the restricted `docked_beta_app` runtime login. TLS verified; direct Auth/Production-table reads and admission-control mutation denied. Existing credentials were not rotated.
- Preview Auth callback is now the protected Preview origin; the old database email-capture hook is disabled. Signup, anonymous and phone registration remain disabled. Existing SMTP is not configured; owner invitation delivery uses an operator-only adapter for the existing Docked mailbox.

## Owner and member security

The user explicitly selected `support@docked.com.au` as Preview owner. It was absent from Preview. A new unconfirmed Auth invitation was prepared for that exact identity. No password, email confirmation, MFA factor, role, consent, admission, cards or credits were assigned by the operator.

The closed owner setup path requires both exact owner UUID and email, verified email ownership and a non-anonymous provider identity. It supports invitation confirmation, password selection and MFA enrolment. It cannot grant gameplay access. Production authentication remains unchanged.

The existing database/app policy requires MFA for privileged users only. Barry, Luke and ordinary members do not need MFA. Owner moderation/admin dashboards retain AAL2 checks. Never designate Barry/Luke as admins to bypass admission.

Next gates: owner completes email/password/authenticator setup; verify its real MFA and then bind the owner through the existing owner/admission policy; prepare exact Barry/Luke identities and their explicit policy acceptance; configure/test the isolated gameplay catalogue and supported test competitions without copying QA outcomes; verify separate-account gameplay and wallet isolation. Admission is currently closed. No hosted transactional acceptance is claimed.

## Verification

- Final platform run: 383/383 passed, including exact-owner denial/setup and existing member-without-MFA coverage.
- Database: 158/158 passed in one uninterrupted local run.
- Clean production-mode build and client canary boundary passed.
- Typecheck and lint evidence in `qa/private-preview-release`.
- Initial platform run: 378 passed / five failed. Two exported-guard fixtures lacked the newly imported Preview manifest/module; fixed. Three temporary Git fixture writes were blocked by Windows sandbox permissions; the complete subsequent run passed with the required local filesystem access.
- Backup helper initially waited after successful archive creation; the exact helper was stopped and existing archive verified without overwriting it. Schema rehearsals first exposed a public-schema conflict and shared-role conflict; the final separate-cluster/schema-only rehearsal passed. No hosted migration retry or partial hosted chain occurred.
- First owner invitation attempt could not reach Auth from the sandbox and created no account/intent. Authorised network retry succeeded. Vercel API initially returned 403; official CLI refreshed its existing session and exact-project read then passed.
- Secret scan remains FAIL with nine unchanged finding paths: eight documented synthetic/generated matches and the revoked old APK capability. No new exclusions or clean-scan claim.

Existing Social desktop/mobile screenshots and prior 13 local integrated Auth/HTTP/browser groups plus five reveal checks are in [the Social handover](SOCIAL_VISUAL_PREVIEW.md). They are local fixture evidence, not hosted tester sessions. Physical S24 acceptance is pending.

## Release and rollback

Deployment receipts are written under `qa/private-preview-release`. Use the exact committed export; private configuration, invitation capabilities and Android download links never enter it. Real payments, cash redemption, document collection, public signup and live trading stay disabled.

Rollback changes the application alias to its recorded prior Preview deployment; keep compatible schema and all later Auth/ledger/receipt history. Do not restore the pre-migration archive over newer account or transaction data. Production rollback references are unchanged.

Android package `au.com.docked.app.preview` must point at the protected Preview origin. Its old receipt is stale. Do not label an APK usable for testers before authentication/protection sessions and gameplay are accepted. No protection secret may be embedded in the APK.

Android audit: current Gradle version is 22 / 1.21, Preview signing uses the existing sideload certificate and WebView debugging is disabled. The installed v22 beta and isolated Preview use the same package suffix, so a replacement must be explicitly identified as Preview and must not silently redirect the user's installed beta. Capacitor currently attaches only the configured host; Vercel login/protection persistence in the native WebView has not been accepted. No new APK or embedded bypass was produced. The web Preview can be used for owner setup now; physical S24 and protected native-session acceptance remain pending.

Application rollback reference: `dpl_GfKbTUCepPqeNQENA21ifT6u7ndP` on this same isolated Preview project (`qa/private-preview-release/rollback.json`).
