# Phase 4.5 hosted beta acceptance

Genuine browser acceptance on the isolated HTTPS Preview:
`https://docked-preview-s24-briant-ginty.vercel.app`, Docked Supabase project
`bckkllmndoxzpzdqrevb`. No production DNS/deployment, owner credentials, external
emails, provider requests, genuine sporting results or performance records were
used. Browser pages received actual application responses; no page/API fixture
responses were injected during hosted acceptance.

## Final evidence

- [Clean resumed journey and twenty screenshots](2026-10-03T13-28-01-477Z/results.json):
  **PASS**, source `f1d55a954644b122b57ccbed1b54207194552390`, deployment
  `dpl_8Zs6gWmRJC4kL9sUL7WvLRYXXR3y`. Zero page errors, console errors, scope
  violations, horizontal overflows or automated accessibility violations on the
  twenty captured page/view combinations. Authenticated `/dashboard` is included
  explicitly after the nested-paragraph repair.
- [Revoked-access proof](2026-10-03T13-31-08-562Z/results.json): **PASS** after the
  operator revoked only QA-A's preview grant. Genuine login and own-account export
  still work, including the permanent synthetic record. Preview GET returns 403;
  attempted review returns 400 with `ok:false`; social feed returns restricted
  with no posts. Zero page/console/scope errors. No privilege was restored.
- [Final deployment boundaries](../hosting-audit.json): database available;
  providers `NOT_CONFIGURED`; genuine feed, strategy and publication disabled.
  Exact deployment/project identity is recorded there.
- [Local fixture and hydration checks](../fixture-local-results.json) are
  separate synthetic software tests. They do not establish a sporting edge or
  substitute for the hosted evidence above.

The clean run resumed the same private journal after earlier checkpoints; it did
not recreate accounts, replay consumed invitations or present all work as a single
first-attempt pass. Invitation signup, onboarding and QA-B deletion had already
been exercised against source `944499fcc0e5f3a3d6ab8bc4784ac0ecb0cbbd1c`.
The final source changes repaired presentation hydration; they did not change
authentication, permissions or ledger logic.

## Actual account and action coverage

Four exact operator-issued reserved-domain invitations were redeemed through
`/app/signup`. This granted test access through the documented invitation flow;
**it did not prove email ownership**, and no verification email was sent.
Passwords and invitations remain out of tracked evidence. Signup marketing
consent was unselected. Genuine session cookies, onboarding selections,
preferences, app reopen/refresh, profile editing, logout and returning login were
checked. The returning session did not repeat onboarding.

Two obvious DEMO seed profiles authored four `[PREVIEW TEST POST]` discussions.
QA-A then exercised an actual comment, nested reply, reaction, save, follow and
unfollow, mute and unmute, a clearly labelled test report, a test discussion and
block enforcement. The completed social checkpoint passed in the
[13:26 attempt](2026-10-03T13-26-02-610Z/results.json); its subsequent screenshot
step hit a harness loading-shell race. The clean resume read the stored reaction,
save, two comments and final relationship states rather than toggling or posting
them again. Block and returning-login checks completed in the clean run.

QA-A and QA-B each reviewed an explicit DEMO market reference, had to confirm its
permanence, submitted an actual isolated fixture record and retrieved it through
their own export. The genuine leaderboard remained restricted; the preview
leaderboard explanation claimed no rank, ROI, points or results. No synthetic
record entered a canonical official/community ledger.

QA-B used the actual dashboard deletion form after submitting its fixture. The
application reported completed erasure; member API access became 401 and fixture
access 403. Independent operator checks confirmed removal of Auth/profile/
session/grant/onboarding linkage while the pseudonymous, explicitly synthetic
fixture remains retained. The clean run skipped the deleted account. QA-A was
released only after its revocation/export proof; final cleanup/redaction is owned
by the operator and requires the parent's completed secret audit. Two labelled
seed profiles/posts are intentionally retained for preview usability, not as
genuine customers or activity.

