import Link from "next/link";
import type { ReactNode } from "react";
import { SportIcon } from "./sport-icon";
import { AppIcon } from "./app-icon";
export function AppHeading({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <header className="app-page-heading">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      {children && <p>{children}</p>}
    </header>
  );
}
export function AccessGate({
  configured,
  title = "Sign in to your verified account",
}: {
  configured: boolean;
  title?: string;
}) {
  return (
    <section className="app-empty">
      <AppIcon name="shield" size={32} />
      <h2>{title}</h2>
      <p>
        {configured
          ? "Your account and region permissions are checked before community records or private controls are shown."
          : "Account service is NOT_CONFIGURED in this preview. Community records and private controls are unavailable until the dedicated Docked environment is connected."}
      </p>
      <div className="actions">
        <Link className="button" href="/login">
          Sign in
        </Link>
        <Link className="button ghost" href="/learn">
          Explore the reading room
        </Link>
      </div>
    </section>
  );
}
export function CommunityEmpty({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="app-empty">
      <AppIcon name="community" size={30} />
      <h2>{title}</h2>
      <p>{children}</p>
    </section>
  );
}
export function OfficialBadge() {
  return (
    <span className="official-badge">
      <AppIcon name="shield" size={15} />
      DOCKED · OFFICIAL
    </span>
  );
}
export function SportChips({
  base,
  selected,
  query = "",
}: {
  base: string;
  selected?: string;
  query?: string;
}) {
  return (
    <nav className="sport-chips" aria-label="Filter by sport">
      {[
        ["", "All sports"],
        ["football", "Football"],
        ["basketball", "Basketball"],
        ["tennis", "Tennis"],
      ].map(([sport, label]) => (
        <Link
          key={label}
          href={`${base}?${query}${sport ? `sport=${sport}` : ""}`}
          aria-current={(selected ?? "") === sport ? "page" : undefined}
        >
          {sport && <SportIcon sport={sport} size={18} />} {label}
        </Link>
      ))}
    </nav>
  );
}
export function IntegrityNote() {
  return (
    <aside className="integrity-note">
      <AppIcon name="shield" />
      <p>
        Verified community Edges use provider-observed standard odds and a fixed
        1.00-unit benchmark. Social posts, promotional prices and unsupported
        claims are excluded.{" "}
        <Link href="/top-docked#rules">Read the ranking rules</Link>.
      </p>
    </aside>
  );
}
