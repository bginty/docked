# Fantasy UX visual acceptance

**Owner visual approval: PENDING. Physical Samsung S24: PENDING. Owner login: manually confirmed by owner, preserved.**

Images below render real isolated hosted QA card/score snapshots through the actual components in a local browser. Their visible disclosure distinguishes them from an authenticated hosted session. Names and scores are fictional QA. No new sporting statistics or live performance were invented.

| Journey | Mobile 412px | Desktop 1440px |
|---|---|---|
| Play home / scoring field | [Play](screens/play-412.png) | [Play](screens/play-1440.png) |
| Owned-card field selection | [Select](screens/field-selection-412.png) | [Select](screens/field-selection-1440.png) |
| Points / saved lineup | [Points](screens/points-412.png) | [Points](screens/points-1440.png) |
| Player breakdown | [Breakdown](screens/points-detail-412.png) | [Breakdown](screens/points-detail-1440.png) |
| Card detail | [Card](screens/details-412.png) | [Card](screens/details-1440.png) |
| Market illustration, execution disabled | [Confirm](screens/market-confirmation-412.png) | [Confirm](screens/market-confirmation-1440.png) |
| Collection | [Cards](screens/cards-412.png) | [Cards](screens/cards-1440.png) |
| Social component | [Social](screens/social-412.png) | [Social](screens/social-1440.png) |
| Profile | [Profile](screens/profile-412.png) | [Profile](screens/profile-1440.png) |

Local **SQL-backed transaction sandbox**, separate from hosted holdings: [paid-window confirmation](screens/local-paid-window-confirmation-412.png), [atomic receipt](screens/local-sandbox-receipt-412.png). Both participants and cards are synthetic fixtures; one counterparty consent is explicitly staged by the test harness. No payments or transfers are enabled in Preview.

Authored responsive/retry/empty-state evidence lives in `regression`; loading/error/recovery evidence in `screens`. Full-page captures show fixed navigation at the captured viewport boundary, not a second navigation inserted into scrolling content. Dialog captures use the visible viewport.

Automated inspection found no horizontal overflow, critical accessibility violations or browser page errors in the executed five-tab fixture checks. Tap selection and keyboard search/Escape were exercised. The standings omission detected by regression tests was repaired; existing tied ranks and server totals are retained. Mobile list view remains available for full-name readability. Software keyboard resizing, Android navigation protection handoff and physical S24 background/session behaviour still need the owner checklist in [the acceptance report](../../FANTASY_UX_ACCEPTANCE.md).
