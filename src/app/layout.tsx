import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { config } from "@/server/config";
export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL ?? "http://localhost:3000"),
  title: {
    default: "Docked — Only when the price offers value.",
    template: "%s | Docked",
  },
  description:
    "Transparent sports-pricing research. Every published tip tracked. No guaranteed returns.",
  robots:
    process.env.APP_ENV === "production"
      ? { index: true, follow: true }
      : { index: false, follow: false },
  openGraph: {
    title: "Docked — Only when the price offers value.",
    description: "Transparent sports-pricing research. No guaranteed returns.",
    images: ["/social-card.svg"],
  },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <div className="topline">
          <span>INDEPENDENT THINKING. ACCOUNTABLE RECORDS.</span>
          <span>18+ · Research preview</span>
        </div>
        <header className="site-header">
          <div className="header-inner">
            <Link className="brand" href="/" aria-label="Docked home">
              <span className="brand-symbol" aria-hidden="true">
                D
              </span>
              DOCKED<span className="brand-dot">.</span>
            </Link>
            <nav aria-label="Main navigation">
              <Link href="/edges">Edges</Link>
              <Link href="/results">Results</Link>
              <Link href="/research">Research</Link>
              <Link href="/learn">Learn</Link>
            </nav>
            <div className="account-nav">
              <Link href="/login">Log in</Link>
              <Link className="button small" href="/join">
                Join free <span aria-hidden="true">↗</span>
              </Link>
            </div>
          </div>
        </header>
        {!config().production && (
          <div className="preview-banner">
            PREVIEW · Historical validation pending · Live tips and outbound
            alerts are off
          </div>
        )}
        <main id="main">{children}</main>
        <footer>
          <div className="footer-grid">
            <div>
              <Link className="brand" href="/">
                DOCKED.
              </Link>
              <p>Only when the price offers value.</p>
              <p className="muted">
                Informational analysis. No wagering, wallets or guaranteed
                returns.
              </p>
            </div>
            <nav aria-label="Research links">
              <Link href="/methodology">Methodology</Link>
              <Link href="/data-status">Data status</Link>
              <Link href="/about">About Docked</Link>
              <Link href="/contact">Contact</Link>
            </nav>
            <nav aria-label="Policy links">
              <Link href="/safer-gambling">Safer Gambling</Link>
              <Link href="/terms">Terms</Link>
              <Link href="/privacy">Privacy</Link>
              <Link href="/legacy-support">Legacy product support</Link>
            </nav>
          </div>
          <div className="footer-base">
            <p>
              Gambling can cause harm. Never chase losses. You can use Docked
              without betting.
            </p>
            <p>
              All core features free for 12 months from public launch. No card.
              No automatic conversion.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
