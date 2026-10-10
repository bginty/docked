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
    "Collect limited player cards, build fantasy teams and compete across sports. Closed Preview; football gameplay first.",
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
}
