import Link from "next/link";
import { identity } from "@/server/auth";
import { config } from "@/server/config";
import { db } from "@/server/db";
import { PageHeading, Empty, Notice } from "@/components/ui";
import { ApiForm, Field, Check } from "@/components/forms";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Your dashboard",
  robots: { index: false, follow: false },
};
export default async function Dashboard() {
  const who = config().database && config().auth ? await identity() : null;
  if (!who)
    return (
      <div className="page">
        <PageHeading
          eyebrow="MEMBER AREA"
          title="Your research, at your pace."
        />
        <Empty title="Sign in to your verified account">
          Personalisation and saved tips are private. Account service must be
          configured before this preview can accept signups.
        </Empty>
        <div className="actions">
          <Link className="button" href="/login">
            Log in
          </Link>
          <Link className="button ghost" href="/learn">
            Read without an account
          </Link>
        </div>
      </div>
    );
  const sql = db();
  const [prefs, saved, personal, analyticsConsent] = await Promise.all([
    sql`select * from public.notification_preferences where user_id=${who.user.id}`,
    sql`select tip_id from public.saved_tips where user_id=${who.user.id}`,
    sql`select * from public.personal_entries where user_id=${who.user.id} order by created_at desc`,
    sql`select granted from private.consent_events where user_id=${who.user.id} and purpose='analytics' order by created_at desc limit 1`,
  ]);
  const p = prefs[0];
  return (
    <div className="page">
      <PageHeading eyebrow="YOUR DASHBOARD" title="Follow the evidence.">
        <p>
          Your saved tips and preferences. Personal tracking never changes
          Docked’s official record.
        </p>
      </PageHeading>
      <nav className="tab-nav" aria-label="Dashboard sections">
        <a href="#saved">Saved tips</a>
        <a href="#preferences">Preferences</a>
        <a href="#personal">Personal tracking</a>
        <Link href="/edges">Opportunity board</Link>
        <Link href="/api/member">Export account data</Link>
        <Link href="/mfa">MFA settings</Link>
      </nav>
      {!who.profile.onboarding_completed_at && (
        <Notice>
          Complete your preferences below to finish onboarding. Every optional
          communication and analytics choice is yours; leaving them off does not
          prevent reading or account use.
        </Notice>
      )}
      <div className="grid two">
        <section id="saved" className="card">
          <h2>Saved tips</h2>
          {saved.length ? (
            saved.map((t) => (
              <p key={t.tip_id}>
                <Link href={`/tips/${t.tip_id}`}>Open saved publication</Link>
              </p>
            ))
          ) : (
            <p>
              No saved tips yet. You can save an eligible publication from its
              detail page.
            </p>
          )}
          <h3>Watchlist</h3>
          <p>
            Watchlist targets are not active tips. No approved targets are
            available.
          </p>
          <Link className="text-link" href="/learn">
            Continue reading ↗
          </Link>
        </section>
        <section id="preferences" className="card">
          <h2>Make it yours</h2>
          <ApiForm
            endpoint="/api/member"
            action="preferences"
            submit="Save preferences"
          >
            <Field
              label="IANA timezone"
              name="timezone"
              value={who.profile.timezone}
              required
            />
            <label>
              Odds format
              <select name="oddsFormat" defaultValue={who.profile.odds_format}>
                <option value="decimal">Decimal</option>
                <option value="fractional">Fractional</option>
                <option value="american">American</option>
              </select>
            </label>
            <Field
              label="Sports · comma-separated"
              name="sports"
              value={who.profile.sports.join(",")}
            />
            <Field
              label="Leagues · comma-separated"
              name="leagues"
              value={who.profile.leagues.join(",")}
            />
            <Field
              label="Bookmakers · preferences do not grant eligibility"
              name="bookmakers"
              value={who.profile.bookmakers.join(",")}
            />
            <label>
              Digest preset
              <select name="digest" defaultValue={p?.digest ?? "off"}>
                <option value="off">Off</option>
                <option value="weekly">Weekly only</option>
                <option value="twice_weekly">Twice weekly</option>
              </select>
            </label>
            <Check name="edgeAlerts" checked={p?.edge_alerts}>
              Opt in to edge alerts, capped at two per local day across
              channels.
            </Check>
            <Check name="education" checked={p?.education}>
              Opt in to educational emails.
            </Check>
            <Check name="paused" checked={p?.paused}>
              Pause all optional communications.
            </Check>
            <Check
              name="analytics"
              checked={analyticsConsent[0]?.granted === true}
            >
              Allow optional usage analytics. This choice is separate from email
              and alert consent.
            </Check>
            <p className="small-note">
              Quiet hours: 21:00–08:00 in your timezone. Stale alerts are
              discarded.
            </p>
          </ApiForm>
        </section>
        <section id="personal" className="card">
          <h2>Personal tracking</h2>
          <Notice>
            Optional, self-reported records. Educational only. No stake or
            bankroll recommendation.
          </Notice>
          <ApiForm
            endpoint="/api/member"
            action="personal"
            submit="Add personal record"
          >
            <Field label="Description" name="label" required />
            <Field label="Decimal odds" name="odds" required />
            <label>
              Result
              <select name="result">
                <option value="pending">Pending</option>
                <option value="won">Won</option>
                <option value="lost">Lost</option>
                <option value="void">Void</option>
              </select>
            </label>
          </ApiForm>
          {personal.map((r) => (
            <p key={r.id}>
              {r.label} · {r.odds} · {r.result}
            </p>
          ))}
        </section>
        <section className="card">
          <h2>Country, region and eligibility</h2>
          <p>
            Current declaration: {who.profile.country} / {who.profile.state}. A
            location declaration does not grant access to restricted tips.
            Changing it pauses optional communications while server-side
            eligibility is checked again.
          </p>
          <ApiForm
            endpoint="/api/member"
            action="jurisdiction"
            submit="Update region and pause alerts"
          >
            <label>
              Country
              <select
                name="country"
                defaultValue={who.profile.country}
                required
              >
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
              value={who.profile.state}
              required
            />
            <Check name="age" required>
              I meet the applicable legal age in my country/state and am at
              least 18.
            </Check>
            <Check name="terms" required>
              I accept the current <Link href="/terms">Terms</Link> and
              acknowledge the <Link href="/privacy">Privacy notice</Link>.
            </Check>
          </ApiForm>
        </section>
        <section className="card">
          <h2>Account controls</h2>
          <p>
            Deletion disables access and revokes sessions. Minimal retained
            consent/audit evidence is described in the privacy policy. Download
            your export first.
          </p>
          <ApiForm
            endpoint="/api/member"
            action="delete"
            submit="Delete my account"
          >
            <Field label="Type DELETE to confirm" name="confirm" required />
          </ApiForm>
          <ApiForm
            endpoint="/api/auth"
            action="logout"
            submit="Log out all sessions"
          >
            <span />
          </ApiForm>
        </section>
      </div>
    </div>
  );
}
