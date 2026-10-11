# EPL remains unavailable; NFL release is independent

Direct free account: https://dashboard.api-football.com/register . Official pricing checked 11 October 2026: $0/month, 100 requests/day; free seasons restricted. https://www.api-football.com/pricing . No paid account or plan is required to investigate. Do not assume EPL 2026/27 coverage.

Store `API_FOOTBALL_KEY` only in the operator's secret environment or Supabase server secrets for a future dedicated adapter. Never in chat, Git, browser-prefixed variables or APK. No credential is currently configured or needed by the NFL worker.

After checking the actual account's intended-use/storage terms, set `API_FOOTBALL_TEST_STORAGE_APPROVED=true` and `API_FOOTBALL_COMPLETED_FIXTURE=<a completed EPL 2026 fixture ID from the dashboard>` in the same private operator environment. Run `node scripts/api-football-readiness.mjs --probe`. It permits one six-request probe per UTC day: status, league coverage, exact fixture identity/completion, players, events, lineups. It stops on provider/coverage errors, never changes competitions, and retains private response/hash evidence. Remove diagnostic bodies after the approved test retention period; no unattended EPL fetch is enabled.

Validate stable player/team/fixture IDs, names/positions, minutes, goals, assists, cards, own goals, goalkeeper saves/penalty saves, regulation intervals, on-pitch conceded events and correction revisions against the versioned Docked rule. Missing/null is not zero. Rounded minutes and events sharing a minute do not prove exact boundary ordering. A minute-based alternate ruleset would need explicit approval and a new version; do not modify current rules to force a pass.

Unsent enquiry: For EPL 2026/27 on this free account, may we use and store basic identities and completed-match statistics in an invite-only free ten-adult Australian fantasy beta, without images, logos or paid card sales? Which fields establish regulation-only seconds and deterministic ordering of substitutions, dismissals and goals sharing a minute? Please confirm assist/penalty-save definitions, correction availability, retention and attribution obligations and season access. If unavailable free, specify the minimum plan and currency. No subscription is authorised.

Account availability, field completeness and source-use acceptance are three separate checks. This preparation is not provider acceptance.
