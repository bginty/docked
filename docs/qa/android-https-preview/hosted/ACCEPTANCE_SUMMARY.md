# Standalone HTTPS browser acceptance

Canonical preview: https://docked-preview-s24-briant-ginty.vercel.app. Dedicated Supabase project: `bckkllmndoxzpzdqrevb`. Final verified deployment: `dpl_EMjGsHntMShpCLn5jiDCH2f1wxHW`, web source `226bf6b05c6a8d666e83c8570eeb81fd1580d9a0`.

The final focused browser run passed both cases on 3 October 2026. This is scoped revalidation after material fixes, not a claim that one unchanged full-suite invocation passed every case.

| Evidence | Outcome | Receipt |
| --- | --- | --- |
| Anonymous desktop and 390px mobile routes, closed signup/API/provider/publication gates, Axe and console | All 30 public cases passed in the first network-enabled full run | `run-1791010426019.json` |
| Genuine disposable-account lifecycle | Every functional checkpoint passed on web source `63b275dc9e34b7f0562f54248681a25883845e1d`; the final console assertion failed because of the subsequently repaired timestamp hydration defect | `run-1791012280137.json` |
| Final member views | Home, community, compose, profile, notifications and dashboard at 390px; home also at 320px. PREVIEW visible, no overflow, no Axe/console/page errors | `run-1791013054251.json`, `member-views.json` |
| Final populated timestamps | Real QA post and UI-submitted comment, plus one clearly labelled QA system notification. Exact instants retained, browser-local Sydney text correct, no hydration/console/page errors or Axe violations | `run-1791013054251.json`, `timezone-evidence.json` |
| Actual-secret scan of captured HTML, RSC, JavaScript and CSS | PASS: 1,314 files / 40,403,190 bytes; zero findings or scan errors | `final-browser-secret-audit.json` |

The completed functional lifecycle exercised genuine login, secure HttpOnly project cookies, persistence, profile access, restricted direct APIs, own-only export, in-app notification preferences, explicit follow consent, a real labelled QA discussion, genuine followed-post notification delivery without a worker, removal of QA commentary, global logout, login again, and completed application deletion of exact disposable memberB. Deletion returned 200 and subsequent protected access returned 401. Signup and recovery remained closed; no external email was sent.

Three material defects were found and fixed during hosted acceptance:

- A nested global rate limiter attempted to acquire another database connection while a transaction held the sole serverless connection. Durable limiting now runs before the transaction, with authorization repeated inside; the repaired genuine notification mutation and fanout passed.
- Before hydration, the authentication form could fall back to a native GET containing email/password query parameters. A fictional-only intercepted probe confirmed the issue. Forms now use POST, authentication submits remain disabled until their handler is ready, and the hosted test blocks credential-bearing query requests before network transmission. Both disposable QA passwords were rotated and sessions revoked as a precaution. Two isolated local browser regressions passed; the deployed no-JavaScript recheck showed POST `/api/auth`, disabled submission, and no attempted request (`login-fallback-after-fix.json`).
- Locale-dependent post/comment/notification timestamps disagreed between server and browser, producing React error 418 on a real post. Initial hydration now uses deterministic UTC text before switching to browser-local time with a zone label. Two local server-to-browser timezone regressions and the final populated hosted check passed.

The final notification screenshot deliberately contains “QA ONLY: timezone rendering check. This is a system test notice.” It was enqueued for exact QA A through normal in-app eligibility, preference and quota rules, with no actor, post or external delivery. It is not presented as member activity. The final test's QA post and comment were removed through the application. MemberB remains deleted; memberA and the QA notice were explicitly released to the operator for exact cleanup after the final checks. See the operator cleanup receipt for final removal status. The durable tester was excluded from these mutations and credential changes.

Screenshots are in this directory, including seven `member-*.png` views and the populated `timestamp-post-comment-sydney.png` / `timestamp-notifications-sydney.png` views. Raw rendered responses remain only in ignored private storage. Reports contain no passwords, cookies, tokens or private key values. Earlier failed receipts are retained. Operator-confirmed QA accounts establish account behavior, not actual email delivery, age verification, legal approval, licensed odds/results coverage, sporting performance or native-device acceptance.
