export type SportSlug =
  | "football"
  | "basketball"
  | "tennis"
  | "nfl"
  | "horse-racing"
  | "cricket"
  | "baseball"
  | "ice-hockey"
  | "motorsport"
  | "afl";
export type SportContent = {
  slug: SportSlug;
  title: string;
  kicker: string;
  description: string;
  market: string;
  sections: readonly (readonly [string, string])[];
  related: string;
  relatedTitle: string;
};
export const sports: readonly SportContent[] = [
  {
    slug: "football",
    title: "Football",
    kicker: "The world’s game. The complete picture.",
    description:
      "Three outcomes. One properly matched market. Explore the rules behind Docked’s regulation-time football research.",
    market: "Regulation-time 1X2: home, draw and away",
    sections: [
      [
        "Keep the draw in the picture",
        "A football 1X2 market contains three mutually exclusive outcomes. Docked requires a price for every outcome from each reference source before removing margin. Leaving out the draw and normalising home and away prices answers a different question. Draw-no-bet, double-chance and team-to-qualify markets have different payoff structures and are outside the installed strategy.",
      ],
      [
        "Ninety minutes is a market definition",
        "The implemented research scope is regulation time plus stoppage time. Extra time and penalty shootouts are excluded. A cup match’s qualification market cannot be matched to its regulation-time result market even when the team names agree. Competition, participants, commencement instant and settlement rules must all match before any price comparison is considered.",
      ],
      [
        "A fixture change changes the evidence",
        "A postponement or revised kick-off needs an authorised event update. The new time must not silently replace the timestamp behind an earlier decision. Abandonment and conflicting results stay pending until the applicable settlement rule is resolved. This preserves the distinction between a missing outcome and a losing one, and between a useful research estimate and an approved live publication.",
      ],
    ],
    related: "bookmaker-margin",
    relatedTitle: "What the margin hides in the odds",
  },
  {
    slug: "basketball",
    title: "Basketball",
    kicker: "Every possession matters. So do the rules.",
    description:
      "An arena full of possibilities. Docked’s installed basketball research is deliberately narrower: NBA moneyline, including overtime.",
    market: "NBA two-outcome moneyline including overtime",
    sections: [
      [
        "Include overtime consistently",
        "The installed NBA research market is a two-outcome moneyline including overtime. A regulation-only price describes a different contract. Mixing those two creates an apparent discrepancy without a valid comparison. Both references and the offered quote must carry the same complete settlement rules; a market label by itself is not enough.",
      ],
      [
        "Respect the information available at the time",
        "Research decisions use snapshots available at fixed pre-start windows. Later team news or a closing price cannot improve an earlier decision retrospectively. Source, snapshot and receipt times remain separate. Downloading an old quote now does not make it fresh, and changing the event time must trigger an explicit mapping review.",
      ],
      [
        "NBA scope is not all basketball",
        "The current competition configuration contains NBA research only. It does not extend to college basketball, international competitions, alternative periods, player markets or point spreads. Each extension would need its own matched contracts, licensed data and validation. Reference-based probabilities remain uncertain; calibration, losing runs and subsequent quote availability must be assessed alongside any calculated EV.",
      ],
    ],
    related: "closing-line-value",
    relatedTitle: "What closing line value can—and cannot—show",
  },
  {
    slug: "tennis",
    title: "Tennis",
    kicker: "A different surface. A different question.",
    description:
      "A guide to the match identity, retirement rules and timestamp evidence a future tennis research programme would need.",
    market: "No tennis pricing or publication market is configured",
    sections: [
      [
        "Retirement rules belong in the contract",
        "Two match-winner prices need not settle the same way when a player retires or a match does not finish. A future adapter would need the exact bookmaker settlement basis, including any play or completion requirement. Docked cannot infer that basis from two player names, and it cannot treat an unplayed match as an ordinary win or loss.",
      ],
      [
        "Identify the match, not just the players",
        "Canonical mapping would need tournament, round, singles or doubles format, competitors and scheduled start. Surface and format are useful context, but they do not replace an event identifier. Delays and revised starts need their own evidence. Research would preserve the snapshot known at the decision time rather than substitute a later price from a completed match.",
      ],
      [
        "What must exist before coverage",
        "Tennis is planned coverage, with no active pricing pipeline or Docked tennis selections. A future version needs licensed current and historical prices, authorised outcomes, complete reference markets, retirement and walkover tests, and a documented validation plan. Match, set and game markets would be evaluated separately. Attractive sporting imagery here is context, not evidence that those requirements have been met.",
      ],
    ],
    related: "losing-runs-and-variance",
    relatedTitle: "Losses are part of the evidence",
  },
  {
    slug: "nfl",
    title: "American football",
    kicker: "Big moments. Precisely defined markets.",
    description:
      "Explore why a future NFL model needs explicit period, overtime, tie and returned-stake treatment before any price can qualify.",
    market: "No NFL pricing or publication market is configured",
    sections: [
      [
        "Two team names can hide another payoff",
        "A market labelled moneyline may include a rule for a tied event that changes a would-be win or loss into a returned stake. An adapter must model that rule explicitly. The current binary win/loss engine cannot infer it from the market name. Regulation-only and overtime-inclusive prices must also remain separate contracts.",
      ],
      [
        "A spread is a different research problem",
        "Point spreads add a line to the market definition and can introduce a push at that line. Comparing nearby lines as if they were the same market would misstate the payoff. A future NFL extension would need exact line, period, overtime and void mapping, with complete reference outcomes and authorised sporting results for each accepted contract.",
      ],
      [
        "Planned does not mean active",
        "NFL coverage is coming soon in the product roadmap, with no launch date or validated NFL strategy implied. The installed competition list excludes NFL. Adding it changes the eligible universe and requires a documented strategy version, historical data-quality review and forward validation. There are no NFL tips or invented NFL performance records on this page.",
      ],
    ],
    related: "backtest-paper-live",
    relatedTitle: "Backtest, paper and live are different evidence",
  },
  {
    slug: "horse-racing",
    title: "Horse racing",
    kicker: "The full field comes first.",
    description:
      "Runner identity, withdrawals, deductions and settlement terms make racing a distinct data and modelling challenge.",
    market: "No racing win, place or each-way market is configured",
    sections: [
      [
        "Start with the declared field",
        "A racing market cannot be reconstructed from a few selected runners. Research would need a complete field at each decision time, stable runner and race identifiers, scheduled off time, and an authoritative record of withdrawals. A later final field must not be projected backwards onto an earlier set of prices. Missing runners are a data gap, not a zero probability.",
      ],
      [
        "Separate the settlement terms",
        "Win, place and each-way markets describe different payoffs. Place terms, dead-heat treatment, deductions and non-runner rules need explicit source evidence before an expected-value calculation is meaningful. Fixed-odds and exchange prices also carry different execution and cost considerations. The installed football and NBA engine does not support these contracts by analogy.",
      ],
      [
        "A dedicated programme, when the evidence exists",
        "Racing remains planned coverage. Before any research selections could be recorded, Docked would need licensed price histories, field-change timestamps, authorised results and a tested settlement adapter. Availability and stake limits would remain unknown unless measured. No runner, race, tip or performance series has been invented to fill this page.",
      ],
    ],
    related: "minimum-odds",
    relatedTitle: "The price is part of the recommendation",
  },
  {
    slug: "cricket",
    title: "Cricket",
    kicker: "One sport. Several distinct contracts.",
    description:
      "Match format, ties, draws, interruptions and result revisions all matter when defining a future cricket research market.",
    market: "No cricket match or innings market is configured",
    sections: [
      [
        "Record the format before the price",
        "A future cricket adapter would distinguish the competition and match format before mapping a result market. It would record whether the contract includes a draw, how a tie is treated and which official result governs settlement. A two-team quote cannot be assumed to have the same payoff as another bookmaker’s quote without that complete definition.",
      ],
      [
        "Interruptions require outcome evidence",
        "Weather, reduced play, revised targets and rescheduling can change what information is available and which settlement terms apply. Historical replay must preserve the event status and rules known at the decision time. It cannot infer an authorised result from an odds history, or silently treat an interrupted match as void because a score is missing.",
      ],
      [
        "Build the right evidence first",
        "Cricket is planned coverage and has no active Docked pricing pipeline. Match, innings and player markets would each need separate validation rather than one generic cricket switch. Required foundations include licensed data, complete reference outcomes, event and period mapping, authorised result revisions and tests for exceptional settlements. A future programme would retain rejected markets and losing selections alike.",
      ],
    ],
    related: "no-tip-is-correct",
    relatedTitle: "Sometimes the right number of tips is zero",
  },
  {
    slug: "baseball",
    title: "Baseball",
    kicker: "Read the game behind the number.",
    description:
      "Game identifiers, pitcher conditions, innings and suspended-game rules are prerequisites for reliable baseball price comparisons.",
    market: "No baseball moneyline, run-line or total is configured",
    sections: [
      [
        "Distinguish the game and the condition",
        "Team names and a date are not enough when schedules contain multiple games or change after postponement. A future adapter would retain a canonical event identifier and commencement time. It would also need to distinguish any listed-pitcher condition from a contract without that condition. Similar-looking prices are not interchangeable when settlement depends on different events.",
      ],
      [
        "Keep innings and completion rules explicit",
        "A full-game market and an early-innings market do not share the same result. Extra innings, called games, suspensions and resumption rules need documented treatment from the source contract and the authorised outcome feed. Research must keep an unresolved game pending rather than infer settlement from a partial score or from the disappearance of a bookmaker price.",
      ],
      [
        "The current scope remains narrower",
        "Baseball is planned coverage, not a configured extension of NBA moneyline research. Run lines, totals and pitcher-specific contracts would require their own payoff handling, source mapping and tests. Licensed histories and independent reference coverage would be reviewed before any study, followed by a frozen strategy and forward-paper evaluation. No baseball opportunities are generated in this preview.",
      ],
    ],
    related: "value-versus-winners",
    relatedTitle: "A good prediction is not always a good price",
  },
  {
    slug: "ice-hockey",
    title: "Ice hockey",
    kicker: "Fast on the ice. Exact in the record.",
    description:
      "Regulation, overtime and shootout treatment must be matched before a future hockey market can be compared.",
    market: "No ice-hockey result, puck-line or total is configured",
    sections: [
      [
        "Three outcomes or two?",
        "A regulation result market can include a draw, while another match-winner contract may resolve through overtime or a shootout. The actual source rules decide the payoff. Normalising a two-outcome quote against a three-outcome reference would answer the wrong question. Any future hockey adapter must require the complete, consistently defined market at every reference source.",
      ],
      [
        "Keep the scoring basis with the outcome",
        "Totals and puck-line markets introduce additional line and scoring definitions. The handling of a shootout, an interrupted game or an official correction cannot be guessed from a headline score. An authorised results feed and the bookmaker’s contract need to agree, with disputes and missing evidence left visible in the settlement record.",
      ],
      [
        "Coverage is still planned",
        "There is no active Docked hockey pipeline, configured competition or validated strategy. A future version would first establish licensed source coverage, stable event mapping and independent bookmaker references. Fixed decision windows and delayed-price observations would be declared before evaluation. Sporting context on this page does not imply current tips, a completed backtest or a forward-paper record.",
      ],
    ],
    related: "bookmaker-margin",
    relatedTitle: "What the margin hides in the odds",
  },
  {
    slug: "motorsport",
    title: "Motorsport",
    kicker: "Every classification needs a clear finish line.",
    description:
      "Race winners, qualifying, head-to-heads and official classification are separate contracts with different evidence requirements.",
    market:
      "No motorsport race, qualifying or head-to-head market is configured",
    sections: [
      [
        "Name the session and the contract",
        "A qualifying result, starting-grid position and race classification are different observations. A future research adapter would need the championship, event, session, competitor and exact market contract before comparing prices. A two-driver head-to-head also needs an explicit rule for retirement and classification; it cannot inherit the current basketball win/loss payoff simply because two names appear.",
      ],
      [
        "The first result may not be the final result",
        "Penalties, disqualifications and classification revisions need an authorised source and a clear settlement basis. A change must append a correction to the record, preserving what was known earlier. Historical replay cannot use a later classification or final grid to improve a pre-session selection. The time and revision of every result are part of the evidence.",
      ],
      [
        "A separate research route",
        "Motorsport is planned coverage with no configured publication market. Outright fields, qualifying markets and head-to-heads would need distinct validation, licensed histories and a complete treatment of missing starters or finishers. Docked has not created a motorsport backtest or promised a launch date. The useful starting point is a precise contract, not a confident prediction.",
      ],
    ],
    related: "backtest-paper-live",
    relatedTitle: "Backtest, paper and live are different evidence",
  },
  {
    slug: "afl",
    title: "Australian rules",
    kicker: "A local passion. The same evidence standard.",
    description:
      "A future Australian-rules programme needs competition-specific draw, extra-time, line and settlement rules.",
    market: "No AFL match-result, line or total market is configured",
    sections: [
      [
        "Confirm the draw and extra-time treatment",
        "The competition, stage and bookmaker contract determine how a drawn score or extra-time result should be treated. A future adapter would need those rules explicitly rather than assume every match-winner quote represents a binary win/loss payoff. Reference sources and the offered bookmaker must describe the same possible settlement states.",
      ],
      [
        "Lines need exact matching",
        "A handicap adds a number to the contract. Nearby lines cannot be combined into one reference market, and any push or returned-stake case needs its own payoff. Totals and player markets require further definitions. Official score corrections and disrupted fixtures would remain traceable; an unresolved outcome would not be guessed to complete a results table.",
      ],
      [
        "Australian context, planned coverage",
        "AFL is part of Docked’s planned sporting scope, but it is absent from the installed pricing configuration. Before it could become research coverage, a documented version would need licensed prices, authorised results, source independence evidence and a reviewed validation plan. Australian regional eligibility would remain a separate server-side requirement. No AFL tips or performance claims are implied by this page.",
      ],
    ],
    related: "estimated-ev-and-returns",
    relatedTitle: "Estimated EV is not realised profit",
  },
];
export const leagues = [
  {
    slug: "nba",
    sport: "basketball" as SportSlug,
    title: "NBA market research",
    description:
      "NBA moneyline definitions, overtime matching and the evidence required before research coverage can become live.",
  },
] as const;
