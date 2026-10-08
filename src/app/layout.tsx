import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./brand-theme.css";
import "./globals.css";
import "./sports-visuals.css";
import "./sports-experience.css";
import "./community-app.css";
import "./native.css";
import "./mobile-app.css";
import "./app-auth.css";
import "./beta-experience.css";
import "./phase5-edges.css";
import "./phase5c-research.css";
import { NativeBridge } from "@/components/native-bridge";
import { environmentPresentation } from "@/server/presentation";
import { EnvironmentProvider } from "@/components/environment-context";
import { headerAccountLabel } from "@/core/public-presentation";
import { AnalyticsObserver } from "@/components/analytics-observer";
import { SportIcon } from "@/components/sport-icon";
import { BrandLogo } from "@/components/brand-logo";
import { brand } from "@/brand/brand";
import "./fantasy.css";
import { fantasyTagline } from "@/core/fantasy";
import {
  fantasyPlatformEnabled as fantasyEnabled,
  fantasyProductionEnabled,
} from "@/core/fantasy-production";
import { fantasyAssets } from "@/brand/fantasy-assets";
export const metadata: Metadata = {
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Docked",
  },
  icons: {
    apple: "/brand/icons/docked-app-icon-180.png",
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      {
        url: "/brand/icons/docked-app-icon-32.png",
        sizes: "32x32",
        type: "image/png",
      },
    ],
  },
  metadataBase: new URL(process.env.SITE_URL ?? "http://localhost:3000"),
  title: {
    default: `Docked — ${brand.tagline}`,
    template: "%s | Docked",
  },
  description:
    "Sports intelligence, transparent research and community. Built for an edge. No guaranteed returns.",
  robots:
    process.env.APP_ENV === "production" &&
    process.env.DOCKED_RELEASE_CHANNEL !== "beta"
      ? { index: true, follow: true }
      : { index: false, follow: false },
  openGraph: {
    title: `Docked — ${brand.tagline}`,
    description: "Transparent sports-pricing research. No guaranteed returns.",
    type: "website",
    siteName: "Docked",
    locale: "en_AU",
    images: ["/opengraph-image"],
  },
  twitter: {
    card: "summary_large_image",
    title: `Docked — ${brand.tagline}`,
    description: "Transparent sports-pricing research. No guaranteed returns.",
    images: ["/opengraph-image"],
  },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: brand.colors.navy,
};
if (fantasyEnabled()) {
  metadata.title = {
    default: `Docked — ${fantasyTagline}`,
    template: "%s | Docked",
  };
  metadata.description =
    "Collect fictional player cards and build your fantasy team.";
  metadata.robots =
    process.env.APP_ENV === "production" &&
    process.env.DOCKED_RELEASE_CHANNEL !== "beta"
      ? { index: true, follow: true }
      : { index: false, follow: false };
  metadata.openGraph = {
    title: `Docked — ${fantasyTagline}`,
    description: fantasyProductionEnabled()
      ? "Free Fantasy Cards"
      : "Fantasy Cards Preview",
    images: [fantasyAssets.social],
  };
  metadata.twitter = {
    card: "summary_large_image",
    title: `Docked — ${fantasyTagline}`,
    images: [fantasyAssets.social],
  };
  metadata.icons = { icon: fantasyAssets.favicon, apple: fantasyAssets.apple };
}
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const environment = await environmentPresentation();
  if (environment.fantasyPreview || environment.fantasyProduction)
    return (
      <html lang="en">
        <body className="fantasy-mode">
          <EnvironmentProvider value={environment}>
            {environment.liveBeta && (
              <div className="topline">
                <span>DOCKED BETA · Invited members only</span>
                <span>
                  18+ · Experimental gameplay and rankings · No cash value
                </span>
              </div>
            )}
            <AnalyticsObserver />
            <NativeBridge />
            <a className="skip-link" href="#main">
              Skip to content
            </a>
            <main id="main">{children}</main>
          </EnvironmentProvider>
        </body>
      </html>
    );
  return (
    <html lang="en">
      <body>
        <EnvironmentProvider value={environment}>
          {environment.liveBeta && (
            <div className="topline">
              <span>DOCKED BETA · Invited members only</span>
              <span>18+ · No validated betting recommendations</span>
            </div>
          )}
          <AnalyticsObserver />
          <NativeBridge />
          <a className="skip-link" href="#main">
            Skip to content
          </a>
          <div className="topline">
            <span>{brand.tagline}</span>
            <span>
              18+ ·{" "}
              {environment.production ? "Sports research" : "Research preview"}
            </span>
          </div>
          <header className="site-header">
            <div className="header-inner">
              <Link className="brand" href="/" aria-label="Docked home">
                <BrandLogo decorative />
              </Link>
              <nav className="public-primary-nav" aria-label="Main navigation">
                <Link href="/edges">Edges</Link>
                <Link href="/results">Results</Link>
                <Link href="/sports">
                  <SportIcon sport="football" size={17} />
                  Sports
                </Link>
                <Link href="/research">Research</Link>
                <Link href="/community">Community</Link>
                <Link href="/learn">Learn</Link>
                <Link href="/methodology">Methodology</Link>
              </nav>
              <div className="account-nav">
                <Link href="/login">Sign in</Link>
                <Link className="button small" href="/join">
                  {headerAccountLabel(environment)}{" "}
                  <span aria-hidden="true">↗</span>
                </Link>
              </div>
            </div>
            <details className="public-mobile-more">
              <summary>Explore Docked</summary>
              <nav aria-label="Explore Docked">
                <Link href="/edges">Edges</Link>
                <Link href="/results">Results</Link>
                <Link href="/sports">Sports</Link>
                <Link href="/community">Community</Link>
                <Link href="/learn">Learn</Link>
                <Link href="/research">Research</Link>
                <Link href="/methodology">Methodology</Link>
              </nav>
            </details>
          </header>
          {!environment.production && (
            <div className="preview-banner">
              PREVIEW · Model research in progress · Live tips and outbound
              alerts are off
            </div>
          )}
          <main id="main">{children}</main>
          <footer>
            <div className="footer-grid">
              <div>
                <Link className="brand" href="/" aria-label="Docked home">
                  <BrandLogo surface="dark" decorative />
                </Link>
                <p className="brand-tagline">{brand.tagline}</p>
                <p className="muted">
                  Informational analysis. No wagering, wallets or guaranteed
                  returns.
                </p>
              </div>
              <nav aria-label="Research links">
                <Link href="/methodology">Methodology</Link>
                <Link href="/sports">Sports and research scope</Link>
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
                All core features free for 12 months from public launch. No
                card. No automatic conversion.
              </p>
            </div>
          </footer>
        </EnvironmentProvider>
      </body>
    </html>
  );
}
