"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { publicSports, isPublicSport } from "@/core/public-customer";
import { paidPackOffers } from "@/core/paid-pack-catalogue";
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
        <section className="fantasy-panel">
          <h1>{sport.toUpperCase()} packs</h1>
          <ul>
            {paidPackOffers.map((p) => (
              <li key={p.id}>
                {p.name} · {p.priceCredits.toLocaleString("en-AU")} credits
              </li>
            ))}
          </ul>
          <Link href="/refund-policy">Purchases and refunds</Link>
        </section>
      ) : (
        <section className="fantasy-panel">
          <h1>{titles[path] ?? "Docked"}</h1>
          {path === "/fantasy/test-wallet" && (
            <p>
              Google Play offers 4,900 credits for A$49 and 9,900 credits for
              A$99, including GST.
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
