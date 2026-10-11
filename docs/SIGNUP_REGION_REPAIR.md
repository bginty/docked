# Friends signup region repair — 11 October 2026

The first friend's Auth account and email verification succeeded, but admission/profile creation rolled back. Hosted PostgreSQL logs at 06:11–06:16 UTC reported `Australian adult eligibility required`. The existing free-text State/region field accepted full names or lowercase codes, while the database deliberately requires one of eight canonical Australian region codes. No admission, consent or profile was created by the failed transaction.

Repair: the beta form now offers a required state/territory selector. Server validation accepts standard full names and case-insensitive codes from already-open forms, maps them to the same canonical codes, and rejects unknown regions with a specific 400 message. No geographic, age, invitation, capacity or MFA guard is relaxed. No account, password, session, holdings or consent is repaired on the member's behalf; they must submit their own final setup form again.

Executed before deployment: three platform tests, the customer-invitation database scenario (old full-name rejection reproduced, normalized acceptance and idempotency verified), three browser journeys at 360/412/1366 px, typecheck and scoped lint passed. Browser screenshots under `qa/customer-onboarding` are isolated fixtures, not evidence of the friend's completion.

Release preserves the existing friends configuration; the new pack animation remains disabled in production. No migration, DNS, email-policy, collector or Android binary change is required. The v17 connected APK loads the corrected hosted flow. Prior production deployment `dpl_AXJQ7zTUAzFLw4phdUJWMg2mRMRy` is the rollback target.

## Live acceptance

Released application commit `cdd7bb497d856d873f8abe030a6cde3074393585`, deployment `dpl_2B1cdf6LogHXMK3q4AAEvsm6rP1b`, to https://docked.com.au on 11 October 2026 at approximately 06:46 UTC. Production build READY; domain identity, HTTPS/www redirects, callback/recovery protections, invitation-only configuration and anonymous/private API denial all passed (15 boundary checks).

Existing synthetic ordinary-member hosted checks passed first against the candidate and then the genuine custom domain: original-password login without MFA, invalid state 400, lowercase full-state-name setup retry 200, no change to existing profile/admission/consent/cards, session restoration and ten-card collection. The synthetic account had deliberately been disabled after prior acceptance; it was temporarily re-enabled with audit events and restored to disabled in each test's finally block. No real member account was changed. Candidate access required a private temporary deployment share and API requests using its configured custom-domain Origin; the final domain browser run used no override or hosting bypass.

The friend's actual final onboarding submission and physical device result remain unobserved. Ask them to reopen/refresh Docked, sign in with their existing chosen password and complete setup using the state selector. No new invitation, password reset or APK installation is needed.
