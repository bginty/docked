export const sports = [
  {
    slug: "football",
    title: "Football",
    description:
      "Understand football 1X2 pricing, the draw outcome, regulation-time settlement and why complete markets matter.",
    status: "RESEARCH ONLY",
    market: "Regulation-time 1X2: home, draw and away",
    sections: [
      [
        "The draw belongs in the probability vector",
        "A 1X2 market has three mutually exclusive outcomes. Docked requires prices for all three from each reference source before removing margin. A home/away pair with the draw omitted cannot stand in for a complete 1X2 market. A draw-no-bet market has a different payoff and is outside the initial strategy.",
      ],
      [
        "Read the settlement period",
        "The proposed football scope is regulation time plus stoppage time. Extra time and penalty shootouts are excluded. A cup match’s team-to-qualify market must not be matched to its regulation-time result market, even if both contain the same team names. Competition, participants, commencement time and rules must match before price comparison.",
      ],
      [
        "A changed fixture requires review",
        "Postponement, rescheduling and abandonment require authorised event-status evidence and the applicable settlement rules. A new start time cannot silently replace the timestamp used for an earlier decision. Missing or conflicting information suspends publication and keeps settlement pending.",
      ],
    ],
    related: "bookmaker-margin",
  },
  {
    slug: "nba",
    title: "NBA basketball",
    description:
      "Read NBA moneyline research rules, overtime matching, commencement timestamps and the limits of market-reference estimates.",
    status: "RESEARCH ONLY",
    market: "Two-outcome moneyline including overtime",
    sections: [
      [
        "Match the overtime rule",
        "The initial NBA research market uses a two-outcome moneyline including overtime. A regulation-only price is a different contract. Combining the two can create a misleading apparent discrepancy because their possible payoff states differ. Both reference sources and the offered quote must describe the same settlement rules.",
      ],
      [
        "Timing changes the information set",
        "Each research decision uses only snapshots available at its fixed pre-start window. A later team update or a closing price cannot improve an earlier decision retrospectively. The source time and ingestion time are both retained; a recent download does not make an old bookmaker quote fresh.",
      ],
      [
        "A reference estimate is still uncertain",
        "Independent bookmaker references can disagree or share an error. Equal weighting after complete-market margin removal is a research baseline, not a validated probability model. Estimated EV, subsequent quote availability, calibration and realised results need separate evaluation before any live launch.",
      ],
    ],
    related: "closing-line-value",
  },
  {
    slug: "nfl",
    title: "NFL research scope",
    description:
      "Why NFL moneylines remain unsupported in Docked’s initial strategy until draw, tie and void payoff rules are explicitly modelled.",
    status: "NOT SUPPORTED",
    market: "No approved NFL pricing or publication adapter",
    sections: [
      [
        "Two labels do not guarantee two payoff states",
        "A market labelled moneyline can have rules for a tied event that change a winning or losing payoff into a returned stake. The initial binary win/loss pricing adapter must not infer those rules from a market name. Unsupported payoff states are a reason to reject the market, even if its numbers appear attractive.",
      ],
      [
        "What an NFL adapter would need",
        "An approved extension would record the competition and period, overtime treatment, tie and void rules, a complete set of reference outcomes and an authorised results mapping. It would calculate expected value across every payoff state and include regression tests for tie, cancellation, correction and manual review.",
      ],
      [
        "A new scope means a new evaluation",
        "Adding NFL coverage changes the strategy’s eligible universe. It requires a new documented version and fresh historical and forward validation. Docked does not publish NFL selections or present an NFL performance record in this preview. Educational reading remains available without taking any betting action.",
      ],
    ],
    related: "backtest-paper-live",
  },
] as const;
export const leagues = [
  {
    slug: "nba",
    sport: "nba",
    title: "NBA market research",
    description:
      "NBA moneyline market definitions, evidence requirements and the current research-only status of Docked coverage.",
  },
] as const;
