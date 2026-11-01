import Link from "next/link";
import { redirect } from "next/navigation";
import { packShopHref, packTab } from "@/core/pack-presentation";
import { AppShell } from "@/components/app-shell";
import { MemberTestWallet } from "@/components/member-test-wallet";
import { memberTestWallet } from "@/server/member-test-wallet";
import { FantasyLoadError } from "@/components/fantasy-load-error";
import { memberAccessFailure } from "@/core/member-access-recovery";
import { StartupReady } from "@/components/startup-loading";
import { cookies } from "next/headers";
import { activeSportCookie, workspaceSport } from "@/core/workspace-sport";
import { commercialSurfaceEnabled } from "@/core/commercial-presentation";
import { requireIdentity } from "@/server/auth";
import { CommercialMember } from "@/components/commercial-member";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Docked · Packs & test wallet",
  robots: { index: false, follow: false },
};
export default async function TestWalletPage({
  searchParams,
}: {
  searchParams: Promise<{
    view?: string;
    sport?: string;
    packs?: string;
    tab?: string;
  }>;
}) {
  const params = await searchParams;
  const { view, sport: requested } = params;
  if (view === "packs") {
    const selected = workspaceSport(
      requested,
      (await cookies()).get(activeSportCookie)?.value,
    );
    const q = new URLSearchParams();
    if (params.packs) q.set("packs", params.packs);
    if (params.tab) q.set("tab", params.tab);
    redirect(packShopHref(selected, packTab(q.toString())));
  }
  let data;
  try {
    if (commercialSurfaceEnabled()) {
      const who = await requireIdentity();
      const selected = workspaceSport(
        requested,
        (await cookies()).get(activeSportCookie)?.value,
      );
      return (
        <AppShell authenticated>
          <CommercialMember
            key={who.user.id}
            member={who.user.id}
            sport={selected === "afl" || selected === "nrl" ? selected : "nfl"}
            surface="wallet"
          />
        </AppShell>
      );
    }
    data = await memberTestWallet(undefined, "wallet");
  } catch (error) {
    const kind = memberAccessFailure(error);
    if (kind !== "permission")
      return (
        <FantasyLoadError
          authRequired={kind === "authentication"}
          mfaRequired={kind === "mfa"}
        />
      );
    return (
      <main className="fantasy-gate">
        <StartupReady />
        <h1>Private test wallet</h1>
        <p>This area is available only to the admitted owner and tester.</p>
        <Link href="/app/login">Sign in with your own account</Link>
        <p>
          <Link href="/fantasy/cards">Back to Cards</Link>
        </p>
      </main>
    );
  }
  return (
    <AppShell authenticated>
      <MemberTestWallet initial={data.state} surface="wallet" />
    </AppShell>
  );
}

import "../../test-wallet.css";
