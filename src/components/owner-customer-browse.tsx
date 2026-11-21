"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { publicSports, isPublicSport } from "@/core/public-customer";
import { paidPackOffers } from "@/core/paid-pack-catalogue";
import { PackArtwork } from "./pack-artwork";
import { PublicClubhouse } from "./public-clubhouse";
import { LogoutControls } from "./account-navigation";

export function OwnerCustomerBrowse() {
  const path = usePathname();
  const query = useSearchParams();
  const selected = query.get("sport");
  const sport = isPublicSport(selected) ? selected : "nfl";
  const catalogue =
    path === "/fantasy/cards" &&
    query.get("tab") === "packs" &&
    query.get("packs") !== "mine";
  const titles: Record<string, string> = {
    "/fantasy/cards": query.get("packs") === "mine" ? "My packs" : "My Cards",
    "/fantasy/test-wallet": "Docked Credits",
    "/fantasy/profile": "Your profile",
    "/fantasy/social": "Social",
    "/fantasy/market": "Market",
  };
  return (
    <>
      {(path === "/fantasy/play" || catalogue) && (
        <nav className="owned-sports" aria-label="Sport">
          {publicSports.map((key) => {
            const params = new URLSearchParams(query.toString());
            params.set("sport", key);
            return (
              <Link
                key={key}
                href={path + "?" + params}
                aria-current={key === sport ? "page" : undefined}
              >
                {key.toUpperCase()}
              </Link>
            );
          })}
        </nav>
      )}
      {path === "/fantasy/play" ? (
        <PublicClubhouse sport={sport} />
      ) : catalogue ? (
        <section className="fantasy-panel pack-shop">
          <h1>{sport.toUpperCase()} packs</h1>
          <Link
            className="pack-control secondary"
            href={"/fantasy/play?sport=" + sport}
          >
            Back to {sport.toUpperCase()} clubhouse
          </Link>
          {(["STANDARD", "PREMIUM"] as const).map((tier) => (
            <section className="pack-family" data-family={tier} key={tier}>
              <header>
                <h2>{tier === "STANDARD" ? "Standard" : "Premium"}</h2>
              </header>
              <div className="pack-product-grid">
                {paidPackOffers
                  .filter((pack) => pack.type === tier)
                  .map((pack) => (
                    <article className="pack-product" key={pack.id}>
                      <PackArtwork
                        presentation="catalogue"
                        sport={sport}
                        count={pack.cards}
                        name={pack.name}
                        premium={pack.type === "PREMIUM"}
                      />
                      <h3>{pack.name}</h3>
                      <p className="pack-product-guarantee">
                        {pack.cards} {pack.cards === 1 ? "card" : "cards"}
                      </p>
                      <p className="pack-price">
                        <strong>
                          {pack.priceCredits.toLocaleString("en-AU")}
                        </strong>{" "}
                        credits
                      </p>
                    </article>
                  ))}
              </div>
            </section>
          ))}
          <Link href="/refund-policy">Purchases and refunds</Link>
        </section>
      ) : (
        <section className="fantasy-panel">
          <h1>{titles[path] ?? "Docked"}</h1>
          {path === "/fantasy/test-wallet" && (
            <p>
              The Android wallet shows available Google Play top-ups and their
              GST-inclusive prices before checkout.
            </p>
          )}
          {path === "/fantasy/market" && (
            <p>Buying, selling and swapping are closed.</p>
          )}
          {path === "/fantasy/profile" && <LogoutControls allDevices />}
        </section>
      )}
      <p>
        To buy or participate with your own account,{" "}
        <Link href="/app/onboarding">complete customer setup</Link>.
      </p>
    </>
  );
}
