import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeading, Empty, Notice, Metric } from "@/components/ui";
import { ApiForm, Check, Field } from "@/components/forms";
import {
  serviceStatus,
  regionAccess,
  publicTips,
  monitoringContext,
} from "@/server/queries";
import { identity } from "@/server/auth";
import { EdgeCard } from "@/components/edge-card";
import { NoEdge } from "@/components/no-edge";
import { readingRoom } from "@/server/cms";
import { publicBoardState } from "@/core/public-presentation";
import { environmentPresentation } from "@/server/presentation";
import { currentConsentVersions } from "@/core/auth-readiness";
import { OperatorDetails } from "@/components/operator-details";
import { OfficialRecord } from "@/components/official-docked-record";
import { officialDockedRecord, modelMethodologyChanges } from "@/server/model-ledger";
import { LocalTimestamp } from "@/components/local-timestamp";
import { config } from "@/server/config";
import { SportImage } from "@/components/sport-image";
import { ArticleImage } from "@/components/article-image";
import { AppEdgeBoard } from "@/components/app-edge-board";
import { BrandLogo } from "@/components/brand-logo";
import { brand } from "@/brand/brand";
const titles: Record<string, string> = {
  edges: "The opportunity board",
  results: "DOCKED RECORD",
  research: "Research, with a forward record",
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
const descriptions: Record<string, string> = {
  edges:
    "Current eligible price observations, minimum odds, source freshness and complete publication records. Estimated EV is not guaranteed profit.",
  results:
    "Docked’s genuine forward publication record, including every loss, void and correction. We do not reconstruct historical tips.",
  research:
    "Independent sporting-model research, licensed inputs and separate forward paper tracking. The official Docked record starts with genuine publication.",
  methodology:
    "How independent sporting-model probabilities become fair prices and are compared with market prices, with versioned methods and immutable records.",
  learn:
    "Practical educational resources on decimal odds, bookmaker margin, estimated value, uncertainty and transparent results.",
  about:
    "Docked’s purpose, evidence standards and commitment to transparent sports-pricing research.",
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
    description:
      descriptions[section] ??
      `${titles[section] ?? "Docked"}. Information and controls for Docked sports-pricing research.`,
    alternates: { canonical: `/${section}` },
    openGraph: {
      title: titles[section],
      description: descriptions[section],
      url: `/${section}`,
      images: ["/opengraph-image"],
    },
    twitter: {
      card: "summary_large_image",
      title: titles[section],
      description: descriptions[section],
      images: ["/opengraph-image"],
    },
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
  const eyebrow = "DOCKED / " + section.replaceAll("-", " ").toUpperCase();
  if (section === "edges") {
    const appMember =
      config().database && config().auth ? await identity() : null;
    if (appMember)
      return (
        <AppEdgeBoard
          query={query}
          timezone={appMember.profile.timezone}
          format={appMember.profile.odds_format}
        />
      );
    const [region, status, tips, monitoring, viewer, catalogue] =
      await Promise.all([
        regionAccess(),
        serviceStatus(),
        publicTips(),
        monitoringContext(),
        identity(),
        readingRoom(),
      ]);
    const state = publicBoardState(
      { ...status, region: region.allowed },
      !!viewer,
    );
    const activeTips = tips.filter((t) => t.display_status === "active");
    content = (
      <>
        <p className="lede">
          One selection per event. Fixed decision windows. No daily quota.
        </p>
        <div className="inline-links">
          <Link href="/sports">Coverage and market rules</Link>
          <Link href="/results">Completed publications</Link>
          <Link href="/data-status">Feed health</Link>
        </div>
        {activeTips.length ? (
          <div className="grid two">
            {activeTips.map((t) => (
              <EdgeCard
                key={t.id}
                tip={t}
                timezone={viewer?.profile.timezone}
                format={viewer?.profile.odds_format}
              />
            ))}
          </div>
        ) : (
          <NoEdge
            state={state}
            monitoring={monitoring}
            timezone={viewer?.profile.timezone}
            latest={catalogue[0]}
            completed={tips.filter((t) =>
              ["won", "lost", "void"].includes(t.result),
            )}
          />
        )}
        <Notice>
          Prices and regional availability require fresh checks. A watchlist
          target is not an approved tip. Feed presence does not establish
          individual access or stake limits.
        </Notice>
      </>
    );
  } else if (section === "results") {
    content = <OfficialRecord record={await officialDockedRecord()} filters={{ from: query.from, to: query.to, sport: query.sport, strategy: query.strategy }} />;
  } else if (section === "learn") {
    const catalogue = await readingRoom();
    content = (
      <>
        <p className="lede">
          Understand pricing, uncertainty and what a record can actually tell
          you. All worked examples are fictional.
        </p>
        <div className="grid two">
          {catalogue.map((a) => (
            <Link
              className="article-card reading-photo-card"
              href={`/learn/${a.slug}`}
              key={a.slug}
            >
              <ArticleImage
                slug={a.slug}
                className="reading-card-image"
                sizes="(max-width: 650px) 90vw, (max-width: 1280px) 43vw, 560px"
              />
              <div className="reading-card-body">
                <span className="eyebrow">
                  {a.category} / {a.minutes} MIN
                </span>
                <h2>{a.title}</h2>
                <p>{a.summary}</p>
                <small>
                  {a.published ? "Published editorial" : "Educational draft"} ·{" "}
                  {a.author}
                </small>
                <span className="article-arrow" aria-hidden="true">
                  ↗
                </span>
              </div>
            </Link>
          ))}
        </div>
        {!catalogue.length && (
          <Empty title="Reading room temporarily unavailable">
            Editorial state could not be verified. Please try again later.
          </Empty>
        )}
      </>
    );
  } else if (section === "research")
    content = (
      <>
        <p className="lede">
          Sporting research informs probability estimates. The official Docked
          record starts with genuine forward publication, not reconstructed
          historical selections. Research outcomes may be negative or
          inconclusive.
        </p>
        <Empty title="Model research, without a manufactured record">
          A model needs authorised sporting inputs, reproducible evaluation and
          honest uncertainty. Missing inputs remain unavailable. No historical
          Docked tips or return figures are created to launch the service.
        </Empty>
        <div className="metrics">
          <Metric label="Sporting-model research" value="Separate" />
          <Metric label="Forward paper" value="Separate" />
          <Metric label="Official record" value="Forward only" />
          <Metric label="Profitability" value="Unproven" />
        </div>
        <div className="prose">
          <h2>Historical sporting data can inform a model</h2>
          <p>
            Licensed match statistics and sporting outcomes can support model
            development and held-out probability evaluation. Only information
            available at the decision time may be used. Calibration, Brier score
            and log loss assess predictions; none guarantees profitable prices.
            The Odds API supplies a separate market comparison, not the sporting
            model’s probability estimate.
          </p>
          <h2>Preserved optional replay research</h2>
          <p>
            The existing historical-odds research tools remain available for an
            explicitly labelled study, separate from the official record. The
            proposed windows, subject to actual coverage and untouched data, are
            2022–2023 development, 2024 validation, 2025 held-out evaluation and
            2026 year-to-date as a subsequent retrospective check. Calendar
            years alone do not make a holdout untouched. Outcome-informed model
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
          <h2>What launch does and does not establish</h2>
          <p>
            A closed beta can test the product without claiming validated
            profitability or a historical betting return. Legal eligibility,
            account security, data rights and publication controls still apply.
            Research and paper records cannot be promoted into the official
            record. Every genuine published Edge, including losses, remains
            accountable from its original publication time.
          </p>
          <Link className="text-link" href="/learn/backtest-paper-live">
            Understand the evidence categories ↗
          </Link>
        </div>
      </>
    );
  else if (section === "methodology") {
    const changes = await modelMethodologyChanges();
    content = (
      <div className="prose">
        <p className="lede">
          An independent sporting model estimates probability. Docked converts
          that estimate into a fair price, then compares it with a separate
          current market price. These are different inputs. An estimated edge is
          not evidence of guaranteed profit.
        </p>
        <h2>Sporting model → probability → fair price</h2>
        <p>
          The official model interface requires authorised sporting inputs,
          versioned model evidence and a probability for the exact selection and
          settlement rules. Historical sporting statistics may be model inputs;
          later outcomes cannot leak into an earlier prediction. If licensed
          inputs or a supported model are missing, probability, Docked Fair and
          TAKE remain unavailable. Market odds are never silently substituted
          for an independent sporting estimate.
        </p>
        <p>
          The Odds API is a market-comparison source. A reviewed
          market-reference configuration uses a conservative lower median of
          eligible independent standard prices, never the highest quote. A
          personal boost or screenshot cannot set that benchmark. Rights,
          matching, classification, source age and required coverage are checked
          separately from model readiness.
        </p>
        <dl className="edge-facts">
          <div>
            <dt>TAKE X+</dt>
            <dd>
              (1 + required estimated edge) / model probability, rounded upward
              to the supported price tick. It is the minimum comparison price.
            </dd>
          </div>
          <div>
            <dt>CURRENT MARKET</dt>
            <dd>
              The latest eligible availability benchmark; it can move or become
              unavailable.
            </dd>
          </div>
          <div>
            <dt>Docked fair price</dt>
            <dd>
              1 / independent model probability. This is an estimate, with no
              promise of profit.
            </dd>
          </div>
          <div>
            <dt>Submission / publication reference</dt>
            <dd>
              The immutable benchmark used to grade that record. Later prices do
              not rewrite it.
            </dd>
          </div>
        </dl>
        <p>
          Estimated edge for a supported win/loss market is probability × market
          price − 1. Other payoffs need their own adapter. An available market
          feed does not establish a working or validated model. Model versions,
          input timestamps and publication rules remain reviewable; live
          publication still requires explicit authorisation. Members may add a
          personal bookmaker or price as labelled social context, which never
          changes competitive settlement, ROI or ranking.
        </p>
        <h2>Original Strategy V1 research specification</h2>
        <p>
          The following numbered rules describe the preserved legacy research
          bookmaker-comparison engine. Its reference exclusion and thresholds
          have not been silently changed to fit the new model. Existing records
          retain their original methodology labels and locked evidence; adopting
          material new rules requires a new strategy version and a documented
          evaluation. This market-derived research comparator is not the
          independent sporting model used to label a future official Docked Fair
          estimate, and it cannot create historical official tips.
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
        <section aria-labelledby="model-changelog">
          <h2 id="model-changelog">Model methodology changes</h2>
          <p>Versions and effective times below come from recorded model lifecycle changes. A draft or research transition is not live approval or evidence of profitability. Material changes require a new version; previous publication evidence remains locked.</p>
          {changes.length ? <div className="table-wrap" role="region" aria-label="Recorded model methodology changes" tabIndex={0}><table><thead><tr><th>Model version</th><th>Recorded effective time</th><th>Change</th></tr></thead><tbody>{changes.map(change => <tr key={`${change.modelVersion}-${change.effectiveAt}`}><td>{change.modelVersion}</td><td><LocalTimestamp value={change.effectiveAt} /></td><td>{change.reason}</td></tr>)}</tbody></table></div> : <p>No public model change records are available. No introduction date or approval is inferred.</p>}
        </section>
      </div>
    );
  } else if (section === "data-status") {
    const s = await serviceStatus();
    content = (
      <>
        <p className="lede">
          These states describe service readiness, not the presence or absence
          of value in a market.
        </p>
        <div className="status-table">
          {[
            [
              "Odds provider configuration",
              `ODDS_PROVIDER_STATUS=${s.oddsProviderStatus}`,
            ],
            [
              "Results provider configuration",
              `RESULTS_PROVIDER_STATUS=${s.resultsProviderStatus}`,
            ],
            ["Odds feed", s.feed ? "Fresh" : "Not connected / unavailable"],
            ["Authorised results", "Pending source and settlement review"],
            ["Official strategy approval", s.strategy ? "Approved" : "Pending"],
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
    const environment = await environmentPresentation();
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
          <div className="auth-brand">
            <BrandLogo variant="mark" />
            <p className="brand-tagline">{brand.tagline}</p>
          </div>
          <p className="lede">
            {section === "join"
              ? "Save your reading, personalise your view and choose your own communication preferences."
              : "Use your verified Docked account."}
          </p>
          {section === "join" && (
            <>
              <Notice>
                {environment.registrationAvailable
                  ? "Registration is open. Required account notices are separate from optional communications."
                  : (environment.reason ??
                    "Public registration is not open yet.")}
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
              !environment.accountConfigured ||
              (action === "signup" && !environment.registrationAvailable) ||
              (action === "recover" &&
                environment.production &&
                !environment.emailAvailable)
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
                  I accept the <Link href="/terms">Terms</Link>.
                </Check>
                <Check name="privacy" required>
                  I accept the <Link href="/privacy">Privacy notice</Link>.
                </Check>
                <Check name="digest">Send me the optional weekly digest.</Check>
                <Check name="education">
                  Send optional educational emails.
                </Check>
                <Check name="edgeAlerts">
                  Send optional qualifying edge alerts when eligible. Maximum
                  two per local day; quiet hours apply.
                </Check>
                <Check name="analytics">
                  Allow optional usage analytics to improve Docked. No
                  sportsbook passwords, wagering amounts or personal losses are
                  collected.
                </Check>
              </>
            )}
          </ApiForm>
          <div className="inline-links">
            <Link href="/login">Log in</Link>
            <Link href="/recover">Forgot password?</Link>
            <Link href="/join">Join free</Link>
          </div>
          {!environment.accountConfigured && (
            <p className="small-note">Account service pending configuration.</p>
          )}
          {action === "recover" &&
            environment.production &&
            !environment.emailAvailable && (
              <p role="status">
                Account email is not enabled. No recovery message will be sent.
              </p>
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
        <OperatorDetails />
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
          Docked makes sports-pricing research easier to inspect.
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
          Research validation is pending. No profitable history is claimed.
        </Notice>
        <OperatorDetails />
      </div>
    );
  else {
    let policyVersion: string | null = null;
    try {
      const versions = currentConsentVersions();
      policyVersion = section === "privacy" ? versions.privacy : versions.terms;
    } catch {
      /* Unapproved documents remain visibly pending. */
    }
    content = (
      <div className="prose">
        <Notice>
          {config().production
            ? policyVersion
              ? `Document version: ${policyVersion}.`
              : "POLICY APPROVAL PENDING · Public registration remains closed until the operator approves the Terms and Privacy documents."
            : "PREVIEW PRIVACY / TERMS DRAFT · Invited testing is active. Verified entity/support details, retention periods and legal review remain required before public registration or Play submission."}
        </Notice>
        <OperatorDetails />
        {section === "privacy" ? (
          <>
            <h2>Information used</h2>
            <p>
              When account services are enabled, Docked collects account email
              and identifiers, username, country/state, age attestation, access
              records, consent versions and selected preferences. Passwords are
              submitted securely to the authentication service. Age is
              self-attested. No identity documents, sportsbook passwords,
              payment details or precise GPS location are requested.
            </p>
            <p>
              Community features store your profile, posts, comments, optional
              photos, follows, reactions, saves, blocks, mutes, reports and
              in-app notification settings/activity. Approved profile and social
              content can be visible to other eligible members under the
              visibility and blocking rules. Saves, reports and private
              preferences are not public. Uploaded images enter private
              moderation review; selecting a photo does not itself upload it.
            </p>
            {!config().production && (
              <p>
                Confirmed DEMO / PREVIEW PRICE records retain their synthetic
                selection, captured reference and timestamps in separate
                immutable tables. They never count toward genuine performance,
                rankings or official results. Optional personal tracking is
                self-reported and separate from the official ledger.
              </p>
            )}
            <h2>Your controls</h2>
            <p>
              Marketing consent is separate, optional and unticked. Onboarding
              lets you choose in-app updates. Optional outbound messages and
              Android push are not enabled. Necessary verification and recovery
              email is separate and requires configured delivery. You can change
              preferences, pause messages, export account data or request
              deletion in your dashboard. Account access and sessions are
              revoked first; identity erasure is retried if the authentication
              service is unavailable. Personal social content and relationships
              are removed or pseudonymised.
            </p>
            <p>
              Necessary audit, consent and permanent-record evidence may survive
              under a pseudonymous identifier. This does not mean every mention
              of you in another member's content is automatically erased. Exact
              lawful bases, retention periods and any legal-hold process remain
              under owner review. Read the{" "}
              <Link href="/account-deletion">
                account deletion instructions
              </Link>{" "}
              for access and support limitations.
            </p>
            <h2>Providers and safeguards</h2>
            <p>
              Docked uses Supabase for authentication and database storage and
              Vercel for the hosted HTTPS application. Service providers process
              data to operate those services; security, rate-limit and hosting
              records support abuse prevention and diagnosis. Test environments
              are isolated from production. No odds/results provider is enabled.
              The owner must confirm the final processor terms, processing
              locations, subprocessors, retention schedule and monitored privacy
              contact before public registration or Play submission.
            </p>
            <h2>Measurement</h2>
            <p>
              First-party attribution and engagement measurement requires
              separate analytics consent. Security and account operations are
              still recorded where needed to run the service. Labelled internal
              fixture activity is excluded from genuine acquisition metrics. No
              optimisation of amounts wagered or customer losses, and no
              transfer of the previous product mailing list, is part of this
              service.
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
  }
  return (
    <div className="page">
      {section === "edges" || section === "results" ? (
        <div className="sports-section-heading">
          <PageHeading eyebrow={eyebrow} title={titles[section]} />
          <SportImage
            sport={section === "edges" ? "football" : "basketball"}
            variant="header"
            className="sports-page-banner"
            sizes="(max-width: 650px) 90vw, (max-width: 1280px) 40vw, 480px"
            preload
          />
        </div>
      ) : (
        <PageHeading eyebrow={eyebrow} title={titles[section]} />
      )}
      {content}
    </div>
  );
}
