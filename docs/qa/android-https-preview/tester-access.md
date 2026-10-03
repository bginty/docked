# Hosted preview tester access

The migration `20261003061548_hosted_preview_tester_community.sql` installs an inactive capability. It inserts no account, grant, region policy, approval, content or performance record. It was applied only to the verified Docked Preview project; subsequent explicit operator provisioning is recorded separately in `tester-provisioning.json`.

The older `qa-only-20261003` region fixture must not be renewed: its label did not restrict it to named identities. The new pathway uses a distinct `preview_community_only` policy and an exact authenticated UUID allowlist. It is a testing permission, not jurisdiction approval.

## Operator provisioning contract

Only the operator with privileged database access may provision or revoke access. Browser roles have no schema, table or function access and no enrollment endpoint exists. After project identity and deployment verification, the operator needs:

- A real Auth account and corresponding `public.profiles.id`. Durable testers must complete the ordinary account onboarding themselves. Do not fabricate age, terms, marketing or analytics consent. Registration and email delivery remain closed.
- A new `private.region_policies` row: `preview_community_only=true`, country `XX`, state `DOCKED_PREVIEW`, a unique version, active explicit `effective_from`, `effective_to` and `review_at`, minimum age 18, `approved=true`, features limited to `community_social` and `public_profiles`, empty operators, and evidence beginning `PREVIEW TEST ONLY:` that explains its testing scope. Do not overwrite the member's actual country/state.
- A `private.preview_tester_access` row: exact `user_id`, that policy's `policy_id`, project ref `bckkllmndoxzpzdqrevb`, explicit `expires_at` within seven days of `created_at`, `granted_by`, and a reason. Use an operator identifier and operational reason without unnecessary personal data. UUIDs default automatically. No role grant is required.

Revocation sets `revoked_at`, `revoked_by` and `revocation_reason` once. A revoked grant cannot be reopened or reassigned; renewal requires a new row. Revoking the policy, reaching its review/expiry, disabling the member, or revoking the authenticated session also denies access. Hard account deletion removes the identity mapping; a minimal grant/revocation audit retains the random grant ID and operational policy metadata.

## Enforcement

The application establishes transaction-local preview context only after the complete `DOCKED_HOSTED_PREVIEW=true` guard succeeds: exact Docked project/database binding, preview environments, canonical hosted HTTPS origin, registration/delivery/publication/paper/commercial flags closed, no provider credentials and no local email capture exception. Local and production modes supply an empty context. Database pooling cannot leak a grant because this context is transaction-local and is explicitly set on every community transaction.

App region access first checks ordinary reviewed policies, excluding preview-only policies. Only the two social features may fall back to an approved UUID grant. The actual database query additionally verifies matching `auth.uid()` and a live same-user Auth session. SQL write guards independently revalidate membership, policy, scope and expiry after acquiring grant/policy locks. Notification eligibility uses the same policy function; a tester grant never enables marketing, tips, community Edges, leaderboards, bookmaker access, paid analysis, competitions or prizes.

No sporting data or fake activity is needed. The usable tester flow is login → ordinary onboarding/attestation → community profile → discussion, follow/save/reaction and in-app preferences. Media remains quarantined pending a genuine authorized moderator review. The public sports-results/research data states remain empty and unvalidated.

## Local verification

Eight PostgreSQL/PGlite regressions cover the actual app query and SQL actor, cross-user identity, absent/wrong context, live session requirements, forbidden features, expiration/revocation, ordinary-policy compatibility, constrained enrollment, browser-role denials/RLS, and account erasure. A separate elapsed-time regression verifies session expiry after lock waits. The hosted-runtime suite also verifies the exact environment and feature boundary. Both migrations and the deliberate tester provisioning have been completed. Genuine hosted testing then verified login, notification preferences, discussion/followed-post fanout, export, logout/relogin and account deletion; a final populated-content and seven-view run passed after the fixes described in `server-readiness.md`.

## Final account state

At **2026-10-03 07:38:35 UTC**, both browser and native testers had released their disposable accounts. QA B had already been erased by the application (deletion returned 200 and the protected API subsequently returned 401). The guarded operator cleanup erased QA A through the existing disable/account-erasure service, confirmed B absent, withdrew their shared preview-only policy and redacted both QA password copies in the ignored fixture/journal. No account was recreated. `qa-cleanup.json` records the final checks.

Exactly one Auth account, member profile and preview grant remain: the durable S24 tester. Its profile, consent, notification preferences, grant and private credential file were fingerprinted before/after and are unchanged. Onboarding remains for the user to complete; the seven-day grant expires **2026-10-10 06:36:23.296 UTC**. Credentials remain only in ignored `private-data/android-preview/tester-credentials.txt`.

There are zero QA Auth sessions/refresh tokens, profiles, grants, identifiable social mappings, behavioral analytics, retained personal post/comment/media content or notifications; the labelled system QA notice was removed. Three existing append-only consent audit rows retain erased-user random UUIDs, as do minimal audit/tombstone records under the documented retention policy. Their Auth/profile identity mappings are gone; immutable evidence was not deleted or altered. This limited retained audit material is distinct from an active personal account.
