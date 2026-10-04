# Phase 5B hosted acceptance

Executed against the isolated Docked Preview project `bckkllmndoxzpzdqrevb`, migration 16, deployment `dpl_5tSJbtj3Ed4cECnoUGmJdejJNSYf`, source `e1c8086d541401d128f9b0e7620ef93cbf7ce6e9`.

The staff/public suite passed 66 assertions and the subsequent genuine-member suite passed 12. All six page/viewport combinations passed axe, image decoding, overflow and browser-error checks. Screenshots are under `hosted/`: `model-performance-{412,1366}.png`, `daily-{412,1366}.png`, and `public-results-{412,1366}.png`. The actual rendered-secret scan passed 24 files / 1,295,967 bytes, including the browser's current access/refresh token pair and cookie values held only in memory. Public results correctly showed that the official record has not started, with unavailable return metrics. Actual model tables remained empty; no model or sporting input was seeded.

Read-only final verification passed after staff-role withdrawal. Following the final actual-secret audit release, cleanup erased the disposable Auth account, sessions, profile, roles and grants and redacted its private password/token/factor copies. `operator/cleanup.json` confirms that all four original account fingerprints remain unchanged. `operator/post-cleanup-state.json` confirms four Auth accounts, zero sessions or staff roles, 16 migrations, and no model versions, fitted implementation, sporting model inputs, predictions, official start date, publications or sent messages.

The retained Phase 5A provider trial is unchanged against its prior report: nine request rows, 491 provider credits remaining / nine provider-reported used, and 27 mapped events / 11 markets / 110 snapshots. The total reported charge across every attempt remains unknown because the original failed request has no captured charge; it is not relabelled zero. This acceptance made zero provider requests or trial calls.

The operator helper preserves a private fingerprint of the four existing Auth accounts, profiles, role assignments and Preview grants. It creates one explicitly synthetic, reserved `example.invalid` account through Auth Admin without sending email. A genuine password session and TOTP factor supply MFA. No model version, fitted implementation, sporting input, probability, candidate, official publication, provider permit or provider request is created.

Run from the workspace, only after the parent confirms migration and deployment readiness:

```powershell
node --conditions=react-server --import tsx scripts/hosted-preview/phase5b-operator.ts inspect --confirm-project=bckkllmndoxzpzdqrevb
node --conditions=react-server --import tsx scripts/hosted-preview/phase5b-operator.ts provision --confirm-project=bckkllmndoxzpzdqrevb
node --conditions=react-server --import tsx scripts/hosted-preview/phase5b-operator.ts mfa --confirm-project=bckkllmndoxzpzdqrevb
$env:PHASE5B_PREVIEW_ORIGIN = 'https://docked-preview-s24-briant-ginty.vercel.app'
node --import tsx scripts/hosted-preview/phase5b-browser.ts --run --confirm-project=bckkllmndoxzpzdqrevb
```

The browser uses actual application password/MFA endpoints. It checks anonymous and AAL1 denial, genuine AAL2 model reads, strict rejection of arbitrary probabilities, missing-model transitions, absent-policy activation and cross-origin writes. The private-schema Data API check independently validates its actual token first. Public results and the model/daily staff pages are captured at 412 and 1366 CSS pixels with axe, image decoding, overflow and browser-error checks. These viewports are not physical Android evidence. Rendered HTML and scripts remain ignored private artifacts and are scanned against actual known secrets without printing values.

After the staff pass, withdraw only the disposable account’s role to test actual member denial with MFA intact:

```powershell
node --conditions=react-server --import tsx scripts/hosted-preview/phase5b-operator.ts member-only --confirm-project=bckkllmndoxzpzdqrevb
node --import tsx scripts/hosted-preview/phase5b-browser.ts --member --confirm-project=bckkllmndoxzpzdqrevb
node --conditions=react-server --import tsx scripts/hosted-preview/phase5b-operator.ts verify --confirm-project=bckkllmndoxzpzdqrevb
```

The genuine member session must remain usable for its own account while model reads and transitions are denied. No original account is used for this check. The role is not restored.

After browser release and the final actual-secret audit, erase the exact disposable identity using the existing disable-account and Auth-erasure path:

```powershell
node --conditions=react-server --import tsx scripts/hosted-preview/phase5b-operator.ts cleanup --confirm-project=bckkllmndoxzpzdqrevb --qa-released
```

Cleanup verifies zero remaining disposable Auth rows, sessions, profiles, roles and grants, plus unchanged protected-account fingerprints. It then redacts the new private credential copies. The append-only audit remains. Failed receipts are retained; error messages, passwords, tokens, factor secrets and private IDs are never written to the public receipts.

Local preparation checks: two scope regressions cover wrong project/organization/pooler, preserved-account substitution, real-address substitution, duplicate original roster and erased identity. These are independent of the hosted acceptance result.
