# Barry administrator access — 17 October 2026

The owner explicitly requested admin access for Barry. His existing verified admitted account (`bazzzzz`) now has the existing `admin` role. The role was not changed to owner. No invitation, password, MFA factor, asset or wallet mutation was performed.

The previous beta identity rule rejected every non-owner privileged account. The additive `20261016233803_delegated_beta_admin_admission.sql` migration adds an explicit named staff-admission record and wraps that identity check while retaining the original ordinary-member path. It grants no accounts automatically. Barry is the only enabled delegated account. The existing admin session, role, admission and AAL2 requirements remain authoritative. Luke remains an ordinary admitted member without required MFA.

The delegated identity requires the exact existing roster/email, admin role, valid original owner, enabled friends beta, verified unbanned account and enabled grant. Ordinary admission checks still enforce accepted current policies and suspension. Revoking the grant, changing the role or disabling the roster immediately denies privileged identity. The runtime cannot read or change the grant table directly; RLS is enabled. Grant changes append existing immutable audit events. No new general role-management endpoint was introduced.

## Access and next step

Barry can use https://docked.com.au/admin after signing in and completing authenticator setup at https://docked.com.au/mfa. The standard role permits the existing member/card/pack/competition, moderation, analytics and communications workspaces under their individual guards. Designated-owner admission management, financial controls, credit issuance and the separate Owner Command Centre remain owner-only. The pending question about read-only Owner Command Centre access has not been treated as approval to expose it.

Barry had no verified MFA factor at the final check. This is a verified account/permission grant, not a claim that Barry has completed MFA or an authenticated browser journey. Since this role is privileged, the existing MFA policy also applies when he returns to protected signed-in member screens.

## Verification

- Isolated SQL regression passed, covering role-alone denial, named grant, MFA, expired session, suspended admission, owner disablement, role/roster revocation, changed email, banned account, disabled beta, immutable approval and direct-role privilege denial.
- Live grant and a separate post-commit read confirmed Barry is admitted, admin and MFA-required. Luke's ordinary admission and MFA status were unchanged.
- Before/after fingerprints matched for wallet state, permanent and legacy cards, entries, entry revisions and Weekly Core packs. Admission rows and other role records were unchanged.
- Local script ESLint passed. Typecheck evidence is alongside this report.
- Initial application safely rolled back because a postgres.js Result wrapper was compared against a plain Array. The comparison now normalises that wrapper; the retry committed once. No first-attempt grant or asset mutation persisted.
- A private pre-change backup and public redacted operation receipts were retained. No source was pushed to the public repository.

No web release was necessary: the existing live admin portal reads the current database role and admission on each request. Real payments, hosted settlement and reward activation remain disabled.
