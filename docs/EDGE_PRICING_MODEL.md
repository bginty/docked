# Reference-price Edge model

The primary official message is **TAKE this selection at the minimum Edge price or better**. Bookmakers are source context. Five distinct values must retain their own labels:

| Value | Meaning |
| --- | --- |
| Model probability | Estimated probability under the versioned pricing method; uncertain and unvalidated. |
| Docked fair | `1 / model probability`. A model value, not an observed executable price. |
| Minimum Edge price | `(1 + required estimated EV) / probability`, rounded upward to a cent. |
| Current market reference | Latest eligible standard-market availability reference. Missing/stale is unavailable, never zero. |
| Publication market reference | Immutable reference captured at official publication; this is the one-unit accounting price. |

The new `market-reference-edge-v2.0.0` evaluator uses the same Decimal arithmetic helpers as the original engine. Decision windows, odds bounds, suspicious-EV rejection and safety limits are preserved. Candidates rank by estimated EV then canonical selection, producing at most one per market evaluation; the existing database uniqueness constraint preserves one official publication per event and evidence class. The shipped reference cohorts are empty and the strategy is **UNVALIDATED**. This work does not start research validation, forward paper or live publishing.

For a purely arithmetic example, probability 0.55 gives fair price 1.81818… . With the preserved 3% threshold, minimum Edge price is **1.88**, and an observed reference of 2.05 implies estimated EV 12.75%. A 1.91 minimum would require a different threshold; the product illustration is not permission to silently change strategy parameters. Estimated EV is not guaranteed profit.

Current reference at or above the captured minimum supports ACTIVE while the publication remains eligible. Below minimum becomes PRICE BELOW MINIMUM; missing or invalid data, including a missing pricing cohort, becomes SUSPENDED. Expiry prevents reactivation and may progress to SETTLED when verified settlement evidence arrives. SETTLED cannot reopen. Observation calculations retain the publication probability and minimum; they do not rewrite its decision or accounting price. A later probability estimate used for the declared closing diagnostic stays separate from this current-EV calculation.

If a below-minimum price recovers, the record becomes SUSPENDED: the displayed current price can recover, but this version does not reactivate the original Edge. It is no longer falsely labelled below minimum, and no second benchmark bet is created.

An official win at a captured publication reference of 2.05 yields +1.05 benchmark units regardless of a later 1.82 price, its minimum or a later maximum. A community win uses its immutable submission reference in exactly the same accounting sense. Personal bookmaker and promotional-price context remains social metadata and cannot affect units, ROI, qualification or rankings. Screenshots never verify prices.

Legacy official and community versions remain readable under their original verification methodology. Their old prices, source evidence and results stay intact. New MarketReference snapshots are additive and permanently versioned. Server-side quote review/final submission revalidates the latest reference atomically and requires renewed permanent confirmation when its price, configuration or exact source IDs change. The database reconstructs source cohorts and evidence hashes before accepting a reference and rechecks it before ledger linkage. No client-entered competitive price is accepted.

Top Docked accepts explicitly supported `community-standard-v1` and `community-market-reference-v2` records while retaining each immutable verification version. Both use their own captured accounting price and the same one-unit, sample-size and integrity rules. Personal promotional prices never enter this calculation, and unknown verification versions fail closed.

Implementation: `core/market-reference.ts`, `core/reference-pricing.ts`, `core/reference-observations.ts`; trusted materialisation, ledger constraints and API integration live in the server/database layer. Original `pricing.ts`/legacy replay semantics are preserved. The [MarketReference specification](MARKET_REFERENCE.md) describes the unvalidated cohorts and robust aggregation.

Historical preparation uses an explicit version-dispatched CLI and the same reference pricing/observation library. Its historical contract requires contemporaneously known approvals, source availability, schedule and lifecycle state, plus a frozen region/configuration/code/window context. Immediate benchmark returns use the captured publication reference; delayed scenarios and closing diagnostics stay separate. Missing metadata or samples remain unavailable. Offline parity and integrity fixtures are software checks, and no real study or validation approval has occurred. [VALIDATION.md](VALIDATION.md#phase-4-research-support-boundary) describes the workflow and remaining licensed evidence and baseline-review requirements.
