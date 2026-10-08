# Approved Preview continuation — 9 October 2026

Continued from `93fdf921f51f40f0da6be6564b730900e3ad9049` on `pivot/fantasy-cards-preview-v1`. The owner confirms the review branch is Preview and authorizes deployment/testing, but also requires independent verification before pushing and says to stop if mapping remains ambiguous. That check is blocked. The prior generic deployment-authorization question is resolved.

## Fresh checks

| Check | Result |
| --- | --- |
| Repository | `https://github.com/bginty/docked.git`; remote `codex/vercel-beta-review` remains at `cffde28f24feef6a8dc05f4393331222c71f08a9` |
| Project/team | Exact `docked-production`, `prj_l0rpVDPRuIRp9UcBUkudeyUK5yST`, `team_tf6xweKKyVCj9bTppUKttJ4l` verified |
| Git association | Exact project returned using team, repository ID `1254841018` and project-name filters; no account-wide discovery |
| Protection/domains | Vercel Authentication enabled; no custom domains; `live: false` |
| Review configuration | 26 variables, all bound to Preview and the exact review branch; no credential-named variables; zero hidden Production variables |
| Custom environment | Exact branch query returned no custom environments; this does not distinguish built-in Preview from Production |
| Branch target | **Not independently verified:** connector removes Production branch tracking from its response. Preview-variable scope does not establish the deployment target. |
| Browser | Failed to initialize: `windows sandbox failed: helper_unknown_error: setup refresh had errors` |
| Local Vercel credential | Exact-project read-only API request returns HTTP 403; no token or raw credential response disclosed |
| Deployment history | Only `dpl_Fs32KgbJcaecDJyj53cy4exGDrtL`, cancelled previously, target Production, source `cffde28f` |
| Public site | HTTPS apex 200; www 301 to apex; holding page and DNS unchanged |

No push or deployment was attempted in this continuation, following the explicit pre-push verification condition. No new automatic approval rejection occurred. The old cancelled deployment is not a working Preview URL.

## Exact unblock

Provide inspectable, non-secret evidence from **docked-production → Settings → Environments** showing Production's **Branch Tracking** value and the review branch's Preview assignment/rules. Include the project name in the view. Screenshots allow direct inspection without credentials. Alternatively, restore local Vercel CLI access to this exact project so a read-only project response exposes `link.productionBranch`. Do not paste tokens. The connected plugin works; its reduced response does not contain the required field.

Once verified, push the completed local commits to the approved review branch, deploy protected Preview and verify its actual target/commit and lack of custom domains. Do not select Production or remove protection. No deployment authorization beyond the owner's existing approval is being inferred or requested.

## Hosted acceptance dependencies

The current review profile intentionally has **no database or email credentials** and disables accounts/gameplay. Hosting it permits UI and denial checks only. It cannot establish Supabase connectivity, account registration, email journeys or persisted gameplay.

Production-connected staging still needs a verified exact Vercel origin/branch, provider-aware staging and Auth callback bindings, reviewed policy/account configuration and the existing approval prerequisites. Current staging-origin logic retains Netlify-specific rules. Do not copy Preview data, use wildcard callbacks, weaken the review guard or change the production approval flag to make these tests pass.

Hosted Auth and gameplay tests: **NOT RUN**. The prior certificate-authenticated diagnostic send remains Graph-accepted and Inbox-confirmed; no repeat email was sent. No administrator/MFA was created, and the other-mailbox negative authorization test remains uncompleted.

Android: **NOT BUILT**. Existing beta receipt validation requires accepted hosted gameplay/Auth and the live `https://docked.com.au` target. A protected `.vercel.app` origin is not interchangeable. A pre-launch Android artifact needs a separately reviewed exact-host target and verified protection/session behavior after hosted acceptance; do not substitute the old APK or fabricate a receipt.

## Recommended owner defaults — pending approval

These are operating proposals, not legal conclusions or activated policies. Review the full [policy draft](FANTASY-PRODUCTION-POLICY-DRAFT.md).

| Decision | Proposed initial default | Owner action |
| --- | --- | --- |
| Eligibility | Adults 18+, Australia only, explicitly approved states occupied by initial testers | Confirm exact states/territories and policy applicability |
| Invitations | Owner plus two named friends, three accounts total initially; no public invitation links | Approve cap and exact recipients; current controlled email authorization is support@docked.com.au only |
| Administrator | One individually controlled owner account; ordinary roles for friends | Nominate exact login email; do not infer it from Vercel or a shared support mailbox |
| MFA | Owner enrolls an authenticator on their own device before staff operations | Complete real enrollment/challenge; never paste MFA secrets/recovery codes |
| Support/privacy | Existing support@docked.com.au; owner initially monitors requests | Name responsible person and realistic response target |
| Moderation | Owner initially reviews reports/appeals regularly; preserve reporting, blocking and audit controls | Confirm coverage/responsibility; no continuous-monitoring promise |
| Policies | Review beta Terms, Privacy, reward/community rules, complaints and retention together | Approve/amend wording and effective versions after outstanding applicability/processor/retention facts are resolved |
| Rewards | Retain approved 11-card starter, 10 daily points, controlled seventh-claim rewards | No new reward approval needed; finite inventory and actual integrity acceptance still required |
| Restricted features | Keep marketplace, payments, unavailable feeds and unvalidated official models disabled | Separate approval for any future expansion |

The proposed three-account limit is not a claim that every invitation path already enforces that cap. Verify it before invitations. At least two isolated users and real administrator MFA remain acceptance requirements.

## Preservation and test provenance

No application code changed here. Prior 436 passing platform tests, 12 local browser checks, successful build/typecheck/lint and zero-vulnerability dependency audit remain prior **local** evidence; they were not rerun or relabelled hosted acceptance. Infrastructure/repository/HTTP checks above are fresh.

No Oura, existing Docked Preview, Microsoft permissions, certificates, paid plans, public registration, production approval flags or domain records changed. No working hosted URL, deployed new commit, APK or administrator login is claimed. This checkpoint is committed locally; pushing remains withheld under the owner's explicit mapping-verification condition.
