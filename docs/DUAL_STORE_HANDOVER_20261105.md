# Docked launch preparation — 5 November 2026

**Public launch/submission: held.** Google Console has a usable submission control, but the current paid-pack release is not yet accepted end to end. No products, public registration, withdrawals, prizes or irreversible retention process were activated. NBA remains hidden. No customer data, Production migration, purchase, refund or phone operation was performed in this continuation.

## Changes and deployment

| Item | Result |
|---|---|
| Production | Preserved `da24e69d6e78bd4a1dbe53b740881386088a340e` at `https://docked.com.au`; deployment `dpl_DPuRZZ6E86VURysBJJmieGEVZ3zW`. Final readback still reports private beta and registration disabled. |
| Apple preparation / native sports fix | Commit `d2f200f10947cf5c0a343a9cb5eaeef2c259ec5b`. Reused Capacitor, StoreKit and existing shared wallet/pack/receipt services; disabled sandbox adapters and source preparation, not a compiled app. Native public capabilities now use public eligibility rather than private-beta admission. |
| Preview wallet correction | Commit `60c616ca2610d27e1f0e40e3f65dae2aff66c19e`. An isolated acceptance ledger must remain an acceptance ledger after its temporary Google checkout window closes. Previously the runtime selected commercial mode and failed the environment check on wallet reads. Ledger selection is now based on the strictly validated isolated project/role; checkout admission remains separate and closed. |
| Protected application | `https://docked-preview-8ovqidst8-briant-s-projects.vercel.app`, deployment `dpl_6S5YKMCt89TAiHYw8P8xbQGycnD1`, READY. Existing protected Preview alias updated. Unauthenticated access still redirects to Vercel protection. No new infrastructure or recurring service. |
| Rollback | Repoint only the protected Preview alias to `https://docked-preview-2jeukf9xg-briant-s-projects.vercel.app` if needed. No schema rollback is required. Do not promote this Preview to Production as a substitute for reviewed public-runtime promotion and activation. |

The capability fix depends on the prepared public runtime, which is absent from the current Production release. It was therefore deployed to protected Preview, not cherry-picked unsafely into Production.

## Actual acceptance and performance

- **56 targeted tests passed**, covering Apple verification/HTTP adapter, shared TEST receipt service, Google/store settlement, pack lifecycle, native navigation and public sport capability isolation. This is not a new full 700+ test run.
- **14 targeted tests passed after the Preview wallet fix**, including closed test admission, Production/wrong-role rejection, member binding and public capabilities. These overlap the earlier suite; do not add them as distinct coverage totals.
- **Seven real local PostgreSQL scenario groups passed** with explicitly mocked Apple provider responses: duplicate notifications/receipts, cross-account rejection, exactly nine cards under concurrent buy/open retries, outage/lease recovery, refunds before/after spending, reversal review, queue permissions and ledger invariants. No genuine Apple receipt or Apple push delivery was tested.
- Typecheck and targeted ESLint passed. React components were reviewed for member-scoped state, cleanup, disabled controls and accessible status. Client-boundary check passed for 226 generated assets, but no new full secret-canary build was run.
- Local default Turbopack build failed because the temporary dependency junction points outside the worktree. Automatic approval review blocked removal of that junction without a detailed reason; it was left intact. The supported local Webpack production build passed. Both protected cloud builds using normal dependencies/default build also completed successfully. No Production build configuration was changed to hide this local limitation.
- **Genuine signed-in protected browser acceptance passed**, using an existing isolated ordinary member and normal password authentication. Native/web APIs agree on NFL/AFL/NRL, billing is disabled, all three Play pages render, NBA is denied server-side, and the isolated wallet is unchanged across navigation. First failed wallet check is retained alongside the passing correction evidence.
- Screens inspected at 390px and NRL at 1440px: correct sport/cap labels, readable controls, no horizontal page overflow. These are browser screenshots, not iPhone or Samsung acceptance. Navigation/read/render measurements: NFL 3,150ms, AFL 2,352ms, NRL 2,576ms on the desktop connection without mobile throttling. There is no comparable mobile baseline and no claim of a measured Android startup improvement.
- Production policy routes returned 200; login returned 200; unsigned native capability request returned 401. Policy route reads were 75–121ms and login 523ms from this machine, not device load-time guarantees.

Evidence: `qa/dual-store-20261105/` includes automated results, Production snapshots, before/after Preview acceptance, screenshots and deployment identity. The existing 2 November external signup/confirmation/login/recovery/deletion evidence remains valid and was not unnecessarily repeated. External acceptance explicitly records `operatorRelay:false`; this continuation's synthetic login is not new external-email delivery proof.

## Google Play

- Authenticated Console readback: Australia-only, **Mature (M)**, audience 18+, managed publishing ON, v30/1.29, **ten saved changes not submitted**, no App Content attention items. Reviewer access instructions are saved; no password inspected/exported and no new reviewer login claimed.
- Existing screenshots and listing show NFL/AFL/NRL, with no NBA. Data Safety, privacy/deletion URLs and financial declaration were inspected without changes. No fresh legal attestation was accepted.
- Support case **4-5905000041947 is Open**. Only acknowledgement was found. Preserve exact prior `NO_ELIGIBLE_OFFER` status-4 evidence and the active-at-test/inactive-after-test distinction. No product toggles, repeated native queries or speculative configuration changes occurred.
- Approved products remain `docked_credits_4900_v1` (A$49 / 4,900 credits) and `docked_credits_9900_v1` (A$99 / 9,900 credits). These are credit purchases used for existing packs, not direct A$49/A$99 pack prices. Current payment options remain intentionally inactive.

