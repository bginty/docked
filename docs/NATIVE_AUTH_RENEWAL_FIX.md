# Android account-completion loop — 12 October 2026

Released code: `26c874844ab31c0008c61190c04762c729666418`.
Deployment: `dpl_ENERamnh5GPK7SXqJCsvCBhpZp2p`, https://docked.com.au.

The existing owner had verified email and an intact verified authenticator, but
had accepted the earlier beta policy. Updated consent was pending. Account
completion correctly required owner MFA; the native session guard incorrectly
treated `/mfa` as a gameplay screen and redirected pending admission to login.

The native guard now leaves authentication screens to their own authenticated
handlers. Login routes an owner requiring consent renewal through existing MFA
first. Ordinary members still have no mandatory MFA. Gameplay admission, session
checks and server-side owner MFA remain enforced. No password, factor, human
consent, holdings or admission record was changed.

## Executed evidence

- Typecheck and full lint passed.
- Focused platform tests: 12 passed.
- Native browser regression: 1 passed, including resume and existing-factor
  challenge routing. Auth responses in that regression are mocked.
- Staged and live hosted browser checks passed with the actual native bridge:
  pending admission does not interrupt MFA; an existing synthetic ordinary member
  signs in and reloads Play. Its temporary admission was audited and restored.
- Live domain/callback/admission checks: 15 passed, including exact deployed
  commit, private-data denial, foreign-origin rejection and closed registration.
- Read-only owner inspection confirms MFA remains required, the existing verified
  factor remains, and policy acceptance still requires the owner's own action.

Receipts and mobile screenshot: `qa/native-mfa-renewal/`; public-domain checks:
`qa/friends-cutover/domain-boundary.json`.

This is browser native-shell simulation, not physical S24 acceptance. The owner
must retry normally to confirm the complete real authenticator/consent journey.
Android v21 loads the hosted application; close it fully and reopen. No reinstall,
data clearing, new APK, password reset or authenticator setup is needed.

## Recovery

Previous deployment: `dpl_HewS9iMnD3dLNRZLA9sypP236jDJ`. Promote that existing
deployment in project `prj_l0rpVDPRuIRp9UcBUkudeyUK5yST`, team
`team_tf6xweKKyVCj9bTppUKttJ4l`, if rollback becomes necessary. Alias snapshot is
`qa/native-mfa-renewal/rollback.json`. No migration, DNS, mail-origin or Auth policy
change was required. Rolling back restores the known native consent/MFA loop.
