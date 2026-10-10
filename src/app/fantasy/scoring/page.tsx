import { notFound, redirect } from "next/navigation";
import { requireIdentity } from "@/server/auth";
import { AppShell } from "@/components/app-shell";
import { ScoringReview, type ScoringDemo } from "@/components/scoring-review";
import demo from "../../../../config/scoring-demo.json";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Scoring lab · simulated beta",
  robots: { index: false, follow: false },
};
export default async function ScoringPage() {
  if (
    process.env.VERCEL_ENV !== "preview" &&
    process.env.NODE_ENV !== "development"
  )
    notFound();
  try {
    await requireIdentity();
  } catch (error) {
    redirect(
      error instanceof Error && error.message === "Privileged MFA required"
        ? "/mfa"
        : "/app/login",
    );
  }
  return (
    <AppShell authenticated>
      <ScoringReview data={demo as ScoringDemo} />
    </AppShell>
  );
}