**Can it be submitted with billing disabled?** Console does not block clicking Submit, but the unchanged listing advertises native paid purchases, while the final v30 customer-runtime journey is unavailable. Production public-runtime promotion and fresh public round configuration are also still gated. A deliberately billing-disabled review candidate would need truthful listing/reviewer text and accessible enabled functionality; it must not masquerade as completed paid-pack acceptance or silently replace the approved commercial model. No such material scope change or submission was made.

## Public gameplay and remaining non-billing gates

- Existing protected public acceptance demonstrates free Core, normal account security and persisted NFL/AFL/NRL entries without a private-beta allowlist. Today's read-only check confirms accessible Play and correct displayed Traditional caps: $4.4m / $13.8m / $8.2m.
- Production's public programme, sports and rounds remain disabled; there were zero enabled public rounds in the read-only snapshot. Do not expose old private-beta competitions. The verified protected roster-practice package has a **8 November 2026 12:00 UTC** deadline, so revalidate schedule/roster freshness before promotion; create versioned future rounds when needed rather than rewriting locked history. Practice fixtures must remain labelled practice.
- Professional player names are **owner-confirmed**; no repeated approval requested. Original generic jerseys remain. Separate proprietary AFL/NRL player-stat feeds have no documented redistribution agreement and must stay disabled; absence of those feeds is not itself a reason to remove licensed factual rosters or free gameplay.
- The remaining commercial assessment is narrowly the linked paid-random-pack/rarity/closed-loop transferable-card model, including whether transferable value changes applicable Australian or store requirements. No cash-out, paid entry or prizes are enabled. M classification and owner model approval are not evidence of independent clearance for every marketplace pathway. The documented conservative configuration keeps commercial transfers off initially while retaining approved packs; it is not a silently activated replacement model.

See [rights and classification assessment](LAUNCH_RIGHTS_AND_CLASSIFICATION_DECISIONS_20261102.md) for source evidence and exact questions. No broad new name-licensing gate was invented.

## Apple / TestFlight

Source prepared; **not compiled, signed, uploaded or activated**. Owner confirmed no enrolled Apple team or signing Mac is ready. The shared account/wallet model, disabled StoreKit plugin, sandbox verification/queue and proposed product mapping are ready for that next environment. The local queue is not a Production migration. App Store Connect products, API/signing credentials, hosted Apple admission, genuine sandbox notifications, SDK privacy archive audit and device testing remain outstanding.

Use [iOS readiness](IOS_READINESS.md) and [Apple submission draft](APPLE_SUBMISSION_DRAFT_20261105.md). No Android screenshot was relabelled as an iPhone screenshot. No recurring Mac service was purchased. App Store privacy/rating questions must be completed for Apple's actual compiled release rather than copied from Google.

## Operations, policies and exact next actions

Published approved v2 policy URLs all responded: [Privacy](https://docked.com.au/privacy), [Refunds](https://docked.com.au/refund-policy), [Commercial terms](https://docked.com.au/commercial-policy), [Retention](https://docked.com.au/retention), [Account deletion](https://docked.com.au/account-deletion). No material policy changes were published in this task.

[Operations runbook](DUAL_STORE_OPERATIONS_20261105.md) covers support review, provider reconciliation, refund holds, outage response and rollback using existing services. Nine cron jobs had successful database invocations in the inspected 24-hour window; downstream delivery and alert escalation were **not** proven. No log drain was configured. Retention remains dormant; key custody/recovery, provider backup expiry and an alert-delivery drill need operational completion before claiming full readiness.

1. **Google:** await the case's specific corrective action, then perform only the affected supervised v30 TEST acceptance. No phone is needed while waiting. Do not activate real-money products as a diagnostic.
2. **Owner/commercial adviser:** resolve only the documented closed-loop transfer/value and separate data-source questions. Existing model and player-name approvals stand. Disabled proprietary feeds need no fabricated licence claim.
3. **Owner/operations:** name the key/recovery and support/escalation custodians; approve the actual retention schedule and provider backup handling before irreversible cleanup. Do not repeat approval for already applied dormant migrations.
4. **Apple:** enrol the organisation and arrange authorised Mac/Xcode access, then signing/App Store Connect and sandbox testing. Keep credentials private.
5. **Release:** after mandatory technical/commercial gates, promote the reviewed public runtime/configuration, refresh future public rounds and reviewer access, align final listing/declarations, and use the existing conditional submission authority with managed publishing ON. Public registration, live charges and publication are separate gated actions.

Google public release: **NO-GO today**. TestFlight upload: **blocked by Apple enrolment and Mac/signing access**, with additional native/sandbox acceptance to follow. Android remains v30/1.29; no unnecessary rebuild occurred.
