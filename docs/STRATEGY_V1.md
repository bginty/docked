# Strategy V1 — unvalidated research hypothesis

Executable source: `src/core/pricing.ts`. `hash(strategyV1)` is the canonical SHA-256 config hash. JSON object keys are sorted recursively. Decisions in research and ingestion use the same evaluator.

- Universe: EPL, La Liga and NBA candidate markets only. NFL remains disabled until tie treatment is supported.
- Football: full-game regulation 90 minutes plus stoppage; complete home/draw/away vector. NBA: full game including overtime, no draw. No lines, props, in-play, racing, parlays, exchanges or lay bets.
- Each complete source market: q=1/O, p=q/sum(q). Equal-weight independently normalised vectors. At least two approved operator groups. Exclude offered bookmaker and its entire operator group. Multiple references in one group collapse deterministically by bookmaker key.
- Complete event/competition/participants/rules match is mandatory. Ages <=180 seconds, source skew <=90 seconds, future or disordered source/snapshot/receipt timestamps rejected. Reference disagreement <=0.08. Suspensions, duplicate quote/bookmaker entries and implausible implied totals outside 0.95–1.25 are rejected.
- Estimated EV >=0.03, decimal odds 1.50–5.00. EV >0.20 is rejected for data-error review, never automatically promoted.
- Decision windows T−6h and T−1h; accept at or up to 120 seconds after target. Skip missed windows. Safety window: ten minutes before start.
- Ranking: EV descending, then selection ascending, then bookmaker ascending. A database unique index allows only one benchmark per event/evidence category across strategy versions.
- Minimum odds=(1+requiredEV)/p, ceiling to a 0.01 tick. Display conversion never controls qualification. Supported selected outcomes have win/loss payoff even in a three-outcome football market; draw as a selection is represented by its complete market probability. Unsupported push/lay structures are not accepted by the market evaluator.

`binaryPrice('0.55','2')` gives EV 0.10, fair odds approximately 1.81818 and minimum 1.88 after upward cent rounding. At 1.80 EV is −0.01. These are unit fixtures, not historical tips.

Research immediate entry uses the last observed snapshot no later than decision time. Delayed entry uses the first actual snapshot at least five minutes later, at most fifteen minutes later, with the original selection/bookmaker still qualifying. There is no interpolation. Rechecking availability is not a new publication decision.

Research metrics use Decimal for stakes/ROI. Bootstrap/calibration use floating-point descriptive statistics and are labelled separately. Day-block bootstrap keeps within-day dependence, does not model cross-day dependence, and returns no interval with fewer than two settled day blocks. This is not evidence of profitability until a properly reviewed dataset and design have been evaluated.
