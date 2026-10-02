import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeading, Empty, Notice, Metric } from "@/components/ui";
import { ApiForm, Check, Field } from "@/components/forms";
import { articles } from "@/content/articles";
import { serviceStatus, regionAccess, publicTips } from "@/server/queries";
import { boardState } from "@/core/policy";
import { ledger, type LedgerRow } from "@/core/ledger";
import { config } from "@/server/config";
import { LedgerChart } from "@/components/ledger-chart";
const titles: Record<string, string> = {
  edges: "The opportunity board",
  results: "The complete record",
  research: "Evidence before publication",
  methodology: "A method you can question",
  learn: "The reading room",
  about: "Independent thinking. Accountable records.",
  contact: "Talk to Docked",
  terms: "Terms of use",
  privacy: "Your information, your choices",
  "safer-gambling": "Your wellbeing comes first",
  "legacy-support": "Legacy product support",
  join: "A clearer view of the price",
  login: "Welcome back",
  recover: "Recover your account",
  "reset-password": "Choose a new password",
  "data-status": "Know what is running",
  unsubscribe: "Pause optional communications",
  mfa: "Protect privileged access",
};
export const dynamic = "force-dynamic";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  return {
    title: titles[section] ?? "Not found",
    alternates: { canonical: `/${section}` },
    ...([
      "join",
      "login",
      "recover",
      "reset-password",
      "mfa",
      "unsubscribe",
    ].includes(section)
      ? { robots: { index: false, follow: false } }
      : {}),
  };
}
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ section: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { section } = await params;
  const query = await searchParams;
  if (!titles[section]) notFound();
  let content: React.ReactNode;
  let eyebrow = "DOCKED / " + section.replaceAll("-", " ").toUpperCase();
  if (section === "edges") {
    const [region, status, tips] = await Promise.all([
      regionAccess(),
      serviceStatus(),
      publicTips(),
    ]);
    const state = boardState({ ...status, region: region.allowed });
    content = (
      <>
        <p className="lede">
          One selection per event. Fixed decision windows. No daily quota.
        </p>
        <div className="filters">
          <label>
            Coverage
            <select defaultValue="all">
              <option value="all">All approved coverage</option>
              <option disabled>Football · research only</option>
              <option disabled>NBA · research only</option>
              <option disabled>NFL · unsupported tie rules</option>
            </select>
          </label>
        </div>
        {tips.length ? (
          <div className="grid two">
            {tips.map((t) => (
              <Link className="card" key={t.id} href={`/tips/${t.id}`}>
                <span className="pill">{t.availability}</span>
                <h2>{t.selection}</h2>
                <p>
                  {t.odds} publication odds · estimated EV{" "}
                  {(Number(t.estimated_ev) * 100).toFixed(1)}%
                </p>
              </Link>
            ))}
          </div>
        ) : (
          <Empty title={state.title}>{state.detail}</Empty>
        )}
        <Notice>
          Prices and regional availability require fresh checks. A watchlist
          target is not an approved tip. Feed presence does not establish
          individual access or stake limits.
        </Notice>
      </>
    );
  } else if (section === "results") {
    const tips = await publicTips();
    let rows: LedgerRow[] = tips.map((t) => ({
      id: t.id,
      eventId: t.event_id,
      publishedAt: t.published_at.toISOString(),
      settledAt: t.settled_at?.toISOString(),
      odds: t.odds,
      stake: "1",
      evidence: "live_published",
      result: t.result,
      sport: t.competition_id,
      strategy: t.strategy_id,
      ev: t.estimated_ev,
      clv: t.clv ?? undefined,
      availability: t.availability,
    }));
    rows = rows.filter(
      (r) =>
        (!query.from || r.publishedAt.slice(0, 10) >= query.from) &&
        (!query.to || r.publishedAt.slice(0, 10) <= query.to) &&
        (!query.sport || r.sport === query.sport) &&
        (!query.strategy || r.strategy === query.strategy),
    );
    const stats = ledger(rows, "live_published");
    const measured = tips.filter(
      (t) => rows.some((r) => r.id === t.id) && t.delayed,
    );
    const delayedRows = rows
      .filter((r) =>
        measured.some((t) => t.id === r.id && t.delayed?.qualifies),
      )
      .map((r) => ({
        ...r,
        odds: String(measured.find((t) => t.id === r.id)!.delayed!.odds),
      }));
    const delayedStats = ledger(delayedRows, "live_published");
    content = (
      <>
        <p className="lede">
          Live record starts when publishing launches. Every actual publication
          will remain archived where legally permitted, including losses and
          withdrawals.
        </p>
        <span className="pill">LIVE PUBLISHED · FIXED ONE-UNIT BENCHMARK</span>
        <form className="filters">
          <label>
            From
            <input type="date" name="from" defaultValue={query.from} />
          </label>
          <label>
            To
            <input type="date" name="to" defaultValue={query.to} />
          </label>
          <label>
            Sport
            <select name="sport" defaultValue={query.sport ?? ""}>
              <option value="">All sports</option>
              {[...new Set(tips.map((t) => t.competition_id))].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label>
            Strategy
            <select name="strategy" defaultValue={query.strategy ?? ""}>
              <option value="">All strategies</option>
              {[...new Set(tips.map((t) => t.strategy_id))].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <button className="button">Apply filters</button>
          <Link href="/results" className="text-link">
            All time
          </Link>
        </form>
        <div className="metrics">
          <Metric
            label="Settled publications"
            value={String(stats.settled)}
            note="No retrospective additions"
          />
          <Metric
            label="Net units"
            value={stats.net ?? "N/A"}
            note="Fixed one-unit stakes"
          />
          <Metric
            label="Return on stakes"
            value={stats.roi === null ? "N/A" : `${stats.roi}%`}
            note="Settled non-void denominator"
          />
          <Metric
            label="Maximum drawdown"
            value={stats.drawdown ?? "N/A"}
            note="Peak to trough"
          />
        </div>
        <LedgerChart curve={stats.curve} />
        {Object.keys(stats.months).length > 0 && (
          <div className="table-wrap">
            <table>
              <caption>Monthly net units · losing months included</caption>
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Net units</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(stats.months).map(([month, units]) => (
                  <tr key={month}>
                    <td>{month}</td>
                    <td>{units}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="table-wrap">
          <table>
            <caption>Complete live publication ledger</caption>
            <thead>
              <tr>
                <th>Published</th>
                <th>Selection</th>
                <th>Odds</th>
                <th>Result</th>
                <th>Record</th>
              </tr>
            </thead>
            <tbody>
              {tips.length ? (
                tips
                  .filter((t) => rows.some((r) => r.id === t.id))
                  .map((t) => (
                    <tr key={t.id}>
                      <td>{t.published_at.toISOString().slice(0, 10)}</td>
                      <td>{t.selection}</td>
                      <td>{t.odds}</td>
                      <td>{t.result}</td>
                      <td>
                        <Link href={`/tips/${t.id}`}>View publication</Link>
                      </td>
                    </tr>
                  ))
              ) : (
                <tr>
                  <td colSpan={5}>
                    No live publications. No demonstration figures are included.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="metrics">
          <Metric label="Total turnover" value={`${stats.turnover} units`} />
          <Metric
            label="Pending / void stakes"
            value={`${stats.pendingStake} / ${stats.voidStake}`}
          />
          <Metric
            label="Wins / losses / voids"
            value={`${stats.won} / ${stats.lost} / ${stats.voids}`}
          />
          <Metric label="Average odds" value={stats.averageOdds ?? "N/A"} />
        </div>
        <p className="muted">
          Longest losing run: {stats.longestLosingRun ?? "N/A"} · Closing value:
          {stats.clv === null
            ? " N/A"
            : ` ${(Number(stats.clv) * 100).toFixed(2)}%`}{" "}
          · Five-minute availability:{" "}
          {measured.length
            ? `${measured.filter((t) => t.delayed?.qualifies).length}/${measured.length} measured quotes qualified`
            : "N/A"}{" "}
          · Delayed-price benchmark:{" "}
          {delayedStats.roi === null
            ? "N/A"
            : `${delayedStats.net} units / ${delayedStats.roi}% ROI`}
          . Missing measurements are never treated as zero.
        </p>
        <Notice>
          ROI = net units ÷ settled non-void staked units. Void stakes are
          returned. Pending and disputed entries are excluded until resolved.
          Live published means timestamped before the event; it does not mean
          independently audited execution. No sample currently supports a
          profitability claim.
        </Notice>
      </>
    );
  } else if (section === "learn")
    content = (
      <>
        <p className="lede">
          Understand pricing, uncertainty and what a record can actually tell
          you. All worked examples are fictional.
        </p>
        <div className="grid two">
          {articles.map((a) => (
            <Link
              className="article-card"
              href={`/learn/${a.slug}`}
              key={a.slug}
            >
              <span className="eyebrow">
                {a.category} / {a.minutes} MIN
              </span>
              <h2>{a.title}</h2>
              <p>{a.summary}</p>
              <span className="article-arrow">↗</span>
            </Link>
          ))}
        </div>
      </>
    );
  else if (section === "research")
    content = (
      <>
        <p className="lede">
          A finished interface is not a validated betting strategy. Research
          outcomes may be negative or inconclusive.
        </p>
        <Empty title="Historical validation pending">
          Licensed timestamped odds, authorised outcomes and reproducible
          reviews have not yet been supplied.
        </Empty>
        <div className="metrics">
          <Metric label="Historical research" value="Pending" />
          <Metric label="Forward paper" value="Not started" />
          <Metric label="Live published" value="Not launched" />
          <Metric label="Profitability" value="Unproven" />
        </div>
        <div className="prose">
          <h2>The proposed study</h2>
          <p>
            Subject to actual coverage and untouched data: 2022–2023
            development, 2024 validation, 2025 held-out evaluation and 2026
            year-to-date as a subsequent retrospective check. Calendar years
            alone do not make a holdout untouched. Outcome-informed model
            selection requires a contamination disclosure and a new evaluation.
          </p>
          <h2>What we will disclose</h2>
          <p>
            Dataset permissions and hashes, exact periods, code and strategy
            versions, exclusions, all eligible decisions, source coverage,
            immediate and delayed-entry benchmarks, calibration, drawdown and
            dependence-aware uncertainty. A five-minute archive does not create
            one-minute availability evidence.
          </p>
          <h2>Progress depends on evidence</h2>
          <p>
            Foundation and research → approved forward paper tracking → small
            free beta → validated expansion. These are review gates, not
            promises that an edge will be found on a particular date.
          </p>
          <Link className="text-link" href="/learn/backtest-paper-live">
            Understand the evidence categories ↗
          </Link>
        </div>
      </>
    );
  else if (section === "methodology")
    content = (
      <div className="prose">
        <p className="lede">
          Strategy V1 is a testable market-reference discrepancy method. Its
          defaults are hypotheses, not proven profitable settings.
        </p>
        <h2>1. Match the entire market</h2>
        <p>
          Match competition, event, participants, selection, period, line and
          settlement. Football 1X2 includes regulation time and stoppage time;
          NBA moneylines include overtime. Unsupported NFL ties, in-play,
          racing, props, parlays and exchanges remain disabled.
        </p>
        <h2>2. Remove margin independently</h2>
        <p>
          For each complete reference market, qᵢ = 1 / decimal oddsᵢ, then pᵢ =
          qᵢ / Σq. Require two independently operated approved references,
          excluding the offered bookmaker and related trading skins. Normalise
          each vector first, then equally weight the independent vectors. Equal
          weighting is an unvalidated baseline.
        </p>
        <h2>3. Evaluate a price</h2>
        <p>
          For a supported win/loss selection, estimated EV = p × O − 1;
          reference fair odds = 1 / p; minimum price = (1 + required EV) / p,
          rounded upward to the supported tick. Other payoff states require
          their own payoff calculation and adapter.
        </p>
        <h2>4. Apply frozen checks</h2>
        <p>
          Research defaults: estimated EV at least 3%, odds 1.50–5.00, maximum
          apparent EV 20% before data-error review, source age at most 180
          seconds, source skew at most 90 seconds, probability disagreement at
          most 8 percentage points. Decision windows start at T−6 hours and T−1
          hour, with a two-minute late tolerance. Missed windows are skipped.
        </p>
        <h2>5. Keep one benchmark per event</h2>
        <p>
          Order qualified candidates by estimated EV descending, then selection
          and bookmaker identifiers ascending. Publish at most one benchmark
          selection per event per strategy. Analyst approval cannot bypass
          freshness, eligibility or strategy gates. Publication and notification
          each recheck the evidence.
        </p>
        <h2>6. Preserve history</h2>
        <p>
          Original figures are immutable. Availability, settlement and
          corrections are separate append-only events. Fixed one-unit results
          include losses. Backtest, forward paper, live published and demo
          categories remain separate.
        </p>
        <Notice>
          These reference probabilities can be wrong. A quoted price may not be
          obtainable. No confidence stars, guaranteed edges or personalised
          staking instructions are provided.
        </Notice>
      </div>
    );
  else if (section === "data-status") {
    const s = await serviceStatus();
    content = (
      <>
        <p className="lede">
          These states describe service readiness, not the presence or absence
          of value in a market.
        </p>
        <div className="status-table">
          {[
            ["Odds feed", s.feed ? "Fresh" : "Not connected / unavailable"],
            ["Authorised results", "Pending source and settlement review"],
            ["Historical validation", s.strategy ? "Approved" : "Pending"],
            ["Public publication", s.publication ? "Enabled" : "Paused"],
            [
              "Outbound alerts",
              config().sending
                ? "Configured — worker health must be checked"
                : "Off",
            ],
            [
              "Country/state policies",
              "No public jurisdictions activated by default",
            ],
            ["Public launch date", "Not recorded"],
            ["Source timestamps", "N/A until ingestion succeeds"],
          ].map(([a, b]) => (
            <div key={a}>
              <strong>{a}</strong>
              <span>{b}</span>
            </div>
          ))}
        </div>
        <Notice>
          {s.reason} A provider outage blocks new tips. Archived records remain
          separate from current feed health.
        </Notice>
        <p>
          Update frequency will be stated when polling is configured.
          Five-minute polling will not be described as real-time.
        </p>
      </>
    );
  } else if (["join", "login", "recover", "reset-password"].includes(section)) {
    const action =
      section === "join"
        ? "signup"
        : section === "recover"
          ? "recover"
          : section === "reset-password"
            ? "reset"
            : "login";
    content = (
      <div className="split-page">
        <div>
          <p className="lede">
            {section === "join"
              ? "Save your reading, personalise your view and choose your own communication preferences."
              : "Use your verified Docked account."}
          </p>
          {section === "join" && (
            <>
              <Notice>
                Registration is pending service and legal configuration. This
                preview does not collect registrations.
              </Notice>
              <h2>Free means free.</h2>
              <p>
                All core features are free for 12 months after the audited
                public launch date. No card, hidden trial or automatic month-13
                conversion. A future paid option needs a separate decision and
                fresh opt-in.
              </p>
              <p>
                Unknown or unapproved regions receive educational content. Age
                self-attestation does not verify identity or legal eligibility.
              </p>
            </>
          )}
        </div>
        <div className="form-panel">
          <ApiForm
            endpoint="/api/auth"
            action={action}
            submit={
              action === "signup"
                ? "Create free account"
                : action === "recover"
                  ? "Send recovery instructions"
                  : action === "reset"
                    ? "Update password"
                    : "Log in"
            }
            disabled={
              !config().auth || (action === "signup" && !config().registration)
            }
          >
            {action !== "reset" && (
              <Field label="Email address" name="email" type="email" required />
            )}
            {action !== "recover" && (
              <Field
                label="Password · at least 12 characters"
                name="password"
                type="password"
                required
              />
            )}
            {action === "signup" && (
              <>
                <label>
                  Country
                  <select name="country" required defaultValue="">
                    <option value="" disabled>
                      Select country
                    </option>
                    <option value="AU">Australia</option>
                    <option value="NZ">New Zealand</option>
                    <option value="GB">United Kingdom</option>
                    <option value="US">United States</option>
                    <option value="CA">Canada</option>
                  </select>
                </label>
                <Field
                  label="State / region"
                  name="state"
                  required
                  placeholder="For example, VIC"
                />
                <Check name="age" required>
                  I meet the applicable legal age in my country/state and am at
                  least 18.
                </Check>
                <Check name="terms" required>
                  I accept the <Link href="/terms">Terms</Link> and acknowledge
                  the <Link href="/privacy">Privacy notice</Link>.
                </Check>
                <Check name="digest">Send me the optional weekly digest.</Check>
                <Check name="education">
                  Send optional educational emails.
                </Check>
                <Check name="edgeAlerts">
                  Send optional qualifying edge alerts when eligible. Maximum
                  two per local day; quiet hours apply.
                </Check>
              </>
            )}
          </ApiForm>
          <div className="inline-links">
            <Link href="/login">Log in</Link>
            <Link href="/recover">Forgot password?</Link>
            <Link href="/join">Join free</Link>
          </div>
          {!config().auth && (
            <p className="small-note">Account service pending configuration.</p>
          )}
        </div>
      </div>
    );
  } else if (section === "mfa")
    content = (
      <>
        <Notice>
          Sign in first. MFA enrolment and verification are required before
          privileged operations.
        </Notice>
        <ApiForm
          endpoint="/api/auth"
          action="mfa_enroll"
          submit="Set up authenticator"
        >
          <p>Add the returned secret to your authenticator. Keep it private.</p>
        </ApiForm>
        <ApiForm endpoint="/api/auth" action="mfa_verify" submit="Verify MFA">
          <Field label="Factor ID" name="factorId" required />
          <Field label="Six-digit code" name="code" required />
        </ApiForm>
      </>
    );
  else if (section === "unsubscribe")
    content = (
      <ApiForm
        endpoint={`/api/unsubscribe?token=${encodeURIComponent(query.token ?? "")}`}
        action="unsubscribe"
        submit="Pause all optional messages"
      >
        <p>
          No login is required. Necessary account notices are separate from
          optional communications. Pausing Docked is not enrolment in an
          external self-exclusion register.
        </p>
      </ApiForm>
    );
  else if (section === "legacy-support")
    content = (
      <div className="prose">
        <p className="lede">
          The former pool-float storefront is being retired in this replacement.
          Existing order, warranty and consumer support obligations remain
          separate from Docked’s research service.
        </p>
        <h2>Existing product or order enquiries</h2>
        <p>
          The previous storefront listed{" "}
          <a href="mailto:support@docked.com.au">support@docked.com.au</a> for
          customer support and Ginty United Investments Pty Ltd, ABN 78 606 187
          106, as the seller. These details are retained from the previous site;
          current mailbox operation has not been reverified during this build.
        </p>
        <p>
          Include your order reference and a description of the issue. Never
          send card details or passwords. Keep the product manual and your
          original order terms. Product support, historical orders and
          accounting records are not deleted by this website replacement.
        </p>
        <h2>No mailing-list transfer</h2>
        <p>
          Former product customers are not enrolled in betting communications.
          Relevant new consent is required, and we will not email the former
          list just to solicit that consent.
        </p>
      </div>
    );
  else if (section === "safer-gambling")
    content = (
      <div className="prose">
        <p className="lede">
          You can use Docked without placing a bet. Gambling should never be
          treated as income or a way to recover losses.
        </p>
        <h2>Make room to stop</h2>
        <p>
          Pause optional messages in your account or use the unsubscribe link.
          There are no betting streaks, loss-triggered reactivation messages or
          rewards for activity. If gambling is affecting your money,
          relationships or wellbeing, stop and seek support.
        </p>
        <h2>Australian support</h2>
        <p>
          <a href="https://www.gamblinghelponline.org.au/">
            Gambling Help Online
          </a>{" "}
          provides support and information. The national helpline is{" "}
          <a href="tel:1800858858">1800 858 858</a>.{" "}
          <a href="https://www.betstop.gov.au/">
            BetStop — the National Self-Exclusion Register
          </a>{" "}
          supports exclusion from Australian licensed online and phone wagering
          providers.
        </p>
        <p>
          A Docked pause is not BetStop registration. Docked does not claim
          access to any self-exclusion register. Outside Australia, seek an
          official local gambling support service; region-specific resources
          require review before local activation.
        </p>
        <h2>Prices are not promises</h2>
        <p>
          Estimates can be wrong and losing runs can be severe. Do not chase a
          missed price, borrow to gamble, bypass restrictions or use someone
          else’s account. Our research does not give personalised instructions
          to risk money.
        </p>
      </div>
    );
  else if (section === "contact")
    content = (
      <div className="prose">
        <p className="lede">
          Questions about methodology, accessibility or a record correction are
          welcome.
        </p>
        <Notice>
          The operating entity, support ownership and response process for the
          new research service require verification before public launch. No
          working contact submission is claimed in this preview.
        </Notice>
        <p>
          For a former product order, use{" "}
          <Link href="/legacy-support">Legacy product support</Link>. Do not
          include payment details, identity documents or sportsbook credentials
          in an enquiry.
        </p>
      </div>
    );
  else if (section === "about")
    content = (
      <div className="prose">
        <p className="lede">
          Docked is being built to make sports-pricing research easier to
          inspect.
        </p>
        <h2>Transparency over volume</h2>
        <p>
          We publish only when a declared method and its safety checks are met.
          Every actual publication belongs in the record, including losses. No
          daily quota, invented testimonials or fabricated member counts.
        </p>
        <h2>Worldwide ambition, local responsibility</h2>
        <p>
          Architecture can support multiple sports and regions. Activation
          requires data rights, supported settlement, research review and
          effective-dated legal policies. Planned coverage is not live coverage.
        </p>
        <h2>A useful free service</h2>
        <p>
          Education and permitted results remain accessible without signup.
          Accounts add personalisation and opt-in communications. There is no
          wagering, custody of money, sportsbook credential collection or
          automatic betting.
        </p>
        <Notice>
          Research validation is pending. Operator/support verification and
          launch approval are outstanding. No profitable history is claimed.
        </Notice>
      </div>
    );
  else
    content = (
      <div className="prose">
        <Notice>
          PRE-LAUNCH DRAFT · Requires verified entity/support details and legal
          review before registration or public release.
        </Notice>
        {section === "privacy" ? (
          <>
            <h2>Information used</h2>
            <p>
              Account email, country/state, age attestation, acceptance records
              and selected preferences support account access and eligibility.
              Optional personal tracking is self-reported and separate from the
              official ledger. No identity documents, sportsbook passwords or
              payment details are requested.
            </p>
            <h2>Your controls</h2>
            <p>
              Optional communications start off. You can change preferences,
              pause messages, export account data or request deletion in your
              dashboard. Minimal audit and consent evidence may need retention;
              exact legal bases and retention periods require review before
              launch.
            </p>
            <h2>Providers and safeguards</h2>
            <p>
              The planned service uses Supabase for authentication/database and
              a separately approved email provider. Preview and production are
              isolated. Provider feed payloads are private. Cross-border
              processing locations and subprocessors must be confirmed before
              collection begins.
            </p>
            <h2>Measurement</h2>
            <p>
              Optional attribution and engagement measurement must be separately
              consented. No optimisation of amounts wagered or customer losses.
              No transfer of the previous product mailing list.
            </p>
          </>
        ) : (
          <>
            <h2>Informational service</h2>
            <p>
              Docked provides estimated pricing analysis and educational
              information. It does not accept wagers or funds, place bets,
              operate wallets or guarantee outcomes. Availability is subject to
              approved country/state rules and supported data.
            </p>
            <h2>Free access</h2>
            <p>
              Core tips, results, methodology, standard tracking,
              personalisation and alerts are free for 12 months after the
              audited public launch. No card is required and no automatic
              conversion occurs. A future paid option requires a new decision
              and fresh customer opt-in, while retaining a useful free tier.
            </p>
            <h2>Records and corrections</h2>
            <p>
              Publication odds are historical observations, not a promise of
              executable prices. Corrections are appended with explanations.
              Expired tips remain in the benchmark ledger. No interface,
              backtest or estimated EV establishes future profitability.
            </p>
            <h2>Unresolved launch details</h2>
            <p>
              The responsible legal entity, jurisdiction-specific terms, support
              contact, dispute process, privacy obligations and data permissions
              must be verified before release. These draft terms do not override
              consumer rights or replace independent legal advice.
            </p>
          </>
        )}
      </div>
    );
  return (
    <div className="page">
      <PageHeading eyebrow={eyebrow} title={titles[section]} />
      {content}
    </div>
  );
}
