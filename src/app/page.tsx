import { environmentPresentation } from "@/server/presentation";
import { phoneDeliveryReady } from "@/core/public-phone";
import { PaidLaunchHome } from "@/components/paid-launch-home";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "NFL, AFL and NRL collectible cards",
  alternates: { canonical: "/" },
};

export default async function Home() {
  // Same request-cached registration projection as signup; this controls a link,
  // while Auth and the database independently enforce admission.
  const environment = await environmentPresentation();
  const canRegister =
    environment.registrationAvailable &&
    environment.publicCustomer &&
    environment.commercialSurface &&
    process.env.DOCKED_COMMERCIAL_CHECKOUT === "true" &&
    phoneDeliveryReady();
  return (
    <PaidLaunchHome
      canRegister={canRegister}
      cashWithdrawalPolicyPublished={environment.cashWithdrawalPolicyPublished}
      marketplaceAvailable={environment.commercialMarketplace}
    />
  );
}
