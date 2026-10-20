# Scoring and lineup integrity — 21 October 2026

## Confirmed causes

The Kamara difference is a **saved ruleset difference**, not a duplicate or missing rarity multiplier. The published player history uses Full-PPR. Both entered Week 6 competitions retain `docked-nfl-seven-rolling-test-v1` (half-PPR). Both Week 7 competitions use `docked-nfl-seven-full-ppr-v2`. This repair does not change those saved versions.

Read-only inspection found identical Kamara statistical values in the history projection and competition journal:

| Category | Recorded value | Game-log points | Week 6 competition base |
| --- | ---: | ---: | ---: |
| Rushing yards | 34 | 3.40 | 3.40 |
| Receiving yards | 35 | 3.50 | 3.50 |
| Receptions | 2 | 2.00 | 1.00 |
| Receiving touchdowns | 1 | 6.00 | 6.00 |
| Other scoring categories | 0 | 0.00 | 0.00 |
| **Base** | | **14.90** | **13.90** |

The saved Legendary multiplier is **1.4**, producing **13.90 × 1.4 = 19.46** competition points. Applying the current game-log Full-PPR rules would produce 20.86, but doing so to Week 6 would change its frozen rules. It is not a presentation correction.

The other defect is a real field-layout bug: the database returns the lineup alphabetically by slot, putting FLEX1 first. Rankings rendered that array directly, and CSS centered its first child in the QB location. Play used canonical slot order. The saved entry itself was not rearranged. Kamara is saved in Traditional FLEX1 and All-Star RB1.

## Repair

- Play and Rankings now share `SevenField`, with explicit QB1/RB1/RB2/WR1/WR2/TE1/FLEX1 placement. Rankings looks up each saved slot rather than trusting array order. It remains read-only.
- Game Log labels its points as base Full-PPR points, without a card multiplier.
- The competition summary identifies the actual saved reception rule. Each scored card displays its persisted base and applied multiplier alongside its persisted contribution. No client-side scoring was added.
- A restricted additive database read function exposes saved ruleset context and card identity behind the existing session, visibility and lockout guards. It uses the scoring engine's applied multiplier; non-rarity rules do not expose an applied multiplier.
- The comparison sheet's sticky heading stays within the viewport while scrolling.

## Rules, precision and totals

Passing: 0.04 per yard, 4 per TD, −2 per interception. Rushing/receiving: 0.1 per yard, 6 per TD. Fumbles lost: −2. Two-point passing/rushing/receiving conversions: 2. Week 6 has 0.5 per reception and the legacy 6-point individual kickoff-return, punt-return and offensive-fumble-recovery TD categories. Full-PPR v2 uses 1 per reception and its existing approved category set. Neither version was edited.

The frozen rarity configuration remains Core 1.0, Rare 1.1, Elite 1.2, Ultra Rare 1.3, Legendary 1.4, Icon 1.5. The engine uses integer centipoints, integer multiplier tenths and BigInt half-away-from-zero rounding once per player contribution. The team aggregates those contributions; Rankings orders the same authoritative totals and retains shared ranks for ties. No independent browser calculation exists.

At inspection, Traditional Week 6 journal revision 35 held Baz's known total of **23.73**, equal to the sum of its six available contributions, including Kamara's 19.46. Docked's known total was **17.80**. Their provisional ranks were #1 and #2. All-Star journal revision 34 held Baz's known total **36.83**, also matching its available contributions. The unresolved player is still unavailable, not secretly counted as a completed zero.

## Freshness

Kamara's competition source revision 2 was observed at 2026-10-20 06:23:38 UTC (Traditional) and 06:24:11 UTC (All-Star). The history generation last succeeded at 21:50:15 UTC and retained player revision 1. These revision counters belong to different pipelines; their underlying values matched. No stale-statistic discrepancy was found for this player.

Play and Rankings use the same no-store endpoint, refresh every 30 seconds while visible and on focus/resume, and retain the last successful data if refresh fails. An open Rankings team sheet follows refreshed rows. Existing ingestion/reconciliation handles provisional corrections; finalised results retain correction controls. The feed remains postgame, not licensed play-by-play live scoring.

An existing malformed SEA–DEN source row with an empty player identity still prevents a clean result for one selected player in the affected Baz entries. This pass does not discard malformed source records or turn that validation failure into a DNP. It is separate from Kamara's ruleset difference.

## Verification

- 53 focused platform tests passed across scoring, rarity, Kamara's verified source fixture, rounding, DNP/missing data, provisional corrections, finalisation, reconciliation cache, position eligibility and statistics presentation. One old presentation assertion was updated for the explicitly requested Full-PPR/base label.
- Four isolated database tests passed, including all migrations, immutable snapshots, private future drafts, before-lock privacy, after-lock eligibility, revoked access, direct-role denial, exact original card-to-slot publication and historical scoring protections.
- Typecheck and targeted lint passed.
- Clean production build passed. Canary credential markers were absent from the newly built browser assets.
- Browser checks passed at 412×915 and 1440×915. Play, own Rankings view and opponent view matched all seven card IDs, slot IDs and displayed contributions exactly, including FLEX. A controlled 30-second polling cycle updated provisional points; a subsequent failed refresh retained them. Escape/close worked. These are desktop Edge mobile-size tests, not a physical Samsung or iOS certification.
- Browser screenshots use isolated teams. The Kamara statistics fixture contains the actual audited published statistics; other players and scores are explicitly illustrative. No real entries, purchases or wallet mutations were used for tests.

## Evidence

- [Before Rankings mobile](before/other-team-412.png)
- [After Rankings mobile](after/other-team-412.png)
- [Same lineup in Play](after/same-lineup-play-412.png)
- [Same lineup through Rankings](after/same-lineup-rankings-top-412.png)
- [FLEX and competition breakdown](after/same-lineup-rankings-flex-412.png)
- [Kamara Game Log](after/kamara-game-log-412.png)
- [Desktop comparison](after/same-lineup-rankings-top-1440.png)
- [Exact slot/card/score comparisons](after/geometry.json)

## Hosted safety and remaining decision

Migration `20261020231532_scoring_context_read_model` was applied as additive read-only function DDL. The prior function's hash remained unchanged (`9d9321cd21a64e9d8db48623a18e0fff`). Only the existing application role can execute the new function; authenticated/anonymous direct access remains denied. No scoring backfill, entry changes, finalisation, awards, wallet or ownership writes were performed.

Week 6 intentionally remains on its saved half-PPR rules. Full numerical alignment with today's Full-PPR Game Log would require a separate owner decision, a complete old-versus-new score/rank/prize dry run and the approved historical correction process. This task does not request or assume that approval. Protected Preview release evidence is recorded separately; authenticated hosted acceptance remains a distinct check from the isolated browser/database tests.

## Protected Preview

Web commit: `5f9093df0893b68798d944fe1806d1dd018d2697`.

Deployment: `dpl_9P8StsiTYZwFcijmffWnBY7yBPxy`, **READY**, Preview target, Sydney runtime, no custom-domain aliases. Vercel deployment protection remains `all_except_custom_domains`. [Open protected Preview](https://docked-production-jc76k3gwh-briant-s-projects.vercel.app).

The protected fetch verified the actual Docked login page (200, Welcome back, email/password fields). The public production release-identity endpoint deliberately returns 404 on this owner Preview; the commit was verified against Vercel deployment metadata instead. Hosted member scoring acceptance still requires signing into the Preview. The existing live deployment remains `dpl_GN5g1UW7Lbg1gKAQaUGujAjD9Jcp` / `475691a6b28a03c5ff5bb599d8b4cd15e4016043`.
