import { sportSandbox } from "@/server/sport-sandbox";
import { SportSandbox } from "@/components/sport-sandbox";
import { FantasyLoadError } from "@/components/fantasy-load-error";
import { memberAccessFailure } from "@/core/member-access-recovery";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Docked · Private sport testing",
  robots: { index: false, follow: false },
};
export default async function SportsPreview({
  searchParams,
}: {
  searchParams: Promise<{ sport?: string }>;
}) {
  try {
    const { state } = await sportSandbox((await searchParams).sport ?? "afl");
    return (
      <SportSandbox initial={state} navigationPath="/app/sports-preview" />
    );
  } catch (e) {
    const kind = memberAccessFailure(e);
    return (
      <FantasyLoadError
        authRequired={kind === "authentication"}
        mfaRequired={kind === "mfa"}
        permissionDenied={kind === "permission"}
      />
    );
  }
}