## Initial failures and repairs — retained evidence

| Attempt                                                                                        | Finding and resolution                                                                                                                                                                                                                                                                                                |
| ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [13:07](2026-10-03T13-07-32-428Z/results.json), [13:09](2026-10-03T13-09-16-246Z/results.json) | A cold-load Create post click preceded hydration; the mode did not change and the post-type locator timed out. No post request was sent. Composer buttons now stay disabled until mounted.                                                                                                                            |
| [13:10](2026-10-03T13-10-54-218Z/results.json)                                                 | Dashboard delete response was not observed; read-only database verification confirmed no disable/deletion took place. The harness now waits for the existing form readiness state before entering confirmation.                                                                                                       |
| [13:16](2026-10-03T13-16-43-217Z/results.json)                                                 | QA-B deletion succeeded with an observed HTTP 200, but the dashboard produced React hydration error 418 due to invalid nested paragraphs. The dashboard wrapper was repaired. An early reaction tap also preceded SocialCard hydration; social/profile action controls now remain disabled until mounted.             |
| [13:26](2026-10-03T13-26-02-610Z/results.json)                                                 | Real social actions passed with zero browser errors. The screenshot harness asserted a strict single shell while a streamed loading shell and completed shell briefly coexisted. It now waits for loading completion before checking exactly one authenticated shell and one h1. No application control was weakened. |

The two isolated real-SSR-to-production-React hydration regressions passed:
disabled pre-hydration controls cause no requests, then the existing composer,
reaction/save/follow/mute/block handlers work after hydration. No arbitrary sleep,
injected production handler, relaxed security check or fabricated performance was
used to make the hosted acceptance pass.

## Screenshot inventory

All final screenshots are in `2026-10-03T13-28-01-477Z/`. There are ten routes in
each format: Edges, Feed, Following, Points, My Edge, Compose, seed post detail,
own Profile, Notifications and Dashboard.

- `*-412.png`: **412 × 915 CSS pixels at scale 1**, the S24-style browser view.
- `*-360@3x.png`: **360 × 720 CSS pixels at scale 3**, producing actual
  **1080 × 2160 PNG pixels**. This remains a phone layout; it is not a 1080px-wide
  desktop viewport or a resized desktop screenshot.
- Example selection: [Edges](2026-10-03T13-28-01-477Z/-edges-360@3x.png),
  [Feed](2026-10-03T13-28-01-477Z/-feed-360@3x.png),
  [Following](2026-10-03T13-28-01-477Z/-following-360@3x.png),
  [Points](2026-10-03T13-28-01-477Z/-points-360@3x.png),
  [My Edge](2026-10-03T13-28-01-477Z/-my-edge-360@3x.png),
  [Compose](2026-10-03T13-28-01-477Z/-compose-360@3x.png),
  [Dashboard](2026-10-03T13-28-01-477Z/-dashboard-412.png).

Screenshots show the PREVIEW badge and clearly labelled test identities/content.
They contain no password, invitation code, token, owner account or actual sporting
performance. They are beta presentation evidence, not proof of Play approval,
genuine customer activity, email verification or an active odds feed. Full legal,
privacy/contact, community-rules/moderation and Play approval gates still apply.

## Reproduction boundary

The reviewed runner is `scripts/hosted-preview/phase45-browser.ts`. Explicit
project and write-scope opt-ins plus the fresh exact private roster are mandatory.
Modes are `--run` and `--verify-revoked`; immutable journal checkpoints permit
safe resume and refuse identity substitution. **Do not rerun a cleaned roster or
reuse consumed invitations.** A future independent run needs a separately
authorised exact operator roster. Local browser hydration tests are separately
reproducible with `EXTERNAL_PREVIEW=1 npx playwright test
tests/browser/composer-hydration.test.ts --reporter=list`; all their network is
intercepted and they need no real account or provider.
