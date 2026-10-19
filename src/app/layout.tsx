import type { Metadata, Viewport } from "next";
import "./brand-theme.css";
import "./globals.css";
import "./sports-visuals.css";
import "./sports-experience.css";
import "./community-app.css";
import "./native.css";
import "./mobile-app.css";
import "./app-auth.css";
import "./beta-experience.css";
import { NativeBridge } from "@/components/native-bridge";
import { environmentPresentation } from "@/server/presentation";
import { EnvironmentProvider } from "@/components/environment-context";
import { AnalyticsObserver } from "@/components/analytics-observer";
import { brand } from "@/brand/brand";
import "./fantasy.css";
import "./fantasy-play.css";
import "./pack-opening.css";
import "./scoring.css";
import "./mobile-cleanup.css";
import "./play-cards.css";
import "./redemption.css";
import "./social-hub.css";
import "./collectible.css";
import "./card-viewer.css";
import "./player-statistics.css";
import "./nfl-testing.css";
import "./standings.css";
import "./prizes.css";
import "./startup-loading.css";
import { StartupBoundary } from "@/components/startup-loading";
import "./pack-shop.css";
import "./premium-ux.css";
import "./owner-command.css";
import { SportProvider } from "@/components/sport-context";
import { fantasyTagline } from "@/core/fantasy";
import { fantasyAssets } from "@/brand/fantasy-assets";
import { reviewOrigin } from "@/core/hosted-review.mjs";
import { betaOrigin } from "@/core/hosted-beta.mjs";
export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.DOCKED_BETA_STAGING === "true"
      ? betaOrigin(process.env)
      : process.env.DOCKED_HOSTED_REVIEW === "true"
        ? reviewOrigin(process.env)
        : (process.env.SITE_URL ?? "http://localhost:3000"),
  ),
  title: { default: "Docked — " + fantasyTagline, template: "%s | Docked" },
  description:
    "Collect player cards, build your NFL fantasy team and follow post-game points. Free invited beta; EPL coming when verified.",
  manifest: "/manifest.webmanifest",
  robots: { index: false, follow: false },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Docked",
  },
  icons: { icon: fantasyAssets.favicon, apple: fantasyAssets.apple },
  openGraph: {
    title: "Docked — " + fantasyTagline,
    images: [fantasyAssets.social],
  },
  twitter: {
    card: "summary_large_image",
    title: "Docked — " + fantasyTagline,
    images: [fantasyAssets.social],
  },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: brand.colors.navy,
};
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const environment = await environmentPresentation();
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body className="fantasy-mode">
        <EnvironmentProvider value={environment}>
          <SportProvider>
            {environment.liveBeta && (
              <div
                className="topline"
                role="region"
                aria-label="Beta participation notice"
              >
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
            <main id="main">
              <StartupBoundary>{children}</StartupBoundary>
            </main>
          </SportProvider>
        </EnvironmentProvider>
      </body>
    </html>
  );
}
import "./owner-reference.css";
