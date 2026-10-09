> Historical/superseded product document. Permanent fantasy product direction — 10 October 2026: [PRODUCT_DIRECTION](PRODUCT_DIRECTION.md) is authoritative. This document does not authorize old features, providers, jobs or launch gates.

# Results provider readiness

Phase 5D retains **NOT_CONFIGURED**. The two OpenFootball files pass a limited goals-only training review but still lack operational finality/status/correction guarantees. The Odds API [score endpoint](https://the-odds-api.com/liveapi/guides/v4/#get-scores) was rechecked in official documentation; documented final scores do not by themselves establish Docked's precise regulation/correction contract or extend the existing Preview rights scope. No extra API credits were consumed. A new database gate requires explicit `regulation_results` source permission before appending model outcomes, separate from training permission. Prospective probabilities may accumulate while actual outcomes remain pending.

4 October 2026: **RESULTS_PROVIDER_STATUS=NOT_CONFIGURED**. Results remain pending without a separately authorised, mapped result source. The Odds API Free trial inspected scores but did not configure automatic settlement. Historical/current odds and a `completed` flag are insufficient proof of regulation result, cancellation/void rules or correction history. Actual limited inspection is recorded in [PROVIDER_TRIAL_RESULTS.md](PROVIDER_TRIAL_RESULTS.md); no additional provider requests were made for Phase 5B.

## Required canonical contract

The existing authorised canonical-file importer in `src/providers/results.ts` requires an enabled provider, rights reference, allowed canonical events, data hash and reviewer. This is an integration boundary, not a configured external sporting provider. Existing settlement and correction ledgers retain their rules and immutability.

| Source situation                                 | Required handling                                                                                                                               |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Scheduled / in progress / delayed                | Pending; no final result inferred.                                                                                                              |
| Final regulation result                          | Explicit canonical event/team mapping and regulation home/away score with source revision, observed/received times and finality. Draw is valid. |
| Extra time / penalties                           | Retain separate period scores. Never treat a shootout winner or extra-time total as regulation 1X2.                                             |
| Postponed / rescheduled                          | Append status/schedule evidence; suspend and review original event/market identity under existing rules.                                        |
| Cancelled / abandoned / awarded                  | Manual review until the licensed event status and market settlement rule justify a void or another outcome.                                     |
| Correction                                       | Append reason, actor, evidence, prior revision link and time. Retain the originally known outcome for as-of reports.                            |
| Missing/conflicting source, stale update, outage | Pending/manual review. No fallback scrape, invented score, zero score or automatic guess.                                                       |

Model calibration and betting settlement are different consumers. Calibration needs an authoritative regulation home/draw/away outcome; settlement additionally needs the exact immutable market's rules and event lifecycle. A correction must update each consumer through its own append-only record, not silently overwrite a previous result.

## Provider mapping research

football-data.org v4 documents separate match states including scheduled/timed, in-play/paused, finished, postponed, suspended, cancelled and awarded, plus score duration. That is promising mapping coverage, not proof that every plan supplies every period or a complete correction log. Accept a regular-duration final score only when its semantics are demonstrated; extra-time/penalty ambiguity remains manual review. [V4 match documentation](https://docs.football-data.org/general/v4/match.html).

API-Football and Sportmonks advertise richer fixture/results services, but exact season coverage, regulation periods, reschedule identity and correction retention still need a licensed test before an adapter can be enabled. Public product features do not establish the necessary publication/retention rights. StatsBomb Open Data is a selected historical collection, not a current results fallback. The [provider comparison](FOOTBALL_DATA_PROVIDER_RESEARCH.md) contains the current first-party pricing and rights assessment.

## Required next configuration

Choose and approve a sporting provider independently of the odds feed; obtain exact rights/season scope and a server-only key only if needed. Record canonical competition/team/event mapping and per-status/period semantics. Test cancellation, postponement, rescheduling, abandonment, draw, extra time, penalties, missing scores, duplicates and revised final results with clearly labelled local fixtures; then separately verify authorised real samples under an approved quota. No plan purchase, external email or production activation is implied.

Until those steps pass, independent model attempts may record honest abstention but cannot be scored from guessed outcomes, and published/community settlement stays pending. No new results adapter or feed is activated by this document.
