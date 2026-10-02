export const articles = [
  {
    slug: "value-versus-winners",
    title: "A good prediction is not always a good price.",
    category: "Foundations",
    minutes: 5,
    summary:
      "Why the chance of winning and the price on offer answer different questions.",
    sections: [
      [
        "Two separate questions",
        "Picking a likely winner asks which outcome is most probable. Assessing value asks whether a quoted return compensates for the chance of losing. A favourite can be likely to win and still be a poor price. An underdog can be unlikely to win and appear attractively priced under an estimate that may itself be wrong. Neither observation tells you what happens in the next match.",
      ],
      [
        "A fictional comparison",
        "Suppose a fictional binary event has an estimated 55% chance of a win. At decimal odds of 2.00, a one-unit winning stake produces one net unit; a loss costs one unit. Estimated EV is 0.55 × 1 − 0.45 × 1 = 0.10 units. At 1.80, the same estimate gives 0.55 × 0.80 − 0.45 = −0.01 units. The selection has not changed. Its price has. These numbers are arithmetic examples, not a Docked tip or a measured probability.",
      ],
      [
        "An estimate needs scrutiny",
        "Docked’s proposed reference method removes bookmaker margin from complete markets before combining independent sources. That creates an estimated probability, not knowledge of the true chance. Sources may share errors, quotes may be stale, and a price may be unobtainable. A positive calculation is the start of a research question. It is not a promise of profit.",
      ],
      [
        "Choosing not to participate",
        "Understanding a calculation does not create an obligation to bet. You can use the research without wagering. Never treat an apparent edge as income or a reason to recover a loss. If gambling is affecting your wellbeing, pause and use the support resources on our Safer Gambling page.",
      ],
    ],
  },
  {
    slug: "minimum-odds",
    title: "The price is part of the recommendation.",
    category: "Reading an edge",
    minutes: 4,
    summary: "A minimum price is a boundary, not a target to chase.",
    sections: [
      [
        "Why a selection is not enough",
        "A recommendation stated without its price is incomplete. When odds fall, the potential return decreases while the estimated chance may remain unchanged. A previously qualifying opportunity can stop qualifying. Publication odds record what was observed at publication; current odds belong in a separate observation. Changing one must never rewrite the other.",
      ],
      [
        "Work through the boundary",
        "In a fictional example with estimated probability 0.55 and required EV of 3%, minimum decimal odds are (1 + 0.03) / 0.55 = 1.872727… . At a 0.01 tick, the displayed minimum must be 1.88. Rounding down to 1.87 would advertise a price below the rule. At 1.88, estimated EV is 3.4%; at 1.87, it is 2.85%. Real markets may have different tick sizes.",
      ],
      [
        "Minimum does not mean guaranteed",
        "The threshold is conditional on the probability estimate, matching rules and fresh evidence. It is not an assurance that a bet will win or that anyone can obtain the price. Suspensions, geographic eligibility and individual limits can prevent access. An expired alert should not be followed at a worse price.",
      ],
      [
        "What to check",
        "Read the market period and settlement rules, source time, minimum odds and current status. A watchlist target only describes a hypothetical price condition; it is not an approved active tip. Do not increase stakes or use another account to compensate for a missed quote. Missing an opportunity is an acceptable outcome.",
      ],
    ],
  },
  {
    slug: "no-tip-is-correct",
    title: "Sometimes the right number of tips is zero.",
    category: "Process",
    minutes: 4,
    summary: "A publishing schedule must never become a betting quota.",
    sections: [
      [
        "A threshold should stay a threshold",
        "A rule is meaningful only if it can reject every candidate. Lowering a threshold because a day is quiet changes the strategy. Publishing an extra selection to maintain engagement creates a different process from the one evaluated in research. Docked’s proposed decision windows and selection ordering are fixed in a versioned configuration.",
      ],
      [
        "Different kinds of empty",
        "No qualifying edge means a valid scan completed but nothing met the rules. Data feed unavailable means a scan could not be trusted. Research validation pending means the method has not passed its launch gates. Not available in your region means the service is restricted there. These states may look similar on a list, but they carry different evidence.",
      ],
      [
        "A fictional day",
        "Imagine four otherwise eligible markets. One has stale prices, another has only one independent reference, and two have estimated EV below 3%. There are no publishable candidates. Publishing the least weak candidate would violate the rule. It would also hide the data problem that caused one rejection. Rejection records help researchers measure these limitations.",
      ],
      [
        "Less activity can be useful",
        "An informative service can explain its process, publish complete results and teach uncertainty without encouraging daily wagering. Pause messages, choose a weekly digest or simply read occasionally. No streak, reward or obligation should depend on betting frequency. If notifications make it harder to disengage, turn them off.",
      ],
    ],
  },
  {
    slug: "bookmaker-margin",
    title: "What the margin hides in the odds.",
    category: "Pricing",
    minutes: 6,
    summary:
      "Convert a complete market before comparing probability estimates.",
    sections: [
      [
        "Implied probability",
        "For decimal odds O, the reciprocal 1/O is the quoted implied probability. In a fictional two-outcome market priced at 1.90 and 1.90, each reciprocal is about 52.63%. Together they sum to about 105.26%. That total above 100% is an overround. It is not a guarantee of the bookmaker’s realised profit on that event.",
      ],
      [
        "The proportional baseline",
        "A simple margin-removal method divides each reciprocal by their sum. In the symmetric example, both outcomes become 50%. With unequal prices, the same calculation preserves their relative proportions. It assumes margin is distributed proportionally, which may not reflect actual pricing behaviour. Alternative methods are research choices that must be frozen before held-out evaluation.",
      ],
      [
        "Use every outcome",
        "A football 1X2 market requires home, draw and away prices under matching regulation-time rules. Omitting the draw and normalising the other two answers a different question. Likewise, regulation-only and overtime-inclusive markets cannot be combined because the payoff states differ. A complete vector must be normalised for each source before averaging vectors.",
      ],
      [
        "Independence matters",
        "Two brands can share ownership or trading infrastructure. Counting related sources as independent can exaggerate agreement. The offered bookmaker and its related skins must not contribute to their own reference. Even genuinely independent sources can share information and errors. A margin-free reference remains an estimate, not a claim of certainty or a reason to risk money.",
      ],
    ],
  },
  {
    slug: "losing-runs-and-variance",
    title: "Losses are part of the evidence.",
    category: "Risk & uncertainty",
    minutes: 5,
    summary:
      "Why a positive estimate can coexist with a painful losing sequence.",
    sections: [
      [
        "Expectations are not sequences",
        "Expected value describes a probability-weighted average under assumptions. It does not prescribe the order of outcomes. Even a correctly estimated favourable price can lose repeatedly. Real sporting events can be dependent, and probability estimates can be wrong, making simple independent-trial examples incomplete.",
      ],
      [
        "A deliberately losing example",
        "Consider five fictional one-unit results: 2.00 win, 1.90 loss, 2.20 win, 1.80 loss, 2.00 loss. Net units are +1 −1 +1.2 −1 −1 = −0.8. With five non-void units staked, ROI is −16%. The cumulative path is 1.0, 0.0, 1.2, 0.2, −0.8. Its largest peak-to-trough fall is 2.0 units and its longest losing run is two. This is an accounting illustration, not a historical Docked record.",
      ],
      [
        "Show the whole path",
        "A total can conceal an uncomfortable path. Drawdown, monthly returns and losing runs add context, but they are still sample descriptions. They do not cap future losses. Selecting a favourable starting date can radically change a displayed return; the complete ledger and all-time default help make that choice visible.",
      ],
      [
        "Do not chase",
        "A loss does not make a subsequent win due. Increasing exposure to recover losses can create serious harm. Tracking should help you understand risk and decide to stop, not create pressure to continue. Optional personal records remain separate from Docked’s official ledger. You never need to wager to follow this research.",
      ],
    ],
  },
  {
    slug: "estimated-ev-and-returns",
    title: "Estimated EV is not realised profit.",
    category: "Evidence",
    minutes: 5,
    summary: "Keep a model’s expectation separate from what actually happened.",
    sections: [
      [
        "Two different measurements",
        "Estimated EV is calculated before an event from an estimated probability and an observed price. Realised return uses the event’s settled outcome and the recorded benchmark price. Neither can substitute for the other. A winning result does not prove a decision was good; a loss does not by itself prove the estimate was wrong.",
      ],
      [
        "A fictional calculation",
        "If estimated win probability is 0.55 at decimal odds 2.00, EV is 10% per unit under a binary payoff. The actual net result is either +1 unit or −1 unit. No individual settlement returns the calculated +0.10 units. Across a sample, differences can reflect chance, probability error, timing, price availability or settlement mismatches.",
      ],
      [
        "Be clear about denominators",
        "Docked’s fixed one-unit ROI convention divides net units by settled non-void stakes. Voids return the stake and are reported separately. Pending and disputed entries are not silently treated as losses, wins or zero-return settled bets. Total turnover, void stakes and pending stakes should remain visible alongside the ROI. An empty sample has N/A ROI.",
      ],
      [
        "Interpret cautiously",
        "Calibration asks whether probability estimates correspond to outcome frequencies across the full eligible universe. Checking only selected winners would be biased. Dependence and changing markets limit conclusions from small samples. A transparent service preserves negative and inconclusive findings and does not turn an estimated advantage into a guaranteed-income claim.",
      ],
    ],
  },
  {
    slug: "closing-line-value",
    title: "Closing value is a diagnostic, not a verdict.",
    category: "Research",
    minutes: 5,
    summary: "What a later reference price can and cannot tell you.",
    sections: [
      [
        "A later comparison",
        "Closing-line value compares an entry price with a declared reference near the event start. Docked defines probability-based CLV for an unchanged market as entry effective odds × margin-free closing probability − 1. The chosen reference sources, cutoff and data coverage must be disclosed. Closing prices are not available at an earlier decision time and cannot be used to select that earlier recommendation.",
      ],
      [
        "A fictional example",
        "At entry odds 2.00 and a closing reference probability of 0.53, the calculation gives 6%. This does not mean the event won or that profit is guaranteed. It describes a price relationship to a later estimate. If closing probability were 0.48, the diagnostic would be −4%. Both observations belong in a complete report.",
      ],
      [
        "Missing means missing",
        "A missing closing snapshot is N/A, not zero. A snapshot after the event began cannot serve as a pre-start close. A changed handicap, period or overtime rule is a different market. A five-minute historical archive cannot support claims about an exact one-minute quote or whether a member could place a stake.",
      ],
      [
        "What remains unknown",
        "The reference can itself be biased. Limits, liquidity, delays and regional access can separate a quoted benchmark from an obtainable price. Positive CLV is useful evidence to investigate alongside calibration, actual results and availability. It is not proof of future profitability and should never be used to pressure someone to keep betting.",
      ],
    ],
  },
  {
    slug: "backtest-paper-live",
    title: "Three records. Three different claims.",
    category: "Research",
    minutes: 6,
    summary:
      "Historical replay, forward paper tracking and public publication are not interchangeable.",
    sections: [
      [
        "Retrospective backtest",
        "A backtest replays past decisions from licensed timestamped prices and authorised outcomes. It should use only information available at each simulated decision. If a snapshot is missing, that gap must remain visible. Choosing parameters after inspecting test results contaminates the holdout, regardless of the calendar year printed on the report.",
      ],
      [
        "Forward paper",
        "Forward paper tracking records decisions prospectively after the rules are frozen. It can expose operational problems that historical archives miss, such as delayed ingestion and quote decay. Paper entries still do not prove anyone obtained a bookmaker price. Starting a paper ledger today does not create a forward record for yesterday.",
      ],
      [
        "Live published",
        "Live published means a recommendation was actually published before the event. It is not the same as independently audited execution. Publication figures remain immutable while availability and settlement change in separate events. A withdrawn or expired tip normally still settles at its original benchmark price; factual corrections require a visible reason and linked correction.",
      ],
      [
        "A fictional comparison",
        "Imagine a profitable replay and an unprofitable first paper month. Combining their returns into one headline would conceal their different origins. Report each separately, with its own sample size, exclusions and uncertainty. Demo fixtures are a fourth category used only for software checks and illustrations. They must never enter any performance claim. Research that finds no reliable advantage is still a valid result.",
      ],
    ],
  },
];
export const safetyNote =
  "All worked examples are fictional. Gambling can cause financial and personal harm. You can use Docked without betting. Never chase losses or treat betting as income.";
