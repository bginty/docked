import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { AppHeading } from "@/components/community-basics";
import { appViewer } from "@/server/app-view";
import {
  membershipSummary,
  membershipPlans,
  futureProBenefits,
} from "@/core/membership";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Docked Free and future Pro",
  robots: { index: false, follow: false },
};
export default async function Membership() {
  const { who } = await appViewer();
  const membership = membershipSummary();
  return (
    <AppShell authenticated={!!who}>
      <AppHeading eyebrow="MEMBERSHIP" title="Free first. No hidden next step.">
        {membership.message}
      </AppHeading>
      <div className="membership-grid">
        <section className="app-panel">
          <p className="eyebrow">AVAILABLE SUBJECT TO ACCESS GATES</p>
          <h2>{membershipPlans[0].name}</h2>
          <p className="price-display">Free</p>
          <p>No card required.</p>
          <ul>
            {membershipPlans[0].benefits.map((b) => (
              <li key={b}>{b.replaceAll("_", " ")}</li>
            ))}
          </ul>
          <Link className="button" href={who ? "/home" : "/join"}>
            {who ? "Your Docked home" : "Join free"}
          </Link>
        </section>
        <section className="app-panel">
          <p className="coming-label">FUTURE PREVIEW · NOT AVAILABLE</p>
          <h2>Docked Pro</h2>
          <p>
            Potential future tools. Pricing has not been set and billing is
            disabled.
          </p>
          <ul>
            {futureProBenefits.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
          <p className="app-state-banner">
            No purchase, payment collection or automatic conversion.
          </p>
        </section>
      </div>
      <aside className="integrity-note">
        <p>
          Membership never buys verification, a performance badge or a Top
          Docked advantage. Official losses and corrections remain transparent.
          Safety information is never delayed for Free members. The first free
          year starts from a recorded public launch; no launch has been inferred
          from this preview.
        </p>
      </aside>
      <div className="actions">
        <Link href="/competitions">Future competitions</Link>
        <Link href="/deals">Future deals</Link>
        <Link href="/dashboard">Account and privacy</Link>
      </div>
    </AppShell>
  );
}
