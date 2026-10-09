> Historical/superseded product document. Permanent fantasy product direction — 10 October 2026: [PRODUCT_DIRECTION](PRODUCT_DIRECTION.md) is authoritative. This document does not authorize old features, providers, jobs or launch gates.

# In-app notifications — Phase 3

Prepared 3 October 2026. External email and push are disabled in the social preference schema and API. No notification in this phase sends an external message.

The inbox returns its newest 50 currently visible records, grouping keys, read state and an unread total across all unexpired visible inbox records. Mark-read affects only the authenticated member's rows. Separate preferences cover official Edges, followed-member activity, social replies/reactions/follows, leaderboard milestones, competitions, deals/marketing and in-app delivery. Marketing is initially off and requires a separate consent event and current marketing approval to opt in. Email/push cannot be enabled by a forged API field.

## Producers

| Producer | In-app event | Mechanism |
| --- | --- | --- |
| Canonical live Docked publication | Official Edge | Atomic social projection and durable fanout job |
| Official status or settlement/correction settlement | Edge status | Canonical append-only event trigger queues a job |
| Community confirmed Edge | Followed-member Edge | Atomic community ledger/social projection queues a job |
| Community settlement/correction | Followed-member Edge status | Canonical community event queues a job |
| Member social post | Followed-member post | Post insert queues a job |
| Comment/reply/reaction/follow | Social notification | Same transaction as the action |
| Comparable leaderboard snapshot milestone | Leaderboard milestone | Bounded leaderboard worker job; see leaderboard implementation |
| Competition/prize/deal | Future category only | Disabled; no active campaign producer |
| Account/system | Reserved category | No automatic producer added by this phase |

`processCommunityNotifications()` advances at most 100 recipients of one locked job per call and records a cursor transactionally. Retries deduplicate by originating event and recipient. No activity is fabricated to populate the inbox. An old official publication is not re-announced after its three-minute dispatch window; status messages refer neutrally to the changed record. Jobs older than seven days are suppressed. New follows/preferences do not cause an old job to backfill an announcement.

Every attempted insert rechecks recipient account status, latest jurisdiction and typed Edge feature approval, visibility, blocks, mutes, in-app/category preference, global alert pause, local quiet hours and a 30-per-24-hour cap. Followed-member delivery additionally requires that individual follow's separate notification opt-in; following alone defaults it off. Leaderboard delivery and inbox visibility additionally require its current region feature. Quiet-hour or capped delivery is suppressed, not retried later as a stale urgent alert. Messages contain no cash amount, guarantee, loss-recovery instruction or stake-increase prompt. Generic settlement updates are generated for all settlement outcomes, not selectively in response to losses.

`purgeCommunityRetention()` removes expired 90-day inbox rows and completed jobs older than 90 days. Quarantined media expiry is handled in the same protected worker helper. These helpers do not change canonical ledger records or send email/push. Worker health failures should be monitored using existing audit hooks; no hosted queue, push credential or deliverability claim is made.
