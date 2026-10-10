# Friends beta release — 10 October 2026

Authority: the owner's consolidated overnight release instruction supersedes Preview-only deployment instructions and the one-tester limit. Target: invite-only AU adults, at most ten lifetime tester admissions plus the existing owner. No invitations/messages while owner is offline. Owner MFA, holdings and historical rules remain unchanged.

Checkpoint: `checkpoint/friends-beta-20261010-9ff398fc`. Starting branch `pivot/fantasy-cards-preview-v1`, clean at `9ff398fc`. Android v14 is the baseline, not v12. Existing production holding page and protected Preview remain available until external-readiness conditions pass.

Implementation sequence:

1. Version AFL coefficients without mutating old rules; generate compact scoring tables; repair composer theme.
2. Prepare ten-member admission with explicit disabled activation; preserve invitation/session/AU/age controls and two-person historical records.
3. Add a rights-checked catalogue import/replacement plan, stable identity/club history, no renaming owned cards.
4. Build isolated purchase/fulfilment and withdrawal/KYC foundations, payment adapters and concurrency tests. Keep all real charges/payouts disabled.
5. Verify current source coverage, fixtures and commercial requirements; record exact blockers and policy drafts.
6. Run regressions, responsive checks, deploy verified changes to protected Preview when external gates cannot pass; build a matching next-version owner APK and private download. No messages sent.

Live site eligibility is conditional, not assumed: existing policy approval explicitly excludes unverified data-location, retention and deletion operations. No factual values will be invented. A Preview-only result must be reported as blocked for friends, never called live beta ready.

Rollback: preserve immutable deployments and APKs; release to Preview first. If the production cutover is eligible, record DNS/hosting/auth callback snapshots before mutation and keep the former holding-page deployment available. Do not apply a destructive/down migration. New isolated schemas may remain disabled on rollback; no past scores, ownership or supply changes are reversed by rewriting history.
