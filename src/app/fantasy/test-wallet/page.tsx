import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { MemberTestWallet } from "@/components/member-test-wallet";
import { memberTestWallet } from "@/server/member-test-wallet";
import { FantasyLoadError } from "@/components/fantasy-load-error";
import { memberAccessFailure } from "@/core/member-access-recovery";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Docked · Packs & test wallet",
  robots: { index: false, follow: false },
};
export default async function TestWalletPage({searchParams}:{searchParams:Promise<{view?:string}>}) {
  const {view}=await searchParams;
  let data;
  try {
    data = await memberTestWallet();
  } catch (error) {
    const kind=memberAccessFailure(error);
    if(kind !== "permission") return <FantasyLoadError authRequired={kind === "authentication"} mfaRequired={kind === "mfa"} />;
    return (
      <main className="fantasy-gate">
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
      <MemberTestWallet initial={data.state} surface={view==="packs"?"packs":"wallet"}/>
    </AppShell>
  );
}

import "../../test-wallet.css";
