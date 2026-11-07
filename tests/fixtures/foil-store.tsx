import { createRoot } from "react-dom/client";
import { useEffect, useState } from "react";
import { AppShell } from "../../src/components/app-shell";
import { SportProvider, useSport } from "../../src/components/sport-context";
import { EnvironmentProvider } from "../../src/components/environment-context";
import { PackShop } from "../../src/components/pack-shop";
import { FoilPackOpeningReview } from "../../src/components/foil-pack-opening-review";
import type { PackShopState } from "../../src/core/pack-shop-state";
import { FoilGallery } from "./foil-gallery";

Object.assign(window, {
  demoPath: "/fantasy/cards",
  fixtureNavigate: (url: string) => {
    location.href = `/fantasy/cards${new URL(url, location.origin).search}`;
  },
});
function ReviewStore() {
  const { sport } = useSport();
  const visibleSport = sport === "afl" || sport === "nrl" ? sport : "nfl";
  const [state, setState] = useState<PackShopState | null>(null);
  const [opening, setOpening] = useState<boolean | null>(null);
  useEffect(() => {
    const focus = new URLSearchParams(location.search).get("focus");
    if (!state || !["standard", "premium"].includes(focus ?? "")) return;
    const frame = requestAnimationFrame(() => {
      const family = document.querySelector(
        `[data-family="${focus!.toUpperCase()}"]`,
      );
      if (family)
        window.scrollTo({
          top: family.getBoundingClientRect().top + window.scrollY - 96,
        });
    });
    return () => cancelAnimationFrame(frame);
  }, [state]);
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/review-store?sport=${visibleSport}`, {
      signal: controller.signal,
    })
      .then((r) => r.json())
      .then((data) => setState(data.state))
      .catch(() => {});
    return () => controller.abort();
  }, [visibleSport]);
  return (
    <>
      <aside className="foil-review-toolbar">
        <p>
          LOCAL DESIGN REVIEW · Sample account · No purchases or inventory
          changes
        </p>
        <nav aria-label="Pack design review">
          <a className="pack-control secondary" href="/fantasy/cards?gallery=1">
            All 21 designs
          </a>
          <a
            className="pack-control secondary"
            href="/fantasy/cards?view=packs&sport=afl&focus=standard"
          >
            Standard AFL 9
          </a>
          <a
            className="pack-control secondary"
            href="/fantasy/cards?view=packs&sport=nrl&focus=premium"
          >
            Premium NRL 9
          </a>
          <button
            className="pack-control pack-primary"
            onClick={() => setOpening(visibleSport === "nrl")}
          >
            Enlarged opening preview
          </button>
        </nav>
      </aside>
      {state && (
        <div className="test-wallet pack-wallet">
          <PackShop
            key={visibleSport}
            sport={visibleSport}
            state={state}
            busy={false}
            recovery={false}
            purchase={async () => {
              throw Error("Design review only. No purchase was made.");
            }}
            refresh={async () => state}
            open={() => setOpening(visibleSport === "nrl")}
          />
        </div>
      )}
      {opening !== null && (
        <FoilPackOpeningReview
          premium={opening}
          onClose={() => setOpening(null)}
        />
      )}
    </>
  );
}
function Fixture() {
  if (new URLSearchParams(location.search).has("gallery"))
    return <FoilGallery />;
  return (
    <EnvironmentProvider
      value={{
        production: true,
        liveBeta: true,
        registrationAvailable: false,
        emailAvailable: false,
        invitationAllowed: false,
        policyVersions: null,
        accountConfigured: true,
        reason: "",
      }}
    >
      <SportProvider>
        <AppShell authenticated>
          <ReviewStore />
        </AppShell>
      </SportProvider>
    </EnvironmentProvider>
  );
}
createRoot(document.getElementById("fixture-root")!).render(<Fixture />);
