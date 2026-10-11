# Friends signup region repair — 11 October 2026

The first friend's Auth account and email verification succeeded, but admission/profile creation rolled back. Hosted PostgreSQL logs at 06:11–06:16 UTC reported `Australian adult eligibility required`. The existing free-text State/region field accepted full names or lowercase codes, while the database deliberately requires one of eight canonical Australian region codes. No admission, consent or profile was created by the failed transaction.

Repair: the beta form now offers a required state/territory selector. Server validation accepts standard full names and case-insensitive codes from already-open forms, maps them to the same canonical codes, and rejects unknown regions with a specific 400 message. No geographic, age, invitation, capacity or MFA guard is relaxed. No account, password, session, holdings or consent is repaired on the member's behalf; they must submit their own final setup form again.

Executed before deployment: three platform tests, the customer-invitation database scenario (old full-name rejection reproduced, normalized acceptance and idempotency verified), three browser journeys at 360/412/1366 px, typecheck and scoped lint passed. Browser screenshots under `qa/customer-onboarding` are isolated fixtures, not evidence of the friend's completion.

Release preserves the existing friends configuration; the new pack animation remains disabled in production. No migration, DNS, email-policy, collector or Android binary change is required. The v17 connected APK loads the corrected hosted flow. Prior production deployment `dpl_AXJQ7zTUAzFLw4phdUJWMg2mRMRy` is the rollback target.
